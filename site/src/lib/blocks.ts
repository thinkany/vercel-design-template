// ©2026 thinkany llc. All rights reserved.
// BLOCKS — the contract (CORE tier: upgrades overwrite this freely). A block is a
// React component plus a zod schema for its props. Pages in content/pages compose
// blocks by name; the schema validates each instance at build time, so a typo in
// content fails the build with a readable message instead of rendering blank.
//
// The designer-owned LIST of blocks lives in site/blocks/index.ts (KEEP tier).
import type { ComponentType } from "react";
import { z, type ZodTypeAny } from "astro/zod";

/**
 * When a block needs to run in the browser (state, listeners, animation that
 * can't be CSS). Default is NONE: the block renders to static HTML and ships no
 * JS. "load" hydrates immediately (site chrome), "visible" when scrolled into
 * view, "idle" after the page settles. Each hydrated block ships the React
 * runtime once per page, so prefer CSS (see data-reveal in site.css) for effects.
 *
 * Today only the CHROME hydrates (site/blocks/chrome.ts exports Header/Footer by
 * name, which is how the layout can put a `client:*` directive on them). Page
 * blocks reached through the registry render static; setting hydrate on one
 * fails the build with a message saying so.
 */
export type Hydrate = "load" | "visible" | "idle";

export interface BlockDef<S extends ZodTypeAny = ZodTypeAny> {
  /** Human label (shown in the app's block picker). */
  name: string;
  /** One line on what the block is for. */
  description?: string;
  /** Props contract. Content is validated against it at build. */
  props: S;
  /** The React component that renders a validated props object. */
  component: ComponentType<z.infer<S>>;
  /** Browser hydration, when the block needs it. Omit for static HTML. */
  hydrate?: Hydrate;
}

/** Site chrome: the header/footer rendered around every page by the layout. */
export interface Chrome {
  header?: BlockDef;
  footer?: BlockDef;
}

/**
 * Prose a client edits as rich text (markdown on disk, a WYSIWYG editor in the
 * CMS). Use it for body copy and render it with <Rich text={…} />; titles,
 * eyebrows and labels stay z.string().
 */
export const richtext = z.string().describe("richtext");

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
  return { component: def.component, props: parsed.data, hydrate: def.hydrate };
}
