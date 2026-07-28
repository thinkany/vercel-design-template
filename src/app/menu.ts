// ©2026 thinkany llc. All rights reserved.
import { designPages } from "./pages";
import { menuStyle } from "@/config/site";

/**
 * Desktop nav menus — the per-item source of truth for what each nav item reveals
 * on hover, seeded from the setup `menuStyle` and edited from here. Consumed by the
 * Header (render), DesignSurface/capture (open each), and the Figma export (one
 * "Menu — {Item}" Block per menu-bearing item). PART 3: diverge any entry — mix
 * mega + dropdown + none — and each distinct open state exports as its own block.
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

/**
 * Populated starter content for the chosen style — a real menu on day one that the
 * designer edits down (the "populated example" setup choice). Every nav item is
 * seeded with this for the selected style; change individual entries in `navMenus`
 * to make the menu vary per item.
 */
function seed(kind: "dropdown" | "mega"): ItemMenu {
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

/** Per nav-item menu, keyed by page id. Seeded from the setup style; edit freely. */
export const navMenus: Record<string, ItemMenu> = Object.fromEntries(
  designPages.map((p) => [p.id, menuStyle === "traditional" ? { kind: "none" } : seed(menuStyle)]),
);

export const menuFor = (id: string): ItemMenu => navMenus[id] ?? { kind: "none" };
export const hasMenu = (id: string): boolean => menuFor(id).kind !== "none";
/** Nav item ids that reveal a menu — the set the exporter opens + captures. */
export const menuItemIds = (): string[] => Object.keys(navMenus).filter(hasMenu);
