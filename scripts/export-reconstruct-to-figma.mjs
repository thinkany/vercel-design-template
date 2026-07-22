#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-reconstruct-to-figma.mjs — the RECONSTRUCT extractor (replaces the
 * html.to.design block-CAPTURE path in export-to-figma.mjs).
 *
 * WHAT IT DOES
 *   Drives a headless browser to each design page's isolated capture route
 *   (`?v={id}&{route}&capture={view}`) at each ACTIVE breakpoint, and walks every
 *   `[data-block]` section's live DOM into a deterministic BUILD SPEC of uniform
 *   ordered nodes (box / text / svg) — layout (flex/grid → auto-layout intent),
 *   fills (solid / gradient / image), text (font/size/weight/align/color), svg
 *   icons (markup), image fills (downloaded for upload_assets). Colors resolve to
 *   sRGB via an in-page canvas (handles oklab/hsl/rgb). It also reads the brand
 *   palette + font roles LIVE from the running app (`--ta-*` / `--ta-font-*` on
 *   :root), so the builder can bind fills to Brand variables — no tokens.css parse.
 *
 *   Unlike the capture path there is NO html.to.design, NO generate_figma_design
 *   mint/poll, and NO doomed captures: the whole section becomes real editable
 *   Figma nodes, built by figma-reconstruct-library.plugin.js. This is the fast +
 *   faithful half; the rest of the export (variables/textstyles/specimen/
 *   components/compose) is unchanged.
 *
 * OUTPUT  figma-export/reconstruct-{id}.json:
 *   { variation, blockPageName, brandCollectionName, brandColors:[{name,token,rgb}],
 *     fonts:{display,serif,sans,mono}, views, widths,
 *     blocks:[{ blockId, name, page, route, layout, views:{ [view]: <spec-root> } }],
 *     pages:[{ id, name, route, blocks:[{blockId,name}] }],   // order for compose
 *     assets:[{ name, path, bytes }] }                        // images to upload
 *
 * USAGE
 *   node scripts/export-reconstruct-to-figma.mjs -v v00            # all blocks × active views
 *   node scripts/export-reconstruct-to-figma.mjs -v v00 --fast     # primary breakpoint only
 *   node scripts/export-reconstruct-to-figma.mjs -v v00 --only hero,footer
 *
 * PREREQUISITE: dev server running. puppeteer auto-installs locally on first run
 *   (never a project dep, never on Vercel — the deploy never runs this).
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

