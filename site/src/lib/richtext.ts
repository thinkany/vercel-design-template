// ©2026 thinkany llc. All rights reserved.
/**
 * Markdown → HTML for `richtext` block props (CORE). The CMS editor writes the
 * markdown subset this renders: paragraphs, headings, bold / italic / strike,
 * links, images, bullet and numbered lists, quotes, code, dividers, and a video
 * (a YouTube / Vimeo address on a line of its own, see embed.ts). Text is
 * escaped first, so content can't inject markup; no dependency, so a promoted
 * site renders rich copy without adding a package.
 */
import { videoEmbed, embedHtml } from "./embed";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  s = s.replace(/ {2,}\n|\\\n/g, "<br />");
  return s;
}

// The editor writes an ALIGNED paragraph / heading / image as an HTML block. Those, and
// only those, pass through: tag, text-align style, float / centering on an image, src,
// alt; inline marks inside come as their own tags (strong, em, s, a, code, br).
const ALIGNED_OPEN = /^<(p|h[2-6]|img)\b/i;
const OK_INLINE = /^<\/?(strong|em|s|a|code|br)\b[^>]*>$/i;
function sanitizeAligned(html: string): string {
  return html
    .replace(/<(p|h[2-6])\b[^>]*>/gi, (m, tag) => { const a = (m.match(/text-align:\s*(left|center|right)/i) || [])[1]; return a ? `<${tag.toLowerCase()} style="text-align:${a.toLowerCase()}">` : `<${tag.toLowerCase()}>`; })
    .replace(/<img\b[^>]*>/gi, (m) => { const src = (m.match(/\bsrc="([^"]*)"/i) || [])[1] || ""; const alt = (m.match(/\balt="([^"]*)"/i) || [])[1] || ""; const al = (m.match(/data-align="(left|right|center)"/i) || [])[1]; const style = al === "left" ? "float:left;margin:0 1.25em 1em 0;max-width:50%" : al === "right" ? "float:right;margin:0 0 1em 1.25em;max-width:50%" : al === "center" ? "display:block;margin:0 auto" : ""; return `<img src="${src}" alt="${alt}" loading="lazy"${style ? ` style="${style}"` : ""} />`; })
    .replace(/<a\b[^>]*>/gi, (m) => { const href = (m.match(/\bhref="([^"]*)"/i) || [])[1] || "#"; return `<a href="${href}">`; })
    .replace(/<(?!\/?(?:p|h[2-6]|img|strong|em|s|a|code|br)\b)[^>]*>/gi, "") // any other tag is dropped
    .replace(/\son\w+="[^"]*"/gi, "");
}

const bareUrl = (s: string) => { let m: RegExpMatchArray | null; if ((m = s.match(/^<(\S+)>$/))) return m[1]; if ((m = s.match(/^\[(\S+)\]\((\S+)\)$/)) && m[1] === m[2]) return m[2]; return s; };
const LIST = /^\s*(?:[-*+]|\d+[.)])\s+/;
const BLOCK_START = /^(?:#{1,6}\s|>\s?|```|(?:-{3,}|\*{3,}|_{3,})\s*$)/;

export function renderMarkdown(md: string | undefined | null): string {
  const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m: RegExpMatchArray | null;
    if (ALIGNED_OPEN.test(line.trim())) {
      // An aligned block from the editor: runs to the blank line (HTML block rule).
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      out.push(sanitizeAligned(buf.join("\n"))); continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2].trim())}</h${m[1].length}>`); i++; continue; }
    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr />"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${renderMarkdown(buf.join("\n"))}</blockquote>`); continue;
    }
    if (LIST.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (LIST.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        if (LIST.test(lines[i])) items.push(lines[i].replace(LIST, ""));
        else items[items.length - 1] += " " + lines[i].trim(); // indented continuation
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`); continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]) && !LIST.test(lines[i])) buf.push(lines[i++]);
    // A video address alone on its line is the video, the way WordPress treats a pasted
    // link. The file keeps the plain URL; the editor writes and reads it the same way.
    // The address may also arrive as an autolink, <url> or [url](url), when the editor's
    // Link extension got to a paste first; the video is the same.
    const video = buf.length === 1 ? videoEmbed(bareUrl(buf[0].trim())) : null;
    out.push(video ? embedHtml(video) : `<p>${inline(buf.join("\n"))}</p>`);
  }
  return out.join("\n");
}
