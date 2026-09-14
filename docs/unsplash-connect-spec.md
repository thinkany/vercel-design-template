# Connect with Unsplash

One click instead of a developer account, an application form and a pasted key.
Built 2026-09-13 on `feature/unsplash-connect` (app) and the derive repo's branch of the
same name. This note is the design, the wire shape, and the list of things only Rob can
do on the Unsplash side before it works live.

## Why

Unsplash's API guidelines say an application must not require its users to register
their own API keys. The route they offer a desktop app is **Dynamic Client Registration**:
one **parent** application (ours, approved for production) mints a **child** application
per install, each with its own allowance (3,000 requests an hour). The designer signs in
to Unsplash once and clicks Allow. Nobody copies anything.

The guidelines also require that photos are **shown from Unsplash's CDN**, not copied.
The script used to download and convert to AVIF; it now returns a sized hotlinked `src`
for Unsplash photos (Pexels and Pixabay still land as files). The copy tells designers
this plainly and that any photo can be replaced with their own at any time.

## The flow

```
app                                   derive (/api/unsplash)                Unsplash
 |  POST {op:start, redirectUri,state} |                                      |
 |  ---------------------------------> |  builds the authorize URL with the   |
 |  <---------- { url } -------------- |  PARENT client id                    |
 |  opens url in the browser ------------------------------------------------>|  sign in / join, Allow
 |  <----- GET 127.0.0.1:9791/callback?code=…&state=… ------------------------|
 |  POST {op:exchange, code, redirectUri, name}                               |
 |  ---------------------------------> |  POST oauth/token (parent id+secret) |
 |                                     |  POST api/clients  (Bearer) -------->|  registers the child
 |  <---- { ok, accessKey, name } ---- |  child.client_id                     |
 |  validateUnsplashKey → store as unsplash-key.enc → UNSPLASH_ACCESS_KEY     |
```

- The parent secret exists only in derive's env. The app never sees it and never calls
  the token or clients endpoints itself.
- `name` is `thinkany design (<first 8 of the designer id>)`, so the parent's list of
  children reads as installations.
- The exchange is gated by `DESIGN_LICENSE_KEY` (same header as `/api/direction`).
  Without the Design license the row still takes a pasted key.
- The loopback listener is one-shot, 5-minute timeout, port 9791 (Vercel's is 9789).
- `unsplash:status` now carries `via: "unsplash" | "own"`, kept in
  `userData/unsplash-connect.json`; a paste or an unplug clears it.

## What's in the app

| Where | What |
|---|---|
| `desktop/main.cjs` | `runUnsplashConnect`, `unsplashConnectPost`, `unsplashConnectEndpoint` (`UNSPLASH_CONNECT_ENDPOINT` overrides), IPC `unsplash:connect`, `via` on status. |
| `desktop/shell.js` | `licenseSection` takes `connect:`; the Connect button leads, the own-key steps + field fold under "Use your own access key instead". Both the Keys drawer and the setup walk-through pass `unsplashConnectOpts()`. |
| `desktop/copy.js` | `licenses.unsplashConnect*`, `unsplashOwnKey*`, `unsplashVia*`; the Unsplash description, the walk-through card, the help card and the tour tip all say photos are served from Unsplash and can be replaced. |
| `scripts/find-images.mjs` | Unsplash is `hotlink: true`: `get` pings the download endpoint and returns `{ hotlinked, src, srcset, credit }`; `--out` is not needed (ignored with a note). Credit keyed by the URL, `hotlinked: true`. `TA_STOCK_TEST_BASE` seam for tests. |
| `desktop/skills/design.md` §4b, `desktop/agent.mjs` | Use the returned `src` as-is, never curl it down; say in the wrap-up which photos are served from Unsplash. |
| Tests | `desktop/dev/unsplash-connect.test.cjs` (shape pins), `desktop/dev/find-images.test.mjs` (stubbed end-to-end of the hotlinked `get`), derive `unsplash.test.mjs` (the endpoint). |

## Before it works live (Rob)

1. **Register the parent application** at unsplash.com/oauth/applications: name
   "thinkany design", a description of the studio, and the redirect URI
   `http://127.0.0.1:9791/callback`.
2. **Apply for production** on that application. The review checks the guidelines the
   app now meets: photographer attribution with utm links (credits.json, the media
   library's credit line), the download ping on every use, and hotlinking. Screenshots of
   a design with an Unsplash photo and its credit help the review.
3. **Ask the Unsplash team to enable Dynamic Client Registration** on the parent (their
   docs say to reach out; it is not on by default). Mention it is a desktop app with one
   install per designer.
4. **Set derive's env** on Vercel: `UNSPLASH_PARENT_CLIENT_ID`,
   `UNSPLASH_PARENT_CLIENT_SECRET` (optionally `UNSPLASH_REDIRECT_HOSTS`), then deploy
   the derive branch. Until then the endpoint answers 503 and the app shows the pasted-key
   fallback with that message.
5. **Sync the skill**: `node desktop/build/sync-skills.cjs` was run on this branch; commit
   + deploy derive so the packaged app's `/design` knows about the hotlinked result.

## Pexels and Pixabay: the trimmed paste (option 1, built 2026-09-13)

Neither library has a sign-in path (one key per account), so their paste flow is
trimmed instead. Clicking a sign-up link in a row's steps arms a clipboard watch for ten
minutes; when the window regains focus, main reads the clipboard and answers only if the
text matches that library's key shape (`KEY_SHAPES` in main.cjs: Unsplash 43 url-safe
chars, Pexels 56 alphanumerics, Pixabay `<id>-<hex>`). A match is filled in, labelled
"Found a key on your clipboard", and validated. A paste into the field is validated on
its own, no Save press. The Unsplash own-key fold gets the same, and so does the Claude
API key row: Anthropic has no sign-in or key-minting path for a third-party app (billing
sits behind the key, and a subscription login is barred by their terms), so its arm is a
click on any console.anthropic.com link, document-wide, since the setup step's steps sit
outside the row. `desktop/dev/key-clipboard.test.cjs` runs the shapes for real and pins
the wiring.

## First live probe (2026-09-13, parent in demo mode, in review, DCR not yet enabled)

Derive answered `start` with the authorize URL, the sign-in landed on the loopback
callback (so the redirect URI is registered right), `state` came back and matched (the
app now requires it), and the token exchange succeeded. `POST /clients` returned 403 with
an empty body: the expected refusal until Unsplash enables Dynamic Client Registration
on the parent. Derive now says so in its message. Re-run the probe
(`scratchpad/unsplash-connect-probe.mjs`, or the app's Connect button) once Unsplash
confirms.

## Open questions

- The child application's response field for the key. The code reads `client_id`, then
  `access_key`, then `client.client_id`; confirm on the first live exchange.
- Rendering the photographer credit on the built site (an Unsplash guideline) is still the
  follow-up noted in the image-sourcing memory.