// ── Emit ready-to-submit use_figma call payloads, sized to the 50K code limit ──
// For each block, assemble `const MANIFEST=…;const PHASE=…;` + the builder body.
// If both breakpoints fit under --limit → one `{blockId}.js` (builds the View= set).
// Else → per-view `{blockId}-{view}.js` temp builds + a shared `_combine.js`. Writes
// `_plan.json` (ordered calls + combine list + any single view STILL too big). So
// orchestration just reads a file and submits it verbatim — no manual assembly,
// no size guessing, no failed "try then discover it's too big" round-trips.
async function emitCalls(manifest, out, limit) {
  const bodySrc = await readFile(new URL("./figma-reconstruct-library.plugin.js", import.meta.url), "utf8");
  const body = bodySrc.slice(bodySrc.indexOf("async function getOrCreateCollection"));
  const base = { blockPageName: manifest.blockPageName, brandCollectionName: manifest.brandCollectionName, brandColors: manifest.brandColors, fonts: manifest.fonts, views: manifest.views, widths: manifest.widths };
  const assemble = (m, phase) => `const MANIFEST=${JSON.stringify(m)};\nconst PHASE=${JSON.stringify(phase)};\n${body}`;
  const dir = join(out, "reconstruct-calls");
  await mkdir(dir, { recursive: true });
  const plan = { note: "PART 1 (Styleguide+Blocks): submit each calls[].file as the use_figma `code` param (with your fileKey), collect photos[] from each return + upload_assets, then submit _combine.js. PART 2 (Pages from blocks): once blocks exist, submit each compose[].file — one per page, fan out in parallel — to compose design Pages from block instances (resolved BY NAME off the Block Library page).", calls: [], combine: [], compose: [], oversized: [] };
  for (const blk of manifest.blocks) {
    const views = Object.keys(blk.views);
    const full = assemble({ ...base, blocks: [blk] }, "reconstruct");
    if (full.length <= limit) {
      const f = `${blk.blockId}.js`; await writeFile(join(dir, f), full);
      plan.calls.push({ file: f, blockId: blk.blockId, phase: "reconstruct", views, bytes: full.length });
    } else {
      for (const view of views) {
        const code = assemble({ ...base, views: [view], blocks: [{ ...blk, views: { [view]: blk.views[view] } }], temp: true }, "reconstruct");
        const f = `${blk.blockId}-${view}.js`; await writeFile(join(dir, f), code);
        plan.calls.push({ file: f, blockId: blk.blockId, phase: "reconstruct", temp: true, view, bytes: code.length });
        if (code.length > limit) plan.oversized.push({ blockId: blk.blockId, view, bytes: code.length });
      }
      plan.combine.push({ blockId: blk.blockId, name: blk.name, views });
    }
  }
  if (plan.combine.length) { const code = assemble({ blockPageName: manifest.blockPageName, combine: plan.combine }, "combine"); await writeFile(join(dir, "_combine.js"), code); plan.combineCall = { file: "_combine.js", bytes: code.length }; }
  // PART 2 — one compose call per page. Blocks carry NO componentId, so the builder
  // resolves each BY NAME off the Block Library page (Part 1's output). Tiny payloads
  // (body + page-order manifest), never near the limit; fan out in parallel per page.
  for (const pg of manifest.pages || []) {
    if (!pg.blocks || !pg.blocks.length) continue;
    const m = { page: { id: pg.id, name: pg.name, route: pg.route, blocks: pg.blocks.map((b) => ({ blockId: b.blockId, name: b.name })) }, views: manifest.views, widths: manifest.widths, blockPageName: manifest.blockPageName };
    const code = assemble(m, "compose");
    const f = `_compose-${pg.id}.js`; await writeFile(join(dir, f), code);
    plan.compose.push({ file: f, page: pg.id, name: pg.name, blocks: pg.blocks.length, bytes: code.length });
  }
  await writeFile(join(dir, "_plan.json"), JSON.stringify(plan, null, 2));
  const singles = plan.calls.filter((c) => !c.temp).length;
  console.error(`✓ emitted ${plan.calls.length} block call(s)${plan.combine.length ? " + _combine.js" : ""} + ${plan.compose.length} compose call(s) + _plan.json → ${dir}`);
  console.error(`  Part 1: ${singles} block(s) fit one call, ${plan.combine.length} split into per-view temp+combine. Part 2: ${plan.compose.length} page(s) to compose.`);
  if (plan.oversized.length) console.error(`  ⚠ ${plan.oversized.length} single view(s) STILL exceed ${limit}B even shrunk — will fail the 50K limit; node-tree split needed: ${plan.oversized.map((o) => `${o.blockId}/${o.view} (${o.bytes}B)`).join(", ")}`);
  return plan;
}

const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900;

function parseArgs(argv) {
  const args = { url: "http://localhost:5173", variation: "v00", out: "figma-export", views: null, pages: null, only: null, fast: false, emitCalls: false, limit: 48000 };
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--views") args.views = list(argv[++i]);
    else if (a === "--pages") args.pages = list(argv[++i]);
    else if (a === "--only") args.only = list(argv[++i]);
    else if (a === "--fast") args.fast = true;
    else if (a === "--emit-calls") args.emitCalls = true;
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10) || 48000;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function help() {
  console.log(`
export-reconstruct-to-figma — walk every [data-block] into a Figma build spec.

  node scripts/export-reconstruct-to-figma.mjs [options]
  -v, --variation <id>   Variation (default v00)
      --url <url>        Dev server (default http://localhost:5173)
      --views <list>     Override active breakpoints (e.g. desktop,mobile)
      --pages <list>     Limit to these page ids
      --only <list>      Only these block ids
      --fast             Primary (first active) breakpoint only
      --out <dir>        Output dir (default figma-export)
`);
}

