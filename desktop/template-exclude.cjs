// Single source of truth for the app-internal paths that must NEVER be shipped
// into a scaffolded project. Required by BOTH the runtime scaffolder
// (main.cjs) and the build-time template-snapshot generator
// (build/make-template.cjs) so the two can't drift.
//
// The export-to-Figma tooling is app-owned — the app runs it against a project
// via `--project` / `--project-root`, so it must not live inside the project.
// `cloud-export/` holds the derive IP (which actually runs server-side); it must
// never be in a project (and, separately, the app's own build `files` never
// include it either). Mirrors the .gitattributes export-ignore globs on `main`.
const TEMPLATE_EXCLUDE = [
  "cloud-export",
  "scripts/export-to-figma.mjs",
  "scripts/export-brand-to-figma.mjs",
  "scripts/export-library-to-figma.mjs",
  "scripts/export-reconstruct-to-figma.mjs",
  "scripts/figma-brand-library.plugin.js",
  "scripts/figma-component-library.plugin.js",
  "scripts/figma-reconstruct-library.plugin.js",
];

module.exports = { TEMPLATE_EXCLUDE };
