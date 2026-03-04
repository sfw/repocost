# repocost

Estimate the human effort and cost to build any GitHub repository from scratch. Powered by COCOMO II with per-language market rates.

## How it works

1. Fetches language byte data from GitHub's API
2. Converts bytes → SLOC using per-language bytes-per-line ratios
3. Applies complexity weights (Rust 1.4×, Java 0.8×, etc.)
4. Runs COCOMO II: `Effort = 2.94 × (KSLOC)^1.0997` person-months
5. Costs each language's share of effort at its market hourly rate

## Stack

- **Next.js 15** (App Router, Edge Runtime)
- **Recharts** for visualization
- **Canvas API** for downloadable receipt cards
- **Vercel OG** for dynamic social preview images
- **In-memory cache** with 1-hour TTL (API proxy)

## Deploy to Vercel

```bash
# 1. Clone and install
git clone https://github.com/sfw/repocost.git
cd repocost
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local — add a GitHub token for higher rate limits

# 3. Run locally
npm run dev

# 4. Deploy
npx vercel
```

Or just click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sfw/repocost&env=GITHUB_TOKEN,NEXT_PUBLIC_URL)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | GitHub PAT for 5K req/hr (vs 60 without) |
| `NEXT_PUBLIC_URL` | For OG images | Your deployed URL (e.g. `https://repocost.dev`) |

## Shareable URLs

Every estimate gets a shareable URL:

```
repocost.dev/facebook/react
repocost.dev/vercel/next.js
```

These generate dynamic OG images, so sharing on X/LinkedIn shows a preview card with the cost estimate.

## Caching

Three layers:

1. **In-memory server cache** — 1hr TTL per repo (survives within a single serverless instance)
2. **Vercel Edge Cache** — `s-maxage=3600` on API responses (shared across all users)
3. **Browser cache** — `max-age=300` (5 min client-side)

For high traffic, swap the in-memory cache for Vercel KV (Redis) — the interface is the same, just change `getCached`/`setCached` in `lib/github.ts`.

## License

MIT
