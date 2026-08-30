# Quiet-build narration — Art Director "behind the scenes" — spec

**Status:** SPEC'd + BUILT (all 3 phases) 2026-08-29 on feature/onboarding-intake
(uncommitted, NOT live-tested). Author: Rob's ask. Lever C gating decision: **default-on +
a "Narrate builds" settings toggle**.
**Where:** electron app quiet build (`desktop/shell.js` narration + preparing pane,
`desktop/copy.js` copy deck, `desktop/shell.html` spine UI, `desktop/agent.mjs` +
`desktop/main.cjs` for the TodoWrite hook and the optional Haiku side-channel).
**Builds on:** [[quiet-build-reveal]] (the `quietBuildActive` flag + `finishQuietBuild`),
[[onboarding-intake-walkthrough]], the section-gated pickers ([[cta-type-picker]],
[[hero-slider-option]]).

## Problem

Get-Designing now hides the chat pane for the whole build (quiet-build-reveal). A build
takes ~5 min, longer with research / hero / menu / contact-form work. During that window
the designer sees only the "preparing" pane with a generic 4.2s message rotation. The long
silent stretches (initial model reasoning before the first tool, and the research step's
minutes of WebFetch/Bash) read as "something's broken." We want the pane to narrate what's
happening in a seasoned **Art Director voice**, and to feel like *progress through a known
plan* rather than an open-ended wait.

## What already exists (the lift is small)

- The agent event stream keeps flowing in quiet mode. `text` + `tool` bubbles are
  suppressed ([shell.js](../desktop/shell.js) `onAgentEvent`), but **`activity` events are
  not**: every completed tool call fires `friendlyActivity(name, target)` →
  `setWorkingMessage()`, overwriting the pane text (shell.js ~3143).
- Two real milestones are already detectable in quiet mode with zero new wiring: each
  tool's `activity` (name + file/command target), and the **`previewReady` flip**
  (foundations/styleguide ready) which is the natural build midpoint (shell.js ~3121).
- The preparing pane: `#ph-emoji`, `#ph-title`, `#ph-text`, and `#ph-progress` (an
  indeterminate bounce bar) in [shell.html](../desktop/shell.html).
- `@anthropic-ai/sdk` is installed with a direct-call precedent: `ingest.cjs` `visionPass`
  does `new Anthropic()` + `client.messages.create({ model, ... })`. So a cheap Haiku
  side-channel is straightforward.

So this is "enrich channels that already run in quiet mode," not "build a channel."

## The three levers (all shipped together, staged)

**A — Art-Director copy deck.** Rewrite the pane copy from "We're laying out your page…"
to a seasoned AD register, organized per build phase (below). Pure copy; the foundation
for B and C.

**B — Progress spine + Brief specificity (the anxiety-killer, zero token cost).** Derive
an ordered phase list from the Brief at build start and show a determinate stepper
("Step 3 of 7 · The hero") that advances on real signals; fill AD lines with the
designer's actual choices (their palette, the site they liked, the hero they picked).

**C — Live Haiku narration (optional delight).** At each phase change, a cheap Haiku call
in main generates ONE bespoke AD sentence seeded with the phase + Brief, layered over B's
curated line. Fully decoupled from the build agent; never blocks it.

---

## The phase model (spine)

At build start, `startDesigning()` computes an ordered list of phases from `lastBrief`.
Canonical phases (id, title, emoji, slow?):

| id | title | emoji | included when | slow |
|----|-------|-------|---------------|------|
| `understanding` | Reading your brief | 📖 | always (first) | — |
| `research` | Studying comparable sites | 🔍 | `researchActive` | **yes** |
| `foundations` | Setting the palette & type | 🎨 | always | — |
| `header` | The header & navigation | 🧭 | website (has `menuLayout` or projectType website) | — |
| `hero` | The hero | ✨ | sections include hero / `heroLayout` set | — |
| `sections` | The page sections | 🏗️ | always | — |
| `contact` | The contact section | ✉️ | `ctaType` set or Contact/CTA in sections | — |
| `polish` | Polish & responsive | 🪄 | always (last) | — |

`M` = the count of included phases; the stepper shows "Step N of M". The **`previewReady`
flip is the anchor**: it marks `foundations` complete (everything before = "setting up,"
after = "designing the page"). Ordering note: research grounds the design, so it runs
early (before/around foundations) per `/design-brief`; place `research` before
`foundations` in the list.

