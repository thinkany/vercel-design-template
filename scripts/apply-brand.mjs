// apply-brand.mjs — the deterministic "apply" step of design-from-a-brief.
//
// Takes the JSON from the extractors (extract-palette.mjs + resolve-fonts.mjs)
// plus a few brief params and writes them into a working variation exactly the
// way /setup-styleguide + /setup-project would — but non-interactively. This is
// the piece that must be RELIABLE, so it's a script (testable in isolation), not
// agent hand-writing.
//
//   node scripts/apply-brand.mjs --variation v01 \
//       --palette palette.json --fonts fonts.json \
//       [--client "ACME"] [--project "Rebrand"] [--project-type website] [--menu dropdown] \
//       [--project-root <dir>]
//
// It writes, in the variation's copy (creating the variation from base v00 first
// if it doesn't exist):
//   • styles/tokens.css   → the 7 --ta-* colors, 4 --ta-font-*, and the shadcn bridge
//   • styles/brand.ts     → the 7 BrandColor value/text (token slugs kept)
//   • styles/fonts.css    → the resolved Google Fonts @import
//   • variation.json      → previewReady:true when done
// and, when brief params are given, the matching VITE_* keys in .env.

import fs from "node:fs";
import path from "node:path";

// ---- args -------------------------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const ROOT = path.resolve(args["project-root"] || process.cwd());
const VAR = args.variation || "v01";

function die(msg) {
  console.error("apply-brand: " + msg);
  process.exit(1);
}

// ---- small file helpers -----------------------------------------------------
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);
const readJson = (p) => JSON.parse(read(p));

// Replace a CSS custom-property value in a :root block (first match; the base
// copy declares each once in :root — the `.dark` copies come later and we leave
// them). Anchored on a leading newline + indentation + exact `name:`.
function setCssVar(css, name, value) {
  const re = new RegExp(`(\\n[ \\t]*${name.replace(/[-]/g, "\\-")}:\\s*)[^;\\n]*;`);
  return re.test(css) ? css.replace(re, `$1${value};`) : css;
}
// Update a BrandColor entry's value + text by its token slug (order in file is
// token, value, text — see brand.ts).
function setBrandColor(ts, slug, value, text) {
  const re = new RegExp(`(token:\\s*"${slug}"\\s*,\\s*value:\\s*")[^"]*("\\s*,\\s*text:\\s*")[^"]*(")`);
  return ts.replace(re, `$1${value}$2${text}$3`);
}
// Insert an @import after the LAST existing @import (CSS requires @import atop).
function addFontImport(css, url) {
  const re = /(@import[^;]*;)(?![\s\S]*@import)/;
  const line = `@import url('${url}');`;
  if (css.includes(line)) return css; // idempotent
  return re.test(css) ? css.replace(re, `$1\n${line}`) : `${line}\n${css}`;
}
function upsertEnv(env, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(env) ? env.replace(re, line) : env.trimEnd() + `\n${line}\n`;
}
function mmddyyyy(d) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// ---- variation creation (mirrors /api/variation/create from base v00) -------
function ensureVariation() {
  const dir = path.join(ROOT, "src", "variations", VAR);
  const created = !fs.existsSync(dir);
  if (created) {
    fs.mkdirSync(path.join(dir, "components"), { recursive: true });
    fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
    fs.cpSync(path.join(ROOT, "src", "app", "components"), path.join(dir, "components"), { recursive: true });
    fs.cpSync(path.join(ROOT, "src", "styles"), path.join(dir, "styles"), { recursive: true });
    const n = parseInt(VAR.replace(/\D/g, ""), 10) || 0;
    const meta = {
      version: `v${Math.floor(n / 10)}.${n % 10}`,
      title: n === 1 ? "Initial Design" : `Design ${n}`,
      description: n === 1 ? "Initial Design Concept, color and font variations." : "",
      createdAt: mmddyyyy(new Date()),
      styleguideStatus: "updated",
      brandStatus: "established",
      previewReady: false,
    };
    write(path.join(dir, "variation.json"), JSON.stringify(meta, null, 2) + "\n");
  }
  return { dir, created };
}

function setPreviewReady(dir, ready) {
  const p = path.join(dir, "variation.json");
  try {
    const meta = readJson(p);
    meta.previewReady = ready;
    write(p, JSON.stringify(meta, null, 2) + "\n");
  } catch {
    /* leave as-is */
  }
}

// Merge fields into variation.json (used to capture primaryColor/primaryFont for the
// dashboard brief modal). Missing file → skip.
function patchMeta(dir, patch) {
  const p = path.join(dir, "variation.json");
  try {
    const meta = readJson(p);
    Object.assign(meta, patch);
    write(p, JSON.stringify(meta, null, 2) + "\n");
  } catch {
    /* leave as-is */
  }
}

