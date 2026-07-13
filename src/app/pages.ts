// ©2026 thinkany llc. All rights reserved.
/**
 * DESIGN PAGES MANIFEST — the single source of truth for the design surfaces
 * this project ships. This drives THREE things at once, so adding a page here
 * wires it everywhere:
 *   1. Routing + rendering in App.tsx (each page renders via resolveComponent,
 *      so variations inherit/override it for free).
 *   2. URL addressing: a page is reachable at `?v={id}&{route}` (Home is the
 *      default page for `?v={id}`, so its route is omitted).
 *   3. The Figma export (scripts/export-to-figma.mjs) enumerates this list and
 *      captures every page at every active breakpoint — automatically.
 *
 * This is DESIGN pages only. The Dashboard and StyleGuide are `--admin-*`
 * tooling surfaces, not design surfaces, and are intentionally NOT listed here
 * (they must never be exported as designs).
 *
 * TO ADD A PAGE (e.g. About):
 *   1. Create src/app/components/About.tsx, modelled on Home.tsx — wrap your
 *      content in <DesignSurface> and pass it `onNavigate` (that wires the
 *      global Header/Footer links). <DesignSurface> is what makes the page
 *      responsive + exportable, and renders the shared Header/Footer for you on
 *      website projects (pass `chrome={false}` for a bare page).
 *   2. Add one row below: { id: "about", route: "about", name: "About",
 *      component: "About" }.
 *   That's it — routing, the ViewToggle, Figma export, and the nav (Header/
 *   Footer auto-list every page here) all pick it up.
 */
export interface DesignPage {
  /** Internal page id (App's page state). Home is "home". */
  id: string;
  /**
   * URL query flag that addresses this page, e.g. `?v=v00&about`. Home is the
   * default page for `?v={id}`, so its route is "" (no extra flag needed).
   */
  route: string;
  /** Human label (used in UI / export filenames). */
  name: string;
  /** Component name resolved via resolveComponent (falls back to base v00). */
  component: string;
}

export const designPages: DesignPage[] = [
  { id: "home", route: "", name: "Home", component: "Home" },
  // Add design pages here — see the header note. Example:
  // { id: "about", route: "about", name: "About", component: "About" },
];

/** The default design page shown for `?v={id}` with no other page flag. */
export const defaultDesignPageId = "home";
