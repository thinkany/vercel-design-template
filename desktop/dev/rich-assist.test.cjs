// ©2026 thinkany llc. All rights reserved.
// RICH ASSIST TEST — `node desktop/dev/rich-assist.test.cjs`.
// The editor's "Ask Claude": the prompt names the editor's markdown subset and carries
// the voice; the cleaner holds a reply to that subset.
const assert = require("node:assert");
const A = require("../rich-assist.cjs");
let checks = 0;
const is = (got, want, msg) => { checks++; assert.deepStrictEqual(got, want, msg); };
const ok = (v, msg) => { checks++; assert.ok(v, msg); };

const { system, user } = A.prompt({ markdown: "## Hello\n\nSome text.\n\n![a](/images/a.jpg)", instruction: "Make it shorter", kind: "post" }, { name: "Marlow", voice: { tone: "Warm", rules: ["Short sentences"] } });
ok(system.includes("never a # heading") && system.includes("No tables, no raw HTML"), "the subset is spelled out");
ok(system.includes("Keep every image line"), "images and video lines are kept");
ok(user.includes("Tone: Warm") && user.includes("- Short sentences"), "the voice rides along");
ok(user.includes("Instruction: Make it shorter") && user.includes("The post, as it stands:\n## Hello"), "instruction and text are both there");
ok(A.prompt({ markdown: "", instruction: "Write an intro" }, {}).user.includes("is empty: write it"), "an empty editor is written from the instruction");

is(A.clean({ markdown: "# Title\r\n\r\n\r\n\r\nText — with a dash.\n\n<div class=\"x\">boxed</div>\n\n<img src=\"/images/a.jpg\" alt=\"\" data-align=\"right\">\n\nline<br>break" }),
  "## Title\n\nText, with a dash.\n\nboxed\n\n<img src=\"/images/a.jpg\" alt=\"\" data-align=\"right\">\n\nline<br>break",
  "H1 demoted, dashes fixed, stray HTML stripped, the editor's img and br kept, blank runs collapsed");
is(A.clean({}), "", "no reply: empty, not a crash");
ok(A.SCHEMA.required.includes("markdown"), "the schema asks for the text");
console.log(`rich-assist: ${checks} checks pass.`);
