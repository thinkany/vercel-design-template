// ©2026 thinkany llc. All rights reserved.
/**
 * Markdown → HTML for `richtext` block props (CORE). The CMS editor writes the
 * markdown subset this renders: paragraphs, headings, bold / italic / strike,
 * links, images, bullet and numbered lists, quotes, code, dividers. Text is
 * escaped first, so content can't inject markup; no dependency, so a promoted
 * site renders rich copy without adding a package.
 */
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
    out.push(`<p>${inline(buf.join("\n"))}</p>`);
  }
  return out.join("\n");
}
