# Spec: In-app Publish (GitHub + Vercel integration)

**Status:** draft / plan of record
**Date:** 2026-08-05
**Where it lands:** the Electron app (`electron` branch, `desktop/`). Not the template scaffold.
**Author context:** written against the current `desktop/main.cjs`, `preload.cjs`, `shell.js` scaffold.

---

## 1. Goal

Give the designer a single place, inside the app, to go from "I have a design" to
"here is a live, password-gated URL I can send my client," without ever opening a
terminal, GitHub, or the Vercel dashboard. The app owns the whole chain: create the
repo, push the code, create the linked Vercel project, set the gate environment
variables, and hand back the live URL. Every publish after the first is one button.

This is the missing last mile. The rest of the product (brand, design, export) already
runs through the app; publishing is the one step that still requires the designer to
know git and Vercel.

## 2. The core insight

The default path publishes **straight to Vercel, no git involved**. Publishing then
reduces to the least the designer can possibly do: paste one Vercel token, click
Publish. The app runs the whole chain against Vercel alone:

1. **Project** create a Vercel project (no git repository attached).
2. **Env vars** set the gate password plus `CLIENT_NAME` / `PROJECT_TITLE` on the project
   (the edge gate in `middleware.js` cannot read `VITE_*`, so these must live in Vercel's
   environment, per the template's hard constraints).
3. **Deploy** upload the source tree; Vercel builds it and returns the gated URL.

No GitHub account, no repo, no Vercel-GitHub-app install hop. The edge gate deploys the
same way whether it came from git or a direct upload, so the password gate is unchanged.

The product is **one Connect and Publish flow that runs all three using the designer's
own Vercel auth**, then reduces every future publish to the app re-uploading on one
button (Vercel hash-dedupes files, so only changes go up).

GitHub becomes an **opt-in backup**, not the critical path (see 3.1 and 9.1).

## 3. Decisions already made

Settled across the 2026-08-05 conversation:

1. **Direct-to-Vercel is the default; GitHub is the opt-in fallback.** Direct deploy
   needs only a pasted Vercel token, the lowest-friction path to a gated URL. It gives up
   git history and an off-machine backup, but the app already covers the iteration safety
   net (per-project session history in `.thinkany/sessions/`, and the app now owns
   template updates, so the old "your git diff is the safety net" story no longer
   applies). GitHub is therefore a "back up my work / I want a repo I own" action, and
   full git-connected auto-rebuild is a later phase (9.1, Phase 3).
2. **isomorphic-git, not the system git binary** (for the GitHub backup path). A designer
   may not have git installed, and a Finder-launched packaged app has no `git` on PATH
   (the same problem already solved for `node` via `desktop/bin`). A pure-JS git means a
   designer with nothing installed can still back up.
3. **One "Connect and Publish" flow, not scattered buttons.** The value is the chain, not
   any single link.
4. **Vercel builds, the app uploads source.** The app uploads the source tree (minus
   `node_modules`); Vercel runs the build via `vercel.json`, identical to a git deploy.
   The app does not own a build toolchain, and the direct path stays in parity with the
   eventual git path.
5. **One Vercel project per design project.** The client visits `/?v=01`, `/?v=02`, and
   so on within a single gated deploy, matching the template's query-param routing. One
   env and gate config per project, not one deploy per variation.

## 4. Scope

**In scope**
- GitHub connection via OAuth Device Flow (in-app, no embedded webview, no localhost
  redirect server).
- Vercel connection via a pasted access token for the MVP (Vercel has no clean device
  flow; full OAuth is a later polish, see 9.3).
- Create a private GitHub repo from the current project and push it.
- Create a Vercel project linked to that repo.
- Read the project's config and write the gate env vars (`ADMIN_PASS`/`AUTH_PASS`,
  `CLIENT_NAME`, `PROJECT_TITLE`) to Vercel from the app.
- A per-project record of the repo and Vercel project so subsequent publishes are one
  click.
- A Publish panel in the sidebar rail.

