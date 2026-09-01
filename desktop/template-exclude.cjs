// Single source of truth for the app-internal paths that must NEVER be shipped
// into a scaffolded project. Required by BOTH the runtime scaffolder
// (main.cjs) and the build-time template-snapshot generator
// (build/make-template.cjs) so the two can't drift.
//
// The export-to-Figma tooling is app-owned — the app runs it against a project
// via `--project` / `--project-root`, so it must not live inside the project.
// Mirrors the .gitattributes export-ignore globs on `main`. (The derive IP that
// used to live in `cloud-export/` now lives in the standalone vercel-derive repo.)
//
// Since `main` now carries the Electron app itself (one production line), the app
// code + its docs are stripped from the scaffold snapshot too. `make-template` also
// swaps the repo's electron package.json for the clean scaffold one (scaffold-package.json).
const TEMPLATE_EXCLUDE = [
  "scripts/export-to-figma.mjs",
  "scripts/export-brand-to-figma.mjs",
  "scripts/export-library-to-figma.mjs",
  "scripts/export-reconstruct-to-figma.mjs",
  "scripts/figma-brand-library.plugin.js",
  "scripts/figma-component-library.plugin.js",
  "scripts/figma-reconstruct-library.plugin.js",
  "desktop",           // the Electron app (app-internal; never in a scaffolded project)
  "INSTALL.md",        // app install docs
  "VERCEL-PUBLISH.md", // app publish docs
  "DEVELOPMENT.md",    // app-development guide (repo structure + workflow)
];

module.exports = { TEMPLATE_EXCLUDE };
