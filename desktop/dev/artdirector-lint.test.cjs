// ©2026 thinkany llc. All rights reserved.
// ART DIRECTOR LINT TEST — `node desktop/dev/artdirector-lint.test.cjs`.
//
// The font-relative-measure rule (a ch/em max-w on an element with no font of its own)
// is line-level. A font that reaches the element through a shared class constant, or on
// an earlier line of the same className, must not be flagged: those false positives
// surfaced in a review as the Art Director arguing with its own lint in front of the
// designer. Offline, no Electron.
const assert = require("node:assert");
const { lintSource } = require("../artdirector.cjs");

const roles = new Set(["ink", "body", "muted", "surface", "border", "accent"]);
const measure = (text) => lintSource({ name: "src/variations/v01/components/Home.tsx", text }, roles).filter((f) => f.rule === "font-relative-measure");

// 1. The wrapper mistake is still caught.
assert.strictEqual(measure(`<div className="max-w-[60ch]">\n  <p className="font-ta-sans">x</p>\n</div>`).length, 1, "a font-less wrapper is flagged");

// 2. The font on the same line: not flagged (unchanged).
assert.strictEqual(measure(`<p className="font-ta-sans max-w-[60ch]">x</p>`).length, 0);

// 3. The font through a shared constant, template literal or concatenation: not flagged.
const shared = `const LEAD = "font-ta-sans text-xl text-ta-body";\nconst BODY = \`font-ta-sans text-base\`;\n` +
  `<p className={\`\${LEAD} max-w-[60ch]\`}>x</p>\n<p className={BODY + " max-w-[52ch]"}>y</p>\n<p className={cn(LEAD, "max-w-[48em]")}>z</p>`;
assert.strictEqual(measure(shared).length, 0, "a font from a shared class constant counts");

// 4. A constant WITHOUT a font does not excuse the measure.
const noFont = `const WRAP = "mx-auto px-6";\n<div className={\`\${WRAP} max-w-[60ch]\`}>x</div>`;
assert.strictEqual(measure(noFont).length, 1, "a font-less constant is no excuse");

// 5. A className split across lines, font on an earlier line: not flagged.
const split = `<p\n  className={cn(\n    "font-ta-display text-4xl",\n    "max-w-[20ch]",\n  )}\n>x</p>`;
assert.strictEqual(measure(split).length, 0, "the font on an earlier line of the same className counts");

// 6. The look-back stops at the previous element: its font is not borrowed.
const neighbour = `<h1 className="font-ta-display">t</h1>\n<div\n  className="max-w-[60ch]"\n>x</div>`;
assert.strictEqual(measure(neighbour).length, 1, "a neighbouring element's font is not borrowed");

console.log("artdirector-lint: ok");