**Out of scope (for now)**
- GitLab and Bitbucket (stubbed behind a provider seam, see 9.5).
- Team/collaboration features, PR flows, branch management.
- Custom domains (Vercel gives a `*.vercel.app` URL; custom domains are a later add).
- Unifying GitHub/Vercel identity with the existing derive license (kept separate, see 6.4).

## 5. How it fits the existing scaffold

The app already has every pattern this needs. The integration mirrors, it does not invent.

| Concern | Existing precedent | What Publish adds |
|---|---|---|
| Encrypted secret | `anthropic-key.enc`, `derive-license.enc` via `safeStorage` triad (`main.cjs:98-168`) | `github-token.enc`, `vercel-token.enc`, same triad, same pinned userData |
| Secret IPC shape | `license:status` / `license:save` / `license:clear` (`main.cjs:821-843`) | `github:*` / `vercel:*` status/save/clear |
| Authenticated HTTP | `validateLicense` POSTs with `x-license-key`, branches on status code (`main.cjs:172-189`), all `fetch`, no HTTP-client dep | GitHub + Vercel REST via `fetch` from main, header auth, status-code branching |
| Long op with progress | `agent:prompt` streams typed events on `agent:event` (`main.cjs:691-715`, `agent.mjs:173-229`) | `publish:progress` stream: create-repo, push, create-project, set-env, done |
| Mid-op user input | `agent:ask` / `pendingAsks` / `agent:answer` (`main.cjs:701-779`) | the device-flow "enter this code" step |
| Per-project state | `<project>/.thinkany/` (sessions, copy-voice, research) | `<project>/.thinkany/publish.json` |
| Sidebar panel | rail button + `PANELS` entry + `render*` fn; `renderFigma` is the token-entry model (`shell.js:941-1001`) | `rail-publish` + `PANELS.publish` + `renderPublish()` |
| Network from main, never renderer | `preview:probe` runs in main to dodge CORS (`main.cjs:912`) | all GitHub/Vercel calls in main; renderer sees status only |

**Load-bearing constants that must not change:** `USER_DATA_ID` (`@figma/my-make-file`)
and `appId` (`design.thinkany.app`) key the keychain the new `.enc` files rely on
(`main.cjs:22-38`).

## 6. Auth

### 6.1 GitHub, OAuth Device Flow

The right flow for a desktop app. No password touches the app; the user's own 2FA fires
on github.com, not here. We delegate the second factor, we never build one.

Prerequisite (one-time, Rob): register a **GitHub OAuth App** under a thinkany account.
It yields a public `client_id`. Device flow needs no client secret, so nothing secret
ships in the binary. Enable "Device Flow" on the app.

Runtime flow (all in the main process):

1. `POST https://github.com/login/device/code` with `client_id` and `scope`. Returns
   `device_code`, `user_code`, `verification_uri`, `interval`, `expires_in`.
2. App shows `user_code` and opens `verification_uri` (`github.com/login/device`) in the
   browser via `shell.openExternal`. The renderer displays the code prominently (this is
   where the `agent:ask`-style pause maps in, or a simple `publish:progress` event the
   panel renders).
3. Poll `POST https://github.com/login/oauth/access_token` with `client_id`,
   `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code` every
   `interval` seconds. Handle `authorization_pending` (keep polling), `slow_down`
   (back off), `expired_token` (restart), success (store token).
4. On success, `GET https://api.github.com/user` to confirm and capture `login` +
   `avatar_url` for display.

**Scopes:** `repo` (create and push, including private) and `read:user`. Nothing more.

**Token type:** an OAuth App device-flow token does not expire by default, which keeps
the model simple (no refresh loop). A GitHub App would give finer-grained, expiring
user-to-server tokens at the cost of a refresh flow. Recommendation: OAuth App for the
MVP; revisit only if scope-minimization demands it.

Store the token in `github-token.enc` (encrypted `safeStorage` triad). Inject nothing
into the agent subprocess env (unlike the Anthropic key, the git token stays inside the
main process and is used only by the publish handlers).

