// ©2026 thinkany llc. All rights reserved.
// Fixture test for the WordPress importer (desktop/wp-import.cjs): inventory,
// skeleton, HTML → markdown, and a full transform into a scratch project.
//   node desktop/dev/wp-import.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const W = require("../wp-import.cjs");

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "wp-payload.json"), "utf8"));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; } };
const ta = async (name, fn) => { try { await fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exitCode = 1; } };

t("payload validates", () => assert.deepEqual(W.validatePayload(payload), { ok: true }));
t("payload rejects the wrong kind", () => assert.equal(W.validatePayload({ kind: "x", version: 1 }).ok, false));

const inv = W.inventory(payload);
t("inventory counts", () => {
  assert.equal(inv.counts.pages, 6);
  assert.equal(inv.counts.posts, 2);
  assert.equal(inv.counts.byType.team, 2);
  assert.equal(inv.counts.images, 4);
  assert.equal(inv.counts.imagesMissingAlt, 1);
  assert.equal(inv.counts.classicPages, 3);
  assert.equal(inv.counts.forms, 1);
  assert.ok(inv.pages.find((p) => p.id === 10).home);
  assert.deepEqual(inv.acfBlocks.find((b) => b.name === "acf/hero").fields.sort(), ["button", "extra_note", "heading", "hero_copy", "image", "subheading"]);
  assert.deepEqual(inv.acfBlocks.find((b) => b.name === "acf/hero").layoutFields.sort(), ["deactivate_block", "hero_height", "hide_on_mobile", "padding", "section_id"]);
  assert.equal(inv.acfBlocks.find((b) => b.name === "acf/hero").uses, 3);
});
t("field purposes: conditional logic, type, usage, name", () => {
  const c = W.classifyFields(payload)["acf/hero"].byName;
  assert.equal(c.heading.purpose, "content");
  assert.equal(c.image.purpose, "content");
  assert.equal(c.side.purpose, "variant");
  assert.equal(c.side.inUse, true, "two values across the site");
  assert.deepEqual(c.side.options, { left: "Left", right: "Right" });
  assert.equal(c.show_button.purpose, "variant");
  assert.deepEqual(c.show_button.reveals, ["button"], "a field that gates another is a variant");
  assert.deepEqual(c.button.revealedBy, ["show_button"]);
  assert.equal(c.hero_height.purpose, "layout", "tuning the old look is layout, whatever its type");
  assert.equal(c.tone.purpose, "variant");
  assert.equal(c.padding.purpose, "layout");
  assert.equal(c.extra_note.purpose, "content", "a field the definitions don't know is content by default");
  const inv2 = W.inventory(payload);
  const hero = inv2.acfBlocks.find((b) => b.name === "acf/hero");
  assert.deepEqual(hero.variants.filter((v) => v.inUse).map((v) => v.name).sort(), ["show_button", "side", "tone"]);
  assert.match(W.inventoryMarkdown(inv2), /options: .*side \(Left ×2, Right ×1\)/);
  const sk = W.mappingSkeleton(payload, []);
  assert.deepEqual(Object.keys(sk.blocks["acf/hero"]._variants).sort(), ["show_button", "side", "tone"]);
  assert.deepEqual(sk.blocks["acf/hero"]._variants.side.used, { left: 2, right: 1 });
  assert.equal(sk.blocks["acf/hero"].carry, true);
  const d = W.definitionsForSkill(payload);
  const svc = d.pages.find((p) => p.id === 14);
  assert.deepEqual(svc.blocks[0].variants, { tone: "light", side: "right", show_button: false });
  assert.ok(!("hero_height" in (svc.blocks[0].variants || {})) && !("hero_height" in svc.blocks[0].fields));
});
t("inventory markdown reads", () => {
  const md = W.inventoryMarkdown(inv);
  assert.match(md, /# Harbor Dental/);
  assert.match(md, /- 6 pages \(3 classic, no blocks\)/);
  assert.match(md, /Home \(home\) `\/`: hero, features, core\/heading/);
  assert.match(md, /  - Our Team `\/about-us\/team`: classic HTML/);
  assert.match(md, /2 Team members \(custom type "team"\)/);
});
t("definitions for the skill carry names and samples, not content", () => {
  const d = W.definitionsForSkill(payload);
  const home = d.pages.find((p) => p.id === 10);
  assert.equal(home.blocks[0].fields.subheading, "We look after families across the harbor. Same-day appointments & weekend hours.");
  assert.equal(home.blocks[0].fields.image, "{image reception.jpg}");
  assert.equal(home.blocks[0].fields.button, "{link Book a visit → https://harbordental.example/about-us/team/}");
  assert.equal(home.blocks[1].fields.items, "[list of 2: name, text, icon]");
  assert.equal(d.customTypeSamples.team.length, 2);
});

const blocks = [
  { key: "hero", name: "Hero", fields: { eyebrow: { kind: "string" }, heading: { kind: "string" }, body: { kind: "richtext" }, image: { kind: "image" }, "image.src": { kind: "string" }, "image.alt": { kind: "string" }, ctas: { kind: "list" }, "ctas.label": { kind: "string" }, "ctas.href": { kind: "string" }, "ctas.style": { kind: "enum", options: ["primary", "secondary"] }, tone: { kind: "enum", options: ["light", "dark"] } } },
  { key: "features", name: "Features", fields: { heading: { kind: "string" }, items: { kind: "list" }, "items.title": { kind: "string" }, "items.text": { kind: "string" }, "items.icon": { kind: "image" } } },
  { key: "prose", name: "Prose", fields: { body: { kind: "richtext" } } },
  { key: "faq", name: "FAQ", fields: { heading: { kind: "string" }, items: { kind: "list" }, "items.q": { kind: "string" }, "items.a": { kind: "richtext" } } },
  { key: "table", name: "Table", fields: { rows: { kind: "list" }, "rows.cells": { kind: "list" }, header: { kind: "boolean" }, caption: { kind: "string" } } },
];

t("skeleton has every slot", () => {
  const sk = W.mappingSkeleton(payload, blocks);
  assert.equal(sk.version, 1);
  assert.equal(sk.pages[0].page, "home");
  assert.equal(sk.pages.find((p) => p.wp === 13).page, "team");
  assert.deepEqual(Object.keys(sk.blocks).sort(), ["acf/faq", "acf/features", "acf/hero", "acf/testimonial"]);
  assert.deepEqual(sk.blocks["acf/hero"]._wpFields.sort(), ["button", "extra_note", "heading", "hero_copy", "image", "subheading"]);
  assert.deepEqual(sk.blocks["acf/hero"]._layoutFields.sort(), ["deactivate_block", "hero_height", "hide_on_mobile", "padding", "section_id"]);
  assert.equal(sk.blocks["acf/hero"].skipWhen, "deactivate_block");
  assert.equal(sk.nav, "primary");
  assert.equal(sk.types.team.include, false);
  assert.equal(sk.availableBlocks.length, 5);
});

t("html → markdown: prose, lists, links, entities, lost nodes, tables as data", () => {
  const r = W.htmlToMarkdown('<h2>Hi &amp; bye</h2><p>One <strong>two</strong> <a href="/x">three</a><br>four</p><ul><li>a<ul><li>b</li></ul></li><li>c</li></ul><iframe src="https://e.x"></iframe>[shortcode x="1"]<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><p>after</p><blockquote><p>q</p></blockquote><pre>code</pre><hr><figure><img src="/i.jpg" alt="I"><figcaption>cap</figcaption></figure>');
  assert.equal(r.segments[0].kind, "md");
  assert.match(r.segments[0].md, /^## Hi & bye\n\nOne \*\*two\*\* \[three\]\(\/x\)  \nfour\n\n- a\n  - b\n- c$/);
  assert.equal(r.segments[1].kind, "table");
  assert.deepEqual(r.segments[1].rows, [["A", "B"], ["1", "2"]]);
  assert.equal(r.segments[1].header, true);
  assert.match(r.segments[2].md, /^after\n\n> q\n\n```\ncode\n```\n\n---\n\n!\[I\]\(\/i\.jpg\)\n\n\*cap\*$/);
  assert.deepEqual(r.lost.map((l) => l.node), ["shortcode [shortcode]", "iframe"]);
});
t("pick splits a wysiwyg field into heading and rest", async () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "wp-pick-"));
  fs.mkdirSync(path.join(dir2, "content"), { recursive: true });
  const m = { version: 1, pages: [{ wp: 14, page: "services", include: true }], blocks: { "acf/hero": { block: "hero", fields: { heading: { from: "hero_copy", pick: "heading" }, body: { from: "hero_copy", pick: "rest" } } } }, posts: { import: false }, media: { download: false } };
  const r = await W.transform(dir2, payload, m, { blocks });
  assert.ok(r.ok, JSON.stringify(r.errors));
  const doc = JSON.parse(fs.readFileSync(path.join(dir2, "content", "pages", "services.json"), "utf8"));
  assert.equal(doc.blocks[0].props.heading, "Services & care");
  assert.equal(doc.blocks[0].props.body, "Everything from checkups to implants.\n\nSame-day slots.");
  fs.rmSync(dir2, { recursive: true, force: true });
});
t("html → markdown: unclosed paragraphs and nested containers", () => {
  const r = W.htmlToMarkdown('<div class="wrap"><p>a<p>b</div><ol><li>1</li><li>2</li></ol>');
  assert.equal(r.md, "a\n\nb\n\n1. 1\n2. 2");
});

