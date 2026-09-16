// ©2026 thinkany llc. All rights reserved.
// "Create with AI" for blog posts: the pure half (prompt + reply cleaning) of the
// post:write handler in main.cjs, testable without a key. The designer gives a title
// and a brief; Claude writes the post in the project's copy voice (tone + rules, the
// same ones the design agent follows), with its summary, tags and search metadata,
// and the editor opens on it as a draft. Precedent: seo-fill.cjs.
const SEO = require("./seo-fill.cjs");

const TITLE_MAX = 120;
const SUMMARY_MAX = 200;   // the blog list's summary, and the default meta description
const BODY_MAX = 60000;
const TAG_MAX = 5;
const SAMPLE_MAX = 700;    // characters of a recent post shown as a voice sample
const SAMPLES = 2;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The post's title, as it will appear on the page." },
    description: { type: "string", description: "The summary shown in the blog list: one or two sentences, at most 200 characters." },
    body: { type: "string", description: "The post in markdown: ## and ### headings, short paragraphs, lists where they help. No title line (the page shows the title)." },
    tags: { type: "array", items: { type: "string" }, description: "One to five tags, the site's existing tags where they fit." },
    seo: {
      type: "object",
      properties: {
        title: { type: "string", description: "The SEO title, at most 60 characters, without the site name." },
        description: { type: "string", description: "The meta description, one or two sentences, at most 155 characters." },
        keyphrase: { type: "string", description: "The phrase this post should be found for, two to five words from the content." },
      },
      required: ["title", "description", "keyphrase"],
      additionalProperties: false,
    },
  },
  required: ["title", "description", "body", "tags", "seo"],
  additionalProperties: false,
};

// `brief`: { title, brief }. `ctx`: { name, url, publisher, voice: { tone, rules },
// tags: [], titles: [], samples: [{ title, excerpt }] }.
function prompt(brief, ctx) {
  const b = brief || {};
  const c = ctx || {};
  const voice = c.voice || {};
  const rules = (voice.rules || []).map((r) => String(r).trim()).filter(Boolean);
  const system = [
    "You write blog posts for a small business website. Reply only with the JSON shape requested.",
    "",
    "Rules:",
    "- Write the post the brief asks for, in the site's copy voice below when one is given. Say what the brief says; where the brief gives no fact, write around it: invent no numbers, prices, dates, quotes, awards, customer names or claims.",
    "- body: markdown. Headings are ## and ### only, never a # title line (the page shows the title). Short paragraphs, lists where they help, 500 to 900 words unless the brief asks for another length. No links unless the brief gives the address. No sign-off, no \"in conclusion\".",
    `- description: the summary shown in the blog list, one or two plain sentences, at most ${SUMMARY_MAX} characters, no quotation marks.`,
    `- tags: one to ${TAG_MAX}, lowercase, the site's existing tags where they fit, a new one only when none does.`,
    `- seo.title: at most ${SEO.TITLE_MAX} characters, the post's subject as a person would search for it, without the site name, no trailing punctuation. seo.description: at most ${SEO.DESC_MAX} characters, what a reader finds in the post. seo.keyphrase: two to five lowercase words from the post.`,
    "- Write in the language the brief is written in. Use no em-dashes anywhere; a comma, a colon or two sentences instead.",
  ].join("\n");
  const samples = (c.samples || []).slice(0, SAMPLES).filter((s) => s && s.excerpt);
  const user = [
    `Site: ${c.name || "(unnamed)"}${c.url ? ` (${c.url})` : ""}`,
    c.publisher && c.publisher.name ? `Publisher: ${c.publisher.name}${c.publisher.type ? ` (${c.publisher.type})` : ""}` : "",
    voice.tone || rules.length ? "" : null,
    voice.tone || rules.length ? "Copy voice for this site (follow it):" : null,
    voice.tone ? `Tone: ${voice.tone}` : null,
    rules.length ? "Rules:\n" + rules.map((r) => `- ${r}`).join("\n") : null,
    c.tags && c.tags.length ? `\nExisting tags: ${c.tags.join(", ")}` : null,
    c.titles && c.titles.length ? `Existing posts (write something new, not one of these): ${c.titles.slice(0, 40).join(" | ")}` : null,
    samples.length ? "\nRecent posts, for the voice:\n" + samples.map((s) => `[${s.title}]\n${String(s.excerpt).slice(0, SAMPLE_MAX)}`).join("\n\n") : null,
    "",
    `Title: ${String(b.title || "").trim()}`,
    `Brief: ${String(b.brief || "").trim() || "(none given: write from the title alone)"}`,
  ].filter((l) => l !== null && l !== "").join("\n");
  return { system, user };
}

// Em-dashes become a comma; a spaced en-dash too (a range like 2–3 is left alone).
const noDashes = (s) => String(s || "").replace(/\s*—\s*/g, ", ").replace(/\s+–\s+/g, ", ");
function cap(s, max) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max); const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.!?-]+$/, "");
}

// What the handler writes into the post file.
function clean(raw, brief, ctx) {
  const r = raw && typeof raw === "object" ? raw : {};
  const b = brief || {};
  const existing = ((ctx && ctx.tags) || []).map((t) => String(t));
  const title = cap(noDashes(r.title), TITLE_MAX).replace(/^["'“‘]+|["'”’]+$/g, "") || String(b.title || "").trim();
  // The body: no title line of its own, no dashes, trimmed.
  let body = String(r.body || "").replace(/\r\n/g, "\n").trim();
  body = body.replace(/^#\s+[^\n]*\n+/, ""); // a leading # heading is the title again
  body = noDashes(body).replace(/\n{3,}/g, "\n\n").trim();
  if (body.length > BODY_MAX) body = body.slice(0, BODY_MAX).replace(/\s+\S*$/, "");
  // Tags: trimmed, deduped, an existing tag keeps its own casing.
  const seen = new Set(); const tags = [];
  for (const t of Array.isArray(r.tags) ? r.tags : []) {
    const s = String(t || "").replace(/\s+/g, " ").trim(); if (!s) continue;
    const k = s.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    tags.push(existing.find((e) => e.toLowerCase() === k) || s.toLowerCase());
    if (tags.length >= TAG_MAX) break;
  }
  const seo = SEO.clean(r.seo || {}, {});
  delete seo.jsonld;
  return { title, description: cap(noDashes(r.description), SUMMARY_MAX).replace(/^["'“‘]+|["'”’]+$/g, ""), body, tags, seo };
}

module.exports = { prompt, clean, SCHEMA, SUMMARY_MAX, SAMPLE_MAX, SAMPLES };