### 6.2 Vercel, pasted access token (MVP)

Vercel has no first-class device flow; its OAuth is an Integrations flow that expects a
hosted redirect URI. For the MVP, mirror the existing token-paste UX exactly (the
`renderFigma` license input): the user creates a token at
`vercel.com/account/tokens`, pastes it, we validate with
`GET https://api.vercel.com/v2/user`, and store it in `vercel-token.enc`.

If the user belongs to Vercel teams, list scopes with
`GET https://api.vercel.com/v2/teams` and let them pick the target team; persist the
chosen `teamId` (non-secret) in userData. All subsequent Vercel calls pass
`?teamId=` when a team is selected.

Full Vercel OAuth (loopback redirect or a custom `thinkany://` protocol handler) is a
Phase 3 polish that removes the manual token step.

### 6.3 Where nothing secret ships

The GitHub `client_id` is public and safe to embed. No client secret exists in the
device flow. The Vercel token is user-provided. So the binary carries no distributable
secret, consistent with the current app.

### 6.4 Relationship to the existing license

GitHub and Vercel connection state is a **separate identity** from the derive license.
License answers "may this app use paid features." GitHub/Vercel answer "which of the
designer's accounts do we publish to." Keep them separate stores and separate status,
but surface the connection state next to the existing auth UI in the rail.

## 7. The Connect and Publish flow (default: direct to Vercel)

The one-time chain, streamed as `publish:progress` events so the panel narrates each
step the way chat narrates agent activity.

**Preconditions checked first:** Vercel connected, a current project with a
`previewReady` design. GitHub is not required.

1. **Create the Vercel project (no git).** `POST https://api.vercel.com/v11/projects`
   with `{ name }` and no `gitRepository`. Name derives from the project (slug of
   `CLIENT_NAME`/project name), with a collision suffix if it exists. Pass
   `?teamId=` when a team scope is selected.
2. **Set the gate env vars.** For each of `ADMIN_PASS`/`AUTH_PASS`, `CLIENT_NAME`,
   `PROJECT_TITLE`: `POST https://api.vercel.com/v10/projects/{id}/env` with
   `{ key, value, type: 'encrypted', target: ['production','preview'] }`. Values come
   from the project config (`CLIENT_NAME`/`PROJECT_TITLE` are already known from the
   `.env` / company profile) plus the gate password from the panel (see 8.3). Doing this
   before the first deploy means the deployment picks the vars up.
3. **Upload the source tree.** Walk the project dir, skipping `node_modules` and the
   throwaway `package-lock.json` (the same set the template `.gitignore` excludes). For
   each file, `POST https://api.vercel.com/v2/files` with the content and its `sha1`
   digest; Vercel skips blobs it already has, so re-deploys upload only what changed. The
   tree must include `pnpm-lock.yaml` and `vercel.json` (both in the template), so Vercel
   builds with pnpm exactly as a git deploy would.
4. **Create the deployment.** `POST https://api.vercel.com/v13/deployments` referencing
   the project and the uploaded file shas, targeting production. Vercel runs the build
   (Vite + pnpm per `vercel.json`); the edge `middleware.js` gate ships as part of the
   uploaded project.
5. **Poll to ready** (`readyState` on the deployment) and resolve the project's
   production URL (`{project}.vercel.app`).
6. **Record the linkage** in `<project>/.thinkany/publish.json` and show the live URL
   with a copy button and an "open" button.

**Subsequent publishes** collapse to: re-upload changed files, create a new production
deployment. Exposed as a single "Publish changes" button (`publish:push`), streaming the
same progress events. No git, no push semantics; the app is the deploy trigger.

**The GitHub backup path (opt-in, Phase 2)** is a separate action, not part of this
chain: connect GitHub (device flow), create a private repo, push with isomorphic-git
(`onAuth: () => ({ username: token, password: 'x-oauth-basic' })`). It gives the designer
version history and a repo they own; it does not change how publishing to Vercel works.
Full git-connected auto-rebuild is Phase 3 (9.1).

