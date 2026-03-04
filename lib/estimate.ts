// ─── COCOMO II Post-Architecture Model ──────────────────────────────────────
// Source: Boehm, B. (2000). Software Cost Estimation with COCOMO II.
//
// Effort (PM) = A × EAF × (KSLOC)^E
//   A = 2.94 (calibrated constant)
//   E = B + 0.01 × ΣSF_j  →  nominal: 0.91 + 0.01 × 19.97 ≈ 1.0997
//   EAF = 1.0 (all 17 effort multipliers nominal — we can't infer them from a URL)
//
// Schedule (TDEV) = C × (PM)^(D + 0.2 × (E − B))
//   C = 3.67, D = 0.28, B = 0.91
//
// Person-Month = 152 hours (COCOMO II standard, excludes holidays/vacation)
// ────────────────────────────────────────────────────────────────────────────

export const COCOMO = {
  A: 2.94,
  E: 1.0997,
  B: 0.91,
  SCHED_C: 3.67,
  SCHED_D: 0.28,
  HOURS_PER_PM: 152,
} as const;

// ─── Language Configuration ─────────────────────────────────────────────────
// bpl: estimated bytes per source line (accounts for avg line length + encoding)
// w:   complexity weight — how much cognitive effort per line relative to C (1.0)
// rate: blended mid-level North American hourly USD rate (2024-2025 market data)

export interface LangConfig {
  bpl: number;
  w: number;
  rate: number;
  color: string;
  label: string;
}

export const LANG_DATA: Record<string, LangConfig> = {
  JavaScript:    { bpl: 30, w: 1.0,  rate: 70,  color: "#f7df1e", label: "JavaScript" },
  TypeScript:    { bpl: 32, w: 1.1,  rate: 80,  color: "#3178c6", label: "TypeScript" },
  Python:        { bpl: 28, w: 1.2,  rate: 75,  color: "#3572A5", label: "Python" },
  Java:          { bpl: 35, w: 0.8,  rate: 72,  color: "#b07219", label: "Java" },
  C:             { bpl: 28, w: 1.0,  rate: 68,  color: "#555555", label: "C" },
  "C++":         { bpl: 30, w: 1.2,  rate: 78,  color: "#f34b7d", label: "C++" },
  "C#":          { bpl: 34, w: 0.9,  rate: 73,  color: "#178600", label: "C#" },
  Go:            { bpl: 26, w: 1.1,  rate: 82,  color: "#00ADD8", label: "Go" },
  Rust:          { bpl: 30, w: 1.4,  rate: 90,  color: "#dea584", label: "Rust" },
  Ruby:          { bpl: 24, w: 1.1,  rate: 72,  color: "#701516", label: "Ruby" },
  PHP:           { bpl: 30, w: 0.8,  rate: 60,  color: "#4F5D95", label: "PHP" },
  Swift:         { bpl: 30, w: 1.1,  rate: 80,  color: "#F05138", label: "Swift" },
  Kotlin:        { bpl: 30, w: 1.1,  rate: 78,  color: "#A97BFF", label: "Kotlin" },
  Scala:         { bpl: 30, w: 1.3,  rate: 85,  color: "#c22d40", label: "Scala" },
  Dart:          { bpl: 30, w: 1.0,  rate: 70,  color: "#00B4AB", label: "Dart" },
  Elixir:        { bpl: 26, w: 1.3,  rate: 85,  color: "#6e4a7e", label: "Elixir" },
  Haskell:       { bpl: 26, w: 1.5,  rate: 90,  color: "#5e5086", label: "Haskell" },
  Lua:           { bpl: 24, w: 1.0,  rate: 65,  color: "#000080", label: "Lua" },
  R:             { bpl: 26, w: 1.2,  rate: 75,  color: "#198CE7", label: "R" },
  Shell:         { bpl: 22, w: 0.8,  rate: 65,  color: "#89e051", label: "Shell" },
  Vue:           { bpl: 32, w: 1.0,  rate: 72,  color: "#41b883", label: "Vue" },
  Svelte:        { bpl: 30, w: 1.0,  rate: 72,  color: "#ff3e00", label: "Svelte" },
  Clojure:       { bpl: 24, w: 1.4,  rate: 88,  color: "#db5855", label: "Clojure" },
  Zig:           { bpl: 28, w: 1.3,  rate: 85,  color: "#ec915c", label: "Zig" },
  OCaml:         { bpl: 26, w: 1.4,  rate: 88,  color: "#3be133", label: "OCaml" },
  Perl:          { bpl: 28, w: 1.0,  rate: 65,  color: "#0298c3", label: "Perl" },
  MATLAB:        { bpl: 30, w: 1.1,  rate: 70,  color: "#e16737", label: "MATLAB" },
  Julia:         { bpl: 28, w: 1.2,  rate: 80,  color: "#a270ba", label: "Julia" },
  "Objective-C": { bpl: 34, w: 1.0,  rate: 75,  color: "#438eff", label: "Obj-C" },
  Erlang:        { bpl: 26, w: 1.3,  rate: 85,  color: "#B83998", label: "Erlang" },
  "F#":          { bpl: 28, w: 1.3,  rate: 82,  color: "#b845fc", label: "F#" },
  Nim:           { bpl: 26, w: 1.2,  rate: 78,  color: "#ffc200", label: "Nim" },
};

