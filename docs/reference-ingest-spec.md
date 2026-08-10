# Spec: Design-reference upload and token-efficient ingest

**Status:** draft / plan of record
**Date:** 2026-08-10
**Where it lands:** the Electron app (`electron` branch, `desktop/`) for the upload UI, the ingest
orchestrator, and the Brief extension; the template scaffold (`scripts/`) for the deterministic
extractors and the design-phase consumption. Not the scaffold's runtime output.
**Origin:** Rob wants a designer to upload reference material they collected before reaching the app
(images, brand PDFs, mood boards, docs) and have the agent follow it, without that material riding
along in the conversation and burning tokens on every call.

## 1. Goal

Let a designer hand over **anything they already have** ("Upload any design references you want me to
follow", images, PDFs, brand guides, screenshots) and have the agent design *from* it, while the raw
material is read **exactly once** and never re-enters the ongoing conversation.

The design constraint that shapes everything below: **raw reference material must never live in the
running session.** Images are ~1,000 to 1,600 tokens each and documents can be huge; anything left in
the conversation is re-sent (cached, but still paid) on every turn. So the material is ingested once,
distilled to a compact text **digest** (a few hundred tokens), and only the digest travels with the
conversation.

## 2. Core principle: ingest once, distill, reference the distilled

Three moves, in order:

1. **Store** the uploaded files on disk (never in chat).
2. **Ingest** them once through a pipeline that routes each asset to the cheapest tool that can read
   it, using a model pass only for genuinely visual/semantic content, and that model pass runs in an
   **isolated one-shot call whose transcript is discarded** (Section 7). The main design loop sees no
   image bytes.
3. **Reference** the resulting compact digest thereafter. The raw files are re-opened only on explicit
   demand ("look at reference 3 again").

Net cost: the image/document tokens are paid **once, ever**, not per turn and not per session (the
digest is persisted, Section 12).

## 3. Locked decisions

- **Private storage.** References are **local working material**, stored under the project's
  `.thinkany/` directory, **not** `public/`. They are not committed and not reachable on the Vercel
  preview. (A reference the designer wants *used* in the design, e.g. a logo, is a separate, explicit
  "use this asset" action that copies it into `public/`, see 6.4.)
- **Ingest at upload time.** The pipeline runs when files are added, so the digest is ready before the
  design phase begins and the brief rail can reflect it immediately. Re-uploads re-ingest only the new
  files (dedup by hash, Section 12).

## 4. Storage layout

Everything for a project's references lives under a single private directory:

```
<project>/.thinkany/references/
  assets/            the uploaded files, verbatim (original bytes)
  derived/           downscaled image copies used for the vision pass (never shipped)
  manifest.json      one record per asset (see below)
  digest.md          the distilled, human-readable guidance (the thing that rides the conversation)
  digest.json        machine form: exact palette, fonts, per-asset one-liners
```

`.thinkany/` is already the app's per-project private area (session history lives there today), so it
is gitignored in a scaffolded project and never ships. `manifest.json`:

```jsonc
{
  "assets": [
    {
      "id": "ref-01",
      "file": "assets/moodboard.png",
      "kind": "image",              // image | document | url
      "mime": "image/png",
      "bytes": 482113,
      "sha256": "…",               // dedup key across re-uploads
      "addedAt": "2026-08-10T…",
      "ingested": true,
      "summary": "warm editorial moodboard, serif display, cream + terracotta"  // one-liner
    }
  ]
}
```

## 5. Upload UI

A first-class **reference-upload affordance** in the intake walkthrough, reusing the app's existing
attach infrastructure (`window.desktop.attachFile` / drag-and-drop / `attachDir`), extended to accept
**multiple mixed-type files**.

- **In the Get-Designing intake:** one card, offered as an early adaptive follow-up:
  > "Have any design references you have collected? Upload images, PDFs, brand guides, anything you
  > want me to follow." (skippable)
  This is a new intake card kind (or an `isFileQuestion`-style branch, see `renderQuestionCard` /
  `renderIntakeCard`) that opens a multi-select file picker and also accepts drops onto the card.
- **Anytime, in chat:** the existing 📎 attach button already exists; when the attached file(s) look
  like references (images/docs) and no other file-question is pending, offer "Add as design
  references?" so a designer can supply them mid-conversation too.
- **Feedback:** as files land, show them in the **brief rail** (thumbnails for images, a doc chip for
  documents) with a small "reading your references…" state until ingest finishes.

Uploading copies the files into `.thinkany/references/assets/` and appends manifest records
(`ingested: false`), then triggers the ingest pipeline (Section 6).

## 6. The ingest pipeline

`ingestReferences(projectDir, newAssetIds)` in `main.cjs` orchestrates. It routes each asset to the
cheapest capable tool. Deterministic steps cost **zero tokens**; only 6.1b and 6.2b spend tokens, and
only once.

### 6.1 Images

- **a. Exact palette (deterministic, 0 tokens).** Run the existing `scripts/extract-palette.mjs`
  against the image to pull the dominant hex values. These are exact and feed the palette directly.
- **b. Style read (one isolated vision pass, tokens once).** Downscale the image to ~1024px longest
  edge into `derived/` first (style/mood does not need full resolution, this is a large token saving),
  then include it in the single batched vision pass (Section 7). The pass returns per-image notes:
  visual style, type feel, layout patterns, imagery treatment, mood, and "what to emulate / avoid."

### 6.2 Documents (PDF / docx / md / txt)

- **a. Text extract (deterministic, 0 tokens).** Pull plain text locally (a small dependency-light
  extractor; PDFs via a text layer, docx via unzip+xml, md/txt as-is). Cap at a sane length and record
  if truncated.
- **b. Design summarization (one bounded pass, tokens once).** The extracted text (bounded) goes into
  the same isolated pass with an instruction to pull only **design-relevant** direction: brand rules,
  voice, requirements, explicit do/don'ts, named colors/fonts. Not a general summary.

### 6.3 Pasted URLs (already supported, 0 tokens)

A reference given as a URL keeps using the existing deterministic extractors: `extract-palette.mjs`,
`resolve-fonts.mjs`, `extract-layout.mjs`. No change, folded into the same digest.

### 6.4 "Use this asset" (verbatim reuse, 0 tokens ever)

Distinct from "follow this reference." If the designer marks an uploaded asset as one to **use** (a
logo, a hero photo), it is copied into `public/` (`public/brand/` for a logo, `public/images/` for
imagery, mirroring today's attach routing) and referenced by **file path** in the design. It is never
sent to the model as image tokens, not even once.

## 7. The isolation mechanism (why it stays cheap)

The vision + doc-summarization pass (6.1b, 6.2b) runs as a **separate one-shot Agent SDK `query` with
its own throwaway session**, distinct from the main design conversation:

- Input: the downscaled images + bounded doc text + a fixed system instruction ("produce a compact
  design-direction digest in this schema; do not converse").
- Output: the digest text only.
- The session/transcript of this call is **discarded**. Nothing from it, and none of the raw bytes,
  enters the main `runPrompt` conversation that drives intake and the build.

Result: the main loop never contains an image or a document page. The only artifact that survives is
`digest.md` / `digest.json`.

## 8. The digest

The single compact artifact that rides the conversation. Target **~300 to 600 tokens** regardless of
how many assets were uploaded.

`digest.md` (human-readable, what the design agent reads):

```md
## Design references (distilled from 6 uploads)
- **Overall feel:** warm editorial, high contrast, generous whitespace, unhurried.
- **Type:** serif display (Playfair-like) over a clean grotesque body; large headings.
- **Layout:** single wide column, oversized imagery, lots of negative space, no cards/rounded corners.
- **Palette:** cream #F4EFE6, terracotta #B4552D, ink #22201C (exact, from extract-palette).
- **Imagery:** full-bleed photography, muted/filmic grade.
- **From the brand PDF:** voice is confident and plainspoken; never use the old blue logo; avoid stock.
- **Emulate:** the pacing and the type contrast. **Avoid:** busy grids, drop shadows.
```

`digest.json` (machine form) carries the exact `palette` (hexes), `fonts` (resolved families), and a
per-asset `summary[]` so the brief rail and any future "reference N" addressing can key off it.

## 9. Brief extension

`desktop/intake/brief.cjs` gains two fields (both small, both safe to keep in context):

- `referenceAssets: RefAsset[] | null` — the stored files + per-asset one-liner (mirrors `manifest`).
- `referenceDigest: string | null` — the `digest.md` text.

`BRIEF_FIELDS`, `createEmptyBrief`, and `applyAnswers` extend accordingly. The design-brief orchestrator
(`/design-brief`) and `getDesigningPrompt` already consume the Brief, so consumption is additive.

## 10. Consumption in the design phase

`getDesigningPrompt` (app) and `design-brief.md` (scaffold) are told: **if `referenceDigest` is set,
treat it as the primary style direction**, and use the exact `palette`/`fonts` from `digest.json`
directly (they cost nothing, they are already extracted). The build reads the digest string, not the
files. The raw assets are re-opened **only** on an explicit request ("open reference 3", "what did the
brand PDF say about buttons"), which triggers a fresh scoped read of just that asset, not a reload of
all of them.

## 11. Token budget and guardrails

- **Downscale** images to ~1024px longest edge before the vision pass.
- **Batch** all images into one vision pass, not one call per image.
- **Cap and disclose:** ingest up to N images and M document pages; if more are supplied, ingest the
  first batch and **tell the designer** what was left out (never silently truncate).
- **Persist** the digest so reopening the project does not re-ingest (Section 12).
- **Stable placement:** the digest sits early and unchanged in context so it is a clean cache hit each
  turn.
- **Hard rule:** the raw assets never enter `runPrompt`'s message history.

## 12. Persistence and re-ingest

- The digest, manifest, and derived images live under `.thinkany/references/` and survive across
  sessions, so a reopened project already has its digest, no re-ingest.
- Re-uploads dedup by `sha256`: only genuinely new assets are ingested; the digest is regenerated from
  the full (old + new) manifest so it stays coherent.
- Removing a reference drops its asset + manifest record and regenerates the digest.

## 13. Edge cases and failure modes

- **Encrypted / image-only PDF (no text layer):** fall back to treating its pages as images through the
  vision pass, or report it as unreadable and keep going (never hard-fail the intake).
- **Huge / many files:** enforce the caps in Section 11 and disclose.
- **Unsupported type:** store it, mark `ingested:false` with a reason, list it for the designer, do not
  block.
- **Offline / pass fails:** Phase 1 deterministic extraction still yields exact palette + doc text into
  a digest stub; the rich style read is retried later or skipped with a note. The intake never blocks
  on it.
- **Sensitive material:** because storage is private (`.thinkany/`, gitignored, never on the preview),
  references are not exposed by publishing. This is the reason for the "private" decision.

## 14. Where it plugs in (file-by-file)

- `desktop/shell.js` — the reference-upload card in the intake (`renderIntakeCard` / a new card kind),
  the brief-rail thumbnails, and the "reading references…" state; `getDesigningPrompt` gains the
  digest-consumption instruction.
- `desktop/agent.mjs` — extend `CARD_SHAPE` with a `file`/`reference` card type if a dedicated intake
  card is used.
- `desktop/main.cjs` — `ingestReferences()` orchestrator, the isolated one-shot `query`, manifest +
  digest read/write, IPC (`references:add`, `references:list`, `references:remove`).
- `desktop/intake/brief.cjs` — `referenceAssets` + `referenceDigest` fields.
- `scripts/ingest-references.mjs` (scaffold, new) — the deterministic parts: image downscale, palette
  via `extract-palette.mjs`, document text extraction. Mirrors the `extract-*` script pattern (pure
  Node, dependency-light, callable offline).
- `.claude/commands/design-brief.md` (scaffold) — consume `referenceDigest` as primary style direction.

## 15. Phasing (tickets)

- **T0 — Storage + upload (no model).** Multi-file upload card, `.thinkany/references/` storage,
  `manifest.json`, brief-rail listing, IPC. Files land and are shown. **Value: capture works.**
- **T1 — Deterministic ingest (0 tokens).** `ingest-references.mjs`: image downscale + `extract-palette`,
  document text extraction, URL extractors, write a digest **stub** (exact palette/fonts + raw doc
  excerpts). Exact colors/fonts already flow into the design at zero token cost. **Value: usable design
  input with no model spend.**
- **T2 — Isolated style/summarization pass.** The one-shot vision + doc pass (Section 7) that turns the
  stub into the rich `digest.md`. **Value: the agent "gets the vibe."**
- **T3 — Consumption + persistence polish.** Wire `referenceDigest` into `getDesigningPrompt` /
  `design-brief`, dedup + regenerate on re-upload, cross-session persistence, "use this asset" (6.4).
- **T4 — On-demand re-open.** "reference N" addressing: open a single asset for a scoped question
  without reloading the set.

## 16. Non-goals (for now)

- Not a general document Q&A / RAG system, the digest is design-direction only.
- Not shipping references to the client (they are private by decision).
- Not a full asset manager; "use this asset" (6.4) is the minimal reuse path, not a media library.
