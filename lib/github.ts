// Server-side GitHub API client with caching.
//
// Cache strategy:
//   - In-memory Map with TTL (works in serverless — cache lives per instance)
//   - For higher traffic, swap to Vercel KV by changing get/set methods
//   - Repo language data changes rarely, so 1-hour TTL is conservative
//
// Auth:
//   - Uses GITHUB_TOKEN env var if set (5,000 req/hr)
//   - Falls back to unauthenticated (60 req/hr per IP — the server's IP, not the user's)

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  // Prevent unbounded growth — evict expired first, then oldest
  if (cache.size > 5000) {
    const now = Date.now();
    let evicted = false;
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) {
        cache.delete(k);
        evicted = true;
        break;
      }
    }
    if (!evicted) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
  cache.set(key, { data, ts: Date.now() });
}

// ─── GitHub API ─────────────────────────────────────────────────────────────

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "repocost/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

export interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  owner: {
    avatar_url: string;
    login: string;
  };
  html_url: string;
  default_branch: string;
}

export interface RepoData {
  meta: RepoMeta;
  languages: Record<string, number>;
}

export async function fetchRepoData(owner: string, repo: string): Promise<RepoData> {
  const cacheKey = `repo:${owner}/${repo}`;
  const cached = getCached<RepoData>(cacheKey);
  if (cached) return cached;

  const headers = ghHeaders();

  // Fetch metadata and languages in parallel
  const [metaRes, langRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, signal: AbortSignal.timeout(10_000) }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers, signal: AbortSignal.timeout(10_000) }),
  ]);

  if (metaRes.status === 404) {
    throw new Error("Repository not found. Check the URL and ensure it's public.");
  }
  if (metaRes.status === 403) {
    const remaining = metaRes.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new Error("GitHub API rate limit exceeded. Try again in a few minutes.");
    }
    throw new Error("GitHub API access denied.");
  }
  if (!metaRes.ok) {
    throw new Error(`GitHub API error: ${metaRes.status}`);
  }
  if (!langRes.ok) {
    throw new Error("Failed to fetch language data from GitHub.");
  }

  const meta = await metaRes.json() as RepoMeta;
  const languages = await langRes.json() as Record<string, number>;

  const data: RepoData = { meta, languages };
  setCached(cacheKey, data);

  return data;
}
