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
import selfHostFonts from "./src/lib/self-host-fonts.mjs";
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

// URLs of entries flagged `noindex` (pages: seo.noindex in content/pages/*.json;
// posts: `noindex: true` under seo in the frontmatter), so the sitemap agrees with
// the pages' own robots meta. Read at config time; the content loaders don't
// reach the sitemap integration.
function noindexPaths() {
  const out = new Set();
  const pagesDir = path.join(repoRoot, "content", "pages");
  const postsDir = path.join(repoRoot, "content", "posts");
  try {
    const docs = {};
    for (const f of fs.readdirSync(pagesDir)) { if (f.endsWith(".json")) { try { docs[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(pagesDir, f), "utf8")) || {}; } catch {} } }
    // Route = parent chain (mirrors site/src/lib/pages.ts, which can't be imported here).
    const route = (id) => { const parts = []; let cur = id, g = 0; while (cur && docs[cur] && g++ < 16) { if (cur === "home") break; parts.unshift(docs[cur].slug ?? cur); cur = docs[cur].parent; } return parts.join("/"); };
    for (const id of Object.keys(docs)) { const d = docs[id]; if (d && d.seo && d.seo.noindex) out.add("/" + route(id)); }
  } catch { /* no pages dir */ }
  try {
    for (const f of fs.readdirSync(postsDir)) {
      if (!/\.mdx?$/.test(f)) continue;
      const fm = (fs.readFileSync(path.join(postsDir, f), "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
      if (/^seo:\n(?:[ \t]+.*\n)*?[ \t]+noindex:[ \t]*true/m.test(fm) || /^draft:[ \t]*true/m.test(fm)) out.add("/blog/" + f.replace(/\.mdx?$/, ""));
    }
  } catch { /* no posts dir */ }
  // designer-defined types: entries flagged noindex, under the type's path
  try {
    const { types } = JSON.parse(fs.readFileSync(path.join(repoRoot, "content", "types.json"), "utf8"));
    for (const t of types || []) {
      const dir = path.join(repoRoot, "content", t.key);
      let files = []; try { files = fs.readdirSync(dir); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        if (d && d.seo && d.seo.noindex) out.add(`${t.path}/${d.slug ?? f.replace(/\.json$/, "")}`);
      }
    }
  } catch { /* no types */ }
  return out;
}
const NOINDEX = noindexPaths();
// Posts' last-edited stamps → sitemap lastmod (the app writes `updated` on every save).
function lastModified() {
  const out = new Map();
  try {
    for (const f of fs.readdirSync(path.join(repoRoot, "content", "posts"))) {
      if (!/\.mdx?$/.test(f)) continue;
      const fm = (fs.readFileSync(path.join(repoRoot, "content", "posts", f), "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
      const m = fm.match(/^updated:[ \t]*"?([^"\n]+)"?/m);
      if (m) { const d = new Date(m[1].trim()); if (!Number.isNaN(d.getTime())) out.set("/blog/" + f.replace(/\.mdx?$/, ""), d); }
    }
  } catch { /* no posts */ }
  return out;
}
const LASTMOD = lastModified();

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
  integrations: [
    react(),
    // The design's Google Fonts, served from this origin with preloads (no font flash).
    selfHostFonts({ repoRoot, stylesDir: designStyles }),
    // The sitemap is a build-time choice (Settings): off, or off while search
    // engines are discouraged, and the integration isn't loaded at all.
    ...(siteJson.seo && (siteJson.seo.discourage || siteJson.seo.sitemap === false) ? [] : [sitemap({
      filter: (page) => { try { return !NOINDEX.has(new URL(page).pathname.replace(/\/$/, "") || "/"); } catch { return true; } },
      serialize: (item) => { try { const d = LASTMOD.get(new URL(item.url).pathname.replace(/\/$/, "")); if (d) item.lastmod = d.toISOString(); } catch {} return item; },
    })]),
  ],
  // No dev toolbar: it's a developer's island/audit inspector, and inside the app's
  // Site tab it's a floating pill the designer can't use for anything.
  devToolbar: { enabled: false },
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
