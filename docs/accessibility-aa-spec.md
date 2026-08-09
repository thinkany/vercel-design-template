# Accessibility (WCAG 2.1 AA / Section 508) — spec

**Status:** proposed, not built. **Owner:** design-template + Electron app.
**Standard:** WCAG 2.1 Level AA (the standard Section 508 references).

## 0. Goal & honest scope

Offer designs that are **built to WCAG 2.1 AA**, and keep alterations **within that
scope** as the designer iterates. Two truths shape the whole spec:

1. **Automation covers ~a third of AA.** Tools reliably check contrast, missing
   `alt`, ARIA misuse, heading order, form labels, target size. They **cannot**
   judge whether `alt` text is *meaningful*, whether reading order makes sense, or
   whether link text is descriptive. So the product claim is **"designed to WCAG 2.1
   AA, automatically audited for the machine-checkable criteria, with a guided
   checklist for the rest,"** never "certified 508."
2. **We start ahead.** The shadcn/Radix components (`ui/*.tsx`) are already keyboard-
   and ARIA-accessible. The two real risk areas are **(a) color/contrast** (the
   palette is auto-derived) and **(b) the agent's freeform markup** (headings,
   landmarks, `alt`, focus). Everything here targets those two.

## 1. Strategy: Prevent → Detect → Sustain

- **Prevent** — bake AA into generation so most designs are compliant *by
  construction*: a **contrast-safe token system** (Phase 1) + **AA authoring rules**
  in the `/design` contract (Phase 2).
- **Detect** — **automated audits**: a deterministic contrast check at brand-apply
  time, and an `axe-core` DOM audit via the existing capture infra (Phase 3).
- **Sustain** — keep iterations in scope: a **persistent a11y badge** (reusing the
  ImageCredits pattern) + a **post-turn audit hook** + an **opt-in "AA mode" toggle**
  (Phase 4). Then **handoff** (Figma annotations + human checklist, Phase 5).

## 2. Architecture touch-points

| Concern | Where |
| --- | --- |
| Token values | `src/styles/tokens.css` (`--ta-*`) |
| Token manifest (pairs, roles, the per-color `text` on-color) | `src/styles/brand.ts` |
| Palette derivation + write | `scripts/extract-palette.mjs`, `scripts/apply-brand.mjs` |
| Authoring rules | `.claude/commands/design.md`, `design-brief.md` |
| Headless render for audit | `desktop/capture-bridge.cjs`, `scripts/lib/page-driver.mjs`, capture route `/?v=&capture=` |
| Preview badge pattern (reuse) | `src/app/components/ImageCredits.tsx`, `DesignSurface.tsx` |
| Per-turn hook | `desktop/shell.js` `onAgentEvent` `result` case |
| Opt-in toggle pattern | Claude Settings + `process.env.TA_*` (mirrors `TA_DESIGN_IMAGES`) |
| Figma handoff | `scripts/export-*` + `use_figma` builders |

---

## Phase 1 — Contrast-safe token system (FIRST; everything leans on it)

**Why first:** contrast is the single most common AA failure and it's fully
determined by the palette, which we auto-derive. If the tokens are guaranteed to
pass AA *as pairs*, then every design built on them is contrast-compliant by
construction, and a brand-color change **re-validates automatically**. This converts
"keep it in scope" from per-edit policing into a structural invariant.

### 1.1 The pair model

