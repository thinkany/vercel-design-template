// extract-palette.mjs — the color-from-URL extractor.
//
// First build target of the "design from a brief" feature (docs/design-from-brief.md):
// give it a URL and it returns a ranked palette scraped from the page + its
// stylesheets, mapped to this template's seven `--ta-*` color roles — so a brief
// like "colors from brandsite.com" becomes real tokens with no rendering,
// screenshots, or API keys. Pure fetch + regex + color math; runnable in isolation.
//
//   node scripts/extract-palette.mjs <url> [--summary] [--top N]
//
// Default output is JSON on stdout (the orchestrator parses it). `--summary`
// adds a human-readable breakdown on stderr. Exit non-zero only on a usage error
// or a total fetch failure — a thin page still yields a best-effort palette.
//
// Roles it fills (from src/styles/brand.ts): primary, accent, surface, ink,
// body, muted, border. Each = { value: "#rrggbb", text: "#000|#fff" }. Missing
// roles are DERIVED from what's present (e.g. body from ink) so the caller always
// gets a complete, writable set.

// ---- fetch layer ------------------------------------------------------------
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const MAX_STYLESHEETS = 8;
const MAX_BYTES = 2_000_000; // cap per response so a giant CSS bundle can't hang us

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,text/css,*/*" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf.slice(0, MAX_BYTES)).toString("utf8");
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Pull <link rel=stylesheet href>, <style> blocks, and inline style="" from HTML.
function collectCssSources(html, baseUrl) {
  const linked = [];
  const inline = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) {
      try {
        linked.push(new URL(href[1], baseUrl).href);
      } catch {
        /* skip unparseable href */
      }
    }
  }
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html))) inline.push(m[1]);
  const attrRe = /style\s*=\s*["']([^"']+)["']/gi;
  while ((m = attrRe.exec(html))) inline.push(m[1]);
  return { linked: linked.slice(0, MAX_STYLESHEETS), inlineCss: inline.join("\n") };
}

// ---- color parsing ----------------------------------------------------------
const NAMED = { white: [255, 255, 255], black: [0, 0, 0] }; // common brand extremes only

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].every((v) => Number.isFinite(v))) return [r, g, b];
  }
  return null;
}
function chan(v) {
  v = v.trim();
  return v.endsWith("%") ? clamp255((parseFloat(v) / 100) * 255) : clamp255(parseFloat(v));
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [clamp255((r + mm) * 255), clamp255((g + mm) * 255), clamp255((b + mm) * 255)];
}

