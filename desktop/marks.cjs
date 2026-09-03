// ©2026 thinkany llc. All rights reserved.
// Add an icon to a promoted site's mark set from an SVG file. A mark is an INLINE
// SVG component in site/blocks/lib/marks.tsx (keyed, currentColor), which is what
// lets a block color and animate fill and stroke; content refers to it by key and
// the CMS shows the set as a visual picker. This turns a designer's SVG file into
// one more mark, no model turn: normalize the markup, append a component, register
// the key in MARKS (the markKey enum derives from it).
const fs = require("node:fs");
const path = require("node:path");

const MAX_BYTES = 256 * 1024;

/** Normalize an SVG file's text into { viewBox, outer, inner } or throw a readable error. */
function normalizeSvg(text) {
  if (!text || Buffer.byteLength(text) > MAX_BYTES) throw new Error("That SVG is too large to inline (256 KB max).");
  let s = String(text)
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|foreignObject|metadata|title|desc)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
  const m = s.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>\s*$/i) || s.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/i);
  if (!m) throw new Error("That file doesn't look like an SVG.");
  const attrs = m[1]; let inner = m[2].trim();
  if (!inner) throw new Error("That SVG is empty.");
  const attr = (n) => { const r = attrs.match(new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")); return r ? (r[1] ?? r[2]) : null; };
  let viewBox = attr("viewBox");
  if (!viewBox) {
    const w = parseFloat(attr("width")), h = parseFloat(attr("height"));
    if (w > 0 && h > 0) viewBox = `0 0 ${w} ${h}`; else throw new Error("That SVG has no viewBox or size.");
  }
  // Colors become currentColor (none / url() / transparent stay), so the block's
  // text color drives the mark and can animate it. fill-rule / stroke-width untouched.
  const color = (t) => t.replace(/\b(fill|stroke)(\s*[:=]\s*)(["']?)(?!none\b|currentColor\b|url\(|transparent\b|inherit\b)([^;"'\s>]+)/gi, "$1$2$3currentColor");
  inner = color(inner);
  // Outer presentation attributes the component keeps (lucide-style stroke icons
  // need fill="none" + stroke="currentColor"); everything else on <svg> is dropped.
  const outer = {};
  for (const n of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule"]) { const v = attr(n); if (v != null) outer[n] = v; }
  if (outer.fill) outer.fill = color(`fill=${outer.fill}`).slice(5);
  if (outer.stroke) outer.stroke = color(`stroke=${outer.stroke}`).slice(7);
  if (!outer.fill && !outer.stroke) outer.fill = "currentColor";
  return { viewBox, outer, inner };
}

const JSX_ATTR = { "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin", "fill-rule": "fillRule" };

/** A camelCase identifier from a file name, unique against `taken`. */
function keyFor(fileName, taken) {
  const words = path.basename(fileName).replace(/\.svg$/i, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  let key = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join("") || "mark";
  if (!/^[a-z_$]/i.test(key) || /^(default|class|function|export|import|new|delete|var|let|const|in|of|do|if)$/.test(key)) key = "mark" + key[0].toUpperCase() + key.slice(1);
  let out = key; let n = 2;
  while (taken.has(out)) out = key + n++;
  return out;
}

const HEADER = `// Pictogram set for this site's blocks. Content refers to a mark by its key, so a
// card's icon is a content choice; the CMS shows this set as a picker.
import { z } from "astro/zod";

type IconProps = { className?: string };

export const MARKS = {};
export const markKey = z.enum(Object.keys(MARKS) as [keyof typeof MARKS, ...(keyof typeof MARKS)[]]);
export type MarkKey = z.infer<typeof markKey>;
`;

/** The keys registered in a marks.tsx source. */
function existingKeys(src) {
  const m = src.match(/export const MARKS\s*(?::[^=]*)?=\s*\{([\s\S]*?)\};/);
  const keys = new Set();
  if (m) for (const part of m[1].split(",")) { const t = part.trim(); if (!t) continue; const k = t.split(":")[0].trim().replace(/^["']|["']$/g, ""); if (k) keys.add(k); }
  return keys;
}

/** Add one SVG file as a mark. Returns { key, svg } (svg = markup as the picker shows it). */
function addMark(projectDir, svgPath) {
  const file = path.join(projectDir, "site", "blocks", "lib", "marks.tsx");
  const { viewBox, outer, inner } = normalizeSvg(fs.readFileSync(svgPath, "utf8"));
  let src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : HEADER;
  if (!/export const MARKS\s*(?::[^=]*)?=\s*\{[\s\S]*?\};/.test(src)) throw new Error("This site's marks file has no MARKS map to add to.");
  const key = keyFor(svgPath, existingKeys(src));
  const jsxAttrs = Object.entries(outer).map(([n, v]) => `${JSX_ATTR[n] || n}=${JSON.stringify(v)}`).join(" ");
  const component =
    `// Added from ${path.basename(svgPath)} through the CMS.\n` +
    `const ${key} = ({ className }: IconProps) => (\n` +
    `  <svg viewBox=${JSON.stringify(viewBox)} className={className} ${jsxAttrs} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(inner)} }} />\n` +
    `);\n`;
  src = src.replace(/export const MARKS\s*(?::[^=]*)?=\s*\{([\s\S]*?)\};/, (all, body) => {
    const trimmed = body.replace(/[\s,]+$/, "");
    const multi = /\n/.test(body);
    const next = trimmed ? (multi ? `${trimmed},\n  ${key},\n` : `${trimmed}, ${key} `) : (multi ? `\n  ${key},\n` : ` ${key} `);
    return component + all.slice(0, all.indexOf("{") + 1) + next + "};";
  });
  // A hand-written enum (z.enum(["a", "b"])) needs the key too; a derived one doesn't.
  src = src.replace(/(export const markKey\s*=\s*z\.enum\(\s*\[)([\s\S]*?)(\]\s*(?:as\s+const)?\s*\))/, (all, a, body, c) => (/Object\.keys/.test(all) ? all : `${a}${body.replace(/[\s,]+$/, "")}, ${JSON.stringify(key)}${c}`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, src);
  const svgAttrs = Object.entries(outer).map(([n, v]) => `${n}="${v}"`).join(" ");
  return { key, svg: `<svg viewBox="${viewBox}" ${svgAttrs} aria-hidden="true">${inner}</svg>` };
}

module.exports = { addMark, normalizeSvg, keyFor, existingKeys };
