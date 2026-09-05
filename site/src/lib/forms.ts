// ©2026 thinkany llc. All rights reserved.
// FORMS (CORE). A form is a designer-owned definition in content/forms/<id>.json
// (edited in the app's Forms tab): its fields, the submit label, what happens
// after a submission, and who receives it. The built-in Form block renders any
// definition; a promoted contact section binds to one through a `form` prop.
// Submissions POST to /api/forms (a Vercel function on the published site; the
// dev server answers with a preview stub).
import { z } from "astro/zod";

export const FORM_FIELD_TYPES = ["text", "email", "phone", "textarea", "select", "checkbox"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const formField = z.object({
  /** The submission key (also the input name): lowercase, dashes. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().default(""),
  required: z.boolean().default(false),
  placeholder: z.string().default(""),
  help: z.string().default(""),
  /** select only */
  options: z.array(z.string()).default([]),
});
export type FormField = z.infer<typeof formField>;

export const formDef = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string(),
  fields: z.array(formField).default([]),
  submit: z.object({ label: z.string().default("Submit") }).default({ label: "Submit" }),
  /** message: the thank-you text (markdown, edited as rich text) shows in place of the form and its copy. page: go to that page (a content page id). */
  after: z.object({
    mode: z.enum(["message", "page"]).default("message"),
    message: z.string().default("Thanks, your message was sent."),
    page: z.string().nullable().default(null),
  }).default({ mode: "message", message: "Thanks, your message was sent.", page: null }),
  /** Comma-delimited addresses. Used by the endpoint, never rendered. */
  recipients: z.string().default(""),
  replyTo: z.string().default(""),
  /** A field id whose value becomes the reply-to (replyTo is the fallback). */
  replyToField: z.string().default(""),
  recaptcha: z.boolean().default(false),
  updated: z.string().optional(),
});
export type FormDef = z.infer<typeof formDef>;

/** Strings the rendered form needs on the page (the client script reads them from data attributes). */
export const FORM_UI = {
  sending: "Sending…",
  error: "Something went wrong and your message wasn't sent. Please try again.",
  preview: "Preview: nothing was sent. On the published site this goes to the form's recipients.",
  previewPage: (route: string) => `Preview: nothing was sent. On the published site this goes to ${route}.`,
  missing: (id: string) => `Form "${id}" doesn't exist. Pick one in the block's content, or create it in the Forms tab.`,
  none: "No form chosen yet. Pick one in the block's content.",
};

// content/forms/*.json, loaded eagerly so both renderers (the site build and the
// design surface) see the same definitions. Invalid files are skipped with a
// console warning rather than failing the build: the app validates on save.
// The try/catch is for the app's schema introspection (desktop/block-schema.cjs),
// which bundles the built-in blocks for Node, where import.meta.glob doesn't exist.
let files: Record<string, unknown> = {};
let pageFiles: Record<string, { slug?: string; parent?: string }> = {};
try {
  files = import.meta.glob("../../../content/forms/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
  pageFiles = import.meta.glob("../../../content/pages/*.json", { eager: true, import: "default" }) as Record<string, { slug?: string; parent?: string }>;
} catch { /* not under Vite */ }

const byId: Record<string, FormDef> = {};
for (const [file, raw] of Object.entries(files)) {
  const id = file.replace(/^.*\//, "").replace(/\.json$/, "");
  const parsed = formDef.safeParse({ id, ...(raw && typeof raw === "object" ? raw : {}) });
  if (parsed.success) byId[parsed.data.id] = parsed.data;
  else console.warn(`[forms] content/forms/${id}.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
}

/** Every form, by id. */
export const forms: Record<string, FormDef> = byId;
export function formById(id: string | undefined | null): FormDef | null { return id ? byId[id] || null : null; }

/** The route of a content page id ("/about/team"), mirroring site/src/lib/pages.ts. */
export function pageRouteOf(pageId: string | null | undefined): string | null {
  if (!pageId) return null;
  const docs: Record<string, { slug?: string; parent?: string }> = {};
  for (const [file, doc] of Object.entries(pageFiles)) docs[file.replace(/^.*\//, "").replace(/\.json$/, "")] = doc || {};
  if (!docs[pageId]) return null;
  const parts: string[] = []; let cur: string | undefined = pageId; let g = 0;
  while (cur && docs[cur] && g++ < 16) { if (cur === "home") break; parts.unshift(docs[cur].slug ?? cur); cur = docs[cur].parent; }
  return "/" + parts.join("/");
}
