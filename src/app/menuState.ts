// ©2026 thinkany llc. All rights reserved.
import { createContext, useContext } from "react";

/**
 * Which side the mobile menu lives on. SINGLE SOURCE OF TRUTH: the Header places
 * its hamburger on this side AND the MobileMenu drawer slides in from it, so the
 * two can never disagree. Flip this one value to move both. (Default "right".)
 */
export const MENU_SIDE: "left" | "right" = "right";

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
