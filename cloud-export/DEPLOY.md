# Deploying the derive service (§9 step 2)

The Layer-1 IP endpoint: `POST /api/derive` — takes a `CaptureBundle`, returns a
`BuildSpec`. The derive code (`derive.mjs` + `color.mjs`) is bundled into the
Vercel function and **never leaves the server**. This is the moat.

> Everything here has been proven **offline** already:
> `node derive.test.mjs && node conformance.test.mjs && node handler.test.mjs`
> (or `npm test`). Deploy only stands the same logic up behind HTTPS + a key.

## Recommended topology — a dedicated private project

Keep the IP out of the repo that also serves the public template. Two ways:

- **A. Dedicated private repo (recommended).** Create a new **private** git repo
  and copy in: `derive.mjs`, `color.mjs`, `api/`, `package.json`, plus (optional
  but nice) `contracts.ts`, the three `*.test.mjs`, and `fixtures/`. Connect it to
  a new Vercel project. Nothing else from the template comes along.
- **B. Same repo, subdirectory root.** Point a **new, separate** Vercel project at
  this monorepo and set **Root Directory = `cloud-export`**. Faster to start, but
  the function then redeploys on every `main` push and its build can see the whole
  repo. Fine for a spike; move to A before it's real.

Either way the derive source is already export-ignored from the distributed
template, so clients never receive it.

## Deploy steps

1. **Create the Vercel project** from the repo/dir above (framework preset:
   **Other** — it's API-only, no build). Zero npm deps, so install is instant.
2. **Set the license key env var** (Project → Settings → Environment Variables):
   ```
   DERIVE_LICENSE_KEY = <a long random secret>
   ```
   This is the **step-2 shared-key gate** — one secret the client must present.
   The real per-seat license layer (issuance/validation/offline-grace) is §9
   step 4; this just proves the auth boundary end-to-end.
3. **Deploy.** You get `https://<project>.vercel.app/api/derive` (or your custom
   domain, e.g. `https://derive.thinkany.design/api/derive`).

## Prove the round-trip

Against the deployed URL, using the committed fixture as a sample bundle:

```bash
URL=https://<project>.vercel.app/api/derive
KEY=<the DERIVE_LICENSE_KEY you set>

# 401 without the key
curl -sS -o /dev/null -w "no key → %{http_code}\n" -X POST "$URL" \
  -H 'content-type: application/json' --data @cloud-export/fixtures/capture-v00.json

# 200 + a BuildSpec with the key
curl -sS -X POST "$URL" \
  -H "x-license-key: $KEY" -H 'content-type: application/json' \
  --data @cloud-export/fixtures/capture-v00.json | head -c 300
```

Expected: the first prints `no key → 401`; the second returns JSON starting
`{"contract":1,"variation":"v00",…}` with a `blocks` array (4 blocks:
header/hero/footer/mobile-menu). That JSON is byte-parity with what the local
shipping export produces — the same thing `conformance.test.mjs` locks.

## How the client will reach it (next: §9 step 3)

The app injects the endpoint + license into the agent's env (same mechanism as the
step-1b PATH wiring): `TA_DERIVE_URL` + the license token. `ta-export reconstruct`
then changes from *local derive* to **capture → POST `$TA_DERIVE_URL` (license in
header) → receive BuildSpec**, and the `use_figma` build runs unchanged. At that
point the local interpretation half of `extractSpec` is deleted, leaving
`derive.mjs` (here, on the server) the single source of the IP.
