// ©2026 thinkany llc. All rights reserved.
/**
 * DESIGN PAGES — SCHEMA (framework machinery, CORE tier: upgrades overwrite this
 * freely). The *contract* for the pages manifest. The designer-owned DATA — the
 * actual list of pages — lives next door in pages.ts (KEEP tier: never
 * overwritten on upgrade). Splitting the two means a template upgrade can improve
 * how pages are wired without ever touching a designer's page list.
 *
 * The manifest drives THREE things at once, so a row in pages.ts wires a page
 * everywhere:
 *   1. Routing + rendering in App.tsx (each page renders via resolveComponent,
 *      so variations inherit/override it for free).
 *   2. URL addressing: a page is reachable at `?v={id}&{route}` (Home is the
 *      default page for `?v={id}`, so its route is omitted).
 *   3. The Figma export (scripts/export-to-figma.mjs) enumerates the list and
 *      captures every page at every active breakpoint — automatically.
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
