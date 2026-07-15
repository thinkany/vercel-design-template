#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-blocks-to-figma.mjs — build the BLOCK-LIBRARY MANIFEST for the Figma
 * "Block Library" page export.
 *
 * WHAT IT DOES
 *   Reads the blocks declared in src/app/blocks.ts + the brand colors/fonts they
 *   consume (from tokens.css) + the client name (from .env), resolves each into a
 *   normalized JSON manifest, and emits figma-export/blocks-{id}.json. That
 *   manifest is what the Figma builder (scripts/figma-block-library.plugin.js)
 *   turns into real, editable Figma component SETS (one variant per block state),
 *   with fills bound to a "Brand" variable collection.
 *
 *   This is the DETERMINISTIC, offline half — it touches no Figma account. It is
 *   the SECTION-level sibling of export-library-to-figma.mjs (atoms): that reads
 *   cva variant matrices; this reads declared section blocks. Blocks are
 *   structural, so the builder holds the per-block construction; this manifest
 *   supplies the data (colors, fonts, nav items, per-state geometry).
 *
 * VARIATION-AWARE (siloed, like the other exporters)
 *   v00 → src/styles/tokens.css ; vNN → src/variations/{id}/styles/tokens.css.
 *
 * USAGE
 *   node scripts/export-blocks-to-figma.mjs                 # v00 → figma-export/blocks-v00.json
 *   node scripts/export-blocks-to-figma.mjs -v v01
 *   node scripts/export-blocks-to-figma.mjs --print
 *
 * PREREQUISITE: none beyond the repo (esbuild, a Vite dep, transpiles the TS
 *   manifests). Never added to package.json; never runs on Vercel.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

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

function resolveStyleDir(variationId) {
  if (variationId !== "v00") {
    const varDir = join(ROOT, "src", "variations", variationId, "styles");
    if (existsSync(join(varDir, "tokens.css"))) return varDir;
  }
  return join(ROOT, "src", "styles");
}

