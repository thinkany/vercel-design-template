// Single source of truth for this template's version.
//
// The SAME file — public/version.json — is (a) imported here so the app knows its
// OWN installed version at build time, and (b) served statically at
// /version.json. On the template's canonical deploy (create.thinkany.design) that
// served file IS the latest version, since that deploy builds from template main.
// A designer's dashboard fetches the canonical URL and compares it to the value
// imported below to decide whether an upgrade is available. One file, no drift.
//
// A release bumps public/version.json (and scripts/upgrade.mjs stamps README from
// it) — nothing else here changes.
//
// The file is read at build time by vite.config.ts and compiled in as
// __TA_VERSION_MANIFEST__ (a file under public/ can't be imported from JavaScript).

export type VersionManifest = {
  version: string;
  notes?: string;
  date?: string;
  /** Canonical URL of the distribution zip the upgrade overlay pulls. */
  zipUrl?: string;
};

declare const __TA_VERSION_MANIFEST__: VersionManifest;
const manifest: VersionManifest = typeof __TA_VERSION_MANIFEST__ !== "undefined" ? __TA_VERSION_MANIFEST__ : { version: "0.0.0" };

/** This template copy's own version, compiled into the bundle. */
export const TEMPLATE_VERSION: string = manifest.version;

export const localManifest = manifest as VersionManifest;

/** The canonical template deploy that publishes the latest version. */
export const VERSION_SOURCE_URL = "https://create.thinkany.design/version.json";

/**
 * Compare two dotted numeric version strings.
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Missing/short segments read as 0,
 * non-numeric segments read as 0 (defensive — never throws on bad input).
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? "0", 10) || 0;
    const nb = parseInt(pb[i] ?? "0", 10) || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
