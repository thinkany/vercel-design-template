// ©2026 thinkany llc. All rights reserved.
// POST WRITER TEST — `node desktop/dev/post-writer.test.cjs`.
// The pure half of "Create with AI" for posts: the prompt carries the site's copy
// voice, tags and recent posts; the cleaner leaves a post the editor can save.
const assert = require("node:assert");
const W = require("../post-writer.cjs");
let checks = 0;
const is = (got, want, msg) => { checks++; assert.deepStrictEqual(got, want, msg); };
const ok = (v, msg) => { checks++; assert.ok(v, msg); };

const ctx = { name: "Marlow & Finch", url: "https://marlow.example", publisher: { name: "Marlow & Finch", type: "LocalBusiness" },
  voice: { tone: "Warm, plain, confident", rules: ["Never say 'leverage'", "Short sentences"] },
  tags: ["Kitchens", "advice"], titles: ["Why oak?"], samples: [{ title: "Why oak?", excerpt: "Oak wears in, not out. " + "x".repeat(2000) }] };
const { system, user } = W.prompt({ title: "Choosing a worktop", brief: "Compare oak, quartz and laminate for a family kitchen." }, ctx);
ok(system.includes("invent no numbers"), "the system prompt forbids invented facts");
ok(system.includes("never a # title line"), "no H1 in the body");
ok(user.includes("Tone: Warm, plain, confident") && user.includes("- Never say 'leverage'"), "tone and rules reach the prompt");
ok(user.includes("Existing tags: Kitchens, advice"), "existing tags are offered");
ok(user.includes("Why oak?") && user.includes("Oak wears in"), "a recent post is a voice sample");
ok(!user.includes("x".repeat(800)), "the sample is cut to its cap");
ok(user.endsWith("Brief: Compare oak, quartz and laminate for a family kitchen."), "the brief closes the prompt");
const bare = W.prompt({ title: "T" }, { name: "S" });
ok(!bare.user.includes("Copy voice") && bare.user.includes("(none given"), "no voice, no brief: says so, no empty sections");

const out = W.clean({
  title: "“Choosing a worktop — the honest guide”",
  description: "Oak, quartz and laminate — what each is like to live with.",
  body: "# Choosing a worktop\n\nOak wears in — not out.\n\n\n\n## Quartz\n\nA range of 2–3 mm is normal; wide – open gaps are not.\n",
  tags: ["kitchens", "Kitchens", " Advice ", "worktops", "a", "b", "c"],
  seo: { title: "Choosing a worktop: oak, quartz or laminate.", description: "x", keyphrase: "Kitchen Worktop Choice!", jsonld: "{\"@type\":\"FAQPage\"}" },
}, { title: "Choosing a worktop" }, ctx);
is(out.title, "Choosing a worktop, the honest guide", "title: quotes off, em-dash to a comma");
is(out.description, "Oak, quartz and laminate, what each is like to live with.", "summary: em-dash to a comma");
is(out.body, "Oak wears in, not out.\n\n## Quartz\n\nA range of 2–3 mm is normal; wide, open gaps are not.", "body: H1 dropped, dashes fixed, a numeric range kept, blank runs collapsed");
is(out.tags, ["Kitchens", "advice", "worktops", "a", "b"], "tags: deduped, existing casing kept, capped at five");
is(out.seo, { title: "Choosing a worktop: oak, quartz or laminate", description: "x", keyphrase: "kitchen worktop choice" }, "seo: cleaned the way the SEO fill cleans, no jsonld");
is(W.clean({}, { title: "Fallback" }, {}).title, "Fallback", "an empty reply keeps the designer's title");
ok(W.SCHEMA.required.includes("body") && W.SCHEMA.properties.seo.required.includes("keyphrase"), "the schema asks for everything the editor fills");
console.log(`post-writer: ${checks} checks pass.`);
