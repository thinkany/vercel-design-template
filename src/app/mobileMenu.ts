// ©2026 thinkany llc. All rights reserved.
import { createContext, useContext } from "react";

/**
 * Which side the mobile menu lives on. SINGLE SOURCE OF TRUTH: the Header places
 * its hamburger on this side AND the MobileMenu drawer slides in from it, so the
 * two can never disagree — the drawer always opens from the same edge the
 * hamburger sits on. Flip this one value to move both. (Default "right" matches
 * the base Header's hamburger placement.)
 */
export const MENU_SIDE: "left" | "right" = "right";

/**
 * Open/close state for the default mobile menu. Provided by DesignSurface so the
 * Header's hamburger (the trigger) and the MobileMenu drawer (the panel) share one
 * state without prop-drilling through resolveComponent. DesignSurface also forces
 * it open during a `?menu=open` capture pass so the drawer exports as its own block.
 */
export interface MobileMenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const MobileMenuContext = createContext<MobileMenuState>({
  open: false,
  setOpen: () => {},
});

export const useMobileMenu = () => useContext(MobileMenuContext);
