# Deterministic header and menu (structure from code, skin from the agent)

**Status:** spec'd 2026-09-10 from Rob's ask ("mega menus nearly always need an
adjustment after the initial pass; the tool needs to build the architecture of the
site 100% accurate every time regardless of menu type"). Rob asked whether a menu
agent makes sense; the answer here is no: an agent for verification, code for
construction.

**P1 + P2 + P3 + P4 BUILT 2026-09-10/11** on `feature/menu-deterministic-header` (harness-verified,
not yet app-tested). All nine layouts pass the check at three widths, and a
deliberately broken custom header fails with the right rule:
`npx electron desktop/build/menu-layouts-test.cjs [--shots]`. The tool-guard's header
cases ride in a committed 85-case test: `node desktop/dev/tool-guard.test.cjs`.

P2 seeds the nav from the brief (one Haiku call at build handoff, ~$0.0017 a build)
and is LIVE-TESTED across seven briefs: an architecture practice got "Residential
Extensions / Commercial Fit-outs / Heritage Restoration" from its own words, a
five-word brief ("a dog grooming business") got Full Grooming / Hand Stripping /
coat types, and the seeded files then passed the menu check end to end. The one weak
output is a COMPLETELY empty brief, which yields "Service One / Service Two"; the
failure path is safe (no key, timeout, refusal or junk reply all leave the scaffold's
files untouched and the build proceeds).

P3 makes the SITE's header the DESIGN's header: `site/blocks/lib/Header.tsx` (CORE)
renders `content/site.json`'s nav using the pinned design's own `header.config.ts` and
`header.skin.ts`, resolved through two new Astro/Vite aliases, so `/promote-blocks`
stops re-authoring the header entirely (it now only moves the menu's DATA into
`site.json`). The menu check grew a `site: true` mode and runs the same rules against
the built site. Only P5 (Art Director surfacing) is still open.

## Goal

Whatever header the designer picks in the Get Designing intake (nine layouts: simple,
dropdown or mega menu, times logo-left/links-right, logo-left/links-center,
logo-center/links-split), the built design and the promoted site render that header
correctly on the first pass, every time, on desktop and mobile, with every link the
site's architecture says should be there. The design agent still owns how the header
looks. It stops owning how the header is put together.

## Why the menu drifts today

The header is the most mechanical component in the build and it is currently written
free-form twice.

1. **Design phase.** The picker's layout id becomes a sentence in the build prompt
   (`MENU_LAYOUT_PHRASES` in `desktop/main.cjs`), and the agent hand-edits a
   per-variation `Header.tsx` from the base one (`src/app/components/Header.tsx`).
   The base only implements one placement (logo left, links right); every other
   placement is re-derived by the model. The center-split grid bug logged 2026-08-29
   (a `col-start-2` logo after the `col-start-3` nav gets bumped to an implicit second
   row) is the typical result: the model rebuilds the grid and one detail is wrong.
2. **Promote phase.** `/promote-blocks` asks the agent to re-author the header as the
   site's chrome block: fold `MobileMenu` in, switch from `menu.ts` to the `navItem`
   schema (`links` for dropdowns, `columns` for mega menus), keep the logo-vs-wordmark
   branch, keep header and footer links separate. A second generative rewrite of the
   same layout code, with a second chance to miss.

A model with a narrower prompt (a "menu agent") lowers the miss rate. It cannot
remove it. Only code reaches "every time".

## The principle

**Structure is data plus a configured component. Skin is the agent's.** Three
layers, each with one owner:

| Layer | Holds | Owner | How it changes |
|---|---|---|---|
| Architecture | Which items, in what order, which open into what (links, columns, feature) | The project's data: `pages.ts` / the page outline, `menu.ts`, `content/site.json` `nav[]` | Intake seeds it, the Navigation tab edits it |
| Structure | Placement of logo and links, panel anchoring, mobile drawer, keyboard and hover behaviour | CORE header component, configured, tested | Template upgrades only |
| Skin | Type, spacing, header height, panel surface, hover and active treatment, divider, wordmark style | The design agent, through named slots | `/design`, `/promote-blocks`, edits |

The agent never touches the structure layer. When it wants a different header it
changes the configuration or the slots. When neither is enough (a genuinely divergent
header the design calls for), it drops a custom header into the variation and the
build flags the header as unverified.

## Part 1. A configured CORE header (design surface)

### Configuration

`src/app/header.config.ts` (CORE, seeded by the app from the intake, editable):

```ts
export const headerConfig = {
  placement: "left-right" | "left-center" | "center-split",
  menuKind: "none" | "dropdown" | "mega",      // = VITE_MENU_STYLE today; kept in one place
  sticky: true,
  menuSide: "right" | "left",                  // replaces the MENU_SIDE constant in menuState.ts
  mega: { columns: 4, feature: true },         // grid width and whether a feature panel renders
};
```

The intake's `menuLayout` id splits into `placement` and `menuKind`. `MENU_LAYOUT_PHRASES`
stops being an instruction to build and becomes a description of what is already
configured ("the header is configured as a full-width mega menu, logo centered with the
links split around it; style it, do not restructure it").

### The component

`src/app/components/Header.tsx` implements all three placements from
`headerConfig.placement`, in one file, with these guarantees baked in:

- **Placement grid.** `left-right` and `left-center` are flex rows. `center-split` is a
  three-column grid with `row-start-1` on every cell and the links divided evenly around
  the logo (odd counts put the extra link on the right). This is the 2026-08-29 fix,
  written once.
- **Panels at header level.** Dropdown and mega panels stay siblings of the nav, absolute
  `top-full`, so they anchor to the header's bottom edge whatever the placement. A dropdown
  measures its trigger; a mega spans the content column. Unchanged from today.
- **Mega panel from data.** Columns come from `menu.ts` sections; the feature panel renders
  when `featured` exists and `mega.feature` is on. Column count is configuration, not a
  class the agent types.
- **Mobile drawer folded in.** `MobileMenu` becomes part of the header component (it already
  shares state through `menuState.ts`); the hamburger and the drawer edge both read
  `headerConfig.menuSide`. This also removes a step from promote.
- **Hover and focus.** Open on hover and on focus, close on leave and Escape, arrow keys
  between items. Today's behaviour plus keyboard, once.
- **Capture hooks.** `data-block`, `data-block-name` and `data-menu-item` stay exactly as
  they are so Figma export and the menu check find the same things.

### The skin contract

The agent styles through `src/app/components/header.skin.ts` (KEEP tier: the
designer's, never overwritten):

```ts
export const headerSkin = {
  bar: "border-b border-black/10 bg-ta-surface",             // the header surface
  inner: "px-6 py-4 @lg:px-10",                               // height and gutters
  wordmark: "font-ta-display text-lg text-ta-ink",
  logo: "h-8 w-auto max-w-[200px] object-contain",
  link: "font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-body hover:text-ta-ink",
  linkActive: "text-ta-ink",
  panel: "border border-black/10 bg-ta-surface shadow-xl",   // dropdown + mega surface
  panelInner: "px-8 py-8",
  columnHeading: "font-ta-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ta-ink",
  columnLink: "font-ta-sans text-sm text-ta-body hover:text-ta-ink",
  feature: "rounded bg-black/[0.04] p-5",
  drawer: "bg-ta-surface",
  drawerLink: "font-ta-display text-2xl text-ta-ink",
  hamburger: "text-ta-ink",
};
```

Every slot is a class string applied to a fixed element. The agent can make the header
tall and airy, dense and utilitarian, dark, bordered, or borderless, change the type
of every part, and restyle the panel entirely. It cannot move the logo, change what
opens where, or re-anchor the panel, because no slot reaches those.

### Enforcement

- `/design` §4c changes from "match the base Header pattern when you diverge" to: the
  header is configured; edit `header.config.ts` and `header.skin.ts` only; do not copy
  `Header.tsx` into the variation. The variation-level `Header.tsx` override stays
  supported but is the "custom header" path below.
- The tool guard (`desktop/tool-guard.cjs`) denies Write/Edit on
  `src/app/components/Header.tsx` and `MobileMenu.tsx` during a build turn, with a
  message pointing at the config and skin files. Bash edits to the same paths are
  already covered by the guard's path checks.
- A **custom header** (a `Header.tsx` in the variation folder) is allowed when the
  designer asks for it in so many words. The build records `header: "custom"` in
  `variation.json`; the menu check (Part 3) still runs and its failures are reported,
  not auto-fixed.

### Seeding the architecture from the intake

The intake already knows the sections and, for a website, the pages. Seeding today
gives every nav item the same example menu (`seed(kind)` in `menu.schema.ts`: "Shop by
Category", "Summer '26"). Instead the app writes `menu.ts` from the brief:

- Items = the pages in `pages.ts` (already the case).
- `dropdown`: each item's links = the page's child pages if the brief names any,
  otherwise the home-page sections that belong to it, otherwise a three-link placeholder
  labelled in the client's domain (from the "what" text, by the model, once, into data).
- `mega`: columns from the same source, grouped; the feature panel takes the brief's
  strongest offer or the first Selected-work item.

The agent's build turn then sees a menu that already describes this client's
architecture and has nothing to invent.

## Part 2. The same header as site chrome

`site/blocks/lib/Header.tsx` (CORE, shipped with the scaffold) renders the site
`navItem` schema with the same `headerConfig` and `headerSkin`:

- `item.links` renders the dropdown; `item.columns` (`heading`, `links`, `feature`)
  renders the mega panel. Which one shows is decided by the data, item by item, as the
  Navigation tab already models it.
- Logos per slot (`logos.header`, `logos.headerMobile`, wordmark fallback) exactly as
  `/promote-blocks` §2 specifies today, in code rather than in instructions.
- `hydrate: "load"`, named export, mobile drawer inside: the block contract as it stands.
- `site/blocks/chrome.ts` (KEEP) points at it by default:
  `export { Header } from "./lib/Header"`. A custom design header is promoted into
  `site/blocks/Header.tsx` and `chrome.ts` points there instead.

`/promote-blocks` then **stops re-authoring the header**. Its chrome step becomes:
copy `header.config.ts` and `header.skin.ts` into the site (or reference them through
the `@design` alias the way `fonts.css` and `tokens.css` already are), move the menu's
columns into `content/site.json` `nav[].columns`, and promote the footer as before.
Placement, anchoring and hydration are no longer things it can get wrong.

## Part 3. The menu check (the piece that earns "every time")

A deterministic check in `desktop/menu-check.cjs`, run through the capture bridge
(`capture-bridge.cjs`), the way the accessibility audit and the lens-examples runner
already drive a hidden window. It runs against the design preview after every
Get Designing build and edit that touched the header, and against the Site tab after
promote and after a Navigation change.

For each of desktop (1440), tablet (if enabled) and mobile (390):

1. **Architecture.** Read the expected menu from data (`menu.ts` on the design surface,
   `content/site.json` `nav[]` on the site). Read the rendered nav (`[data-menu-item]`,
   the links inside `<nav>`). Assert the same items in the same order, and on the
   site that every href resolves to a page, post, entry or section that exists.
2. **Panels.** For each item with a menu, open it (`?menu=open&item={id}` on the design
   surface, a hover plus focus on the site) and assert: the panel is visible; its top
   edge equals the header's bottom edge within 1px; it lies inside the viewport
   horizontally; it contains every link and column heading the data lists; nothing else
   in the header moved when it opened.
3. **Placement.** Logo and nav bounding boxes match the configured placement: logo box
   left of the first link (`left-*`), links centred within 8px of the inner width's
   centre (`left-center`), logo centred and the link groups on either side with equal
   counts within one (`center-split`). All in one row: every box's vertical centre within
   4px of the header's.
4. **Mobile.** At the mobile width the desktop nav is hidden, the hamburger sits on
   `menuSide`, opening it reveals a drawer containing every item and sub-link, and the
   drawer slides from the same side.
5. **Above the fold.** The header's height is below 25% of the viewport at every width
   (a guard against the "two-row header by accident" case).

Output: `.thinkany/menu-check.json` (`{ ok, findings: [{ rule, width, item, expected,
actual }] }`) plus a one-line summary in the build narration ("Menu: 6 items, 2 panels,
verified at 3 widths"). A failing check on a configured header is a framework bug and is
reported as such (the config and skin cannot produce one); on a custom header it is a
finding for the designer.

### Where an agent belongs

Findings surface in the Art Director drawer the way accessibility findings do: a
rule-grouped list with Fix, Hold, Dismiss. Fix on a custom header is a scoped builder
turn with the finding's expected-vs-actual as its brief. Fix on a configured header is
not an agent turn at all; it re-seeds the config from the intake and re-runs the check.
That is the whole "menu agent": verification and explanation, never construction.

## What this changes for the designer

- The nine picker choices produce the header they show, first time.
- Mega menus arrive populated with this client's structure, not a shop's.
- "Make the header taller / darker / quieter / more editorial" still works; it edits the
  skin. "Put the logo in the middle" edits the config. "Give me a two-row header with a
  utility bar" is a custom header and is flagged as such.
- After promote, the Site tab's header is the design's header with the Navigation tab's
  data in it, and the check says so.

## Phases

| Phase | Builds | Test |
|---|---|---|
| ~~P1~~ | ✅ `header.config.ts` + `header.skin.ts`; `Header.tsx` implements the three placements with the drawer folded in; intake writes the config; `MENU_LAYOUT_PHRASES` becomes descriptive; `/design` §4c rewritten; tool-guard rule | ✅ `menu-layouts-test.cjs`: nine layouts × three widths, all pass; `--shots` writes the per-layout PNGs (eyeballed); guard test committed at 85 cases (and caught a real `diskutil eraseDisk` gap in the existing rules) |
| ~~P2~~ | ✅ `menu-seed.cjs` (prompt + schema + a `clean` that distrusts the reply + `menu.ts`/`pages.ts` renderers), called at the build handoff; `/design` §3 tells the agent the pages arrive seeded | ✅ `node desktop/dev/menu-seed.test.cjs` (67 checks, every misbehaving-model case) + a live run over seven briefs, and the seeded files pass the menu check in a real scaffold |
| ~~P3~~ | ✅ `site/blocks/lib/Header.tsx` + default `chrome.ts` + `@design-header-config`/`@design-header-skin` aliases in BOTH builds; `/promote-blocks` chrome step reduced to moving nav data; `site:saveSite` stops dropping mega `columns` | ✅ `npx electron desktop/build/site-header-test.cjs`: a mega nav in content/site.json, the design's dark skin, the SAME menu check green against the built site at two widths |
| ~~P4~~ | ✅ `menu-check.cjs` + capture-bridge driver + `.thinkany/menu-check.json` + narration line (runs itself after a build or a header-touching edit; `menu:check` IPC for on demand) | ✅ Nine scaffolds pass; the broken custom header fails on `placement` ("an element sits 8px off centre") |
| P5 | Art Director surfacing: findings list, Fix on custom headers, re-seed on configured ones | One broken custom header fixed through the drawer |

P1 and P4 together deliver the guarantee. P2 makes the first pass useful rather than
merely correct. P3 removes the second rewrite. P5 is polish.

## Open questions

- **Upgrade path for existing projects.** A project whose variation already carries a
  hand-built `Header.tsx` keeps it (KEEP tier) and is treated as custom: the check runs,
  nothing is replaced. Do we offer "switch to the configured header" as a one-click in
  the dashboard, with the current skin extracted by the model into `header.skin.ts`?
- **Skin slots vs variety.** The slot list above is a first cut. Watch for the first
  design the agent cannot express through it and add a slot rather than allow a
  structural edit. Candidates already visible in the lens examples: a top utility strip
  (data-utility), a tagline beside the wordmark (corporate-confident), a pill CTA in the
  bar (playful-toybox). The CTA may deserve a `cta` slot in P1.
- **Where the check's 1px and 8px tolerances come from.** Start strict, loosen only on
  evidence from real builds.
- **Figma export.** Menu blocks export per open state today (`Menu — {Item}`). The
  configured header keeps the same `data-block` markers, so nothing changes, but the
  export should be re-run in P1's test to prove it.
