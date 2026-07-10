// Public site / brand configuration.
//
// Values come from the committed .env (VITE_CLIENT_NAME / VITE_PROJECT_NAME /
// VITE_COMPANY_NAME / VITE_SITE_TAGLINE). Fill them with the `/setup-project`
// command or by hand. On a fresh, unbranded template pull they are blank and
// neutral placeholders are shown instead — so the app always renders something
// intentional and signals "needs branding".

const PLACEHOLDER_CLIENT = "Client Name";
const PLACEHOLDER_COMPANY = "Company Name";
const PLACEHOLDER_PROJECT = "Project Name";
const PLACEHOLDER_TAGLINE = "Your site tagline";

const rawCompany = (import.meta.env.VITE_COMPANY_NAME ?? "").trim();
const rawClient = (import.meta.env.VITE_CLIENT_NAME ?? "").trim();
const rawProject = (import.meta.env.VITE_PROJECT_NAME ?? "").trim();
const rawTagline = (import.meta.env.VITE_SITE_TAGLINE ?? "").trim();

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
  /**
   * Optional tagline. Falls back to a placeholder only while fully unbranded;
   * once branded, an intentionally-empty tagline stays empty (and is hidden).
   */
  tagline: isBranded ? rawTagline : PLACEHOLDER_TAGLINE,
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