const mapping = {
  version: 1,
  pages: [
    { wp: 10, page: "home", include: true },
    { wp: 11, page: "blog", include: false },
    { wp: 12, page: "about", include: true },
    { wp: 13, page: "team", include: true },
    { wp: 14, page: "services", include: true },
    { wp: 15, page: "old-promotions", include: false },
  ],
  blocks: {
    "acf/hero": { block: "hero", skipWhen: "deactivate_block", fields: { heading: "heading", body: "subheading", image: "image", "ctas[0]": { from: "button", each: { label: "title", href: "url", style: "=primary" } }, tone: "tone" } },
    "acf/features": { block: "features", fields: { heading: "title", items: { from: "items", each: { title: "name", text: "text", icon: "icon" } } } },
    "acf/faq": { block: "faq", fields: { heading: "faq_title", items: { from: "faq_groups", flatMap: "questions", each: { q: "question", a: "answer" } } } },
  },
  prose: { block: "prose", prop: "body" },
  tables: { block: "table", rows: "rows", header: "header", caption: "caption" },
  posts: { import: true, type: "post", categoriesAsTags: true },
  types: { team: { include: true, key: "team", label: "Team", singular: "Team member", path: "/team", fields: { role: "role", bio: { key: "bio" }, photo: "photo", accepting: "accepting" } } },
  nav: "primary",
  media: { download: true, folder: "wp" },
};

