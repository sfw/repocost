import { NextRequest, NextResponse } from "next/server";

// ─── In-memory sliding window rate limiter ──────────────────────────────────
// 30 requests per minute per IP. Lightweight, no dependencies.
// Resets per serverless instance — acceptable for abuse prevention.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

// Periodic cleanup to prevent memory leak from stale IPs
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  for (const [ip, timestamps] of hits) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > WINDOW_MS) {
      hits.delete(ip);
    }
  }
}

function isRateLimited(ip: string): { limited: boolean; retryAfter: number } {
  cleanup();
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let timestamps = hits.get(ip);
  if (!timestamps) {
    timestamps = [];
    hits.set(ip, timestamps);
  }

  // Drop entries outside the window
  while (timestamps.length > 0 && timestamps[0] <= windowStart) {
    timestamps.shift();
  }

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfter };
  }

  timestamps.push(now);
  return { limited: false, retryAfter: 0 };
}

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const { limited, retryAfter } = isRateLimited(ip);

  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
