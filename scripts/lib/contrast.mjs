// WCAG contrast engine — zero-dependency, pure functions, no browser.
// The single source of truth for the accessibility "prevent" gate in apply-brand.mjs
// (and reusable by any audit). See docs/accessibility-aa-spec.md §1.2 / §6.
//
// Contrast is a property of foreground/background PAIRS. We nudge a failing FOREGROUND's
// LIGHTNESS toward more contrast while preserving its hue — done in OKLCH so the shift is
// perceptual (a red stays the same red, just darker/lighter), with an HSL-lightness path
// as a documented fallback if an OKLCH round-trip ever lands out of gamut.

// ---- hex ↔ sRGB ----------------------------------------------------------------
export function hexToRgb(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6); // ignore alpha for contrast
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const clamp8 = (n) => Math.max(0, Math.min(255, Math.round(n)));
export function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map((c) => clamp8(c).toString(16).padStart(2, "0")).join("");
}

// ---- WCAG relative luminance + ratio -------------------------------------------
function lin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return null;
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
export function ratio(hexA, hexB) {
  const la = luminance(hexA), lb = luminance(hexB);
  if (la == null || lb == null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
export function passes(fg, bg, threshold = 4.5) {
  const r = ratio(fg, bg);
  return r != null && r >= threshold;
}

// ---- OKLab / OKLCH (Björn Ottosson) operating on LINEAR sRGB -------------------
const cbrt = Math.cbrt;
function srgbToOklab({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}
function delin(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}
function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const R = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return { r: clamp8(delin(R) * 255), g: clamp8(delin(G) * 255), b: clamp8(delin(B) * 255) };
}

// ---- adjustForContrast ---------------------------------------------------------
// Return a nudged `fg` hex that meets `threshold` against `bg`, preserving hue by
// stepping OKLCH lightness toward more contrast (darker on a light bg, lighter on a
// dark bg) with a small margin, capped at black/white. Returns the original when it
// already passes, or the best endpoint if the target is unreachable in gamut.
export function adjustForContrast(fg, bg, threshold = 4.5, opts = {}) {
  if (passes(fg, bg, threshold)) return fg;
  const c = hexToRgb(fg);
  if (!c) return fg;
  // Direction: whichever of black/white contrasts MORE with bg is where we head.
  const darker = opts.preferDarker != null
    ? opts.preferDarker
    : (ratio("#000000", bg) || 0) >= (ratio("#ffffff", bg) || 0);
  const lab = srgbToOklab(c);
  const target = threshold + 0.1; // small margin so rounding can't drop us back under
  const step = 0.01;
  let best = fg, bestRatio = ratio(fg, bg) || 0;
  for (let L = lab.L; darker ? L >= 0 : L <= 1; L += darker ? -step : step) {
    const hex = rgbToHex(oklabToRgb({ L, a: lab.a, b: lab.b }));
    const r = ratio(hex, bg) || 0;
    if (r > bestRatio) { bestRatio = r; best = hex; }
    if (r >= target) return hex;
  }
  // Unreachable while keeping the hue's chroma — fall back to the pure endpoint.
  const endpoint = darker ? "#000000" : "#ffffff";
  return (ratio(endpoint, bg) || 0) > bestRatio ? endpoint : best;
}

// The AA contract pairs (spec §1.1). fg/bg/on are role keys; `on` means the pair's
// foreground is that role's `text` on-color (a label sitting on the role's fill).
export const CONTRACT_PAIRS = [
  { id: "P1", fg: "body",   bg: "surface", threshold: 4.5, note: "body copy" },
  { id: "P2", fg: "ink",    bg: "surface", threshold: 4.5, note: "headings" },
  { id: "P3", fg: "muted",  bg: "surface", threshold: 4.5, note: "captions / metadata" },
  { id: "P4", on: "primary", threshold: 4.5, note: "label on primary" },
  { id: "P5", on: "accent",  threshold: 4.5, note: "label on accent" },
  { id: "P6", on: "ink",     threshold: 4.5, note: "label on dark section" },
  { id: "P7", fg: "primary", bg: "surface", threshold: 4.5, note: "primary as link text", link: true },
  { id: "P8", fg: "accent",  bg: "surface", threshold: 4.5, note: "accent as text", link: true },
  { id: "P9", fg: "border",  bg: "surface", threshold: 3.0, note: "non-text UI (1.4.11)", warnOnly: true },
];