t("mapping validates, and catches a bad id", () => {
  assert.deepEqual(W.validateMapping(mapping, blocks), []);
  const bad = JSON.parse(JSON.stringify(mapping)); bad.pages[2].page = "About Us"; bad.blocks["acf/hero"].block = "nope";
  const errs = W.validateMapping(bad, blocks);
  assert.equal(errs.length, 2);
});

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-import-"));
  fs.mkdirSync(path.join(dir, "content", "pages"), { recursive: true });
  fs.writeFileSync(path.join(dir, "content", "site.json"), JSON.stringify({ design: "v01", url: "https://new.example", nav: [{ label: "Old", href: "/old" }], footerLinks: [], redirects: [{ from: "/legacy", to: "/", type: 301 }] }, null, 2));
  fs.writeFileSync(path.join(dir, "content", "types.json"), JSON.stringify({ types: [] }));
  const fetched = [];
  const fetchMedia = async (att, folder) => { fetched.push(att.id); if (att.id === 502) throw new Error("404"); return `/images/${folder}/${att.filename.replace(/\.(jpe?g|png)$/i, ".avif")}`; };

  await ta("transform writes pages, posts, types, nav, redirects", async () => {
    const r = await W.transform(dir, payload, mapping, { blocks, fetchMedia, blogPath: "blog" });
    assert.ok(r.ok, JSON.stringify(r.errors));
    const rep = r.report;
    const home = JSON.parse(fs.readFileSync(path.join(dir, "content", "pages", "home.json"), "utf8"));
    assert.equal(home.title, "Home");
    assert.equal(home.slug, undefined);
    assert.equal(home.seo.title, "Harbor Dental | Gentle dentistry");
    assert.equal(home.seo.keyphrase, "waterfront dentist");
    // hero: text stripped, richtext converted, image fetched, link rewritten to the NEW route, enum kept
    const hero = home.blocks[0];
    assert.equal(hero.type, "hero");
    assert.equal(hero.props.heading, "Gentle care, every visit");
    assert.equal(hero.props.body, "We look after families across the harbor.\n\nSame-day appointments & weekend hours.");
    assert.deepEqual(hero.props.image, { src: "/images/wp/reception.avif", alt: "Our reception" });
    assert.deepEqual(hero.props.ctas, [{ label: "Book a visit", href: "/about/team", style: "primary" }]);
    assert.equal(hero.props.tone, "dark");
    assert.deepEqual(hero._wp, { block: "acf/hero", tone: "dark", side: "left", show_button: true }, "the old options ride along under _wp");
    assert.deepEqual(rep.variants["acf/hero"].side, { left: 1, right: 1 }, "the switched-off About hero is not counted");
    assert.ok(!("hero_height" in rep.variants["acf/hero"]));
    // features: repeater → list of objects, a failed image falls back to its old URL
    const feat = home.blocks[1];
    assert.equal(feat.type, "features");
    assert.equal(feat.props.heading, "Why families choose us");
    assert.equal(feat.props.items.length, 2);
    assert.equal(feat.props.items[0].title, "Kids welcome");
    assert.equal(feat.props.items[0].icon.src, "https://harbordental.example/wp-content/uploads/2024/01/kids.png");
    assert.equal(feat.props.items[1].icon, undefined);
    // prose run → prose block, table → Table block, prose again; the embed is lost; the testimonial is dropped
    assert.deepEqual(home.blocks.slice(2).map((b) => b.type), ["prose", "table", "prose"]);
    assert.match(home.blocks[2].props.body, /^## Opening hours\n\nCall us on \[\(555\) 010-2020\]\(tel:5550102020\) or \[read about us\]\(\/about\)\.$/);
    assert.deepEqual(home.blocks[3].props.rows, [{ cells: ["Day", "Hours"] }, { cells: ["Mon to Fri", "8 to 6"] }, { cells: ["Sat", "9 to 1"] }]);
    assert.equal(home.blocks[3].props.header, true);
    assert.equal(home.blocks[4].props.body, "Closed on public holidays.");
    const homeRep = rep.pages.find((p) => p.id === "home");
    assert.deepEqual(homeRep.dropped, ["acf/testimonial"]);
    assert.ok(homeRep.lost.some((l) => l.node === "core/embed" && l.text === "https://www.youtube.com/watch?v=abc"), "the embed is named in the report");
    assert.ok(!homeRep.lost.some((l) => l.node === "prose"), "nothing prose-like was dropped");
    assert.equal(rep.unmappedBlocks["acf/testimonial"], 1);
    assert.deepEqual(rep.unmappedFields["acf/hero"], ["extra_note", "hero_copy"]);
    // about: parent chain + page-level ACF fields reported
    const about = JSON.parse(fs.readFileSync(path.join(dir, "content", "pages", "about.json"), "utf8"));
    assert.equal(about.slug, "about");
    assert.equal(about.seo.description, "Who we are.");
    assert.equal(about.blocks[0].type, "prose", "the About hero was switched off on the old site, so it is skipped");
    assert.equal(about.blocks[0].props.body, "Founded in 2009. **Independent** and *local*.\n\n- Digital x-rays\n- Sedation options");
    assert.deepEqual(rep.skipped, [{ where: "about", block: "acf/hero", why: "deactivate_block" }]);
    assert.ok(!rep.unmappedFields["acf/hero"].includes("padding") && !rep.unmappedFields["acf/hero"].includes("section_id"), "layout fields are never reported as unmapped");
    assert.ok(rep.pages.find((p) => p.id === "about").lost.some((l) => l.node === "page-fields" && l.text === "sidebar_note"));
    // services: pick splits one wysiwyg into heading + rest (the mapping's plain "heading" is overridden per page by a second hero mapping below); flatMap flattens grouped FAQ items
    const services = JSON.parse(fs.readFileSync(path.join(dir, "content", "pages", "services.json"), "utf8"));
    assert.equal(services.blocks[1].type, "faq");
    assert.equal(services.blocks[1].props.heading, "Questions");
    assert.deepEqual(services.blocks[1].props.items, [{ q: "Do you take walk-ins?", a: "Yes, most days." }, { q: "Do you bill insurers?", a: "Directly." }]);
    const team = JSON.parse(fs.readFileSync(path.join(dir, "content", "pages", "team.json"), "utf8"));
    assert.equal(team.parent, "about");
    assert.equal(team.blocks[0].props.body, "## Meet the team\n\nTwo dentists, three hygienists.");
    const teamRep = rep.pages.find((p) => p.id === "team");
    assert.equal(teamRep.route, "/about/team");
    assert.deepEqual(teamRep.lost.map((l) => l.node), ["shortcode [gravityform]", "script"]);
    assert.ok(!fs.existsSync(path.join(dir, "content", "pages", "old-promotions.json")));
    // posts
    const post = fs.readFileSync(path.join(dir, "content", "posts", "brushing-tips-for-kids.md"), "utf8");
    assert.match(post, /^---\ntitle: Brushing tips for kids\ndate: "2025-03-02"\nupdated: "2025-03-03T09:30:00\+00:00"\ndescription: Three habits that stick\.\nimage: \/images\/wp\/kid\.avif\ntags: \[Oral health, Kids\]\nseo:\n  keyphrase: kids brushing\n---\n/);
    assert.match(post, /Start early\. Make it fun\.\n\n### Three habits\n\n1\. Twice a day\n2\. Two minutes\n3\. Spit, don't rinse\n\n!\[A child brushing\]\(\/images\/wp\/kid\.avif\)\n\n\*Two minutes, twice a day\*/);
    const draft = fs.readFileSync(path.join(dir, "content", "posts", "untitled-draft.md"), "utf8");
    assert.match(draft, /\ndraft: true\n/);
    assert.ok(!/Uncategorized/.test(draft));
    assert.equal(rep.posts.imported, 2); assert.equal(rep.posts.drafts, 1);
    // types
    const types = JSON.parse(fs.readFileSync(path.join(dir, "content", "types.json"), "utf8"));
    assert.equal(types.types[0].key, "team");
    assert.deepEqual(types.types[0].fields.map((f) => [f.key, f.kind, f.required]), [["role", "text", true], ["bio", "richtext", false], ["photo", "image", false], ["accepting", "boolean", false]]);
    const ana = JSON.parse(fs.readFileSync(path.join(dir, "content", "team", "ana-reyes.json"), "utf8"));
    assert.equal(ana.role, "Principal dentist");
    assert.equal(ana.bio, "Twenty years of **gentle** care.");
    assert.deepEqual(ana.photo, { src: "/images/wp/ana.avif", alt: "Dr. Ana Reyes" });
    assert.equal(ana.accepting, true);
    const sam = JSON.parse(fs.readFileSync(path.join(dir, "content", "team", "sam-okafor.json"), "utf8"));
    assert.equal(sam.accepting, false);
    assert.equal(sam.photo, undefined);
    // site.json: nav from the menu (page links → new routes, external kept), name, redirects merged
    const site = JSON.parse(fs.readFileSync(path.join(dir, "content", "site.json"), "utf8"));
    assert.equal(site.design, "v01");
    assert.deepEqual(site.nav.map((n) => [n.label, n.href, (n.links || []).map((l) => l.href)]), [["Home", "/", []], ["About Us", "/about", ["/about/team"]], ["Services", "/services", []], ["Blog", "/", []], ["Book", "https://booking.example/harbor", []]]);
    assert.equal(site.seo.siteName, "Harbor Dental");
    const red = Object.fromEntries(site.redirects.map((r) => [r.from, r.to]));
    assert.equal(red["/legacy"], "/");
    assert.equal(red["/about-us"], "/about");
    assert.equal(red["/about-us/team"], "/about/team");
    assert.equal(red["/brushing-tips-for-kids"], "/blog/brushing-tips-for-kids");
    assert.equal(red["/blog"], "/");
    assert.equal(red["/services"], undefined, "an unchanged address needs no redirect");
    assert.equal(rep.redirects, 4);
    assert.equal(rep.redirectsFlagged.length, 1, "a draft with no public address needs no redirect");
    // media: each attachment fetched once, the PDF never, the failure reported
    assert.deepEqual(fetched.sort(), [501, 502, 503, 504]);
    assert.equal(rep.media.downloaded, 3);
    assert.equal(rep.media.failed.length, 1);
    // report renders
    const md = W.reportMarkdown(rep);
    assert.match(md, /# Import report/);
    assert.match(md, /- acf\/testimonial ×1/);
    assert.match(md, /### Our Team → \/about\/team \(classic HTML\)/);
  });

  await ta("transform is re-runnable", async () => {
    const r = await W.transform(dir, payload, mapping, { blocks, fetchMedia, blogPath: "blog" });
    assert.ok(r.ok);
    const site = JSON.parse(fs.readFileSync(path.join(dir, "content", "site.json"), "utf8"));
    assert.equal(site.redirects.length, 5, "redirects don't duplicate on a second run");
  });

  await ta("transform refuses a bad mapping", async () => {
    const r = await W.transform(dir, payload, { version: 2 }, { blocks });
    assert.equal(r.ok, false);
    assert.ok(r.errors.length);
  });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
})();
