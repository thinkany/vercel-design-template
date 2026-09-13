// ©2026 thinkany llc. All rights reserved.
// TYPE ENTRIES (CORE): the content types and their entries, loaded once for the
// built-in Types block, so both renderers (the site build and the design surface)
// see the same data with no route-level plumbing. Mirrors forms.ts: eager globs in
// a try/catch (the app's schema introspection bundles this for Node, where
// import.meta.glob doesn't exist), safeParse per file, a warning instead of a failed
// build for an invalid one (the app validates on save).
import { typesFile, entrySchema, type TypeDef } from "./types";

/** Strings the rendered block needs on the page (the client script reads them from data attributes). */
export const ENTRIES_UI = {
  all: "All",
  prev: "Previous",
  next: "Next",
  pageOf: (n: string, m: string) => `Page ${n} of ${m}`,
  empty: "Nothing matches that filter.",
  none: "No entries chosen yet. Pick the content types (or the entries) in the block's content.",
  noTypes: "No content types yet. Make one in the Types tab, then pick it here.",
  readMore: "Read more",
};

let typesRaw: unknown = null;
let entryFiles: Record<string, unknown> = {};
try {
  const t = import.meta.glob("../../../content/types.json", { eager: true, import: "default" }) as Record<string, unknown>;
  typesRaw = Object.values(t)[0] ?? null;
  entryFiles = import.meta.glob("../../../content/*/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
} catch { /* not under Vite */ }

const parsedTypes = typesFile.safeParse(typesRaw && typeof typesRaw === "object" ? typesRaw : { types: [] });
/** Every content type declared in content/types.json. */
export const types: TypeDef[] = parsedTypes.success ? parsedTypes.data.types : [];
/** The data-only ones: no page per entry, made to be listed or picked by a block. */
export const dataTypes: TypeDef[] = types.filter((t) => t.dataOnly);

export interface Entry {
  id: string;
  type: TypeDef;
  data: Record<string, unknown> & { title: string; draft: boolean };
  /** The entry's date for ordering: its first date field, else when it was created. */
  date: string;
}

// Drafts show while previewing (Vite / Astro dev), marked as drafts, and drop out of
// the published build, as pages and posts do.
const dev = (() => { try { return !!(import.meta.env && import.meta.env.DEV); } catch { return false; } })();

const byType: Record<string, Entry[]> = {};
for (const t of types) {
  const schema = entrySchema(t);
  const dateField = t.fields.find((f) => f.kind === "date");
  const list: Entry[] = [];
  for (const [file, raw] of Object.entries(entryFiles)) {
    const m = file.match(/\/content\/([^/]+)\/([^/]+)\.json$/);
    if (!m || m[1] !== t.key) continue;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { console.warn(`[entries] content/${t.key}/${m[2]}.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`); continue; }
    const data = parsed.data as Entry["data"] & { created?: string };
    if (data.draft && !dev) continue;
    const fromField = dateField && typeof data[dateField.key] === "string" ? (data[dateField.key] as string) : "";
    list.push({ id: m[2], type: t, data, date: fromField || data.created || "" });
  }
  list.sort(byDateDesc);
  byType[t.key] = list;
}

/** Newest first; undated entries last, then by title. */
export function byDateDesc(a: Entry, b: Entry): number {
  if (a.date !== b.date) { if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date); }
  return a.data.title.localeCompare(b.data.title);
}

export function typeByKey(key: string | undefined | null): TypeDef | null { return key ? types.find((t) => t.key === key) || null : null; }
/** A type's entries, newest first (drafts included only while previewing). */
export function entriesOf(key: string | undefined | null): Entry[] { return key ? byType[key] || [] : []; }
export function entryById(key: string | undefined | null, id: string | undefined | null): Entry | null {
  if (!key || !id) return null;
  return entriesOf(key).find((e) => e.id === id || e.data.slug === id) || null;
}