## 8. Environment variable management

A first-class panel section, because "never touch the Vercel dashboard" is a core
promise.

1. **Read.** `GET https://api.vercel.com/v10/projects/{id}/env` to list current keys
   (values for encrypted vars are not returned; show key + presence, not the secret).
2. **Write / update.** `POST` for new, `PATCH .../env/{envId}` for existing.
3. **The gate password** (`ADMIN_PASS`/`AUTH_PASS`) is the one value the designer must
   set. Offer app-generated (a strong random string shown once, with copy) or
   user-entered. The app is the source of truth at publish time; store only a "set /
   not set" flag locally, never the password itself in `publish.json`.
4. `CLIENT_NAME` / `PROJECT_TITLE` prefill from the project and are editable inline.

## 9. Open risks and the calls I am making

### 9.1 Git-connected Vercel is deferred, not default
Linking a repo to a Vercel project via API requires Vercel's GitHub app to have read
access to that repo, which is a browser authorization that cannot be fully automated.
Because direct-deploy is now the default, that hop is off the critical path entirely. It
only appears if a designer opts into full git-connected auto-rebuild (Phase 3), where the
install is presented as a clearly labeled one-time step, verified via API before the
project link.

### 9.2 GitHub OAuth App registration
Requires a thinkany-owned OAuth App with device flow enabled. **Action for Rob, but it no
longer blocks the MVP:** it is only needed for the GitHub backup path (Phase 2). Phase 0
(direct publish) needs nothing from Rob. The resulting `client_id` gets embedded (public,
safe).

### 9.3 Vercel auth is token-paste, not OAuth (MVP)
Vercel lacks a clean desktop device flow, so the MVP uses a pasted access token, matching
the existing license input UX. Full Vercel OAuth (loopback redirect or a `thinkany://`
protocol handler) is a Phase 3 polish that removes the manual token step.

### 9.4 Source-upload deploys re-run the build each time
Direct deploys upload source and let Vercel build (decision 3.4). Vercel hash-dedupes the
uploaded files, so only changed files transfer, but each publish still triggers a fresh
Vercel build. That is the intended parity with the git path and is fine for the preview
cadence. If build minutes ever become a concern, decision 3.4 can be revisited to upload
prebuilt output instead.

### 9.5 Provider seam for GitLab / Bitbucket
Structure the GitHub backup calls behind a small provider interface (`createRepo`,
`push`, `repoUrl`) so GitLab/Bitbucket can slot in later. Build GitHub fully; stub the
others.

## 10. Data model

**Global, encrypted (userData, `safeStorage`):**
- `github-token.enc`, `vercel-token.enc`.

**Global, plaintext (userData, non-secret identity, mirrors `company-profile-default.json`):**
- `github-user.json` = `{ login, avatarUrl }`.
- `vercel-scope.json` = `{ userId, teamId?, teamName? }`.

**Per-project (`<project>/.thinkany/publish.json`, non-secret, mirrors sessions/voice/research):**
```json
{
  "github": { "repo": "owner/name", "url": "https://github.com/owner/name" },
  "vercel": { "projectId": "prj_…", "url": "https://…vercel.app", "lastDeployAt": "…" },
  "gatePasswordSet": true,
  "envKeys": ["CLIENT_NAME", "PROJECT_TITLE", "ADMIN_PASS"]
}
```
No secrets in `publish.json`. Timestamps are stamped by the main process at write time.

## 11. IPC surface

New `ipcMain.handle` channels (main) with `window.desktop.*` wrappers (preload),
namespaced `noun:verb`, plus one push channel modeled on `agent:event`.

**GitHub**
- `github:status` -> `{ connected, login, avatarUrl }`
- `github:connectStart` -> begins device flow; returns `{ userCode, verificationUri, expiresIn }`; opens the browser
- `github:disconnect` -> clears `github-token.enc`
- (push) `github:progress` -> device-flow state: `pending`, `connected`, `expired`, `error`

