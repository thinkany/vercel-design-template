// Bundle the rich-text editor (TipTap + markdown) into one classic script the
// renderer can load with a <script> tag: shell.js has no bundler and TipTap is
// ESM-only. Output is desktop/vendor/editor.js (committed, so `npm run desktop`
// needs no build step; `predist` regenerates it). Exposes window.TAEditor.
const path = require("node:path");
const esbuild = require("esbuild");

const appRoot = path.resolve(__dirname, "..", "..");
esbuild.buildSync({
  entryPoints: [path.join(__dirname, "editor-entry.mjs")],
  bundle: true,
  format: "iife",
  globalName: "TAEditor",
  platform: "browser",
  target: ["chrome120"],
  minify: true,
  legalComments: "none",
  outfile: path.join(appRoot, "desktop", "vendor", "editor.js"),
  logLevel: "warning",
});
console.log("[bundle-editor] wrote desktop/vendor/editor.js");
