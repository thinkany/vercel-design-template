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
 * PREREQUISITE: puppeteer — ships as an `optionalDependencies` entry in
 *   package.json, so a local `npm install` pulls it in (downloading a headless
 *   Chromium once). The Vercel deploy skips it (installCommand uses
 *   --no-optional), so it never touches the client-facing build.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const CAPTURE_JS = "https://mcp.figma.com/mcp/html-to-design/capture.js";
// Fallback widths if the app doesn't expose __PREVIEW_CONFIG__ (kept in sync
// with previewWidths in src/config/site.ts).
const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900; // starting height; full-page capture grabs the rest

function parseArgs(argv) {
  const args = { url: "http://localhost:5173", variation: "v00", out: "figma-export", captures: null, views: null, pages: null };
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--captures") args.captures = argv[++i];
    else if (a === "--views") args.views = list(argv[++i]);
    else if (a === "--pages") args.pages = list(argv[++i]);
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
  -h, --help             Show this help

  Default (no --captures) is dry-run: writes one PNG per breakpoint. Requires a
  running dev server. One-time setup: npm i -D puppeteer
`);
}

async function loadPuppeteer() {
  try {
    return (await import("puppeteer")).default;
  } catch {
    console.error(
      "\n✗ puppeteer is not installed (it ships as an optional dependency).\n" +
        "  Run `npm install` to pull it in, then retry.\n"
    );
    process.exit(1);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();

  const puppeteer = await loadPuppeteer();
  const live = Boolean(args.captures);
  let capturesMap = {};
  if (live) {
    capturesMap = JSON.parse(await readFile(args.captures, "utf8"));
  }

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    const { views, widths, pages: allPages } = await readManifest(page, args.url, args.views);
    const pages = args.pages ? allPages.filter((p) => args.pages.includes(p.id)) : allPages;
    if (!pages.length) throw new Error(`No pages matched --pages ${args.pages?.join(",")}`);
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
          await page.evaluate(
            async ({ captureId, endpoint }) =>
              window.figma.captureForDesign({ captureId, endpoint, selector: "[data-capture-ready]" }),
            entry
          );
          console.log(`  ✓ ${label}: submitted capture ${entry.captureId} — poll it to finish`);
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
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
