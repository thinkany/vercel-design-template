// ©2026 thinkany llc. All rights reserved.
/**
 * HEADER SKIN — the design layer (designer-owned, KEEP tier: a template upgrade
 * never overwrites this file). This is where the header's LOOK lives, and it is
 * yours to rewrite freely: every value is a Tailwind class string applied to one
 * fixed element in `Header.tsx`.
 *
 * The split is deliberate. `Header.tsx` (CORE) owns the header's STRUCTURE —
 * where the logo sits, what opens where, how the panel anchors, the mobile
 * drawer, hover and keyboard behaviour — and gets it right every time, on every
 * placement. This file owns everything a design decision can reasonably touch:
 * height, gutters, surface, borders, type, hover treatment, panel styling.
 *
 * SO: to make the header taller, darker, quieter, denser or more editorial, edit
 * the strings below. To move the logo or change what opens, edit
 * `src/app/header.config.ts`. Do NOT copy `Header.tsx` into a variation to
 * restyle it — a variation-level Header.tsx is the "custom header" escape hatch
 * (supported, but it opts out of the structural guarantees and gets flagged).
 *
 * Use the `--ta-*` brand tokens (`text-ta-ink`, `bg-ta-surface`, `font-ta-display`,
 * …) rather than literal colors, so the header follows the design's palette.
 *
 * A variation overrides this the same way it overrides a component: drop a
 * `header.skin.ts` into `src/variations/{id}/components/` exporting `headerSkin`.
 */
export interface HeaderSkin {
  /** The header bar itself — surface, bottom border, shadow. */
  bar: string;
  /** The inner row — horizontal gutters and vertical height. */
  inner: string;
  /** The text wordmark (shown when no logo image is set). */
  wordmark: string;
  /** The logo image, when the brief supplied one. */
  logo: string;
  /** A top-level nav link. */
  link: string;
  /** Added to the nav link for the current / open item. */
  linkActive: string;
  /** Optional call-to-action in the bar. Empty string = no CTA rendered. */
  cta: string;
  /** The dropdown + mega panel surface. */
  panel: string;
  /** The mega panel's inner padding (a dropdown pads its own links). */
  panelInner: string;
  /** A link inside a dropdown panel. */
  dropdownLink: string;
  /** A mega panel column's heading. */
  columnHeading: string;
  /** A link inside a mega panel column. */
  columnLink: string;
  /** The mega panel's featured block. */
  feature: string;
  /** The mobile drawer surface. */
  drawer: string;
  /** A top-level link in the mobile drawer. */
  drawerLink: string;
  /** A sub-link in the mobile drawer's accordion. */
  drawerSubLink: string;
  /** The hamburger / close icon button. */
  hamburger: string;
}

export const headerSkin: HeaderSkin = {
  bar: "border-b border-black/10 bg-ta-surface",
  inner: "px-6 py-4 @lg:px-10",
  wordmark: "font-ta-display text-lg leading-none text-ta-ink",
  logo: "h-8 w-auto max-w-[200px] object-contain",
  link: "font-ta-sans text-xs font-medium uppercase tracking-[0.1em] text-ta-body transition-colors hover:text-ta-ink",
  linkActive: "text-ta-ink",
  cta: "",
  panel: "border border-black/10 bg-ta-surface shadow-xl",
  panelInner: "px-8 py-8",
  dropdownLink: "px-4 py-2.5 font-ta-sans text-xs font-medium uppercase tracking-[0.08em] text-ta-body hover:text-ta-ink",
  columnHeading: "font-ta-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ta-ink",
  columnLink: "font-ta-sans text-sm text-ta-body hover:text-ta-ink",
  feature: "rounded bg-black/[0.04] p-5",
  drawer: "bg-ta-surface shadow-2xl",
  drawerLink: "font-ta-sans text-sm font-medium uppercase tracking-[0.1em] text-ta-body hover:text-ta-ink",
  drawerSubLink: "font-ta-sans text-xs uppercase tracking-[0.08em] text-ta-body hover:text-ta-ink",
  hamburger: "text-ta-ink",
};