async function loadPuppeteer() {
  try { return (await import("puppeteer")).default; }
  catch {
    console.log("→ First run: installing puppeteer locally (one-time)…\n");
    const { execSync } = await import("node:child_process");
    execSync("npm install puppeteer@25.3.0 --no-save", { stdio: "inherit" });
    return (await import("puppeteer")).default;
  }
}

async function readManifest(page, url, viewsOverride) {
  await page.goto(`${url}/?v=v00`, { waitUntil: "networkidle0" });
  const cfg = await page.evaluate(() => window.__PREVIEW_CONFIG__ ?? null);
  const widths = { ...FALLBACK_WIDTHS, ...(cfg?.widths ?? {}) };
  const views = viewsOverride ?? cfg?.views ?? ["desktop", "mobile"];
  const pages = cfg?.pages?.length ? cfg.pages : [{ id: "home", route: "", name: "Home" }];
  return { views, widths, pages };
}

// Read the brand palette + font roles LIVE from :root (--ta-* / --ta-font-*).
// Design-agnostic — works on any branded copy without parsing tokens.css.
async function readBrand(page) {
  return page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const toRGB = (css) => { if (!css) return null; ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css.trim(); ctx.fillRect(0, 0, 1, 1); const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data; return { r: r / 255, g: g / 255, b: b / 255 }; };
    const rs = getComputedStyle(document.documentElement);
    // Enumerate declared custom properties across all stylesheets for --ta-* names.
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (!rule.style) continue;
        for (const p of rule.style) if (p.startsWith("--ta-") && !p.startsWith("--ta-font")) names.add(p);
      }
    }
    const title = (t) => t.replace("--ta-", "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const brandColors = [];
    for (const token of [...names].sort()) {
      const val = rs.getPropertyValue(token); const rgb = toRGB(val);
      if (rgb) brandColors.push({ name: title(token), token, rgb });
    }
    const fam = (v) => (v || "").split(",")[0].replace(/["']/g, "").trim();
    const fonts = {
      display: { family: fam(rs.getPropertyValue("--ta-font-display")), role: "display" },
      serif: { family: fam(rs.getPropertyValue("--ta-font-serif")), role: "serif" },
      sans: { family: fam(rs.getPropertyValue("--ta-font-sans")), role: "sans" },
      mono: { family: fam(rs.getPropertyValue("--ta-font-mono")), role: "mono" },
    };
    return { brandColors, fonts };
  });
}

