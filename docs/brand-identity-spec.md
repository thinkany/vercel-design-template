# Brand Identity (the third deliverable: a brand system studio)

**Status:** spec'd 2026-09-07 from Rob's outline and direction answers. **Priority:
future feature, high. A separately licensed offering** beside Web and App design.
Nothing built. Builds on the deliverable registry (`desktop/intake/deliverables.cjs`,
where `brand-guideline` is already a coming-soon stub), the variation model, the
Art Director, gated publish, and the site builder.

## Goal

A designer runs a brand identity project in the app the same way they run a
website: intake, directions as variations, a live preview, gated publish for the
client, Figma export. The deliverable is a **brand book**: a small multi-page site
that renders the designer's strategy, mood board, voice, logo, color, type,
graphic language, applications, and guidelines from files the designer owns. An
approved brand can then seed a new Website or App project, so brand to site
happens in one tool.

## Principle

Designer initiates, AI reacts. Designer sets rules, AI complies. Everything Claude
produces is marked suggested until the designer accepts it; anything the designer
locks, Claude cannot write. The app's copy calls itself a studio assistant that
organizes, summarizes, and suggests, and reserves taste and authorship for the
designer.

## Decisions (Rob, 2026-09-07)

1. **The brand book is the renderer and the client deliverable.** Pages, not a
   new surface. Gated publish, variations, Art Director, and Figma export work on
   it unchanged.
2. **Logos are the designer's work.** The designer draws marks elsewhere and
   uploads them. Claude never generates a logo. It reviews one on request, Art
   Director style: what the shapes, weight, and negative space do and don't do
   against the strategy, sliders, and mood board.
3. **First release is the brand kit plus the published book.** Strategy and voice
   are text pages inside it. A **mood board** is part of the process and a page of
   the book, so the client always sees where the design came from. Guidelines,
   change logs, applications, and rollout follow.
4. **An approved direction MAY feed a Website or App project** and is handled as
   a first-class input to those projects' intake, never as an automatic step.
5. **Gated offering.** Its own license key (`BRAND_LICENSE_KEY`), the same
   encrypted-keychain shape as `DESIGN_LICENSE_KEY` and `DERIVE_LICENSE_KEY`,
   validated by derive, which also serves the brand persona and skills the way it
   serves the licensed design skills today. Without it the Brand card shows as a
   locked offering, not a coming-soon stub.

## How it fits the app

- **First screen.** "What are you designing for?" gains a third card: **Brand**
  ("Identity, voice, and guidelines in one living book."). Choosing it sets
  `VITE_PROJECT_TYPE=brand` and starts brand intake.
- **The kit already exists.** Palette roles in `tokens.css`, fonts in
  `fonts.css`, the logo in `public/brand`, written by `apply-brand`,
  `extract-palette`, and `resolve-fonts` from references. The StyleGuide
  component renders it. A brand project uses the same files as its source of
  truth, so nothing about color or type is invented twice.
- **Variations are directions.** Direction A, B, C are `v01`, `v02`, `v03`, each
  with its own tokens, fonts, and brand files, with the same reroll, compare, and
  archive flow.
- **Brand attribute sliders** reuse the Design Direction slider UI with brand
  axes. Their values are constraints in the persona preamble for every later
  suggestion; the persona has no tool that writes them.
- **References and mood board** reuse reference upload and ingest. The mood board
  is a curated subset of references with the designer's captions.
- **Art Director** gains a brand scope: consistency review of the book and of
  uploaded applications, and logo review on request.
- **Publish** is the existing gated Vercel path. The book is the project's pages,
  so "Publish this design" publishes the book behind the preview password.
- **Figma export** uses the existing brand library plugin for tokens, type, and
  logo, plus page export for the book itself.
- **Site builder** is where guidelines get audience layers and change logs,
  because those are content operations the builder already does.

## Data (designer-owned, file-based)

A `brand/` folder in the project, one per variation under
`src/variations/vNN/brand/` (base in `brand/` at the root, mirroring how styles
divert per variation). Every file carries `status: "suggested" | "accepted" |
"locked"` at the top level or per entry, and an `author: "designer" | "claude"`
stamp per entry.

