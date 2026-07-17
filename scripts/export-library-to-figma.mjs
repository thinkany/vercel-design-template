#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-library-to-figma.mjs — build the COMPONENT-LIBRARY MANIFEST for the
 * Figma "Components" page export.
 *
 * WHAT IT DOES  (prototype scope: the Button)
 *   Reads a code component's design spec straight from source — the geometry +
 *   variant/size matrix defined by `cva()` in src/app/components/ui/button.tsx,
 *   paired with the resolved token colors from tokens.css — and emits ONE
 *   normalized JSON manifest describing a Figma **component set**: its variant
 *   properties, and per-combination fills/text/stroke/geometry. That manifest is
 *   what the Figma builder (scripts/figma-component-library.plugin.js) turns into
 *   a real, editable component set (edit the master → every instance updates).
 *
 *   This is the DETERMINISTIC, offline half — it touches no Figma account. It is
 *   the sibling of export-brand-to-figma.mjs (design SYSTEM tokens) and
 *   export-to-figma.mjs (design SCREENSHOTS); this one describes reusable
 *   COMPONENTS. All color math (hex / rgba / oklch → linear rgb) happens HERE so
 *   the Figma builder stays a dumb consumer of {r,g,b} floats.
 *
 * WHY BUTTON FIRST
 *   button.tsx is the cleanest cva → Figma-variant mapping in the shadcn set
 *   (two independent axes: `variant` × `size`), so it proves the whole mechanism
 *   — variant properties + variable-bound fills + the update cascade — before we
 *   generalize the reader to the other 39 ui/* components. The BUTTON spec below
 *   mirrors button.tsx's cva; keep them in sync until the reader is generalized.
 *
 * VARIATION-AWARE (siloed, like export-brand-to-figma.mjs)
 *   v00 → src/styles/tokens.css ; vNN → src/variations/{id}/styles/tokens.css
 *   (falls back to base if the variation hasn't diverged its styles/). The shadcn
 *   SYSTEM palette (--primary, --background, …) that Button consumes lives in the
 *   base tokens.css; a variation only overrides it if it ships its own copy.
 *
 * USAGE
 *   node scripts/export-library-to-figma.mjs                 # v00 → figma-export/library-v00.json
 *   node scripts/export-library-to-figma.mjs -v v01          # a specific variation
 *   node scripts/export-library-to-figma.mjs --print         # print manifest, don't write
 *   node scripts/export-library-to-figma.mjs --out some/dir  # override output dir
 *
 * PREREQUISITE: none beyond the repo itself. Never added to package.json; never
 *   runs on Vercel. Pairs with the MCP builder, which only Claude can drive.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function parseArgs(argv) {
  const args = { variation: "v00", out: "figma-export", print: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--print") args.print = true;
    else if (a === "--all") args.all = true; // ignore usage scan → export the whole catalog
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

// ── Source resolution (mirrors export-brand-to-figma.mjs siloing) ─────────────
function resolveStyleDir(variationId) {
  if (variationId !== "v00") {
    const varDir = join(ROOT, "src", "variations", variationId, "styles");
    if (existsSync(join(varDir, "tokens.css"))) return varDir;
  }
  return join(ROOT, "src", "styles");
}

// ── USAGE SCAN — which ui/* components does THIS design variant actually pull in? ──
// The Components page mirrors what the design uses, not a fixed default set. We
// statically walk the variation's design-surface source files — the pages.ts
// components + the global Header/Footer, with variation overrides resolved like
// src/app/variationRegistry.ts — following their local imports until we hit
// `components/ui/{name}` leaves. Deterministic + offline; no dev server, matching
// this script's role as the offline half. (Pass --all to skip the scan and export
// the whole catalog.)

// esbuild transpile of a TS module (pages.ts imports nothing at runtime — types
// only — so the transpiled module is self-contained). Mirrors export-brand-to-figma.mjs.
async function loadTsModule(tsPath) {
  const src = await readFile(tsPath, "utf8");
  const esbuild = await import("esbuild");
  const { code } = await esbuild.transform(src, { loader: "ts", format: "esm" });
  const tmp = join(tmpdir(), `ta-lib-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(tmp, code, "utf8");
  return import(pathToFileURL(tmp).href);
}

async function loadDesignPages() {
  const mod = await loadTsModule(join(SRC, "app", "pages.ts"));
  return (mod.designPages || []).map((p) => ({ id: p.id, name: p.name, component: p.component }));
}

// name → file, variation override first (src/variations/{id}/components/{Name}.tsx),
// else base (src/app/components/{Name}.tsx). Mirrors resolveComponent's fallback.
function resolveComponentFile(variationId, componentName) {
  if (variationId !== "v00") {
    const over = join(SRC, "variations", variationId, "components", `${componentName}.tsx`);
    if (existsSync(over)) return over;
  }
  const base = join(SRC, "app", "components", `${componentName}.tsx`);
  return existsSync(base) ? base : null;
}

// The design-surface entry files for a variation: every design page's component
// (pages.ts) + the global Header/Footer chrome. Header/Footer render once globally
// via DesignSurface, so a ui component either file uses counts for the whole design.
async function collectDesignEntryFiles(variationId) {
  const pages = await loadDesignPages();
  const names = [...pages.map((p) => p.component), "Header", "Footer"];
  const files = names.map((n) => resolveComponentFile(variationId, n)).filter(Boolean);
  return { files, pages };
}

// Resolve a relative/@-alias import specifier to an on-disk .tsx/.ts file (or null
// for bare package imports and unresolvable paths). `@` → src/ (vite.config.ts alias).
function resolveLocalImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolvePath(dirname(fromFile), spec);
  else return null; // bare package import (react, lucide-react, …) — not ours to follow
  const cands = base.endsWith(".tsx") || base.endsWith(".ts")
    ? [base]
    : [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")];
  for (const cand of cands) if (existsSync(cand)) return cand;
  return null;
}

// Does an import specifier point at a shadcn ui atom? Returns its kebab name.
function uiComponentName(spec) {
  const m = spec.match(/(?:^|\/)ui\/([a-z0-9-]+)$/);
  return m ? m[1] : null;
}

// BFS the design surface: from each entry file, follow local imports, recording
// every `components/ui/{name}` leaf reached. Returns a Set of kebab ui names.
async function scanUsedUiComponents(entryFiles) {
  const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const seen = new Set();
  const used = new Set();
  const queue = [...entryFiles];
  while (queue.length) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let src;
    try { src = await readFile(file, "utf8"); } catch { continue; }
    let m;
    while ((m = importRe.exec(src))) {
      const spec = m[1];
      const ui = uiComponentName(spec);
      if (ui) { used.add(ui); continue; } // leaf — modeled separately, don't recurse
      const next = resolveLocalImport(spec, file);
      if (next && !next.includes("/components/ui/")) queue.push(next);
    }
  }
  return used;
}

// ── tokens.css → { "--name": "value" } (ALL custom props, not just --ta-*) ────
// Button consumes shadcn SYSTEM tokens (--primary, --background, …), so unlike
// the brand export we read the whole :root, not only the --ta-* namespace.
async function loadTokens(styleDir) {
  const css = await readFile(join(styleDir, "tokens.css"), "utf8");
  const map = {};
  // Only the :root block — ignore the .dark overrides (single light mode, like
  // the brand export's single "Value" mode).
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const scope = rootMatch ? rootMatch[1] : css;
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(scope))) map[m[1].trim()] = m[2].trim();
  return resolveVarRefs(map);
}

// Follow `var(--x)` / `var(--x, fallback)` indirection to a concrete value.
// The component-branding bridge (/setup-styleguide) points shadcn primitives at
// brand tokens — e.g. `--primary: var(--ta-copper)` — so a raw read yields the
// string "var(--ta-copper)", which parseColor can't parse. Resolve each token
// against the same :root map (following chains like --ring → --primary → --ta-*),
// leaving plain hex/oklch/rgb values and any unresolved var() untouched.
function resolveVarRefs(map) {
  const varRe = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/;
  const resolve = (value, depth) => {
    if (depth > 16) return value; // cycle guard
    const mm = String(value).trim().match(varRe);
    if (!mm) return value;
    if (map[mm[1]] != null) return resolve(map[mm[1]], depth + 1); // referenced token
    if (mm[2] != null) return resolve(mm[2].trim(), depth + 1);    // var() fallback arg
    return value; // dangling reference — leave as-is (parseColor will yield null)
  };
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = resolve(v, 0);
  return out;
}

// ── Color parsing → linear {r,g,b} in 0..1 + alpha (the Figma paint shape) ────
// Handles the three formats tokens.css actually uses: hex, rgb()/rgba(), oklch().
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function parseHex(str) {
  let h = str.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function parseRgb(str) {
  const m = str.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const chan = (v) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v) / 255);
  const r = chan(parts[0]), g = chan(parts[1]), b = chan(parts[2]);
  const a = parts[3] != null ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
}

// oklch(L C H) → sRGB, via Björn Ottosson's oklab matrices + sRGB gamma.
function parseOklch(str) {
  const m = str.match(/oklch\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const num = (v, ref) => (v.endsWith("%") ? (parseFloat(v) / 100) * ref : parseFloat(v));
  const L = num(parts[0], 1);
  const C = parts[1] != null ? num(parts[1], 0.4) : 0;
  const Hdeg = parts[2] != null ? parseFloat(parts[2]) : 0;
  const alphaTok = parts[3];
  const a = alphaTok != null ? (alphaTok.endsWith("%") ? parseFloat(alphaTok) / 100 : parseFloat(alphaTok)) : 1;
  const hr = (Hdeg * Math.PI) / 180;
  const oa = C * Math.cos(hr);
  const ob = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const s_ = L - 0.0894841775 * oa - 1.2914855480 * ob;
  const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
  let R = +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  let G = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  let B = -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s;
  const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return { r: clamp01(gamma(R)), g: clamp01(gamma(G)), b: clamp01(gamma(B)), a: clamp01(a) };
}

function parseColor(value) {
  if (!value) return null;
  const v = value.trim();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (v.startsWith("#")) return parseHex(v);
  if (/^oklch/i.test(v)) return parseOklch(v);
  if (/^rgba?/i.test(v)) return parseRgb(v);
  return null;
}

// Resolve a paint reference from a spec value: a token ("--primary"), a literal
// hex ("#ffffff"), or "transparent". Tokens become variable-bound paints in the
// builder; literals/transparent stay unbound.
function resolvePaint(spec, tokens) {
  if (spec == null || spec === "transparent") return { kind: "none" };
  if (spec.startsWith("--")) {
    const rgb = parseColor(tokens[spec]);
    if (!rgb) return { kind: "none" };
    return { kind: "var", token: spec, figmaName: spec.replace(/^--/, ""), rgb: { r: rgb.r, g: rgb.g, b: rgb.b }, a: rgb.a };
  }
  const rgb = parseColor(spec);
  if (!rgb) return { kind: "none" };
  return { kind: "literal", rgb: { r: rgb.r, g: rgb.g, b: rgb.b }, a: rgb.a };
}

// ── The component registry — each entry models one ui/*.tsx component ─────────
// The CATALOG of what we know how to build. What actually ships to Figma is the
// SUBSET this design imports (the usage scan above) — unless --all. Four kinds:
//   atom     (button/badge/toggle) — cva variant matrix, single label/icon child
//   field    (input)               — non-cva; "variants" are STATES; placeholder field
//   slotted  (alert/switch/checkbox/card) — fixed multi-child structure, per-state
//                                    slot colors (buildAlert/Switch/Checkbox/Card)
// Composite/behavioral components (dialog, table, sidebar, navigation-menu) need a
// richer model and are intentionally excluded (see EXCLUDED_UI).
//
// A spec declares:
//   properties   — the cva variant axes, in order (the Figma variant properties)
//   variantAxis  — which axis carries COLOR (fill/text/border per value)
//   sizeAxis      — which axis carries GEOMETRY (height/paddingX per value), or
//                   null when the component has no size axis (geometry from base)
//   base         — shared geometry (radius/gap/fontSize/fontWeight) + fallback
//                  height/paddingX for size-less components
// fill/text/border name a --token, a literal hex, or "transparent"/null.
// Geometry follows Tailwind (1 unit = 4px; rounded-md = 6px; text-sm = 14px;
// text-xs = 12px; font-medium = 500).
// Behavioral/composite cva components that deliberately have NO spec — they need
// a richer model than a variant matrix, so the exporter reports them as excluded
// (never as "unsupported") when a design uses them.
const EXCLUDED_UI = new Set(["navigation-menu", "sidebar"]);

const COMPONENTS = [
  {
    name: "Button", label: "Button", ui: "button", // ui/button.tsx
    properties: {
      variant: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      size: ["default", "sm", "lg", "icon"],
    },
    variantAxis: "variant", sizeAxis: "size",
    base: { fontSize: 14, fontWeight: 500, radius: 6, gap: 8 },
    sizes: {
      default: { height: 36, paddingX: 16 },
      sm: { height: 32, paddingX: 12 },
      lg: { height: 40, paddingX: 24 },
      icon: { height: 36, width: 36, paddingX: 0, iconOnly: true },
    },
    variants: {
      default: { fill: "--primary", text: "--primary-foreground", border: null },
      destructive: { fill: "--destructive", text: "#ffffff", border: null },
      outline: { fill: "--background", text: "--foreground", border: "--border" },
      secondary: { fill: "--secondary", text: "--secondary-foreground", border: null },
      ghost: { fill: "transparent", text: "--foreground", border: null },
      link: { fill: "transparent", text: "--primary", border: null, underline: true },
    },
  },
  {
    name: "Badge", label: "Badge", ui: "badge", // ui/badge.tsx — single axis, no size
    properties: { variant: ["default", "secondary", "destructive", "outline"] },
    variantAxis: "variant", sizeAxis: null,
    // text-xs pill: rounded-md, px-2, py-0.5 → ~20px tall. border always present.
    base: { fontSize: 12, fontWeight: 500, radius: 6, gap: 4, height: 20, paddingX: 8 },
    variants: {
      default: { fill: "--primary", text: "--primary-foreground", border: null },
      secondary: { fill: "--secondary", text: "--secondary-foreground", border: null },
      destructive: { fill: "--destructive", text: "#ffffff", border: null },
      outline: { fill: "transparent", text: "--foreground", border: "--border" },
    },
  },
  {
    name: "Toggle", label: "Toggle", ui: "toggle", // ui/toggle.tsx — icon control
    properties: { variant: ["default", "outline"], size: ["default", "sm", "lg"] },
    variantAxis: "variant", sizeAxis: "size",
    base: { fontSize: 14, fontWeight: 500, radius: 6, gap: 8 },
    // min-w square icon control (h-9/px-2/min-w-9, etc.). Rendered icon-only.
    sizes: {
      default: { height: 36, width: 36, paddingX: 8, iconOnly: true },
      sm: { height: 32, width: 32, paddingX: 6, iconOnly: true },
      lg: { height: 40, width: 40, paddingX: 10, iconOnly: true },
    },
    variants: {
      // default = bg-transparent; outline adds a border. (--input is transparent
      // in this token set, so the visible outline uses --border.)
      default: { fill: "transparent", text: "--foreground", border: null },
      outline: { fill: "transparent", text: "--foreground", border: "--border" },
    },
  },
  {
    // ui/alert.tsx — a SLOTTED component (not a single-child atom): a 2-column
    // grid, icon | (title + description). kind:"slotted" routes it to the
    // dedicated buildAlert() builder instead of the variant-matrix atom path.
    name: "Alert", label: "Alert", ui: "alert", kind: "slotted", builder: "alert",
    properties: { variant: ["default", "destructive"] },
    variantAxis: "variant",
    content: { title: "Heads up!", description: "You can add supporting detail here to give the alert some context." },
    // Geometry from the cva (rounded-lg=8, px-4=16, py-3=12, gap-x-3=12, svg size-4=16, text-sm=14).
    geometry: { radius: 8, padX: 16, padY: 12, gap: 12, iconSize: 16, contentGap: 2, titleSize: 14, descSize: 14, width: 380 },
    // Per-variant slot colors: bg / title / description / icon / border.
    slots: {
      default: { bg: "--card", title: "--card-foreground", desc: "--muted-foreground", icon: "--card-foreground", border: "--border" },
      destructive: { bg: "--card", title: "--destructive", desc: "--destructive", icon: "--destructive", border: "--border" },
    },
  },
  {
    // ui/input.tsx — NOT cva: its "variants" are interaction STATES. kind:"field"
    // routes to buildFieldSet (left-aligned placeholder, fixed-width field).
    name: "Input", label: "Input", ui: "input", kind: "field", builder: "field",
    align: "left", placeholder: "Placeholder",
    properties: { state: ["default", "focus", "invalid", "disabled"] },
    variantAxis: "state", sizeAxis: null,
    // h-9=36, rounded-md=6, px-3=12, text-sm=14; representative fixed field width.
    base: { fontSize: 14, fontWeight: 400, radius: 6, gap: 8, height: 36, paddingX: 12, width: 260 },
    variants: {
      default:  { fill: "--input-background", text: "--muted-foreground", border: "--input" },
      focus:    { fill: "--input-background", text: "--muted-foreground", border: "--ring" },        // focus ring ≈ --ring
      invalid:  { fill: "--input-background", text: "--muted-foreground", border: "--destructive" },
      disabled: { fill: "--input-background", text: "--muted-foreground", border: "--input", opacity: 0.5 },
    },
  },
  {
    // ui/switch.tsx — track + thumb; STATE axis (off/on). kind:"slotted".
    name: "Switch", label: "Switch", ui: "switch", kind: "slotted", builder: "switch",
    properties: { state: ["off", "on"] },
    // w-8=32, h≈18 (1.15rem), thumb size-4=16, 2px inset.
    geometry: { trackW: 32, trackH: 18, thumb: 16, pad: 2 },
    slots: {
      off: { track: "--switch-background", thumb: "--card" },
      on:  { track: "--primary", thumb: "--card" },
    },
  },
  {
    // ui/checkbox.tsx — box + check mark; STATE axis (unchecked/checked). kind:"slotted".
    name: "Checkbox", label: "Checkbox", ui: "checkbox", kind: "slotted", builder: "checkbox",
    properties: { state: ["unchecked", "checked"] },
    geometry: { size: 16, radius: 4 }, // size-4=16, rounded-[4px]
    slots: {
      unchecked: { box: "--input-background", border: "--input", mark: "transparent" },
      checked:   { box: "--primary", border: "--primary", mark: "--primary-foreground" },
    },
  },
  {
    // ui/card.tsx — a COMPOSITIONAL container, not variant-driven. Represented as a
    // single specimen (title + description) so the design system has a Card object.
    name: "Card", label: "Card", ui: "card", kind: "slotted", builder: "card",
    properties: { variant: ["default"] },
    content: { title: "Card title", description: "A short supporting description for this card." },
    // rounded-xl=12, p-6=24, gap-6=24 (tightened between title/desc), fixed specimen width.
    geometry: { radius: 12, pad: 24, gap: 8, width: 320, titleSize: 16, descSize: 14, contentGap: 4 },
    slots: {
      default: { bg: "--card", title: "--card-foreground", desc: "--muted-foreground", border: "--border" },
    },
  },
];

// ── Build the manifest ────────────────────────────────────────────────────────

// Cartesian product over ordered [axisName, values] pairs → [{axis: value, …}].
function cartesian(axes) {
  let combos = [{}];
  for (const [name, values] of axes) {
    const next = [];
    for (const c of combos) for (const v of values) next.push({ ...c, [name]: v });
    combos = next;
  }
  return combos;
}

function buildComponent(spec, tokens) {
  const axes = Object.entries(spec.properties); // ordered: [[variant,[…]],[size,[…]]]
  const combos = cartesian(axes);
  const variantEntries = [];
  const usedTokens = new Map(); // token → figmaName, for the System variable set
  const note = (paint) => { if (paint.kind === "var") usedTokens.set(paint.token, paint.figmaName); };

  for (const combo of combos) {
    const vSpec = spec.variants[combo[spec.variantAxis]];             // color per variant
    const sSpec = spec.sizeAxis ? spec.sizes[combo[spec.sizeAxis]] : spec.base; // geometry
    const fill = resolvePaint(vSpec.fill, tokens);
    const text = resolvePaint(vSpec.text, tokens);
    const border = resolvePaint(vSpec.border, tokens);
    note(fill); note(text); note(border);
    variantEntries.push({
      props: { ...combo },
      // Figma variant-set naming convention (combineAsVariants parses this):
      name: axes.map(([a]) => `${a}=${combo[a]}`).join(", "),
      height: sSpec.height,
      width: sSpec.width || null,
      paddingX: sSpec.paddingX,
      iconOnly: !!sSpec.iconOnly,
      radius: spec.base.radius,
      gap: spec.base.gap,
      fontSize: spec.base.fontSize,
      fontWeight: spec.base.fontWeight,
      underline: !!vSpec.underline,
      opacity: vSpec.opacity == null ? 1 : vSpec.opacity, // e.g. Input disabled = 0.5
      fill, text, border,
    });
  }

  const variables = [...usedTokens.entries()].map(([token, figmaName]) => {
    const rgb = parseColor(tokens[token]);
    return {
      figmaName,             // Figma variable name (no leading --)
      token,                 // the CSS custom property (code syntax)
      rgb: rgb ? { r: rgb.r, g: rgb.g, b: rgb.b } : { r: 0, g: 0, b: 0 },
      a: rgb ? rgb.a : 1,
    };
  }).sort((x, y) => x.figmaName.localeCompare(y.figmaName));

  // Default variant combo (cva defaultVariants → first value of each axis here).
  const defaultVariant = Object.fromEntries(axes.map(([a, vals]) => [a, vals[0]]));

  return {
    name: spec.name,
    label: spec.label,
    ui: spec.ui,
    kind: spec.kind || "atom",
    builder: spec.builder || null,   // plugin dispatch (null → default atom layout)
    placeholder: spec.placeholder,   // field kind: the placeholder text to render
    align: spec.align || "center",   // "left" for fields, "center" for buttons/badges
    properties: spec.properties,
    defaultVariant,
    variants: variantEntries,
    variables,
  };
}

// Slotted components: a fixed multi-child structure whose colors are a per-state
// map of arbitrary slot names (Alert: bg/title/desc/icon/border; Switch:
// track/thumb; Checkbox: box/mark/border; Card: bg/title/desc/border). The Figma
// builder holds the node geometry; this just resolves each slot's paint + collects
// the bound variables. The state axis can be named anything (`variant`, `state`).
function buildSlotted(spec, tokens) {
  const usedTokens = new Map();
  const note = (paint) => { if (paint.kind === "var") usedTokens.set(paint.token, paint.figmaName); };
  const variantEntries = [];
  const axisName = Object.keys(spec.properties)[0]; // "variant" (Alert) | "state" (Switch/Checkbox)
  for (const value of spec.properties[axisName]) {
    const sl = spec.slots[value];
    const paints = {};
    for (const [slotName, ref] of Object.entries(sl)) { const p = resolvePaint(ref, tokens); paints[slotName] = p; note(p); }
    variantEntries.push({ props: { [axisName]: value }, name: `${axisName}=${value}`, ...paints });
  }
  const variables = [...usedTokens.entries()].map(([token, figmaName]) => {
    const rgb = parseColor(tokens[token]);
    return { figmaName, token, rgb: rgb ? { r: rgb.r, g: rgb.g, b: rgb.b } : { r: 0, g: 0, b: 0 }, a: rgb ? rgb.a : 1 };
  }).sort((x, y) => x.figmaName.localeCompare(y.figmaName));
  return {
    name: spec.name, label: spec.label, ui: spec.ui, builder: spec.builder, kind: "slotted",
    properties: spec.properties, defaultVariant: { [axisName]: spec.properties[axisName][0] },
    content: spec.content, geometry: spec.geometry, variants: variantEntries, variables,
  };
}

// From a set of used ui kebab-names, decide which catalog specs to build and
// produce the coverage report (what the design uses vs. what we can model).
function computeCoverage(used) {
  const catalogUi = COMPONENTS.map((c) => c.ui);
  const catalogSet = new Set(catalogUi);
  const selected = COMPONENTS.filter((c) => used.has(c.ui));
  const excluded = [...used].filter((u) => EXCLUDED_UI.has(u)).sort();          // known, but no spec by design
  const unsupported = [...used].filter((u) => !catalogSet.has(u) && !EXCLUDED_UI.has(u)).sort(); // no spec yet
  const catalogUnused = catalogUi.filter((u) => !used.has(u)).sort();           // modelable but this design skips
  return {
    selected,
    report: { used: [...used].sort(), supported: selected.map((c) => c.ui).sort(), unsupported, excluded, catalogUnused },
  };
}

function buildManifest(variationId, tokens, specs, coverage, mode) {
  return {
    variationId,
    collectionName: "System",     // Figma variable collection for shadcn primitives
    componentsPageName: "Components",
    selectionMode: mode,          // "usage" (scanned) | "all" (--all, whole catalog)
    coverage,                     // { used, supported, unsupported, excluded, catalogUnused }
    catalogComponentNames: COMPONENTS.map((c) => c.name), // full known set → plugin prunes stale sets
    generatedAt: new Date().toISOString(),
    components: specs.map((spec) => (spec.kind === "slotted" ? buildSlotted(spec, tokens) : buildComponent(spec, tokens))),
  };
}

function printSummary(m, styleDir) {
  const rel = styleDir.replace(ROOT + "/", "");
  const r = m.coverage;
  console.log(`\nComponent-library manifest — variation ${m.variationId}  (source: ${rel})`);
  console.log(`  Figma page: "${m.componentsPageName}"   ·   variable collection: "${m.collectionName}"`);
  console.log(`  Selection: ${m.selectionMode === "all" ? "--all (whole catalog)" : "usage scan of the design surface"}`);

  // Coverage — what the design uses vs. what we build.
  if (m.selectionMode === "usage") {
    console.log(`  Design uses ${r.used.length} ui component${r.used.length === 1 ? "" : "s"}: ${r.used.length ? r.used.join(", ") : "(none)"}`);
    if (r.unsupported.length) console.log(`  ⚠ used but NO spec yet (skipped): ${r.unsupported.join(", ")}  — add a spec to COMPONENTS to include them`);
    if (r.excluded.length) console.log(`  · used but excluded by design (behavioral/composite): ${r.excluded.join(", ")}`);
    if (!m.components.length) {
      console.log(`\n  → 0 components to build. This design imports no modeled shadcn ui atoms;`);
      console.log(`    the Components page will be pruned to empty. (Use --all to export the whole catalog.)`);
    }
  }

  for (const c of m.components) {
    const axes = Object.entries(c.properties).map(([k, vs]) => `${k}×${vs.length}`).join("  ");
    console.log(`\n  ▸ ${c.name}  (component set — ${c.variants.length} variants: ${axes})`);
    for (const [axis, vals] of Object.entries(c.properties)) {
      console.log(`    ${(axis + ":").padEnd(9)}${vals.join(", ")}`);
    }
    console.log(`    ${c.variables.length} bound variables → collection "${m.collectionName}":`);
    for (const v of c.variables) {
      const hex = "#" + [v.rgb.r, v.rgb.g, v.rgb.b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
      console.log(`      · ${v.figmaName.padEnd(22)} ${hex}${v.a < 1 ? ` @${v.a.toFixed(2)}` : ""}   ${v.token}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/export-library-to-figma.mjs [options]

  -v, --variation <id>   Variation to export (default: v00)
  --out <dir>            Output dir (default: figma-export)
  --all                  Export the whole catalog (skip the usage scan)
  --print                Print the manifest instead of writing it

By default the component set mirrors what the design VARIATION actually uses:
the pages.ts components + global Header/Footer are scanned for ui/* imports, and
only those (that have a spec) are built. Emits figma-export/library-{id}.json —
the manifest Claude feeds to the Figma builder
(scripts/figma-component-library.plugin.js) via use_figma.`);
    return;
  }

  const styleDir = resolveStyleDir(args.variation);
  const tokens = await loadTokens(styleDir);

  // Which ui atoms does this design pull in? (--all skips the scan.)
  let used, mode;
  if (args.all) {
    used = new Set(COMPONENTS.map((c) => c.ui));
    mode = "all";
  } else {
    const { files } = await collectDesignEntryFiles(args.variation);
    used = await scanUsedUiComponents(files);
    mode = "usage";
  }
  const { selected, report } = computeCoverage(used);
  const manifest = buildManifest(args.variation, tokens, selected, report, mode);

  printSummary(manifest, styleDir);

  if (args.print) {
    console.log("\n" + JSON.stringify(manifest, null, 2));
    return;
  }
  await mkdir(join(ROOT, args.out), { recursive: true });
  const outPath = join(ROOT, args.out, `library-${args.variation}.json`);
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`\n→ wrote ${args.out}/library-${args.variation}.json`);
  console.log("  Next (live): Claude reads this manifest and runs the Figma builder");
  console.log("  (scripts/figma-component-library.plugin.js, PHASE \"components\") via use_figma.");
}

main().catch((e) => {
  console.error("export-library-to-figma failed:", e.message);
  process.exit(1);
});
