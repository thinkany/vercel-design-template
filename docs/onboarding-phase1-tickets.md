# Phase 1 tickets — the seam + spine

Implements Phase 1 of [onboarding-intake-spec.md](./onboarding-intake-spec.md): the shared
foundation both intake flows and every deliverable type build on. No flow is "finished" here; the
goal is a working end-to-end spine (click a start option, run an agent-driven card or two in the
pane, produce a Brief) that later phases fill in.

**Dependency order:** T1 → T2 → (T3 ∥ T4) → T5. T1 and T2 can start together.

**Out of scope for Phase 1** (later phases): the Client Setup wall-of-choices form (P3), building the
real design from the Brief (P2, reuses the `/design-brief` brain), the non-page deliverable renderers
(P4), and deep adaptivity. Phase 1 only proves the spine and that the seam will not lock us in.

---

## T1 — Brief schema + deliverable-type registry (data model)

The shared data both flows produce and the registry that keeps us un-locked-in. Pure data + helpers,
no UI, no agent.

**Build**
- New `desktop/intake/brief.cjs`:
  - `createEmptyBrief(deliverableType)` returns the Brief with every field `null`/empty (null means
    "agent decides").
  - Brief fields: `deliverableType`, `what` (free text), `audience` (string[]), `references`
    (`{url, reason}[]`), `colorSources` (`{kind, value, reason}[]`), `fontIntent`, `sections`
    (string[]), `variationAxes` (string[]), `existingCode`, `tone`, `deviceTargets` (string[]).
  - `applyAnswers(brief, answersByCardId)` folds a card-answer payload into the Brief (mapping card
    ids to fields).
- New `desktop/intake/deliverables.cjs`: a registry keyed by type id, each
  `{ id, label, description, comingSoon, outputRenderer, intakeHints }`.
  - `web-pages`: real (`outputRenderer: "preview"`, `comingSoon: false`), plus its `intakeHints`
    (the field set + suggested card order the agent leans on).
  - `wireframe`, `flow-diagram`, `brand-guideline`: stubs (`comingSoon: true`, `outputRenderer:
    null`). They exist so the "what are we making" fork and the seam are exercised.
  - `deliverableOptions()` derives the "what are we making" choices from the registry (built ones
    selectable, stubs shown but flagged "coming soon").

**Acceptance**
- `node -e` can create an empty Brief, apply a sample answer payload, and read back the field.
- The registry lists 1 built + 3 stub types; `deliverableOptions()` reflects that.

**Files:** `desktop/intake/brief.cjs`, `desktop/intake/deliverables.cjs`. **Deps:** none.

---

## T2 — Intake protocol: card schema + the agent tool + routing

The new core piece: a typed channel so the agent (not a static form) drives a rich intake. Extends
the existing `agent:ask` / `pendingAsks` / `agent:answer` bridge (`main.cjs` ~688-780, `agent.mjs`
`askQuestion`) with a richer schema, because the SDK's `AskUserQuestion` is multiple-choice only.

**Build**
- Card schema (in `desktop/intake/cards.cjs`): a `CardSpec` = `{ id, type, label, help?,
  placeholder?, options?, skippable, agentDecidesLabel? }`. Types for Phase 1: `open-text`
  (short/long), `single-choice`, `multi-choice`, `chips`, `reference` (url + why). Include a
  validator `isValidCardSpec(card)` so bad agent output fails loud, not silent.
- Agent-facing tool `intake({ cards: CardSpec[] })` returning `{ answers: { [cardId]: value } }`.
  Decide the mechanism during this ticket: either an **in-process MCP tool** registered in
  `agent.mjs`, or intercepting a named tool in `canUseTool` (same path `askQuestion` uses). Prefer
  whichever keeps the answer round-trip synchronous to the agent turn.
- Routing in `main.cjs`: a `pendingIntakes` Map mirroring `pendingAsks`. On tool call, validate the
  cards, `event.sender.send("agent:intake", { id, cards })`, await `agent:intakeAnswer`
  (`{ id, answers }`), resolve the tool result. Reject/timeout handling like `agent:cancelAsk`.
- `preload.cjs`: `onAgentIntake(cb)` (subscribe) + `answerIntake(id, answers)` (invoke
  `agent:intakeAnswer`).

**Acceptance**
- A test prompt makes the agent call `intake` with one card; `main` routes it out and a temporary
  console responder returns a canned answer; the agent receives `{ answers }` and continues.
