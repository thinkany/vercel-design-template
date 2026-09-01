// Restore the comment-stripped source tree after a packaged build.
//
// strip-comments.cjs rewrites desktop/*.{js,cjs,mjs} IN PLACE so electron-builder
// packs the stripped copy. This puts the commented source back. `npm run dist`
// runs it with `;` (not `&&`) so it ALSO runs when electron-builder fails — a
// broken build must never leave the working tree stripped.
//
// Restore is via `git checkout --` on exactly the paths the stripper targets, so
// it can only ever undo the stripper's own edits. Anything outside that set
// (including every uncommitted change elsewhere) is untouched.
//
// SAFETY: if a stripped file also had UNCOMMITTED edits when the build started,
// restoring would discard them. So the stripper refuses to run on a dirty tree
// (see assertClean below, called from strip-comments) — build from a committed
// state, which is what `npm run dist` implies anyway.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..", "..");

// The exact pathspec set strip-comments.cjs can modify, as git pathspecs.
// `:(glob)` makes `*` match within a directory only, and the leading `:!` lines
// re-state the stripper's skip list so the two can't drift apart. One combined
// spec (rather than one per directory) also avoids `git checkout` erroring on a
// pathspec that happens to match nothing.
const PATHSPECS = [
  ":(glob)desktop/**/*.js",
  ":(glob)desktop/**/*.cjs",
  ":(glob)desktop/**/*.mjs",
  ":(exclude,glob)desktop/template/**",
  ":(exclude,glob)desktop/bin/**",
  ":(exclude,glob)desktop/dev/**",
  ":(exclude,glob)desktop/build/**",
];

function run() {
  try {
    execFileSync("git", ["-C", appRoot, "checkout", "--", ...PATHSPECS], { stdio: "pipe" });
    console.log("[restore-source] commented source restored");
  } catch (e) {
    // Loud, because a silent failure here leaves the developer's tree stripped.
    console.error("[restore-source] FAILED to restore source:", e.message);
    console.error(`[restore-source] run manually:  git -C "${appRoot}" checkout -- ${PATHSPECS.join(" ")}`);
    process.exitCode = 1;
  }
}

if (require.main === module) run();

module.exports = { run, PATHSPECS };
