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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// content/site.json (designer-owned) pins the site to ONE design variation and
// carries the public URL + nav. The pinned variation's styles (fonts, tokens,
// globals) are exposed as the `@design` alias so site.css never hardcodes an id.
const siteJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "content", "site.json"), "utf8"));
const design = siteJson.design || "v00";
const designStyles =
  design === "v00"
    ? path.resolve(repoRoot, "src", "styles")
    : path.resolve(repoRoot, "src", "variations", design, "styles");
if (!fs.existsSync(designStyles)) {
  throw new Error(`content/site.json pins design "${design}", but ${designStyles} does not exist.`);
}

export default defineConfig({
  // The canonical public URL. Feeds the sitemap, canonical links and og:url.
  // SITE_URL in the environment wins (a Vercel env), then content/site.json's
  // `url`; the fallback keeps local builds working and is obviously wrong in output.
  site: process.env.SITE_URL || siteJson.url || "https://example.com",
  outDir: "../dist-site",
  // The project's public/ (images, brand, favicon) is the site's too, so a photo
  // the design references as /images/hero.jpg resolves identically here.
  publicDir: "../public",
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
    resolve: {
      alias: {
        "@": path.resolve(repoRoot, "src"),
        "@design": designStyles,
      },
    },
    server: { fs: { allow: [repoRoot] } },
    // App-scaffolded projects SYMLINK node_modules to the app's own copy. With
    // that layout Vite's SSR build leaves the React renderer external
    // (`import '@astrojs/react/server.js'`), so Node loads it natively at route
    // generation and dies on its `astro:react:opts` virtual import ("Only URLs
    // with a scheme in: file, data, and node are supported"). Bundling the
    // renderer is correct for every layout, so it's unconditional.
    ssr: { noExternal: ["@astrojs/react"] },
  },
});
