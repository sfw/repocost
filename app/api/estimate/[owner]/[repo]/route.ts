import { NextRequest, NextResponse } from "next/server";
import { fetchRepoData } from "@/lib/github";
import { estimate } from "@/lib/estimate";

export const runtime = "edge"; // Fast cold starts, runs at edge

interface Params {
  params: Promise<{ owner: string; repo: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { owner, repo } = await params;

  // Basic input validation
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Invalid repository path." }, { status: 400 });
  }

  try {
    const data = await fetchRepoData(owner, repo);

    if (Object.keys(data.languages).length === 0) {
      return NextResponse.json(
        { error: "No code found in this repository." },
        { status: 422 }
      );
    }

    const est = estimate(data.languages);

    return NextResponse.json(
      { meta: data.meta, estimate: est },
      {
        status: 200,
        headers: {
          // Client can cache for 5 min, CDN for 1 hour
          "Cache-Control": "public, s-maxage=3600, max-age=300, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404
      : message.includes("rate limit") ? 429
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
