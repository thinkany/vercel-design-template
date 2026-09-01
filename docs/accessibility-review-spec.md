# Accessibility review (P3 + P4) — build spec

**Status:** SPEC'd 2026-08-31, not built. Reframes accessibility-aa-spec.md P3/P4 per Rob's
decision. **Prereqs shipped:** P1 (opt-in contrast-safe tokens, `scripts/lib/contrast.mjs` +
`apply-brand.mjs --aa`) and P2 (opt-in `/design` §4d rules) — both scaffold/main, uncommitted.

## Decisions (locked)

- **AA is fully opt-in, default OFF** (never interferes with the creative process). Everything
  is gated on `A11Y=aa` (`TA_DESIGN_A11Y` env / a Claude-Settings toggle). Off = zero footprint.
- **On-demand + retroactive**, NOT an auto per-turn hook. A **"Run accessibility review"** button
  (enabled once AA mode is on) audits the CURRENT rendered design — works on any existing design,
  including ones built with AA off. Like Figma Export / the Director's "Review this design."
- **Findings → Fix / Hold / Dismiss**, modeled on the Art Director's Phase-3 drawer, REUSING its
  suggestion-row + modal + per-variation persistence machinery. Fix = a scoped builder edit turn.
- **Its own parallel "Accessibility" rail drawer**, gated by the AA toggle (NOT the Art Director's
  design-variety license) — compliance available to everyone who opts in, kept separate from the
  creative critique.

## P3 — the audit engine (detect)

Run axe-core against the rendered page via a hidden BrowserWindow (the capture-bridge pattern),
per breakpoint, on demand.

- **Dependency:** add `axe-core` (single self-contained `axe.min.js`, no sub-deps; bundled via
  build.files `desktop/**`/nodedeps). First build step.
- **`main.cjs` `auditA11y(variationId)`** (new): needs `viteUrl` (running dev server). For each
  breakpoint [desktop 1440, tablet 834, mobile 390]: create/reuse a hidden `BrowserWindow`
  (`show:false`, `backgroundThrottling:false`, `partition:"a11y-audit"`), `setContentSize(w,h)`,
  `loadURL(`${viteUrl}/?v=${vid}&capture=${bp}`)`, wait for `[data-capture-ready]`, inject the axe
  source (`executeJavaScript(fs.readFileSync(require.resolve("axe-core/axe.min.js"),"utf8"))`),
  then `axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},
  resultTypes:['violations']})`. Map each violation → `{ id, impact, help, helpUrl, wcag:[tags],
  nodes:[{ target(selector), html(≤300), failureSummary }] }`. Dedupe across breakpoints by
  `id+target`; tag which breakpoints each hit. Destroy the window in `finally`.
- **IPC:** `a11y:audit` (→ findings) + preload `auditA11y`. Deterministic, ZERO model tokens.
- (Optional later: also a `scripts/audit-a11y.mjs` CLI for agent/CI use, same output shape.)

## P4 — the review drawer + Fix/Hold/Dismiss + toggle

### Toggle (the on/off switch)
- Claude-Settings drawer toggle "Accessibility (AA) mode" mirroring narrate/images: `a11y:get/set`
  IPC → `ui-state.buildA11y` (+ optional per-variation later). When on, `agent:send` sets
  `process.env.TA_DESIGN_A11Y="aa"` (alongside `TA_DESIGN_IMAGES/RESEARCH`) so the build honors §4d
  and `apply-brand` runs `--aa`; and the drawer's Run button + rail affordance enable.

### Rail + drawer
- New rail icon `#rail-a11y` (order: … Voice · Company · **Accessibility** · Licenses · Help),
  visible/enabled only when AA mode is on (like the Director icon's gating).
- `renderA11y(body)` (new), reusing the Director drawer's structure:
  - **"Run accessibility review"** button (disabled until a design is previewed + AA on) → `a11y:audit`
    → spinner → findings.
  - Findings rows (most-severe first by `impact`): title (e.g. "3 images missing alt text"),
    WCAG SC + impact chip. Row → modal (help + failureSummary + the offending selector/snippet) with
    **Fix / Hold / Dismiss** (Dismiss → Archive w/ Restore), exactly like the Director modal.
- **Persistence per variation:** `.thinkany/a11y.json` (mirror `artdirector.json`): active findings +
  archive + last-run timestamp. A re-run merges (keep Held/Dismissed state by finding key).

### Fix (the actionable part)
- **Fix** = a scoped BUILDER edit turn (never reviewMode), same as the Director's Apply: hand the
  builder a precise instruction built from the finding — the rule, the WCAG SC, the element
  (selector + html snippet + which section), and the remediation ("add descriptive `alt`", "add
  `focus-visible:ring-2 ring-ta-primary`", "swap the hardcoded hex to `text-ta-body`", "this heading
  skips a level, make it an `h2`", "pad this control to ≥24px"). Scope: `src/variations/${id}/`. The
  builder locates the element from the snippet/section (no exact file:line needed).
- Contrast-in-context findings can point Fix at the token (P1) or at replacing a hardcoded hex.

## Build order
1. `axe-core` dep. 2. `auditA11y` + IPC/preload (P3). 3. AA-mode toggle + env wiring. 4. rail icon +
`renderA11y` drawer (reuse Director row/modal). 5. `.thinkany/a11y.json` persistence. 6. Fix turn
wiring. 7. copy in copy.js. Then live-test: build a design AA-off → toggle on → Run review → Fix a
finding → re-run.

## Notes / open
- App-side (electron worktree, feature/onboarding-intake). P1/P2 are scaffold/main — the two halves
  merge together.
- The Director drawer machinery to reuse: `renderDirector` (shell.js ~5031), the modal (~5114),
  onAgentSuggestions/persistence (~5001). Extract the shared row/modal if cleaner, or parallel it.
- Capture route confirmed: `?v={id}&capture={desktop|tablet|mobile}`, render gate `[data-capture-ready]`.
- P5 (Figma annotations + handoff checklist) deferred until P4 done (Rob).
