// ©2026 thinkany llc. All rights reserved.
// SEO fill: the pure half of the "SEO" button in the CMS editors (page, post,
// content-type entry). Turns what the designer is editing into the text the
// model reads, builds the prompt, and cleans what comes back into the fields
// the editor can take. No I/O and no SDK here; main.cjs makes the one call.
//   node desktop/dev/seo-fill.test.cjs

const TITLE_MAX = 60;   // what search results show without cutting
const DESC_MAX = 155;
const KEYPHRASE_MAX = 80;
const CONTENT_MAX = 24000; // characters of content sent; a long page's tail is cut, and the prompt says so

// Prop keys whose values are never copy a visitor reads.
const SKIP_KEYS = new Set(["src", "href", "url", "id", "key", "type", "_wp", "icon", "variant", "className", "class", "style", "target", "rel", "width", "height", "align", "layout", "background", "color", "tone", "size", "aspect"]);
const looksLikeAddress = (s) => /^(\/|https?:|#|mailto:|tel:|data:)/i.test(s);

// Every visible string under a block's props, in source order. Image alt text counts
// (it names what the picture shows); addresses, ids and style choices don't.
function strings(v, out, key) {
  if (v == null) return out;
  if (typeof v === "string") {
    const s = v.replace(/\s+/g, " ").trim();
    if (s.length > 1 && !looksLikeAddress(s) && !SKIP_KEYS.has(key)) out.push(s);
    return out;
  }
  if (Array.isArray(v)) { for (const x of v) strings(x, out, key); return out; }
  if (typeof v === "object") { for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) strings(x, out, k); }
  return out;
}

// Markdown read as its words: images become their alt text, links their label,
// headings and emphasis lose their marks, HTML tags are dropped.
function plainMarkdown(md) {
  return String(md || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[ \t]*[-*+]\s+/gm, "")
    .replace(/^[ \t]*\d+\.\s+/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockLines(blocks) {
  const out = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || typeof b.type !== "string") continue;
    const lines = strings(b.props, [], "");
    if (!lines.length) continue;
    out.push(`[${b.type}]`, ...lines, "");
  }
  return out;
}

// The content the model reads, as lines. `payload` is what the editor holds right
// now (unsaved edits included), one of:
//   { kind: "page",  title, route, blocks }
//   { kind: "post",  title, route, description, body, tags, date }
//   { kind: "entry", title, route, typeLabel, fields: [{ label, kind, value }], blocks|null }
function contentText(payload) {
  const p = payload || {};
  const out = [];
  if (p.kind === "post") {
    if (p.description) out.push(`Summary: ${String(p.description).trim()}`, "");
    if (Array.isArray(p.tags) && p.tags.length) out.push(`Tags: ${p.tags.join(", ")}`, "");
    const body = plainMarkdown(p.body);
    if (body) out.push(body);
  } else if (p.kind === "entry") {
    for (const f of Array.isArray(p.fields) ? p.fields : []) {
      if (!f || f.value == null || f.value === "") continue;
      if (f.kind === "reference" || f.kind === "boolean") continue; // ids and switches say nothing a visitor reads
      let v = f.value;
      if (f.kind === "richtext") v = plainMarkdown(v);
      else if (f.kind === "image") v = v && typeof v === "object" ? (v.alt || "") : "";
      else if (f.kind === "link") v = v && typeof v === "object" ? (v.label || "") : "";
      else if (f.kind === "list") v = Array.isArray(v) ? v.join("; ") : String(v);
      else v = String(v);
      v = v.trim();
      if (v) out.push(`${f.label || "Field"}: ${v}`);
    }
    if (out.length) out.push("");
    out.push(...blockLines(p.blocks));
  } else {
    out.push(...blockLines(p.blocks));
  }
  let text = out.join("\n").trim();
  let truncated = false;
  if (text.length > CONTENT_MAX) { text = text.slice(0, CONTENT_MAX); truncated = true; }
  return { text, truncated };
}

// The first picture the content shows, for an empty share image.
function firstImage(payload) {
  const p = payload || {};
  if (p.kind === "post" && typeof p.image === "string" && p.image.trim()) return p.image.trim();
  const find = (v) => {
    if (!v || typeof v !== "object") return "";
    if (typeof v.src === "string" && v.src.trim() && !/^data:/i.test(v.src)) return v.src.trim();
    for (const x of Array.isArray(v) ? v : Object.values(v)) { const r = find(x); if (r) return r; }
    return "";
  };
  if (p.kind === "entry") {
    for (const f of Array.isArray(p.fields) ? p.fields : []) if (f && f.kind === "image") { const r = find(f.value); if (r) return r; }
  }
  for (const b of Array.isArray(p.blocks) ? p.blocks : []) { const r = find(b && b.props); if (r) return r; }
  if (p.kind === "post") { const m = /!\[[^\]]*\]\(([^)\s]+)/.exec(String(p.body || "")); if (m && !/^data:/i.test(m[1])) return m[1]; }
  return "";
}

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The SEO title, at most 60 characters, without the site name." },
    description: { type: "string", description: "The meta description, one or two sentences, at most 155 characters." },
    keyphrase: { type: "string", description: "The phrase this page should be found for, two to five words from the content." },
    jsonld: { type: "string", description: "A JSON-LD object as JSON text when the content clearly is an FAQ, event, product, recipe, how-to, course or job posting; otherwise an empty string." },
  },
  required: ["title", "description", "keyphrase", "jsonld"],
  additionalProperties: false,
};

