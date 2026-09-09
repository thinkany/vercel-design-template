// ©2026 thinkany llc. All rights reserved.
// Fixture test for the SEO fill's pure half (desktop/seo-fill.cjs): the text the
// model reads, the prompt, and the cleaning of what comes back.
//   node desktop/dev/seo-fill.test.cjs
const assert = require("node:assert/strict");
const SEO = require("../seo-fill.cjs");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; } };

const page = {
  kind: "page", title: "Island Guide", route: "/about/island-guide", seo: {},
  blocks: [
    { type: "Hero", props: { heading: "Explore Kauai by bike", sub: "Guided rides on the north shore", image: { src: "/images/hero.jpg", alt: "Riders on a coastal road" }, cta: { label: "Book a ride", href: "/contact" }, variant: "split" } },
    { type: "Faq", props: { items: [{ q: "Do I need my own bike?", a: "No, rentals are included." }, { q: "How long is a ride?", a: "About three hours." }] } },
    { type: "Spacer", props: { size: "lg" } },
  ],
};

t("page text keeps copy and alt text, drops addresses, ids and style choices", () => {
  const { text, truncated } = SEO.contentText(page);
  assert.equal(truncated, false);
  assert.match(text, /\[Hero\]\nExplore Kauai by bike\nGuided rides on the north shore\nRiders on a coastal road\nBook a ride/);
  assert.doesNotMatch(text, /\/images\/hero|\/contact|split|\[Spacer\]|lg/);
  assert.match(text, /\[Faq\]\nDo I need my own bike\?\nNo, rentals are included\./);
});

t("post text reads the markdown as words", () => {
  const { text } = SEO.contentText({ kind: "post", title: "x", description: "A short summary.", tags: ["rides", "kauai"], body: "## Heading\n\nSome **bold** text with a [link](/x) and ![a photo](/p.jpg).\n\n- one\n- two" });
  assert.equal(text, "Summary: A short summary.\n\nTags: rides, kauai\n\nHeading\n\nSome bold text with a link and a photo.\n\none\ntwo");
});

t("entry text lists fields by label, skipping references and switches", () => {
  const { text } = SEO.contentText({ kind: "entry", typeLabel: "Product", title: "Board", fields: [
    { label: "Price", kind: "text", value: "$120" }, { label: "Featured", kind: "boolean", value: true }, { label: "Category", kind: "reference", value: "abc" },
    { label: "Photo", kind: "image", value: { src: "/a.jpg", alt: "A red board" } }, { label: "Details", kind: "richtext", value: "Made of **cedar**." }, { label: "Sizes", kind: "list", value: ["S", "M"] },
  ], blocks: null });
  assert.equal(text, "Price: $120\nPhoto: A red board\nDetails: Made of cedar.\nSizes: S; M");
});

t("a long page is cut and says so in the prompt", () => {
  const big = { kind: "page", title: "Big", blocks: [{ type: "Prose", props: { body: "word ".repeat(9000) } }] };
  assert.equal(SEO.contentText(big).truncated, true);
  assert.match(SEO.prompt(big, {}).user, /cut off here/);
});

t("first image: the first src in the content, a post's own image first", () => {
  assert.equal(SEO.firstImage(page), "/images/hero.jpg");
  assert.equal(SEO.firstImage({ kind: "post", image: "/cover.jpg", body: "![x](/inline.jpg)" }), "/cover.jpg");
  assert.equal(SEO.firstImage({ kind: "post", image: "", body: "![x](/inline.jpg)" }), "/inline.jpg");
  assert.equal(SEO.firstImage({ kind: "page", blocks: [{ type: "A", props: { text: "no pictures" } }] }), "");
});

