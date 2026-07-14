// ©2026 thinkany llc. All rights reserved.
/**
 * BLOCKS MANIFEST — the identification layer for the Figma Block Library export.
 *
 * A "block" is a reusable page SECTION (Header, Footer, hero, …) — the level
 * between design-system atoms (ui/*.tsx, see the component-library export) and
 * whole pages (pages.ts). Blocks are the fuzzy-to-identify unit: unlike atoms
 * (which self-declare via `cva`) a section is just markup, so we DECLARE the
 * blocks here — one row each — mirroring how pages.ts declares design pages.
 *
 * This manifest drives the Block Library export
 * (scripts/export-blocks-to-figma.mjs → scripts/figma-block-library.plugin.js):
 * each block becomes a Figma component SET on the "Block Library" page, with one
 * variant per `state` (e.g. a Header's Desktop / Mobile / Mobile-open). The
 * builder holds the per-block CONSTRUCTION (blocks are structural, not data-
 * driven like atoms); this manifest holds the DECLARATION: which blocks exist,
 * their states + frame widths, and where their nav comes from.
 *
 * TO ADD A BLOCK: add a row here AND a `build<Name>()` function in
 * scripts/figma-block-library.plugin.js. Header is implemented; Footer + Hero are
 * declared and stubbed (build them out next).
 */
export interface BlockState {
  /** State id (kebab). */
  id: string;
  /** Figma variant value, e.g. "Desktop" → variant name `state=Desktop`. */
  name: string;
  /** Frame width in px for this state (desktop ~1280, mobile ~390). */
  width: number;
  /** Horizontal padding for this state (desktop wider than mobile). */
  padX: number;
}

export interface Block {
  /** Block id (kebab). */
  id: string;
  /** Figma component-set name. */
  name: string;
  /** Source component this block reconstructs (src/app/components/<component>.tsx). */
  component: string;
  /**
   * Where the block's nav items come from:
   *   "pages"    → the real designPages (pages.ts) — single-source, grows with pages.
   *   string[]   → a fixed representative list (specimen only; pages.ts untouched).
   */
  navSource: "pages" | string[];
  /** Figma variant states (each becomes one component in the set). */
  states: BlockState[];
  /** Whether the builder implements this block yet (false = scaffold row). */
  implemented: boolean;
}

export const blocks: Block[] = [
  {
    id: "header",
    name: "Header",
    component: "Header",
    // Representative specimen nav so the states read as a real header; the live
    // site's Header still single-sources the real designPages.
    navSource: ["Home", "Work", "About", "Contact"],
    states: [
      { id: "desktop", name: "Desktop", width: 1280, padX: 40 },
      { id: "mobile", name: "Mobile", width: 390, padX: 24 },
      { id: "mobile-open", name: "Mobile-open", width: 390, padX: 24 },
    ],
    implemented: true,
  },
  {
    id: "footer",
    name: "Footer",
    component: "Footer",
    navSource: "pages",
    states: [
      { id: "desktop", name: "Desktop", width: 1280, padX: 40 },
      { id: "mobile", name: "Mobile", width: 390, padX: 24 },
    ],
    implemented: false, // scaffold — build buildFooter() next
  },
  {
    id: "hero",
    name: "Hero",
    component: "Home",
    navSource: "pages", // hero has no nav; kept for shape consistency
    states: [
      { id: "desktop", name: "Desktop", width: 1280, padX: 40 },
      { id: "mobile", name: "Mobile", width: 390, padX: 24 },
    ],
    implemented: false, // scaffold — build buildHero() next
  },
];
