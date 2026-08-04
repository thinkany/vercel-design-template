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
import { performance } from "node:perf_hooks";

// ── Lightweight profiling (opt-in via --timing) ───────────────────────────────
// Prints per-step + phase timings to STDERR so stdout stays clean (the block/page
// flows emit parseable output there). A stopwatch: `const done = mark(); …; done()`
// returns elapsed ms. `TIMING` is a module flag set from args in main().
let TIMING = false;
const nowMs = () => performance.now();
const mark = () => { const s = nowMs(); return () => nowMs() - s; };
const r0 = (n) => Math.round(n);
const terr = (...a) => { if (TIMING) console.error(...a); };
// Sum a list of {step: ms} rows into a per-step total + share, print a table.
function printTimingSummary(title, rows) {
  if (!TIMING || !rows.length) return;
  const steps = rows.reduce((acc, row) => {
    for (const [k, v] of Object.entries(row)) if (typeof v === "number") acc[k] = (acc[k] || 0) + v;
    return acc;
  }, {});
  const grand = Object.values(steps).reduce((a, b) => a + b, 0) || 1;
  console.error(`\n⏱ ${title} — ${rows.length} capture(s), ${r0(grand)}ms total (${(grand / 1000).toFixed(1)}s), avg ${r0(grand / rows.length)}ms/capture`);
  for (const [k, v] of Object.entries(steps).sort((a, b) => b[1] - a[1])) {
    const bar = "█".repeat(Math.max(1, Math.round((v / grand) * 30)));
    console.error(`   ${k.padEnd(10)} ${String(r0(v)).padStart(7)}ms  ${String(Math.round((v / grand) * 100)).padStart(3)}%  ${bar}`);
  }
}

const CAPTURE_JS = "https://mcp.figma.com/mcp/html-to-design/capture.js";
// Fallback widths if the app doesn't expose __PREVIEW_CONFIG__ (kept in sync
// with previewWidths in src/config/site.ts).
const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900; // starting height; full-page capture grabs the rest
// Per-view capture height, matched to the device-frame portrait heights in the
// live preview (PhoneFrame 780, TabletFrame 900, desktop unframed). This keeps
// `min-h-full` content resolving to the SAME device height in the export as in
// the preview — otherwise a full-height mobile section would measure at the flat
// 900 here but 780 in the phone frame, and preview↔Figma would diverge.
const VIEWPORT_HEIGHTS = { desktop: 900, tablet: 900, mobile: 780 };
const viewHeight = (view) => VIEWPORT_HEIGHTS[view] ?? VIEWPORT_HEIGHT;

