#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * derive.mjs — the CLOUD half of the licensed export path: the IP.
 *
 * Pure computation, no browser, no npm deps: turns a CaptureBundle (raw computed-
 * style strings + geometry) into a BuildSpec (Figma-intent nodes) — the exact
 * shape the existing figma-reconstruct-library.plugin.js builder consumes. Every
 * interpretation heuristic that used to live in export-reconstruct-to-figma.mjs's
 * in-browser extractSpec now lives HERE, off the distributed scaffold:
 *   • gradient / shadow / radius / border-side parsing
 *   • color resolution (color.mjs, incl. Tailwind oklab/oklch)
 *   • omit-defaults compaction
 *   • flex/grid → auto-layout intent
 *   • brand-variable titling + palette assembly
 *
 * Two entrypoints:
 *   derive(bundle) → buildSpec          the pure function (import this)
 *   handler(req, res)                    a Vercel-Function wrapper (API-key gated)
 *   CLI: node cloud-export/derive.mjs    offline POC over the on-disk bundle
 */
import { parseColor } from "./color.mjs";

/* ───────────────────────────── helpers ───────────────────────────── */

const px = (v) => Math.round(parseFloat(v) || 0);

// Split a comma-list at top level (depth-0), ignoring commas inside parens.
const splitTop = (s) => {
  const out = []; let d = 0, cur = "";
  for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out;
};

// linear-gradient(...) → { angle, stops:[{color,pos}] } or null (decorative
// px-positioned pattern → omit, don't paint a black wash).
function parseLinear(str) {
  const m = str.match(/linear-gradient\((.*)\)$/s); if (!m) return null;
  const parts = splitTop(m[1]); let angle = 180, i = 0; const dir = parts[0].trim();
  if (/^(to |[\d.]+deg|[\d.]+turn|[\d.]+rad)/.test(dir)) {
    if (dir.startsWith("to ")) { const map = { top: 0, bottom: 180, left: 270, right: 90, "top left": 315, "top right": 45, "bottom left": 225, "bottom right": 135 }; angle = map[dir.slice(3).trim()] ?? 180; }
    else if (dir.endsWith("deg")) angle = parseFloat(dir); i = 1;
  }
  const stops = []; let isPattern = false;
  for (let k = i; k < parts.length; k++) {
    const p = parts[k].trim();
    const pctM = p.match(/(-?[\d.]+)%\s*$/);
    if (/[\d.]+px\s*$/.test(p)) isPattern = true;
    const pos = pctM ? parseFloat(pctM[1]) / 100 : (stops.length ? 1 : 0);
    const raw = p.replace(/\s+-?[\d.]+(px|%|em|rem|vw|vh)\s*$/i, "").trim();
    const color = raw === "transparent" ? { r: 0, g: 0, b: 0, a: 0 } : (parseColor(raw) || { r: 0, g: 0, b: 0, a: 0 });
    stops.push({ color, pos });
  }
  if (isPattern) return null;
  return { angle, stops };
}

