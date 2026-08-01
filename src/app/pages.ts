// ©2026 thinkany llc. All rights reserved.
/**
 * DESIGN PAGES — DATA (designer-owned, KEEP tier: a template upgrade NEVER
 * overwrites this file). This is pure content: the list of design surfaces this
 * project ships. The framework contract (the DesignPage shape + what the manifest
 * wires) lives in pages.schema.ts (CORE tier), so upgrades improve the machinery
 * without ever clobbering your page list.
 *
 * This is DESIGN pages only. The Dashboard and StyleGuide are `--admin-*` tooling
 * surfaces, not design surfaces, and are intentionally NOT listed here (they must
 * never be exported as designs).
 *
 * TO ADD A PAGE (e.g. About):
 *   1. Create src/app/components/About.tsx, modelled on Home.tsx — wrap your
 *      content in <DesignSurface> and pass it `onNavigate` (that wires the global
 *      Header/Footer links). <DesignSurface> is what makes the page responsive +
 *      exportable, and renders the shared Header/Footer for you on website
 *      projects (pass `chrome={false}` for a bare page).
 *   2. Add one row below: { id: "about", route: "about", name: "About",
 *      component: "About" }.
 *   That's it — routing, the ViewToggle, Figma export, and the nav (Header/Footer
 *   auto-list every page here) all pick it up.
 */
import type { DesignPage } from "./pages.schema";

export const designPages: DesignPage[] = [
  { id: "home", route: "", name: "Home", component: "Home" },
  // Add design pages here — see the note above. Example:
  // { id: "about", route: "about", name: "About", component: "About" },
];

/** The default design page shown for `?v={id}` with no other page flag. */
export const defaultDesignPageId = "home";

export type { DesignPage } from "./pages.schema";