// First family name from a font-family stack ("'Playfair Display', serif" → "Playfair
// Display"). A bare var(...) ref yields "" (nothing displayable).
function firstFamily(stack) {
  if (!stack) return "";
  const first = String(stack).split(",")[0].trim().replace(/^['"]|['"]$/g, "").trim();
  return /^var\(/i.test(first) ? "" : first;
}

// ---- the apply --------------------------------------------------------------
const ROLES = ["primary", "accent", "surface", "ink", "body", "muted", "border"];
const FONT_ROLES = { display: "--ta-font-display", serif: "--ta-font-serif", sans: "--ta-font-sans", mono: "--ta-font-mono" };

function applyColors(tokensPath, roles) {
  let css = read(tokensPath);
  for (const r of ROLES) if (roles[r]?.value) css = setCssVar(css, `--ta-${r}`, roles[r].value);
  // shadcn bridge (:root primitives → var(--ta-*)); leave surfaces/destructive/dark alone.
  const primaryText = roles.primary?.text || "#ffffff";
  css = setCssVar(css, "--primary", "var(--ta-primary)");
  css = setCssVar(css, "--primary-foreground", primaryText);
  css = setCssVar(css, "--secondary", "var(--ta-surface)");
  css = setCssVar(css, "--secondary-foreground", "var(--ta-ink)");
  css = setCssVar(css, "--accent", "var(--ta-surface)");
  css = setCssVar(css, "--accent-foreground", "var(--ta-ink)");
  css = setCssVar(css, "--muted-foreground", "var(--ta-muted)");
  css = setCssVar(css, "--ring", "var(--ta-primary)");
  write(tokensPath, css);
}

function applyFontTokens(tokensPath, fontRoles) {
  if (!fontRoles) return [];
  let css = read(tokensPath);
  const set = [];
  for (const [role, token] of Object.entries(FONT_ROLES)) {
    const stack = fontRoles[role]?.stack;
    if (stack) { css = setCssVar(css, token, stack); set.push(`${token}: ${stack}`); }
  }
  write(tokensPath, css);
  return set;
}

function applyBrandTs(brandPath, roles) {
  let ts = read(brandPath);
  for (const r of ROLES) {
    if (roles[r]?.value) ts = setBrandColor(ts, `--ta-${r}`, roles[r].value, roles[r].text || "#111111");
  }
  write(brandPath, ts);
}

function applyFontsCss(fontsCssPath, importUrl) {
  if (!importUrl) return false;
  write(fontsCssPath, addFontImport(read(fontsCssPath), importUrl));
  return true;
}

function applyEnv() {
  const map = {
    client: "VITE_CLIENT_NAME",
    project: "VITE_PROJECT_NAME",
    "project-type": "VITE_PROJECT_TYPE",
    menu: "VITE_MENU_STYLE",
  };
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return [];
  let env = read(envPath);
  const wrote = [];
  for (const [flag, key] of Object.entries(map)) {
    if (typeof args[flag] === "string") { env = upsertEnv(env, key, args[flag]); wrote.push(`${key}="${args[flag]}"`); }
  }
  if (wrote.length) write(envPath, env);
  return wrote;
}

function main() {
  if (!args.palette) die("need --palette <path> (JSON from extract-palette.mjs)");
  const palette = readJson(args.palette);
  const roles = palette.roles;
  if (!roles || !roles.primary) die("palette JSON has no .roles — is this extract-palette.mjs output?");
  const fonts = args.fonts && fs.existsSync(args.fonts) ? readJson(args.fonts) : null;

  const { dir, created } = ensureVariation();
  const stylesDir = path.join(dir, "styles");
  const tokensPath = path.join(stylesDir, "tokens.css");
  const brandPath = path.join(stylesDir, "brand.ts");
  const fontsCssPath = path.join(stylesDir, "fonts.css");

  applyColors(tokensPath, roles);
  applyBrandTs(brandPath, roles);
  const fontTokens = applyFontTokens(tokensPath, fonts?.roles);
  const importedFonts = fonts?.import?.url ? applyFontsCss(fontsCssPath, fonts.import.url) : false;
  const envWrote = applyEnv();
  setPreviewReady(dir, true);

  // Capture the design's identity for the dashboard brief modal (primary color hex +
  // primary/display font family). The manifest only carries a CSS-var ref for fonts,
  // so recording the family here is what lets the modal show it accurately.
  const primaryFont = firstFamily(fonts?.roles?.display?.stack);
  const idPatch = {};
  if (roles.primary?.value) idPatch.primaryColor = roles.primary.value;
  if (primaryFont) idPatch.primaryFont = primaryFont;
  if (Object.keys(idPatch).length) patchMeta(dir, idPatch);

  const summary = {
    variation: VAR,
    created,
    colors: Object.fromEntries(ROLES.map((r) => [r, roles[r]?.value]).filter(([, v]) => v)),
    fontTokens,
    fontsImported: importedFonts,
    env: envWrote,
    paths: { tokens: path.relative(ROOT, tokensPath), brand: path.relative(ROOT, brandPath), fonts: path.relative(ROOT, fontsCssPath) },
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  console.error(
    `\napply-brand: ${created ? "created" : "updated"} ${VAR} — primary ${roles.primary.value}` +
      (fontTokens.length ? `, fonts ${fontTokens.length}` : "") +
      (envWrote.length ? `, env ${envWrote.length}` : "") + "\n"
  );
}

main();