// background-image layers → Figma fills. assetMap: srcUrl → asset name.
function bgFills(st, assetMap) {
  const bi = st.backgroundImage; if (!bi || bi === "none") return [];
  const out = [];
  for (const l of splitTop(bi).reverse()) { // CSS first layer on top → Figma last fill on top
    const s = l.trim(); const um = s.match(/url\(["']?(.*?)["']?\)/);
    if (um) { const asset = assetMap.get(um[1]); if (asset) out.push({ type: "image", asset, size: st.backgroundSize, pos: st.backgroundPosition }); }
    else if (s.startsWith("linear-gradient")) { const g = parseLinear(s); if (g) out.push({ type: "gradient", ...g }); }
  }
  return out;
}

// box-shadow (comma-list, optional inset) → [{x,y,blur,spread,color,inset}]
function parseShadows(v) {
  if (!v || v === "none") return [];
  return splitTop(v).map((raw) => {
    let s = raw.trim(); const inset = /\binset\b/.test(s); s = s.replace(/\binset\b/, " ");
    const cm = s.match(/rgba?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}/i);
    const color = cm ? parseColor(cm[0]) : { r: 0, g: 0, b: 0, a: 1 };
    const nums = (cm ? s.replace(cm[0], " ") : s).trim().split(/\s+/).filter(Boolean).map(px);
    const [x = 0, y = 0, blur = 0, spread = 0] = nums;
    return { x, y, blur, spread, color, inset };
  }).filter((sh) => sh.color && sh.color.a > 0);
}

// Text style — omit default-valued fields (lineHeight normal / letter 0 /
// transform none / align left). `st` is the PARENT element's raw style.
function textStyle(st) {
  const t = { family: (st.fontFamily || "").split(",")[0].replace(/["']/g, "").trim(), size: px(st.fontSize), weight: parseInt(st.fontWeight, 10) || 400, color: parseColor(st.color) };
  if (st.lineHeight && st.lineHeight !== "normal") t.lineHeight = px(st.lineHeight);
  const letter = !st.letterSpacing || st.letterSpacing === "normal" ? 0 : parseFloat(st.letterSpacing); if (letter) t.letter = letter;
  if (st.textTransform && st.textTransform !== "none") t.transform = st.textTransform;
  const ta = st.textAlign;
  if (ta === "center") t.align = "center";
  else if (ta === "right" || ta === "end") t.align = "right";
  else if (ta === "justify") t.align = "justified";
  return t;
}

/* ─────────────────── raw node → Figma-intent SpecNode ─────────────── */

function deriveNode(raw, assetMap) {
  // svg leaf
  if (raw.svgMarkup) {
    const st = raw.style || {};
    return { kind: "svg", x: raw.rect.x, y: raw.rect.y, w: raw.rect.w, h: raw.rect.h, svg: raw.svgMarkup, color: parseColor(st.color) };
  }
  const st = raw.style || {};
  const node = { tag: raw.tag, x: raw.rect.x, y: raw.rect.y, w: raw.rect.w, h: raw.rect.h };
  if (st.position === "absolute") node.position = "absolute";
  const op = st.opacity && st.opacity !== "1" ? parseFloat(st.opacity) : 1; if (op !== 1) node.opacity = op;

  // Rotation (Tailwind v4 `rotate` prop, else transform matrix). Swap the AABB
  // (raw.rect) for the un-rotated layout box (raw.offset) recentred on the AABB.
  let deg = 0;
  if (st.rotate && st.rotate !== "none") { const m = st.rotate.match(/(-?[\d.]+)deg/); if (m) deg = Math.round(parseFloat(m[1])); }
  if (!deg && st.transform && st.transform.startsWith("matrix(")) { const p = st.transform.slice(7).split(",").map(parseFloat); deg = Math.round((Math.atan2(p[1], p[0]) * 180) / Math.PI); }
  if (deg && raw.offset) {
    const ow = raw.offset.w, oh = raw.offset.h;
    const cx = raw.rect.x + raw.rect.w / 2, cy = raw.rect.y + raw.rect.h / 2;
    node.rotate = deg; node.w = ow; node.h = oh; node.x = Math.round(cx - ow / 2); node.y = Math.round(cy - oh / 2);
  }

  // Corner radii — clamp each to half the box (pill cap); compact when uniform.
  const cr = (v) => Math.min(px(v), Math.round(raw.rect.h / 2), Math.round(raw.rect.w / 2));
  const tl = cr(st.borderTopLeftRadius), tr = cr(st.borderTopRightRadius), br = cr(st.borderBottomRightRadius), bl = cr(st.borderBottomLeftRadius);
  if (tl || tr || br || bl) { if (tl === tr && tr === br && br === bl) node.radius = tl; else node.radii = { tl, tr, br, bl }; }

  const clips = (v) => v === "hidden" || v === "clip" || v === "scroll" || v === "auto";
  if (clips(st.overflowX) || clips(st.overflowY)) node.clip = true;

  // Fills: background-color solid, then bg-image layers, then <img> photo.
  const fills = []; const bg = parseColor(st.backgroundColor); if (bg && bg.a > 0) fills.push({ type: "solid", color: bg });
  for (const f of bgFills(st, assetMap)) fills.push(f);
  if (raw.imgSrc) { const asset = assetMap.get(raw.imgSrc); if (asset) fills.push({ type: "image", asset, size: st.objectFit, pos: st.objectPosition }); }
  if (fills.length) node.fills = fills;

  // Borders — all four sides; compact `weight` when uniform. Figma strokes are
  // single-color → pick the first visible bordered side's color.
  const bcol = { t: parseColor(st.borderTopColor), r: parseColor(st.borderRightColor), b: parseColor(st.borderBottomColor), l: parseColor(st.borderLeftColor) };
  const on = (w, c) => (w > 0 && c && c.a > 0) ? w : 0;
  const W = { t: on(px(st.borderTopWidth), bcol.t), r: on(px(st.borderRightWidth), bcol.r), b: on(px(st.borderBottomWidth), bcol.b), l: on(px(st.borderLeftWidth), bcol.l) };
  if (W.t || W.r || W.b || W.l) {
    const scol = W.t ? bcol.t : W.r ? bcol.r : W.b ? bcol.b : bcol.l;
    if (W.t === W.r && W.r === W.b && W.b === W.l) node.stroke = { color: scol, weight: W.t };
    else node.stroke = { color: scol, weights: W };
  }

  const shadows = parseShadows(st.boxShadow); if (shadows.length) node.shadows = shadows;
  const fb = (st.filter || "").match(/blur\(([\d.]+)px\)/);
  const bb = (st.backdropFilter || st.webkitBackdropFilter || "").match(/blur\(([\d.]+)px\)/);
  if (fb) node.blur = { type: "layer", radius: parseFloat(fb[1]) };
  else if (bb) node.blur = { type: "background", radius: parseFloat(bb[1]) };

  const isFlex = st.display === "flex" || st.display === "inline-flex"; const isGrid = st.display === "grid";
  if (isFlex || isGrid) {
    const L = { mode: isGrid ? "grid" : ((st.flexDirection || "").startsWith("column") ? "column" : "row"), justify: st.justifyContent, align: st.alignItems };
    const gap = px(st.gap === "normal" ? "0" : (st.gap || "0").split(" ")[0]); if (gap) L.gap = gap;
    const pt = px(st.paddingTop), prg = px(st.paddingRight), pb = px(st.paddingBottom), pl = px(st.paddingLeft);
    if (pt || prg || pb || pl) L.padding = { t: pt, r: prg, b: pb, l: pl };
    node.layout = L;
  }

  // Children — text runs interleaved with elements, in DOM order. Text inherits
  // THIS node's style (its parent element).
  const children = [];
  for (const cn of raw.children || []) {
    if (cn.kind === "text") children.push({ kind: "text", x: cn.rect.x, y: cn.rect.y, w: cn.rect.w, h: cn.rect.h, text: { chars: cn.chars, ...textStyle(st) } });
    else children.push(deriveNode(cn, assetMap));
  }
  if (children.length) node.children = children;
  return node;
}

/* ────────────────────────────── brand ─────────────────────────────── */

const titleToken = (t) => t.replace("--ta-", "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const fam = (v) => (v || "").split(",")[0].replace(/["']/g, "").trim();

function deriveBrand(brand) {
  const brandColors = [];
  for (const token of Object.keys(brand.colorVars || {}).sort()) {
    const rgb = parseColor(brand.colorVars[token]);
    if (rgb) brandColors.push({ name: titleToken(token), token, rgb: { r: rgb.r, g: rgb.g, b: rgb.b } });
  }
  const fv = brand.fontVars || {};
  const fonts = {
    display: { family: fam(fv.display), role: "display" },
    serif: { family: fam(fv.serif), role: "serif" },
    sans: { family: fam(fv.sans), role: "sans" },
    mono: { family: fam(fv.mono), role: "mono" },
  };
  return { brandColors, fonts };
}

/* ─────────────────────────── the derive ───────────────────────────── */

/** CaptureBundle → BuildSpec (pure; the IP). */
export function derive(bundle) {
  if (!bundle || bundle.contract !== 1) throw new Error(`unsupported capture contract: ${bundle?.contract}`);
  const assetMap = new Map((bundle.assets || []).map((a) => [a.srcUrl, a.name]));
  const blocks = new Map(); // blockId → SpecBlock
  for (const cb of bundle.blocks || []) {
    if (!blocks.has(cb.blockId)) blocks.set(cb.blockId, { blockId: cb.blockId, name: cb.name, page: cb.page, route: cb.route, views: {} });
    blocks.get(cb.blockId).views[cb.view] = deriveNode(cb.root, assetMap);
  }
  const { brandColors, fonts } = deriveBrand(bundle.brand || {});
  return {
    contract: 1,
    variation: bundle.variation,
    blockPageName: "Block Library",
    brandCollectionName: "Brand",
    brandColors,
    fonts,
    views: bundle.views,
    widths: bundle.widths,
    pruneStale: true,
    blocks: [...blocks.values()],
    pages: bundle.pages || [],
    assets: (bundle.assets || []).map((a) => ({ name: a.name })),
  };
}

/* ───────────────── Vercel-Function wrapper (API-key gated) ─────────── */

export async function handler(req, res) {
  const key = req.headers["x-license-key"] || req.headers["authorization"];
  if (!process.env.DERIVE_LICENSE_KEY || key !== process.env.DERIVE_LICENSE_KEY) {
    res.statusCode = 401; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "unauthorized" }));
  }
  try {
    const bundle = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const spec = derive(bundle);
    res.statusCode = 200; res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(spec));
  } catch (e) {
    res.statusCode = 400; res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: e.message }));
  }
}

