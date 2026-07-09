// ©2004-2026 Deep Focus Review. All rights reserved.
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
  // Per-variation styleguide state. "needs-review" shows the setup banner on
  // this variation's styleguide until the designer marks it done ("updated").
  // Base (v00) ignores this and uses the committed VITE_STYLEGUIDE_READY flag.
  styleguideStatus?: "needs-review" | "updated";
  // Per-variation brand-palette state. "needs-review" flags this variation's
  // Colors as template defaults until its brand palette is established for this
  // variation only (via /setup-styleguide, then "Mark brand established").
  // Base (v00) ignores this and uses the committed VITE_BRAND_READY flag.
  brandStatus?: "needs-review" | "established";
}

export const INITIAL_VARIATIONS: Variation[] = [
  {
    id: "v00",
    version: "v00",
    title: "Base",
    description: "Base version.",
    createdAt: "06/27/2026",
    modifiedAt: "06/27/2026 12:00",
    isBase: true,
  },
];

const STORAGE_KEY = "ta-variations-v2";

export function loadVariations(): Variation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Variation[];
      if (Array.isArray(stored) && stored.length > 0) {
        const initialMap = new Map(INITIAL_VARIATIONS.map((v) => [v.id, v]));
        let changed = false;

        // Refresh version/title/description from code for any matching IDs
        const updated = stored.map((v) => {
          const src = initialMap.get(v.id);
          if (src && (src.version !== v.version || src.title !== v.title || src.description !== v.description || src.label !== v.label)) {
            changed = true;
            return { ...v, version: src.version, title: src.title, description: src.description, label: src.label };
          }
          return v;
        });

        // Append any new entries from INITIAL_VARIATIONS not yet in localStorage
        const storedIds = new Set(stored.map((v) => v.id));
        const additions = INITIAL_VARIATIONS.filter((v) => !storedIds.has(v.id));
        if (additions.length > 0) changed = true;

        const merged = [...updated, ...additions];
        if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {}
  return [...INITIAL_VARIATIONS];
}

export function saveVariations(variations: Variation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(variations));
  } catch {}
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

export function nextVariationId(variations: Variation[]): string {
  return `v${String(variations.length).padStart(2, "0")}`;
}

export function nextVersionTag(variations: Variation[]): string {
  const n = variations.length;
  return `v${Math.floor(n / 10)}.${n % 10}`;
}
