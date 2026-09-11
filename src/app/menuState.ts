// ©2026 thinkany llc. All rights reserved.
import { createContext, useContext } from "react";
import { headerConfig } from "./header.config";

/**
 * Which side the mobile menu lives on. MOVED: this now lives in `header.config.ts`
 * as `menuSide`, alongside the header's other structural choices, so one file
 * describes the whole header. Re-exported here so a hand-built variation that
 * imports MENU_SIDE keeps working — set `menuSide` in the config to change it.
 *
 * @deprecated Read `headerConfig.menuSide` instead.
 */
export const MENU_SIDE: "left" | "right" = headerConfig.menuSide;

/**
 * Shared menu state for the whole surface, provided by DesignSurface so the
 * Header's triggers and the menu panels stay in sync without prop-drilling
 * through resolveComponent. Covers BOTH menus:
 *   • mobile drawer — `open`/`setOpen` (hamburger ↔ MobileMenu drawer)
 *   • desktop menus — `activeItem`/`setActiveItem` (which nav item's dropdown/mega
 *     is revealed on hover, or null)
 * DesignSurface also forces these open during a `?menu=open[&item=…]` capture pass
 * so each menu exports as its own block.
 */
export interface MenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeItem: string | null;
  setActiveItem: (id: string | null) => void;
}

export const MenuStateContext = createContext<MenuState>({
  open: false,
  setOpen: () => {},
  activeItem: null,
  setActiveItem: () => {},
});

export const useMenuState = () => useContext(MenuStateContext);
