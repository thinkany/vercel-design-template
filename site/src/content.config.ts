// ©2026 thinkany llc. All rights reserved.
// CONTENT COLLECTIONS — the built-in types (CORE tier). Every content type is a
// collection: a zod schema + a folder of one-file-per-entry under content/.
//
//   pages  content/pages/*.json   ordered block instances + SEO
//   posts  content/posts/*.md     markdown + frontmatter (the blog)
//
// Designer-defined types (Products, Landing pages, …) are declared in
// content/collections.ts (KEEP tier) and merged in below, so an upgrade can
// improve the built-ins without touching the designer's types.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { blockInstance } from "./lib/blocks";
import { seoFields } from "./lib/seo";
import { entrySchema, typesFile } from "./lib/types";
import { collections as designerCollections } from "../../content/collections";
import rawTypes from "../../content/types.json";

const pages = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "../content/pages" }),
  schema: z.object({
    title: z.string(),
    /** URL path without leading slash. Omit (or "") for the home page. Defaults to the file name. */
    slug: z.string().optional(),
    seo: seoFields.default({}),
    blocks: z.array(blockInstance).default([]),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "../content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    /** Short summary for lists + the default meta description. */
    description: z.string().optional(),
    /** Cover image, a public/ path. */
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    seo: seoFields.default({}),
  }),
});

// Designer-defined types (content/types.json): one collection per type, entries
// under content/<key>/*.json, validated against the type's fields.
const parsedTypes = typesFile.safeParse(rawTypes);
if (!parsedTypes.success) {
  const issues = parsedTypes.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  throw new Error(`content/types.json is invalid:\n${issues}`);
}
const typed: Record<string, ReturnType<typeof defineCollection>> = {};
for (const t of parsedTypes.data.types) {
  if (t.key === "pages" || t.key === "posts") throw new Error(`content/types.json: "${t.key}" is a built-in type`);
  typed[t.key] = defineCollection({
    loader: glob({ pattern: "**/*.json", base: `../content/${t.key}` }),
    schema: entrySchema(t),
  });
}

export const collections = { pages, posts, ...typed, ...designerCollections };
