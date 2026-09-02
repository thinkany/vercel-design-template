// ©2026 thinkany llc. All rights reserved.
// DESIGNER-DEFINED CONTENT TYPES (KEEP tier: a template upgrade never overwrites
// this file). Pages and Posts are built in (site/src/content.config.ts); add any
// further type here as a collection: a folder under content/ + a zod schema.
//
// Example, a Products type:
//
//   import { defineCollection } from "astro:content";
//   import { glob } from "astro/loaders";
//   import { z } from "astro/zod";
//
//   const products = defineCollection({
//     loader: glob({ pattern: "**/*.json", base: "../content/products" }),
//     schema: z.object({
//       title: z.string(),
//       price: z.number(),
//       image: z.string().optional(),
//       blocks: z.array(z.object({ type: z.string(), props: z.record(z.any()).default({}) })).default([]),
//     }),
//   });
//
//   export const collections = { products };
//
// Routing + a template for each type land in a later phase; for now a declared
// type is validated at build and readable via getCollection("<name>").
export const collections = {};