function parseArgs(argv) {
  const args = { url: "http://localhost:5173", variation: "v00", out: "figma-export", captures: null, views: null, pages: null, blocks: false, timing: false, fast: false };
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--captures") args.captures = argv[++i];
    else if (a === "--views") args.views = list(argv[++i]);
    else if (a === "--pages") args.pages = list(argv[++i]);
    else if (a === "--blocks") args.blocks = true; // removed path — errors with a pointer to export:reconstruct
    else if (a === "--timing") args.timing = true;
    else if (a === "--fast") args.fast = true;
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
      --fast             Capture only the PRIMARY (first active) breakpoint — for
                         fast design iteration (~Nx fewer captures). Final export
                         omits it to get every breakpoint.
      --out <dir>        Dry-run screenshot dir (default: figma-export)
      --captures <file>  Live mode: JSON of { "{page}-{view}": { captureId, endpoint } }
      --timing           Print per-step + phase timings to stderr (profiling)
  -h, --help             Show this help

  This script now does PAGE captures only: dry-run writes one PNG per breakpoint;
  --captures does a live per-page capture. Requires a running dev server.

  BLOCKS are no longer captured here — they are RECONSTRUCTED offline:
    npm run export:reconstruct -- -v {id}   (+ figma-reconstruct-library.plugin.js)

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
      const { fileURLToPath } = await import("node:url");
      // Install into the app's OWN package (where this script resolves puppeteer
      // from), NOT the project cwd — the app-owned tooling runs against a
      // separate project folder, so a cwd install lands where import() can't
      // find it. --prefix targets this script's package root.
      const appRoot = fileURLToPath(new URL("..", import.meta.url));
      execSync(`npm install puppeteer@25.3.0 --no-save --prefix "${appRoot}"`, { stdio: "inherit" });
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

// Fire html.to.design's captureForDesign and return as soon as the /submit POST
// actually completes on the network — DON'T await captureForDesign's own promise,
// which hangs indefinitely after the capture lands (measured: 45s+ every time, the
// dominant cost of the whole export). The capture processes server-side once the
// POST fires; we poll the captureId afterward to collect the node. A bounded
// fallback guards against a missed event (correctness still holds — polling
// confirms), but we wait long enough that we never navigate away mid-submit.
async function submitCapture(page, entry, selector) {
  const submitPath = `/capture/${entry.captureId}/submit`;
  let settle;
  const posted = new Promise((res) => { settle = res; });
  const onResp = (resp) => { if (resp.url().includes(submitPath)) settle(`posted ${resp.status()}`); };
  page.on("response", onResp);
  // Fire-and-forget: the inner promise never settles, so we don't await it here.
  page
    .evaluate(({ captureId, endpoint, sel }) => { window.figma.captureForDesign({ captureId, endpoint, selector: sel }); },
      { captureId: entry.captureId, endpoint: entry.endpoint, sel: selector })
    .catch(() => {});
  const outcome = await Promise.race([
    posted,
    new Promise((r) => setTimeout(() => r("no-post-15s"), 15000)),
  ]);
  page.off("response", onResp);
  return outcome;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  TIMING = args.timing;

  let d = mark();
  const puppeteer = await loadPuppeteer();
  terr(`⏱ puppeteer load: ${r0(d())}ms`);
  const live = Boolean(args.captures);
  let capturesMap = {};
  if (live) {
    capturesMap = JSON.parse(await readFile(args.captures, "utf8"));
  }

  d = mark();
  const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 600000 });
  terr(`⏱ browser launch: ${r0(d())}ms`);
  try {
    const page = await browser.newPage();
    d = mark();
    let { views, widths, pages: allPages } = await readManifest(page, args.url, args.views);
    terr(`⏱ readManifest (initial app load): ${r0(d())}ms`);
    // Fast-iterate: capture only the primary breakpoint (the first active view),
    // whatever it is for this project type (desktop for websites, the first app
    // view for apps). Robust across project types, unlike hardcoding "desktop".
    if (args.fast && views.length > 1) {
      const kept = views.slice(0, 1);
      // stderr, not stdout: discover mode's stdout must stay pure JSON.
      console.error(`--fast: capturing only the primary breakpoint [${kept.join(",")}] of [${views.join(", ")}]`);
      views = kept;
    }
    const pages = args.pages ? allPages.filter((p) => args.pages.includes(p.id)) : allPages;
    if (!pages.length) throw new Error(`No pages matched --pages ${args.pages?.join(",")}`);

    // ── Block mode REMOVED — blocks are now RECONSTRUCTED (not captured). Use
    // `npm run export:reconstruct` + figma-reconstruct-library.plugin.js instead
    // (no html.to.design, no mint/poll). This script now only does PAGE captures. ──
    if (args.blocks) {
      throw new Error("--blocks is removed. Blocks are reconstructed offline now: run `ta-export reconstruct -v {id}` and the figma-reconstruct-library.plugin.js builder. See CLAUDE.md → 'Exporting to Figma as ONE cohesive file'.");
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
        await page.setViewport({ width, height: viewHeight(view), deviceScaleFactor: 2 });
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
          // Resolve on the actual /submit POST, not captureForDesign's hanging
          // promise (see submitCapture). The capture lands server-side; poll to finish.
          const dsub = mark();
          const outcome = await submitCapture(page, entry, "[data-capture-ready]");
          terr(`  ⏱ ${label}: submit ${r0(dsub())}ms [${outcome}]`);
          console.log(`  ✓ ${label}: submitted capture ${entry.captureId} (${outcome}) — poll it to finish`);
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
