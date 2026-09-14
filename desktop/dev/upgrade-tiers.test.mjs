// ©2026 thinkany llc. All rights reserved.
// UPGRADE TIERS TEST: `node desktop/dev/upgrade-tiers.test.mjs`.
//
// The site header (site/blocks/lib/Header.tsx) is framework: it renders the designer's
// header.config + header.skin + nav data and is never promoted or hand-edited. It sat
// under the site/blocks/** keep glob, so an older project never received the version
// whose `preview` prop opens the edited menu item in the Navigation tab (seen 2026-09-13).
// The manifest now names the framework files in that folder as CORE, ahead of keep, and
// the design's own kit beside them stays the designer's.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { classify } from "../../scripts/upgrade.mjs";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "upgrade.manifest.json"), "utf8"));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

for (const f of ["site/blocks/lib/Header.tsx", "site/blocks/lib/Parallax.tsx", "site/blocks/lib/Reveal.tsx", "site/blocks/lib/VideoBackground.tsx", "site/blocks/lib/VideoFigure.tsx", "site/blocks/lib/schema.ts"]) {
  ok(classify(f, manifest) === "core", `${f} is CORE: it refreshes on open like the rest of the framework`);
  ok(fs.existsSync(path.join(ROOT, f)), `${f} exists in the template (the override names a real file)`);
}
ok(classify("site/blocks/lib/marks.tsx", manifest) === "keep", "the design's motif kit beside them stays the designer's");
ok(classify("site/blocks/lib/textures.tsx", manifest) === "keep", "and so does anything else promote writes into that folder");
ok(classify("site/blocks/Hero.tsx", manifest) === "keep", "promoted blocks stay keep");
ok(classify("site/blocks/index.ts", manifest) === "keep" && classify("site/blocks/chrome.ts", manifest) === "keep", "the registry and chrome stay keep (seeded when missing)");
ok(classify("site/src/lib/builtin-blocks.tsx", manifest) === "core", "site/src stays CORE");
ok(classify("src/app/header.config.ts", manifest) === "keep" && classify("src/app/components/header.skin.ts", manifest) === "keep", "the header's config and skin stay the designer's");
ok(classify("package.json", manifest) === "review", "review files still classify as review");
ok(Array.isArray(manifest.core) && manifest.core.every((g) => !g.includes("*")), "the core override lists exact files, never a glob that could swallow a designer's work");

console.log(`upgrade-tiers: ${checks} checks pass.`);