```
brand/
  strategy.json      positioning, value props, personas, attributes (sliders)
  voice.json         voice description, guardrails, examples, do/don't
  messaging.json     naming territories, taglines, key messages, alt takes
  moodboard.json     ordered references with captions; images in public/brand/mood/
  logo.json          uploaded marks (primary, secondary, mono, favicon) + clear space,
                     min size, misuse list, review notes
  palette.json       roles and reasoning over tokens.css (tokens.css stays the value source)
  type.json          role hierarchy over fonts.css, alternates, accessibility notes
  graphic.json       the graphic language: grid, shapes, illustration, motion, examples
  applications/      designer-built examples + drafted layout rules (P3)
  guidelines/*.md    guideline sections, each with audience + status (P2)
  changelog.md       human-readable "what changed and why" entries (P2)
  activity.jsonl     the activity feed: who did what, designer vs Claude
```

Rules:

- `tokens.css` and `fonts.css` remain the values. `palette.json` and `type.json`
  carry roles, reasoning, and status, never a second copy of a hex.
- A `locked` file or entry is refused by the tool guard (`desktop/tool-guard.cjs`
  gains a brand rule: no write to a path whose JSON status is locked). The
  designer unlocks from the UI, and the unlock is logged.
- `activity.jsonl` is append-only, written by the app for designer actions and by
  the MCP tools for Claude's. It is the source of the activity feed.

## The brand book (pages)

Rendered by the existing design surface as pages of the variation, so each
direction has its own book. Sections, in order:

1. **Overview**: client, project, direction name, one-paragraph positioning.
2. **Strategy**: positioning, value props, personas, attribute sliders as a
   visual scale.
3. **Mood board**: the curated references with captions, "where this comes from".
4. **Voice**: the voice description, guardrails, example lines, do and don't.
5. **Messaging**: taglines and key messages that reached accepted.
6. **Logo**: marks, clear space, minimum sizes, misuse, on light and dark and on
   photography.
7. **Color**: roles, values, pairings, contrast readout (the AA engine from
   `scripts/lib/contrast.mjs`).
8. **Typography**: hierarchy, scale, alternates, accessibility notes.
9. **Graphic language**: grid, shapes, illustration, motion, examples.
10. **Applications** (P3): the designer's examples with the rules beside them.
11. **Guidelines** (P2): the sections flagged guideline-worthy, by audience.
12. **Changes** (P2): the change log.

Suggested content renders with a visible "Suggested" tag in the preview and is
omitted from the published book. The published book shows accepted and locked
content only.

## Modules and how each keeps the designer in charge

### Strategy and positioning (P1)
- Intake: client notes, workshop notes, decks, existing brand docs go through
  reference ingest. Claude drafts positioning statements, value props, and
  personas into `strategy.json`, all `suggested`.
- **Challenge and refine**: the designer annotates an entry ("too buzzwordy",
  "lean into sustainability"). Claude rewrites as a new suggested entry beside
  the original; it never replaces. The designer accepts one, edits it, or discards.
- **Attribute sliders**: set by the designer only. Persisted in `strategy.json`
  under `attributes` and injected as constraints. No tool can change them.

### Verbal identity (P1 text, P2 alt-take memory)
- **Voice examples**: the designer pastes writing they like; Claude describes
  the style in words; the designer confirms or edits; that description becomes
  the voice guardrail in `voice.json`, which the persona quotes verbatim.
- **Naming territories, taglines, key messages**: proposed from prompts the
  designer gives, stored as alt takes with the original preserved side by side.
- "The tool remembers what they like" is explicit, not learned: accepted
  entries and the designer's edit notes are the record. No hidden preference
  model.

### Visual system (P1)
- **Mood board**: the designer promotes references to the board and captions
  them. Claude may suggest a caption or a grouping, marked suggested.
- **Palette**: the designer picks a starting color or a reference image;
  `extract-palette` proposes roles with reasoning into `palette.json`. The
  designer approves, adjusts, or rejects; approval writes `tokens.css` via
  `apply-brand` with the contrast gate. Locking the palette locks both files.
- **Typography**: the designer chooses families; Claude proposes a hierarchy and
  alternates into `type.json`; overrides become the standard.
