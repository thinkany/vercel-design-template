// ©2026 thinkany llc. All rights reserved.
//
// Variations are file-based. Each design variation carries its own metadata in
// `src/variations/{id}/variation.json` (title, description, status, …) — the single
// source of truth, committed with the design. The dashboard reads them via the
// build/dev manifest (`/variations.json`); the base (v00) has no folder, so its
// record lives in code (BASE). This replaces the old per-browser localStorage,
// which collided across projects sharing localhost and couldn't be written by
// setup/Claude. Now setup writes a variation.json directly and every browser (and
// Vercel) sees identical, correct data.
export interface Variation {
  id: string;         // "v00", "v01", … (v00 is the base)
  version: string;    // "v0.0", "v0.1", …
  title: string;
  description: string;
  createdAt: string;  // "MM/DD/YYYY"
  modifiedAt: string; // "MM/DD/YYYY HH:MM"
  isBase: boolean;
  label?: string;     // override for the filled blue tag; falls back to "Original" / "Client Edits"
  screenshot?: string; // static thumbnail image URL
  removed?: boolean;   // hidden from the gallery (files kept); set by the remove action
  // Per-variation styleguide state. "needs-review" shows the setup banner on this
  // variation's styleguide until it's marked done ("updated"). Base has no state.
  styleguideStatus?: "needs-review" | "updated";
  // Per-variation brand-palette state. "needs-review" flags Colors as template
  // defaults until established. Base has no state.
  brandStatus?: "needs-review" | "established";
}

/** The base blueprint (v00). Lives in code — it has no `src/variations/` folder. */
export const BASE: Variation = {
  id: "v00",
  version: "v00",
  title: "Base",
  description: "Base version.",
  createdAt: "06/27/2026",
  modifiedAt: "06/27/2026 12:00",
  isBase: true,
};

/** The metadata fields persisted to a variation.json (everything but id/isBase). */
export type VariationMeta = Omit<Variation, "id" | "isBase">;

/** Version tag for an id ("v01" → "v0.1"), matching nextVersionTag's scheme. */
function versionTagForId(id: string): string {
  const n = parseInt(id.replace(/\D/g, ""), 10) || 0;
  return `v${Math.floor(n / 10)}.${n % 10}`;
}

/**
 * Default metadata for a NEW variation (written into its variation.json). `v01` is
 * the initial design created by /setup-styleguide's Step 0, so it's titled and —
 * since setup configures it — defaults to DONE. Callers that create an *un*configured
 * variation (the skip-setup "Start designing" button, the Make-Variation modal)
 * override `styleguideStatus`/`brandStatus` to "needs-review".
 */
export function defaultVariationMeta(id: string): VariationMeta {
  const n = parseInt(id.replace(/\D/g, ""), 10) || 0;
  const isFirst = n === 1;
  return {
    version: versionTagForId(id),
    title: isFirst ? "Initial Design" : `Design ${n}`,
    description: isFirst ? "Initial Design Concept, color and font variations." : "",
    createdAt: formatNowDate(),
    modifiedAt: formatNowDateTime(),
    styleguideStatus: "updated",
    brandStatus: "established",
  };
}

/**
 * Read the full variation list: base (from code) + every on-disk variation with its
 * committed metadata (via /variations.json, served in dev and emitted at build).
 * Removed variations are filtered out. No localStorage — same result in every
 * browser and on Vercel.
 */
export async function fetchVariations(): Promise<Variation[]> {
  try {
    const r = await fetch("/variations.json", { cache: "no-store" });
    if (!r.ok) return [BASE];
    const manifest = (await r.json()) as { variations?: (VariationMeta & { id: string })[] };
    const disk = (manifest.variations ?? [])
      .filter((v) => !v.removed)
      .map((v) => ({ ...v, isBase: false }));
    return [BASE, ...disk];
  } catch {
    return [BASE];
  }
}

/** Fetch a single variation's metadata (base from code; others from the manifest). */
export async function fetchVariation(id: string): Promise<Variation | undefined> {
  if (id === "v00") return BASE;
  return (await fetchVariations()).find((v) => v.id === id);
}

/** Create a variation on disk: copy source files + write its variation.json. Dev only. */
export async function createVariation(sourceId: string, targetId: string, meta: VariationMeta): Promise<void> {
  await fetch("/api/variation/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId, targetId, meta }),
  });
}

/** Patch fields in a variation's variation.json (status, removed, title…). Dev only. */
export async function patchVariation(id: string, patch: Partial<VariationMeta>): Promise<void> {
  await fetch("/api/variation/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  }).catch(() => {});
}

export function getVariationUrl(variation: Variation): string {
  return `/?v=${variation.id}`;
}

export function getStylesUrl(variation: Variation): string {
  return `/?v=${variation.id}&styleguide`;
}

export function formatNowDate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function formatNowDateTime(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()} ${hh}:${min}`;
}

/** Next free id given the current list (e.g. [v00] → "v01"). */
export function nextVariationId(variations: Variation[]): string {
  return `v${String(variations.length).padStart(2, "0")}`;
}

export function nextVersionTag(variations: Variation[]): string {
  const n = variations.length;
  return `v${Math.floor(n / 10)}.${n % 10}`;
}
