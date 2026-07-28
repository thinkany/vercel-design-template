// ©2026 thinkany llc. All rights reserved.
/**
 * color.mjs — zero-dependency CSS color → sRGB resolver for the cloud derive.
 *
 * Replaces the local browser-canvas toRGBA trick: the capture ships RAW color
 * strings (whatever getComputedStyle emits — rgb/rgba, hsl, hex, and Tailwind
 * v4's oklab/oklch), and the derive resolves them here with no browser and no
 * npm dependency. Returns { r, g, b, a } in 0–1, or null for none/transparent/
 * unparseable.
 */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// linear-light channel → gamma-encoded sRGB (0–1)
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// Oklab (L, a, b) → sRGB 0–1. Per the Oklab spec inverse matrices.
function oklabToRGB(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return { r: clamp01(gamma(r)), g: clamp01(gamma(g)), b: clamp01(gamma(bl)) };
}

// h in [0,360), s,l in [0,1] → sRGB 0–1
function hslToRGB(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

// Parse a number that may be a percentage (of `whole`, default 1) or an angle.
const num = (t) => parseFloat(t);
const pct = (t, whole = 1) => (t.endsWith("%") ? (parseFloat(t) / 100) * whole : parseFloat(t));
const alpha = (t) => (t == null ? 1 : t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t));

// Split a functional color's inner args on commas OR whitespace, isolating any
// `/ alpha` tail. Returns { parts: [...], a: number }.
function argsOf(inner) {
  let a = 1;
  const slash = inner.split("/");
  if (slash.length === 2) { a = alpha(slash[1].trim()); inner = slash[0]; }
  const parts = inner.trim().split(/[\s,]+/).filter(Boolean);
  return { parts, a };
}

/** CSS color string → { r, g, b, a } in 0–1, or null. */
export function parseColor(css) {
  if (!css) return null;
  let s = css.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (s === "none" || s === "currentcolor") return null;

  // #hex (3/4/6/8)
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const fn = s.match(/^([a-z-]+)\((.*)\)$/s);
  if (!fn) return null;
  const name = fn[1];
  const { parts, a } = argsOf(fn[2]);

  if (name === "rgb" || name === "rgba") {
    // Args may be 0–255 or percentages. A 4th comma arg is alpha.
    const conv = (t) => (t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t) / 255);
    const r = conv(parts[0]), g = conv(parts[1]), b = conv(parts[2]);
    const al = parts[3] != null ? alpha(parts[3]) : a;
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: al };
  }
  if (name === "hsl" || name === "hsla") {
    const h = ((num(parts[0]) % 360) + 360) % 360;
    const sv = pct(parts[1]), lv = pct(parts[2]);
    const al = parts[3] != null ? alpha(parts[3]) : a;
    const { r, g, b } = hslToRGB(h, sv, lv);
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: al };
  }
  if (name === "oklab") {
    const L = pct(parts[0]); // 0–1 or 0%–100%
    const av = num(parts[1]), bv = num(parts[2]);
    const { r, g, b } = oklabToRGB(L, av, bv);
    return { r, g, b, a };
  }
  if (name === "oklch") {
    const L = pct(parts[0]);
    const C = num(parts[1]);
    const H = (((num(parts[2]) || 0) % 360) + 360) % 360;
    const av = C * Math.cos((H * Math.PI) / 180);
    const bv = C * Math.sin((H * Math.PI) / 180);
    const { r, g, b } = oklabToRGB(L, av, bv);
    return { r, g, b, a };
  }
  if (name === "color") {
    // color(srgb r g b [/ a]) — the only predefined space we expect from Tailwind.
    // (display-p3 etc. would need a gamut map; treat components as srgb for POC.)
    const space = parts[0];
    const r = num(parts[1]), g = num(parts[2]), b = num(parts[3]);
    if (space !== "srgb" && space !== "srgb-linear") return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a };
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a };
  }
  return null;
}
