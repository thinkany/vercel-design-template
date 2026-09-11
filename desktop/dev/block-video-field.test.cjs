// ©2026 thinkany llc. All rights reserved.
// BLOCK VIDEO FIELD TEST — `node desktop/dev/block-video-field.test.cjs`.
//
// The CMS infers a field's kind from the block's zod schema. { src } is an image and
// { src, poster } is a video, and the ORDER of those two checks is the whole thing: put
// the image check first and every video field silently becomes an image, losing the
// poster the design depends on. This pins that.
const assert = require("node:assert");
const { z } = require("astro/zod");
const { zodFields } = require("../block-schema.cjs");

const image = z.object({ src: z.string(), alt: z.string().default("") });
const video = z.object({ src: z.string(), poster: z.string(), alt: z.string().default("") });

const kinds = (schema) => { const out = {}; zodFields(schema, out, "", 0); return out; };

let checks = 0;
const is = (got, want, msg) => { checks++; assert.strictEqual(got, want, msg); };

const f = kinds(z.object({
  heading: z.string(),
  hero: video.optional(),
  photo: image.optional(),
  gallery: z.array(image).optional(),
  clips: z.array(video).optional(),
  nested: z.object({ inner: video }).optional(),
}));

is(f.heading && f.heading.kind, "string", "a plain string is still a string");
is(f.hero && f.hero.kind, "video", "{ src, poster } is a video");
is(f.photo && f.photo.kind, "image", "{ src } alone is still an image");
is(f.gallery && f.gallery.kind, "image", "a list of images keeps the image kind");
is(f.clips && f.clips.kind, "video", "a list of videos keeps the video kind");
is(f["nested.inner"] && f["nested.inner"].kind, "video", "a nested video is found");

// The ordering trap, stated directly: a video must never come back as an image.
checks++;
assert.notStrictEqual(kinds(z.object({ v: video })).v.kind, "image",
  "a video field must not be mistaken for an image (check order in zodFields)");

// The real fragments the site ships, so a change to schema.ts is caught here too.
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "site", "blocks", "lib", "schema.ts"), "utf8");
checks++;
assert.ok(/export const video = z\.object\(\{[\s\S]*?poster:/.test(src),
  "site/blocks/lib/schema.ts still exports a video fragment carrying a poster");
checks++;
assert.ok(!/export const video[\s\S]*?poster: z\.string\(\)\.optional\(\)/.test(src),
  "the poster is REQUIRED: an optional one would render as an image field and lose the still");

console.log(`block-video-field: ${checks} checks pass.`);
