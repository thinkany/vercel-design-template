// ©2026 thinkany llc. All rights reserved.
// MENU SEED TEST — `node desktop/dev/menu-seed.test.cjs`.
//
// The model's reply is the one thing here we don't control, so `clean` is written
// to distrust it and this is where that gets proved: too many items, blank labels,
// a "Home" item, a mega shape arriving for a dropdown menu, missing arrays, junk
// types. Then `renderMenuTs` / `renderPagesTs` must emit source that parses and
// says what it should.
const assert = require("node:assert");
const M = require("../menu-seed.cjs");

let checks = 0;
const ok = (cond, label) => { checks++; assert.ok(cond, label); };
const eq = (a, b, label) => { checks++; assert.deepStrictEqual(a, b, label); };

// ---- idFor -------------------------------------------------------------------
eq(M.idFor("Our Services"), "our-services", "id from two words");
eq(M.idFor("Work"), "work", "id from one word");
eq(M.idFor("Residential & Commercial Design"), "residential-commercial", "id caps at two segments");
eq(M.idFor("What We’re About"), "what-were", "curly apostrophe folds away");
eq(M.idFor("!!!"), "page", "an unusable label still yields an id");
eq(M.idFor("Work", new Set(["work"])), "work-2", "a taken id gets a suffix");
eq(M.idFor("Work", new Set(["work", "work-2"])), "work-3", "and keeps counting");

// ---- label -------------------------------------------------------------------
eq(M.label("  Our   Work  "), "Our Work", "whitespace collapses");
eq(M.label("Contact."), "Contact", "trailing punctuation goes");
eq(M.label(""), "", "empty stays empty");
eq(M.label(null), "", "null is not a label");
eq(M.label(42), "42", "a number is coerced, not crashed on");
eq(M.label("x".repeat(500)), "", "an absurd string is rejected outright");
ok(M.label("x".repeat(40)).length === M.LABEL_MAX, "a long-but-plausible label is trimmed");

// ---- clean: the happy paths --------------------------------------------------
const dropdownReply = {
  items: [
    { label: "Work", links: ["Residential", "Commercial", "Heritage"], columns: [] },
    { label: "Studio", links: ["Our Approach", "Team"], columns: [] },
    { label: "Contact", links: [], columns: [] },
  ],
  featured: { label: "", blurb: "" },
};
const dropdown = M.clean(dropdownReply, "dropdown");
eq(dropdown.items.map((i) => i.id), ["work", "studio", "contact"], "dropdown ids");
eq(dropdown.items[0].menu.kind, "dropdown", "an item with links opens a dropdown");
eq(dropdown.items[0].menu.links.length, 3, "its links survive");
eq(dropdown.items[2].menu.kind, "none", "an item with no links opens nothing");
eq(dropdown.featured, null, "a dropdown menu has no featured panel");

const megaReply = {
  items: [
    { label: "Services", links: [], columns: [
      { heading: "By Practice", links: ["Residential", "Commercial"] },
      { heading: "By Stage", links: ["Concept", "Planning", "Delivery"] },
    ] },
    { label: "Contact", links: [], columns: [] },
  ],
  featured: { label: "Heritage Retrofit", blurb: "Our most requested service." },
};
const mega = M.clean(megaReply, "mega");
eq(mega.items[0].menu.kind, "mega", "an item with columns opens a mega");
eq(mega.items[0].menu.sections.length, 2, "its columns survive");
eq(mega.items[0].menu.featured.label, "Heritage Retrofit", "the featured panel lands on the first mega item");
ok(!mega.items[1].menu.featured, "and only on that one");

const none = M.clean(dropdownReply, "none");
ok(none.items.every((i) => i.menu.kind === "none"), "menuKind none leaves every item flat");
eq(none.items.length, 3, "but keeps the items themselves");

// ---- clean: the model misbehaving --------------------------------------------
eq(M.clean(null, "dropdown").items, [], "a null reply yields no items");
eq(M.clean({}, "dropdown").items, [], "an empty reply yields no items");
eq(M.clean({ items: "nope" }, "dropdown").items, [], "items as a string is ignored");
eq(M.clean({ items: [{ label: "Home", links: [], columns: [] }, { label: "Work", links: [], columns: [] }] }, "none")
    .items.map((i) => i.id), ["work"], "a Home item is always dropped");
eq(M.clean({ items: [{ label: "HOME", links: [], columns: [] }] }, "none").items, [], "however it is cased");
eq(M.clean({ items: [{ label: "", links: [], columns: [] }, { label: "  ", links: [], columns: [] }] }, "none").items, [],
  "items with no usable label are dropped");

const tooMany = M.clean({ items: Array.from({ length: 20 }, (_, i) => ({ label: `Page ${i}`, links: [], columns: [] })) }, "none");
eq(tooMany.items.length, M.MAX_ITEMS, "the item cap is re-applied, not trusted");

const tooManyLinks = M.clean({
  items: [{ label: "Work", links: Array.from({ length: 30 }, (_, i) => `Link ${i}`), columns: [] }],
}, "dropdown");
eq(tooManyLinks.items[0].menu.links.length, M.MAX_LINKS, "the link cap is re-applied");

const tooManyCols = M.clean({
  items: [{ label: "Work", links: [], columns: Array.from({ length: 9 }, (_, i) => ({ heading: `C${i}`, links: ["a", "b"] })) }],
}, "mega");
eq(tooManyCols.items[0].menu.sections.length, M.MAX_COLUMNS, "the column cap is re-applied");

