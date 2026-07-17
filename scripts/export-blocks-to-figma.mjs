#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-blocks-to-figma.mjs — build the "brand half" of the BLOCK-LIBRARY
 * post-pass manifest.
 *
 * DERIVE-EVERYTHING MODEL (no hand-declared blocks)
 *   Blocks are NOT declared or hand-built anymore. Each block is DERIVED from the
 *   real page: the designer marks a section with `data-block="{id}"` +
 *   `data-block-name="{Name}"`, the capture driver (export-to-figma.mjs --blocks)
 *   discovers those markers live and screenshots each into Figma as an editable
 *   html.to.design layer tree, and the post-pass builder
 *   (figma-block-library.plugin.js, PHASE "blocks") cleans + binds + componentizes
 *   them. See CLAUDE.md → "Exporting to Figma as ONE cohesive file".
 *
 *   So the block LIST is discovered live (from the DOM), not here. THIS script is
 *   the deterministic, offline half that supplies the two brand inputs the
 *   post-pass needs:
 *     • brandColors — the FULL --ta-* palette (name/token/rgb). The builder binds
 *       each captured literal fill to the NEAREST of these, so include every brand
 *       color, not just a curated few.
 *     • fonts       — the --ta-font-* families by role, so the builder can remap a
 *       captured family Figma lacks (a system "Georgia") to the project's real
 *       face, else a role proxy.
 *   It emits figma-export/blocks-{id}.json. Touches no Figma account.
 *
 * VARIATION-AWARE (siloed, like the other exporters)
 *   v00 → src/styles/ ; vNN → src/variations/{id}/styles/ (falls back to base).
 *
 * USAGE
 *   node scripts/export-blocks-to-figma.mjs                 # v00 → figma-export/blocks-v00.json
 *   node scripts/export-blocks-to-figma.mjs -v v01
 *   node scripts/export-blocks-to-figma.mjs --print
 *
 * PREREQUISITE: none beyond the repo (esbuild transpiles brand.ts). Never added to
 *   package.json; never runs on Vercel.
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

// The four --ta-font-* roles, keyed by token so the builder can proxy by role.
const FONT_ROLES = { "--ta-font-display": "display", "--ta-font-serif": "serif", "--ta-font-sans": "sans", "--ta-font-mono": "mono" };

async function buildManifest(variationId) {
  const styleDir = resolveStyleDir(variationId);
  const tokens = await loadTokens(styleDir);

  // FULL brand palette from brand.ts (every group), rgb resolved from tokens.css.
  // The builder binds each captured fill to the nearest of these, so completeness
  // matters more than curation. Falls back to the token's documented value.
  let paletteColors = [];
  try {
    const { brand } = await loadTsModule(join(styleDir, "brand.ts"));
    paletteColors = (brand?.paletteGroups || []).flatMap((g) => g.colors || []);
  } catch { /* no brand.ts in scope → empty palette (builder still runs, binds nothing) */ }

  const seen = new Set();
  const brandColors = [];
  for (const c of paletteColors) {
    if (!c?.token || seen.has(c.token)) continue;
    const hex = tokens[c.token] || c.value;
    if (!hex || !/^#?[0-9a-f]{3,8}$/i.test(String(hex).trim())) continue;
    seen.add(c.token);
    brandColors.push({ name: c.name || c.token.replace(/^--ta-/, ""), token: c.token, hex, rgb: hexRgb(hex) });
  }

  // Font families by role (concrete family or null → builder uses a role proxy).
  const fonts = {};
  for (const [token, role] of Object.entries(FONT_ROLES)) {
    fonts[role] = { family: firstFamily(tokens[token]), role, stack: tokens[token] || "" };
  }

  return {
    variationId,
    brandCollectionName: "Brand",
    blockPageName: "Block Library",
    brandColors,
    fonts,
    // Filled by Claude after the capture step: [{ blockId, name, view, nodeId }].
    // Discover the blocks with: node scripts/export-to-figma.mjs --blocks --discover -v {id}
    captures: [],
    generatedAt: new Date().toISOString(),
    _styleDir: styleDir.replace(ROOT + "/", ""),
  };
}

function printSummary(m) {
  console.log(`\nBlock-library brand manifest — variation ${m.variationId}  (source: ${m._styleDir})`);
  console.log(`  Figma page: "${m.blockPageName}"   ·   variable collection: "${m.brandCollectionName}"`);
  console.log(`  Fonts: ${["display", "serif", "sans", "mono"].map((r) => `${r}=${m.fonts[r]?.family || "(proxy)"}`).join("  ")}`);
  console.log(`  ${m.brandColors.length} brand colors (nearest-match binding targets):`);
  for (const c of m.brandColors) console.log(`    · ${c.name.padEnd(16)} ${c.hex.padEnd(9)} ${c.token}`);
  console.log(`\n  Blocks are DERIVED live from [data-block] markers — none are declared here.`);
  console.log(`  Next: node scripts/export-to-figma.mjs --blocks --discover -v ${m.variationId}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/export-blocks-to-figma.mjs [options]

  -v, --variation <id>   Variation to export (default: v00)
  --out <dir>            Output dir (default: figma-export)
  --print                Print the manifest instead of writing it

Emits figma-export/blocks-{id}.json — the BRAND HALF (colors + fonts) of the
block-library post-pass manifest. Blocks themselves are derived live from
[data-block] markers by export-to-figma.mjs --blocks; Claude records each
capture's node id into the manifest's "captures" before running the builder
(scripts/figma-block-library.plugin.js, PHASE "blocks") via use_figma.`);
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
}

main().catch((e) => {
  console.error("export-blocks-to-figma failed:", e.message);
  process.exit(1);
});
