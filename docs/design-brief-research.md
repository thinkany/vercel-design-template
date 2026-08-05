# Design-Brief Research — competitor research as an opt-in enhancement

*Status: spec (not built). Extends [`/design-brief`](../.claude/commands/design-brief.md)
and the Design-from-a-Brief pipeline ([design-from-brief.md](design-from-brief.md)).*

## Summary

When a designer starts from a **brief** ("a booking site for boutique fitness
studios, colors from brandsite.com"), Claude currently extracts colors + fonts and
then models layout from *its own read* of any references. This feature adds an
**opt-in research phase** that studies a handful of comparable sites and distills
them into a **conventions report**, which then *informs* — never dictates — the
section outline and component choices during design.

It is a **toggleable enhancement layer**, not a rewrite. Off = exactly today's
behavior. On = the current process, better-informed.

---

## 1. The on/off contract

Resolution mirrors the app's **Copy Voice** mechanism (`effectiveVoice()`):

| Scope | File | Shape |
|---|---|---|
| **Global default** (app-level, every project) | `userData/design-research.json` | `{ "enabled": false }` |
| **Per-project override** (wins) | `<project>/.thinkany/design-research.json` | `{ "enabled": null \| true \| false }` |

**Effective value:**

```
research = (project.enabled == null) ? global.enabled : project.enabled
```

- Project `null`/absent → **inherit global**.
- Project `true`/`false` → **force**, overriding global.

This tri-state is the one deliberate difference from Copy Voice's `declineGlobal`
boolean: a project can say *inherit*, *force on*, or *force off* unambiguously.

- **OFF** → `/design-brief` runs as it does today. The research step is skipped
  entirely; layout comes from the agent's own read of the brief's references.
- **ON** → the research step runs and writes a conventions report that step 4 reads.

**Global default ships OFF (dark launch):** zero behavior change on release. Dogfood
by flipping one project to On; flip the global default once report quality proves
out. That default is a one-line change.

---

## 2. Plumbing (reuses established patterns)

- **`main.cjs`:** `effectiveResearch(currentProject)` alongside `effectiveVoice()`;
  IPC `research:get` / `research:saveProject` / `research:saveGlobal` mirroring the
  `voice:*` handlers.
- **Reaching the agent:** inject the resolved flag into the agent's env exactly like
  `TA_CAPTURE_ENDPOINT` / `TA_NODE_BIN` — **`TA_DESIGN_RESEARCH=on|off`**. The
  `/design-brief` command gates its new step on that env var (env injection, not a
  system-prompt edit — consistent with the other `TA_*` wiring).

---

## 3. Where it slots into `/design-brief`

One new **gated step 2b**, between Parse and Design. Everything else is untouched:

```
1  Parse the brief
2  Extract colors/fonts        (unchanged)
2b Research the field   ← NEW — runs ONLY when TA_DESIGN_RESEARCH=on
3  Apply (creates v01)         (unchanged — tokens come from step 2)
4  Design v01/Home             ← now reads /tmp/ta-research.json for the outline
5  Surface                     ← mentions research was used, when it was
```

Research informs **step 4** (section outline + component choices), not step 3
(tokens). If a brief supplies no color/font source, the report *may* also seed the
palette/type fallback — but that's secondary; its primary job is structure.

When OFF, step 2b is a no-op and step 4 behaves exactly as it does now.

---

## 4. Step 2b internals — Discover → Gather → Synthesize

Runs as a **workflow fan-out** (chosen over inline tool calls): one subagent per
site runs in parallel and returns only its distilled findings, so raw HTML never
enters the orchestrator's context and wall-clock stays ~one site's latency.

1. **Discover** — reference sites named in the brief first; else `WebSearch` on the
   category + curated galleries (Land-book, Awwwards, category round-ups). Cap at
   **3–5 sites**. Nothing usable found → silently degrade to OFF-equivalent behavior.
2. **Gather** (per site, bounded) — `WebFetch` for information architecture + copy;
   `scripts/extract-palette.mjs` / `scripts/resolve-fonts.mjs` for visual conventions.
   Each subagent returns a structured per-site summary (see schema), never the page.
3. **Synthesize** — one final agent distills the per-site summaries into the single
   conventions report: *common vs. differentiating*, with an explicit
   "patterns/grammar only, never reproduce a site's layout or copy."

Shape (illustrative):

```
const perSite = await parallel(sites.map(url => () =>
  agent(`Fetch ${url}; return its section outline, nav pattern, component
         conventions, palette/type tendency, and copy tone.`, { schema: SITE_SUMMARY })));
const report = await agent(`Synthesize these ${perSite.length} summaries into a
  conventions report: table-stakes vs. differentiators, ordered section outline
  with prevalence. Grammar only — never reproduce any single site.`,
  { schema: CONVENTIONS_REPORT });
```

Scale is small (≤5 agents) — well within the medium workflow-size guideline.

---

## 5. The artifact — `/tmp/ta-research.json`

Same temp-file handoff as `ta-palette.json` / `ta-fonts.json`; read in step 4.

```jsonc
{
  "category": "boutique fitness booking",
  "referencesUsed": ["url1", "url2", "url3"],
  "sectionOutline": [                       // ordered; prevalence = how common
    { "section": "hero", "variant": "split, left copy / right visual", "prevalence": "3/3" },
    { "section": "logoCloud", "prevalence": "2/3" },
    { "section": "features", "variant": "3-up icon cards", "prevalence": "3/3" },
    { "section": "pricing", "variant": "3-tier, middle highlighted", "prevalence": "2/3" },
    { "section": "faq", "prevalence": "2/3" }
  ],
  "nav": { "pattern": "simple + right-aligned CTA" },
  "components": { "cta": "…", "socialProof": "…", "pricing": "…" },
  "visualLanguage": {
    "density": "airy",
    "imagery": "lifestyle photography",
    "paletteTendency": "warm neutrals + one saturated accent",
    "typeTendency": "geometric sans + serif accent"
  },
  "copyTone": { "framing": "outcome-led headlines, short subs" },
  "tableStakes": ["online booking widget above the fold", "class schedule", "trust logos"],
  "differentiators": ["membership tiers as the hero CTA", "instructor bios as social proof"],
  "originalityNote": "structure grammar only; no layout or copy reproduced"
}
```

Step 4 uses `sectionOutline` + `components` to choose which blocks to build and in
what order, mapping onto the existing Block Library vocabulary.

---

## 6. Guardrails

- **Originality is a feature.** The synthesis prompt extracts *grammar* and
  explicitly avoids reproducing any single site — upholds the locked
  "inspired by structure, never a pixel clone." Product and legal risk both.
- **Never hard-fail.** Any gather failure just shrinks the sample; total failure
  falls back to OFF behavior. No hangs, no prompts (matches the image-fetch rule).
- **Latency budget.** Cap sites (3–5), parallelize (fan-out), and — later — a
  per-category cache so repeat projects in a category skip re-research.
- **Context hygiene.** Subagents return summaries/report only; raw HTML is discarded.
- **SPA/bot-blocked sites** render empty over plain fetch — the per-site subagent
  degrades with a note rather than failing the batch.

---

## 7. UI

Match Copy Voice's shape (per-project + global) without adding a whole rail icon for
one switch — put it in a compact **"Design settings" drawer** (or fold into an
existing one), backed by the `research:*` IPC:

- **Global default** — a single on/off switch.
- **This project** — a tri-state: **Inherit (default) / On / Off** — so the override
  is explicit and legible.

---

## 8. Rollout

1. Build behind **global default OFF** — no behavior change on release.
2. Flip one dogfood project to **On**; evaluate report quality against hand-designed
   outcomes.
3. Flip the global default to **On** once proven (one-line change).
4. Later: per-category cache; optional "visual deep-dive" mode that renders a
   competitor offscreen via the native capture `BrowserWindow` for image-level
   analysis when text signal isn't enough.

---

## Open decisions (resolved)

- **Global default:** OFF (dark launch). ✓
- **Engine:** workflow fan-out (one subagent per site). ✓

## Open decisions (still to make when building)

- Exact `SITE_SUMMARY` / `CONVENTIONS_REPORT` schemas.
- Whether the report may seed palette/type fallback when the brief names no source.
- Home of the "Design settings" drawer (new rail icon vs. fold into an existing panel).
