// ©2026 thinkany llc. All rights reserved.
// BLOCKS — the contract (CORE tier: upgrades overwrite this freely). A block is a
// React component plus a zod schema for its props. Pages in content/pages compose
// blocks by name; the schema validates each instance at build time, so a typo in
// content fails the build with a readable message instead of rendering blank.
//
// The designer-owned LIST of blocks lives in site/blocks/index.ts (KEEP tier).
import type { ComponentType } from "react";
import { z, type ZodTypeAny } from "astro/zod";

export interface BlockDef<S extends ZodTypeAny = ZodTypeAny> {
  /** Human label (shown in the app's block picker). */
  name: string;
  /** One line on what the block is for. */
  description?: string;
  /** Props contract. Content is validated against it at build. */
  props: S;
  /** The React component that renders a validated props object. */
  component: ComponentType<z.infer<S>>;
}

export function defineBlock<S extends ZodTypeAny>(def: BlockDef<S>): BlockDef<S> {
  return def;
}

/** A block instance as it appears in content: { type, props }. */
export const blockInstance = z.object({
  type: z.string(),
  props: z.record(z.any()).default({}),
});
export type BlockInstance = z.infer<typeof blockInstance>;

/**
 * Resolve + validate one content block instance against the registry. Throws a
 * build-time error naming the page, the block and the offending field.
 */
export function resolveBlock(
  registry: Record<string, BlockDef>,
  instance: BlockInstance,
  where: string,
) {
  const def = registry[instance.type];
  if (!def) {
    const known = Object.keys(registry).join(", ") || "(none)";
    throw new Error(`${where}: unknown block "${instance.type}". Known blocks: ${known}`);
  }
  const parsed = def.props.safeParse(instance.props);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${where}: block "${instance.type}" has invalid props:\n${issues}`);
  }
  return { component: def.component, props: parsed.data };
}