// Scan a CSS/HTML string and tally every color occurrence → Map(hex → count).
function tallyColors(css) {
  const counts = new Map();
  const notes = new Set();
  const bump = (rgb, weight = 1) => {
    if (!rgb) return;
    const hex = "#" + rgb.map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
    counts.set(hex, (counts.get(hex) || 0) + weight);
  };

  let m;
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  while ((m = hexRe.exec(css))) {
    const len = m[0].length - 1;
    if (len === 3 || len === 4 || len === 6 || len === 8) bump(hexToRgb(m[0]));
  }
  const rgbRe = /rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)/gi;
  while ((m = rgbRe.exec(css))) bump([chan(m[1]), chan(m[2]), chan(m[3])]);
  const hslRe = /hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/gi;
  while ((m = hslRe.exec(css))) bump(hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
  for (const [name, rgb] of Object.entries(NAMED)) {
    const re = new RegExp("\\b" + name + "\\b", "gi");
    const n = (css.match(re) || []).length;
    if (n) bump(rgb, n);
  }
  if (/oklch\(|oklab\(|color\(/i.test(css)) notes.add("modern color() / oklch values present — not parsed (v2)");
  return { counts, notes };
}

// ---- color math for ranking + roles -----------------------------------------
function luminance([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}
function hexToArr(hex) {
  return hexToRgb(hex);
}
function textOn(rgb) {
  return luminance(rgb) > 0.42 ? "#111111" : "#ffffff";
}
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Merge near-identical colors (anti-aliasing / opacity variants), summing counts.
function cluster(counts) {
  const items = [...counts.entries()]
    .map(([hex, count]) => ({ hex, count, rgb: hexToArr(hex) }))
    .filter((x) => x.rgb);
  items.sort((a, b) => b.count - a.count);
  const merged = [];
  const THRESH = 18; // Euclidean RGB distance treated as "the same" color
  for (const it of items) {
    const near = merged.find(
      (mrg) =>
        Math.hypot(mrg.rgb[0] - it.rgb[0], mrg.rgb[1] - it.rgb[1], mrg.rgb[2] - it.rgb[2]) < THRESH
    );
    if (near) near.count += it.count;
    else merged.push({ ...it });
  }
  return merged.map((x) => {
    const { h, s, l } = rgbToHsl(x.rgb);
    // chroma = max-min in raw RGB (0-255). Unlike HSL saturation it is NOT
    // inflated for near-black/near-white, so it cleanly separates true brand
    // colors from dark "inks" and light grays.
    const chroma = Math.max(...x.rgb) - Math.min(...x.rgb);
    return { hex: x.hex, count: x.count, hue: Math.round(h), sat: +s.toFixed(3), chroma, lum: +luminance(x.rgb).toFixed(3), light: +l.toFixed(3) };
  });
}

// Map a ranked palette onto the seven --ta-* roles, deriving any that are absent.
//
// Split by RAW CHROMA (not HSL saturation): chromatic colors become primary/
// accent, neutrals anchor surface/ink. The mid-gray ramp (body/muted/border) is
// DERIVED from an ink→surface interpolation so the neutrals are always a coherent,
// distinct set even when a site exposes few grays.
function assignRoles(palette) {
  const notes = [];
  const CHROMA_MIN = 22;
  const chromatic = palette.filter((c) => c.chroma >= CHROMA_MIN);
  const neutral = palette.filter((c) => c.chroma < CHROMA_MIN);
  const isMid = (c) => c.light >= 0.18 && c.light <= 0.82; // a real brand color, not a near-black/near-white
  const weight = (c) => c.count * c.chroma; // "color-weight": used AND vivid
  const byWeight = (arr) => [...arr].sort((a, b) => weight(b) - weight(a));
  const byLum = (arr) => [...arr].sort((a, b) => a.lum - b.lum);
  const byCount = (arr) => [...arr].sort((a, b) => b.count - a.count);

  // primary = the vivid mid-tone with the most color-weight.
  const primary =
    byWeight(chromatic.filter(isMid))[0] ||
    byWeight(chromatic)[0] ||
    byCount(palette)[0] || { hex: "#1e4b96" };
  // accent = next vivid color a clear hue away from primary.
  let accent =
    byWeight(chromatic.filter((c) => c.hex !== primary.hex && isMid(c) && hueGap(c.hue, primary.hue) > 30))[0] ||
    byWeight(chromatic.filter((c) => c.hex !== primary.hex && hueGap(c.hue, primary.hue) > 30))[0] ||
    byWeight(chromatic.filter((c) => c.hex !== primary.hex))[0];
  if (!accent) {
    notes.push("only one prominent color found — accent mirrors primary (adjust live)");
    accent = { hex: primary.hex };
  }

  // Neutrals: surface = lightest, ink = darkest. Fall back to defaults if a site
  // exposes none at that end.
  const nsorted = byLum(neutral);
  const inkC = nsorted[0] || byLum(palette)[0] || { hex: "#111111" };
  const surfC = nsorted[nsorted.length - 1];
  const ink = inkC.hex;
  const surface = surfC && surfC.lum > 0.75 ? surfC.hex : "#ffffff";
  if (!neutral.length) notes.push("no neutral grays scraped — neutral ramp derived from defaults");
  // Coherent gray ramp between ink and surface (always distinct).
  const body = mix(ink, surface, 0.2);
  const muted = mix(ink, surface, 0.48);
  const border = mix(ink, surface, 0.76);

  const role = (hex, fallback) => {
    const h = hex || fallback;
    const rgb = hexToArr(h) || [0, 0, 0];
    return { value: h, text: textOn(rgb) };
  };
  return {
    roles: {
      primary: role(primary.hex, "#1e4b96"),
      accent: role(accent.hex, "#c41230"),
      surface: role(surface, "#f8f7f3"),
      ink: role(ink, "#111111"),
      body: role(body, "#333333"),
      muted: role(muted, "#777777"),
      border: role(border, "#cccccc"),
    },
    notes,
  };
}

// Interpolate between two hex colors (t=0 → a, t=1 → b).
function mix(aHex, bHex, t) {
  const a = hexToArr(aHex) || [17, 17, 17];
  const b = hexToArr(bHex) || [255, 255, 255];
  const out = a.map((v, i) => clamp255(v + (b[i] - v) * t));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ---- orchestration ----------------------------------------------------------
async function extractPalette(url) {
  const html = await fetchText(url);
  const notes = [];
  let allCss = "";
  let sheetsFetched = 0;
  if (html == null) {
    notes.push("could not fetch the page — returning template defaults");
  } else {
    const { linked, inlineCss } = collectCssSources(html, url);
    allCss += inlineCss + "\n";
    // Scan the raw HTML too (inline styles, framework color attrs).
    allCss += html + "\n";
    const sheets = await Promise.all(linked.map((u) => fetchText(u)));
    for (const s of sheets) if (s) { allCss += s + "\n"; sheetsFetched++; }
    if (linked.length && !sheetsFetched) notes.push("linked stylesheets were unreachable — used inline CSS only");
  }

  const { counts, notes: parseNotes } = tallyColors(allCss);
  const palette = cluster(counts);
  const totalTokens = [...counts.values()].reduce((a, b) => a + b, 0);
  const { roles, notes: roleNotes } = assignRoles(palette);

  return {
    source: url,
    sampled: { stylesheets: sheetsFetched, colorTokens: totalTokens, distinctColors: palette.length },
    palette: palette.slice(0, 12),
    roles,
    notes: [...notes, ...parseNotes, ...roleNotes],
  };
}

function printSummary(result) {
  const e = console.error;
  e(`\nPalette from ${result.source}`);
  e(`  sampled ${result.sampled.colorTokens} color tokens across ${result.sampled.stylesheets} stylesheet(s) → ${result.sampled.distinctColors} distinct\n`);
  e("  Top colors:");
  for (const c of result.palette.slice(0, 8)) {
    e(`    ${c.hex}  ×${String(c.count).padStart(4)}  hue ${String(c.hue).padStart(3)}  chroma ${String(c.chroma).padStart(3)}  lum ${c.lum}`);
  }
  e("\n  --ta-* roles:");
  for (const [k, v] of Object.entries(result.roles)) {
    e(`    ${(k + ":").padEnd(9)} ${v.value}  (text ${v.text})`);
  }
  if (result.notes.length) e("\n  notes: " + result.notes.join("; "));
  e("");
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("-"));
  if (!url) {
    console.error("Usage: node scripts/extract-palette.mjs <url> [--summary] [--top N]");
    process.exit(2);
  }
  const normalized = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const result = await extractPalette(normalized);
  if (args.includes("--summary")) printSummary(result);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
