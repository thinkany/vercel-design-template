// ─────────────────────────────────────────────────────────────────────────
// BRAND MANIFEST — the project palette & type roles for ONE scope.
//
// This is the single source of truth the styleguide renders its Primitives →
// Colors / Typography swatches from. It is paired with `tokens.css`: the CSS
// custom properties there are what components actually consume (`var(--ta-*)`),
// while this manifest supplies the human-facing LIST (names, roles, order) and
// documents each token's value. `/setup-styleguide` writes BOTH together for the
// active scope so they never drift.
//
// SILOING: the base ships this file; every variation gets its OWN copy at
// `src/variations/{id}/styles/brand.ts` (the dev copier duplicates the whole
// `styles/` folder). A variation's palette has ZERO crossover with any other —
// `resolveBrand(id)` returns only that scope's manifest.
//
// SCOPE: this covers the PROJECT palette only — the `--ta-*` brand colors and
// `--ta-font-*` type roles. The admin/tooling palette (`--admin-*`, the gated
// page, Dashboard, and the styleguide's own chrome) is intentional and separate;
// it is NEVER configured here. Leave every `--admin-*` token untouched.
// ─────────────────────────────────────────────────────────────────────────

export interface BrandColor {
  /** Human name shown under the swatch, e.g. "Brand Blue". */
  name: string;
  /** The CSS custom property, e.g. "--ta-blue". Must exist in tokens.css. */
  token: string;
  /** Hex value — documents/fallback; the live value is read from tokens.css. */
  value: string;
  /** Legible overlay text color for the swatch (dark swatch → #fff, light → ink). */
  text: string;
  /** What the color is for. */
  role: string;
}

export interface BrandFont {
  /** Role name shown as the specimen heading, e.g. "Display". */
  name: string;
  /** The CSS custom property, e.g. "--ta-font-display". */
  token: string;
  /** Render reference — always `var(--ta-font-*)` so specimens track tokens.css. */
  stack: string;
  /** What the typeface is for. */
  role: string;
  /** Specimen string shown in the type-scale section. */
  sample: string;
}

export interface Brand {
  colors: BrandColor[];
  fonts: BrandFont[];
}

// The template DEFAULT palette & type roles. Ships as-is until a project runs
// `/setup-styleguide`, which REPLACES these arrays with the established brand and
// flips the brand-ready flag (VITE_BRAND_READY for the base; a variation's
// `brandStatus` record field for a variation).
export const brand: Brand = {
  colors: [
    { name: "Brand Blue",      token: "--ta-blue",       value: "#1e4b96", text: "#ffffff", role: "Links, active nav, accent borders" },
    { name: "Accent Red",      token: "--ta-red",        value: "#c41230", text: "#ffffff", role: "Star ratings, NEW badge, alerts" },
    { name: "Page Background", token: "--ta-cream",      value: "#f8f7f3", text: "#111111", role: "Site background, card fills, hero wash" },
    { name: "Primary Text",    token: "--ta-ink",        value: "#111111", text: "#ffffff", role: "Body text, primary headings" },
    { name: "Secondary Text",  token: "--ta-gray-dark",  value: "#333333", text: "#ffffff", role: "Secondary body text" },
    { name: "Metadata",        token: "--ta-gray-mid",   value: "#777777", text: "#ffffff", role: "Captions, timestamps, bylines" },
    { name: "Dividers",        token: "--ta-gray-light", value: "#cccccc", text: "#111111", role: "Borders, separator lines" },
  ],
  fonts: [
    { name: "Display", token: "--ta-font-display", stack: "var(--ta-font-display)", role: "Headings, titles, hero text",        sample: "The quick brown fox jumps" },
    { name: "Serif",   token: "--ta-font-serif",   stack: "var(--ta-font-serif)",   role: "Body copy, long-form reading",       sample: "The quick brown fox jumps over the lazy dog." },
    { name: "Sans",    token: "--ta-font-sans",    stack: "var(--ta-font-sans)",    role: "UI labels, navigation, metadata",    sample: "THE QUICK BROWN FOX · 24 JUNE 2026" },
    { name: "Mono",    token: "--ta-font-mono",    stack: "var(--ta-font-mono)",    role: "Numeric data, tabular values, code", sample: "0123456789  ·  ★★★★½" },
  ],
};
