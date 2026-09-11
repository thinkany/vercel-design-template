// ©2026 thinkany llc. All rights reserved.
/**
 * HEADER CONFIGURATION — the STRUCTURE layer (designer-owned data, KEEP tier: a
 * template upgrade never overwrites this file).
 *
 * The header is the most mechanical component in a build, so it is not written
 * free-form: `Header.tsx` (CORE) implements every placement and every menu kind
 * once, and reads this file to decide which one to render. The design agent
 * changes the header by editing THIS file (where the logo sits, what opens) and
 * `components/header.skin.ts` (how it looks) — never by rewriting `Header.tsx`.
 *
 * The app seeds this from the Get Designing intake's header/menu choice (the nine
 * layouts are exactly `placement` × `menuKind`). Edit any value by hand after.
 *
 *   placement  "left-right"   logo left, links right    (the classic)
 *              "left-center"  logo left, links centered
 *              "center-split" logo centered, links split evenly around it
 *   menuKind   "none"         plain links, nothing opens
 *              "dropdown"     hover reveals a link list under the item
 *              "mega"         hover reveals a full content-column panel
 *
 * `menuKind` is the DEFAULT for every nav item; an individual item still diverges
 * in `menu.ts` (that data file is per-item and wins). Setting `menuKind` here is
 * what seeds those entries at setup.
 */
export type HeaderPlacement = "left-right" | "left-center" | "center-split";
export type HeaderMenuKind = "none" | "dropdown" | "mega";

export interface HeaderConfig {
  /** Where the logo and the links sit in the bar. */
  placement: HeaderPlacement;
  /** What a nav item reveals on hover. Seeds menu.ts; per-item data wins. */
  menuKind: HeaderMenuKind;
  /** Sticky by default, so the nav never scrolls away. `false` scrolls it off. */
  sticky: boolean;
  /** Which edge the hamburger sits on AND the mobile drawer slides from. */
  menuSide: "left" | "right";
  /** Mega panel shape: grid columns, and whether a featured panel renders. */
  mega: { columns: 2 | 3 | 4 | 5; feature: boolean };
}

export const headerConfig: HeaderConfig = {
  placement: "left-right",
  menuKind: "none",
  sticky: true,
  menuSide: "right",
  mega: { columns: 4, feature: true },
};
