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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function parseArgs(argv) {
  const args = { variation: "v00", out: "figma-export", print: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--print") args.print = true;
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
  return map;
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

// ── The component registry — each entry mirrors one ui/*.tsx cva() ────────────
// Only variant-driven "atom" components (single label/icon child) belong here;
// slotted panels (alert) and composite/behavioral components (dialog, table,
// sidebar, navigation-menu) need a richer model and are intentionally excluded.
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
const COMPONENTS = [
  {
    name: "Button", label: "Button",           // ui/button.tsx
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
    name: "Badge", label: "Badge",             // ui/badge.tsx — single axis, no size
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
    name: "Toggle", label: "Toggle",           // ui/toggle.tsx — icon control
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
    properties: spec.properties,
    defaultVariant,
    variants: variantEntries,
    variables,
  };
}

function buildManifest(variationId, tokens) {
  return {
    variationId,
    collectionName: "System",     // Figma variable collection for shadcn primitives
    componentsPageName: "Components",
    generatedAt: new Date().toISOString(),
    components: COMPONENTS.map((spec) => buildComponent(spec, tokens)),
  };
}

function printSummary(m, styleDir) {
  const rel = styleDir.replace(ROOT + "/", "");
  console.log(`\nComponent-library manifest — variation ${m.variationId}  (source: ${rel})`);
  console.log(`  Figma page: "${m.componentsPageName}"   ·   variable collection: "${m.collectionName}"`);
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
  --print                Print the manifest instead of writing it

Emits figma-export/library-{id}.json — the component-set manifest Claude feeds
to the Figma builder (scripts/figma-component-library.plugin.js) via use_figma.`);
    return;
  }

  const styleDir = resolveStyleDir(args.variation);
  const tokens = await loadTokens(styleDir);
  const manifest = buildManifest(args.variation, tokens);

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
