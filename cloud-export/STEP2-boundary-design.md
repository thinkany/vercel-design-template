# Step 2 — Boundary spike: the licensed cloud-derive path

> Design only. **No server is stood up here.** This pins the client/server seam,
> the wire contract, the license model, and the sequenced build plan so Step 2 can
> execute step-by-step. Companion to [`contracts.ts`](./contracts.ts) and
> [`README.md`](./README.md). This dir never ships (export-ignored + zip-filtered).

## 1. Goal

Move the genuinely valuable **derive** algorithm (raw DOM styles → Figma-intent
build-spec) off the user's machine and behind an **auth-gated cloud endpoint**, so
the IP never ships. The client keeps only commodity **capture** (needs the live
local DOM) and the **build** (needs the user's Figma auth). Monetization is a
**license** the Electron app holds and sends with every derive request.

App-only distribution is now settled, so this is an app concern end-to-end — no
scaffold/download path to support.

## 2. The seam (recap)

| Layer | Runs where | Why | IP |
|---|---|---|---|
| **Capture** | Local (app) | needs `getComputedStyle`/`getBoundingClientRect` on the running project | low |
| **Derive** | **Cloud** ← the move | pure computation; no browser, no local files | **high — the product** |
| **Build** | Local (app) | plugin `code` runs under the user's Figma auth via `use_figma` | high but un-hideable |

**Seam rule:** geometry is measured locally; *every interpretation of a style
string* (parse, resolve, compact, bind) happens in the cloud. `contracts.ts`
encodes exactly this cut with two payloads: **`CaptureBundle`** up,
**`BuildSpec`** down. Image bytes and the Figma build never cross the wire.

## 3. Where the POC already is (from the drift analysis, 2026-08-03)

The POC is in **much better shape than a fresh spike** — it is *functionally
current* with the shipping pipeline as of 2026-07-31:

- **Capture drift ≈ nil.** `CAPTURED_STYLE_PROPS` covers every prop `extractSpec`
  reads; all geometry maps onto `RawNode`; **all three menu passes are modeled**
  (mobile `?menu=open`, desktop `?menu=open&item={id}`, `--menus first|all` /
  `--only`). Overlay compose-exclusion survives the wire via `pages[].blocks`
  order.
- **BuildSpec ↔ plugin is genuinely 1:1.** Every field the shipping
  `figma-reconstruct-library.plugin.js` reads exists in the types — including the
  recent hero-button fix (depends only on `TextStyle.align`, already emitted).
- **The build layer can't go stale.** `build-from-spec.mjs` imports `emitCalls`
  from the shipping script, which reads the builder body from the shipping
  `plugin.js` at call time — so packing/temp/combine/compose and all `builder:`
  fixes flow into the POC automatically. 7 of the 8 post-POC commits reach it for
  free; the 1 derive-relevant one (`text.align`) is already reconciled.

**Conclusion:** this is a *finish-and-harden* job, not a rewrite.

## 4. The key structural insight — productization IS deduplication

The one real risk the analysis found: `extractSpec` (shipping, in-browser, canvas
color) and `derive.mjs` (POC, node, culori) are now **two hand-maintained copies
of the same interpretation IP**, with no shared-code link (unlike the builder
body, which is imported). A *new* heuristic added to `extractSpec` would silently
fail to reach the cloud.

But this resolves itself on cutover: once the shipping client is switched to
**capture → POST → receive BuildSpec**, its local interpretation half is *deleted*
— `extractSpec` collapses to pure capture, and `derive.mjs` (cloud) becomes the
**single source** of the interpretation IP. So the fix is *complete the cutover*,
not *maintain two copies*. During the transition window, guard with a
**conformance test** (fixed `RawNode` fixtures → assert `derive.mjs` output equals
a golden captured from the current shipping run) so the two can't silently desync
before the old half is removed.

## 5. Reconciliation checklist — DONE (§9 step 1, 2026-08-03)

All items worked; the POC is now at verified shipping parity. **Live end-to-end
proof:** captured the same live DOM (`:5173`) via both the POC `capture-client`
and the shipping `export-reconstruct`, then `derive(POC-capture)` deep-compared to
the shipping output — **ZERO structural diffs** across all 4 blocks
(header/hero/footer/mobile-menu), 7 brand colors, and fonts. That matched pair is
committed as the conformance fixture (`fixtures/`), locked by
`conformance.test.mjs` (offline, no server).

1. ✅ **Color-resolver parity.** `color.mjs` now resolves the full CSS named-color
   keyword set (routed through the hex path), so a brand `--ta-*` token declared
   as `black`/`white`/`rebeccapurple`/… resolves instead of dropping to null.
   `currentColor` / unresolved `var()` return null *deliberately* (unresolvable
   off-browser; graceful fill-omission) — commented as such. `display-p3` still
   treated as sRGB (documented POC limit; rare). Unit cases added to
   `derive.test.mjs`; the conformance test asserts **no brand color or fill color
   leaked null**.
2. ✅ **Image handling — decision made & documented.** Keep the POC behavior (it's
   the better one): OMIT an image fill when its bytes weren't downloaded (no orphan
   gray placeholder), and support `data:` URLs (re-encoded to named assets).
   Documented on `Fill` in `contracts.ts` as intentional, superseding the old
   shipping "url'd orphan fill".
