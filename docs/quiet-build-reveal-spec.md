# Quiet build + finished reveal — spec

**Status:** SPEC'd 2026-08-28, not built. Author: Rob's ask.
**Where:** electron app, renderer (`desktop/shell.js` + `shell.html` + `copy.js`),
possibly a turn tag from `desktop/main.cjs`/`agent.mjs`.

## The problem

During the **initial build** (Get Designing → "Looks good, start designing"), the
agent's per-turn chat/tool narration leaks into the UI. Real examples:

> - "A stale file from a prior session, reading it first before overwriting."
> - "Overwriting with the current brief's palette (#1B1B2F)."
> - "No fonts named, so I'll skip --fonts and let template defaults stand."
> - "Fitting the direction's 'neutral UI sans paired with a mono for figures,' picking two fonts myself since none were named."
> - "Fonts and menu are applied. Now saving the brief and design direction into variation.json."

This is internal, technical, and breaks the "magic reveal" feel of a design
appearing. Rob: *"I'd almost prefer limited or no dialog during the initial build.
Maybe just keep the main pane open until the entire build is complete (like a
finished reveal)."*

## Why it happens (current behavior)

- `startDesigning()` (`shell.js:4941`) sets `intakePhase = "designing"` and calls
  **`setChatCollapsed(false)`** — it OPENS the chat for the build ("questions are
  answered → slide the chat open for the build").
- The build is one agent turn (`runAgent` with the `/design-brief` prompt). Its
  streamed assistant text + tool_use render into the now-open chat.
- The **main pane** already shows a clean "preparing" state: `PREPARING_MESSAGES`
  rotating copy + "Getting your site design elements prepared" (`shell.js:4966+`),
  held until `design.previewReady` flips → `showBrowser()` reveals the design
  (`shell.js:647`, `730`).

So the pane is already a reveal; the leak is the **open chat** showing raw narration.

## Goal

For the **initial build only**: no raw agent dialog. The main pane holds the
preparing → finished-reveal, the chat stays out of the way until the design is
done, and iteration afterward starts from a clean slate.

## Proposed design

1. **Keep the chat collapsed for the whole initial-build turn.** In
   `startDesigning()`, do NOT `setChatCollapsed(false)`. Open the chat only AFTER
   the build completes (the reveal), for iteration. The narration then never shows.

2. **Route the build turn's stream away from the visible chat.** Tag the initial
   build turn as a **silent/build turn** (mirror the existing `reviewMode` turn
   flag, `shell.js:6334`, which already routes a turn's output differently). A
   `buildMode` (or `silent: true`) turn: its assistant text + tool_use are NOT
   appended to the visible chat log. Either drop them, or collect them into a
   hidden "build log" (see #5).

3. **Main pane = the only surface during build.** Keep the preparing screen
   (rotating copy + a progress affordance) until `previewReady` → existing reveal.
   Optionally upgrade the rotating copy to **curated, milestone-driven phase
   labels** (e.g. "Setting up the brand → Building sections → Applying type →
   Finishing") derived from build signals, NOT raw tool narration. Default MVP:
   keep the generic rotating copy; curated phases are a follow-up.

4. **Finished reveal.** On `previewReady`/turn-complete: reveal the design in the
   pane (existing `showBrowser()` path), THEN open the chat for iteration.

5. **Post-build transcript = clean.** When the chat opens for iteration, the build
   narration must NOT dump into it. Options (pick one):
   - (a) Discard the build narration from the visible log entirely — the design is
     the artifact (simplest, matches "no dialog").
   - (b) Collapse the whole build turn into ONE summary entry ("Built your design
     — Data/Utilitarian direction, 6 sections") that's expandable on demand for the
     curious. Preferred if we want the work inspectable.

6. **Failures still surface.** Suppression is for routine narration only. If the
   build errors (agent failure, tool error, no previewReady within a timeout), show
   a clear failure state in the pane and/or open the chat with the error — never a
   silent hang. Keep the existing error path visible.

## Scope / non-goals

- **Initial build only.** The EDIT/iteration phase keeps normal chat dialog — that's
  a conversation; this spec is only the first build's reveal.
- Also apply the same silence to the **post-build reroll** build (design-variety
  fork) — it's the same "build a design" moment; reuse the silent-turn flag.
- Renderer-led: chat gating + the preparing/reveal state machine live in `shell.js`.
  The turn tag may need `main.cjs`/`agent.mjs` to accept a `silent` flag on
  `sendPrompt` and skip emitting deltas to the renderer (or the renderer just
  ignores them while `intakePhase === "designing"`). Prefer the renderer-only gate
  if it fully covers it (least surface area).

## Open questions for build kickoff

- Curated phase labels (#3) now, or generic rotating copy for MVP?
- Post-build transcript: discard (5a) vs. collapsed-summary (5b)?
- Do we want a subtle progress bar / % (needs build milestones) or just the spinner
  + rotating copy?

## Related

- [[onboarding-intake-walkthrough]] / [[in-pane-onboarding-intake]] — the preparing
  screen + start-designing choreography this refines.
- `reviewMode` turn flag (`shell.js` ~6334) — the existing pattern for routing a
  turn's output differently; the silent-build flag mirrors it.
