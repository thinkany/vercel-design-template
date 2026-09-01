// Build-time step: snapshot the pristine `main`-branch template into
// desktop/template/ so the PACKAGED app can scaffold new projects WITHOUT git.
//
// In dev, main.cjs scaffolds a project with `git archive main | tar` — but a
// packaged .app has no git repo and no .git dir. So before electron-builder
// runs (see package.json "predist"), we materialize the same clean export as a
// plain directory that ships inside the app bundle. The runtime scaffolder
// (scaffoldProject in main.cjs) copies from this dir when app.isPackaged.
//
// Output is identical to `git archive main` minus the app-internal IP paths in
// TEMPLATE_EXCLUDE — so a project scaffolded from the bundle matches one
// scaffolded in dev, file-for-file.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { TEMPLATE_EXCLUDE } = require("../template-exclude.cjs");

const appRoot = path.resolve(__dirname, "..", ".."); // the git worktree root
const outDir = path.join(appRoot, "desktop", "template");

function run() {
  // Fresh each build — never ship a stale snapshot.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const excludes = TEMPLATE_EXCLUDE
    .map((p) => `--exclude="${p}" --exclude="${p}/*"`)
    .join(" ");
  execSync(`git -C "${appRoot}" archive main | tar -x ${excludes} -C "${outDir}"`, {
    stdio: "pipe",
  });
  // Belt-and-suspenders: guarantee nothing on the exclude list survived,
  // regardless of tar variant. (Same defense main.cjs applies at runtime.)
  for (const p of TEMPLATE_EXCLUDE) {
    fs.rmSync(path.join(outDir, p), { recursive: true, force: true });
  }

  // The repo root package.json is the ELECTRON app's (main now carries the app). A scaffolded
  // project needs the clean SCAFFOLD package.json instead — swap it in. (scaffold-package.json
  // is the committed source of truth for the scaffold's deps; keep it in sync if they change.)
  fs.copyFileSync(
    path.join(appRoot, "desktop", "build", "scaffold-package.json"),
    path.join(outDir, "package.json"),
  );

  // Likewise the root CLAUDE.md is the app-DEV contract; a scaffolded project needs the
  // scaffold's designer-facing CLAUDE.md instead — inject it. (Keep scaffold-CLAUDE.md in sync
  // if the scaffold's design contract changes.)
  fs.copyFileSync(
    path.join(appRoot, "desktop", "build", "scaffold-CLAUDE.md"),
    path.join(outDir, "CLAUDE.md"),
  );

  const count = execSync(`find "${outDir}" -type f | wc -l`).toString().trim();
  console.log(`[make-template] wrote pristine template snapshot → desktop/template/ (${count} files)`);
}

run();
