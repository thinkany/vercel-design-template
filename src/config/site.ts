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
// A brand logo image the designer uploaded in the "Get Designing" brief. A public/
// path (e.g. "/images/logo.svg", served at the site root) or blank. When set, the
// header/footer render it in place of the text wordmark.
const rawLogo = (import.meta.env.VITE_BRAND_LOGO ?? "").trim();
// How the studio app is used, written by the app itself ("personal" | "company",
// blank when unknown). Someone designing for themselves has no agency to credit, so
// the dashboard drops the "Designed by" line and the Brand button until a company
// name is actually set.
const rawUsage = (import.meta.env.VITE_APP_USAGE ?? "").trim();

// The template is considered "branded" once a client name has been provided.
const isBranded = rawClient.length > 0;

// Company / agency branding — the layer `/setup-project` uniquely owns (company
// name, admin/gate fonts, login logo). The "Get Designing" flow sets only the
// CLIENT name, so this stays false until /setup-project actually runs. It's the
// signal for the dashboard's "Brand This Project" button (isBranded is the wrong
// proxy there: Get Designing flips it true while leaving the project un-set-up).
const isCompanyBranded = rawCompany.length > 0;

export const siteConfig = {
  /** False until the site has been branded (via /setup-project or by hand). */
  isBranded,
  /**
   * False until the COMPANY layer is branded (VITE_COMPANY_NAME, set by
   * /setup-project). Distinct from isBranded, which only tracks the client name a
   * Get-Designing brief already provides. Drives "Brand This Project".
   */
  isCompanyBranded,
  /**
   * True when the app is used "just for me" and no company name has been set: the
   * dashboard header then shows neither "Designed by" nor "Brand This Project".
   */
  hideCompanyLine: rawUsage === "personal" && !isCompanyBranded,
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
  /**
   * Brand logo image path (public/ URL) from the design brief, or "" when none was
   * uploaded. The header/footer show this image instead of the text name when set.
   */
  logo: rawLogo,
};

/**
 * Composed title lockup, e.g. "ACME ltd : Refinements".
 * Drops the separator when there is no project name.
 */
export const siteTitle = siteConfig.projectName
  ? `${siteConfig.clientName} : ${siteConfig.projectName}`
  : siteConfig.clientName;

// Styleguide/brand readiness is NOT a base-scope concept anymore. Base (v00) is
// the pristine template blueprint — the designer's real styleguide lives in their
// design variation, so readiness is tracked per-variation via the record's
// `styleguideStatus` / `brandStatus` fields (see src/data/variations.ts), never a
// global VITE flag. The old VITE_STYLEGUIDE_READY / VITE_BRAND_READY flags are
// retired.

/**
 * Project type — chosen once at /setup-project, drives the device-preview matrix.
 * A whole-project decision (every variation of an app is an app), so it lives in
 * the committed .env rather than on the per-variation record.
 *
 *   "website" — desktop + tablet + mobile.
 *   "app"     — mobile-first; desktop is hidden entirely (tablet + mobile).
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

/**
 * Desktop nav menu style — the STARTING point chosen at setup (website projects).
 * "traditional" = plain links, no open menu; "dropdown" = hover reveals a link
 * list; "mega" = hover reveals a full content-width panel of sections. It only
 * SEEDS the per-item menus in menu.ts — a designer diverges any item from there.
 */
export type MenuStyle = "traditional" | "dropdown" | "mega";
const rawMenuStyle = (import.meta.env.VITE_MENU_STYLE ?? "").trim().toLowerCase();
export const menuStyle: MenuStyle =
  rawMenuStyle === "dropdown" || rawMenuStyle === "mega" ? rawMenuStyle : "traditional";

// The tablet preview is part of the baseline: the design is one responsive layout
// (phones share one layout below @lg, tablets sit above it), so the frame costs the
// build nothing. VITE_ENABLE_TABLET="false" is the opt-OUT (any other value keeps it).
const enableTablet =
  (import.meta.env.VITE_ENABLE_TABLET ?? "").trim().toLowerCase() !== "false";

/**
 * Derived device-preview config consumed by the responsive preview (ViewToggle +
 * the frame selection in Home). `views` is the ordered set of device buttons to
 * show (width-descending); `defaultView` is the one selected on load. Components
 * read this instead of hardcoding the device matrix.
 */
function computePreviewConfig(): { views: View[]; defaultView: View } {
  const isApp = projectType === "app";
  // Full width-descending order, filtered by project type + the tablet opt-out.
  const views = (["desktop", "tablet", "mobile"] as View[]).filter((v) => {
    if (v === "desktop") return !isApp;      // apps hide desktop entirely
    if (v === "tablet") return enableTablet; // on unless the project opted out
    return true;                             // mobile is always available
  });
  return { views, defaultView: isApp ? "mobile" : "desktop" };
}

export const previewConfig = computePreviewConfig();

/**
 * The devices the phone and tablet frames can simulate (CSS px, portrait). The View
 * bar lists them under the Mobile and Tablet buttons; the FIRST of each kind is the
 * default. Real current devices, so what the designer checks is what a client holds
 * (the old 370px frame was narrower than any phone on sale). Every phone here sits
 * below the `@sm` container breakpoint (448px, see styles/theme.css) and every
 * tablet above `@lg` (512px), so phones share one layout and tablets another.
 */
export type DeviceKind = "mobile" | "tablet";
export interface Device { id: string; name: string; width: number; height: number; }
export const devices: Record<DeviceKind, readonly Device[]> = {
  mobile: [
    { id: "iphone-16", name: "iPhone 16", width: 393, height: 852 },
    { id: "iphone-16-pro", name: "iPhone 16 Pro", width: 402, height: 874 },
    { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", width: 440, height: 956 },
    { id: "iphone-se", name: "iPhone SE", width: 375, height: 667 },
    { id: "pixel-9", name: "Pixel 9", width: 412, height: 923 },
    { id: "galaxy-s24", name: "Galaxy S24", width: 360, height: 780 },
  ],
  tablet: [
    { id: "ipad-mini", name: "iPad mini", width: 744, height: 1133 },
    { id: "ipad", name: "iPad", width: 820, height: 1180 },
    { id: "ipad-pro-11", name: "iPad Pro 11\"", width: 834, height: 1194 },
    { id: "ipad-pro-13", name: "iPad Pro 13\"", width: 1024, height: 1366 },
  ],
};

/**
 * Viewport sizes (px) per breakpoint for the Figma export (scripts/export-to-figma.mjs)
 * and any headless snapshot: the DEFAULT devices' screens, desktop a standard artboard.
 * The live preview may have another device chosen (src/app/devices.ts); App.tsx
 * publishes THAT through window.__PREVIEW_CONFIG__, so an export run against the
 * same browser storage matches what the designer is looking at.
 */
export const previewWidths: Record<View, number> = {
  desktop: 1440,
  tablet: devices.tablet[0].width,
  mobile: devices.mobile[0].width,
};
export const previewHeights: Record<View, number> = {
  desktop: 900,
  tablet: devices.tablet[0].height,
  mobile: devices.mobile[0].height,
};
