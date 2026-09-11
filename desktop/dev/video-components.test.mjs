// ©2026 thinkany llc. All rights reserved.
// video-components.test.mjs — the rules <VideoBackground> and <VideoFigure> must keep,
// checked against their rendered markup: BOTH the poster still and the clip are always
// present (motion.css decides which shows, so the same component works as static HTML in
// a promoted site block), decoration stays out of the tab order, and content that carries
// meaning gets a name and controls.
//
// Rendered with react-dom/server, which is what a site block's static HTML amounts to.
// What is NOT covered here: motion.css actually hiding the clip for reduced motion and in
// the Figma capture. That is CSS, and wants a real browser: check it in the app.
//
//   node desktop/dev/video-components.test.mjs
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, "..", "..");

// Build the two components + a render harness into one bundle, so the JSX and the
// project's own module resolution are the real ones.
const tmp = path.join(ROOT, `vcomp-out-${process.pid}`);
// Entry and config live in the project: only there can they resolve react + the plugin.
const entry = path.join(ROOT, `vcomp-entry-${process.pid}.tsx`);
fs.writeFileSync(entry, `
import { renderToStaticMarkup } from "react-dom/server";
import { VideoBackground } from ${JSON.stringify(path.join(ROOT, "src/app/components/VideoBackground.tsx"))};
import { VideoFigure } from ${JSON.stringify(path.join(ROOT, "src/app/components/VideoFigure.tsx"))};
const out = {
  background: renderToStaticMarkup(
    <VideoBackground src="/video/x.mp4" poster="/video/x.poster.avif" />
  ),
  backgroundNoScrim: renderToStaticMarkup(
    <VideoBackground src="/video/x.mp4" poster="/video/x.poster.avif" scrim="none" />
  ),
  figureTexture: renderToStaticMarkup(
    <VideoFigure src="/video/y.mp4" poster="/video/y.poster.avif" className="aspect-video" label="Process" />
  ),
  figureContent: renderToStaticMarkup(
    <VideoFigure src="/video/z.mp4" poster="/video/z.poster.avif" className="aspect-video" label="Explainer" controls />
  ),
};
console.log(JSON.stringify(out));
`);
// The config must live inside the project: a temp-dir config can't resolve vite's own
// plugins from node_modules.
const cfg = path.join(ROOT, `vite.vcomp-${process.pid}.ts`);
fs.writeFileSync(cfg, `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: ${JSON.stringify(ROOT)},
  plugins: [react()],
  build: { ssr: ${JSON.stringify(entry)}, outDir: ${JSON.stringify(tmp)}, minify: false },
});
`);

let build;
try {
  build = spawnSync("npx", ["vite", "build", "--config", cfg], { cwd: ROOT, encoding: "utf8", env: { ...process.env } });
} finally {
  fs.rmSync(cfg, { force: true });
  fs.rmSync(entry, { force: true });
}
assert.equal(build.status, 0, `the probe bundle should build:\n${build.stderr}`);

const bundled = fs.readdirSync(tmp).find((f) => f.endsWith(".js"));
assert.ok(bundled, "a bundle was produced");
const ran = spawnSync(process.execPath, [path.join(tmp, bundled)], { cwd: ROOT, encoding: "utf8" });
assert.equal(ran.status, 0, `the probe should render:\n${ran.stderr}`);
const m = JSON.parse(ran.stdout.trim().split("\n").pop());

// ---- VideoBackground ---------------------------------------------------------
// Both layers always render: the CSS decides. A site block has no runtime to do it.
assert.match(m.background, /<img[^>]+ta-video-still/, "the poster still is always in the markup");
assert.match(m.background, /<video[^>]+ta-video-clip/, "and so is the clip");
assert.match(m.background, /src="\/video\/x\.poster\.avif"/, "the still points at the poster");
assert.match(m.background, /data-video-bg/, "the wrapper is identifiable");
// Decoration: muted, looping, inline, unfocusable, unannounced. Not props, rules.
assert.match(m.background, /muted/, "always muted");
assert.match(m.background, /loop/, "always looping");
assert.match(m.background, /playsInline|playsinline/, "always inline (iOS would fullscreen it)");
assert.match(m.background, /tabIndex="-1"|tabindex="-1"/, "never in the tab order");
assert.ok(!/controls/.test(m.background), "a background never shows controls");
// The scrim comes off the palette token, not a hardcoded colour.
assert.match(m.background, /from-ta-ink\//, "the default scrim derives from ta-ink");
assert.ok(!/#[0-9a-f]{6}/i.test(m.background), "no hardcoded hex colour in the scrim");
assert.ok(!/from-ta-ink\//.test(m.backgroundNoScrim), 'scrim="none" renders no overlay');

// ---- VideoFigure: texture ----------------------------------------------------
assert.match(m.figureTexture, /<img[^>]+ta-video-still/, "texture carries the poster still");
assert.match(m.figureTexture, /<video[^>]+ta-video-clip/, "and the clip");
assert.match(m.figureTexture, /alt=""/, "decorative texture has an empty alt");
assert.match(m.figureTexture, /aspect-video/, "the caller's box classes are kept");
assert.match(m.figureTexture, /tabIndex="-1"|tabindex="-1"/, "texture is not focusable");
assert.ok(!/controls/.test(m.figureTexture), "texture has no controls");

// ---- VideoFigure: content ----------------------------------------------------
// A clip that carries meaning is named and operable, and so is the still standing in.
assert.match(m.figureContent, /controls/, "content gets a visible control");
assert.match(m.figureContent, /aria-label="Explainer"/, "content is named");
assert.match(m.figureContent, /alt="Explainer"/, "the still keeps that name");
assert.ok(!/tabindex="-1"/i.test(m.figureContent), "content stays keyboard reachable");
assert.ok(!/aria-hidden/.test(m.figureContent), "content is not hidden from a screen reader");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("all video-component assertions passed");
