#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-brand-to-figma.mjs — build the BRAND MANIFEST for the Figma styleguide
 * library export.
 *
 * WHAT IT DOES
 *   Reads a variation's design tokens straight from source — `brand.ts` (the
 *   human manifest: names, roles, order, type samples) + `tokens.css` (the live
 *   `--ta-*` / `--ta-font-*` values) — and emits ONE normalized JSON manifest of
 *   colors + type roles. That manifest is what the Figma builder
 *   (scripts/figma-brand-library.plugin.js) turns into real Figma **variables**,
 *   **text styles**, and a **specimen frame**.
 *
 *   This is the DETERMINISTIC, offline half — it touches no Figma account. It is
 *   the sibling of scripts/export-to-figma.mjs: that one screenshots *designs*;
 *   this one describes the *design system*. They are separate export paths.
 *
 * WHY A SEPARATE STEP
 *   Figma writes happen through the Figma MCP (`use_figma`), which only Claude
 *   can drive — a plain `npm run` can't. So the split mirrors the page export's
 *   "live send": this script produces inspectable data; Claude reads it and
 *   orchestrates the MCP builder. See CLAUDE.md → "Exporting the brand to Figma".
 *
 * VARIATION-AWARE (siloed, like resolveBrand)
 *   v00 → src/styles/{brand.ts,tokens.css}
 *   vNN → src/variations/{id}/styles/{brand.ts,tokens.css} (falls back to base
 *         if a variation has no styles/ of its own).
 *
 * USAGE
 *   node scripts/export-brand-to-figma.mjs                 # v00 → figma-export/brand-v00.json
 *   node scripts/export-brand-to-figma.mjs -v v01          # a specific variation
 *   node scripts/export-brand-to-figma.mjs --out some/dir  # override output dir
 *   node scripts/export-brand-to-figma.mjs --print         # print manifest, don't write
 *
 * FILE REGISTRY (remember one Figma file per variation, so re-exports UPDATE it):
 *   ... --record --file-key <key|/design/ URL> [--file-url <u>] [--file-name <n>]
 *   ... --forget                               # drop this variation's mapping
 *   The default run reports the recorded file as manifest.existingFile.
 *
 * DESTINATION (where NEW files are created — team vs individual; project-wide):
 *   ... --set-target --scope individual --plan <planKey> [--plan-name <n>]
 *   ... --set-target --scope team --plan <planKey> --project <url> [--plan-name <n>]
 *   ... --forget-target
 *   The default run reports it as manifest.target. Editor-seat filtering of teams
 *   happens at orchestration time (Claude reads Figma whoami) — see CLAUDE.md.
 *
 * PREREQUISITE: none beyond the repo's own devDeps — esbuild (a Vite dep, always
 *   present locally) is used to transpile brand.ts. Nothing is added to
 *   package.json and this never runs on Vercel.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function parseArgs(argv) {
  const args = {
    variation: "v00", out: "figma-export", print: false,
    record: false, forget: false, fileKey: null, fileUrl: null, fileName: null,
    setTarget: false, forgetTarget: false, scope: null, plan: null, planName: null, project: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--print") args.print = true;
    else if (a === "--record") args.record = true;
    else if (a === "--forget") args.forget = true;
    else if (a === "--file-key") args.fileKey = argv[++i];
    else if (a === "--file-url") args.fileUrl = argv[++i];
    else if (a === "--file-name") args.fileName = argv[++i];
    else if (a === "--set-target") args.setTarget = true;
    else if (a === "--forget-target") args.forgetTarget = true;
    else if (a === "--scope") args.scope = argv[++i];
    else if (a === "--plan") args.plan = argv[++i];
    else if (a === "--plan-name") args.planName = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

// ── Figma file registry — one file per variation, remembered across exports ───
// Maps variationId → the Figma file it was exported to, so re-exports UPDATE that
// file in place instead of spawning a duplicate. Lives in the (git-ignored)
// output dir; personal to this checkout (fileKeys point at the user's drafts).
// Claude records a key after create_new_file, and reads it back before the next
// export (verifying the file still exists via the Figma MCP before reusing).
function registryPath(outDir) {
  return join(ROOT, outDir, "figma-files.json");
}
async function readRegistry(outDir) {
  try {
    return JSON.parse(await readFile(registryPath(outDir), "utf8"));
  } catch {
    return {};
  }
}
async function writeRegistry(outDir, reg) {
  await mkdir(join(ROOT, outDir), { recursive: true });
  await writeFile(registryPath(outDir), JSON.stringify(reg, null, 2) + "\n", "utf8");
}
// Derive a fileKey from a Figma /design/ URL if a full URL was passed.
function keyFromUrl(url) {
  const m = String(url || "").match(/\/design\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

// ── Export destination — WHERE new files are created (team vs individual) ──────
// A project-wide (not per-variation) choice, remembered so it's set once. Claude
// resolves the eligible team(s) from the Figma `whoami` (filtered to EDITOR seats
// — View/Dev seats can't author files) and, for a shared team project, a project
// URL; then records it here. On the next export, new files are created with this
// `planKey` (+ `projectId` for a shared folder). Reused files keep their own home.
function targetPath(outDir) {
  return join(ROOT, outDir, "figma-target.json");
}
async function readTarget(outDir) {
  try {
    return JSON.parse(await readFile(targetPath(outDir), "utf8"));
  } catch {
    return null;
  }
}
async function writeTarget(outDir, target) {
  await mkdir(join(ROOT, outDir), { recursive: true });
  await writeFile(targetPath(outDir), JSON.stringify(target, null, 2) + "\n", "utf8");
}
// Extract a numeric projectId from a Figma project URL, e.g.
//   figma.com/files/project/:id · /files/:org/project/:id · /files/team/:t/project/:id
function projectIdFromUrl(url) {
  const m = String(url || "").match(/project\/(\d+)/);
  return m ? m[1] : (/^\d+$/.test(String(url || "").trim()) ? String(url).trim() : null);
}

// ── Source resolution (mirrors src/app/brandRegistry.ts siloing) ──────────────
function resolveStyleDir(variationId) {
  if (variationId !== "v00") {
    const varDir = join(ROOT, "src", "variations", variationId, "styles");
    if (existsSync(join(varDir, "brand.ts")) && existsSync(join(varDir, "tokens.css"))) {
      return varDir;
    }
    // Fall back to base (variation hasn't diverged its styles/ yet).
  }
  return join(ROOT, "src", "styles");
}

// ── TS module → object (esbuild transpile, then dynamic import) ───────────────
// brand.ts / pages.ts import nothing at runtime (types only), so the transpiled
// module is self-contained — write to a temp .mjs and import it.
async function loadTsModule(tsPath) {
  const src = await readFile(tsPath, "utf8");
  const esbuild = await import("esbuild");
  const { code } = await esbuild.transform(src, { loader: "ts", format: "esm" });
  const tmp = join(tmpdir(), `ta-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(tmp, code, "utf8");
  return import(pathToFileURL(tmp).href);
}

async function loadBrand(styleDir) {
  const tsPath = join(styleDir, "brand.ts");
  const mod = await loadTsModule(tsPath);
  if (!mod.brand) throw new Error(`brand.ts at ${tsPath} has no \`brand\` export`);
  return mod.brand;
}

// The design-pages manifest is app-level (src/app/pages.ts), shared across all
// variations — a variation overrides page COMPONENTS, not the page list.
async function loadDesignPages() {
  const mod = await loadTsModule(join(ROOT, "src", "app", "pages.ts"));
  return (mod.designPages || []).map((p) => ({ id: p.id, name: p.name, route: p.route }));
}

// ── tokens.css → { "--ta-*": value } (only the project brand namespace) ───────
async function loadTokens(styleDir) {
  const css = await readFile(join(styleDir, "tokens.css"), "utf8");
  const map = {};
  const re = /(--ta-[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) map[m[1].trim()] = m[2].trim();
  return map;
}

// ── Derivations ───────────────────────────────────────────────────────────────

// Figma variable scopes, inferred from the token's role text. Never ALL_SCOPES.
function scopesForColor(role) {
  const r = (role || "").toLowerCase();
  const scopes = new Set();
  if (/back|fill|wash|surface/.test(r)) { scopes.add("FRAME_FILL"); scopes.add("SHAPE_FILL"); }
  if (/text|head|body|caption|byline|metadata|timestamp|label/.test(r)) scopes.add("TEXT_FILL");
  if (/border|divider|separat|stroke|rule/.test(r)) { scopes.add("STROKE_COLOR"); scopes.add("FRAME_FILL"); scopes.add("SHAPE_FILL"); }
  if (/link|nav|accent|badge|alert|rating|button|active|brand/.test(r)) {
    scopes.add("FRAME_FILL"); scopes.add("SHAPE_FILL"); scopes.add("TEXT_FILL"); scopes.add("STROKE_COLOR");
  }
  if (scopes.size === 0) { scopes.add("FRAME_FILL"); scopes.add("SHAPE_FILL"); scopes.add("TEXT_FILL"); }
  return [...scopes];
}

// Generic CSS families that don't name a real typeface → need a Figma proxy.
const GENERIC_FAMILIES = new Set([
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
  "-apple-system", "blinkmacsystemfont", "sans-serif", "serif", "monospace",
  "cursive", "fantasy", "emoji", "math", "fangsong", "inherit", "initial",
]);
// Real families that exist on the web but usually NOT in Figma's font list.
const NOT_IN_FIGMA = new Set(["georgia", "times new roman", "segoe ui", "helvetica", "helvetica neue", "-apple-system"]);
// Role → a Figma-available proxy face (verified present in the target file at
// build time; the builder does the final availability check + fallback).
const ROLE_PROXY = { display: "Playfair Display", serif: "Lora", sans: "Inter", mono: "JetBrains Mono" };
// Default specimen ramp per role.
const ROLE_RAMP = {
  display: { style: "Bold", size: 48, lineHeight: 1.05 },
  serif: { style: "Regular", size: 18, lineHeight: 1.6 },
  sans: { style: "Regular", size: 15, lineHeight: 1.5 },
  mono: { style: "Regular", size: 14, lineHeight: 1.5 },
};

function roleKey(fontName) {
  const n = (fontName || "").toLowerCase();
  if (n.includes("display")) return "display";
  if (n.includes("serif")) return "serif";
  if (n.includes("mono")) return "mono";
  return "sans";
}

// First concrete family in a CSS stack, or null if the stack leads with a generic.
function requestedFamily(stack) {
  const first = (stack || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  if (!first) return null;
  const key = first.toLowerCase();
  if (GENERIC_FAMILIES.has(key) || NOT_IN_FIGMA.has(key)) return null;
  return first;
}

// ── File structure (mirrors the target Figma Pages panel) ─────────────────────
// Order: design pages → separator → Styleguide → scaffolded sections.
const STYLEGUIDE_PAGE = "Styleguide";
const SEPARATOR = "———";
// Sections we scaffold as titled cover Pages for now (built out in a later
// iteration). Keep in sync with the CLAUDE.md export-flow docs.
const SCAFFOLD_SECTIONS = [
  { name: "Block Library", blurb: "Reusable page sections (Header, Footer, hero, cards…). Scaffold — captured from the app's shared blocks in a later iteration." },
  { name: "Components", blurb: "UI components mapped from the shadcn/ui + cva code. Scaffold — generated as Figma component sets in a later iteration." },
];

// ── Build the manifest ────────────────────────────────────────────────────────
function buildManifest(variationId, brand, tokens, designPages) {
  const colors = [];
  for (const group of brand.paletteGroups || []) {
    for (const c of group.colors || []) {
      colors.push({
        figmaName: `${group.title}/${c.name}`,
        name: c.name,
        group: group.title,
        token: c.token,
        // tokens.css is the live source of truth; brand.ts value is the fallback.
        hex: (tokens[c.token] || c.value || "#000000").trim(),
        role: c.role || "",
        scopes: scopesForColor(c.role),
      });
    }
  }
  const fonts = [];
  for (const f of brand.fonts || []) {
    const key = roleKey(f.name);
    const stack = (tokens[f.token] || f.stack || "").trim();
    const ramp = ROLE_RAMP[key];
    fonts.push({
      figmaName: `Type/${f.name}`,
      name: f.name,
      role: f.role || "",
      token: f.token,
      stack,
      requestedFamily: requestedFamily(stack), // null → use proxy
      proxyFamily: ROLE_PROXY[key],
      isProxy: requestedFamily(stack) === null,
      style: ramp.style,
      size: ramp.size,
      lineHeight: ramp.lineHeight,
      sample: f.sample || "The quick brown fox jumps over the lazy dog.",
    });
  }
  return {
    variationId,
    collectionName: "Brand",
    specimenFrameName: "Brand Library — Foundations",
    // Figma file structure (Pages panel), in order.
    styleguidePageName: STYLEGUIDE_PAGE,
    separatorName: SEPARATOR,
    designPages, // [{ id, name, route }] → one Figma Page each, named by `name`
    scaffoldSections: SCAFFOLD_SECTIONS, // titled cover Pages after the styleguide
    generatedAt: new Date().toISOString(),
    colors,
    fonts,
  };
}

function printSummary(m, styleDir) {
  const rel = styleDir.replace(ROOT + "/", "");
  console.log(`\nBrand manifest — variation ${m.variationId}  (source: ${rel})`);
  if (m.existingFile?.fileKey) {
    console.log(`\n  ↻ Recorded Figma file for ${m.variationId}: ${m.existingFile.fileUrl || m.existingFile.fileKey}`);
    console.log(`    Reuse it (update in place) unless the user wants a new one.`);
  } else {
    console.log(`\n  ✎ No Figma file recorded for ${m.variationId} yet — a new one will be`);
    console.log(`    created and recorded (npm run export:brand -- --record …).`);
  }
  if (m.target?.planKey) {
    const where = m.target.scope === "team"
      ? `team ${m.target.planName || m.target.planKey}${m.target.projectId ? ` · project ${m.target.projectId}` : " · drafts (no project set)"}`
      : `individual drafts (${m.target.planName || m.target.planKey})`;
    console.log(`  ⌂ New files go to: ${where}`);
  } else {
    console.log(`  ⌂ No export destination set — Claude will ask (Individual vs Team)`);
    console.log(`    and record it (npm run export:brand -- --set-target …).`);
  }
  console.log(`\n  Figma file structure (one file for this variation):`);
  for (const p of m.designPages) console.log(`    ▸ ${p.name}   (Page — design frames per breakpoint)`);
  console.log(`    ${m.separatorName}`);
  console.log(`    ▸ ${m.styleguidePageName}   (Page — colors + type + specimen)`);
  for (const s of m.scaffoldSections) console.log(`    ▸ ${s.name}   (Page — scaffold)`);
  console.log(`\n  ${m.colors.length} colors → Figma variables (collection "${m.collectionName}")`);
  for (const c of m.colors) console.log(`    · ${c.figmaName.padEnd(28)} ${c.hex.padEnd(9)} ${c.token}`);
  console.log(`  ${m.fonts.length} type roles → Figma text styles`);
  for (const f of m.fonts) {
    const fam = f.requestedFamily || `${f.proxyFamily} (proxy)`;
    console.log(`    · ${f.figmaName.padEnd(16)} ${fam.padEnd(24)} ${f.token}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/export-brand-to-figma.mjs [options]

  -v, --variation <id>   Variation to export (default: v00)
  --out <dir>            Output dir (default: figma-export)
  --print                Print the manifest instead of writing it

  File registry (remember one Figma file per variation):
  --record --file-key <k> [--file-url <u>] [--file-name <n>]
                         Record the Figma file this variation exports to, so the
                         next export updates it in place. Accepts a full /design/
                         URL as --file-key too. Run after create_new_file.
  --forget               Remove this variation's recorded file.

  Export destination (where NEW files are created; project-wide):
  --set-target --scope individual --plan <planKey> [--plan-name <n>]
  --set-target --scope team --plan <planKey> [--plan-name <n>] --project <url>
                         Remember where new files go. planKey comes from Figma
                         whoami; --project is a Figma project/folder URL (its
                         numeric id is extracted) for shared team visibility.
  --forget-target        Clear the destination (Claude will ask again).`);
    return;
  }

  // Destination bookkeeping modes — no manifest generation.
  if (args.forgetTarget) {
    const t = await readTarget(args.out);
    if (t) { await writeFile(targetPath(args.out), JSON.stringify(null) + "\n", "utf8"); console.log("Cleared the export destination."); }
    else console.log("No export destination was set.");
    return;
  }
  if (args.setTarget) {
    const scope = args.scope === "team" ? "team" : "individual";
    if (!args.plan) throw new Error("--set-target needs --plan <planKey> (from Figma whoami)");
    if (scope === "team" && !args.project) {
      console.warn("Note: no --project URL given — a team file lands in the team's DRAFTS (private), not a shared project folder.");
    }
    const target = {
      scope,
      planKey: args.plan,
      planName: args.planName || null,
      projectId: scope === "team" ? projectIdFromUrl(args.project) : null,
      projectUrl: scope === "team" && args.project ? args.project : null,
      updatedAt: new Date().toISOString(),
    };
    await writeTarget(args.out, target);
    const where = scope === "team"
      ? `team ${target.planName || target.planKey}${target.projectId ? ` · project ${target.projectId}` : " · drafts"}`
      : `individual drafts (${target.planName || target.planKey})`;
    console.log(`Export destination set: ${where}`);
    return;
  }

  // Registry bookkeeping modes — no manifest generation.
  if (args.forget) {
    const reg = await readRegistry(args.out);
    if (reg[args.variation]) {
      delete reg[args.variation];
      await writeRegistry(args.out, reg);
      console.log(`Forgot the recorded Figma file for ${args.variation}.`);
    } else {
      console.log(`No recorded Figma file for ${args.variation}.`);
    }
    return;
  }
  if (args.record) {
    const fileKey = keyFromUrl(args.fileKey) || args.fileKey;
    if (!fileKey) throw new Error("--record needs --file-key <key|/design/ URL>");
    const reg = await readRegistry(args.out);
    reg[args.variation] = {
      fileKey,
      fileUrl: args.fileUrl || `https://www.figma.com/design/${fileKey}`,
      fileName: args.fileName || null,
      updatedAt: new Date().toISOString(),
    };
    await writeRegistry(args.out, reg);
    console.log(`Recorded Figma file for ${args.variation}: ${reg[args.variation].fileUrl}`);
    return;
  }

  const styleDir = resolveStyleDir(args.variation);
  const brand = await loadBrand(styleDir);
  const tokens = await loadTokens(styleDir);
  const designPages = await loadDesignPages();
  const manifest = buildManifest(args.variation, brand, tokens, designPages);
  // Attach the recorded Figma file (if any) so Claude reuses it instead of
  // creating a duplicate. Claude must still verify it exists before reusing.
  const reg = await readRegistry(args.out);
  manifest.existingFile = reg[args.variation] || null;
  // Attach the export destination (where NEW files are created).
  manifest.target = await readTarget(args.out);

  printSummary(manifest, styleDir);

  if (args.print) {
    console.log("\n" + JSON.stringify(manifest, null, 2));
    return;
  }
  await mkdir(join(ROOT, args.out), { recursive: true });
  const outPath = join(ROOT, args.out, `brand-${args.variation}.json`);
  await writeFile(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`\n→ wrote ${args.out}/brand-${args.variation}.json`);
  console.log("  Next (live): Claude reads this manifest and runs the Figma builder");
  console.log("  (scripts/figma-brand-library.plugin.js) via use_figma. See CLAUDE.md.");
}

main().catch((e) => {
  console.error("export-brand-to-figma failed:", e.message);
  process.exit(1);
});
