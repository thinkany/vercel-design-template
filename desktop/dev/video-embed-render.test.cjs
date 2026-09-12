// ©2026 thinkany llc. All rights reserved.
// VIDEO EMBED RENDER TEST — `node desktop/dev/video-embed-render.test.cjs`.
//
// A YouTube / Vimeo address in a video value's `src` renders the host's player in the
// clip's place, in every component that renders that value: the design surface's
// <VideoFigure>, the promoted-block copy, and the built-in Video block. A clip path still
// renders a <video>. A hosted video is always content: the host's player with controls,
// never autoplay, whatever `controls` says. YouTube's still stands in for a missing poster.
const assert = require("node:assert");
const path = require("node:path"); const fs = require("node:fs");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..", "..");
// Under the repo, so the bundle's `require("react")` resolves the root node_modules.
const cacheDir = path.join(root, "node_modules", ".cache"); fs.mkdirSync(cacheDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(cacheDir, "ta-video-embed-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });
const load = (entry, name) => {
  const outfile = path.join(tmp, name + ".cjs");
  esbuild.buildSync({ entryPoints: [path.join(root, entry)], bundle: true, format: "cjs", platform: "node", jsx: "automatic", outfile, logLevel: "silent",
    external: ["react", "react-dom", "react/jsx-runtime", "astro/zod", "astro:*"] });
  return require(outfile);
};
let checks = 0; const ok = (c, m) => { checks++; assert.ok(c, m); };
const YT = "https://youtu.be/dQw4w9WgXcQ"; const VM = "https://vimeo.com/123456789";
const html = (C, props) => renderToStaticMarkup(React.createElement(C, props));

for (const [entry, name] of [["src/app/components/VideoFigure.tsx", "design"], ["site/blocks/lib/VideoFigure.tsx", "block"]]) {
  const { VideoFigure } = load(entry, "figure-" + name);
  const clip = html(VideoFigure, { src: "/video/a.mp4", poster: "/video/a.poster.jpg" });
  ok(/<video[^>]+src="\/video\/a\.mp4"/.test(clip) && !/<iframe/.test(clip), `${name}: a clip is still a <video>`);
  const tex = html(VideoFigure, { src: YT, poster: "" }); // no `controls` asked for: still the player
  ok(/<iframe[^>]+youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0&(amp;)?controls=1&(amp;)?playsinline=1&(amp;)?iv_load_policy=3"/.test(tex), `${name}: the host's player with controls, never autoplay`);
  ok(!/autoplay=1|mute=1|controls=0/.test(tex), `${name}: no texture parameters on a hosted video`);
  ok(/class="ta-video-embed/.test(tex) && !/aria-hidden="true"/.test(tex.replace(/<img[^>]*>/, "")) && !/tabindex="-1"/.test(tex), `${name}: content, not decoration`);
  ok(/<img[^>]+i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/hqdefault\.jpg/.test(tex), `${name}: YouTube's still stands in for the poster`);
  ok(!/<video/.test(tex), `${name}: no <video> beside the player`);
  const con = html(VideoFigure, { src: YT, poster: "/p.jpg", controls: true, label: "Our story" });
  ok(/title="Our story"/.test(con) && /allowfullscreen/.test(con) && /alt="Our story"/.test(con), `${name}: named, fullscreen allowed, the still carries the name`);
  const vm = html(VideoFigure, { src: VM, poster: "" });
  ok(/player\.vimeo\.com\/video\/123456789\?dnt=1&(amp;)?title=0&(amp;)?byline=0&(amp;)?portrait=0/.test(vm) && !/background=1/.test(vm) && !/<img/.test(vm), `${name}: Vimeo without overlays, no still to borrow`);
}

let builtin = null;
try { builtin = load("site/src/lib/builtin-blocks.tsx", "builtin"); } catch (e) { console.log("builtin Video block: not bundled here (" + String(e.message || e).split("\n")[0] + ")"); }
if (builtin) {
  const Video = builtin.builtinBlocks.video.component;
  const out = html(Video, { id: "v", video: { src: YT, poster: "", alt: "Tour" }, width: "contained", ratio: "16/9", controls: true });
  ok(/<iframe[^>]+embed\/dQw4w9WgXcQ\?rel=0&(amp;)?controls=1/.test(out) && /i\.ytimg\.com/.test(out), "built-in Video block renders the player and YouTube's still");
  const quiet = html(Video, { id: "v", video: { src: YT, poster: "", alt: "" }, width: "contained", ratio: "16/9", controls: false });
  ok(/<iframe/.test(quiet) && !/autoplay=1/.test(quiet) && /class="ta-video-embed/.test(quiet), "built-in Video block never autoplays a hosted video, even without controls");
  const clip = html(Video, { id: "v", video: { src: "/video/a.mp4", poster: "/video/a.poster.jpg", alt: "" }, width: "contained", ratio: "16/9", controls: false });
  ok(/<video/.test(clip) && !/<iframe/.test(clip), "built-in Video block still renders a clip as <video>");
}
console.log(`video-embed-render: ${checks} checks pass.`);
