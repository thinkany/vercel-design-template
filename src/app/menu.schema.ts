// ©2026 thinkany llc. All rights reserved.
/**
 * DESKTOP NAV MENUS — SCHEMA (framework machinery, CORE tier: upgrades overwrite
 * this freely). The menu *types*, the starter-content `seed()`, and the lookup
 * helpers. The designer-owned DATA — the actual per-item menus — lives next door
 * in menu.ts (KEEP tier: never overwritten). So a template upgrade can add a new
 * menu kind or improve the seed defaults without touching a designer's menus.
 *
 * Helpers take the navMenus map as an argument (rather than importing it) so this
 * CORE file never depends on the KEEP data file — menu.ts binds them to its own
 * navMenus and re-exports the bound versions, keeping every call site unchanged.
 */
export type MenuKind = "none" | "dropdown" | "mega";
export interface DropdownMenu {
  kind: "dropdown";
  links: { label: string }[];
}
export interface MegaSection {
  title: string;
  links: { label: string }[];
}
export interface MegaMenu {
  kind: "mega";
  sections: MegaSection[];
  featured?: { label: string; blurb: string };
}
export type ItemMenu = { kind: "none" } | DropdownMenu | MegaMenu;

export type NavMenus = Record<string, ItemMenu>;

/**
 * Populated starter content for the chosen style — a real menu on day one that
 * the designer edits down (the "populated example" setup choice). Every nav item
 * is seeded with this for the selected style; change individual entries in
 * menu.ts's `navMenus` to make the menu vary per item.
 */
export function seed(kind: "dropdown" | "mega"): ItemMenu {
  if (kind === "dropdown") {
    return {
      kind: "dropdown",
      links: [{ label: "Overview" }, { label: "New Arrivals" }, { label: "Best Sellers" }, { label: "Sale" }],
    };
  }
  return {
    kind: "mega",
    sections: [
      { title: "Shop by Category", links: [{ label: "Women" }, { label: "Men" }, { label: "Accessories" }, { label: "Footwear" }] },
      { title: "Collections", links: [{ label: "Summer ’26" }, { label: "Essentials" }, { label: "Limited Edition" }] },
      { title: "More", links: [{ label: "Gift Cards" }, { label: "Lookbook" }, { label: "Store Locator" }] },
    ],
    featured: { label: "New Arrivals", blurb: "The Summer ’26 drop just landed." },
  };
}

/** Look up a nav item's menu (defaults to `none`). */
export const menuForIn = (navMenus: NavMenus, id: string): ItemMenu =>
  navMenus[id] ?? { kind: "none" };

/** Whether a nav item reveals a menu. */
export const hasMenuIn = (navMenus: NavMenus, id: string): boolean =>
  menuForIn(navMenus, id).kind !== "none";

/** Nav item ids that reveal a menu — the set the exporter opens + captures. */
export const menuItemIdsIn = (navMenus: NavMenus): string[] =>
  Object.keys(navMenus).filter((id) => hasMenuIn(navMenus, id));