// ── The DOM→spec walker (runs in the page). Uniform ordered nodes; text runs are
// their own nodes measured via Range so a label + inline icon keep their order. ──
function extractSpec(blockSel) {
  const root = document.querySelector(`[data-block="${blockSel}"]`);
  if (!root) return { error: "not found" };
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const toRGBA = (css) => { if (!css || css === "transparent" || css === "none") return null; ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 }; };
  const splitTop = (s) => { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
  const parseLinear = (str) => {
    const m = str.match(/linear-gradient\((.*)\)$/s); if (!m) return null;
    const parts = splitTop(m[1]); let angle = 180, i = 0; const dir = parts[0].trim();
    if (/^(to |[\d.]+deg|[\d.]+turn|[\d.]+rad)/.test(dir)) {
      if (dir.startsWith("to ")) { const map = { top: 0, bottom: 180, left: 270, right: 90, "top left": 315, "top right": 45, "bottom left": 225, "bottom right": 135 }; angle = map[dir.slice(3).trim()] ?? 180; }
      else if (dir.endsWith("deg")) angle = parseFloat(dir); i = 1;
    }
    const stops = [];
    let isPattern = false;
    for (let k = i; k < parts.length; k++) {
      const p = parts[k].trim();
      // A stop may trail a position in % OR px. A PX position means a repeating
      // hairline/grid pattern (paired with a small background-size tile) — a single
      // Figma linear gradient can't represent it, and the old code left "1px" glued to
      // the color so toRGBA failed → SOLID BLACK stops (the map-header "gray wash").
      // Flag those and drop the layer; strip the token so the color parses cleanly.
      const pctM = p.match(/(-?[\d.]+)%\s*$/);
      if (/[\d.]+px\s*$/.test(p)) isPattern = true;
      const pos = pctM ? parseFloat(pctM[1]) / 100 : (stops.length ? 1 : 0);
      const raw = p.replace(/\s+-?[\d.]+(px|%|em|rem|vw|vh)\s*$/i, "").trim();
      const color = raw === "transparent" ? { r: 0, g: 0, b: 0, a: 0 } : (toRGBA(raw) || { r: 0, g: 0, b: 0, a: 0 });
      stops.push({ color, pos });
    }
    if (isPattern) return null; // decorative grid/hairline texture → omit, don't paint black
    return { angle, stops };
  };
  const bgFills = (cs) => {
    const bi = cs.backgroundImage; if (!bi || bi === "none") return [];
    const out = [];
    for (const l of splitTop(bi).reverse()) { // CSS first layer paints on top → Figma last fill on top
      const s = l.trim(); const um = s.match(/url\(["']?(.*?)["']?\)/);
      if (um) out.push({ type: "image", url: um[1], size: cs.backgroundSize, pos: cs.backgroundPosition });
      else if (s.startsWith("linear-gradient")) { const g = parseLinear(s); if (g) out.push({ type: "gradient", ...g }); }
    }
    return out;
  };
  const px = (v) => Math.round(parseFloat(v) || 0);
  const relRect = (rect, pr) => ({ w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.left - pr.left), y: Math.round(rect.top - pr.top) });
  // Text style — omit default-valued fields (lineHeight null / letter 0 /
  // transform "none" / align left are defaults). Shrinks every text node.
  // `align` carries the DOM's text-align so the builder can center/right wrapped
  // copy: a tight single-line box at a centered x LOOKS centered, but a wrapped
  // paragraph left-aligns within its box unless textAlignHorizontal is set.
  const textStyle = (cs) => {
    const t = { family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: px(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, color: toRGBA(cs.color) };
    if (cs.lineHeight !== "normal") t.lineHeight = px(cs.lineHeight);
    const letter = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing); if (letter) t.letter = letter;
    if (cs.textTransform && cs.textTransform !== "none") t.transform = cs.textTransform;
    // start/left is the default (omitted); end→right for LTR copy.
    const ta = cs.textAlign;
    if (ta === "center") t.align = "center";
    else if (ta === "right" || ta === "end") t.align = "right";
    else if (ta === "justify") t.align = "justified";
    return t;
  };
  // OMIT-DEFAULTS: the builder treats missing fields as defaults (kind→"box",
  // position→"flow", opacity→1, radius→0, no fills/stroke/layout/children, z
  // unused). Emitting only non-defaults cuts spec size ~40–50% — the difference
  // between a heavy block fitting in one use_figma call and not.
  // box-shadow → [{x,y,blur,spread,color,inset}]. Computed style lists the colour first
  // (rgb/rgba), then 2–4 lengths, optional `inset`; multiple shadows are comma-separated.
  const parseShadows = (v) => {
    if (!v || v === "none") return [];
    return splitTop(v).map((raw) => {
      let s = raw.trim(); const inset = /\binset\b/.test(s); s = s.replace(/\binset\b/, " ");
      const cm = s.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
      const color = cm ? toRGBA(cm[0]) : { r: 0, g: 0, b: 0, a: 1 };
      const nums = (cm ? s.replace(cm[0], " ") : s).trim().split(/\s+/).filter(Boolean).map(px);
      const [x = 0, y = 0, blur = 0, spread = 0] = nums;
      return { x, y, blur, spread, color, inset };
    }).filter((sh) => sh.color && sh.color.a > 0);
  };
  const walk = (el, pr) => {
    const cs = getComputedStyle(el); const rect = el.getBoundingClientRect(); const tag = el.tagName.toLowerCase();
    if (tag === "svg") return { kind: "svg", ...relRect(rect, pr), svg: el.outerHTML, color: toRGBA(cs.color) };
    const isFlex = cs.display === "flex" || cs.display === "inline-flex"; const isGrid = cs.display === "grid";
    const node = { tag, ...relRect(rect, pr) };
    if (cs.position === "absolute") node.position = "absolute";
    const op = cs.opacity !== "1" ? parseFloat(cs.opacity) : 1; if (op !== 1) node.opacity = op;
    // Rotation from the 2D transform matrix. getBoundingClientRect returns the rotated
    // AABB, so swap in the UN-rotated layout box (offsetW/H) recentred on the AABB centre;
    // the builder rotates the node about that centre. (Rotated CONTAINERS with children
    // aren't fully handled — this targets decorative leaves like a `rotate-45` square.)
    let deg = 0;
    // Tailwind v4 uses the individual `rotate` CSS property (`rotate: 45deg`); older/other
    // rotations show up in the transform matrix. Check both.
    if (cs.rotate && cs.rotate !== "none") { const m = cs.rotate.match(/(-?[\d.]+)deg/); if (m) deg = Math.round(parseFloat(m[1])); }
    if (!deg && cs.transform && cs.transform.startsWith("matrix(")) { const p = cs.transform.slice(7).split(",").map(parseFloat); deg = Math.round(Math.atan2(p[1], p[0]) * 180 / Math.PI); }
    if (deg) { const ow = el.offsetWidth, oh = el.offsetHeight; const cx = (rect.left - pr.left) + rect.width / 2, cy = (rect.top - pr.top) + rect.height / 2; node.rotate = deg; node.w = ow; node.h = oh; node.x = Math.round(cx - ow / 2); node.y = Math.round(cy - oh / 2); }
    // Capture ALL FOUR corner radii (not just top-left) so mixed corners — e.g. a
    // `rounded-t-2xl` card top — survive. Compact to a single `radius` when uniform,
    // else emit `radii:{tl,tr,br,bl}`. Clamp per corner to half the box (pill cap).
    const cr = (v) => Math.min(px(v), Math.round(rect.height / 2), Math.round(rect.width / 2));
    const tl = cr(cs.borderTopLeftRadius), tr = cr(cs.borderTopRightRadius), br = cr(cs.borderBottomRightRadius), bl = cr(cs.borderBottomLeftRadius);
    if (tl || tr || br || bl) { if (tl === tr && tr === br && br === bl) node.radius = tl; else node.radii = { tl, tr, br, bl }; }
    // Capture overflow clipping. Without it the builder never clips, so an
    // `overflow-hidden rounded-*` card can't round its children's corners — an opaque
    // child (a photo/gradient avatar) paints its square corners over the rounded top.
    const clips = (v) => v === "hidden" || v === "clip" || v === "scroll" || v === "auto";
    if (clips(cs.overflowX) || clips(cs.overflowY)) node.clip = true;
    const fills = []; const bg = toRGBA(cs.backgroundColor); if (bg && bg.a > 0) fills.push({ type: "solid", color: bg });
    for (const f of bgFills(cs)) fills.push(f);
    // <img> — capture the real photo (previously only CSS background-image was read, so
    // logos rendered as empty boxes). currentSrc resolves srcset to an absolute URL; the
    // download pass fetches http `url`→`asset`, the builder sets it via upload_assets.
    if (tag === "img") { const src = el.currentSrc || el.src; if (src) fills.push({ type: "image", url: src, size: cs.objectFit, pos: cs.objectPosition }); }
    if (fills.length) node.fills = fills;
    // Borders — capture ALL FOUR sides, not just top. A `border-t-4` accent (blue top
    // only) was being read as top-then-applied-to-all-sides → a full blue box. Emit a
    // compact `weight` when uniform, else per-side `weights:{t,r,b,l}`. Figma strokes
    // are single-color, so pick the color from the first visible bordered side.
    const bcol = { t: toRGBA(cs.borderTopColor), r: toRGBA(cs.borderRightColor), b: toRGBA(cs.borderBottomColor), l: toRGBA(cs.borderLeftColor) };
    const on = (w, c) => (w > 0 && c && c.a > 0) ? w : 0;
    const W = { t: on(px(cs.borderTopWidth), bcol.t), r: on(px(cs.borderRightWidth), bcol.r), b: on(px(cs.borderBottomWidth), bcol.b), l: on(px(cs.borderLeftWidth), bcol.l) };
    if (W.t || W.r || W.b || W.l) {
      const scol = W.t ? bcol.t : W.r ? bcol.r : W.b ? bcol.b : bcol.l;
      if (W.t === W.r && W.r === W.b && W.b === W.l) node.stroke = { color: scol, weight: W.t };
      else node.stroke = { color: scol, weights: W };
    }
    // Shadows + blur → Figma effects (previously all dropped → flat cards, sharp glows).
    // box-shadow (comma-list, optional `inset`) → DROP/INNER_SHADOW; `filter: blur()` →
    // LAYER_BLUR; `backdrop-filter: blur()` (glass cards) → BACKGROUND_BLUR.
    const shadows = parseShadows(cs.boxShadow); if (shadows.length) node.shadows = shadows;
    const fb = (cs.filter || "").match(/blur\(([\d.]+)px\)/);
    const bb = (cs.backdropFilter || cs.webkitBackdropFilter || "").match(/blur\(([\d.]+)px\)/);
    if (fb) node.blur = { type: "layer", radius: parseFloat(fb[1]) };
    else if (bb) node.blur = { type: "background", radius: parseFloat(bb[1]) };
    if (isFlex || isGrid) {
      const L = { mode: isGrid ? "grid" : (cs.flexDirection.startsWith("column") ? "column" : "row"), justify: cs.justifyContent, align: cs.alignItems };
      const gap = px(cs.gap === "normal" ? "0" : cs.gap.split(" ")[0]); if (gap) L.gap = gap;
      const pt = px(cs.paddingTop), prg = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
      if (pt || prg || pb || pl) L.padding = { t: pt, r: prg, b: pb, l: pl };
      node.layout = L;
    }
    const children = [];
    for (const cn of el.childNodes) {
      if (cn.nodeType === 3) { const chars = cn.textContent.replace(/\s+/g, " ").trim(); if (!chars) continue; const rng = document.createRange(); rng.selectNodeContents(cn); children.push({ kind: "text", ...relRect(rng.getBoundingClientRect(), rect), text: { chars, ...textStyle(cs) } }); }
      else if (cn.nodeType === 1) children.push(walk(cn, rect));
    }
    if (children.length) node.children = children;
    return node;
  };
  const rr = root.getBoundingClientRect();
  const tree = walk(root, { left: rr.left, top: rr.top });
  tree.x = 0; tree.y = 0;
  return { spec: tree };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  const t0 = performance.now();
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 600000 });
  try {
    const page = await browser.newPage();
    let { views, widths, pages: allPages } = await readManifest(page, args.url, args.views);
    if (args.fast && views.length > 1) views = views.slice(0, 1);
    const pages = args.pages ? allPages.filter((p) => args.pages.includes(p.id)) : allPages;
    const brand = await readBrand(page);

    // Discover unique blocks (first-seen across pages) + per-page order.
    const blocks = new Map(); // blockId → { blockId, name, page, route, views:{} }
    const pagesOut = [];
    for (const pg of pages) {
      const routeFlag = pg.route ? `&${pg.route}` : "";
      const pageBlockList = [];
      for (const view of views) {
        const width = widths[view] ?? FALLBACK_WIDTHS[view] ?? 1440;
        await page.setViewport({ width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 2 });
        await page.goto(`${args.url}/?v=${args.variation}${routeFlag}&capture=${view}`, { waitUntil: "networkidle0" });
        await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
        // B1 settle: before walking the DOM, wait for webfonts to swap in, images to
        // decode, and two paint frames — so every measured box (text wrap width, inline
        // icon offset, image dimensions) is FINAL. Cheap insurance against capture-timing
        // flake: a block walked mid-font-swap or pre-image-decode measures wrong geometry,
        // which then bakes into the Figma nodes.
        await page.evaluate(async () => {
          try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
          try { await Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {}))); } catch (e) {}
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        });
        const markers = await page.evaluate(() => [...document.querySelectorAll("[data-block]")].map((el) => ({ blockId: el.getAttribute("data-block"), name: el.getAttribute("data-block-name") || el.getAttribute("data-block") })));
        for (const m of markers) {
          if (!m.blockId) continue;
          if (args.only && !args.only.includes(m.blockId)) continue;
          if (view === views[0] && !pageBlockList.find((b) => b.blockId === m.blockId)) pageBlockList.push({ blockId: m.blockId, name: m.name });
          const res = await page.evaluate(extractSpec, m.blockId);
          if (res.error) { console.error(`  ! ${m.blockId}/${view}: ${res.error}`); continue; }
          if (!blocks.has(m.blockId)) blocks.set(m.blockId, { blockId: m.blockId, name: m.name, page: pg.id, route: pg.route, views: {} });
          blocks.get(m.blockId).views[view] = res.spec;
        }
      }
      pagesOut.push({ id: pg.id, name: pg.name, route: pg.route, blocks: pageBlockList });
    }

    // Download image fills → local files for upload_assets.
    const ASSETS = join(args.out, "reconstruct-assets");
    await mkdir(ASSETS, { recursive: true });
    const assets = [];
    let idx = 0;
    const resolveImages = async (node, blockId, view) => {
      for (const f of node.fills || []) {
        if (f.type === "image" && f.url && f.url.startsWith("http")) {
          const name = `${blockId}-${view}-${idx++}.png`;
          const path = join(ASSETS, name);
          try {
            // Re-encode to PNG in the browser (canvas). Figma's upload_assets renders
            // webp ALPHA as fully transparent — a white-on-transparent logo vanishes — so
            // normalize EVERY image to PNG (universally-correct alpha) before download.
            const dataUrl = await page.evaluate(async (url) => {
              const blob = await (await fetch(url)).blob();
              const bmp = await createImageBitmap(blob);
              const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
              cv.getContext("2d").drawImage(bmp, 0, 0);
              return cv.toDataURL("image/png");
            }, f.url);
            const buf = Buffer.from(dataUrl.split(",")[1], "base64");
            await writeFile(path, buf); f.asset = name; delete f.url; assets.push({ name, path, bytes: buf.length });
          }
          catch (e) { console.error(`  ! asset ${f.url}: ${e.message}`); }
        }
      }
      for (const c of node.children || []) await resolveImages(c, blockId, view);
    };
    for (const b of blocks.values()) for (const [view, spec] of Object.entries(b.views)) await resolveImages(spec, b.blockId, view);

    const manifest = {
      variation: args.variation,
      blockPageName: "Block Library",
      brandCollectionName: "Brand",
      brandColors: brand.brandColors,
      fonts: brand.fonts,
      views, widths,
      // Full-design manifest → the builder may prune blocks no longer present. The
      // per-block emit-calls slices (base copies only named fields) omit this, so
      // sibling calls never delete each other's blocks.
      pruneStale: true,
      blocks: [...blocks.values()],
      pages: pagesOut,
      assets,
    };
    await mkdir(args.out, { recursive: true });
    const outPath = join(args.out, `reconstruct-${args.variation}.json`);
    await writeFile(outPath, JSON.stringify(manifest));
    const nodeCount = (n) => 1 + (n.children || []).reduce((a, c) => a + nodeCount(c), 0);
    const totalNodes = [...blocks.values()].reduce((a, b) => a + Object.values(b.views).reduce((s, sp) => s + nodeCount(sp), 0), 0);
    console.error(`✓ reconstruct manifest: ${blocks.size} block(s) × [${views.join(", ")}], ${totalNodes} nodes, ${assets.length} asset(s), ${brand.brandColors.length} brand colors → ${outPath}`);
    console.error(`  ${((performance.now() - t0) / 1000).toFixed(1)}s. Next: upload assets, run the reconstruct builder (PHASE reconstruct), then compose.`);
    let plan = null;
    if (args.emitCalls) plan = await emitCalls(manifest, args.out, args.limit);
    console.log(JSON.stringify({ outPath, blocks: blocks.size, views, assets: assets.length, brandColors: brand.brandColors.length, ...(plan ? { calls: plan.calls.length, splitBlocks: plan.combine.length, composePages: plan.compose.length, oversized: plan.oversized.length } : {}) }, null, 2));
  } finally {
    try { await browser.close(); } catch {}
  }
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
