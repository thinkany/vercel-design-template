// ©2026 thinkany llc. All rights reserved.
// The SITE build target. A second build in the same project that renders the
// designer's blocks (site/blocks) + content (content/) to static HTML. The design
// surface (vite.config.ts at the repo root: dashboard, variations, styleguide,
// Figma export, gated preview) is untouched; this target only IMPORTS from it
// (tokens, theme, config, components via the same `@` alias).
//
// Run from the repo root:  npm run site:dev | site:build | site:preview
// (each passes --root site, so Astro treats this folder as its project).
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export default defineConfig({
  // The canonical public URL. Feeds the sitemap, canonical links and og:url.
  // Set SITE_URL in the project's .env once the domain is known; the fallback
  // keeps local builds working and is obviously wrong in output.
  site: process.env.SITE_URL || "https://example.com",
  outDir: "../dist-site",
  // Static output: every route is prerendered at build. Forms and other dynamic
  // pieces arrive later as Vercel functions, not as server rendering.
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Read the scaffold's committed .env (VITE_CLIENT_NAME etc.) so `@/config/site`
    // resolves the same brand values the design surface uses.
    envDir: repoRoot,
    resolve: { alias: { "@": path.resolve(repoRoot, "src") } },
    server: { fs: { allow: [repoRoot] } },
  },
});
