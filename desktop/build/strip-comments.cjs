// Strip comments from the app's JS so the shipped bundle carries logic, not a tour.
//
// The source tree stays fully commented — the comments are how this codebase is
// maintained, and nothing here is meant to change that. This rewrites files IN
// PLACE as a build step, and `npm run dist` restores them from git immediately
// after electron-builder has packed (see package.json "dist" / "postdist").
//
// WHY: comments in the app modules read as an architecture map. They name the
// cloud endpoints, spell out which function gates each license tier, and point
// at where the design-variety moat lives. Stripping them is hardening, not
// secrecy — a determined reader can still follow the logic; this just declines
// to hand over the annotated walkthrough.
//
// SCOPE: desktop/ only, and deliberately NOT desktop/template/. That snapshot is
// copied into the designer's project, where its comments guide both the designer
// and the agent working there. Also skipped: desktop/bin/* (shell + shebang
// scripts spawned as executables, not modules we should rewrite) and the two
// bundle-excluded IP files, which never ship at all.
//
// esbuild (already present as a Vite dependency) does the transform. Two modes,
// because they trade off differently:
//
//   • Default (LOGIC files): comments out, nothing else touched. No minify, no
//     mangling, no bundling — one source line stays one output line, so a stack
//     trace from a user still points at a real place. esbuild does leave a
//     residue here: comments sitting INSIDE object literals survive, so this
//     mode is "most comments gone", not "all".
//
//   • COLLAPSE (data/catalog files): adds minifyWhitespace, which removes the
//     object-literal residue too. It costs line numbers (a file becomes a few
//     very long lines), so it is reserved for files that are essentially data —
//     where a stack trace was never going to tell you much anyway, and where the
//     residue is worst (copy.js is one giant object literal: plain mode strips
//     barely 1% of it, collapse mode gets ~25%).
//
// keepNames is set in collapse mode so function/class names survive for the
// traces that do still matter.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");

const appRoot = path.resolve(__dirname, "..", "..");

// Roots to strip, relative to appRoot.
const STRIP_ROOTS = ["desktop"];
const EXT = new Set([".js", ".cjs", ".mjs"]);

// Paths (posix, relative to appRoot) that must never be rewritten.
const SKIP_DIRS = [
  "desktop/template", // ships to designer projects — comments are the point there
  "desktop/bin",      // spawned executables (shell script + shebang CLI)
  "desktop/dev",      // excluded from the bundle anyway
  "desktop/build",    // build tooling; never ships as app logic
];

function skipped(relPosix) {
  return SKIP_DIRS.some((d) => relPosix === d || relPosix.startsWith(`${d}/`));
}

// Files that are catalogs/data rather than logic — safe to collapse, and the
// only way to clear comments nested inside their object literals.
const COLLAPSE = new Set(["desktop/copy.js"]);

// Must stay in lockstep with restore-source.cjs PATHSPECS — the set of files
// this step may rewrite, and therefore the set the restore puts back.
const { PATHSPECS: RESTORE_PATHSPECS } = require("./restore-source.cjs");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPosix = path.relative(appRoot, abs).split(path.sep).join("/");
    if (skipped(relPosix)) continue;
    if (entry.isDirectory()) walk(abs, out);
    else if (EXT.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

function stripFile(abs, relPosix = path.relative(appRoot, abs).split(path.sep).join("/")) {
  const src = fs.readFileSync(abs, "utf8");
  // .mjs is ESM and .cjs is CommonJS; pin the format so esbuild never rewrites
  // module syntax from one into the other.
  const ext = path.extname(abs);
  const format = ext === ".mjs" ? "esm" : ext === ".cjs" ? "cjs" : undefined;
  const collapse = COLLAPSE.has(relPosix);
  const out = esbuild.transformSync(src, {
    loader: "js",
    format,
    platform: "node",
    target: "node20",
    legalComments: "none", // drop @license / @preserve blocks too
    minify: false,
    minifyWhitespace: collapse,
    keepNames: collapse,
    sourcemap: false,
  });
  fs.writeFileSync(abs, out.code, "utf8");
  return Buffer.byteLength(src) - Buffer.byteLength(out.code);
}

// The build restores the source afterwards with `git checkout --` on these
// paths, which would DISCARD any uncommitted edit to them. So refuse to strip a
// dirty tree: commit (or stash) first. TA_STRIP_FORCE=1 overrides, for the case
// where you genuinely want to throw the edits away.
function assertClean() {
  let out = "";
  try {
    out = execFileSync("git", ["-C", appRoot, "status", "--porcelain", "--", ...RESTORE_PATHSPECS], {
      encoding: "utf8",
    }).trim();
  } catch {
    // Not a git checkout (or git unavailable) → restore can't work either.
    throw new Error(
      "[strip-comments] not a git checkout — refusing to strip, since the source could not be restored afterwards.",
    );
  }
  if (out && !process.env.TA_STRIP_FORCE) {
    throw new Error(
      "[strip-comments] uncommitted changes in files this step rewrites:\n" +
        out +
        "\n\nThe post-build restore would discard them. Commit or stash first" +
        " (or set TA_STRIP_FORCE=1 to strip anyway and lose them).",
    );
  }
}

function run() {
  assertClean();
  let files = 0;
  let saved = 0;
  for (const root of STRIP_ROOTS) {
    const abs = path.join(appRoot, root);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const relPosix = path.relative(appRoot, file).split(path.sep).join("/");
      try {
        saved += stripFile(file, relPosix);
        files++;
      } catch (e) {
        // A file that won't parse means a half-stripped bundle — fail loudly
        // rather than shipping one.
        throw new Error(`[strip-comments] ${relPosix}: ${e.message}`);
      }
    }
  }
  console.log(`[strip-comments] ${files} file(s), ${(saved / 1024).toFixed(1)} KB of comments removed`);
  console.log("[strip-comments] source is now stripped IN PLACE — `npm run dist` restores it via postdist");
}

if (require.main === module) run();

module.exports = { run, stripFile };
