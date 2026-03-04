"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { Estimate, LangEstimate } from "@/lib/estimate";
import { fmt, fmtCost, fmtBigCost, fmtDur } from "@/lib/estimate";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  owner: { avatar_url: string; login: string };
  html_url: string;
}

interface Props {
  initialOwner?: string;
  initialRepo?: string;
}

// ─── Animated Counter ───────────────────────────────────────────────────────

function Counter({ to, format, dur = 1400 }: { to: number; format: (v: number) => string; dur?: number }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, dur]);
  return <>{format(v)}</>;
}

// ─── Receipt Canvas (downloadable PNG) ──────────────────────────────────────

function drawReceipt(canvas: HTMLCanvasElement, data: Estimate, meta: RepoMeta) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 600, H = 780;
  canvas.width = W * 2; canvas.height = H * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = "#0c0c18";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.015)";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 24) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
  for (let i = 0; i < H; i += 24) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

  // Glow
  const grad = ctx.createRadialGradient(W - 40, 40, 0, W - 40, 40, 200);
  grad.addColorStop(0, "rgba(59,130,246,0.07)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  let y = 44;
  const L = 36, R = W - 36;
  const font = (weight: string, size: number, family = "-apple-system, sans-serif") =>
    `${weight} ${size}px ${family}`;

  // Header
  ctx.fillStyle = "#fff"; ctx.font = font("bold", 22);
  ctx.fillText("repocost", L, y);
  ctx.fillStyle = "#444"; ctx.font = font("normal", 11, "'Courier New', monospace");
  ctx.fillText("COCOMO II", 140, y);
  y += 20;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); ctx.setLineDash([]);
  y += 28;

  // Repo
  ctx.fillStyle = "#fff"; ctx.font = font("bold", 20);
  ctx.fillText(meta.full_name, L, y); y += 22;
  if (meta.description) {
    ctx.fillStyle = "#555"; ctx.font = font("normal", 13);
    const desc = meta.description.length > 65 ? meta.description.slice(0, 62) + "…" : meta.description;
    ctx.fillText(desc, L, y); y += 16;
  }
  if (meta.stargazers_count || meta.forks_count) {
    ctx.fillStyle = "#444"; ctx.font = font("normal", 12);
    let info = "";
    if (meta.stargazers_count) info += `★ ${fmt(meta.stargazers_count)}`;
    if (meta.forks_count) info += `  ⑂ ${fmt(meta.forks_count)}`;
    ctx.fillText(info.trim(), L, y); y += 14;
  }
  y += 16;

  // Big cost
  const [bigNum, bigUnit] = fmtBigCost(data.cost);
  ctx.fillStyle = "#fff"; ctx.font = font("bold", 68);
  ctx.fillText(bigNum, L, y + 56);
  if (bigUnit) {
    const nw = ctx.measureText(bigNum).width;
    ctx.fillStyle = "#555"; ctx.font = font("normal", 30);
    ctx.fillText(bigUnit, L + nw + 10, y + 56);
  }
  y += 78;
  ctx.fillStyle = "#444"; ctx.font = font("normal", 13);
  ctx.fillText("estimated build cost (human developers only)", L, y);
  y += 34;

  // Stats
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
  y += 22;
  const stats = [
    ["PERSON-MONTHS", data.pm.toFixed(1)],
    ["SCHEDULE", fmtDur(data.months)],
    ["TEAM SIZE", data.team.toFixed(1) + " devs"],
    ["EFF. SLOC", fmt(data.sloc)],
  ];
  const colW = (R - L) / 4;
  stats.forEach(([label, val], i) => {
    const x = L + i * colW;
    ctx.fillStyle = "#444"; ctx.font = font("bold", 9, "'Courier New', monospace");
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#ddd"; ctx.font = font("bold", 20);
    ctx.fillText(val, x, y + 24);
  });
  y += 50;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
  y += 22;

  // Bars
  ctx.fillStyle = "#444"; ctx.font = font("bold", 9, "'Courier New', monospace");
  ctx.fillText("COST BY LANGUAGE", L, y); y += 18;
  const top6 = data.langs.slice(0, 6);
  const maxC = Math.max(...top6.map(l => l.cost));
  top6.forEach(l => {
    const barMaxW = R - L;
    const barW = maxC > 0 ? barMaxW * (l.cost / maxC) : 0;
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(L, y, barMaxW, 26, 4); } else { ctx.rect(L, y, barMaxW, 26); }
    ctx.fill();
    if (barW > 4) {
      ctx.fillStyle = l.color + "44";
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(L, y, barW, 26, 4); } else { ctx.rect(L, y, barW, 26); }
      ctx.fill();
    }
    ctx.fillStyle = l.color;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(L, y, 3, 26, [4, 0, 0, 4]); } else { ctx.rect(L, y, 3, 26); }
    ctx.fill();
    ctx.fillStyle = "#ccc"; ctx.font = font("normal", 12);
    ctx.fillText(l.name, L + 12, y + 17);
    ctx.fillStyle = "#999"; ctx.font = font("bold", 12, "'Courier New', monospace");
    const cs = fmtCost(l.cost);
    ctx.fillText(cs, R - ctx.measureText(cs).width - 8, y + 17);
    y += 32;
  });

  y += 6;
  ctx.fillStyle = "#333"; ctx.font = font("normal", 12);
  ctx.fillText(`Range: ${fmtCost(data.lo.cost)} – ${fmtCost(data.hi.cost)}`, L, y); y += 22;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); ctx.setLineDash([]);
  y += 18;
  ctx.fillStyle = "#333"; ctx.font = font("normal", 11);
  ctx.fillText("repocost · COCOMO II model · per-language market rates", L, y);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RepoCostApp({ initialOwner, initialRepo }: Props) {
  const [input, setInput] = useState(
    initialOwner && initialRepo ? `${initialOwner}/${initialRepo}` : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Estimate | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [phase, setPhase] = useState<"input" | "result">("input");
  const [showDetails, setShowDetails] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const analyze = useCallback(async (repoStr?: string) => {
    const val = repoStr || input;
    const cleaned = val.trim().replace(/\/+$/, "").replace(/\.git$/, "");
    const m = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/) || cleaned.match(/^([^/]+)\/([^/]+)$/);
    if (!m) { setError("Enter a valid GitHub URL or owner/repo."); return; }

    const [, owner, repo] = m;
    setLoading(true); setError(null); setResult(null); setMeta(null);

    try {
      const res = await fetch(`/api/estimate/${owner}/${repo}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");

      setMeta(json.meta);
      setResult(json.estimate);
      setPhase("result");

      // Update URL without full navigation
      try { window.history.pushState(null, "", `/${owner}/${repo}`); } catch {};
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [input]);

  // Auto-analyze if we have initial params (direct URL visit)
  useEffect(() => {
    if (initialOwner && initialRepo && !result) {
      analyze(`${initialOwner}/${initialRepo}`);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") analyze(); };

  const downloadReceipt = () => {
    if (!result || !meta || !canvasRef.current) return;
    drawReceipt(canvasRef.current, result, meta);
    const link = document.createElement("a");
    link.download = `repocost-${meta.full_name.replace("/", "-")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const copyShareText = () => {
    if (!result || !meta) return;
    const [bn, bu] = fmtBigCost(result.cost);
    const text = `${meta.full_name} would cost ${bn} ${bu} and take ${fmtDur(result.months)} to build with human devs alone.\n\nEstimated via repocost (COCOMO II)`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const reset = () => {
    setPhase("input"); setResult(null); setMeta(null); setError(null); setInput("");
    setShowDetails(false); setShowMethodology(false);
    try { window.history.pushState(null, "", "/"); } catch {};
  };

  const topLangs = result?.langs?.slice(0, 8) || [];
  const [bigNum, bigUnit] = result ? fmtBigCost(result.cost) : ["", ""];

  return (
    <div style={{ minHeight: "100vh" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ─── INPUT PHASE ─── */}
      {phase === "input" && (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: 600, height: 600,
            background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)",
            top: "35%", left: "50%", transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 520, width: "100%" }}>
            <div style={{
              fontSize: 12, color: "#444", letterSpacing: "0.14em", textTransform: "uppercase",
              marginBottom: 20, fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
            }}>
              What would it actually cost to build?
            </div>
            <h1 style={{
              fontSize: "clamp(44px, 9vw, 68px)", fontWeight: 700, margin: "0 0 12px",
              letterSpacing: "-0.045em", lineHeight: 0.95,
              background: "linear-gradient(180deg, #fff 20%, #444 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              repocost
            </h1>
            <p style={{ fontSize: 16, color: "#555", margin: "0 0 44px", lineHeight: 1.5 }}>
              Estimate the human time and money behind any<br />
              GitHub repo. Powered by COCOMO II.
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="owner/repo  or  paste URL"
                autoFocus
                style={{
                  flex: 1, padding: "16px 18px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, outline: "none",
                  color: "#e0e0e0", fontSize: 15,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              />
              <button onClick={() => analyze()} disabled={loading || !input.trim()}
                style={{
                  padding: "16px 32px",
                  background: loading ? "#1a1a2e" : "#fff",
                  color: loading ? "#666" : "#0c0c18",
                  border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
                  cursor: loading ? "wait" : "pointer",
                  opacity: !input.trim() ? 0.3 : 1, transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}>
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: "2px solid #444", borderTopColor: "#999", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                    Analyzing
                  </span>
                ) : "Estimate"}
              </button>
            </div>

            {error && (
              <div style={{
                padding: "10px 16px", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
                color: "#f87171", fontSize: 13, marginBottom: 14, textAlign: "left",
              }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
              {["vercel/next.js", "facebook/react", "django/django", "denoland/deno", "sveltejs/svelte"].map(r => (
                <button key={r}
                  onClick={() => { setInput(r); analyze(r); }}
                  style={{
                    padding: "5px 12px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
                    color: "#444", fontSize: 12, cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace", transition: "all 0.15s",
                  }}
                >{r}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RESULT PHASE ─── */}
      {phase === "result" && result && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 80px", animation: "fadeUp 0.4s ease" }}>
          <button onClick={reset} style={{
            background: "none", border: "none", color: "#444", cursor: "pointer",
            fontSize: 13, padding: "4px 0", marginBottom: 20,
            fontFamily: "'IBM Plex Mono', monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>←</span> new estimate
          </button>

          {meta && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              {meta.owner?.avatar_url && (
                <img src={meta.owner.avatar_url} alt="" width={32} height={32} style={{ borderRadius: 8 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{meta.full_name}</div>
                {meta.description && (
                  <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
                    {meta.description.slice(0, 100)}{meta.description.length > 100 ? "…" : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#555" }}>
                {meta.stargazers_count != null && <span>★ {fmt(meta.stargazers_count)}</span>}
                {meta.forks_count != null && <span>⑂ {fmt(meta.forks_count)}</span>}
              </div>
            </div>
          )}

          {/* PUNCHLINE */}
          <div style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "40px 28px 28px", marginBottom: 16,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -80, right: -80, width: 240, height: 240,
              background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{
              fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace",
            }}>Estimated build cost</div>
            <div style={{
              fontSize: "clamp(52px, 12vw, 76px)", fontWeight: 700,
              letterSpacing: "-0.04em", lineHeight: 1, color: "#fff", marginBottom: 6,
            }}>
              <Counter to={result.cost} format={(v) => fmtBigCost(v)[0]} />
              {bigUnit && <span style={{ fontSize: "0.42em", color: "#555", marginLeft: 8, fontWeight: 400 }}>{bigUnit}</span>}
            </div>
            <div style={{ fontSize: 13, color: "#444", marginBottom: 28, fontFamily: "'IBM Plex Mono', monospace" }}>
              range: {fmtCost(result.lo.cost)} – {fmtCost(result.hi.cost)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { l: "Person-months", v: result.pm.toFixed(1) },
                { l: "Schedule", v: fmtDur(result.months) },
                { l: "Team", v: result.team.toFixed(1) + " devs" },
                { l: "SLOC", v: fmt(result.sloc) },
                { l: "Hours", v: fmt(result.hours) },
              ].map(s => (
                <div key={s.l} style={{
                  padding: "7px 12px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 12,
                }}>
                  <span style={{ color: "#555" }}>{s.l} </span>
                  <span style={{ color: "#bbb", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SHARE */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button onClick={downloadReceipt} style={{
              flex: 1, padding: "13px 16px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>↓ Save Image</button>
            <button onClick={copyShareText} style={{
              flex: 1, padding: "13px 16px",
              background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, color: copied ? "#4ade80" : "#aaa", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {copied ? "Copied!" : "Copy Text"}
            </button>
            {meta && (
              <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                `${meta.full_name} would cost ${bigNum} ${bigUnit} to build with human devs.\n\nrepocost.dev/${meta.full_name}`
              )}`} target="_blank" rel="noopener noreferrer" style={{
                padding: "13px 20px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, color: "#aaa", fontSize: 13, fontWeight: 600,
                cursor: "pointer", textDecoration: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>Post to 𝕏</a>
            )}
          </div>

          {/* CHART */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: "18px 10px 10px", marginBottom: 12,
          }}>
            <div style={{
              fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 12, paddingLeft: 8, fontFamily: "'IBM Plex Mono', monospace",
            }}>Cost by language</div>
            <ResponsiveContainer width="100%" height={Math.max(140, topLangs.length * 34)}>
              <BarChart data={topLangs} layout="vertical" margin={{ left: 76, right: 12 }}>
                <XAxis type="number" tick={{ fill: "#333", fontSize: 10 }} tickFormatter={fmtCost} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  content={({ active, payload }: TooltipProps<number, string>) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as LangEstimate;
                    return (
                      <div style={{ background: "#16162a", border: "1px solid #2a2a3e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ddd", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                        <div style={{ fontWeight: 700, color: d.color, marginBottom: 2 }}>{d.name}</div>
                        <div>{fmtCost(d.cost)} · {fmt(d.hours)} hrs · ${d.rate}/hr</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="cost" radius={[0, 6, 6, 0] as any} barSize={20}>
                  {topLangs.map((l, i) => <Cell key={i} fill={l.color} fillOpacity={0.7} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* DETAILS EXPAND */}
          <button onClick={() => setShowDetails(!showDetails)} style={{
            width: "100%", padding: "13px 18px", marginBottom: 8,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "#555", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <span>Detailed breakdown ({result.langs.length} languages)</span>
            <span style={{ transform: showDetails ? "rotate(180deg)" : "none", transition: "transform 0.2s", fontSize: 14 }}>▾</span>
          </button>
          {showDetails && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: 14, marginBottom: 8, overflowX: "auto",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Language", "SLOC", "Wt", "Eff.", "$/hr", "Hours", "Cost"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i ? "right" : "left", padding: "5px 6px",
                        color: "#444", fontSize: 9, letterSpacing: "0.08em",
                        textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.langs.map((l, i) => (
                    <tr key={l.name} style={{ borderBottom: i < result.langs.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                      <td style={{ padding: "7px 6px", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: "#bbb" }}>{l.name}</span>
                      </td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: "#666" }}>{fmt(l.raw)}</td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: l.w > 1 ? "#c98a2e" : "#444" }}>{l.w.toFixed(1)}×</td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: "#ccc", fontWeight: 600 }}>{fmt(l.eff)}</td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: "#666" }}>${l.rate}</td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: "#666" }}>{fmt(l.hours)}</td>
                      <td style={{ textAlign: "right", padding: "7px 6px", fontFamily: "'IBM Plex Mono', monospace", color: "#ccc", fontWeight: 600 }}>{fmtCost(l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* METHODOLOGY */}
          <button onClick={() => setShowMethodology(!showMethodology)} style={{
            width: "100%", padding: "13px 18px",
            marginBottom: showMethodology ? 0 : 32,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: showMethodology ? "12px 12px 0 0" : 12, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "#555", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <span>How this works</span>
            <span style={{ transform: showMethodology ? "rotate(180deg)" : "none", transition: "transform 0.2s", fontSize: 14 }}>▾</span>
          </button>
          {showMethodology && (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)", borderTop: "none",
              borderRadius: "0 0 12px 12px", padding: "14px 18px 18px",
              fontSize: 12, lineHeight: 1.7, color: "#555", marginBottom: 32,
            }}>
              <p style={{ margin: "0 0 10px" }}>
                <strong style={{ color: "#888" }}>Model:</strong> COCOMO II Post-Architecture (Boehm, 2000).{" "}
                <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#7788bb", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>
                  Effort = 2.94 × (KSLOC)^1.0997
                </code>{" "}
                person-months. All effort multipliers at nominal.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong style={{ color: "#888" }}>Sizing:</strong> GitHub&apos;s Languages API → bytes per language → SLOC via per-language bytes-per-line estimates → weighted by complexity (Rust 1.4×, Java 0.8×). HTML/CSS/JSON/Markdown excluded. SQL and IaC at 30%.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong style={{ color: "#888" }}>Rates:</strong> Per-language blended mid-level North American USD hourly rates from 2024–25 survey data.
              </p>
              <p style={{ margin: 0, color: "#664433" }}>
                <strong>Caveats:</strong> No PM overhead, QA, design, DevOps, docs, or dependency effort. COCOMO II was calibrated on 1990s–2000s enterprise projects. This is an order-of-magnitude estimate.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
