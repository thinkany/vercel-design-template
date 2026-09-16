// ©2026 thinkany llc. All rights reserved.
// FOOTER COPY TEST — `node desktop/dev/footer-copy.test.cjs`.
//
// A design's footer often carries a line of its own (a tagline) beyond the links and
// the legal line. The rule: it is a prop on the Footer's schema with the design's words
// as its default, never a literal in the JSX, so the CMS shows it under Navigation →
// Footer as a provisional field. This pins both halves: the app's introspection turns
// the schema's extra props into fields + defaults (footerCopyOf), and the site's
// resolver (chromeCopy in site/src/lib/blocks.ts) lays the stored edits over them.
const assert = require("node:assert");
const path = require("node:path");
const { z } = require("astro/zod");
const esbuild = require("esbuild");
const { footerCopyOf } = require("../block-schema.cjs");

let checks = 0;
const is = (got, want, msg) => { checks++; assert.deepStrictEqual(got, want, msg); };

const chromeSet = { siteName: z.string(), logo: z.string().optional(), logos: z.object({ wordmark: z.string() }).default({ wordmark: "" }), nav: z.array(z.any()).default([]), footerLinks: z.array(z.any()).default([]), legal: z.object({ links: z.array(z.any()).default([]) }).default({ links: [] }) };
const footer = { name: "Footer", props: z.object({ ...chromeSet, tagline: z.string().default("The design's words."), note: z.string().describe("richtext").default("") }) };
const bare = { name: "Footer", props: z.object(chromeSet) };

// The app side: only the props beyond the chrome set, with the design's defaults.
const fc = footerCopyOf({ footer });
is(fc.defaults, { tagline: "The design's words.", note: "" }, "the extra props' defaults are the design's words");
is(fc.fields, { tagline: { kind: "string" }, note: { kind: "richtext" } }, "field kinds come through (.describe('richtext') included)");
is(Object.keys(footerCopyOf({ footer: bare }).fields), [], "a footer with nothing of its own yields no fields");
is(footerCopyOf(null).fields, {}, "no chrome at all is fine");

// The site side: the resolver the layout and the preview use.
const built = esbuild.buildSync({ entryPoints: [path.join(__dirname, "..", "..", "site", "src", "lib", "blocks.ts")], bundle: true, write: false, platform: "node", format: "cjs", external: ["astro/zod", "react"], logLevel: "silent" });
const m = { exports: {} }; new Function("require", "module", "exports", built.outputFiles[0].text)(require, m, m.exports);
const { chromeCopy, CHROME_PROP_KEYS } = m.exports;
is(chromeCopy(footer, {}), { tagline: "The design's words.", note: "" }, "nothing stored: the defaults");
is(chromeCopy(footer, { tagline: "Edited in the CMS" }), { tagline: "Edited in the CMS", note: "" }, "a stored edit wins, per field");
is(chromeCopy(footer, { tagline: 42, junk: "x", siteName: "hijack" }), { tagline: "The design's words.", note: "" }, "a wrong type falls back to the default; unknown and chrome keys are ignored");
is(chromeCopy(bare, { tagline: "x" }), {}, "a footer with no copy props takes nothing from site.json");
is(chromeCopy(undefined, { tagline: "x" }), {}, "no footer at all is fine");
is([...CHROME_PROP_KEYS], ["siteName", "logo", "logos", "nav", "footerLinks", "legal"], "the chrome set the two sides agree on");

// Both sides name the same chrome set (the app's copy lives in block-schema.cjs).
const fs = require("node:fs");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "block-schema.cjs"), "utf8");
checks++;
assert.ok(appSrc.includes('const CHROME_PROP_KEYS = ["siteName", "logo", "logos", "nav", "footerLinks", "legal"];'), "block-schema.cjs lists the same chrome set as site/src/lib/blocks.ts");

console.log(`footer-copy: ${checks} checks pass.`);
