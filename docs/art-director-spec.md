# Art Director — spec

An on-demand, **read-only** design review the designer *confers with* after a design
comes back. It never edits, never blocks, never overrides the designer's intent — it
returns findings the designer decides whether to act on. A reference tool, not a gate.

Distinct from the builder: the chat/build agent has the "seasoned designer, confident
curiosity" persona (agent.mjs). The Art Director is a **separate role** — a critic with
its own standards-focused voice — because the one who built a design is the wrong one to
grade it.

## The two layers (both built)

1. **Deterministic lint (phase 1).** Zero model tokens: pure fs + regex + a contrast
   engine (`desktop/artdirector.cjs`). Checks a variation's own files against the codified
   `/design` rules and its palette against WCAG AA. Fast, free, runs on every confer.
2. **Model critique (phase 2).** One READ-ONLY review turn with its own "Art Director"
   persona (`ART_DIRECTOR_PERSONA` in `agent.mjs`), for the judgment a lint can't make:
   hierarchy, balance, rhythm, type, palette harmony, "does this read as the intended
   direction." Cites the phase-1 findings as its factual backbone. The one part that
   spends a turn.

### Phase 2 mechanics

A confer runs both in sequence: the lint report renders instantly, then the critique
streams below it. The critique is a `reviewMode` turn threaded shell→preload→main→
`runPrompt`, which for that turn:
- swaps `CHAT_PERSONA` (+ copy voice) for `ART_DIRECTOR_PERSONA` — a critic, not the builder;
- restricts tools to READ-ONLY (`Read`/`Grep`/`Glob`/`WebFetch`/`WebSearch`) — no
  Write/Edit/Bash/MCP, so it physically cannot change the design;
- runs in a **fresh, isolated session** (never the chat session) — so its persona applies
  cleanly and the builder's history can't bias the read, and the next chat turn is unaffected.

The prompt (`buildArtDirectorCritiquePrompt`) points it at the variation's files + hands it
the lint findings as established fact. It leaves the live preview on screen (a review builds
nothing).

## Scope (decided)

- **Trigger:** a "Confer with Art Director" button on the **variation card** (per design,
  on-demand, only once the design is built). Mirrors the reroll card→shell bridge.
- **Findings surface:** the **chat pane** — the lint report, then the streaming critique.
- Phase 1 (deterministic lint) shipped first; phase 2 (the model critique) followed and
  now runs right after the lint on the same confer.

## Flow (v1)

```
VariationCard button → window.postMessage({type:"ta-artdirector", variationId})
  → preview-inspect.cjs → ipcRenderer.sendToHost("artdirector:request", id)
  → shell.js channel handler → reviewDesign(id)
  → window.desktop.reviewDesign(id) → main "artdirector:review"
  → artdirector.cjs reviewVariation(project, id) → { findings, counts }
  → shell.js formatArtDirectorReport → addMsg (chat)
```

Read-only throughout: no file is written, nothing is applied. Fixes are always a
separate, designer-initiated action.

## The deterministic checks (`desktop/artdirector.cjs`)

Reads the variation's own `components/*.tsx` (falling back to base only if it has none)
and its resolved `--ta-*` palette (variation `tokens.css` over base).

| rule | severity | what it flags |
|---|---|---|
| `tokens-only` | review | raw hex in arbitrary utilities (`text-[#…]`, `from-[#…]`), `rgb/rgba(...)`, hardcoded hex in inline `style` — should be `--ta-*` utilities / `color-mix` / `from-ta-ink/NN` |
| `container-queries` | review | viewport units (`vh/vw/dvh/svh`, `min-h-screen`, `w-screen`) and viewport breakpoint variants (`sm:`/`md:`/`lg:`…, not `@`-prefixed) — should be `@sm:`/`@lg:` + `cqi`/`min-h-full` |
| `font-relative-measure` | note | `max-w-[Nch|em]` — verify it's on the text element, not a font-less wrapper (the "heading stacks" trap) |
| `block-markers` | note | a file with `<section>` but zero `data-block` markers (needed for the Figma export) |
| `contrast-aa` | review / high | `--ta-ink|body|muted` on `--ta-surface` below AA 4.5:1 (`review`), or below 3:1 (`high`) |

Findings are ranked high → review → note. Severities are **advisory labels**, not errors.

## Division of labour

The lint is factual (rules + math). Everything requiring taste — is the hierarchy clear,
is the palette carrying the mood, is the composition balanced — is the model critique. The
lint grounds the critique (handed in as fact) so the model spends its turn on judgment, not
on re-deriving what a regex already knows.

## Phase 3 — acting on the review (SPEC ONLY, not built)

