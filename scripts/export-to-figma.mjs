#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-to-figma.mjs — headless multi-breakpoint capture for the Figma export.
 *
 * WHAT IT DOES
 *   Drives a headless browser to the isolated capture route (`?capture={view}`,
 *   which renders the design surface ONLY — no ViewToggle chrome, no device
 *   bezel), once per ACTIVE breakpoint, at that breakpoint's real viewport
 *   width. The real responsive CSS (clamp / vw / media queries) therefore
 *   reflows against a true viewport, so each capture is the genuine design at
 *   that size — not a div-constrained simulation.
 *
 *   The active breakpoint set is read live from the running app
 *   (`window.__PREVIEW_CONFIG__`, derived from previewConfig in
 *   src/config/site.ts). So Tablet is captured ONLY when VITE_ENABLE_TABLET is
 *   on, Desktop is skipped for `app` projects, etc. — nothing hardcoded here.
 *
 * TWO MODES
 *   • dry-run (default) — screenshots each breakpoint to ./figma-export/*.png.
 *     No Figma account or capture IDs needed. Use this to verify the process
 *     end-to-end on any project copy.
 *   • live (--captures <file.json>) — injects Figma's capture.js and submits a
 *     real capture per breakpoint. The JSON maps each view to a single-use
 *     Figma capture ID + endpoint (minted by the Figma MCP `generate_figma_design`
 *     tool — Claude generates these and writes the file, then runs this script).
 *     After it submits, poll each capture ID via the MCP tool until completed.
 *
 * USAGE
 *   node scripts/export-to-figma.mjs                 # dry-run, v00, localhost:5173
 *   node scripts/export-to-figma.mjs -v v01          # a specific variation
 *   node scripts/export-to-figma.mjs --views desktop,mobile   # override view set
 *   node scripts/export-to-figma.mjs --captures captures.json # live capture
 *
 *   captures.json shape (keyed by "{pageId}-{view}"):
 *     { "home-desktop": { "captureId": "...", "endpoint": "https://mcp.figma.com/mcp/capture/.../submit" },
 *       "home-mobile":  { "captureId": "...", "endpoint": "..." },
 *       "about-mobile": { "captureId": "...", "endpoint": "..." } }
 *
 * PREREQUISITE: none to run manually. puppeteer is auto-installed locally on the
 *   first export (npm i puppeteer --no-save). It is deliberately NOT a project
 *   dependency, so it never installs on Vercel — the deploy never runs this.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const CAPTURE_JS = "https://mcp.figma.com/mcp/html-to-design/capture.js";
// Fallback widths if the app doesn't expose __PREVIEW_CONFIG__ (kept in sync
// with previewWidths in src/config/site.ts).
const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900; // starting height; full-page capture grabs the rest

function parseArgs(argv) {
  const args = { url: "http://localhost:5173", variation: "v00", out: "figma-export", captures: null, views: null, pages: null, blocks: false, discover: false };
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--captures") args.captures = argv[++i];
    else if (a === "--views") args.views = list(argv[++i]);
    else if (a === "--pages") args.pages = list(argv[++i]);
    else if (a === "--blocks") args.blocks = true;
    else if (a === "--discover") args.discover = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function help() {
  console.log(`
export-to-figma — capture each active breakpoint of a design into Figma (or PNGs).

  node scripts/export-to-figma.mjs [options]

  -v, --variation <id>   Variation to export (default: v00)
      --url <url>        Dev server base URL (default: http://localhost:5173)
      --pages <list>     Comma list to limit pages (default: all in the manifest)
      --views <list>     Comma list to override the active set (e.g. desktop,mobile)
      --out <dir>        Dry-run screenshot dir (default: figma-export)
      --captures <file>  Live mode: JSON of { "{page}-{view}": { captureId, endpoint } }
      --blocks           Block-library mode (derive from [data-block] sections)
      --discover         With --blocks: print discovered blocks as JSON (no capture)
  -h, --help             Show this help

  PAGE mode (default): dry-run writes one PNG per breakpoint; --captures does a
  live per-page capture. Requires a running dev server.

  BLOCK mode (--blocks): derive the Block Library from [data-block] markers.
    1. node scripts/export-to-figma.mjs --blocks --discover -v {id}
         → prints [{ blockId, name, page, route, views }] (dedup'd across pages)
    2. Claude mints a Figma captureId per block×view, writes a captures.json keyed
       "{blockId}-{view}" → { captureId, endpoint, route, blockId, view }
    3. node scripts/export-to-figma.mjs --blocks --captures captures.json -v {id}
         → captures each section via html.to.design figmaselector; poll to finish.

  One-time setup: puppeteer auto-installs on first run (npm i -D puppeteer).
`);
}

async function loadPuppeteer() {
  try {
    return (await import("puppeteer")).default;
  } catch {
    // Not installed yet — provision it locally on FIRST export (one-time). This
    // path only runs when you actually export, so puppeteer never enters
    // package.json or the Vercel deploy (which never invokes this script).
    console.log("→ First export: installing puppeteer locally (one-time; downloads a headless Chromium)…\n");
    try {
      const { execSync } = await import("node:child_process");
      execSync("npm install puppeteer@25.3.0 --no-save", { stdio: "inherit" });
    } catch {
      console.error("\n✗ Couldn't auto-install puppeteer. Install it manually, then retry:\n  npm install puppeteer\n");
      process.exit(1);
    }
    try {
      return (await import("puppeteer")).default;
    } catch {
      console.error("\n✗ puppeteer installed but failed to load. Try `npm install puppeteer`, then retry.\n");
      process.exit(1);
    }
  }
}

async function readManifest(page, url, viewsOverride) {
  // Any route sets window.__PREVIEW_CONFIG__ via App's effect; load the app once.
  await page.goto(`${url}/?v=v00`, { waitUntil: "networkidle0" });
  const cfg = await page.evaluate(() => window.__PREVIEW_CONFIG__ ?? null);
  const widths = { ...FALLBACK_WIDTHS, ...(cfg?.widths ?? {}) };
  const views = viewsOverride ?? cfg?.views ?? ["desktop", "mobile"];
  const pages = cfg?.pages?.length ? cfg.pages : [{ id: "home", route: "", name: "Home" }];
  return { views, widths, pages };
}

// ── Block mode: read generic layout INTENT from the live DOM ───────────────────
// html.to.design's DOM→auto-layout conversion drops two things the builder can't
// otherwise recover: (1) it bakes each section's rendered pixel height as a FIXED
// frame height, so a content-sized section ends up with a top-pinned block and a
// void below; (2) it defaults centered content (`mx-auto` / `text-center`) to
// left. We can't change what html.to.design emits, but we CAN read the real
// intent here and hand the builder anchored hints: a root-level `hugHeight` flag
// (unambiguous — the capture root) and a list of `textAlign` entries keyed by the
// text's own content (matched back to Figma TEXT nodes by their characters).
// Runs in the page context; `blockSel` is the section's [data-block] selector.
function extractLayoutHints(blockSel) {
  const root = document.querySelector(blockSel);
  if (!root) return { hugHeight: true, textAlign: [] };
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  // hugHeight: the section is content-sized (the common case) UNLESS it deliberately
  // reserves height beyond its content (e.g. a min-h-screen hero) — those should
  // keep html.to.design's fixed height rather than collapse to content.
  const cs = getComputedStyle(root);
  const minH = parseFloat(cs.minHeight) || 0;
  const wantsFixedHeight = minH > 1 && minH >= root.scrollHeight - 2;
  // textAlign: elements that directly own text and render centered/right — matched
  // later by content, so only non-default (non-left) alignments are worth emitting.
  // Guard against false positives: a nav link or wordmark can compute text-align
  // center incidentally, but its centering is controlled by flex (or is a no-op in
  // a hug-width box) — applying block-centering there would break the row. So skip
  // links/buttons, and skip items whose parent lays out as a horizontal row.
  const textAlign = [];
  const seen = new Set();
  for (const el of root.querySelectorAll("*")) {
    if (el.closest("a, button, [role=button], [role=link]")) continue;
    const direct = norm([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
    if (!direct) continue;
    const a = getComputedStyle(el).textAlign;
    const align = a === "center" ? "center" : (a === "right" || a === "end") ? "right" : null;
    if (!align) continue;
    const pcs = el.parentElement ? getComputedStyle(el.parentElement) : null;
    const parentRow = pcs && (pcs.display === "flex" || pcs.display === "inline-flex") && pcs.flexDirection.startsWith("row");
    if (parentRow) continue; // alignment here is flex-driven, not text-align
    const text = direct.slice(0, 120);
    if (seen.has(text)) continue;
    seen.add(text);
    textAlign.push({ text, align });
  }
  return { hugHeight: !wantsFixedHeight, textAlign };
}

// ── Block mode: discover [data-block] sections live from the rendered DOM ──────
// Blocks are DERIVED, not declared: each section marked `data-block="{id}"` +
// `data-block-name="{Name}"` becomes a block. Dedupe by id across pages (global
// chrome like Header/Footer appears on every page → first page wins).
async function discoverBlocks(page, args, { views, widths, pages }) {
  const width = widths[views[0]] ?? FALLBACK_WIDTHS[views[0]] ?? 1440;
  const seen = new Map();          // unique blocks (each captured once)
  const pagesOut = [];             // per-page ordered block list (for compose)
  for (const pg of pages) {
    const routeFlag = pg.route ? `&${pg.route}` : "";
    await page.setViewport({ width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 2 });
    await page.goto(`${args.url}/?v=${args.variation}${routeFlag}&capture=${views[0]}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
    // DOM order = the section stacking order (what the composed page will use).
    const found = await page.evaluate(() =>
      [...document.querySelectorAll("[data-block]")].map((el) => ({
        blockId: el.getAttribute("data-block"),
        name: el.getAttribute("data-block-name") || el.getAttribute("data-block"),
      }))
    );
    const pageBlocks = found.filter((f) => f.blockId);
    for (const f of pageBlocks) {
      if (seen.has(f.blockId)) continue;
      // Read layout intent from this section's live DOM (hugHeight + centered text)
      // so the builder can repair html.to.design's conversion losses. Computed at
      // views[0]; alignment/height intent is stable across breakpoints here.
      const layout = await page.evaluate(extractLayoutHints, `[data-block="${f.blockId}"]`);
      seen.set(f.blockId, { blockId: f.blockId, name: f.name, page: pg.id, route: pg.route, views, layout });
    }
    pagesOut.push({ id: pg.id, name: pg.name, route: pg.route, blocks: pageBlocks.map((f) => ({ blockId: f.blockId, name: f.name })) });
  }
  // blocks → what to capture (once each); pages → how to compose (order per page).
  return { blocks: [...seen.values()], pages: pagesOut, views, widths };
}

// ── Block mode: capture each block × breakpoint via html.to.design figmaselector ─
// capturesMap is keyed "{blockId}-{view}" → { captureId, endpoint, route, blockId, view }.
async function captureBlocks(page, args, { widths }, capturesMap) {
  for (const [key, entry] of Object.entries(capturesMap)) {
    const blockId = entry.blockId || key.replace(/-[^-]+$/, "");
    const view = entry.view || key.slice(key.lastIndexOf("-") + 1);
    if (!entry.captureId || !entry.endpoint) { console.warn(`  · ${key}: missing captureId/endpoint — skipped`); continue; }
    const width = widths[view] ?? FALLBACK_WIDTHS[view] ?? 1440;
    const routeFlag = entry.route ? `&${entry.route}` : "";
    const selector = `[data-block="${blockId}"]`;
    await page.setViewport({ width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 2 });
    await page.goto(`${args.url}/?v=${args.variation}${routeFlag}&capture=${view}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });
    await page.waitForSelector(selector, { timeout: 15000 });
    await page.addScriptTag({ url: CAPTURE_JS });
    await page.waitForFunction(() => typeof window.figma?.captureForDesign === "function", { timeout: 15000 });
    // Same raced submit as the page flow: captureForDesign can hang after the
    // capture lands, so bound it and rely on polling the ID to confirm.
    const outcome = await Promise.race([
      page.evaluate(async ({ captureId, endpoint, sel }) => window.figma.captureForDesign({ captureId, endpoint, selector: sel }), { captureId: entry.captureId, endpoint: entry.endpoint, sel: selector })
        .then(() => "returned").catch((e) => `error: ${e?.message || e}`),
      new Promise((r) => setTimeout(() => r("timeout"), 45000)),
    ]);
    const ok = outcome === "timeout" || outcome === "returned";
    console.log(`  ${ok ? "✓" : "!"} ${key} (${width}px, selector ${selector}): capture ${entry.captureId} ${outcome} — poll to confirm`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();

  const puppeteer = await loadPuppeteer();
  const live = Boolean(args.captures);
  let capturesMap = {};
  if (live) {
    capturesMap = JSON.parse(await readFile(args.captures, "utf8"));
  }

  const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 600000 });
  try {
    const page = await browser.newPage();
    const { views, widths, pages: allPages } = await readManifest(page, args.url, args.views);
    const pages = args.pages ? allPages.filter((p) => args.pages.includes(p.id)) : allPages;
    if (!pages.length) throw new Error(`No pages matched --pages ${args.pages?.join(",")}`);

    // ── Block mode (derive-everything block library) — short-circuits page flow ──
    if (args.blocks && args.discover) {
      const result = await discoverBlocks(page, args, { views, widths, pages });
      // Summary → stderr so stdout stays clean, parseable JSON for Claude.
      console.error(`Discovered ${result.blocks.length} unique block(s) across ${result.pages.length} page(s): [${result.blocks.map((b) => b.blockId).join(", ")}] × [${views.join(", ")}]`);
      console.error(`  { blocks: capture each once · pages: per-page order for compose · views/widths }`);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.blocks) {
      if (!live) throw new Error('--blocks capture needs --captures <file.json> (keyed "{blockId}-{view}"). Discover first with --blocks --discover.');
      console.error(`Capturing ${Object.keys(capturesMap).length} block×breakpoint capture(s) (variation ${args.variation})`);
      await captureBlocks(page, args, { widths }, capturesMap);
      console.log("\nAll block captures submitted. Poll each capture ID via the Figma MCP until 'completed', then record each resulting node id into the manifest's captures[] before running the builder.");
      return;
    }

    console.log(
      `Exporting ${pages.length} page(s) × ${views.length} breakpoint(s): ` +
        `[${pages.map((p) => p.id).join(", ")}] × [${views.join(", ")}]  ` +
        `(variation ${args.variation}, ${live ? "LIVE" : "dry-run"})`
    );

    if (!live) await mkdir(args.out, { recursive: true });

    for (const pg of pages) {
      const routeFlag = pg.route ? `&${pg.route}` : "";
      for (const view of views) {
        const width = widths[view] ?? FALLBACK_WIDTHS[view] ?? 1440;
        await page.setViewport({ width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 2 });
        const target = `${args.url}/?v=${args.variation}${routeFlag}&capture=${view}`;
        await page.goto(target, { waitUntil: "networkidle0" });
        await page.waitForSelector("[data-capture-ready]", { timeout: 15000 });

        const label = `${pg.id}/${view} (${width}px)`;
        if (live) {
          const entry = capturesMap[`${pg.id}-${view}`];
          if (!entry?.captureId || !entry?.endpoint) {
            console.warn(`  · ${label}: no captureId/endpoint for "${pg.id}-${view}" in ${args.captures} — skipped`);
            continue;
          }
          await page.addScriptTag({ url: CAPTURE_JS });
          await page.waitForFunction(() => typeof window.figma?.captureForDesign === "function", { timeout: 15000 });
          // captureForDesign fires the submit request, but its returned promise can
          // hang after the capture actually lands (a known flakiness). Awaiting it
          // directly would stall the next view and teardown, so race it against a
          // bounded timeout — the capture still submits; poll the ID to confirm.
          const outcome = await Promise.race([
            page
              .evaluate(
                async ({ captureId, endpoint }) =>
                  window.figma.captureForDesign({ captureId, endpoint, selector: "[data-capture-ready]" }),
                entry
              )
              .then(() => "returned")
              .catch((e) => `error: ${e?.message || e}`),
            new Promise((r) => setTimeout(() => r("timeout"), 45000)),
          ]);
          if (outcome === "timeout") {
            console.log(`  ✓ ${label}: capture ${entry.captureId} submitted (serialize didn't return in 45s — poll to confirm)`);
          } else if (String(outcome).startsWith("error")) {
            console.warn(`  ! ${label}: capture ${entry.captureId} ${outcome} (poll to confirm it landed)`);
          } else {
            console.log(`  ✓ ${label}: submitted capture ${entry.captureId} — poll it to finish`);
          }
        } else {
          const file = join(args.out, `${args.variation}-${pg.id}-${view}-${width}w.png`);
          const png = await page.screenshot({ fullPage: true });
          await writeFile(file, png);
          console.log(`  ✓ ${label}: ${file}`);
        }
      }
    }

    if (live) {
      console.log("\nAll captures submitted. Poll each capture ID via the Figma MCP until 'completed'.");
    } else {
      console.log(`\nDone. Review the PNGs in ./${args.out} to confirm each page/breakpoint reflows correctly.`);
    }
  } finally {
    // Swallow teardown errors: a dangling capture evaluate can make close() emit a
    // ProtocolError even though every capture already submitted.
    try { await browser.close(); } catch { /* ignore teardown noise */ }
  }
}

// Force an explicit exit — puppeteer can leave a lingering handle after a raced
// capture evaluate, which would otherwise keep the process alive indefinitely.
main().then(
  () => process.exit(0),
  (err) => { console.error(err); process.exit(1); }
);