3. ✅ **Seam carve-outs documented** in `contracts.ts` header: `pointerEvents` /
   `fontStyle` are intentional local-only reads; `normalLH` is the one
   interpretation deliberately baked into capture.
4. ✅ **`<br>` / inline-tag pass-through guarded** by the conformance test — any
   future prune would diff the block trees against the golden and fail.
5. ✅ **Dead `Fill.size`/`Fill.pos` noted** on the `Fill` type (builder ignores
   them; kept for a future builder that honors object-fit/position).
6. ✅ **Conformance test lives** as `conformance.test.mjs` — the desync guard until
   cutover (§4) deletes the local derive half.

**Tests (all offline, run before the cutover in §9 step 3):**
```
node cloud-export/derive.test.mjs        # color + synthetic-bundle unit checks
node cloud-export/conformance.test.mjs   # derive(fixture) == shipping golden
```

## 6. Orchestration / trigger — stays agent-driven (no MCP-to-app needed)

The old "MCP reaches the agent, not the app main-process" fork is **not on the
critical path.** The minimal, safe cutover keeps the whole `/export-figma` flow:

- `ta-export reconstruct` (the app-owned client, already on the agent PATH from
  step 1b) changes internally from *local derive* to **capture → POST to cloud →
  receive `BuildSpec`** (which equals today's `reconstruct-{id}.json`).
- `emitCalls` / the `use_figma` build run **exactly as today** on that BuildSpec.
- The agent orchestration in `/export-figma` is **untouched** — it still runs
  `ta-export reconstruct` then submits the builder calls.

So the IP moves server-side with near-zero change to the user-visible flow. An
**app-feature button** (button → capture → derive → drive Figma) is a *later,
optional* enhancement, not a prerequisite — deferred until/if the app gains its
own Figma MCP channel.

## 7. Deployment shape

- **A dedicated serverless function** (Vercel, matching the existing
  `create.thinkany.design` infra) — e.g. `POST https://<derive-host>/derive`.
  Runs `derive.mjs` + `color.mjs` (culori for color). Stateless; no local files.
- **Two endpoints:** `POST /derive` (CaptureBundle → BuildSpec, license-gated) and
  `POST /license/validate` (token → `{ ok, plan, expiresAt }`).
- Keep the function **thin and single-purpose**; the IP is `derive.mjs`, which
  never leaves the server bundle.

## 8. License / auth design — mirror the app's API-key pattern

The Electron app already manages the Anthropic key exactly the way a license
should be managed (`desktop/main.cjs:52–92`). Mirror it 1:1:

| API key (exists) | License (new, same shape) |
|---|---|
| `keyFilePath()` → `userData/anthropic-key.enc` | `userData/license.enc` |
| `storeKey`/`loadStoredKey`/`removeStoredKey` via `safeStorage` (OS keychain, base64 fallback) | identical for the license token |
| `validateKey()` → hits Anthropic `/v1/models` | `validateLicense()` → `POST /license/validate` |
| IPC `key:status` / `key:save` / `key:clear` | `license:status` / `license:save` / `license:clear` |
| Boot: stored key → `process.env.ANTHROPIC_API_KEY` | Boot: stored license → in-memory + injected for the agent |

**Reaching the derive request:** the derive call happens inside `ta-export
reconstruct`, which the agent runs as a subprocess. So `main.cjs` injects the
license + endpoint into the agent's env the same way it injects PATH in step 1b —
e.g. `TA_LICENSE` and `TA_DERIVE_URL`. The client reads them and sends the license
in the **request header** (`contracts.ts` already reserves this: *"Auth travels in
the request HEADER, not in the bundle."*).

**Open license-model decisions (for Step 2 kickoff):**
- **Issuance:** per-seat key you generate/hand out vs. account-linked. (Recommend
  per-seat key first — simplest, matches the API-key mental model.)
- **Validation cadence:** online check per session + **offline grace** (cache
  `{plan, expiresAt}` in `license.enc`, allow N days offline) so a network blip
  doesn't block export. (Recommend.)
- **Revocation / metering:** server-side check on `/derive` (reject revoked/expired
  tokens; optionally meter derive calls per license). Design after issuance.
- **Gate placement:** the license gates `/derive` server-side (the real gate).
  The app UI also shows license status and refuses to start an export without a
  valid one (UX, not security).

## 9. Sequenced sub-steps for building Step 2

1. **Harden the POC to shipping parity** — work the §5 checklist; add the
   conformance test (§4). Pure local, no server. *(Safe first build step.)*
2. **Stand up `POST /derive`** — wrap `derive.mjs` in the serverless function;
   test client→cloud→BuildSpec against a captured fixture.
3. **Cut over the client** — `ta-export reconstruct` → capture+POST; delete the
   local derive half from the shipping `extractSpec` (dedup); `/export-figma`
   unchanged.
4. **License layer** — `POST /license/validate`, the app-side `license.enc` +
   IPC + status UI, env injection for the agent, header on `/derive`, server-side
   gate + offline grace.
5. **(Optional, later)** app-feature export button; server-side metering.

## 10. Decisions needed to start (kickoff questions)
- Derive **host + auth transport** (dedicated function/domain; header name).
- **License model**: per-seat key + online-validate-with-offline-grace (my
  recommendation) — confirm or adjust.
- Which sub-step to build first — **§9 step 1 (harden POC + conformance test)** is
  the natural, server-free starting point.