- **Logo**: upload only. Claude fills `logo.json` clear space and minimum size
  rules from the mark's geometry, marked suggested. **Logo review**, on request,
  is an Art Director scope: it reads the mark against strategy, sliders, and mood
  board and returns observations and questions ("the counter closes at small
  sizes, intended?"), never a redrawn mark.
- **Graphic language**: from references and the designer's early examples,
  Claude describes candidate systems. The designer picks one and supplies or
  curates examples; Claude writes rules that describe what the designer made.

### Applications and consistency (P3)
- The designer builds key examples (social post, web hero, email header) as
  pages of the variation or uploads them. Claude drafts layout rules beside
  them; the designer edits; rules the designer has not accepted are never
  applied by any tool.
- Template suggestions ("you'll need event signage") are a list, and a
  low-fi wireframe only when the designer asks (ties to the earmarked wireframe
  mode).
- **Consistency check** is an Art Director review scoped to brand: it surfaces
  drift as questions with Hold and Dismiss, and Fix is a scoped turn the
  designer starts.

### Guidelines as living docs (P2)
- The designer flags anything as guideline-worthy; Claude drafts a section in
  `guidelines/` with the visuals the designer selects.
- **Audience layers**: each section carries `audience: in-house | staff |
  partners`. The published book has an audience switch; Claude writes the
  plainer layers from the core rules, and the core rules are one file.
- **Change log**: when a locked rule is unlocked and changed, Claude drafts a
  "what changed and why" entry; the designer edits and accepts it.

### Rollout and handoff (P3)
- **Asset packs**: the designer selects; the app organizes (naming, print vs
  digital vs social folders) and zips. Reuses the media library.
- **Usage FAQ and launch meeting script**: drafted from the project's own
  brief, guidelines, and the designer's notes. No email or Slack integration in
  scope; the designer pastes questions in if they want them considered.
- Nothing client-facing leaves the app without the designer publishing it.

### Ownership and visibility (P1 feed and scope, P2 polish)
- **Activity feed**: a rail drawer reading `activity.jsonl`, filterable by
  designer versus Claude, with counts.
- **AI scope**: per-project toggles in Claude settings (Naming, Copy, Visual
  suggestions, Summaries). Off means the tool guard refuses writes to that
  domain's files and the persona is told the domain is out of scope.
- **Copy**: brand-area strings in `desktop/copy.js` use assistant language
  ("Suggested", "Draft for you", "Your call") and never "generated for you".

## The bridge to Website and App

An approved direction is exported as a **brand bundle**: the company-profile
pattern (`scripts/company-profile.mjs`) extended to a `thinkany-brand` kind that
carries tokens, fonts, logo files, mood board images, voice, and the accepted
guidelines as one self-contained JSON with binaries base64-embedded.

- **Export**: Brand project → "Bridge this direction" (only for a direction
  whose palette, type, logo, and voice are accepted or locked).
- **Import**: Website and App intake gain a "Start from a brand" step. It writes
  tokens and fonts through `apply-brand`, places the logo, seeds the references
  and mood board, and injects the voice guardrail into the project's copy rules.
  The brief records the bundle's direction id and date, so the Art Director can
  say "drifts from the approved brand" with a source.
- The bridge is a copy, not a link. A later brand change does not silently
  rewrite a site; the designer re-bridges and reviews the diff.

## Licensing

`BRAND_LICENSE_KEY`, stored and validated like the design license, listed in Keys
and Licenses beside Design and Figma. It gates: the Brand card, the brand persona
and skills served by derive, logo review, consistency review, and the bridge
export. A project created with the key stays openable without it (the files are
the designer's); only the licensed operations lock.

## Phases

- **P1 Brand kit and book.** Brand card and intake; `brand/` schema and MCP
  tools with suggested/accepted/locked; sliders; strategy and voice drafting with
  challenge-and-refine; mood board; palette and type through the existing
  scripts; logo upload and rules; graphic language page; the book as variation
  pages; gated publish; activity feed; AI scope toggles; license gate.
- **P2 Guidelines.** Guideline-worthy flagging, sections by audience, change
  log, alt-take history for messaging, Figma brand export of the book.
- **P3 Applications and rollout.** Designer examples with drafted rules,
  consistency review, template list, asset packs, FAQ and launch script.
- **P4 Bridge.** Brand bundle export and "Start from a brand" in Website and
  App intake. (Could pull forward to P2 if the brand-to-site story is the sales
  lead.)

## Open questions

1. Does the bridge ship in P2 or P4? It is the strongest cross-sell and it is
   mostly the company-profile code path.
2. Should the published book have an audience switch from P1 with a single
   layer, so the URL never changes when layers arrive in P2?
3. Slider axes: a fixed set of six, or designer-defined pairs? Fixed is easier
   to render and to bridge.
4. Where do uploaded application examples live when they are images rather than
   pages: media library or `brand/applications/`?
