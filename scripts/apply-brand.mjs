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
import { ratio, adjustForContrast, CONTRACT_PAIRS } from "./lib/contrast.mjs";

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
// A Google Fonts URL contains semicolons in its axis-weight lists
// (…wght@0,8..60,300;0,8..60,400;…), so we must NOT treat the first ";" as the statement
// end — that truncates the match mid-URL and splices the new import inside the base one.
// Match a FULL `@import url(...);` instead: the URL has no ")" in it, so stop at the
// closing paren, then find the last such statement and insert after it.
function addFontImport(css, url) {
  const line = `@import url('${url}');`;
  if (css.includes(line)) return css; // idempotent
  const re = /@import\s+url\([^)]*\)\s*;/g;
  let last = null, m;
  while ((m = re.exec(css)) !== null) last = m;
  if (!last) return `${line}\n${css}`;
  const end = last.index + last[0].length;
  return css.slice(0, end) + `\n${line}` + css.slice(end);
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

// ---- accessibility: contrast-safe tokens (spec §1.3) ------------------------
// The single deterministic gate. BEFORE writing tokens, evaluate the AA contract pairs
// and nudge the FOREGROUND member of any failing pair (never the brand background), so
// the palette is contrast-safe by construction. Mutates `roles` in place; returns a
// per-pair readout + provenance notes for the summary. Ordering follows CONTRACT_PAIRS
// (P2 adjusts --ta-ink before P6 uses it as a background).
function enforceContrast(roles) {
  const notes = [];      // what was nudged, from→to (provenance)
  const warnings = [];   // P9 non-text + link colors kept for brand (need underline)
  const linkFlags = [];  // P7/P8 → links must carry a non-color affordance (Phase 2)
  const pairs = [];      // per-pair result for the styleguide Accessibility section
  const rr = (a, b) => +(ratio(a, b) || 0).toFixed(2);

  for (const p of CONTRACT_PAIRS) {
    const roleKey = p.on || p.fg;
    const role = roles[roleKey];
    const bgHex = p.on ? role?.value : roles[p.bg]?.value;
    if (!role || !bgHex) continue;
    const field = p.on ? "text" : "value";       // on-pairs adjust the role's `text` on-color
    const before = role[field] || (p.on ? "#ffffff" : "");
    const r0 = ratio(before, bgHex);
    if (r0 == null) continue;
    let adjusted = false;

    if (r0 < p.threshold) {
      if (p.warnOnly) {
        warnings.push(`${p.id} ${roleKey} on ${p.bg} ${r0.toFixed(2)} < ${p.threshold} (${p.note}) — decorative-exempt, left as-is`);
      } else if (p.link) {
        linkFlags.push(roleKey);
        warnings.push(`${p.id} ${roleKey} as link text ${r0.toFixed(2)} < ${p.threshold} — brand color kept; links must use a non-color affordance (underline)`);
      } else {
        const after = adjustForContrast(before, bgHex, p.threshold);
        if (after && after !== before) {
          role[field] = after;
          adjusted = true;
          notes.push(`${roleKey}.${field} ${before} → ${after} (${p.id} ${p.note}: ${r0.toFixed(2)} → ${rr(after, bgHex)})`);
        }
      }
    }
    pairs.push({ id: p.id, note: p.note, fg: role[field], bg: bgHex, threshold: p.threshold, ratio: rr(role[field], bgHex), pass: (ratio(role[field], bgHex) || 0) >= p.threshold, warnOnly: !!p.warnOnly, adjusted });
  }
  return { notes, warnings, linkAffordanceNeeded: [...new Set(linkFlags)], pairs };
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
  // Accessibility is OPT-IN (default off) so it never alters a deliberately-chosen palette.
  // On (--aa, or TA_DESIGN_A11Y=aa): make the palette contrast-safe (AA) before it's written.
  const aaOn = args.aa === true || String(args.aa || "").toLowerCase() === "aa" || process.env.TA_DESIGN_A11Y === "aa";
  const a11y = aaOn ? enforceContrast(roles) : { mode: "off", notes: [], warnings: [], linkAffordanceNeeded: [], pairs: [] };
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
    accessibility: a11y, // contrast-safe pairs: { notes, warnings, linkAffordanceNeeded, pairs }
    paths: { tokens: path.relative(ROOT, tokensPath), brand: path.relative(ROOT, brandPath), fonts: path.relative(ROOT, fontsCssPath) },
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  console.error(
    `\napply-brand: ${created ? "created" : "updated"} ${VAR} — primary ${roles.primary.value}` +
      (fontTokens.length ? `, fonts ${fontTokens.length}` : "") +
      (envWrote.length ? `, env ${envWrote.length}` : "") +
      (a11y.notes.length ? `, contrast-fixed ${a11y.notes.length}` : "") + "\n"
  );
  if (a11y.notes.length) console.error("apply-brand: AA contrast adjustments —\n  " + a11y.notes.join("\n  ") + "\n");
  if (a11y.warnings.length) console.error("apply-brand: AA warnings —\n  " + a11y.warnings.join("\n  ") + "\n");
}

main();
