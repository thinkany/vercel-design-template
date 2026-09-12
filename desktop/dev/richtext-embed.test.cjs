// The video embed, both sides of the file: what counts as a video address (embed.ts) and
// how the site's renderer (richtext.ts) turns an address on its own line into the player,
// while leaving every other line as prose. Run: node desktop/dev/richtext-embed.test.cjs
const path = require("node:path"); const fs = require("node:fs"); const os = require("node:os");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "..", "..");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ta-richtext-")), "richtext.cjs");
esbuild.buildSync({ entryPoints: [path.join(root, "site/src/lib/richtext.ts")], bundle: true, format: "cjs", platform: "node", outfile: out, logLevel: "silent" });
const embedOut = out.replace(/richtext\.cjs$/, "embed.cjs");
esbuild.buildSync({ entryPoints: [path.join(root, "site/src/lib/embed.ts")], bundle: true, format: "cjs", platform: "node", outfile: embedOut, logLevel: "silent" });
const { renderMarkdown } = require(out); const { videoEmbed } = require(embedOut);

let n = 0; const ok = (cond, what) => { n++; if (!cond) { console.error("FAIL:", what); process.exit(1); } };
const yt = (u) => { const e = videoEmbed(u); return e && e.provider === "youtube" ? e.id : null; };
ok(yt("https://www.youtube.com/watch?v=dQw4w9WgXcQ") === "dQw4w9WgXcQ", "watch URL");
ok(yt("https://youtu.be/dQw4w9WgXcQ?t=42") === "dQw4w9WgXcQ", "short URL with a query");
ok(yt("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1") === "dQw4w9WgXcQ", "mobile host, playlist ignored");
ok(yt("https://www.youtube.com/shorts/dQw4w9WgXcQ") === "dQw4w9WgXcQ", "shorts");
ok(yt("https://www.youtube.com/embed/dQw4w9WgXcQ") === "dQw4w9WgXcQ", "embed");
ok(yt("https://www.youtube.com/channel/UC12345") === null, "a channel is not a video");
ok(videoEmbed("https://www.youtube.com/watch?v=<script>") === null, "an id is only id characters");
const vm = videoEmbed("https://vimeo.com/123456789"); ok(vm && vm.provider === "vimeo" && vm.src === "https://player.vimeo.com/video/123456789?dnt=1&title=0&byline=0&portrait=0&playsinline=1", "vimeo, quiet parameters");
ok(videoEmbed("https://player.vimeo.com/video/123456789").id === "123456789", "vimeo player URL");
ok(videoEmbed("https://vimeo.com/123456789/abcdef1234").src.endsWith("&h=abcdef1234"), "unlisted hash rides along");
ok(videoEmbed("https://vimeo.com/channels/staffpicks/123456789").id === "123456789", "channel path");
ok(videoEmbed("https://vimeo.com/about") === null, "vimeo page without an id");
ok(videoEmbed("https://example.com/watch?v=abc") === null, "another host");
ok(videoEmbed("not a url") === null && videoEmbed("") === null && videoEmbed(null) === null, "junk");
ok(videoEmbed("https://youtu.be/dQw4w9WgXcQ and more") === null, "an address with words after it is prose");

const md = "Intro line.\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n\nAfter.\n\n- https://youtu.be/dQw4w9WgXcQ\n\nSee https://youtu.be/dQw4w9WgXcQ today.\n\nhttps://vimeo.com/123456789\n";
const html = renderMarkdown(md);
ok(html.includes('<div class="ta-embed" data-embed="youtube"'), "a YouTube line becomes the player");
ok(html.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&controls=1&playsinline=1&iv_load_policy=3"'), "privacy host, quiet parameters");
ok(html.includes('<div class="ta-embed" data-embed="vimeo"'), "a Vimeo line becomes the player");
ok((html.match(/<iframe/g) || []).length === 2, "exactly two players");
ok(html.includes("<p>Intro line.</p>") && html.includes("<p>After.</p>"), "prose around it is untouched");
ok(html.includes("<li>https://youtu.be/dQw4w9WgXcQ</li>"), "inside a list it stays text");
ok(html.includes("<p>See https://youtu.be/dQw4w9WgXcQ today.</p>"), "inside a sentence it stays text");
ok(!/<p>https:\/\/www\.youtube/.test(html), "the embedded address is not also a paragraph");
ok(renderMarkdown("https://youtu.be/dQw4w9WgXcQ\nsecond line").includes("<p>https://youtu.be/dQw4w9WgXcQ\nsecond line</p>"), "a two-line paragraph is prose");
console.log(`richtext-embed: ${n} checks pass.`);
// The autolink forms the editor's Link extension can leave behind render the same video.
{
  const a = renderMarkdown("<https://youtu.be/Od6M0AXpcxQ?si=XzVQyKdgTG0PboMf>");
  const b = renderMarkdown("[https://youtu.be/Od6M0AXpcxQ](https://youtu.be/Od6M0AXpcxQ)");
  const c = renderMarkdown("[Watch](https://youtu.be/Od6M0AXpcxQ)");
  if (!a.includes('src="https://www.youtube-nocookie.com/embed/Od6M0AXpcxQ?rel=0&controls=1&playsinline=1&iv_load_policy=3"')) { console.error("FAIL: <url> form"); process.exit(1); }
  if (!b.includes('src="https://www.youtube-nocookie.com/embed/Od6M0AXpcxQ?rel=0&controls=1&playsinline=1&iv_load_policy=3"')) { console.error("FAIL: [url](url) form"); process.exit(1); }
  if (!c.includes('<p><a href="https://youtu.be/Od6M0AXpcxQ">Watch</a></p>')) { console.error("FAIL: a worded link stays a link"); process.exit(1); }
  console.log("richtext-embed: autolink forms pass.");
}