WCAG contrast is a property of **foreground/background pairs**, not single colors.
`brand.ts` already hints at this with a `text` field per color (the "legible overlay
color"). Formalize a fixed set of **contract pairs** with thresholds:

| # | Foreground | Background | Threshold | Note |
| --- | --- | --- | --- | --- |
| P1 | `--ta-body` | `--ta-surface` | 4.5:1 | body copy |
| P2 | `--ta-ink` | `--ta-surface` | 4.5:1 | headings |
| P3 | `--ta-muted` | `--ta-surface` | 4.5:1 | **usual failure** (#777/#f8f7f3 ≈ 4.26:1) |
| P4 | `text`(primary) | `--ta-primary` | 4.5:1 | button label on primary |
| P5 | `text`(accent) | `--ta-accent` | 4.5:1 | label on accent |
| P6 | `text`(ink) | `--ta-ink` | 4.5:1 | label on dark section |
| P7 | `--ta-primary` | `--ta-surface` | 4.5:1 | primary used as **link text** |
| P8 | `--ta-accent` | `--ta-surface` | 4.5:1 | accent as text |
| P9 | `--ta-border` | `--ta-surface` | 3:1 | non-text UI (1.4.11); **decorative-exempt** — warn, don't force |

The `text` on-colors (P4–P6) are the `text` field already in `brand.ts`. Large-text
relaxation (3:1 for ≥ 24px or ≥ 18.66px bold) is a per-*usage* concern, not a token
one, so **tokens hold to the strict 4.5:1** and the audit (Phase 3) applies the large-
text relaxation where it can measure font size.

### 1.2 The contrast engine (`scripts/lib/contrast.mjs`, zero-dep)

Pure functions, no browser:
- `luminance(hex)` — sRGB relative luminance (linearize channels, weight
  0.2126/0.7152/0.0722).
- `ratio(hexA, hexB)` — `(Llight + 0.05) / (Ldark + 0.05)`.
- `passes(fg, bg, threshold)` — boolean.
- `adjustForContrast(fg, bg, threshold, { preferDarker })` — returns a nudged `fg`
  that meets `threshold` **preserving hue**, by stepping **lightness** toward more
  contrast (darker on light bg, lighter on dark bg) until `ratio ≥ threshold + 0.1`
  margin, capped at black/white. Use **OKLCH lightness** for perceptual nudges
  (small self-contained sRGB↔OKLCH conversion) with HSL-L as a documented fallback.

### 1.3 Enforcement at derive time (`apply-brand.mjs`)

After the palette is chosen (whether extracted or defaulted), before writing
`tokens.css` + `brand.ts`:
1. Evaluate P1–P9.
2. For each failing pair, **auto-adjust the pair's *foreground* member** (`adjustForContrast`) — never the brand background, so brand identity is preserved. Precedence when a color appears in multiple pairs (e.g. `--ta-muted` is only a foreground): adjust the foreground token to satisfy the *strictest* pair it participates in.
   - **Links exception (P7/P8):** if adjusting `--ta-primary`/`--ta-accent` as text would drift the brand color too far (Δ beyond a threshold), instead **leave the color and flag that links need a non-color affordance** (underline) — recorded for Phase 2's authoring rule, since color-only links also risk 1.4.1.
3. Write the adjusted values, and emit a **provenance note** (what was nudged and from→to) into the closing summary + an optional `--ta-*` comment, so the change is transparent, not silent.

`extract-palette.mjs` stays a *proposer*; `apply-brand.mjs` is the single **enforcer**
(one gate, deterministic, testable via `node -e`).

### 1.4 Manifest & styleguide (`brand.ts`, StyleGuide)

- `brand.ts` gains a computed **contrast readout** per pair (ratio + pass/fail +
  target) so the Styleguide can render an **"Accessibility" section**: each contract
  pair shown as a live sample with its ratio and an AA ✓/✗ badge. This makes the
  guarantee visible and is the human-facing proof.
- The per-color `text` field becomes **authoritative** (validated), and components
  should consume on-colors consistently (optionally promote to explicit
  `--ta-on-primary` / `--ta-on-accent` / `--ta-on-surface` tokens; optional, keep
  minimal if components already read `--ta-body`/`--ta-ink`).

### 1.5 Acceptance (Phase 1)

- `node -e` proves `ratio`/`passes`/`adjustForContrast` correct against known WCAG
  fixtures (e.g. #777/#f8f7f3 ≈ 4.26 fails; adjusted muted ≥ 4.5).
- Running `apply-brand.mjs` on a palette whose muted fails yields a `tokens.css`
  where **every P1–P8 pair passes** (P9 warns), with a provenance note.
- Styleguide shows the Accessibility section with live ratios.

---

## Phase 2 — AA authoring rules in the `/design` contract

Add a concise **"Accessibility (AA)"** section to `.claude/commands/design.md` (and
by reference `design-brief.md`), the same way §4b governs images. Rules the agent
follows while authoring:

- **Structure:** one `<h1>`, then ordered headings (no skips); landmark elements
  (`<header>`/`<nav>`/`<main>`/`<footer>`); lists for lists.
- **Images:** every `<img>` has `alt` (empty `alt=""` for decorative); the FPO
  `ImagePlaceholder` already sets `role="img"` + label.
- **Color:** use only the `--ta-*` tokens (Phase 1 guarantees their pairs); **never
  color-only** to convey meaning; **links get an underline or other non-color
  affordance** (honors the P7/P8 flag).
- **Focus:** visible focus rings on all interactive elements (don't remove
  `outline` without a replacement); logical focus order.
- **Targets:** interactive targets ≥ 24×24px (2.5.8).
- **Motion:** wrap non-essential animation in `prefers-reduced-motion` (the app's
  own WAAPI/motion included).
- **Forms:** every control has a programmatic label; errors are text, not color-only.

**Acceptance:** a design built from a brief passes the Phase 3 audit's structure/alt/
focus checks without remediation on a typical page.

---

## Phase 3 — Automated audit (detect)

Two complementary checks:

1. **Token contrast check** (from Phase 1's engine) — instant, browser-free, run at
   apply-brand and on demand. Answers "is the palette AA as pairs?"
2. **`axe-core` DOM audit** — the real page. **Reuse the capture infrastructure**
   (`capture-bridge.cjs` hidden `BrowserWindow` / `page-driver.mjs`) that already
   renders `/?v=&capture=` for the Figma export: load the page, inject `axe-core`,
   run, collect violations (contrast *in context*, `alt`, ARIA, heading order,
   labels, target size), map each to a WCAG SC + the offending selector.
   - New: `scripts/audit-a11y.mjs` (drives the page driver + axe) → structured JSON
     `{ violations: [{ id, impact, wcag, nodes:[{selector, snippet, fix}] }] }`.
   - Runs per breakpoint (desktop/tablet/mobile) since reflow/contrast can differ.

**Acceptance:** `audit-a11y.mjs` on a known-bad page reports the expected violations
with selectors; on a clean page reports none.

---

## Phase 4 — Sustain (keep iterations in scope)

### 4.1 Persistent "Accessibility" badge (reuse ImageCredits)

A second preview badge, **directly modeled on `ImageCredits.tsx`** (local-dev only,
excluded from capture/export):
- Shows AA status: green ✓ when clean, or a count when issues exist.
- **Click to audit** (the exact pattern already built): pin a list of issues and
  **outline each offending element** in the design (low-contrast text, missing-`alt`
  images, unfocusable controls) so the designer sees precisely what to fix. Click
  again to turn off.
- Data source: the Phase 3 audit JSON, surfaced to the renderer (written to a
  `public/` artifact the badge fetches, mirroring `credits.json`, or pushed over IPC).

### 4.2 Post-turn audit hook

In `shell.js` `onAgentEvent` `result` (where the preview already reveals + design
state re-checks): when AA mode is on, **re-run the audit** for the current design and
(a) update the badge, (b) if the turn *introduced* a regression, surface a plain-
language line in chat ("that color tweak dropped the hero text to 3.2:1 — want me to
fix it?"). Optionally offer an auto-fix turn.

### 4.3 Opt-in "AA mode" toggle (Claude Settings)

Mirror the images/research toggles: a global (and optionally per-variation) setting →
`process.env.TA_DESIGN_A11Y = "aa" | "off"`. When `aa`:
- The `/design` AA rules (Phase 2) are in force and reinforced.
- `apply-brand` enforcement (Phase 1) is always on regardless (it's cheap + safe), but
  the toggle governs the *ongoing* audit + badge + per-turn hook so users who don't
  need it aren't nagged.

**Acceptance:** with AA mode on, a design turn that regresses contrast produces a chat
warning + the badge reflects it; toggling off silences the ongoing audit (tokens stay
safe).

---

## Phase 5 — Handoff & the human layer

- **Figma export annotations:** carry the contrast readouts + semantic roles into the
  export (a note per block / a "contrast" frame) so devs inherit the intent and it
  doesn't erode downstream.
- **Human checklist:** the ~two-thirds automation can't verify, surfaced at handoff
  (in the closing summary and/or a `docs/a11y-checklist.md` per project): meaningful
  `alt`, reading order, descriptive links, form error messaging, media captions,
  language attribute, page titles. Present as a short, checkable list, not prose.

---

## 6. Contrast math reference

- **Relative luminance:** for sRGB channel `c∈[0,1]`, `c_lin = c/12.92 if c ≤ 0.03928
  else ((c+0.055)/1.055)^2.4`; `L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin`.
- **Ratio:** `(L_light + 0.05)/(L_dark + 0.05)` → 1..21.
- **AA thresholds:** normal text **4.5:1**; large text (≥ 24px, or ≥ 18.66px bold)
  **3:1**; non-text UI/graphics **3:1** (1.4.11). (AAA = 7:1 / 4.5:1 — possible future
  "AAA option.")

## 7. Product framing (claims)

Say **"Designs built to WCAG 2.1 AA, automatically audited, with a handoff checklist
for the human-judgment criteria."** Avoid "508 certified" / "guaranteed compliant."
Keep an auditable trail (the badge + audit JSON + provenance notes) as the evidence.

## 8. Open questions

- **Which color to nudge for links (P7/P8)** vs. mandating underline — pick a default
  Δ-threshold; expose as a knob?
- **Promote explicit on-color tokens** (`--ta-on-*`) or keep implicit via
  `body`/`ink`? (Affects component churn.)
- **Audit cost/cadence:** every turn vs. debounced vs. on-demand — the axe run is a
  full page load per breakpoint (like the capture step).
- **AAA option** as a stretch mode?
- **Per-variation** AA mode (like research) or global-only to start?

## 9. Dependency order

**P1 (contrast tokens) → P2 (authoring rules) → P3 (audit engine) → P4 (badge + hook +
toggle) → P5 (handoff).** P1 alone delivers most of the value (compliant-by-
construction color); P3 unlocks P4. Each phase is shippable on its own.