### Phase advancement signals (priority order)

1. **TodoWrite (authoritative, Phase 2 hook).** The `/design` build is TodoWrite-driven;
   the in-progress todo's `activeForm` maps to a phase (keyword match). This is the precise
   driver.
2. **`previewReady` flip.** Advances the spine to the `foundations`→page boundary. Already
   detected in quiet mode.
3. **Tool-activity keywords (fallback, works today).** Extend the `friendlyActivity`
   target-matching into a `phaseForActivity(name, target)`: `brand.ts|tokens.css|fonts.css`
   → foundations; `curl|WebFetch` in the research window → research; `Header.tsx` → header;
   `Home.tsx`/hero markers → hero/sections; contact-form markers → contact; etc.

The spine never moves backward: a signal can only advance `N` (max of current and mapped).
So sparse or out-of-order todos can't make it regress.

### Pacing (v2, after live feedback)

Signals arrive in bursts and don't track wall-clock, so the display is decoupled from them:
a signal only bumps a **target** index; a ~300ms **ticker** walks the **shown** phase toward
target one step at a time, holding each for a **minimum dwell (~2.6s)**. Multi-step jumps
therefore read as a smooth walk, and no phase flashes. Once settled (shown === target), the
message line rotates slowly (**~22s**, was 5s — it felt too quick). Haiku is requested only
for the settled phase, not for steps merely walked through. On completion, `finish()` walks
briskly through any remaining steps (~260ms each), fills every segment, holds a ~500ms "done"
beat, then clears — so the last phase actually registers before the reveal. The wide
indeterminate bounce bar is removed during the build; the segmented step bar (with an
intra-phase shimmer on the active segment) is the only progress affordance.

---

## Copy deck (Art-Director voice)

A new `COPY.build` catalog keyed by phase id. Each entry:

```js
{
  title: "The hero",                    // → #ph-title (may template {heroWord})
  lines: [ /* 1–3 progress-neutral AD lines, rotated ~5s */ ],
  slowLine: "…",                        // extra reassurance shown for slow phases (research)
}
```

Lines are **progress-neutral** (no "almost done") and may reference Brief tokens (below).
Voice: a seasoned art director thinking aloud to a client, warm, specific, unhurried,
confident. Example lines:

- foundations: "Mixing your palette now — that {paletteWord} is going to set the whole mood."
- research: "Pulling up the best sites in your space to see what the bar looks like. This
  is the slow, worthwhile part." (`slowLine`)
- hero: "Blocking in the {heroWord} hero, giving the headline room to breathe."
- contact: "Wiring the contact form so it feels effortless to reach you."
- polish: "Tightening the spacing and making sure it sings on every screen."

**No em-dashes** in any line (house rule) — the examples above use them for readability
here only; the shipped copy uses commas/colons/periods.

### Brief specificity (free, all levers)

Helper `briefBits(lastBrief)` → the tokens the copy interpolates, each with a safe generic
fallback so a sparse brief still reads well:

- `paletteWord` — from `colorSources` (e.g. "cream and ink"), else "palette".
- `fontWords` — from `fontSources`, else "type".
- `heroWord` — `HERO_LAYOUT_TITLE[heroLayout]` lowercased (e.g. "split"), else "".
- `refName` — a hostname from `references[0]` (e.g. "Aesop's site"), else "".
- `sectionCount` / `sectionsWord` — from `sections`.

Specific detail is what sells "this is really building *my* thing," and it costs nothing.

---

## Progress spine UI (shell.html + shell.js)

Replace the single indeterminate bounce bar in the preparing pane with a determinate spine:

- **Segmented bar**: `M` segments, `N` filled (filled = `--admin` ink; pending = track).
  Reuse `#ph-progress`; add `.ph-steps` segments. Keep a subtle intra-phase shimmer on the
  active segment so a long phase still shows motion.
- **Step label**: a small "Step N of M" line above/below `#ph-title`.
- `#ph-emoji` = the active phase emoji (swaps per phase).
- `#ph-title` = phase title; `#ph-text` = the AD line (curated, or Haiku when present).

