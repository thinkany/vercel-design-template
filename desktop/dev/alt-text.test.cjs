// ©2026 thinkany llc. All rights reserved.
// ALT TEXT TEST — `node desktop/dev/alt-text.test.cjs`.
//
// The pure half (desktop/alt-text.cjs) and the wiring that carries a saved alt into
// every block: the library returns it, the picker hands it to the image field, the
// editor's image insert pre-fills it, and an upload with the switch on writes it.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ALT = require("../alt-text.cjs");

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.strictEqual(a, b, m); };

// ---- clean(): one usable alt string out of whatever came back ----------------
eq(ALT.clean({ alt: "A surfer rides a wave at sunset off Waikiki.", decorative: false }), "A surfer rides a wave at sunset off Waikiki.", "a good sentence passes through");
eq(ALT.clean({ alt: "anything", decorative: true }), "", "decorative means an empty alt, whatever the sentence");
eq(ALT.clean({ alt: "  \"A red kayak on a still lake.\"  ", decorative: false }), "A red kayak on a still lake.", "surrounding quotes and space go");
eq(ALT.clean({ alt: "“Smart quotes too.”", decorative: false }), "Smart quotes too.", "curly quotes go");
eq(ALT.clean({ alt: "Alt text: Two chefs plate a dish.", decorative: false }), "Two chefs plate a dish.", "a label the model adds goes");
eq(ALT.clean({ alt: "An image of a lighthouse on a cliff.", decorative: false }), "A lighthouse on a cliff.", "'an image of' is dropped and the sentence re-capitalised");
eq(ALT.clean({ alt: "photo showing three friends laughing", decorative: false }), "Three friends laughing", "'photo showing' too");
eq(ALT.clean({ alt: "Picture of the team", decorative: false }), "The team", "'picture of' too");
eq(ALT.clean("A plain string reply."), "A plain string reply.", "a bare string is accepted");
eq(ALT.clean(null), "", "nothing in, nothing out");
const long = ALT.clean({ alt: "word ".repeat(60).trim(), decorative: false });
ok(long.length <= ALT.ALT_MAX, "a long reply is cut");
ok(!/\s$/.test(long) && !/,$/.test(long), "and cut at a word, without a trailing space or comma");

// ---- the prompt ---------------------------------------------------------------
ok(/125 characters/.test(ALT.SYSTEM), "the prompt asks for a short sentence");
ok(/decorative/.test(ALT.SYSTEM) && ALT.SCHEMA.required.includes("decorative"), "and for the decorative call, which the schema carries");
ok(/image of/.test(ALT.SYSTEM), "and tells the model not to say 'image of'");
ok(/File name: hero\.avif/.test(ALT.userText({ fileName: "hero.avif", siteName: "Visit Hawaii" })), "the file name rides along");
ok(/Website: Visit Hawaii/.test(ALT.userText({ fileName: "hero.avif", siteName: "Visit Hawaii" })), "so does the site");
eq(ALT.userText({}), "Write the alt text for this image.", "with nothing known, just the ask");

// ---- the wiring (read out of the app files, like the other structural tests) ---
const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "..", "shell.js"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "..", "media-convert.cjs"), "utf8");
ok(/alt: \(meta && meta\.alt\) \|\| ""/.test(main), "the library lists each image's saved alt");
ok(/ipcMain\.handle\("media:setAlt"/.test(main) && /ipcMain\.handle\("media:describe"/.test(main), "save and describe have their IPC");
ok(/autoAlt/.test(main.match(/function cmsDefaults\(\)[^\n]*/)[0]), "describe-on-upload is a CMS setting, off by default");
ok(/settings\.autoAlt && process\.env\.ANTHROPIC_API_KEY/.test(main), "an upload describes only with the switch on and a key present");
ok(/media_type: "image\/jpeg"/.test(main), "the call sends a JPEG (the API reads no AVIF or SVG)");
ok(/\.flatten\(\{ background: "#fff" \}\)\.jpeg/.test(worker), "the worker renders that JPEG on white");
ok(/fallbacks: "default"/.test(main.slice(main.indexOf("async function describeImageAlt"))), "a policy decline falls back inside the call");
ok(/setMediaAlt: \(rel, alt\)/.test(preload) && /describeMedia: \(rel\)/.test(preload), "the preload exposes both");
ok(/alt: it\.alt \|\| cur\.alt/.test(shell), "picking from the library carries the saved alt into the field");
ok(/r\.alts\[src\]/.test(shell), "an upload described on the way in lands in the field too");
ok(/value: it\.alt \|\| ""/.test(shell), "the editor's image insert pre-fills the saved alt");
ok(/cmsStep\("mediaAutoAlt", "cms-media-autoalt"/.test(shell), "the CMS walkthrough has the tip");

console.log(`alt-text: ${checks} checks passed`);
