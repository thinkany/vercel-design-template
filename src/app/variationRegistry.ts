// Dynamic variation resolver.
//
// The base design (v00) lives in `src/app/components`. Each additional
// variation is a full copy under `src/variations/{id}/components` (produced by
// the "Make New Variation" flow). This registry maps a variation id + a
// component name to the right implementation, falling back to the base whenever
// a variation doesn't override a given component.
//
// New variation folders are picked up automatically via import.meta.glob — no
// edits to App.tsx are needed when a variation is added.

import type { ComponentType } from "react";

type AnyComponent = ComponentType<any>;

// Eagerly import every base + variation component module. Eager keeps resolution
// synchronous (no Suspense) — fine for a preview/design tool.
const baseModules = import.meta.glob("./components/*.tsx", { eager: true }) as Record<
  string,
  Record<string, unknown>
>;
const variationModules = import.meta.glob("../variations/*/components/*.tsx", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

// name -> component, per variation id (v00 = base).
const registry: Record<string, Record<string, AnyComponent>> = { v00: {} };

function registerExports(target: Record<string, AnyComponent>, mod: Record<string, unknown>) {
  for (const [name, value] of Object.entries(mod)) {
    // Register capitalized function exports (React components); skip data/helpers.
    if (typeof value === "function" && /^[A-Z]/.test(name)) {
      target[name] = value as AnyComponent;
    }
  }
}

for (const mod of Object.values(baseModules)) {
  registerExports(registry.v00, mod);
}

for (const [path, mod] of Object.entries(variationModules)) {
  const match = path.match(/variations\/([^/]+)\/components\//);
  if (!match) continue;
  const id = match[1];
  (registry[id] ??= {});
  registerExports(registry[id], mod);
}

/** True for the base (v00) or any variation that has a component folder. */
export function variationExists(id: string): boolean {
  return id === "v00" || Boolean(registry[id]);
}

/**
 * Resolve a component by name for the given variation, falling back to the base
 * (v00) when the variation doesn't override it.
 */
export function resolveComponent(variationId: string, name: string): AnyComponent {
  const component = registry[variationId]?.[name] ?? registry.v00[name];
  if (!component) {
    throw new Error(
      `Component "${name}" not found for variation "${variationId}" (and no base fallback).`,
    );
  }
  return component;
}
