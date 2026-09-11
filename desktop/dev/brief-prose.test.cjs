// ©2026 thinkany llc. All rights reserved.
// BRIEF PROSE TEST — `node desktop/dev/brief-prose.test.cjs`.
//
// The Get Designing prompt is not only read by the model. `/design-brief` saves
// everything before the first "## " heading as the variation's `brief`, and the
// dashboard card shows that to the DESIGNER under "Original brief". So every phrase
// that goes into the body has to read like a brief: no file paths, no component or
// library names, no build instructions, and no em-dashes (house rule).
//
// Build mechanics still reach the model, as a "## Build notes" block appended after
// the body, which the skill is told never to save. This test guards the line between
// the two. It parses the phrase tables out of main.cjs rather than importing it
// (main.cjs is an Electron entry point and pulls in the whole app on require).
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const table = (name) => {
  const m = src.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`));
  assert.ok(m, `${name} not found in main.cjs`);
  return new Function(m[0].replace(`const ${name} =`, "return"))();
};

// What must never appear in text a designer reads.
const JARGON = [
  [/\bsrc\//, "a source path"],
  [/\.tsx?\b/, "a filename"],
  [/react-hook-form|shadcn|radix|tailwind/i, "a library name"],
  [/\bCORE\b/, "an internal tier name"],
  [/header\.(skin|config)|menu\.ts|variation\.json/, "an internal file"],
  [/\bdo NOT\b|\bnever\b.*\bcopy\b/i, "a build instruction"],
  [/\bAPI call\b|\bPOST\b/, "implementation detail"],
  [/\{id\}|\bprops?\b|\bcomponent\b/i, "a code concept"],
  [/—/, "an em-dash (house rule)"],
];

let checks = 0;
function assertProse(text, where) {
  checks++;
  for (const [re, why] of JARGON) {
    assert.ok(!re.test(text), `${where} contains ${why}: ${JSON.stringify(String(text).slice(0, 120))}`);
  }
}

// ---- The designer-facing phrase tables ---------------------------------------
const MENU = table("MENU_LAYOUT_PHRASES");
const HERO = table("HERO_LAYOUT_PHRASES");
const CTA = table("CTA_TYPE_PHRASES");
const HERO_MEDIA = table("HERO_MEDIA_PHRASES");

for (const [k, v] of Object.entries(MENU)) assertProse(v, `MENU_LAYOUT_PHRASES.${k}`);
for (const [k, v] of Object.entries(HERO)) assertProse(v, `HERO_LAYOUT_PHRASES.${k}`);
for (const [k, v] of Object.entries(CTA)) assertProse(v, `CTA_TYPE_PHRASES.${k}`);
for (const [k, v] of Object.entries(HERO_MEDIA)) assertProse(v, `HERO_MEDIA_PHRASES.${k}`);

assert.strictEqual(Object.keys(MENU).length, 9, "all nine header layouts still have a phrase");
assert.strictEqual(Object.keys(HERO).length, 5, "all five hero layouts still have a phrase");
checks += 2;

// ---- The sentences those tables are wrapped in -------------------------------
// Pulled from the prompt builder itself, so a future edit to the wrapper is caught
// even when the table stays clean.
const wrappers = src
  .slice(src.indexOf("function buildDesignPrompt"), src.indexOf("\nipcMain.handle(\"intake:designPrompt\""))
  .split("\n")
  .filter((l) => /parts\.push/.test(l) || /^\s+["`]/.test(l))
  .join("\n");
for (const key of ["MENU_LAYOUT_PHRASES", "HERO_LAYOUT_PHRASES", "CTA_TYPE_PHRASES", "HERO_MEDIA_PHRASES"]) {
  const i = wrappers.indexOf(key);
  if (i < 0) continue;
  // The ~200 characters around the interpolation: the wrapper prose.
  const around = wrappers.slice(Math.max(0, i - 240), i + 240).replace(/\$\{[^}]*\}/g, "");
  checks++;
  for (const [re, why] of JARGON) {
    // A wrapper legitimately names the table it reads; ignore the identifiers.
    const prose = around.replace(/[A-Z_]{6,}/g, "").replace(/b\.\w+/g, "");
    assert.ok(!re.test(prose), `the ${key} wrapper contains ${why}:\n${prose.trim().slice(0, 200)}`);
  }
}

// ---- Build mechanics still reach the MODEL -----------------------------------
// The point is not to delete the detail, only to move it. CTA_TYPE_BUILD carries it,
// and it is appended as its own "## Build notes" block.
const BUILD = table("CTA_TYPE_BUILD");
assert.ok(/react-hook-form/.test(BUILD["cta-form"]), "the form's build note still names its library");
assert.ok(/no backend|do not POST/i.test(BUILD["cta-form"]), "the form's build note still forbids a fake API call");
assert.ok(/## Build notes/.test(src), "build notes are appended as their own block");
checks += 3;

// ---- And the skill is told not to save any injected block --------------------
const skill = fs.readFileSync(path.join(__dirname, "..", "skills", "design-brief.md"), "utf8");
assert.ok(/before the\s*\n?first `## ` heading/.test(skill.replace(/\s+/g, " ")) || /first `## ` heading/.test(skill),
  "design-brief.md must exclude EVERY '## ' block from the saved brief, not just Design direction");
checks++;

// ---- Typographic apostrophes in user-facing headings -------------------------
// The app's headings use a real apostrophe (U+2019), not a straight tick: "Let’s set
// up your project" sets the convention. A tick in a heading reads as a typo next to it.
const copySrc = fs.readFileSync(path.join(__dirname, "..", "copy.js"), "utf8");
for (const m of copySrc.matchAll(/^\s*(heading|title|headSubtitle|intro\d?)\s*:\s*"([^"]*)"/gm)) {
  checks++;
  assert.ok(!/[a-zA-Z]'[a-zA-Z]/.test(m[2]),
    `${m[1]} uses a straight tick where the branding wants \u2019: ${JSON.stringify(m[2])}`);
}

console.log(`brief-prose: ${checks} checks pass.`);
