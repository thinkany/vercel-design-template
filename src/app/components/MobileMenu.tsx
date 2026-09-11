// ©2026 thinkany llc. All rights reserved.
import { HeaderDrawer } from "@/app/components/Header";

/**
 * MOBILE MENU — now part of the header (CORE tier).
 *
 * The slide-in drawer used to be authored here, separately from the Header. That
 * meant two files had to agree on which edge the menu lives on and what each nav
 * item expands, and promote had to move both. It now lives inside `Header.tsx`
 * (as `HeaderDrawer`), reading the same `header.config.ts` and `header.skin.ts`,
 * so the hamburger and the drawer can never disagree.
 *
 * This file stays as the name DesignSurface resolves (`MobileMenu`), so nothing
 * else had to change — and so a variation that overrides only `Header.tsx` still
 * gets a drawer. To restyle the drawer, edit `header.skin.ts` (`drawer`,
 * `drawerLink`, `drawerSubLink`, `hamburger`); to move it to the other edge, set
 * `menuSide` in `header.config.ts`.
 *
 * A variation that genuinely needs a different drawer still drops its own
 * MobileMenu.tsx into src/variations/{id}/components/, exactly as before.
 */
export function MobileMenu({ onNavigate }: { onNavigate: (page: string) => void }) {
  return <HeaderDrawer onNavigate={onNavigate} />;
}
