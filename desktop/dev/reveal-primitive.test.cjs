// ©2026 thinkany llc. All rights reserved.
// REVEAL PRIMITIVE TEST: `node desktop/dev/reveal-primitive.test.cjs`.
//
// site/blocks/lib/Reveal.tsx is an explicit `core` entry in upgrade.manifest.json, so it
// is OVERWRITTEN in every project on open, even though it sits inside the keep tree
// site/blocks/**. That is deliberate (it is a template primitive, like Parallax.tsx
// beside it), and it has one consequence worth a test: whatever a project needs from this
// file MUST exist in the scaffold's copy, or the refresh silently breaks every block that
// imports the missing export.
//
// That happened: blocks used a spread form, reveal(), that only the project had. The
// overlay took the file back and ten blocks died with "reveal is not a function". These
// pins keep both entry points in the scaffold and keep the skills teaching them.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const REVEAL = read("site/blocks/lib/Reveal.tsx");
const MANIFEST = JSON.parse(read("upgrade.manifest.json"));

console.log("1. both entry points exist");
{
  ok(/export function Reveal\(/.test(REVEAL), "the <Reveal> wrapper component is exported");
  ok(/export function reveal\(/.test(REVEAL), "the reveal() props helper is exported");

  // Both must emit what site.css and the Base.astro observer actually read, or the
  // element is marked but never animates.
  const fn = REVEAL.slice(REVEAL.indexOf("export function reveal("));
  ok(/"data-reveal": true/.test(fn), "reveal() marks the element with data-reveal");
  ok(/--reveal-delay/.test(fn), "reveal() sets --reveal-delay for a stagger");
  const comp = REVEAL.slice(REVEAL.indexOf("export function Reveal("));
  ok(/data-reveal/.test(comp) && /--reveal-delay/.test(comp), "<Reveal> emits the same two things");

  // A delay of 0 should not write an empty custom property.
  ok(/delay\s*\?/.test(fn), "reveal() omits the style entirely when there is no delay");
}

console.log("2. the CSS + observer read what these emit");
{
  const css = read("site/src/styles/site.css");
  ok(/\[data-reveal\]/.test(css), "site.css targets [data-reveal]");
  ok(/--reveal-delay/.test(css), "site.css reads --reveal-delay");
  const base = read("site/src/layouts/Base.astro");
  ok(/data-reveal/.test(base), "the Base.astro observer looks for data-reveal");
}

console.log("3. the manifest tier is explicit (this is why the file refreshes)");
{
  const core = MANIFEST.core || [];
  const keep = MANIFEST.keep || [];
  ok(core.includes("site/blocks/lib/Reveal.tsx"), "Reveal.tsx is an explicit core entry");
  ok(keep.includes("site/blocks/**"), "and it sits inside the keep tree, which the core entry overrides");

  // The comment inside the file used to claim KEEP, which is what makes this confusing
  // to anyone reading it. It must not say that again.
  ok(!/KEEP tier/.test(REVEAL), "the file does not claim to be KEEP (it is CORE, and gets overwritten)");
  ok(/CORE|refreshed on open|upgrade\.manifest/.test(REVEAL), "and says so, so the next reader knows edits here are transient");
}

console.log("4. the skills teach the spread form");
{
  // The agent invented reveal() because the skills only ever showed <Reveal>, and a
  // wrapper div breaks a grid. Teaching the supported primitive is what stops a project
  // from growing its own again.
  const promote = read("desktop/skills/promote-blocks.md");
  const block = read("desktop/skills/design-block.md");
  const design = read("desktop/skills/design.md");

  ok(/reveal\(/.test(promote), "promote-blocks mentions reveal()");
  ok(/grid|flex/i.test(promote.slice(promote.indexOf("reveal("), promote.indexOf("reveal(") + 400)), "and says when to reach for it");
  ok(/import \{ Reveal, reveal \}/.test(promote), "its import example offers both");
  ok(/import \{ Reveal, reveal \}/.test(block), "design-block's import example offers both");
  ok(/reveal\(/.test(design), "design.md's carry table mentions the spread form");
}

console.log("5. the bundled snapshot carries it");
{
  // The snapshot is what actually reaches a project. If it is stale, the fix above never
  // ships and the next open breaks the same blocks again.
  const snap = path.join(ROOT, "desktop", "template", "site", "blocks", "lib", "Reveal.tsx");
  if (!fs.existsSync(snap)) {
    console.log("  - no bundled snapshot in this checkout (run make-template before a build)");
  } else {
    const s = fs.readFileSync(snap, "utf8");
    ok(/export function reveal\(/.test(s), "the snapshot's Reveal.tsx exports reveal() (regenerate with make-template if this fails)");
    ok(/export function Reveal\(/.test(s), "and still exports <Reveal>");
  }
}

console.log(`\n✓ reveal-primitive: ${checks} checks passed`);