Deferred until after the initial-development close-out. Goal: make it **easy to act** on the
review (per-suggestion and all-at-once) without breaking the Art Director's read-only,
advisory nature.

### Non-negotiable principle

**The Art Director never edits.** Applying a suggestion is a SEPARATE, designer-initiated
**builder** turn (the normal edit agent, full tools, builder persona) — not the review turn.
This preserves independence ("advisory, never overrides"): the critic proposes, the designer
chooses, the builder executes. Phase 2's `reviewMode` stays read-only; Phase 3 adds an
*apply* path that runs a plain edit turn.

### 1. Structured suggestions

Today the critique is prose and the lint is structured. Phase 3 makes BOTH emit actionable
**suggestion objects** the renderer can put a button on. The critique turn emits them via a
read-only structured-output tool (the intake-cards pattern: an SDK MCP `suggest` tool the
review agent calls — allowed even in `reviewMode` because it only returns data, never edits),
while still streaming its prose read. Each suggestion:

```
{ id, title, why, kind: "code" | "asset" | "decision",
  targets: ["Home.tsx:250", …], apply?: "<precise, self-contained edit instruction>",
  effort?: "small" | "medium" }
```

`apply` is present only for `kind: "code"`. The review agent just read the design, so it is
well-placed to write a precise instruction the builder can run without re-analyzing. The
Phase-1 lint findings are already structured; the code-actionable ones (move a `max-w`, nudge
`--ta-muted`, tokenize a raw hex) get an `apply` too and become cards in the same list.

### 2. The three kinds (this is why one-click isn't uniform)

Drawn straight from a real review:

- **code** — the builder can execute: band a section in `bg-ta-primary`, step up the Spotlight
  heading, pair a serif into `--ta-font-serif` and use it, nudge `--ta-muted` → `#6F6656`, lift
  the hero Boomerang's contrast. → **[Apply]**.
- **asset** — needs a new/replacement file the builder can't source (no headless browser):
  `boards.jpg` is Hawaii, `pier.jpg` is low quality, the hero is the wrong temperature. → a
  **"needs an asset"** tag; ideally wired to the reference/image upload so the designer drops a
  replacement in.
- **decision** — a human/client call: the merchandising gap (no product photos). → an
  informational **"your call"** tag, never a button.

### 3. Rendering + apply

- Suggestion **cards in the chat pane** (interactive-in-chat, like intake cards): title + why +
  target(s); `code` → **[Apply]**, `asset`/`decision` → a labeled tag.
- **[Apply]** → one scoped **builder** edit turn: `runAgent(apply, …)` in normal edit mode
  (NOT `reviewMode`), reusing the lean-edit path, scoped to this variation's files, then
  re-preview. Card collapses to **✓ Applied**.
- **[Apply all code fixes]** → the `code` suggestions. Default **sequential** (one edit turn
  each — safer, per-item git diffs, matches the mental model) with a batched option later.
- **Close the loop:** after applying, offer **[Re-confer]** to re-run the review and confirm the
  change landed without regressing.

### 4. Cost

Critique turn ≈ Phase 2 (structured output is ~free on top). Each **[Apply]** = one builder
edit turn (~an edit). **Apply-all** = N edits (sequential) or one (batched). Acting spends
builder turns, as expected — the review itself stays one turn.

### 5. Build-time surface

- `agent.mjs`: a read-only `suggest` MCP tool for the review turn + a suggestion schema
  (mirror `intake/cards.cjs`); `reviewMode` allows that one tool.
- `shell.js`: render suggestion cards + Apply / Apply-all / Re-confer handlers → `runAgent`
  in edit mode.
- Phase-1 lint findings gain an `apply` on the code-actionable rules.
- No new persona for apply — it is the normal builder.

### 6. Open Phase-3 decisions

- **Apply-all:** sequential (default) vs batched-into-one-turn.
- **Asset routing:** do `asset` cards hand off to the reference/image upload flow, or just name
  the gap?
- **Safety/undo:** each apply is a git-diffable change (the designer's git is the net); consider
  a snapshot before Apply-all.
- **Session:** apply in the chat edit session vs a fresh one (the lean-edit boundary already
  exists).

## Open decisions (phases 1–2)

- **Licensing:** currently ungated. The confer now spends a turn (phase 2), so gating it
  behind the Research/design-variety license tier — or a per-confer opt-in for the critique
  — is the main open call.
- **Independence via a screenshot:** phase 2 reads the source; a future pass could also
  hand it the `?capture=` screenshot so it judges the rendered pixels, not just the code.
- **Distribution:** the lint engine + wiring are app-side (immediate for every project).
  The card button is scaffold-side (`VariationCard.tsx`) — reaches existing projects only
  via `/upgrade`, same as the other card controls.
