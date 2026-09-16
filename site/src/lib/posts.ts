// ©2026 thinkany llc. All rights reserved.
// POSTS (CORE): the blog posts, loaded once for the built-in Posts block, so both
// renderers (the site build and the design surface) see the same list with no
// route-level plumbing. The routes themselves read the posts through astro:content;
// this reads the same files raw (content/posts/*.md, the app's frontmatter), so the
// block also renders in the design surface, where astro:content does not exist.
// Mirrors entries.ts: eager glob in a try/catch (the app's schema introspection
// bundles this for Node, where import.meta.glob doesn't exist).

import { blogPath, blogTag, postRoute, tagSlug } from "./site";
export { blogPath, blogTag, postRoute, tagSlug };

/** Strings the rendered block needs on the page. */
export const POSTS_UI = {
  all: "All",
  filterLabel: "Show",
  empty: "Nothing matches that filter.",
  none: "No posts yet. Write one in the Posts tab.",
  more: "All posts",
};

export interface Post {
  id: string;
  title: string;
  slug: string;
  date: string;
  description: string;
  image: string;
  tags: string[];
  draft: boolean;
}

const unquote = (s: string) => {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    if (t.startsWith('"')) { try { return JSON.parse(t) as string; } catch { /* not JSON-quoted */ } }
    return t.slice(1, -1);
  }
  return t;
};

/** The app's frontmatter (desktop/main.cjs serializeFrontmatter): `key: "value"`, `tags: ["a", "b"]`, `draft: true`, a nested `seo:` block (skipped here). */
export function parsePost(raw: string, id: string): Post | null {
  const m = String(raw || "").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const data: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/); // top level only: indented (seo) lines are skipped
    if (!kv) continue;
    const [, key, value] = kv;
    if (/^\[.*\]$/.test(value.trim())) lists[key] = value.trim().slice(1, -1).split(",").map((x) => unquote(x)).filter(Boolean);
    else data[key] = unquote(value);
  }
  if (!data.title) return null;
  return {
    id,
    title: data.title,
    slug: data.slug || id,
    date: data.date || "",
    description: data.description || "",
    image: data.image || "",
    tags: lists.tags || [],
    draft: data.draft === "true",
  };
}

/** Newest first; undated last, then by title. */
export function byDateDesc(a: Post, b: Post): number {
  if (a.date !== b.date) { if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date); }
  return a.title.localeCompare(b.title);
}

// Drafts show while previewing (Vite / Astro dev), marked as drafts, and drop out of
// the published build, as the blog index does.
const dev = (() => { try { return !!(import.meta.env && import.meta.env.DEV); } catch { return false; } })();
let files: Record<string, string> = {};
try {
  files = import.meta.glob("../../../content/posts/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
} catch { /* not under Vite */ }

/** Every post, newest first (drafts only in dev). */
export const posts: Post[] = Object.entries(files)
  .map(([file, raw]) => parsePost(raw, file.replace(/^.*\//, "").replace(/\.md$/, "")))
  .filter((p): p is Post => !!p && (dev || !p.draft))
  .sort(byDateDesc);

export function postDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