- An invalid card spec is rejected with a clear error (does not hang the turn).

**Files:** `agent.mjs`, `main.cjs`, `preload.cjs`, `desktop/intake/cards.cjs`. **Deps:** T1 (loose).

---

## T3 — Pane intake-mode host (the big-pane container)

The big pane gains an **intake** mode that hosts the card flow before the live deliverable, so the
conversation happens in the pane, not the chat. The pane is the deliverable-surface host from the
spec; this ticket is its intake face + the mode plumbing.

**Build**
- A host surface inside the preview area (`#views` region / a sibling shown over it, like
  `#previewph`). Styled as a centered card column matching the app's visual language (the reference
  screenshot): a title/lead, a scrollable stack of cards, generous spacing.
- Mode plumbing: extend the stage system (`showStage`, currently `key`/`project`/`workspace`) with an
  `intake` mode, or a workspace sub-mode that swaps the pane between intake and the deliverable
  renderer. The chat rail stays docked throughout.
- Host controller (`shell.js`): holds the active card list, appends cards progressively (Get
  Designing) or in a batch (later, Client Setup), owns the per-card skip affordance and a
  "continue"/submit control, and signals when the flow is done so the pane can swap to the
  deliverable renderer. Subscribes to `onAgentIntake`, delegates each card to a renderer (T4),
  collects answers, calls `answerIntake`.

**Acceptance**
- Entering intake mode shows the host in the pane with a lead + an empty card stack (placeholder card
  ok until T4).
- An `agent:intake` event appends its card(s) to the stack; submitting posts answers back via
  `answerIntake`.

**Files:** `shell.html` (markup + CSS), `shell.js` (host controller + stage), `main.cjs` (stage
signal if needed). **Deps:** T2.

---

## T4 — Card renderers (first card types)

The visual card components, the part that makes the intake feel like the screenshot rather than a
form dump. Implement enough types for the vertical slice and to prove the protocol.

**Build (in `shell.js`, styled in `shell.html`)**
- Renderers for: `open-text` (short input + long textarea with the "236 / 400"-style counter),
  `multi-choice` (bordered checkbox rows, the surfaces pattern), `chips` (compact multi-select, the
  screens pattern), `reference` (a url field + a "what do you like about it?" why field).
- Each renderer: renders the `CardSpec`, exposes its current value, honors `skippable` (a skip
  affordance that records `null`), and reports value/skip up to the host.
- Visual language consistent with the app (reuse tokens/classes where sensible; the drawers and the
  reference screenshot are the north star).

**Acceptance**
- The agent emits an `open-text` + a `chips` + a `reference` card; all three render cleanly in the
  pane; skip records `null`; submitted values reach the host and fold into the Brief (via T1
  `applyAnswers`).

**Files:** `shell.js`, `shell.html`. **Deps:** T3, T2, T1.

---

## T5 — Get Designing vertical slice (web pages, build stubbed)

Thread the whole spine end-to-end for the one built deliverable type, proving click-to-Brief works.
Build itself stays stubbed (Phase 2 reuses `/design-brief`).

**Build**
- Rewire the "Get Designing" start option (`renderWelcomeChips` → `enterDesignBriefMode`) to enter
  the pane intake mode instead of the chat brief flow.
- Minimal agent instructions (a Get-Designing skill/command, or an addition to the design-brief
  brain) telling the agent to drive intake via the `intake` tool: lead with the "what" (`open-text`),
  then one adaptive follow-up (`chips` sections or a `reference` card), then assemble the Brief.
- Assemble answers into a Brief (`applyAnswers`) and hand it to a **stubbed** build step that just
  surfaces the assembled Brief (e.g. a summary card + a chat line), so the round trip is verifiable
  without building the design yet.

**Acceptance**
- Clicking Get Designing opens the pane intake; a 2-3 card agent-driven conversation runs; a
  populated Brief is produced and shown. No design is built yet (that is Phase 2), but the spine,
  entry → pane intake → agent cards → Brief, works end to end for web pages.

**Files:** `shell.js`, the agent instructions, `main.cjs` (stub build hand-off). **Deps:** T1-T4.

---

## After Phase 1
With the spine proven: **P2** swaps the stubbed build for the real `/design-brief` build (Brief →
design → pane preview → chat iteration). **P3** adds the Client Setup batched form over the same
protocol/Brief. **P4** registers a real second deliverable type (wireframe) end to end to exercise
the seam.
