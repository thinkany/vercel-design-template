// ©2026 thinkany llc. All rights reserved.
// FIGMA VIEWS MERGE TEST: `node desktop/dev/figma-views-merge.test.cjs`.
//
// The export drawer lets a designer send one view first (a desktop proof) and come back
// for tablet and mobile later. That only works if the builder is ADDITIVE per view:
// `combine`/`reconstruct` must replace only the `View=` variants for the run's views and
// keep the rest (same nodes, so page instances keep their master), and `compose` must
// replace only the run's page frames. Before 2026-09-16 both wiped and rebuilt, so a
// mobile-only re-run deleted the desktop work. Runs the real builder body against a
// small fake of the Figma plugin API.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "figma-reconstruct-library.plugin.js"), "utf8");
const run = new Function("figma", "MANIFEST", "PHASE", "return (async () => {" + src + "\n})()");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };

// ---- a small fake of the plugin API: enough for combine + compose ----
let ids = 0;
class Node {
  constructor(type, name) { this.type = type; this.name = name; this.children = []; this.parent = null; this.id = String(++ids); this._pd = {}; this.x = 0; this.y = 0; this.width = 1440; this.height = 300; this.fills = []; this.strokes = []; }
  _detach() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  appendChild(c) { if (this.type === "COMPONENT_SET" && fake.setAppendThrows && !fake._combining) throw new Error("fake: variants can't be appended"); c._detach(); c.parent = this; this.children.push(c); }
  insertChild(i, c) { c._detach(); c.parent = this; this.children.splice(i, 0, c); }
  remove() { this._detach(); this.removed = true; }
  clone() { const c = new Node(this.type, this.name); c.width = this.width; c.height = this.height; c._pd = { ...this._pd }; c.clonedFrom = this; return c; }
  setPluginData(k, v) { this._pd[k] = v; } getPluginData(k) { return this._pd[k] || ""; }
  findAll() { return []; }
  resize(w, h) { this.width = w; this.height = h; }
  createInstance() { const i = new Node("INSTANCE", this.name); i.mainComponent = this; i.width = this.width; i.height = this.height; return i; }
  get defaultVariant() { return this.children[0]; }
}
const fake = { setAppendThrows: false, _combining: false };
const root = { children: [] };
const page = (name) => { const p = new Node("PAGE", name); root.children.push(p); return p; };
const figma = {
  root,
  currentPage: null,
  setCurrentPageAsync: async (p) => { figma.currentPage = p; },
  createPage: () => { const p = new Node("PAGE", ""); root.children.push(p); return p; },
  combineAsVariants: (nodes, parent) => { const s = new Node("COMPONENT_SET", ""); parent.appendChild(s); fake._combining = true; try { nodes.forEach((n) => s.appendChild(n)); } finally { fake._combining = false; } return s; },
  // Like the real API, a created node lands on the current page.
  createAutoLayout: () => { const f = new Node("FRAME", ""); figma.currentPage.appendChild(f); return f; },
  createFrame: () => { const f = new Node("FRAME", ""); figma.currentPage.appendChild(f); return f; },
  getNodeByIdAsync: async () => null,
  loadAllPagesAsync: async () => {},
};
const lib = page("Block Library");
const temp = (blockId, view, w) => { const t = new Node("COMPONENT", `__tmp:${blockId}:${view}`); t.width = w; lib.appendChild(t); return t; };
const heroSet = () => lib.children.find((n) => n.name === "Hero" && (n.type === "COMPONENT_SET" || n.type === "COMPONENT"));
const viewsOf = (set) => set.type === "COMPONENT_SET" ? set.children.map((c) => c.name) : [set.name + " (" + set.getPluginData("ta:view") + ")"];
const combine = (views) => run(figma, { blockPageName: "Block Library", combine: [{ blockId: "hero", name: "Hero", views }] }, "combine");

