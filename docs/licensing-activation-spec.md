# Licensing & activation — spec

**Priority: HIGH for launch.** We are not at launch yet, but this is the plan of record
for how the gated pieces (Design/Research/Art Director, Figma export) get paid for and
enforced. It replaces the current **single shared Vercel env key** (a presence/exact-match
stub anyone could leak) with **per-customer, per-device licenses** we can issue and revoke.
It is the concrete execution of the "replace the presence-only stub with a real
server-validated license" launch item and Layer 1 (server moat) of the IP-protection plan.

Build **after** the current initial-development close-out. This doc is the solid plan so it's
ready to drop in when we approach launch. Nothing here ships to a client that changes the
enforcement trust boundary: **the server's signed token is the only source of truth.**

## Model, in one line

Sell licenses against an **email account**. The app mints a random **installation ID** on
first run. Buying/activating **binds a license key to that install ID**, seat-limited. Email
is the durable identity (recovery, re-activation); the install ID is the device binding;
the server is the enforcement.

### Why email is the anchor, not the install key

- The install ID survives **updates** (userData stays on the pinned path — a hard constraint
  already; see the userData-pinning gotcha). It does **not** survive uninstall/reinstall, a
  wiped machine, or a new laptop. Each of those mints a fresh install ID.
- Anchor access on the install ID alone → every reinstall strands the customer and generates
  a support ticket.
- Anchor on **email + license**, with the install ID as "which devices this license is
  currently activated on" → a reinstall is a re-activation (free a seat, claim a new one).
  The customer never loses access.

## What each identifier is

| Identifier | Where it lives | Secret? | Survives update | Survives reinstall / new machine |
|---|---|---|---|---|
| **Installation ID** | `userData` (pinned path), plain UUID | No — an ID, not a secret | Yes | No (new ID) |
| **License key** | Sold to the customer; pasted into the app; stored via safeStorage | Treat as secret | Yes | Yes (re-enter / re-activate) |
| **Email** | The account, server-side; echoed in the drawer | No | n/a (server) | Yes |
| **Entitlement token** | Cached in `userData`, signed by the server, short TTL | Signed, tamper-evident | Yes (until TTL) | No (re-fetched on activate) |

## The installation ID

- Generated **once** on first run: a v4 UUID (`crypto.randomUUID()`), no hardware
  fingerprint, no PII → privacy-clean.
