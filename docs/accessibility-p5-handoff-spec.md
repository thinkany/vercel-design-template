# Accessibility P5: the handoff (Figma contrast annotations + a11y checklist)

**Status:** TODO, spec'd 2026-09-11. P1-P4 are built and on main; this is the last phase.
**Prereq:** none outstanding. Everything below reads data that already exists.

P1-P4 built the loop: prevent (contrast-safe tokens), detect (axe audit), sustain (the
review drawer). All three end at the app's edge. **Nothing the designer delivers carries
any record of it.** A client receives a Figma file with no note of which color pairs pass
AA, and a site with no statement of what was checked or what still needs a person.

That is the gap P5 closes, and it is the phase that backs the claim. The framing has
always been **"designed to AA, audited, plus a handoff checklist", never "508 certified"**,
because automation covers roughly a third of AA and the rest is human judgment. Ship the
first two thirds without the checklist and the claim is unbacked at exactly the moment it
is made.

> **Both original spec docs are gone.** `accessibility-aa-spec.md` and
> `accessibility-review-spec.md` were lost in the 2026-09-01 repo unification (no deletion
> commit; only a stray reference inside `scripts/lib/contrast.mjs` survives). This document
> is written to stand alone.

---

## 0. What exists to build on (verified 2026-09-11)

| Piece | Where | Shape |
|---|---|---|
| Contrast engine | `scripts/lib/contrast.mjs` | `luminance` / `ratio` / `passes` / `adjustForContrast`, `CONTRACT_PAIRS` (P1-P9) |
| Enforcement + provenance | `scripts/apply-brand.mjs:165-206`, emitted at `:313` | `accessibility: { notes, warnings, linkAffordanceNeeded, pairs }` in the summary; `mode: "off"` when AA is off (`:281`) |
| Audit engine | `auditA11y()` in `desktop/main.cjs` | axe-core 4.13, three breakpoints, findings deduped `rule::selector` |
| Review state | `.thinkany/a11y.json` via `a11y:load` / `a11y:save` (`main.cjs:4164-4174`) | `{ active, dismissed, completed, ranAt }` |
| Figma brand manifest | `scripts/export-brand-to-figma.mjs` → `figma-export/brand-{id}.json` | **Carries no accessibility data at all** (grep: zero hits) |

**The key finding:** both halves of P5 are *reporting* problems, not analysis problems. The
pair table is already computed at brand-apply time and the violations are already computed
at audit time. Neither half needs new measurement logic, and neither needs a model call.

---

## 1. Part A: contrast annotations in the Figma export

### 1.1 Carry the data

`enforceContrast()` already returns `pairs` (each with its two roles, ratio, and pass/fail
against its threshold). `apply-brand.mjs` writes it to the brand summary. The Figma
exporter never reads it.

- `scripts/export-brand-to-figma.mjs` reads the same `tokens.css` + `brand.ts` it reads
  today, and **recomputes the pair table via `scripts/lib/contrast.mjs`** rather than
  depending on a prior `apply-brand` run having left a summary behind. One import, same
  engine, so the Figma file and the Styleguide readout can never disagree.
- Emit into `brand-{id}.json` as a top-level `accessibility` block, the same shape
  `apply-brand` produces: `{ mode, pairs[], warnings[], linkAffordanceNeeded[] }`.
- **When AA mode is off**, emit `mode: "off"` with the pairs still measured but nothing
  nudged. The file should still tell the truth about where the palette stands; it just
  must not imply the design was built to AA. This matters: most designs are built AA-off
  by default, and a Figma file claiming compliance for one of them would be worse than
  silence.

### 1.2 Draw it

The Styleguide Page already has a Colors section. Add an **Accessibility** section beneath
it, built in the `specimen` phase of `figma-brand-library.plugin.js` (idempotent
find-by-name update, like every other phase).

One row per contract pair: the two swatches overlapping as a real sample (the foreground
color as actual text on the background fill, not two separate chips), the measured ratio to
two decimals, the threshold it was judged against, and a pass/fail mark. A header line
states the mode: *"Built to WCAG 2.1 AA"* or *"AA mode off, measured for reference"*.

Where a pair was nudged, show **both** values: the chosen color struck through, the
enforced one beside it, and the provenance note. A developer opening the file should be
able to see that `--ta-muted` shifted `#777` to `#6e6e6e` and why, otherwise the Figma file
and the shipped CSS disagree with no explanation.

`linkAffordanceNeeded` gets a line of its own: these are the roles whose contrast as link
text is carried by the brand rather than the ratio, so they require an underline. That is a
markup obligation the Figma file cannot express visually but the developer must honor.

