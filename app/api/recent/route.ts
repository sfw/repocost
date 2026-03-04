import { NextResponse } from "next/server";
import { getRecentSearches } from "@/lib/kv";

export const runtime = "edge";

export async function GET() {
  const searches = await getRecentSearches();
  return NextResponse.json(searches, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  });
}
