// ©2026 thinkany llc. All rights reserved.
// POSTS BLOCK TEST — `node desktop/dev/posts-block.test.cjs`.
// The built-in Posts block reads content/posts/*.md raw (astro:content is not there in
// the design surface), so its frontmatter parser must read exactly what the app's
// serializeFrontmatter writes: plain values unquoted, others JSON-quoted, lists in
// brackets, booleans bare, a nested seo block indented (and skipped).
const assert = require("node:assert");
const path = require("node:path");
const esbuild = require("esbuild");
let checks = 0;
const is = (got, want, msg) => { checks++; assert.deepStrictEqual(got, want, msg); };

const built = esbuild.buildSync({ entryPoints: [path.join(__dirname, "..", "..", "site", "src", "lib", "posts.ts")], bundle: true, write: false, platform: "node", format: "cjs", external: ["astro/zod"], logLevel: "silent" });
const m = { exports: {} }; new Function("require", "module", "exports", built.outputFiles[0].text)(require, m, m.exports);
const { parsePost, byDateDesc, posts } = m.exports;

const md = [
  "---",
  'title: "Choosing a worktop: the honest guide"', // a colon → JSON-quoted by the app
  "slug: worktops",
  'date: "2026-09-15"',                              // starts with a digit → quoted
  "updated: \"2026-09-15T20:00:00.000Z\"",
  "description: Oak, quartz and laminate compared.",
  "image: /images/worktop.jpg",
  'tags: [Kitchens, "advice", "two words"]',
  "draft: true",
  "seo:",
  "  title: Worktops compared",
  "  keyphrase: kitchen worktop",
  "---",
  "",
  "## Oak",
  "",
  "Wears in.",
].join("\n");
is(parsePost(md, "choosing-a-worktop"), {
  id: "choosing-a-worktop", title: "Choosing a worktop: the honest guide", slug: "worktops", date: "2026-09-15",
  description: "Oak, quartz and laminate compared.", image: "/images/worktop.jpg", tags: ["Kitchens", "advice", "two words"], draft: true,
}, "every field the card needs, quoted or not; the indented seo block is skipped");
is(parsePost("---\ntitle: Plain\n---\n", "plain"), { id: "plain", title: "Plain", slug: "plain", date: "", description: "", image: "", tags: [], draft: false }, "a bare post: slug falls back to the file name");
is(parsePost("no frontmatter here", "x"), null, "no frontmatter: not a post");
is(parsePost("---\ndate: \"2026-01-01\"\n---\n", "x"), null, "no title: not a post");
const a = { id: "a", title: "B", date: "2026-01-02" }, b = { id: "b", title: "A", date: "2026-01-05" }, c = { id: "c", title: "C", date: "" };
is([a, b, c].sort(byDateDesc).map((p) => p.id), ["b", "a", "c"], "newest first, undated last");
is(posts, [], "outside Vite the glob is unavailable and the list is empty, not a crash");
console.log(`posts-block: ${checks} checks pass.`);
