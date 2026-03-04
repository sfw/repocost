import { Redis } from "@upstash/redis";

const KEY = "recent_searches";
const DATA_KEY = "recent_searches:data";

export interface RecentSearch {
  repo: string;
  cost: number;
  stars: number;
  ts: number;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function recordSearch(entry: RecentSearch): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;

    // Use repo name as the sorted set member — re-searching updates score + data, no duplicates
    await redis.zadd(KEY, { score: entry.ts, member: entry.repo });
    await redis.hset(DATA_KEY, { [entry.repo]: JSON.stringify({ cost: entry.cost, stars: entry.stars }) });
    await redis.zremrangebyrank(KEY, 0, -21); // keep newest 20
  } catch {
    // Redis unavailable — silently ignore
  }
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const redis = getRedis();
    if (!redis) return [];

    // Get repos newest-first with their scores (timestamps)
    const raw = await redis.zrange(KEY, 0, -1, { rev: true, withScores: true });
    // raw is [member, score, member, score, ...]
    const repos: { repo: string; ts: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      repos.push({ repo: raw[i] as string, ts: raw[i + 1] as number });
    }
    if (repos.length === 0) return [];

    // Batch-fetch metadata
    const fields = repos.map((r) => r.repo);
    const meta = await redis.hmget(DATA_KEY, ...fields) ?? {};

    return repos.map((r) => {
      const raw = meta?.[r.repo];
      const data = typeof raw === "string" ? JSON.parse(raw) : (raw ?? { cost: 0, stars: 0 });
      return { repo: r.repo, cost: data.cost, stars: data.stars, ts: r.ts };
    });
  } catch {
    return [];
  }
}
