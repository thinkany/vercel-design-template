// ©2026 thinkany llc. All rights reserved.
/**
 * DESKTOP NAV MENUS — DATA (designer-owned, KEEP tier: a template upgrade NEVER
 * overwrites this file). `navMenus` is the per-item source of truth for what each
 * nav item reveals on hover. It's seeded from the setup `menuStyle`; edit any
 * entry to mix mega + dropdown + none per item. Each distinct open state exports
 * as its own "Menu — {Item}" Block.
 *
 * The types, the seed content, and the lookup logic live in menu.schema.ts (CORE
 * tier). This file binds those helpers to its own `navMenus` and re-exports them,
 * so every consumer keeps importing `menuFor` / `hasMenu` / `menuItemIds` from
 * "./menu" exactly as before.
 */
import { menuStyle } from "@/config/site";
import { designPages } from "./pages";
import { headerConfig } from "./header.config";
import { seed, menuForIn, hasMenuIn, menuItemIdsIn, type ItemMenu } from "./menu.schema";

/**
 * The starting menu kind. `header.config.ts` is the single place the header's
 * structure is described, so its `menuKind` wins; the older `VITE_MENU_STYLE`
 * (from /setup-project) is the fallback for a project set up before the config
 * existed. Either way this only SEEDS the map below — per-item data wins.
 */
const seedKind = headerConfig.menuKind !== "none"
  ? headerConfig.menuKind
  : menuStyle === "traditional" ? "none" : menuStyle;

/** Per nav-item menu, keyed by page id. Seeded from the header config; edit freely. */
export const navMenus: Record<string, ItemMenu> = Object.fromEntries(
  designPages.map((p) => [p.id, seedKind === "none" ? { kind: "none" } : seed(seedKind)]),
);

export const menuFor = (id: string): ItemMenu => menuForIn(navMenus, id);
export const hasMenu = (id: string): boolean => hasMenuIn(navMenus, id);
export const menuItemIds = (): string[] => menuItemIdsIn(navMenus);

export type { MenuKind, DropdownMenu, MegaMenu, MegaSection, ItemMenu } from "./menu.schema";