// The wrong shape for the configured kind must not leak through.
const wrongShape = M.clean({
  items: [{ label: "Work", links: ["A", "B", "C"], columns: [{ heading: "X", links: ["y"] }] }],
}, "dropdown");
eq(wrongShape.items[0].menu.kind, "dropdown", "a dropdown build ignores stray columns");
const wrongShape2 = M.clean({
  items: [{ label: "Work", links: ["A", "B", "C"], columns: [{ heading: "X", links: ["y"] }] }],
}, "mega");
eq(wrongShape2.items[0].menu.kind, "mega", "a mega build ignores stray links");

// A column with no heading, or no links, is not a column.
const hollowCols = M.clean({
  items: [{ label: "Work", links: [], columns: [{ heading: "", links: ["a"] }, { heading: "Real", links: [] }, { heading: "Good", links: ["a"] }] }],
}, "mega");
eq(hollowCols.items[0].menu.sections.length, 1, "hollow columns are dropped");
eq(hollowCols.items[0].menu.sections[0].title, "Good", "and the real one survives");

// A featured panel needs both halves, and only applies to a mega.
eq(M.clean({ items: [{ label: "W", links: [], columns: [{ heading: "H", links: ["a"] }] }], featured: { label: "X", blurb: "" } }, "mega").featured,
  null, "a featured panel with no blurb is dropped");
eq(M.clean({ items: [{ label: "W", links: ["a"], columns: [] }], featured: { label: "X", blurb: "Y" } }, "dropdown").featured,
  null, "a featured panel on a dropdown build is dropped");

// Duplicate labels must not collide into one key.
const dupes = M.clean({ items: [{ label: "Work", links: [], columns: [] }, { label: "Work", links: [], columns: [] }] }, "none");
eq(dupes.items.map((i) => i.id), ["work", "work-2"], "duplicate labels get distinct ids");

// ---- the rendered source -----------------------------------------------------
function parses(src, what) {
  // The emitted file is TypeScript, so strip the bits node can't eval and check the
  // literal itself is syntactically sound — that is where a quoting bug would land.
  const body = src.replace(/^import .*$/gm, "").replace(/^export type .*$/gm, "")
    .replace(/: Record<string, ItemMenu>/g, "").replace(/: DesignPage\[\]/g, "")
    .replace(/ as ItemMenu/g, "").replace(/^export /gm, "")
    .replace(/^const menuFor.*$/gm, "").replace(/^const hasMenu.*$/gm, "").replace(/^const menuItemIds.*$/gm, "");
  checks++;
  new (require("node:vm").Script)(body, { filename: what });
}

const src = M.renderMenuTs(mega.items);
parses(src, "menu.ts");
ok(src.includes('kind: "mega"'), "the mega kind is emitted");
ok(src.includes('title: "By Practice"'), "column headings are emitted");
ok(src.includes('featured: { label: "Heritage Retrofit"'), "the featured panel is emitted");
ok(!src.includes("Shop by Category"), "the shop placeholder is gone");
ok(src.includes("menuForIn(navMenus"), "the schema helpers stay bound");

parses(M.renderMenuTs(dropdown.items), "menu.ts dropdown");
parses(M.renderMenuTs([]), "menu.ts empty");
ok(M.renderMenuTs([]).includes("designPages.map"), "an empty seed falls back to a flat map");

// A label carrying quotes or a backslash must not break either file it is written
// into. The LINK labels land in menu.ts; the item's own name lands in pages.ts.
const nasty = M.clean({ items: [{ label: 'The "Big" Idea', links: ['A \\ B', "It's"], columns: [] }] }, "dropdown");
parses(M.renderMenuTs(nasty.items), "menu.ts with quotes");
parses(M.renderPagesTs(nasty.items), "pages.ts with quotes");
ok(M.renderMenuTs(nasty.items).includes('"A \\\\ B"'), "a backslash in a link label is escaped");
ok(M.renderPagesTs(nasty.items).includes('\\"Big\\"'), "quotes in an item name are escaped");
eq(nasty.items[0].id, "the-big", "and the id is still clean");

const pages = M.renderPagesTs(mega.items);
parses(pages, "pages.ts");
ok(pages.includes('{ id: "home", route: "", name: "Home", component: "Home" }'), "home is always first");
ok(pages.includes('id: "services", route: "services", name: "Services"'), "a seeded page carries its label");
ok((pages.match(/component: "Home"/g) || []).length === mega.items.length + 1, "every seeded page starts on Home");
ok(M.renderPagesTs([]).includes('id: "home"'), "an empty seed still ships home");

// ---- the prompt --------------------------------------------------------------
const dp = M.prompt({ what: "An architecture practice in Leeds", sections: ["Hero", "Work"] }, "dropdown");
ok(/dropdown/i.test(dp.system) || /"links"/.test(dp.system), "the dropdown prompt asks for links");
ok(dp.system.includes("Never include Home"), "the prompt excludes home");
ok(/architecture practice in Leeds/.test(dp.user), "the brief's own words reach the model");
ok(!/—/.test(dp.system) && !/—/.test(dp.user), "no em-dashes in the prompt");
const mp = M.prompt({ what: "x" }, "mega");
ok(/columns/.test(mp.system) && /featured/.test(mp.system), "the mega prompt asks for columns + featured");
const np = M.prompt({}, "none");
ok(/no item opens a menu/i.test(np.system), "the none prompt asks for flat items");
ok(M.prompt({}, "dropdown").user.length > 0, "an empty brief still produces a user message");

console.log(`menu-seed: ${checks} checks pass.`);
