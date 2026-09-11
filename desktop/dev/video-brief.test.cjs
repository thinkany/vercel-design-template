// ©2026 thinkany llc. All rights reserved.
// VIDEO BRIEF TEST — `node desktop/dev/video-brief.test.cjs`.
//
// Two pieces of main.cjs decide whether a design gets video, and both are easy to get
// subtly wrong:
//
//   briefMentionsVideo(brief)  did the designer ask for it IN THEIR OWN WORDS
//   videoAskNote(brief)        what the model is told, which differs by whether a
//                              video-capable library is connected
//
// The second branch is the one that matters most: a designer who asks for video with no
// key connected must be TOLD why their design is stills, not quietly handed one.
//
// Parsed out of main.cjs rather than required (it is an Electron entry point and would
// pull in the whole app), the same way brief-prose.test.cjs does it.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");

function fn(name, extra = "") {
  const m = src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}"));
  assert.ok(m, `${name} not found in main.cjs`);
  return m[0] + extra;
}
// briefMentionsVideo needs its regex; videoAskNote needs briefMentionsVideo.
const VIDEO_INTENT = src.match(/const VIDEO_INTENT = [^\n]+/)[0];
const mentions = new Function(`${VIDEO_INTENT}\n${fn("briefMentionsVideo")}\nreturn briefMentionsVideo;`)();
const askNote = new Function("process", `${VIDEO_INTENT}\n${fn("briefMentionsVideo")}\n${fn("videoAskNote")}\nreturn videoAskNote;`);

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

// ---- briefMentionsVideo: the designer's own words ---------------------------
const asked = [
  { what: "a landing page with a video hero" },
  { what: "we want some footage of the workshop" },
  { what: "a short reel at the top" },
  { what: "add b-roll behind the headline" },
  { what: "a looping clip of the coastline" },
  { what: "something with motion in the hero" },
  { what: "a page with a cinemagraph" },
  { what: "filmed on location, show that" },
  { notes: ["ideally with video in the hero"] },
  { references: [{ url: "https://x.test", reason: "the video background" }] },
];
for (const b of asked) ok(mentions(b), `should read as a video ask: ${JSON.stringify(b)}`);

const notAsked = [
  { what: "a clean marketing site for a dentist" },
  { what: "a photo-led hero with big type" },
  { what: "" },
  {},
  // Word boundaries keep the near misses out: a videographer's site is a site, and
  // "motioned" is not motion. If the vocabulary ever loosens, these are the canaries.
  { what: "a videographer's portfolio site" },
  { what: "the board motioned to approve it" },
  { what: "a site for a film school" },   // "film school", not "filmed"
];
for (const b of notAsked) ok(!mentions(b), `should NOT read as a video ask: ${JSON.stringify(b)}`);

// ---- videoAskNote: nothing when they never asked ----------------------------
const withKeys = (env) => askNote({ env });
ok(withKeys({ PEXELS_API_KEY: "k" })({ what: "a clean site" }) === "",
  "no mention, no note, whatever keys are connected");

// ---- videoAskNote: asked + a library connected ------------------------------
for (const env of [{ PEXELS_API_KEY: "k" }, { PIXABAY_API_KEY: "k" }, { PEXELS_API_KEY: "k", PIXABAY_API_KEY: "k" }]) {
  const note = withKeys(env)({ what: "a video hero please" });
  ok(/THE DESIGNER ASKED FOR VIDEO/.test(note), "the connected branch is emphatic");
  ok(/find-video\.mjs/.test(note), "and points at the script");
  ok(!/Keys & Licenses/.test(note), "and does not tell them to add a key they already have");
}

// ---- videoAskNote: asked + NO library connected -----------------------------
// The honest branch. It must NOT pretend, and must say what would fix it.
for (const env of [{}, { UNSPLASH_ACCESS_KEY: "k" }, { PEXELS_API_KEY: "  " }]) {
  const note = withKeys(env)({ what: "a video hero please" });
  ok(note !== "", `a mention with no video key still produces a note (env ${JSON.stringify(env)})`);
  ok(/Keys & Licenses/.test(note), "it names where a key goes");
  ok(/Pexels or Pixabay/.test(note), "and which libraries carry video");
  ok(/stills/.test(note), "it says what will be built instead");
  ok(!/THE DESIGNER ASKED FOR VIDEO/.test(note), "it is not the emphatic go-find-footage branch");
  ok(!/find-video\.mjs/.test(note), "and never sends the model to a script that cannot work");
}
// Unsplash alone is stills-only: it must not count as a video library.
ok(/Keys & Licenses/.test(withKeys({ UNSPLASH_ACCESS_KEY: "k" })({ what: "video please" })),
  "an Unsplash key does not unlock video");

console.log(`video-brief: ${checks} checks pass.`);