const DEFAULT_LANG: LangConfig = { bpl: 30, w: 1.0, rate: 70, color: "#888888", label: "Other" };

// Non-code files — excluded entirely
const EXCLUDED = new Set([
  "HTML", "CSS", "SCSS", "Sass", "Less", "Stylus",
  "JSON", "YAML", "TOML", "XML", "INI",
  "Markdown", "reStructuredText", "AsciiDoc",
  "Dockerfile", "Makefile", "CMake", "Meson",
  "Batchfile", "PowerShell",
  "Rich Text Format", "TeX", "LaTeX", "BibTeX",
  "Roff", "Starlark", "SVG", "Nix",
]);

// Data/config languages — count at 30%
const PARTIAL = new Set([
  "SQL", "PLpgSQL", "PLSQL", "HCL", "Terraform", "Dhall", "Jsonnet", "CUE",
]);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LangEstimate {
  name: string;
  bytes: number;
  raw: number;      // raw SLOC (bytes / bpl)
  eff: number;      // effective SLOC (raw × weight × partial)
  w: number;        // applied weight
  rate: number;     // $/hr
  color: string;
  hours: number;
  cost: number;
}

export interface Estimate {
  langs: LangEstimate[];
  sloc: number;          // total effective SLOC
  pm: number;            // person-months
  months: number;        // calendar schedule
  team: number;          // avg team size
  hours: number;         // total effort hours
  cost: number;          // total cost USD
  lo: { cost: number; months: number };
  hi: { cost: number; months: number };
}

// ─── Estimation Function ────────────────────────────────────────────────────

export function estimate(langBytes: Record<string, number>): Estimate {
  const langs: LangEstimate[] = [];
  let totalESLOC = 0;

  for (const [lang, bytes] of Object.entries(langBytes)) {
    if (EXCLUDED.has(lang)) continue;
    const p = PARTIAL.has(lang) ? 0.3 : 1.0;
    const d = LANG_DATA[lang] || DEFAULT_LANG;
    const raw = bytes / d.bpl;
    const eff = raw * d.w * p;
    totalESLOC += eff;
    langs.push({
      name: d.label || lang,
      bytes,
      raw: Math.round(raw),
      eff: Math.round(eff),
      w: Math.round(d.w * p * 10) / 10,
      rate: d.rate,
      color: d.color,
      hours: 0,
      cost: 0,
    });
  }

  langs.sort((a, b) => b.eff - a.eff);

  const K = totalESLOC / 1000;
  const pm = K > 0 ? COCOMO.A * Math.pow(K, COCOMO.E) : 0;
  const schedExp = COCOMO.SCHED_D + 0.2 * (COCOMO.E - COCOMO.B);
  const months = pm > 0 ? COCOMO.SCHED_C * Math.pow(pm, schedExp) : 0;
  const team = months > 0 ? pm / months : 0;
  const hours = pm * COCOMO.HOURS_PER_PM;

  let cost = 0;
  for (const l of langs) {
    const prop = totalESLOC > 0 ? l.eff / totalESLOC : 0;
    l.hours = Math.round(hours * prop);
    l.cost = Math.round(l.hours * l.rate);
    cost += l.cost;
  }

  return {
    langs,
    sloc: Math.round(totalESLOC),
    pm,
    months,
    team,
    hours,
    cost,
    lo: { cost: Math.round(cost * 0.6), months: months * 0.75 },
    hi: { cost: Math.round(cost * 1.8), months: months * 1.4 },
  };
}

// ─── Formatting Utilities ───────────────────────────────────────────────────

export const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
  : n >= 1e3 ? (n / 1e3).toFixed(1) + "K"
  : Math.round(n).toString();

export const fmtCost = (n: number) =>
  n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B"
  : n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M"
  : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K"
  : "$" + Math.round(n);

export const fmtBigCost = (n: number): [string, string] => {
  if (n >= 1e9) return ["$" + (n / 1e9).toFixed(1), "billion"];
  if (n >= 1e6) return ["$" + (n / 1e6).toFixed(1), "million"];
  if (n >= 1e3) return ["$" + (n / 1e3).toFixed(0), "thousand"];
  return ["$" + Math.round(n), ""];
};

export const fmtDur = (m: number) => {
  if (m < 1) return Math.round(m * 4.33) + " weeks";
  const y = Math.floor(m / 12);
  const mo = Math.round(m % 12);
  if (y === 0) return mo + " month" + (mo !== 1 ? "s" : "");
  if (mo === 0) return y + " year" + (y !== 1 ? "s" : "");
  return y + "y " + mo + "m";
};