/* ─────────────────────── offline POC CLI ──────────────────────────── */

async function cli() {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { join } = await import("node:path");
  const argv = process.argv.slice(2);
  let variation = "v00", inPath = null, outPath = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-v" || argv[i] === "--variation") variation = argv[++i];
    else if (argv[i] === "--in") inPath = argv[++i];
    else if (argv[i] === "--out") outPath = argv[++i];
  }
  const outDir = fileURLToPath(new URL("./out", import.meta.url));
  inPath = inPath || join(outDir, `capture-${variation}.json`);
  outPath = outPath || join(outDir, `reconstruct-${variation}.json`);
  const bundle = JSON.parse(await readFile(inPath, "utf8"));
  const spec = derive(bundle);
  await writeFile(outPath, JSON.stringify(spec));
  const nodeCount = (n) => 1 + (n.children || []).reduce((a, c) => a + nodeCount(c), 0);
  const totalNodes = spec.blocks.reduce((a, b) => a + Object.values(b.views).reduce((s, sp) => s + nodeCount(sp), 0), 0);
  console.error(`✓ BuildSpec: ${spec.blocks.length} block(s), ${totalNodes} nodes, ${spec.brandColors.length} brand colors → ${outPath}`);
  console.log(JSON.stringify({ inPath, outPath, blocks: spec.blocks.length, nodes: totalNodes, brandColors: spec.brandColors.length }, null, 2));
}

// Run the CLI only when invoked directly (not when imported as the handler).
if (process.argv[1] && process.argv[1].endsWith("derive.mjs")) {
  cli().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
}
