// ©2026 thinkany llc. All rights reserved.
// SITE CHROME — the header/footer wrapped around every page (KEEP tier: a template
// upgrade never overwrites this file). The layout imports `Header` and `Footer`
// by NAME from here, which is what lets the header hydrate (Astro resolves a
// `client:*` directive against the layout's own import statements, so the chrome
// can't come through a registry object). Export `null` for a piece you don't want.
import type { Chrome } from "../src/lib/blocks";

export const Header = null;
export const Footer = null;

/** Definitions for the two above (props schema, hydrate), keyed the same way. */
export const chrome: Chrome = {};
