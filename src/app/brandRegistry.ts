// Scope-aware brand resolver.
//
// The base brand manifest lives at `src/styles/brand.ts`. Each variation gets its
// own copy at `src/variations/{id}/styles/brand.ts` (the dev copier duplicates the
// whole `styles/` folder on "Make New Variation"). This registry maps a variation
// id to its manifest, falling back to the base when a variation has none yet.
//
// This is what enforces palette siloing: `resolveBrand("v01")` returns ONLY v01's
// manifest — a red-based variation and a blue-based one never cross.

import { brand as baseBrand } from "@/styles/brand";
import type { Brand } from "@/styles/brand";

// Eager so resolution is synchronous (matches variationRegistry).
const variationBrandModules = import.meta.glob("../variations/*/styles/brand.ts", {
  eager: true,
}) as Record<string, { brand?: Brand }>;

// id -> Brand (v00 = base).
const registry: Record<string, Brand> = { v00: baseBrand };

for (const [path, mod] of Object.entries(variationBrandModules)) {
  const match = path.match(/variations\/([^/]+)\/styles\//);
  if (match && mod.brand) registry[match[1]] = mod.brand;
}

/**
 * Resolve the brand manifest for the given variation, falling back to the base
 * (v00) when the variation has no manifest of its own.
 */
export function resolveBrand(variationId: string): Brand {
  return registry[variationId] ?? baseBrand;
}