A renderer module `buildNarration` owns spine state: `begin(phaseList)`, `advanceTo(id)`,
`tick()` (rotate the current phase's lines), `end()`. Wired from `showPreparing()` /
`startDesigning()` and the `onAgentEvent` quiet-build branch. Scoped to `quietBuildActive`;
setup / edit / reroll placeholders keep today's `friendlyActivity` behavior untouched.

---

## Lever C — live Haiku narration (optional layer)

On each phase change, the renderer asks main for a bespoke line; main runs a fire-and-forget
Haiku call and streams the result back as a `narration` event → `setWorkingMessage`.

- **IPC**: `narrate:line({ phase, briefBits, recentLines })` → main. Main uses
  `@anthropic-ai/sdk` (`new Anthropic()`, key already in env) with
  `model: "claude-haiku-4-5-20251001"`, ~40-token cap, temperature ~1.
- **System prompt**: "You are a seasoned art director narrating a live website build to the
  client. Reply with ONE warm, specific, present-tense sentence about the phase below. No
  em-dashes. No preamble." **User**: the phase title + `briefBits` (their references,
  palette, fonts, hero, sections) + `recentLines` to avoid repeats.
- **Guardrails**: ~4s timeout; on timeout/error the curated Lever-B line stays (Haiku is
  additive, never a dependency). One call per phase (≈5–8/build). Runs in main, never
  touches the build agent's session, never blocks the build.
- **Gating**: default ON (Haiku cost is negligible), with a settings toggle
  ("Narrate builds") to disable. Consider tying default-on to licensed users — see open Qs.

---

## Data flow (summary)

1. `startDesigning()`: compute `phaseList` from `lastBrief`; `buildNarration.begin(phaseList)`;
   enter quiet build; `showPreparing()` renders the spine.
2. `agent.mjs` emits `text`(suppressed) / `tool`(suppressed) / `activity` / `todo`(new) /
   `result`.
3. shell.js quiet-build branch: `activity` + `todo` + `previewReady` → `phaseForX()` →
   `buildNarration.advanceTo(id)`; sets the curated AD line (B). On phase change, optionally
   `narrate:line` (C) → `narration` event → line swap.
4. `result` / `error` → `finishQuietBuild()` reveals both tabs (unchanged).

---

## Build phases (implementation order)

- **Phase 1 (A + B core).** `COPY.build` deck + `briefBits()` + phase-model
  (`computePhaseList`, `phaseForActivity`) + `buildNarration` spine module + spine UI in
  shell.html + wire into the quiet-build `onAgentEvent` branch using the signals that
  already flow (`activity`, `previewReady`). No agent.mjs change. Ship + live-test.
- **Phase 2 (B precise).** TodoWrite hook: `agent.mjs` emits `{ type: "todo", todos }` from
  the assistant block loop when `block.name === "TodoWrite"`; shell.js maps the in-progress
  todo → phase (authoritative advance).
- **Phase 3 (C).** `narrate:line` IPC + Haiku call in main + `narration` event + settings
  toggle.

---

## Scope / isolation

- Everything gated on `quietBuildActive` (the Get-Designing build). Setup, edit, and reroll
  flows keep the current `friendlyActivity`/`workingMessages` behavior.
- Lever A's deck is a NEW `COPY.build` namespace; the existing `preview.workingMessages` /
  `preview.buildMessages` / `preview.preparingMessages` stay for their current
  (non-quiet) uses.
- Distribution: this is app-shell only (no scaffold/template change), so no template
  refresh needed. Cards/main/preload edits need a FULL app restart; scaffold untouched.

## Open questions for build kickoff

1. **Progress bar**: determinate segmented spine (recommended, core to the fix) vs keep the
   indeterminate bar. Spec assumes determinate.
2. **Lever C default**: always-on (tiny Haiku cost) vs licensed-only vs off-by-default
   setting. Spec assumes default-on + a toggle.
3. **Research phase honesty**: how explicit to be that research is the slow part (spec leans
   into it via `slowLine`).
4. **Emoji swap vs fixed ✨**: spec swaps the emoji per phase for extra "we moved" signal.

## Related

- [[quiet-build-reveal]] — the flag + reveal this narrates inside of.
- [[onboarding-intake-walkthrough]] — the intake that fills the Brief the narration reads.
- [[design-variety-cloud-move]] — `direction` is another Brief field the copy can name.