(async () => {
  // 1. A desktop-only first export: one bare component that remembers its view.
  const d1 = temp("hero", "desktop", 1440);
  let r = await combine(["desktop"]);
  eq(r.built[0].allViews, ["desktop"], "the first run reports the views the set now holds");
  ok(heroSet() === d1 && d1.type === "COMPONENT", "one view = a bare component, the temp itself");
  eq(d1.getPluginData("ta:view"), "desktop", "and it carries its view in plugin data");

  // 2. Tablet + mobile later: the desktop variant is KEPT (same node), the set has all three, in order.
  const t2 = temp("hero", "tablet", 834); const m2 = temp("hero", "mobile", 393);
  r = await combine(["tablet", "mobile"]);
  let set = heroSet();
  ok(set.type === "COMPONENT_SET", "three views = a component set");
  eq(viewsOf(set), ["View=Desktop", "View=Tablet", "View=Mobile"], "variants in the View bar's order");
  ok(set.children[0] === d1 && !d1.removed, "the desktop variant is the very node from the first export");
  ok(set.children[1] === t2 && set.children[2] === m2, "the new views are the temps");
  eq(r.built[0].allViews, ["desktop", "tablet", "mobile"], "the report names every view in the set");
  ok(!lib.children.some((n) => n.name.startsWith("__tmp:")), "no temps left on the page");

  // 3. Mobile only again: only mobile is replaced; desktop + tablet stay the same nodes.
  const m3 = temp("hero", "mobile", 393);
  r = await combine(["mobile"]);
  ok(heroSet() === set, "the set itself is kept (instances keep their master)");
  eq(viewsOf(set), ["View=Desktop", "View=Tablet", "View=Mobile"], "still all three");
  ok(set.children[0] === d1 && set.children[1] === t2, "desktop + tablet untouched");
  ok(set.children[2] === m3 && m2.removed, "mobile is the new one, the old variant removed");

  // 4. When the API refuses to append into a set, the set is rebuilt from the kept variants + the new ones (no clones needed here).
  fake.setAppendThrows = true;
  const t4 = temp("hero", "tablet", 834);
  r = await combine(["tablet"]);
  fake.setAppendThrows = false;
  const set4 = heroSet();
  ok(set4 !== set && set.removed, "fallback: a fresh set replaces the old one");
  eq(viewsOf(set4), ["View=Desktop", "View=Tablet", "View=Mobile"], "with every view");
  ok(set4.children[0] === d1 && set4.children[2] === m3 && set4.children[1] === t4, "kept variants moved across, not cloned; tablet is the new one");
  ok(t2.removed, "the replaced tablet variant is gone");

  // 5. compose: a desktop-only page, then mobile added, then desktop re-sent.
  const compose = (views) => run(figma, { page: { id: "home", name: "Home", route: "", blocks: [{ blockId: "hero", name: "Hero" }] }, views, widths: { desktop: 1440, tablet: 834, mobile: 393 }, blockPageName: "Block Library" }, "compose");
  r = await compose(["desktop"]);
  const home = root.children.find((p) => p.name === "Home");
  eq(home.children.map((f) => f.name), ["Home — Desktop"], "first compose: the desktop frame");
  const fDesk = home.children[0];
  eq(r.kept, [], "nothing kept on a first compose");
  r = await compose(["mobile"]);
  eq(home.children.map((f) => f.name).sort(), ["Home — Desktop", "Home — Mobile"], "mobile added, desktop frame still there");
  ok(home.children.includes(fDesk), "the desktop frame is the same node");
  eq(r.kept, ["desktop"], "the run reports the frame it kept");
  const fMob = home.children.find((f) => f.name === "Home — Mobile");
  ok(fDesk.x < fMob.x && fMob.x === 80 + 1440 + 120, "laid out left to right in view order");
  ok(fMob.children[0].mainComponent === m3, "the mobile frame instances the mobile variant");
  r = await compose(["desktop"]);
  const fDesk2 = home.children.find((f) => f.name === "Home — Desktop");
  ok(fDesk2 !== fDesk && fDesk.removed, "re-sending desktop replaces its frame");
  ok(home.children.includes(fMob), "and keeps the mobile frame");
  eq(home.children.length, 2, "two frames, no duplicates");

  // 6. The reconstruct phase takes the same road (statically: no blanket removal, merge at the end).
  const rec = src.slice(src.indexOf('if (PHASE === "reconstruct")'), src.indexOf('// ── PHASE "combine"'));
  ok(!/if \(!TEMP\) for \(const n of \[\.\.\.page\.children\]\) if \(n\.name === blk\.name/.test(rec), "reconstruct no longer wipes a block's set before building");
  ok(/mergeViewSet\(page, blk\.name, variants\)/.test(rec), "it merges the built views into the existing set");

  console.log(`figma views merge: ${checks} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