**Vercel**
- `vercel:status` -> `{ connected, user, teamName? }`
- `vercel:save` (`{ token }`) -> validate, store, return `{ ok }`
- `vercel:scopes` -> `{ teams: [...] }`
- `vercel:selectScope` (`{ teamId }`)
- `vercel:clear`

**Publish**
- `publish:status` -> per-project `{ linked, repoUrl, liveUrl, lastDeployAt, envKeys }`
- `publish:link` -> the one-time chain (7.1 to 7.7); streams `publish:progress`
- `publish:push` -> subsequent commit + push; streams `publish:progress`
- `publish:env:get` -> current Vercel env keys
- `publish:env:set` (`{ key, value }`) -> upsert one var
- (push) `publish:progress` -> `{ step, status, detail }` per step, terminal `{ step:'done', url }`

All GitHub/Vercel `fetch` calls run in the main process. The renderer and the embedded
`<webview>` never see a token.

## 12. UI: the Publish panel

A new rail button (`rail-publish`) and `PANELS.publish` entry with a `renderPublish()`
cloned from `renderFigma` (token/status UX) and `renderClaude` (status row plus a
conditional licensed block). Sections, gated top to bottom:

1. **Connections** a Vercel status row (connect/disconnect) as the primary control, plus
   a GitHub row for the opt-in backup, using the `.badge ok|off` + `.panelbtn` helpers
   already in `shell.js`. GitHub connect renders the device code and a "waiting for
   authorization" state.
2. **This project** once Vercel is connected: the live URL if published, or a primary
   "Connect and Publish" button if not, plus a "Publish changes" button once published.
   A secondary "Back up to GitHub" action appears when GitHub is connected.
3. **Environment** the gate password control (generate/enter, set/not-set), plus
   editable `CLIENT_NAME` / `PROJECT_TITLE`, writing through `publish:env:set`.
4. **Progress** a live log of `publish:progress` steps during a run, narrated in plain
   language the way `friendlyActivity()` narrates agent events.

Reuse `setRow`, `.field`, `.badge`, `.panelbtn`. No new design system.

## 13. Dependencies to add

- **isomorphic-git** plus its Node HTTP client (`isomorphic-git/http/node`). Pure JS, no
  native modules, works in the packaged app (asar is already `false`). This is the only
  new runtime dependency.
- **No HTTP client** (`fetch` is built in) and **no GitHub/Vercel SDK** (raw `fetch`
  matches the house style in `validateLicense`/`validateKey`). Octokit is optional sugar,
  deliberately skipped to keep deps light.

## 14. Phased plan

- **Phase 0, direct publish (the payoff, zero external setup).** Vercel token connect
  (`vercel:save`/`status`/`clear`, `vercel-token.enc`), scope pick, and the `publish:link`
  chain from section 7: create project, set gate env vars, upload source, deploy, resolve
  the live URL, record `publish.json`. The Connections (Vercel) row and This-project
  section of the panel. Ship this alone; it needs nothing from Rob.
- **Phase 1, env panel and republish.** `publish:push` for subsequent deploys, the env
  editor (`publish:env:get`/`set`), the gate-password generate/enter control.
- **Phase 2, GitHub backup (opt-in).** OAuth App registered (9.2). Device flow in main,
  `github-token.enc`, `github:*` channels, the GitHub Connections row, create private repo
  + push via isomorphic-git, a "Back up to GitHub" action recording the repo in
  `publish.json`. Independent of the Vercel path.
- **Phase 3, polish and git-connected.** Full git-connected Vercel with the one-time
  GitHub-app install (9.1) for anyone who wants push-to-rebuild, the provider seam for
  GitLab/Bitbucket (9.5), and full Vercel OAuth to retire the token paste (9.3).

## 15. Immediate next actions

1. Start Phase 0 against the `electron` branch. It has no external blocker.
2. Rob, when convenient (unblocks Phase 2, not Phase 0): register the thinkany GitHub
   OAuth App with device flow enabled, capture the `client_id`.
