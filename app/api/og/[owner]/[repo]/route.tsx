import { ImageResponse } from "next/og";
import { fetchRepoData } from "@/lib/github";
import { estimate, fmtBigCost, fmtDur, fmtCost, fmt } from "@/lib/estimate";

export const runtime = "edge";

interface Params {
  params: Promise<{ owner: string; repo: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { owner, repo } = await params;

  // Input validation — same as estimate route
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            backgroundColor: "#0c0c18", color: "#fff",
            fontFamily: "-apple-system, sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: "48px", fontWeight: 800, marginBottom: "16px" }}>repocost</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#666" }}>
            Estimate the cost to build any GitHub repo
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  try {
    const data = await fetchRepoData(owner, repo);
    const est = estimate(data.languages);
    const [bigNum, bigUnit] = fmtBigCost(est.cost);
    const topLangs = est.langs.slice(0, 5);
    const costLabel = bigUnit ? `${bigNum} ${bigUnit}` : bigNum;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0c0c18",
            padding: "48px 56px",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            color: "#ffffff",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 800, color: "#ffffff" }}>repocost</div>
            <div style={{
              display: "flex", fontSize: "14px", color: "#777",
              background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: "6px",
            }}>
              COCOMO II
            </div>
          </div>

          {/* Repo name */}
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700, color: "#fff", marginBottom: "32px" }}>
            {data.meta.full_name}
          </div>

          {/* Big number */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
            <div style={{ display: "flex", fontSize: "84px", fontWeight: 800, letterSpacing: "-3px", lineHeight: 1, color: "#fff" }}>
              {costLabel}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: "18px", color: "#777", marginBottom: "36px" }}>
            estimated cost to build with human developers
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: "32px", marginBottom: "32px",
            borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px",
          }}>
            {[
              ["Person-months", est.pm.toFixed(1)],
              ["Schedule", fmtDur(est.months)],
              ["Team size", est.team.toFixed(1) + " devs"],
              ["SLOC", fmt(est.sloc)],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", fontSize: "12px", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {label}
                </div>
                <div style={{ display: "flex", fontSize: "24px", fontWeight: 700, color: "#ddd" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Language pills */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {topLangs.map((l) => (
              <div
                key={l.name}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              >
                <div style={{ display: "flex", width: "10px", height: "10px", borderRadius: "3px", backgroundColor: l.color }} />
                <span style={{ display: "flex", color: "#999" }}>{l.name}</span>
                <span style={{ display: "flex", color: "#ccc", fontWeight: 700 }}>{fmtCost(l.cost)}</span>
              </div>
            ))}
          </div>

          {/* Range footer */}
          <div style={{
            display: "flex", marginTop: "auto", fontSize: "14px", color: "#777",
          }}>
            Range: {fmtCost(est.lo.cost)} – {fmtCost(est.hi.cost)}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    // Fallback OG image
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            backgroundColor: "#0c0c18", color: "#fff",
            fontFamily: "-apple-system, sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: "48px", fontWeight: 800, marginBottom: "16px" }}>repocost</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#666" }}>
            Estimate the cost to build any GitHub repo
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
