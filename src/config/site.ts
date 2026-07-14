// Public site / brand configuration.
//
// Values come from the committed .env (VITE_CLIENT_NAME / VITE_PROJECT_NAME /
// VITE_COMPANY_NAME). Fill them with the `/setup-project`
// command or by hand. On a fresh, unbranded template pull they are blank and
// neutral placeholders are shown instead — so the app always renders something
// intentional and signals "needs branding".

const PLACEHOLDER_CLIENT = "Client Name";
const PLACEHOLDER_COMPANY = "Company Name";
const PLACEHOLDER_PROJECT = "Project Name";

const rawCompany = (import.meta.env.VITE_COMPANY_NAME ?? "").trim();
const rawClient = (import.meta.env.VITE_CLIENT_NAME ?? "").trim();
const rawProject = (import.meta.env.VITE_PROJECT_NAME ?? "").trim();

// The template is considered "branded" once a client name has been provided.
const isBranded = rawClient.length > 0;

export const siteConfig = {
  /** False until the site has been branded (via /setup-project or by hand). */
  isBranded,
  /** Client name. Falls back to a placeholder only while fully unbranded. */
  clientName: rawClient || PLACEHOLDER_CLIENT,
  /**
   * Company / organization name — the design agency, shown in the dashboard
   * header ("Designed by {companyName}"). Falls back to its own placeholder when
   * left blank, so an unset company name never blanks the header.
   */
  companyName: rawCompany || PLACEHOLDER_COMPANY,
  /**
   * Project name — the secondary label. Falls back to a placeholder only while
   * fully unbranded; once branded, an intentionally-empty project name stays empty.
   */
  projectName: isBranded ? rawProject : PLACEHOLDER_PROJECT,
};

/**
 * Composed title lockup, e.g. "ACME ltd : Refinements".
 * Drops the separator when there is no project name.
 */
export const siteTitle = siteConfig.projectName
  ? `${siteConfig.clientName} : ${siteConfig.projectName}`
  : siteConfig.clientName;

/**
 * Phase II marker. True once the styleguide has been configured for this
 * project (fonts & colors set, example sections adapted) and
 * VITE_STYLEGUIDE_READY has been set to "true". While false, the styleguide
 * shows a setup banner. See the /setup-styleguide command.
 */
export const styleguideReady =
  (import.meta.env.VITE_STYLEGUIDE_READY ?? "").trim().toLowerCase() === "true";

/**
 * Brand-palette marker for the BASE (v00) scope. True once this project's brand
 * palette has been established (src/styles/brand.ts + the --ta-* tokens rewritten
 * by /setup-styleguide) and VITE_BRAND_READY set to "true". While false, the
 * styleguide flags its Colors section as showing template defaults. Variations
 * ignore this and use their own `brandStatus` record field.
 */
export const brandReady =
  (import.meta.env.VITE_BRAND_READY ?? "").trim().toLowerCase() === "true";

/**
 * Project type — chosen once at /setup-project, drives the device-preview matrix.
 * A whole-project decision (every variation of an app is an app), so it lives in
 * the committed .env rather than on the per-variation record.
 *
 *   "website" — desktop + mobile are the baseline (tablet optional).
 *   "app"     — mobile-first; desktop is hidden entirely (tablet optional).
 *   "brand"   — Brand Guideline mode. STUBBED / coming soon: App.tsx renders the
 *               Brand.tsx placeholder in place of the Home preview, so the device
 *               matrix below is unused for it (kept website-like just for safety).
 *               Revisit when the Brand Guideline surface is built out.
 *
 * Unset (fresh template) falls back to "website".
 */
export type ProjectType = "website" | "app" | "brand";
export type View = "desktop" | "tablet" | "mobile";

const rawProjectType = (import.meta.env.VITE_PROJECT_TYPE ?? "").trim().toLowerCase();
export const projectType: ProjectType =
  rawProjectType === "app" || rawProjectType === "brand" ? rawProjectType : "website";

// Whether the designer opted into a tablet preview (setup follow-up question).
const enableTablet =
  (import.meta.env.VITE_ENABLE_TABLET ?? "").trim().toLowerCase() === "true";

/**
 * Derived device-preview config consumed by the responsive preview (ViewToggle +
 * the frame selection in Home). `views` is the ordered set of device buttons to
 * show (width-descending); `defaultView` is the one selected on load. Components
 * read this instead of hardcoding the device matrix.
 */
function computePreviewConfig(): { views: View[]; defaultView: View } {
  const isApp = projectType === "app";
  // Full width-descending order, filtered by project type + the tablet opt-in.
  const views = (["desktop", "tablet", "mobile"] as View[]).filter((v) => {
    if (v === "desktop") return !isApp;      // apps hide desktop entirely
    if (v === "tablet") return enableTablet; // tablet is opt-in for every type
    return true;                             // mobile is always available
  });
  return { views, defaultView: isApp ? "mobile" : "desktop" };
}

export const previewConfig = computePreviewConfig();

/**
 * Viewport widths (px) used to render each breakpoint for the Figma export
 * (scripts/export-to-figma.mjs) and any headless snapshot. These mirror the
 * content widths the in-app device frames simulate (PhoneFrame screen = 370,
 * TabletFrame screen = 664), so an exported design matches what the designer
 * sees in the preview. Desktop has no frame, so a standard artboard width.
 */
export const previewWidths: Record<View, number> = {
  desktop: 1440,
  tablet: 664,
  mobile: 370,
};