- Persisted in `userData` (e.g. `install-id.json`, plain — it's an identifier, not a secret).
  Pinned userData path means it rides updates.
- Exposed read-only + copyable in Keys & Licenses.
- **Do not** derive it from hardware or `app.getName()`. Random + stored is the whole design.

## Enforcement trust boundary (read this before implementing)

The install ID and any local `isLicensed`/`hasLicense` flag are **client-side and spoofable**.
A determined user can read the file, copy it, or fake the boolean. That is acceptable **only
because** the valuable IP and the real gate live server-side:

- The lens deck + sampler are already server-only (design-variety cloud move).
- Gated features call the server and trust **only** a fresh or cached **signed** entitlement
  token, never a local boolean, for anything that matters.
- Node-locking a client-random UUID stops **casual sharing** (one purchase spread across a
  team/forum), not a determined pirate. That is the right amount of friction for this product;
  do not over-invest in client hardening beyond the existing asar/obfuscation plan.

## Endpoints — add to the `vercel-derive` repo (`root/derive`)

Reuse the existing licensed-API host and its `x-license-key` convention. This adds routes +
a small datastore to the serverless project that "never ships to clients"; it does not stand
up a new server. Two new routes:

### `POST /api/activate`
Request: `{ licenseKey, installId, email, appVersion }`
Server:
1. Look up `licenseKey`. Reject if unknown/expired/refunded (`401`/`403`).
2. Find or create the activation row `(licenseKey, installId)`.
3. Enforce the **seat limit** (default **2**, configurable per license): if this install is
   new and the license is at its seat cap → `409 seat_limit_reached` with the list of active
   installs (so the app can offer "deactivate another device").
4. Bind email to the license if not already set (first activation claims the account).
5. Return `{ ok, entitlements: ["design","figma", ...], token, tokenExp }` where `token` is a
   **signed** (HMAC or asymmetric) entitlement blob: `{ installId, entitlements, exp }`.

### `POST /api/validate`
Request: `{ installId, token? }` (+ `x-license-key` for the raw path during transition).
Server: verify the token signature + `installId` match + not past `exp`; optionally re-check
the license is still good (revocation). Return refreshed `{ entitlements, token, tokenExp }`.
This is the cheap call the app makes on boot and before gated actions.

### `POST /api/deactivate`
Request: `{ licenseKey, installId }` → frees the seat for that install (used by "move to a
new machine"). Return updated seat state.

Datastore: a small KV/SQL (Vercel KV/Postgres, Turso, or the licensing service's own DB —
see "Build vs. buy"). Tables: `licenses(key, email, plan, seats, status, expiresAt)`,
`activations(licenseKey, installId, firstSeen, lastSeen, appVersion)`.

## Offline grace

Gated features must not hard-fail when the network is down.

- On successful activate/validate, cache the **signed token** + `tokenExp` in `userData`.
- Set a **grace window** (e.g. token TTL 7 days, hard cutoff 14). Within grace, a valid
  cached token unlocks features **offline**. Past the hard cutoff with no successful
  re-validate → lock and prompt to reconnect.
- Never trust a cached token past its signed `exp` + grace; never trust an unsigned local flag.

## Client changes (Electron)

**main.cjs**
- `installId()` — read/create `userData/install-id.json` (UUID), cached in a module var.
- `licenseState` — persisted `{ email, licenseKey (safeStorage), token, tokenExp }`.
- `activate({licenseKey, email})` → `POST /api/activate` with `installId` → store token +
  entitlements; set `process.env` entitlement flags for the subprocess (as today).
- `validateEntitlements()` on boot → `POST /api/validate`; on success refresh token; on
  network fail fall back to the cached signed token within grace.
- `deactivate()` / `getLicenseAccount()` IPC for the drawer.
- Replace `researchLicensed()` / the raw `DESIGN_LICENSE_KEY` presence check with
  "does the verified entitlement set include `design`?" (same for `figma`).

**preload.cjs** — `getInstallId`, `getLicenseAccount`, `activateLicense`, `deactivateLicense`.

**Transition:** keep the current `DESIGN_LICENSE_KEY` / `DERIVE_LICENSE_KEY` env path working
behind a feature flag so dev + existing testers aren't broken while the account system lands.
`DIRECTION_LOCAL=1` dev fallback stays.

## Keys & Licenses drawer

Add an **Account** group at the top (above the existing Your keys / Licenses sections):

- **Email** — the account (input on first activation; read-only after, with "Sign out" that
  clears local license state, not the server record).
- **Installation ID** — read-only, copy button (`crypto.randomUUID` value).
- **License** — paste license key + **Activate**; status shows plan + entitlements
  (Design/Research/Art Director, Figma) + seat usage ("Device 1 of 2"). A **Deactivate this
  device** action frees the seat.

The existing padlock rail behavior carries over: **all entitlements present → open lock**.
During transition the raw Design/Figma key inputs stay as a fallback; once activation is the
default they're removed (or hidden behind "Enter a key manually").

Purchase UX: prefer **paste-license-key → app activates** over "type your install ID into a
web form." Still expose the install ID for support + a manual/offline fallback.

## Build vs. buy the backend

Two viable paths; decide before building:

- **Buy** (recommended to evaluate first): a licensing service (Lemon Squeezy, Keygen,
  Paddle) hands you license issuance, seats, email delivery, refunds/revocation, and an
  activation API out of the box. Our endpoints become thin proxies that add the signed-token +
  entitlement shaping. Fastest to a solid launch; least DB to own.
- **Build**: our own routes + KV/SQL in `vercel-derive`. Full control, reuses existing infra
  and the `x-license-key` convention, but we own billing-adjacent state, email, and revocation.

Either way the **client contract above is identical** — activate/validate/deactivate + signed
token. Pick the backend without changing the app.

## Edge cases

- **Reinstall / new machine:** new install ID → activate re-binds; if at seat cap, offer
  deactivate-a-device. Email makes this self-serve.
- **Refund / chargeback:** flip `license.status`; next `validate` fails → app locks after grace.
- **Clock tampering:** token `exp` is server-signed; also gate on server time at validate.
  Grace is a convenience, not a security guarantee.
- **Multiple licenses (Design + Figma bought separately):** entitlements are a set on the
  license/account, not one boolean — the drawer already thinks in separate unlocks.
- **Shared-key testers today:** keep the env path until the account flow is default.

## Phasing

1. **P1 — install ID + drawer surface.** Mint/persist the UUID, show Email/Install ID/License
   in the Account group. No server yet; license input still the raw env-key path. Ships the
   visible groundwork with zero backend risk.
2. **P2 — activation backend.** Pick build-vs-buy; stand up activate/validate/deactivate +
   datastore + signed token; wire main.cjs `activate/validate`; entitlements from the token.
3. **P3 — seats, offline grace, deactivate-a-device, revocation.** Harden.
4. **P4 — retire the shared env key** as the default; keep manual-key entry as fallback.

## Out of scope

- Hardware fingerprinting / stronger node-locking (revisit only if piracy is observed).
- Subscription/metering beyond a validity window (the token TTL already carries expiry).
- Anthropic API-key billing — that stays the user's own key (see the auth-must-be-api-key
  constraint); this spec governs **our** feature licenses, not their model spend.
