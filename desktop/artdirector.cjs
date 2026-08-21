// The Art Director — an on-demand, READ-ONLY design review the designer confers with
// AFTER a design comes back. It never edits and never blocks; it returns findings the
// designer decides whether to act on. See docs/art-director-spec.md.
//
// v1 is the DETERMINISTIC lint: zero model tokens, pure fs + regex + a contrast engine.
// It checks a variation's own files against the /design rules (tokens-only, container
// queries, font-relative measures, block markers) and its palette against WCAG AA. A
// later phase adds the model "critique" turn (hierarchy, balance, palette harmony) with
// its own persona; this module is that critique's factual backbone.

const fs = require("node:fs");
const path = require("node:path");

function readFileSafe(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

// ---- contrast engine (WCAG relative luminance, deterministic, zero-dep) ------
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function relLum(rgb) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return null;
  const la = relLum(a), lb = relLum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// ---- palette read (--ta-COLOR: #hex; variation overrides win over base) -------
function parseTokens(css) {
  const out = {};
  const re = /--ta-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  let m;
  while ((m = re.exec(css))) out[m[1]] = m[2];
  return out;
}
function readPalette(projectDir, variationId) {
  const base = readFileSafe(path.join(projectDir, "src", "styles", "tokens.css"));
  const vt = variationId && variationId !== "v00"
    ? readFileSafe(path.join(projectDir, "src", "variations", variationId, "styles", "tokens.css"))
    : "";
  return { ...parseTokens(base), ...parseTokens(vt) };
}

// ---- source files (the variation's own components; base only for v00) --------
function componentFiles(projectDir, variationId) {
  const dir = variationId && variationId !== "v00"
    ? path.join(projectDir, "src", "variations", variationId, "components")
    : path.join(projectDir, "src", "app", "components");
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".tsx")); } catch { /* none diverged */ }
  return names.map((n) => ({ name: n, text: readFileSafe(path.join(dir, n)) }));
}

// ---- per-file rule checks ----------------------------------------------------
// Arbitrary-value color utilities that should be --ta-* tokens instead.
const COLOR_UTIL = /\b(?:text|bg|border|from|via|to|fill|stroke|ring|shadow|decoration|outline|caret|accent|ring-offset)-\[#[0-9a-fA-F]{3,8}\]/;

function lintSource(file) {
  const findings = [];
  const lines = file.text.split("\n");
  lines.forEach((raw, i) => {
    const ln = raw;
    const n = i + 1;
    const add = (severity, rule, message) => findings.push({ severity, rule, file: file.name, line: n, message });

    // rule 2 — tokens only, via utilities
    if (COLOR_UTIL.test(ln))
      add("review", "tokens-only", "Raw hex in a utility — use a --ta-* utility (text-ta-ink, bg-ta-surface, border-ta-border).");
    if (/\[rgba?\(/i.test(ln) || /:\s*['"]?rgba?\(/i.test(ln))
      add("review", "tokens-only", "Raw rgb/rgba — use color-mix(in_srgb,var(--ta-ink)_NN%,transparent) or a from-ta-ink/NN scrim.");
    if (/style=\{\{[^}]*:\s*['"]#[0-9a-fA-F]{3,8}['"]/.test(ln))
      add("review", "tokens-only", "Hardcoded hex in inline style — reference a --ta-* token instead.");

    // rule 1 — container queries, not viewport
    if (/\b(?:min-h-screen|h-screen|w-screen)\b/.test(ln) || /\[[^\]]*\d*\.?\d*(?:vh|vw|dvh|svh|lvh)\b[^\]]*\]/.test(ln))
      add("review", "container-queries", "Viewport unit — reads the window, not the device frame. Use min-h-full / cqi / cqw.");
    if (/(?<!@)\b(?:sm|md|lg|xl|2xl):/.test(ln))
      add("review", "container-queries", "Viewport breakpoint variant — use container variants (@sm:/@lg:) so the preview matches the export.");

    // new rule — a ch/em measure on a FONT-LESS element (the wrapper mistake). ch/em
    // resolve against the element's OWN font, so a max-w-[Nch] on a wrapper with no
    // font-ta-* family measures the inherited body font, not the heading's — and the
    // text wraps/stacks early. When a font-ta-* IS on the same element, the measure sits
    // on the text element itself (correct) and is not flagged. (Line-level: a className
    // split across lines can still false-positive; the common single-line case is precise.)
    if (/\bmax-w-\[[\d.]+(?:ch|em)\]/.test(ln) && !/\bfont-ta-/.test(ln))
      add("review", "font-relative-measure", "ch/em measure on an element with no font-ta-* of its own — it resolves against the inherited body font, not the heading's, so the text wraps/stacks early. Move max-w onto the text element that carries the font.");
  });

  // rule 3 — block markers (file-level heuristic; one note, not per section)
  if (/<section\b/.test(file.text) && !/data-block=/.test(file.text))
    findings.push({ severity: "note", rule: "block-markers", file: file.name, line: 0, message: "Has <section> elements but no data-block markers — major sections need them for the Figma export." });

  return findings;
}

// ---- palette lint (WCAG AA text-on-surface) ----------------------------------
function lintPalette(palette) {
  const findings = [];
  const pairs = [
    ["ink", "surface", "Heading / ink text on the surface"],
    ["body", "surface", "Body text on the surface"],
    ["muted", "surface", "Muted text on the surface"],
  ];
  for (const [fg, bg, label] of pairs) {
    if (!palette[fg] || !palette[bg]) continue;
    const ratio = contrastRatio(palette[fg], palette[bg]);
    if (ratio == null) continue;
    const r = ratio.toFixed(2);
    if (ratio < 3)
      findings.push({ severity: "high", rule: "contrast-aa", file: "tokens.css", line: 0, message: `${label} is ${r}:1 (--ta-${fg} on --ta-${bg}) — below 3:1, fails AA even for large text.` });
    else if (ratio < 4.5)
      findings.push({ severity: "review", rule: "contrast-aa", file: "tokens.css", line: 0, message: `${label} is ${r}:1 (--ta-${fg} on --ta-${bg}) — below AA 4.5:1 for body text.` });
  }
  return findings;
}

// ---- entry -------------------------------------------------------------------
const SEV_ORDER = { high: 0, review: 1, note: 2 };
function reviewVariation(projectDir, variationId) {
  const files = componentFiles(projectDir, variationId);
  const palette = readPalette(projectDir, variationId);
  let findings = [];
  for (const f of files) findings = findings.concat(lintSource(f));
  findings = findings.concat(lintPalette(palette));
  findings.sort((a, b) =>
    (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || a.file.localeCompare(b.file) || a.line - b.line);
  const counts = findings.reduce((c, f) => { c[f.severity] = (c[f.severity] || 0) + 1; return c; }, {});
  return { variationId, findings, counts, filesReviewed: files.map((f) => f.name) };
}

module.exports = { reviewVariation, contrastRatio, parseTokens };
