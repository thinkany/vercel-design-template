# Spec: In-pane onboarding — two intake flows over one brief engine

**Status:** draft / plan of record
**Date:** 2026-08-06
**Where it lands:** the Electron app (`electron` branch, `desktop/`) for the intake UI + the
agent intake channel; the design agent (the `/design-brief` brain, scaffold side) for consuming
the brief and building. Not the template scaffold's runtime output.
**Origin:** Rob wants the project-start experience to move out of the narrow chat column into the
large pane, and to proactively surface web-design choices a designer might not think to raise
(inspired by Claude's design intake).

## 1. Goal

Turn project start into a **large-pane experience** that reads like a sharp creative director
taking a brief: it leads with intent, surfaces the choices a designer would not think to ask for,
stays low-friction, and hands a structured brief to the agent, which then builds and fills the
gaps. The chat stops being the intake surface and becomes the **post-build iteration** surface.

The whole thing is built so it does **not** lock us into "designed web pages." Pages ship first;
**wireframes, content-flow diagrams, and brand guidelines** are future deliverable types that plug
into the same seam.

## 2. The entry fork (kept, moved to the pane)

The existing "**How would you like to start?**" fork stays. Today it is a card in the chat
(`renderWelcomeChips`) with two options that both then run *in the chat*. Both move into the big
pane as first-class experiences:

- **Get Designing** — the **conversation**. Agent-led, progressive, adaptive. For the design-centric
  person who wants to explain and be guided.
- **Client Setup** — the **wall of choices**. A rich, single-surface structured form. For the person
  who would rather specify methodically.

Two front doors, **one brief, one build**. The difference is intake *style*, not outcome. A user
can start either way and reach the same designed result.

## 3. The shared spine

Everything downstream of the fork is shared, which is what keeps two flows from becoming two
codebases.

### 3.1 The deliverable-surface abstraction (the extensibility seam)
The big pane is **not** hardwired as "the live web preview." It is a **deliverable surface** host
that renders whatever the current deliverable type produces:
- **Shared** across all types: the pane host, the intake protocol (Section 5), the brief object,
  the agent hand-off, the chat-takes-over-after step.
- **Per type**: its intake fields, and its **output renderer**.

A deliverable type registers `{ id, label, intakeBranch, outputRenderer }`. Today one type is
built (**web pages** → the existing `DesignSurface` preview). Adding **wireframe**, **flow
diagram**, or **brand guideline** later is a new registration (its fields + its renderer), not a
re-architecture. The **first question of every intake is "what are we making,"** which selects the
deliverable type and therefore the branch.

### 3.2 The Brief (what both flows produce)
Both intake flows compile to one structured **Brief** object, the same shape `/design-brief`
already consumes (extended): deliverable type, the "what" (free text), audience, brand references
**with the reason** (see 4.3), color source(s), font intent, sections/screens, variation axes,
existing-code pointer, tone, device targets. Unanswered fields are explicitly `null` so the agent
knows to decide them ("skip anything and I'll decide").

### 3.3 The pipeline
`Entry fork → intake in the pane → Brief → agent builds → pane flips to the live deliverable →
chat becomes iteration.` The **company/agency layer** (the reusable identity: company name,
admin/gate fonts, logo, the company profile) sits **orthogonal** to this, it is a one-time,
reusable thing and must not be re-asked per project. It stays where it is (a small step / the
saved company profile), not folded into the per-project intake.

## 4. Flow A — Get Designing (conversation)

Agent-led, adaptive, rendered as a progressive card conversation in the pane. It is **not** a form
dumped all at once.

### 4.1 Shape
1. **Open with the "what."** A single open prompt: what are you making, tell me about it. (Also
   selects/infers the deliverable type.)
2. **Sprinkle the considerations** as smart follow-ups, adaptively, based on what was said:
   color, fonts, "any sites you love, and why," audience, the sections it needs, where to vary.
3. **Skippable throughout.** Skipping a card records `null` and the agent decides later.
4. When enough is known, the agent proceeds to build; remaining gaps become chat follow-ups.

### 4.2 Adaptive from day one (Rob's call)
The agent chooses the next card from the answers so far (e.g. a "spa-like, breezy" answer skips
asking whether it should feel corporate; a pasted reference URL turns the next card into
"what do you like about it"). This is why the intake must be **agent-emitted** (Section 5), not a
static form.

### 4.3 Capture the "why," not just the reference
Reference sites, color sources, and font sources are captured **with the reason**. The *why* is the
taste. Our `/design-brief` already ingests a reference's layout + palette; the reason lets the agent
extract the *qualities* wanted (warmth, breeziness) rather than clone the site. Reference-plus-reason
is a first-class card type.

## 5. The intake protocol (the new core piece)

Agent adaptivity + rich fields force a **typed intake channel between the agent and the app**,
because the SDK's built-in question tool (`AskUserQuestion`) is **multiple-choice only** — it
cannot render free-text ("tell me about the studio"), swatch pickers, or reference-plus-reason.

- **Emission:** the agent calls an app-provided intake tool with a **card spec** (one card, or a
  small batch). The app renders it in the pane and returns the answer(s), so the agent can adapt
  the next card. This extends the existing `agent:ask` / `pendingAsks` bridge with a richer schema.
- **Card types (initial):** `open-text` (short + long), `single-choice`, `multi-choice` (checkbox
  list), `chips` (compact multi-select), `segmented` (single, e.g. Static / Clickable / Both),
  `color-source` (URL / paste / swatch), `reference` (URL + a "why" field), `note` (agent aside).
  Every card carries `skippable` and an optional `agentDecidesLabel`.
- **Rendering:** progressive (cards appear as the conversation advances) for Get Designing; the
  same card types can render as one batched surface for Client Setup (Section 6).
- **Return:** answers post back as a structured payload keyed to the card ids, folded into the Brief.

This protocol is the shared machinery both flows and all deliverable types use.

## 6. Flow B — Client Setup (wall of choices)

The structured, single-surface rich form (the screenshot's model): all fields visible at once,
opinionated defaults, skippable, methodical. Same card *types* as the protocol (Section 5), just
rendered as **one batched surface** instead of a progressive conversation.

- **Content:** the brand/agency-adjacent client details that `/setup-project` + `/setup-styleguide`
  gather (client name, project type, menu style, client fonts, colors) **plus** the design intent
  (the "what," sections, audience, variation axes). It produces the same Brief.
- **Relationship to today's commands:** Client Setup becomes the pane front-end; the underlying
  `/setup-project` + `/setup-styleguide` logic (writing `.env`, creating v01, tokens/brand.ts) is
  what its answers drive. The company/agency layer is still the reusable one-time step, referenced,
  not re-collected.

## 7. Architecture in the app

- **A new "intake" stage/mode in the big pane.** The shell already stages `key → project →
  workspace`; add an **intake** mode the deliverable-surface host renders (either flow) before the
  live deliverable. Chat stays docked the whole time.
- **The deliverable-surface host** owns: rendering the intake protocol cards, then swapping to the
  active deliverable's **output renderer** (web pages → `DesignSurface`; future types → their own).
- **The intake channel** is the `agent:ask`-style bridge, upgraded to the typed card schema and
  routed to the pane host rather than the chat log.
- **The agent side:** Get Designing runs the `/design-brief` brain, adaptive intake then build.
  Client Setup emits its batched form, collects, then runs setup + styleguide + build. Both end by
  handing the Brief to the same build.

## 8. Web-pages branch first; stub the rest

- **Build fully:** the **web pages** deliverable type, its intake (both flows) and its output
  renderer (the existing preview). This is the differentiation and matches the mōr example.
- **Stub (register, do not build):** `wireframe`, `flow-diagram`, `brand-guideline` as registered
  future types with a placeholder intake branch + renderer, enough to prove the "what are we making"
  fork and the seam hold, so we are not locked in. (`wireframe` ties to the earmarked low-fi mode.)

## 9. Phasing

1. **Seam + spine.** Deliverable-type registry, the Brief schema, the intake protocol skeleton
   (a couple of card types), the pane intake-mode host. Register web-pages; stub the other three.
2. **Get Designing (web pages).** Agent-driven progressive conversation: the "what," the sprinkle
   follow-ups, reference-plus-reason, skip semantics, then build → preview → chat.
3. **Client Setup (web pages).** The batched wall-of-choices surface over the same protocol/Brief;
   wire to the setup + styleguide logic.
4. **Depth.** More card types, richer adaptivity, and register a real **second** deliverable type
   (wireframe) end-to-end to exercise the seam.

## 10. Open questions / risks

- **Protocol expressiveness vs. agent reliability.** The card schema must be rich enough for a
  beautiful intake yet simple enough that the agent emits it reliably. Start small (Section 5 types),
  grow from real use.
- **Keeping Get Designing conversational, not a form.** Adaptivity + progressive reveal is the guard;
  resist the urge to batch it into a wall (that is what Client Setup is for).
- **Company/agency layer placement.** Confirm it stays a separate reusable step and is never
  re-collected inside either flow.
- **How much of `/setup-project` + `/setup-styleguide` Client Setup absorbs** vs. leaves to the
  agent, avoid duplicating that logic; the form should drive it, not reimplement it.
- **Deliverable-surface renderer contract.** Define it now (even with one implementer) so
  wireframe/diagram/brand-guide slot in cleanly later.

## 11. Immediate next step

Turn Phase 1 into implementation tickets: the deliverable-type registry + Brief schema + the intake
protocol's first card types + the pane intake-mode host. Everything else builds on that spine.
