# Design-variety cloud move — spec

Move the curated lens deck + deterministic sampling **server-side** (`derive.thinkany.design`)
so the shipped app never contains it. This is Layer 1 (server IP moat) of the IP-protection
plan, applied to design-variety. The Art Director is intentionally NOT in scope (its IP is thin
and prompt-shaped; see art-director-spec.md / the cloud discussion).

## Why this is the clean candidate

- **The deck is the moat.** `lenses.cjs` (art movements, motifs, gloss) + `direction.cjs`
  (tag derivation, axis resolution, lens/motif weighting, the TUNING weights) are the creative
  IP. Everything else is orchestration.
- **Sampling is deterministic — no model call.** `sampleDirection` is a seeded RNG (mulberry32)
  over weighted selection. So the endpoint is a **cheap, stateless API call: no token cost, no
  API-key/proxy problem, no model-turn latency.** That's what makes this move easy.
- **The seam is already there.** The renderer NEVER imports the deck. It reaches it only through
  main.cjs (`intake:directionMeta`, `intake:sampleDirection`, `direction:sampleFor`) plus two
  internal main.cjs uses (`buildDesignPrompt`, the reroll fork). **The swap is entirely inside
  main.cjs; the renderer contract is unchanged.**

## What's moat vs. necessarily-exposed

| | Where it lives after | Notes |
|---|---|---|
| The deck (`lenses.cjs`) — movements, motifs, weights | **Server only** | The moat. Never in the app bundle. |
| Sampling (`direction.cjs`) — tags, axes, lens/motif picking, TUNING | **Server only** | The moat. |
| Prompt template (`renderDirectionPrompt`) | **Server only** | "How to instruct the model to honor a lens." Server renders the block. |
| `lensLabel` map | **Server only** | Server stamps the label onto the returned direction. |
| The **sampled output** (one direction block) | Rides the user's build prompt (visible) | Unavoidable — it's what the model needs. One result ≠ the deck. |
| Knob-panel **meta** (axis stops + lens labels) | Sent to the licensed client | Needed to render the sliders + lens picker. Surface, not the weights. |

## Endpoints — `derive.thinkany.design/api/direction/*`

