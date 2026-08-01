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
  /** The CSS custom property, e.g. "--ta-primary". Must exist in tokens.css. */
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

export interface PaletteGroup {
  /** Group heading shown as a SubHead in the styleguide, e.g. "Brand Palette". */
  title: string;
  /** Optional one-line note shown under the heading. */
  description?: string;
  colors: BrandColor[];
}

export interface SpacingStep {
  /** Tailwind scale key, e.g. "4" (→ p-4/gap-4). */
  scale: string;
  /** Pixel value. Exported to Figma as a FLOAT variable (Spacing/{scale}). */
  px: number;
  /** Representative Tailwind utilities, e.g. "p-4 / gap-4". */
  tw: string;
  /** What the step is for. */
  use: string;
}

export interface RadiusStep {
  /** Human name, e.g. "Base". Exported to Figma as a FLOAT variable (Radius/{name}). */
  name: string;
  /** Corner-radius in px (9999 = fully rounded / pill). */
  px: number;
  /** Representative Tailwind utility, e.g. "rounded". */
  tw: string;
  /** What the radius is for. */
  use: string;
}

export interface Brand {
  /**
   * Brand color groups — each renders as its own titled subsection in the
   * styleguide's Colors section. This is the extensible side: add or remove
   * groups here (or via /setup-styleguide) to create/remove color sections.
   * The shadcn "System Palette" is a FIXED reference in StyleGuide.tsx and is
   * intentionally NOT modeled here — leave it alone.
   */
  paletteGroups: PaletteGroup[];
  fonts: BrandFont[];
  /** Spacing scale (px). Documented in the guide; exported as FLOAT variables. */
  spacing: SpacingStep[];
  /** Corner-radius scale (px). Documented in the guide; exported as FLOAT variables. */
  radii: RadiusStep[];
  /** Type scale (px sizes, ascending). Guide ramp; exported as a text-style ramp. */
  typeScale: number[];
}

// The template DEFAULT palette & type roles. This base copy stays the neutral
// blueprint; `/setup-styleguide` REPLACES these in the designer's variation and
// marks that variation's brand established (its `brandStatus` record field).
export const brand: Brand = {
  paletteGroups: [
    {
      title: "Brand Palette",
      // Seven SEMANTIC ROLES (stable token slugs). /setup-styleguide sets each
      // role's `value` and personalizes its `name` to the project's own color
      // (e.g. "Navy"), but keeps the token slug — so components never break.
      colors: [
        { name: "Primary", token: "--ta-primary", value: "#1e4b96", text: "#ffffff", role: "Links, buttons, active states" },
        { name: "Accent",  token: "--ta-accent",  value: "#c41230", text: "#ffffff", role: "Highlights, badges, alerts" },
        { name: "Surface", token: "--ta-surface", value: "#f8f7f3", text: "#111111", role: "Page & section backgrounds, card fills" },
        { name: "Ink",     token: "--ta-ink",     value: "#111111", text: "#ffffff", role: "Headings & strong text" },
        { name: "Body",    token: "--ta-body",    value: "#333333", text: "#ffffff", role: "Body / paragraph text" },
        { name: "Muted",   token: "--ta-muted",   value: "#777777", text: "#ffffff", role: "Captions, metadata, bylines" },
        { name: "Border",  token: "--ta-border",  value: "#cccccc", text: "#111111", role: "Borders, dividers, hairlines" },
      ],
    },
  ],
  fonts: [
    { name: "Display", token: "--ta-font-display", stack: "var(--ta-font-display)", role: "Headings, titles, hero text",        sample: "The quick brown fox jumps" },
    { name: "Serif",   token: "--ta-font-serif",   stack: "var(--ta-font-serif)",   role: "Body copy, long-form reading",       sample: "The quick brown fox jumps over the lazy dog." },
    { name: "Sans",    token: "--ta-font-sans",    stack: "var(--ta-font-sans)",    role: "UI labels, navigation, metadata",    sample: "THE QUICK BROWN FOX · 24 JUNE 2026" },
    { name: "Mono",    token: "--ta-font-mono",    stack: "var(--ta-font-mono)",    role: "Numeric data, tabular values, code", sample: "0123456789  ·  $1,240.50  ·  99.9%" },
  ],
  spacing: [
    { scale: "0.5", px: 2,  tw: "p-0.5 / gap-0.5", use: "Micro gap — tight metadata stacks" },
    { scale: "1",   px: 4,  tw: "p-1 / gap-1",     use: "Icon/text pairs, atom spacing" },
    { scale: "1.5", px: 6,  tw: "p-1.5 / gap-1.5", use: "Label rows, badge groups" },
    { scale: "2",   px: 8,  tw: "p-2 / gap-2",     use: "Compact item spacing" },
    { scale: "3",   px: 12, tw: "p-3 / gap-3",     use: "Card internal padding" },
    { scale: "3.5", px: 14, tw: "p-3.5",           use: "Compact card padding" },
    { scale: "4",   px: 16, tw: "p-4 / gap-4",     use: "Base unit — standard padding" },
    { scale: "5",   px: 20, tw: "p-5 / gap-5",     use: "Section gap" },
    { scale: "6",   px: 24, tw: "p-6 / gap-6",     use: "Column padding" },
    { scale: "7",   px: 28, tw: "p-7",             use: "Section top padding" },
    { scale: "8",   px: 32, tw: "p-8 / gap-8",     use: "Column gutter" },
    { scale: "10",  px: 40, tw: "p-10",            use: "Section vertical spacing" },
  ],
  radii: [
    { name: "None", px: 0,    tw: "rounded-none", use: "Squared — tables, full-bleed media" },
    { name: "SM",   px: 2,    tw: "rounded-sm",   use: "Inputs, badges, small controls" },
    { name: "Base", px: 4,    tw: "rounded",      use: "Buttons, default controls" },
    { name: "MD",   px: 6,    tw: "rounded-md",   use: "Cards, panels" },
    { name: "LG",   px: 8,    tw: "rounded-lg",   use: "Modals, image tiles" },
    { name: "XL",   px: 12,   tw: "rounded-xl",   use: "Feature cards, hero media" },
    { name: "Full", px: 9999, tw: "rounded-full", use: "Pills, avatars, toggles" },
  ],
  typeScale: [9, 10, 11, 12, 13, 14, 15, 16, 18, 21, 24, 28, 34],
};
