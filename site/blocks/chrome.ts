// ©2026 thinkany llc. All rights reserved.
// SITE CHROME — the header/footer wrapped around every page (KEEP tier: a template
// upgrade never overwrites this file). The layout imports `Header` and `Footer`
// by NAME from here, which is what lets the header hydrate (Astro resolves a
// `client:*` directive against the layout's own import statements, so the chrome
// can't come through a registry object). Export `null` for a piece you don't want.
import type { Chrome } from "../src/lib/blocks";
import { Header as ConfiguredHeader, headerChrome } from "./lib/Header";

// THE HEADER IS CONFIGURED, NOT PROMOTED. `lib/Header.tsx` (CORE) renders the
// pinned design's own header.config.ts + header.skin.ts against this site's `nav`
// data, so the site header IS the design header and promote never re-authors it.
// A design that genuinely needs a different one promotes a `site/blocks/Header.tsx`
// and points this line at it instead:  export { Header } from "./Header";
export const Header = ConfiguredHeader;
export const Footer = null;

/** Definitions for the two above (props schema, hydrate), keyed the same way. */
export const chrome: Chrome = { header: headerChrome };
