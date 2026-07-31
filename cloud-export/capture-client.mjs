#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * capture-client.mjs — the LOCAL half of the licensed cloud-export path.
 *
 * The thin, commodity capture: drive a headless browser to each design page's
 * capture route, serialize every [data-block] into a RAW node tree (raw
 * computed-style strings + geometry — NO interpretation, NO color resolution),
 * download + PNG-reencode image bytes LOCALLY, and assemble a CaptureBundle.
 *
 * This intentionally holds NONE of the derive IP: it emits raw strings the cloud
 * turns into Figma-intent (see cloud-export/derive.mjs + contracts.ts). Image
 * bytes NEVER leave the machine — the bundle carries only asset names/urls; the
 * builder uploads the bytes locally via upload_assets.
 *
 * OUTPUT (POC, disk-based so #1 and #2 run independently of a live endpoint):
 *   cloud-export/out/capture-{variation}.json   ← the CaptureBundle
 *   cloud-export/out/assets/*.png               ← local image bytes
 * A later --post flag will POST the bundle to the cloud endpoint instead.
 *
 * USAGE
 *   node cloud-export/capture-client.mjs -v v00            # all blocks × active views
 *   node cloud-export/capture-client.mjs -v v00 --fast     # primary breakpoint only
 *   node cloud-export/capture-client.mjs -v v00 --only hero,footer
 *
 * PREREQUISITE: dev server running (npm run dev). puppeteer auto-installs on
 *   first run (never a project dep, never on Vercel).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900;
// Per-view capture height, matched to the device-frame portrait heights in the
// live preview (PhoneFrame 780, TabletFrame 900, desktop unframed). Keeps
// `min-h-full` content resolving to the SAME device height in the derive as in
// the preview — without this a full-height mobile section measures at 900 here
// but 780 in the phone frame, so preview↔Figma diverge.
const VIEWPORT_HEIGHTS = { desktop: 900, tablet: 900, mobile: 780 };
const viewHeight = (view) => VIEWPORT_HEIGHTS[view] ?? VIEWPORT_HEIGHT;

// The raw computed-style props the cloud derive reads. The client is the SOLE
// producer of these, so this list is the runtime source of truth; contracts.ts
// mirrors it as CAPTURED_STYLE_PROPS for the type layer. Add here first.
const CAPTURED_STYLE_PROPS = [
  "display", "flexDirection", "justifyContent", "alignItems", "gap",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "boxShadow", "filter", "backdropFilter", "webkitBackdropFilter",
  "opacity", "transform", "rotate", "overflowX", "overflowY",
  "color", "fontFamily", "fontSize", "fontWeight", "lineHeight",
  "letterSpacing", "textAlign", "textTransform",
  "objectFit", "objectPosition", "position",
];

function parseArgs(argv) {
  const args = {
    url: "http://localhost:5173", variation: "v00", out: null, views: null, pages: null, only: null, fast: false, menus: "first",
    // --post sends the bundle to the cloud derive and writes back the BuildSpec.
    // Endpoint + key default to env; flags override. No key is required to WRITE
    // the bundle to disk — only to POST it.
    post: false, endpoint: process.env.DERIVE_ENDPOINT || "", key: process.env.DERIVE_LICENSE_KEY || "",
  };
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--views") args.views = list(argv[++i]);
    else if (a === "--pages") args.pages = list(argv[++i]);
    else if (a === "--only") args.only = list(argv[++i]);
    else if (a === "--menus") args.menus = argv[++i] === "all" ? "all" : "first";
    else if (a === "--fast") args.fast = true;
    else if (a === "--post") args.post = true;
    else if (a === "--endpoint") args.endpoint = argv[++i];
    else if (a === "--key") args.key = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

// POST a CaptureBundle to the cloud derive; return the BuildSpec. Fails loudly on
// a missing endpoint/key or any non-200 so the pipeline never silently proceeds
// with a bad/absent spec.
async function postBundle(bundle, endpoint, key) {
  if (!endpoint) throw new Error("--post needs an endpoint (set DERIVE_ENDPOINT or pass --endpoint <url>)");
  if (!key) throw new Error("--post needs a license key (set DERIVE_LICENSE_KEY or pass --key <k>)");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-license-key": key },
    body: JSON.stringify(bundle),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`derive endpoint ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`derive endpoint returned non-JSON: ${text.slice(0, 300)}`); }
}

function help() {
  console.log(`
capture-client — serialize every [data-block] into a raw CaptureBundle.

  node cloud-export/capture-client.mjs [options]
  -v, --variation <id>   Variation (default v00)
      --url <url>        Dev server (default http://localhost:5173)
      --views <list>     Override active breakpoints (e.g. desktop,mobile)
      --pages <list>     Limit to these page ids
      --only <list>      Only these block ids (e.g. menu-products for one panel)
      --menus <first|all> Desktop open-menu panels: first (default) or all
      --fast             Primary (first active) breakpoint only
      --out <dir>        Output dir (default cloud-export/out)
      --post             POST the bundle to the cloud derive → write BuildSpec
      --endpoint <url>   Derive endpoint (default env DERIVE_ENDPOINT)
      --key <k>          License key (default env DERIVE_LICENSE_KEY)
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

// Read the brand palette + font roles as RAW strings from :root. NO canvas
// resolution — the cloud resolves --ta-* values to sRGB (culori) and titles/binds
// them. Enumerates declared --ta-* custom-property NAMES across all stylesheets
// (getComputedStyle only returns values, not the set of declared names).
async function readBrandRaw(page) {
  return page.evaluate(() => {
    const rs = getComputedStyle(document.documentElement);
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (!rule.style) continue;
        for (const p of rule.style) if (p.startsWith("--ta-") && !p.startsWith("--ta-font")) names.add(p);
      }
    }
    const colorVars = {};
    for (const token of [...names].sort()) {
      const val = rs.getPropertyValue(token).trim();
      if (val) colorVars[token] = val;
    }
    const fontVars = {};
    for (const role of ["display", "serif", "sans", "mono"]) {
      const v = rs.getPropertyValue(`--ta-font-${role}`).trim();
      if (v) fontVars[role] = v;
    }
    return { colorVars, fontVars };
  });
}

// ── The RAW serializer (runs in the page). Faithful, un-interpreted: each
// element node carries its whitelisted raw computed-style strings + parent-
// relative geometry; text children are inline RawTextRun nodes (measured via
// Range) interleaved in DOM order; svg carries outerHTML; img carries src.
// Everything the cloud needs to INTERPRET, and nothing already interpreted. ──
function serializeRaw(blockSel, PROPS) {
  const root = document.querySelector(`[data-block="${blockSel}"]`);
  if (!root) return { error: "not found" };
  const relRect = (rect, pr) => ({ x: Math.round(rect.left - pr.left), y: Math.round(rect.top - pr.top), w: Math.round(rect.width), h: Math.round(rect.height) });
  // Resolve `line-height: normal` to an explicit px value. getComputedStyle keeps
  // it as the literal "normal", and Figma's AUTO line-height computes font-natural
  // leading differently than the browser — so a `normal` heading/paragraph would
  // export with subtly-off vertical rhythm. Measure the browser's real normal
  // leading with a hidden probe (font-natural height of one line), cached per
  // font-family|size|weight|style. Baked into the raw style so the derive emits it.
  const _lh = {};
  const normalLH = (cs) => {
    const key = cs.fontFamily + "|" + cs.fontSize + "|" + cs.fontWeight + "|" + cs.fontStyle;
    if (_lh[key] != null) return _lh[key];
    const s = document.createElement("span");
    s.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;line-height:normal;padding:0;border:0;margin:0";
    s.style.fontFamily = cs.fontFamily; s.style.fontSize = cs.fontSize; s.style.fontWeight = cs.fontWeight; s.style.fontStyle = cs.fontStyle;
    s.textContent = "Mg";
    document.body.appendChild(s);
    const h = s.getBoundingClientRect().height;
    document.body.removeChild(s);
    return (_lh[key] = Math.round(h) + "px");
  };
  const styleOf = (cs) => {
    const o = {};
    for (const p of PROPS) { const v = cs[p]; if (v != null && v !== "") o[p] = v; }
    if (o.lineHeight === "normal" && o.fontSize) o.lineHeight = normalLH(cs);
    return o;
  };
  const walk = (el, pr) => {
    const cs = getComputedStyle(el);
    // Skip EFFECTIVELY-HIDDEN subtrees so they never enter the spec. Headers hide
    // closed dropdown/mega panels different ways: the scaffold uses `hidden`
    // (display:none), a fade-animated Header keeps them mounted with opacity-0 +
    // pointer-events-none, and some use visibility:hidden — catch all three. Without
    // it the CLOSED panels bloat the Header block and duplicate the "Menu — {item}"
    // blocks. The menu pass still captures each panel when it forces it OPEN.
    if (cs.display === "none" || cs.visibility === "hidden" || (cs.opacity === "0" && cs.pointerEvents === "none")) return null;
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const node = { tag, rect: relRect(rect, pr), style: styleOf(cs) };
    if (tag === "svg") { node.svgMarkup = el.outerHTML; return node; } // svg is a leaf
    // offsetW/H are the UN-rotated layout box; the cloud recenters a rotated leaf.
    node.offset = { w: el.offsetWidth, h: el.offsetHeight };
    if (tag === "img") { const src = el.currentSrc || el.src; if (src) node.imgSrc = src; }
    const children = [];
    for (const cn of el.childNodes) {
      if (cn.nodeType === 3) {
        const chars = cn.textContent.replace(/\s+/g, " ").trim();
        if (!chars) continue;
        const rng = document.createRange(); rng.selectNodeContents(cn);
        children.push({ kind: "text", chars, rect: relRect(rng.getBoundingClientRect(), rect) });
      } else if (cn.nodeType === 1) {
        const w = walk(cn, rect); if (w) children.push(w);
      }
    }
    if (children.length) node.children = children;
    return node;
  };
  const rr = root.getBoundingClientRect();
  const tree = walk(root, { left: rr.left, top: rr.top });
  if (!tree) return { error: "block root is display:none" };
  tree.rect.x = 0; tree.rect.y = 0;
  return { root: tree };
}

// Collect every image url referenced in the raw tree: <img> src + any
// background-image url() layers. A light regex — NOT the derive (which parses
// gradients, sizes, positions). We only need the urls so we can fetch bytes.
function collectImageUrls(node, urls) {
  if (node.kind === "text") return;
  if (node.imgSrc) urls.add(node.imgSrc);
  const bi = node.style?.backgroundImage;
  if (bi && bi !== "none") {
    for (const m of bi.matchAll(/url\(["']?(.*?)["']?\)/g)) if (m[1]) urls.add(m[1]);
  }
  for (const c of node.children || []) collectImageUrls(c, urls);
}

// Settle before serializing so every measured box is FINAL: wait for webfonts,
// image decode, and two paint frames — but BOUND each wait. Headless Chrome
// frequently never `complete`s external CDN images (rate-limited/blocked bots), and
// an unbounded img.decode() would stall the whole capture to the 600s protocol
// timeout and crash the run. Bounding lets a slow/blocked asset lapse (the box is
// still measured; it just may be pre-decode) instead of hanging the export.
async function settlePage(page) {
  await page.evaluate(async () => {
    const race = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    try { if (document.fonts && document.fonts.ready) await race(document.fonts.ready, 4000); } catch (e) {}
    try { await race(Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {}))), 5000); } catch (e) {}
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  const outDir = args.out || fileURLToPath(new URL("./out", import.meta.url));
  const t0 = performance.now();
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 600000 });
  try {
    const page = await browser.newPage();
    let { views, widths, pages: allPages } = await readManifest(page, args.url, args.views);
    if (args.fast && views.length > 1) views = views.slice(0, 1);
    const pages = args.pages ? allPages.filter((p) => args.pages.includes(p.id)) : allPages;
    const brand = await readBrandRaw(page);

    // Serialize each unique block × active view; track per-page block order.
    const captured = []; // CapturedBlock[]
    const seen = new Set(); // blockId|view dedupe
    const pagesOut = [];
    for (const pg of pages) {
      const routeFlag = pg.route ? `&${pg.route}` : "";
      const pageBlockList = [];
      for (const view of views) {
        const width = widths[view] ?? FALLBACK_WIDTHS[view] ?? 1440;
        await page.setViewport({ width, height: viewHeight(view), deviceScaleFactor: 2 });
        await page.goto(`${args.url}/?v=${args.variation}${routeFlag}&capture=${view}`, { waitUntil: "networkidle0" });
        await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
        // Settle: fonts swapped, images decoded, two paint frames — so every
        // measured box is FINAL before we serialize geometry.
        await settlePage(page);
        const markers = await page.evaluate(() => [...document.querySelectorAll("[data-block]")].map((el) => ({ blockId: el.getAttribute("data-block"), name: el.getAttribute("data-block-name") || el.getAttribute("data-block") })));
        for (const m of markers) {
          if (!m.blockId) continue;
          if (args.only && !args.only.includes(m.blockId)) continue;
          if (view === views[0] && !pageBlockList.find((b) => b.blockId === m.blockId)) pageBlockList.push({ blockId: m.blockId, name: m.name });
          const key = `${m.blockId}|${view}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const res = await page.evaluate(serializeRaw, m.blockId, CAPTURED_STYLE_PROPS);
          if (res.error) { console.error(`  ! ${m.blockId}/${view}: ${res.error}`); continue; }
          captured.push({ blockId: m.blockId, name: m.name, page: pg.id, route: pg.route, view, root: res.root });
        }
      }
      pagesOut.push({ id: pg.id, name: pg.name, route: pg.route, blocks: pageBlockList });
    }

    // ── Default mobile menu (slide-in drawer). It's global chrome overlaying the
    // surface — not a page section — and only present in the DOM when open, so it's
    // captured in ONE extra pass on the mobile breakpoint with `&menu=open` (which
    // DesignSurface honors by forcing the drawer open). Captured as a standalone
    // block; deliberately NOT added to any page's compose order. Absent for
    // app/brand projects (no MobileMenu) or if a design removes it.
    if (!args.only || args.only.includes("mobile-menu")) {
      const mv = views.includes("mobile") ? "mobile" : views[0];
      const width = widths[mv] ?? FALLBACK_WIDTHS[mv] ?? 370;
      try {
        await page.setViewport({ width, height: viewHeight(mv), deviceScaleFactor: 2 });
        await page.goto(`${args.url}/?v=${args.variation}&capture=${mv}&menu=open`, { waitUntil: "networkidle0" });
        await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
        await settlePage(page);
        const present = await page.evaluate(() => {
          const el = document.querySelector('[data-block="mobile-menu"]');
          if (!el) return false;
          // A full-height drawer is inset to the PAGE-tall surface, so on a long page
          // it measures at PAGE height, not the device viewport (e.g. 6674px on a long
          // home page). Pin it to the viewport so it captures as a device-height drawer
          // — its content scrolls within, exactly as it does live. Taller-than-viewport
          // menu CONTENT still overflows and is clipped to the drawer like the real thing.
          el.style.height = window.innerHeight + "px";
          el.style.maxHeight = window.innerHeight + "px";
          return true;
        });
        if (present) {
          const res = await page.evaluate(serializeRaw, "mobile-menu", CAPTURED_STYLE_PROPS);
          if (res.error) console.error(`  ! mobile-menu/${mv}: ${res.error}`);
          else captured.push({ blockId: "mobile-menu", name: "Mobile Menu", page: pages[0]?.id || "home", route: "", view: mv, root: res.root });
        }
      } catch (e) { console.error(`  ! mobile-menu capture skipped: ${e.message}`); }
    }

    // ── Desktop open menus (dropdown/mega). Discover which nav items reveal a menu
    // (they carry `data-menu-item`), then capture EACH one's open panel as its own
    // block `menu-{id}` from a desktop pass with that item forced open — so varied
    // states (one mega, one dropdown) each show up. Overlay chrome, so never added
    // to page compose. Desktop only (tablet uses the hamburger/mobile drawer).
    if ((!args.only || args.only.includes("menu") || args.only.some((o) => o.startsWith("menu-"))) && views.includes("desktop")) {
      const dw = widths.desktop ?? FALLBACK_WIDTHS.desktop ?? 1440;
      try {
        await page.setViewport({ width: dw, height: viewHeight("desktop"), deviceScaleFactor: 2 });
        await page.goto(`${args.url}/?v=${args.variation}&capture=desktop`, { waitUntil: "networkidle0" });
        await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
        const items = await page.evaluate(() => [...document.querySelectorAll("[data-menu-item]")].map((e) => e.getAttribute("data-menu-item")).filter(Boolean));
        // DEFAULT = just the FIRST menu-bearing item (one representative panel).
        // Building every item's open panel is the slow part of a first export (each
        // is a full load+settle; mega panels are large). Opt in with `--menus all`
        // or `--only menu`; target one with `--only menu-{id}`.
        const specific = (args.only || []).filter((o) => o.startsWith("menu-")).map((o) => o.slice(5));
        const wantAll = args.menus === "all" || (args.only || []).includes("menu");
        const targetItems = specific.length ? items.filter((id) => specific.includes(id)) : (wantAll ? items : items.slice(0, 1));
        if (!specific.length && !wantAll && items.length > 1) console.error(`  · menus: building 1 of ${items.length} (${targetItems[0]}) — run --menus all (or --only menu-{id}) for the rest`);
        for (const id of targetItems) {
          const sel = `menu-${id}`;
          await page.goto(`${args.url}/?v=${args.variation}&capture=desktop&menu=open&item=${encodeURIComponent(id)}`, { waitUntil: "networkidle0" });
          await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
          await settlePage(page);
          const info = await page.evaluate((s) => { const el = document.querySelector(`[data-block="${s}"]`); return el ? { name: el.getAttribute("data-block-name") || s } : null; }, sel);
          if (!info) { console.error(`  ! ${sel}: panel not open`); continue; }
          const res = await page.evaluate(serializeRaw, sel, CAPTURED_STYLE_PROPS);
          if (res.error) { console.error(`  ! ${sel}: ${res.error}`); continue; }
          captured.push({ blockId: sel, name: info.name, page: pages[0]?.id || "home", route: "", view: "desktop", root: res.root });
        }
      } catch (e) { console.error(`  ! desktop menu capture skipped: ${e.message}`); }
    }

    // Download + PNG-reencode every referenced image LOCALLY (bytes never sent to
    // cloud). Dedupe by url → one asset reused across blocks/views.
    const ASSETS = join(outDir, "assets");
    await mkdir(ASSETS, { recursive: true });
    const urls = new Set();
    for (const b of captured) collectImageUrls(b.root, urls);
    const assets = []; // AssetRef[] { name, srcUrl }
    let idx = 0;
    for (const srcUrl of urls) {
      const name = `asset-${idx++}.png`;
      try {
        // Re-encode to PNG in-browser (canvas): Figma's upload renders webp alpha
        // as fully transparent, so normalize every image to PNG first.
        const dataUrl = await page.evaluate(async (url) => {
          // Bound the fetch: a slow/blocked CDN image must not hang the download
          // pass. On timeout the outer try/catch logs + skips this one asset.
          const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("fetch timeout")), ms))]);
          const blob = await withTimeout(fetch(url).then((r) => r.blob()), 15000);
          const bmp = await createImageBitmap(blob);
          const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
          cv.getContext("2d").drawImage(bmp, 0, 0);
          return cv.toDataURL("image/png");
        }, srcUrl);
        const buf = Buffer.from(dataUrl.split(",")[1], "base64");
        await writeFile(join(ASSETS, name), buf);
        assets.push({ name, srcUrl });
      } catch (e) {
        console.error(`  ! asset ${srcUrl}: ${e.message}`);
      }
    }

    const bundle = {
      contract: 1,
      variation: args.variation,
      views, widths,
      brand,
      pages: pagesOut,
      blocks: captured,
      assets,
    };
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, `capture-${args.variation}.json`);
    await writeFile(outPath, JSON.stringify(bundle));
    const uniqueBlocks = new Set(captured.map((b) => b.blockId)).size;
    console.error(`✓ CaptureBundle: ${uniqueBlocks} block(s) × [${views.join(", ")}] (${captured.length} captures), ${assets.length} asset(s), ${Object.keys(brand.colorVars).length} brand var(s) → ${outPath}`);

    // --post: send to the cloud derive, write back the BuildSpec under the name
    // the builder expects (reconstruct-{variation}.json). Bytes stay local: the
    // BuildSpec references assets by name; assets/ holds the PNGs for upload_assets.
    let specPath = null;
    if (args.post) {
      console.error(`  → POST ${(JSON.stringify(bundle).length / 1024).toFixed(0)}KB → ${args.endpoint}`);
      const spec = await postBundle(bundle, args.endpoint, args.key);
      specPath = join(outDir, `reconstruct-${args.variation}.json`);
      await writeFile(specPath, JSON.stringify(spec));
      console.error(`✓ BuildSpec ← cloud: ${spec.blocks?.length ?? 0} block(s), ${spec.brandColors?.length ?? 0} brand colors → ${specPath}`);
    }
    console.error(`  ${((performance.now() - t0) / 1000).toFixed(1)}s.${args.post ? " Next: build via use_figma." : " Next: derive (cloud/--post or offline) → BuildSpec, then build."}`);
    console.log(JSON.stringify({ outPath, specPath, blocks: uniqueBlocks, captures: captured.length, views, assets: assets.length, brandVars: Object.keys(brand.colorVars).length }, null, 2));
  } finally {
    try { await browser.close(); } catch {}
  }
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
