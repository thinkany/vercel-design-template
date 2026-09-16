// ©2026 thinkany llc. All rights reserved.
// The rich text editor's "Ask Claude": the pure half (prompt + reply cleaning) of the
// rich:assist handler in main.cjs, testable without a key. The designer types what
// should change ("tighten this to half", "add a closing line about the guarantee"),
// the editor's markdown goes with it, and the reply comes back as markdown confined
// to what the editor can hold (desktop/vendor/editor.js): paragraphs, headings 2 to
// 6, bold, italic, strikethrough, links, bullet and numbered lists, quotes, code
// blocks, dividers, and the image and video lines already there. Precedent: post-writer.cjs.

const MAX_IN = 60000;   // characters of text sent
const MAX_OUT = 80000;

const SCHEMA = {
  type: "object",
  properties: { markdown: { type: "string", description: "The edited text, in the editor's markdown subset. The whole text, not a diff." } },
  required: ["markdown"],
  additionalProperties: false,
};

// `req`: { markdown, instruction, kind }. `ctx`: { name, voice: { tone, rules } }.
function prompt(req, ctx) {
  const r = req || {};
  const c = ctx || {};
  const voice = c.voice || {};
  const rules = (voice.rules || []).map((x) => String(x).trim()).filter(Boolean);
  const text = String(r.markdown || "").slice(0, MAX_IN);
  const what = r.kind ? String(r.kind) : "text";
  const system = [
    "You edit text for a small business website, exactly as asked. Reply only with the JSON shape requested.",
    "",
    "Rules:",
    "- Do what the instruction says and nothing more: keep everything it does not ask you to change, in the same order, in the same words.",
    "- Invent no facts, numbers, prices, dates, quotes, names or claims. Where the instruction needs a fact the text does not have, write around it.",
    "- Return the WHOLE text as markdown, using only: paragraphs, headings from ## to ###### (never a # heading), **bold**, *italic*, ~~strikethrough~~, [links](url), - bullet lists, 1. numbered lists, > quotes, ``` code blocks, and --- dividers.",
    "- No tables, no raw HTML, no footnotes. Keep every image line (![alt](src) or <img …>) and every bare video link (YouTube, Vimeo) exactly as it is, where it is, unless the instruction says to remove or move it.",
    "- Keep the language the text is written in. Use no em-dashes; a comma, a colon or two sentences instead.",
    voice.tone || rules.length ? "- Follow the site's copy voice below." : "",
  ].filter(Boolean).join("\n");
  const user = [
    `Site: ${c.name || "(unnamed)"}`,
    voice.tone ? `Tone: ${voice.tone}` : null,
    rules.length ? "Voice rules:\n" + rules.map((x) => `- ${x}`).join("\n") : null,
    "",
    `Instruction: ${String(r.instruction || "").trim()}`,
    "",
    text ? `The ${what}, as it stands:\n${text}` : `The ${what} is empty: write it from the instruction.`,
  ].filter((l) => l !== null).join("\n");
  return { system, user };
}

// What goes back into the editor: the reply's markdown held to the editor's subset.
function clean(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  let md = String(r.markdown || "").replace(/\r\n/g, "\n");
  md = md.replace(/^#\s+/gm, "## ");                                            // no H1: the page shows the title
  md = md.replace(/\s*—\s*/g, ", ").replace(/\s+–\s+/g, ", ");                   // no em-dashes
  // Stray HTML goes, except the editor's own image lines (and a line break).
  md = md.replace(/<(?!img\b|br\s*\/?>)[^>]+>/gi, "");
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  if (md.length > MAX_OUT) md = md.slice(0, MAX_OUT).replace(/\s+\S*$/, "");
  return md;
}

module.exports = { prompt, clean, SCHEMA };
