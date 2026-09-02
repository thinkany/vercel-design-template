// ©2026 thinkany llc. All rights reserved.
// CONTENT TYPES — designer-defined collections, declared as DATA in
// content/types.json (KEEP) and turned into collections, routes and forms here
// (CORE). A type is a key, a label, a URL path, a list of fields, and a template
// (blocks whose props bind to the entry's fields with {{field}}). Entries are
// content/<key>/*.json, one per entry; an entry may carry its own `blocks`
// (a landing page) instead of the template.
import { z, type ZodTypeAny } from "astro/zod";
import { blockInstance } from "./blocks";
import { seoFields } from "./seo";

export const FIELD_KINDS = ["text", "textarea", "richtext", "number", "boolean", "date", "image", "select", "list", "link", "reference"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const fieldDef = z.object({
  /** The entry property ("price"). */
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string(),
  kind: z.enum(FIELD_KINDS),
  required: z.boolean().default(false),
  /** select: the options; reference: the other type's key. */
  options: z.array(z.string()).optional(),
  reference: z.string().optional(),
  hint: z.string().optional(),
});
export type FieldDef = z.infer<typeof fieldDef>;

export const typeDef = z.object({
  /** Collection key and folder name ("products"). */
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Human label, plural ("Products"). */
  label: z.string(),
  /** Singular, for the CMS ("Product"). */
  singular: z.string().optional(),
  /** URL path for the type ("/products"); entries live at "<path>/<slug>". */
  path: z.string().regex(/^\/[a-z0-9-]*$/),
  fields: z.array(fieldDef).default([]),
  /** Blocks rendering an entry, with {{field}} bindings in string props. */
  template: z.array(blockInstance).default([]),
  /** The index page at <path>: a heading + a card per entry. Omit for no index. */
  index: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
});
export type TypeDef = z.infer<typeof typeDef>;

export const typesFile = z.object({ types: z.array(typeDef).default([]) });

/** Zod for one field's value. */
export function fieldSchema(f: FieldDef): ZodTypeAny {
  let s: ZodTypeAny;
  switch (f.kind) {
    case "number": s = z.number(); break;
    case "boolean": s = z.boolean(); break;
    case "list": s = z.array(z.string()); break;
    case "link": s = z.object({ label: z.string(), href: z.string() }); break;
    case "image": s = z.object({ src: z.string(), alt: z.string().default("") }); break;
    case "select": s = f.options && f.options.length ? z.enum(f.options as [string, ...string[]]) : z.string(); break;
    case "date": s = z.string(); break;
    default: s = z.string(); // text, textarea, richtext, reference (the other entry's id)
  }
  return f.required ? s : s.optional();
}

/** The entry schema for a type: title + slug + seo + the fields + optional blocks. */
export function entrySchema(t: TypeDef) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of t.fields) shape[f.key] = fieldSchema(f);
  return z.object({
    title: z.string(),
    slug: z.string().optional(),
    seo: seoFields.default({}),
    /** Own blocks (a landing page); when present the type's template is not used. */
    blocks: z.array(blockInstance).optional(),
    ...shape,
  });
}

/**
 * Resolve a template's {{field}} bindings against an entry. A string prop that is
 * exactly "{{key}}" becomes the field's VALUE (so an image or link object binds
 * whole); a string containing bindings gets them interpolated as text. Missing
 * fields bind to "" (or undefined for whole-value bindings) so optional props
 * fall back to their defaults.
 */
export function bindTemplate(template: z.infer<typeof blockInstance>[], entry: Record<string, unknown>) {
  const value = (key: string) => (key === "title" ? entry.title : key === "slug" ? entry.slug : entry[key]);
  const bind = (v: unknown): unknown => {
    if (typeof v === "string") {
      const whole = v.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
      if (whole) return value(whole[1]);
      return v.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => { const x = value(k); return x == null ? "" : String(x); });
    }
    if (Array.isArray(v)) return v.map(bind);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, bind(x)]));
    return v;
  };
  return template.map((b) => ({ type: b.type, props: bind(b.props) as Record<string, unknown> }));
}
