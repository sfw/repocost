import { Redis } from "@upstash/redis";

const KEY = "recent_searches";

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

    const dedupKey = `dedup:${entry.repo}`;
    const already = await redis.get(dedupKey);
    if (already) return;

    await redis.set(dedupKey, 1, { ex: 3600 }); // 1hr dedup
    await redis.zadd(KEY, { score: entry.ts, member: JSON.stringify(entry) });
    await redis.zremrangebyrank(KEY, 0, -21); // keep newest 20
  } catch {
    // Redis unavailable — silently ignore
  }
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const redis = getRedis();
    if (!redis) return [];

    const raw = await redis.zrange(KEY, 0, -1, { rev: true });
    return (raw as (string | RecentSearch)[]).map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
  } catch {
    return [];
  }
}