t("prompt carries the site context and the current fields", () => {
  const { system, user } = SEO.prompt({ ...page, seo: { title: "Old title" } }, { name: "Kauai Rides", url: "https://kauairides.com", publisher: { type: "LocalBusiness", name: "Kauai Rides LLC", address: "Hanalei, HI" } });
  assert.match(system, /at most 60 characters/);
  assert.match(system, /at most 155 characters/);
  assert.match(user, /^Site: Kauai Rides \(https:\/\/kauairides.com\)\nPublisher: Kauai Rides LLC \(LocalBusiness\), Hanalei, HI\nThis is a page at \/about\/island-guide\.\nTitle as written: Island Guide\nCurrent SEO fields \(to be replaced\): title "Old title"/);
  assert.match(user, /\nContent:\n\[Hero\]/);
  assert.match(SEO.prompt({ kind: "entry", typeLabel: "Product", title: "B", fields: [] }, {}).user, /This is a Product entry\./);
  assert.match(SEO.prompt({ kind: "page", title: "Empty", blocks: [] }, {}).user, /no text yet/);
});

t("schema names the four fields and nothing else", () => {
  assert.deepEqual(Object.keys(SEO.SCHEMA.properties), ["title", "description", "keyphrase", "jsonld"]);
  assert.equal(SEO.SCHEMA.additionalProperties, false);
});

t("clean caps at a word boundary, strips quotes and dashes, lowercases the keyphrase", () => {
  const out = SEO.clean({
    title: '"Explore Kauai by bike — guided rides on the north shore with rentals included every day"',
    description: "Guided bike rides on Kauai's north shore. Rentals are included, so you bring nothing but yourself and we take care of the rest of the day for you, every time.",
    keyphrase: "Kauai Bike Tours.",
    jsonld: "",
  }, {});
  assert.ok(out.title.length <= 60, out.title);
  assert.equal(out.title, "Explore Kauai by bike, guided rides on the north shore with");
  assert.ok(out.description.length <= 155, out.description);
  assert.doesNotMatch(out.description, /\s$/);
  assert.equal(out.keyphrase, "kauai bike tours");
  assert.equal("jsonld" in out, false);
});

t("clean keeps a model FAQ schema only into an empty field, and never a type the site carries", () => {
  const faq = JSON.stringify({ "@type": "FAQPage", mainEntity: [] });
  assert.equal(JSON.parse(SEO.clean({ title: "t", description: "d", keyphrase: "k", jsonld: faq }, {}).jsonld)["@type"], "FAQPage");
  assert.equal("jsonld" in SEO.clean({ title: "t", description: "d", keyphrase: "k", jsonld: faq }, { jsonld: "{}" }), false);
  assert.equal("jsonld" in SEO.clean({ title: "t", description: "d", keyphrase: "k", jsonld: JSON.stringify({ "@type": "WebPage" }) }, {}), false);
  assert.equal("jsonld" in SEO.clean({ title: "t", description: "d", keyphrase: "k", jsonld: "not json" }, {}), false);
  assert.equal("jsonld" in SEO.clean({ title: "t", description: "d", keyphrase: "k", jsonld: "\"a string\"" }, {}), false);
});

t("clean survives a bad reply", () => {
  assert.deepEqual(SEO.clean(null, null), { title: "", description: "", keyphrase: "" });
});

t("merge replaces the text fields and fills schema and image only when empty", () => {
  const seo = SEO.merge({ title: "old", jsonld: "{}", image: "/keep.jpg", noindex: true }, { title: "new", description: "d", keyphrase: "k", jsonld: "[]", image: "/new.jpg" });
  assert.deepEqual(seo, { title: "new", description: "d", keyphrase: "k", jsonld: "{}", image: "/keep.jpg", noindex: true });
  assert.deepEqual(SEO.merge({}, { title: "t", description: "", jsonld: "[]", image: "/i.jpg" }), { title: "t", jsonld: "[]", image: "/i.jpg" });
});

t("hasSeo needs a title and a description", () => {
  assert.equal(SEO.hasSeo({ title: "t", description: "d" }), true);
  assert.equal(SEO.hasSeo({ title: "t" }), false);
  assert.equal(SEO.hasSeo({ title: " ", description: "d" }), false);
  assert.equal(SEO.hasSeo(undefined), false);
});

if (!process.exitCode) console.log(`✓ ${passed} passed`);
