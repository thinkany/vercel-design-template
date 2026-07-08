// Public site / brand configuration.
//
// Values come from the committed .env (VITE_SITE_*). Fill them with the
// `/setup-project` command or by hand. On a fresh, unbranded template pull
// both are blank and neutral placeholders are shown instead — so the app
// always renders something intentional and signals "needs branding".

const PLACEHOLDER_NAME = "Project Name";
const PLACEHOLDER_SUBTITLE = "Subtitle";
const PLACEHOLDER_TAGLINE = "Your site tagline";

const rawName = (import.meta.env.VITE_SITE_NAME ?? "").trim();
const rawSubtitle = (import.meta.env.VITE_SITE_SUBTITLE ?? "").trim();
const rawTagline = (import.meta.env.VITE_SITE_TAGLINE ?? "").trim();

// The template is considered "branded" once a name has been provided.
const isBranded = rawName.length > 0;

export const siteConfig = {
  /** False until the site has been branded (via /setup-project or by hand). */
  isBranded,
  /** Primary name. Falls back to a placeholder only while fully unbranded. */
  name: rawName || PLACEHOLDER_NAME,
  /**
   * Secondary label. Falls back to a placeholder only while fully unbranded;
   * once branded, an intentionally-empty subtitle stays empty.
   */
  subtitle: isBranded ? rawSubtitle : PLACEHOLDER_SUBTITLE,
  /**
   * Optional tagline. Falls back to a placeholder only while fully unbranded;
   * once branded, an intentionally-empty tagline stays empty (and is hidden).
   */
  tagline: isBranded ? rawTagline : PLACEHOLDER_TAGLINE,
};

/**
 * Composed title lockup, e.g. "Deep Focus Review : Refinements".
 * Drops the separator when there is no subtitle.
 */
export const siteTitle = siteConfig.subtitle
  ? `${siteConfig.name} : ${siteConfig.subtitle}`
  : siteConfig.name;

/**
 * Phase II marker. True once the styleguide has been configured for this
 * project (fonts & colors set, example sections adapted) and
 * VITE_STYLEGUIDE_READY has been set to "true". While false, the styleguide
 * shows a setup banner. See the /setup-styleguide command.
 */
export const styleguideReady =
  (import.meta.env.VITE_STYLEGUIDE_READY ?? "").trim().toLowerCase() === "true";