// TS module (types-only imports) → object, via esbuild transpile + dynamic import.
async function loadTsModule(tsPath) {
  const src = await readFile(tsPath, "utf8");
  const esbuild = await import("esbuild");
  const { code } = await esbuild.transform(src, { loader: "ts", format: "esm" });
  const tmp = join(tmpdir(), `ta-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(tmp, code, "utf8");
  return import(pathToFileURL(tmp).href);
}

async function loadTokens(styleDir) {
  const css = await readFile(join(styleDir, "tokens.css"), "utf8");
  const map = {};
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const scope = rootMatch ? rootMatch[1] : css;
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(scope))) map[m[1].trim()] = m[2].trim();
  return map;
}

// Brand colors are hex in tokens.css → {r,g,b} in 0..1.
function hexRgb(hex) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}

// First concrete family in a CSS stack (skip generics), else null → builder proxy.
const GENERIC = new Set(["system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "sans-serif", "serif", "monospace", "georgia", "'times new roman'", "menlo", "'sfmono-regular'"]);
function firstFamily(stack) {
  const first = (stack || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  if (!first || GENERIC.has(first.toLowerCase())) return null;
  return first;
}

// Read a VITE_ var straight from .env (public brand config; no secrets there).
async function readEnvVar(name) {
  try {
    const env = await readFile(join(ROOT, ".env"), "utf8");
    const m = env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]*)"?`, "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

// The --ta-* brand colors the blocks bind to (Header: cream/ink/gray-dark;
// Footer adds gray-mid; Hero adds gray-mid + amber).
const BRAND_TOKENS = [
  { name: "cream", token: "--ta-cream" },
  { name: "ink", token: "--ta-ink" },
  { name: "gray-dark", token: "--ta-gray-dark" },
  { name: "gray-mid", token: "--ta-gray-mid" },
  { name: "amber", token: "--ta-amber" },
];

async function buildManifest(variationId) {
  const styleDir = resolveStyleDir(variationId);
  const tokens = await loadTokens(styleDir);
  const { blocks } = await loadTsModule(join(ROOT, "src", "app", "blocks.ts"));
  const { designPages } = await loadTsModule(join(ROOT, "src", "app", "pages.ts"));
  const clientName = (await readEnvVar("VITE_CLIENT_NAME")) || "Client Name";
  const projectName = await readEnvVar("VITE_PROJECT_NAME");

  const brandColors = BRAND_TOKENS
    .filter((b) => tokens[b.token])
    .map((b) => ({ name: b.name, token: b.token, hex: tokens[b.token], rgb: hexRgb(tokens[b.token]) }));

  const pageNavNames = designPages.map((p) => p.name);
  const outBlocks = blocks.map((b) => ({
    id: b.id,
    name: b.name,
    component: b.component,
    implemented: b.implemented,
    navItems: b.navSource === "pages" ? pageNavNames : b.navSource,
    states: b.states,
  }));

  return {
    variationId,
    brandCollectionName: "Brand",
    blockPageName: "Block Library",
    logoText: clientName,
    projectName,
    fonts: {
      display: { stack: tokens["--ta-font-display"] || "", family: firstFamily(tokens["--ta-font-display"]) },
      serif: { stack: tokens["--ta-font-serif"] || "", family: firstFamily(tokens["--ta-font-serif"]) },
      sans: { stack: tokens["--ta-font-sans"] || "", family: firstFamily(tokens["--ta-font-sans"]) },
    },
    brandColors,
    blocks: outBlocks,
    generatedAt: new Date().toISOString(),
    _styleDir: styleDir.replace(ROOT + "/", ""),
  };
}

function printSummary(m) {
  console.log(`\nBlock-library manifest — variation ${m.variationId}  (source: ${m._styleDir})`);
  console.log(`  Figma page: "${m.blockPageName}"   ·   variable collection: "${m.brandCollectionName}"`);
  console.log(`  Logo text: "${m.logoText}"   Project: "${m.projectName}"`);
  console.log(`  Fonts: display=${m.fonts.display.family || "(proxy)"}  serif=${m.fonts.serif.family || "(proxy)"}  sans=${m.fonts.sans.family || "(proxy)"}`);
  console.log(`  ${m.brandColors.length} brand variables → collection "${m.brandCollectionName}":`);
  for (const c of m.brandColors) console.log(`    · ${c.name.padEnd(11)} ${c.hex.padEnd(9)} ${c.token}`);
  console.log(`\n  ${m.blocks.length} blocks:`);
  for (const b of m.blocks) {
    const flag = b.implemented ? "✓ implemented" : "· scaffold";
    console.log(`    ▸ ${b.name.padEnd(10)} ${flag}   states: ${b.states.map((s) => s.name).join(", ")}`);
    console.log(`      nav: ${b.navItems.join(", ") || "(none)"}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/export-blocks-to-figma.mjs [options]

  -v, --variation <id>   Variation to export (default: v00)
  --out <dir>            Output dir (default: figma-export)
  --print                Print the manifest instead of writing it

Emits figma-export/blocks-{id}.json — the block manifest Claude feeds to the
Figma builder (scripts/figma-block-library.plugin.js, PHASE "blocks") via use_figma.`);
    return;
  }

  const manifest = await buildManifest(args.variation);
  printSummary(manifest);

  if (args.print) {
    console.log("\n" + JSON.stringify(manifest, null, 2));
    return;
  }
  await mkdir(join(ROOT, args.out), { recursive: true });
  const outPath = join(ROOT, args.out, `blocks-${args.variation}.json`);
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`\n→ wrote ${args.out}/blocks-${args.variation}.json`);
  console.log("  Next (live): Claude reads this manifest and runs the Figma builder");
  console.log("  (scripts/figma-block-library.plugin.js, PHASE \"blocks\") via use_figma.");
}

main().catch((e) => {
  console.error("export-blocks-to-figma failed:", e.message);
  process.exit(1);
});