// `site`: { name, url, separator, publisher: { type, name, address, phone } }.
function prompt(payload, site) {
  const p = payload || {};
  const s = site || {};
  const { text, truncated } = contentText(p);
  const what = p.kind === "post" ? "a blog post" : p.kind === "entry" ? `a ${p.typeLabel || "content"} entry` : "a page";
  const system = [
    "You write search metadata for pages of a small business website. Reply only with the JSON shape requested.",
    "",
    "Rules:",
    `- title: at most ${TITLE_MAX} characters, the page's subject as a person would search for it, in the wording the content uses. Never include the site name; the site appends it after a separator. No trailing punctuation.`,
    `- description: one or two plain sentences, at most ${DESC_MAX} characters, saying what a visitor finds on this page. Describe only what the content says; invent no claims, numbers, awards or offers. No quotation marks, no exclamation marks, no call to action unless the page itself makes one.`,
    "- keyphrase: two to five words, lowercase, taken from the content's own words, that this page should be found for. Not the site name.",
    "- jsonld: only when the content clearly is one of: an FAQ (question and answer pairs), an event, a product with a price, a recipe, a how-to with steps, a course, a job posting. Then one JSON object with \"@type\" and only the values the content states; no \"@context\" (the site adds it), and never WebPage, BreadcrumbList, Organization, LocalBusiness, Person or BlogPosting (the site carries those already). Otherwise an empty string.",
    "- Write in the language the content is written in. Use no em-dashes.",
  ].join("\n");
  const ctx = [
    `Site: ${s.name || "(unnamed)"}${s.url ? ` (${s.url})` : ""}`,
    s.publisher && s.publisher.name ? `Publisher: ${s.publisher.name}${s.publisher.type ? ` (${s.publisher.type})` : ""}${s.publisher.address ? `, ${s.publisher.address}` : ""}` : "",
    `This is ${what}${p.route ? ` at ${p.route}` : ""}.`,
    `Title as written: ${String(p.title || "").trim() || "(none)"}`,
    p.seo && (p.seo.title || p.seo.description || p.seo.keyphrase)
      ? `Current SEO fields (to be replaced): title "${p.seo.title || ""}", description "${p.seo.description || ""}", keyphrase "${p.seo.keyphrase || ""}"`
      : "",
    "",
    truncated ? "Content (the end of a long page is cut off here):" : "Content:",
    text || "(the page has no text yet; write from the title alone)",
  ].filter((l) => l !== "").join("\n");
  return { system, user: ctx };
}

// Words up to a limit, cut at a word boundary; a lone fragment is kept whole.
function capWords(s, max) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.!?-]+$/, "");
}
const noDashes = (s) => String(s || "").replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ").replace(/^["'“‘]+|["'”’]+$/g, "");

// What the editor writes into its fields. Text fields are replaced (the designer
// asked for them). A custom schema already written by hand is kept; the model's
// is used only when that field is empty and parses to an object or array.
function clean(raw, existingSeo) {
  const r = raw && typeof raw === "object" ? raw : {};
  const cur = existingSeo && typeof existingSeo === "object" ? existingSeo : {};
  const out = {
    title: capWords(noDashes(r.title), TITLE_MAX).replace(/[.:;,\s]+$/, ""),
    description: capWords(noDashes(r.description), DESC_MAX),
    keyphrase: capWords(noDashes(r.keyphrase), KEYPHRASE_MAX).toLowerCase().replace(/[.!?]+$/, ""),
  };
  if (!cur.jsonld && typeof r.jsonld === "string" && r.jsonld.trim()) {
    try {
      const v = JSON.parse(r.jsonld);
      if (v && typeof v === "object") {
        const t = String((Array.isArray(v) ? (v[0] && v[0]["@type"]) : v["@type"]) || "");
        if (!/^(WebPage|BreadcrumbList|Organization|LocalBusiness|Person|BlogPosting|WebSite)$/i.test(t)) out.jsonld = JSON.stringify(v, null, 2);
      }
    } catch { /* not JSON: dropped */ }
  }
  return out;
}

module.exports = { contentText, firstImage, prompt, clean, SCHEMA, plainMarkdown, TITLE_MAX, DESC_MAX };