### 1.3 Command changes

`.claude/commands/export-figma.md` currently has **zero** accessibility mentions across its
458 lines. Add a short paragraph to the brand-tokens section noting that the Styleguide
Page carries an Accessibility section, that it is generated (never hand-edited), and that
its mode line reflects whether the design was built AA-on. No new prompts, no new scope
option: it rides the existing `scaffold → variables → textstyles → specimen` sequence.

---

## 2. Part B: `a11y-checklist.md` at handoff

### 2.1 What it is

A generated markdown file, written into the project, that states plainly:

1. **What was automated**, with results. The contrast contract (which pairs, measured, pass
   or fail) and the axe-core audit (which rules ran, at which breakpoints, what was found,
   what was fixed, what was held or dismissed and the stated reason).
2. **What was not**, as an actionable list. The human-judgment two thirds: meaningful alt
   text, reading and focus order, link text that makes sense out of context, form error
   clarity, media captions, motion sensitivity, content language and reading level.
3. **The claim, stated exactly.** "Designed to WCAG 2.1 AA and audited with axe-core.
   This is not a certification of Section 508 conformance." Verbatim, not paraphrased,
   and not upgradeable by the model.

### 2.2 Generation

`scripts/a11y-checklist.mjs`, deterministic and zero-dep beyond what is installed. Reads:

- the pair table (recomputed via `contrast.mjs`, as in Part A, so both halves agree),
- `.thinkany/a11y.json` for the audit state: `ranAt`, `active`, `dismissed`, `completed`,
- the project's page list for the per-page section.

Writes `a11y-checklist.md` at the project root.

**No model call.** The human-judgment list is a fixed rubric, not generated prose: it is the
same every time because the standard is the same every time, and a model rewriting it each
run would let the claim drift. Per-page rows are filled from real data or left as unchecked
boxes for a person.

### 2.3 Honesty rules (the part that must not be got wrong)

These are the requirements that make the document worth having. A checklist that overstates
is worse than none, because it is what a client would point at.

- **Never claim a passing audit that did not run.** If `.thinkany/a11y.json` has no `ranAt`,
  say "no audit has been run" and omit the results section. Do not infer.
- **A stale audit is stale.** If the design changed after `ranAt`, say so with both dates.
  Cheapest reliable signal: compare `ranAt` against the newest mtime in the variation's
  source directory.
- **Dismissed is not fixed.** Dismissed findings appear in their own section with whatever
  reason was recorded. A client reading the file must be able to see what was knowingly
  set aside. Never fold them into a total.
- **AA-off means AA-off.** If the design was built with AA mode off, the document says so at
  the top and the contrast section reports measurements without claiming conformance.
- **Counts are of what was measured**, never of what exists. axe-core finds a subset; the
  document says which rules ran and does not imply completeness.

### 2.4 When it is written

Two triggers, both explicit:

- **On promote** (`promote-blocks`), so a site build carries it from the start.
- **On demand**, from a button in the Accessibility drawer's Global Rules section:
  "Write the handoff checklist". Enabled whenever the project has a design, regardless of
  AA mode, since the AA-off case produces a truthful document too.

Deliberately **not** on publish, and **not** automatic. A compliance document should be
produced when someone decides to produce it. Silently regenerating it on every deploy
invites a stale or overstated file going out unread.

### 2.5 Where it goes

Project root, alongside `README.md`, and included in the published site's repo but
**excluded from the deployed output** (it is a handoff artifact for the client's developer,
not a public page). Add to the publish ignore list in `desktop/publish.cjs` (`isIgnored`,
`:126`).

---

## 3. Phases

Both halves are independent and separately shippable. Part B carries more of the value: it
is the one that backs the claim, and it reaches every project rather than only the ones
exported to Figma.

1. **B1** `scripts/a11y-checklist.mjs` + the fixed rubric + the honesty rules, runnable
   from the CLI. Verify against a real audited project, an unaudited one, and an AA-off
   one: three different truthful documents.
2. **B2** Drawer button + the `promote-blocks` trigger + the publish-ignore entry.
3. **A1** `accessibility` block in `brand-{id}.json`, recomputed via `contrast.mjs`.
4. **A2** The Accessibility section in the `specimen` phase + the `export-figma.md`
   paragraph.

**Estimate:** B is about a day, A about a day.

## 4. Not in scope

Certification, VPAT generation, or any automated conformance claim. Re-auditing at
handoff time (the checklist reports the audit that ran; it does not silently run a new
one). Remediation, which is P4's Fix flow and already exists.