**The host already exists.** `derive.thinkany.design` is a live Vercel project (repo
the standalone `github.com/thinkany/vercel-derive` repo (checked out locally at `root/derive`),
serving one route, `api/derive.mjs` (the Figma export), gated by `x-license-key` /
`DERIVE_LICENSE_KEY` — a serverless API that "never ships to clients." This move is **adding a
route to that repo, reusing that auth** — not standing up a new server. (BUILT: `api/direction.mjs`
+ `direction/{direction,lenses}.cjs` now live in the `vercel-derive` repo, commit `fa52b33`.)

Mirror the existing derive handler (POST JSON, `x-license-key` header): `direction.cjs` +
`lenses.cjs` sit in the repo's `direction/` (traced + bundled by Vercel, same as `derive.mjs`).

- **POST `/direction/meta`** → `{ axes, lenses }` — knob-panel metadata (no inputs). Cacheable.
- **POST `/direction/sample`** — body `{ what, tone, projectType, axes?, lens?, seed? }` →
  `{ direction, block }`:
  - `direction` — the sampled object (lens, axes, motifs, **seed**, `lensLabel` stamped) for the
    dashboard card + `variation.json` (its reproducible DNA).
  - `block` — the server-**rendered** prompt block to inject into `/design-brief`.
  Deterministic: the same `seed` reproduces the same direction (so reproduction is a re-sample
  with the stored seed).

## Auth

`x-license-key: <license>` header — same shape as the Figma derive (`DERIVE_LICENSE_KEY`, stored
encrypted in the keychain, injected into env). Server validates the license (this is the moment
to replace the **presence-only stub** — `researchLicensed()` today just checks the env var — with
real server validation; ties into research-feature-licensing-plan). Invalid/absent → **403** →
client behaves exactly as unlicensed (feature dark, no clapperboard/knobs).

## Client changes (all in main.cjs)

Replace `require("./intake/direction.cjs")` with a thin async cloud client `directionClient.cjs`
exposing the **same** shapes so the seam is unchanged:
- `directionMeta()` → `POST /direction/meta` (with an in-process cache of the last success).
- `sampleDirection(inputs)` → `POST /direction/sample` → `{ direction, block }`.

Then at the call sites:
- `intake:directionMeta` (already gated) → `await directionMeta()`.
- `intake:sampleDirection` / `direction:sampleFor` → `await sampleDirection(...)`, return
  **both** `direction` and `block` to the renderer (the reroll fork needs the block).
- `intake:designPrompt` (build handoff) → sample, store `direction` **and** `block` on the brief;
  `buildDesignPrompt` injects the stored `block` instead of calling a local
  `renderDirectionPrompt`.
- `variation:createRerollFork` → use the `block` handed in from `direction:sampleFor` (no local
  render); `lensLabel` already stamped by the server.
These handlers become async (several already are). No renderer changes.

## Remove the deck from the shipped artifact

Add `desktop/intake/direction.cjs` + `desktop/intake/lenses.cjs` to the app-bundle exclude (the
same discipline as `TEMPLATE_EXCLUDE` / the ta-export IP filter) so a **packaged app never
contains them**. They live in the server repo. (Dev keeps a local copy only behind an explicit
`DIRECTION_LOCAL=1` fallback — see below — and that copy is excluded from `npm run dist`.)

## Degrade path — never hard-fail a build

- **`/sample` fails at build handoff** → build with **no direction** (the design still builds, at
  the model's default centroid). Log `direction unavailable — building without it`. Auto-vary just
  no-ops that build.
- **`/meta` fails** → knob panel absent (identical to unlicensed); serve the **last cached meta**
  so the panel survives brief outages.
- **Reroll `/sample` fails** → surface an error, do NOT fork.
- **Timeout** short (≈4s) so a slow endpoint never stalls a build; timeout → degrade as above.
- **Dev offline:** `DIRECTION_LOCAL=1` uses the local deck copy (dev only, bundle-excluded) so the
  feature works without the network during development.

## Reproduction & persistence

`variation.json` still stores the full `direction` (incl. `seed`) — its DNA. Re-sampling with that
seed against the cloud reproduces it. `/tmp/ta-direction.json` (the build's pickup) is written from
the returned `direction` exactly as today. No schema change.

## Open decisions

- **Which repo is canonical** — `thinkany/vercel-derive` (confirmed live at derive.thinkany.design,
  live at derive.thinkany.design) vs the divergent `thinkanyco/design-export-api`. RESOLVED: the
  route was added to `thinkany/vercel-derive`; the stale `cloud-export/` copy in this repo was removed.
- **License validation now vs. at launch** — do real server validation as part of this move, or
  keep the presence stub and add validation with the broader licensing work? (Recommend: real
  validation here — it's the whole point of the endpoint being auth'd.)
- **Anti-repetition memory** (per-designer, cross-session, cross-project) — **BUILT** as server-side
  global state on this endpoint: `direction/memory.cjs` (Vercel KV / Upstash over REST, per-instance
  fallback) stores each committed design's lens+motifs per `designer` id; `direction.cjs`
  `memoryPenalties` decays + down-weights them into the lens/motif draw (never bans); a new
  `{op:"record"}` writes and `{op:"sample"}` reads. Identity is a client-supplied per-install
  `designer` id (`designerId()` under the app's pinned userData), NOT the shared license — the
  license can't tell designers apart. Degrades to "no memory" on any KV outage. See DEPLOY.md §2b.
- **Dev fallback** — ship the `DIRECTION_LOCAL` local-deck path (recommended, keeps offline dev
  working) or force the cloud always.

## Rollout order

1. In the existing `vercel-derive` project, add `api/direction.mjs` (→ `lib/direction`) with the
   `{meta,sample}` handlers, move `direction.cjs` + `lenses.cjs` into `lib/`, and reuse the derive
   handler's `x-license-key` gate (now the moment for real license validation, not just presence).
2. `directionClient.cjs` + swap the four main.cjs seam sites (behind the unchanged IPC contract).
3. Store `block` alongside `direction`; drop local `renderDirectionPrompt`/`lensLabel` use.
4. Bundle-exclude the deck; add the `DIRECTION_LOCAL` dev fallback.
5. Degrade + meta cache + timeout.
