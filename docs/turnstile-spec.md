# Spam protection for forms: Cloudflare Turnstile, set up by the app

**Status:** spec'd 2026-09-12 from Rob's direction. NOT built. Replaces the reCAPTCHA v3
line item in [forms-spec.md](forms-spec.md) (P3): Turnstile only, no Google. The
per-form `recaptcha` toggle that exists today is stored but wired to nothing; this is
what wires it, renamed.
**Depends on:** forms P2 (delivery, built). **Sequence:** before P4 (CRM sync), as the
forms spec already orders it.
**Estimate:** two and a half days. Base protection one day; the app-managed keys
("Layer 2") a day and a half.

## Why Turnstile, and why this much of it

Turnstile over reCAPTCHA v3 because it fits the pipeline with less: its widget injects
its own token into the enclosing form, so the native-POST fallback stays protected; the
verify call is a yes or no, no score to tune; no cookies, no puzzles, no badge; and a
site key needs a free Cloudflare account, not a Google Cloud project.

The onboarding both vendors offer is the friction. Three layers were weighed:

1. Paste keys, but validate on paste and guide the steps (the image-library pattern).
   Leaves one widget to create per site by hand, and two copies.
2. **One API token, the app creates the widget per site at publish.** The designer
   never opens the Turnstile dashboard after a one-time token. This spec.
3. thinkany-owned widgets and verification through derive. Zero setup, but thinkany
   becomes an operational dependency for every protected form. Later, as a licensed
   convenience, once the usage and the licence are clearer.

Layer 2 is built so that Layer 1 is its fallback (paste a site key and secret by hand
when there is no token) and Layer 3 can replace the key source without touching the
site side.

## The flow

**Once, in Keys & Licences.** A "Cloudflare Turnstile" card. The designer creates an
API token in the Cloudflare dashboard (the card links straight to the create-token
page and names the one permission: Turnstile, Edit, on the account) and pastes it.
The app validates it at once (a request that lists the account's widgets), stores it in
userData like the Pexels key, and remembers the account id it resolved. From then on
the card says "Connected" with the account name.

**Per form, in the Forms tab.** The Delivery fold's toggle becomes **Spam protection**
with the note "Cloudflare Turnstile. A small check the visitor completes without a
puzzle." Stored as `turnstile: true` on the form (the current `recaptcha` key, migrated
on read). The honeypot and the timing check stay on for every form regardless.

**At publish, silently.** When any form has protection on and the site is being
published to Vercel:

1. The app looks up the site's widget by name (`thinkany:<project id>`) in the
   account. None yet: create it with the site's hostnames (the Vercel production
   hostname plus every custom domain attached in the Publish drawer), mode
   `managed`. Exists: update its hostnames if a domain was added or removed.
2. The response carries the site key and the secret. The site key is written to
   `content/site.json` under `forms.turnstileSiteKey` (public, the page renders it).
   The secret goes to the site's Vercel project as `TURNSTILE_SECRET`, through the
   same `siteEnv` map that carries `FORMS_*` today (main.cjs, publish.cjs). It is never
   written to the project.
3. The publish progress row "forms" reports it: "Spam protection on (Turnstile)".

No token and protection on: the publish row warns ("Spam protection is on but no
Cloudflare token is connected; forms are sending without it") and the site publishes
with the honeypot and timing check only. Never a silent switch, never a blocked
publish. The Delivery fold offers the Layer 1 fallback in that case: paste a site key
and secret by hand, saved to the same two places.

**On the page.** The built-in Form block (and a promoted block with a form field)
renders, when the site has a site key and the form has protection on: the Turnstile
script (`challenges.cloudflare.com/turnstile/v0/api.js`, deferred, once per page) and
`<div class="cf-turnstile" data-sitekey="…" data-action="<form id>" data-theme="auto">`
between the fields and the submit button. Turnstile adds a hidden
`cf-turnstile-response` input to the form itself, so both the enhanced submit
(form-client.ts posts the FormData as JSON) and the native POST carry the token
without any code of ours. The design surface's preview is inert: form-client already
never sends in preview, and the block does not load the script when `__taFormsPreview`
is set.

**On the server.** `api/forms.js`, beside the honeypot and timing checks: when the form
has protection on and `TURNSTILE_SECRET` is set, POST the token to
`https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret and the
visitor's IP. Not `success`, or the response's `action` is not the form's id: reply 200
`{ ok: true }` and drop it, exactly as the honeypot does (spam is never told it was
caught). No secret in the environment but protection on: log once, deliver anyway
(the publish warning is the designer's signal, not a broken form). A Cloudflare
outage: fail open, log it.

## Development and preview

Cloudflare publishes test keys that need no account: a site key that always passes,
one that always blocks, one that forces the interactive check, and a secret that
always passes. The site's dev server uses the always-pass pair when the project has no
real key, so a designer sees the widget in place and a submission succeed before any
Cloudflare account exists, and the harness can exercise the block route on the
always-block key.

## Data and storage

- userData: `turnstile.json` `{ token, accountId, accountName, checkedAt }` (the
  Pexels key file pattern; `turnstile:status`, `turnstile:save`, `turnstile:clear`
  IPC like `pexels:*`). The token is a secret: never in the project, never logged.
- `content/site.json` `forms.turnstileSiteKey` (public) and, for the hand-pasted
  fallback only, nothing else: the secret still goes to Vercel env, entered in the
  Delivery fold and stored in userData under the project (`forms-delivery` already
  keeps the provider key that way).
- `content/forms/<id>.json`: `turnstile: boolean` (reads the old `recaptcha` key as
  the same thing; the writer emits `turnstile`).
- `.thinkany/turnstile.json`: the widget the app created for this project
  `{ sitekey, hostnames, createdAt }`, so a re-publish updates rather than creates.

## Cloudflare API (account scope, the token's one permission)

- `GET /accounts` (resolves the account id and name at token save; if the token
  cannot list accounts, the card asks for the account id, shown on the dashboard's
  overview page).
- `GET /accounts/{id}/challenges/widgets` (validation, and the lookup by name).
- `POST /accounts/{id}/challenges/widgets` `{ name, domains, mode: "managed",
  region: "world" }` → `{ sitekey, secret, … }`.
- `PUT /accounts/{id}/challenges/widgets/{sitekey}` to update `domains`.
- Verify: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
  `{ secret, response, remoteip }` → `{ success, "error-codes", hostname, action }`.

Errors surface in the app's words: an expired or under-scoped token ("The Cloudflare
token can't manage Turnstile widgets; make a new one with the Turnstile Edit
permission"), a widget limit reached ("This Cloudflare account has reached its widget
limit; remove an unused one or paste this site's keys by hand"), a hostname rejected.

## The app, screen by screen

- **Keys & Licences → Cloudflare Turnstile card**: intro line, the numbered steps with
  the dashboard link, the token field, Connect; connected state with the account name
  and Disconnect. Same shape as the Pexels card.
- **Forms tab → Delivery fold**: the Spam protection toggle (per form) and, folded
  under "Use your own keys" when no token is connected, the site key and secret
  fields with validation on paste (verify with a dummy token distinguishes a bad
  secret from a bad token).
- **Publish drawer**: the forms row's detail names protection when it is on; the
  warning above when it is on without keys.
- **Help**: the Forms help panel gains a Spam protection section.

## Help copy: the Cloudflare steps, written for the Help modal

Two walkthroughs. The first is the one everyone does; the second only when no token
is connected. Both open from the Keys & Licences card and the Delivery fold, in the
Help modal's numbered style (like the Vercel and Unsplash steps). Screens named as
Cloudflare labels them in 2026; keep the copy in step with the dashboard.

### A. Connect Cloudflare (once): make an API token

Intro: "thinkany design creates and updates the Turnstile widget for each site you
publish. To let it, make one API token in your Cloudflare account and paste it here.
You do this once. You never need the Turnstile pages of the dashboard after this."

1. **Sign in to Cloudflare** at dash.cloudflare.com. No account yet? Create a free one;
   the site does not have to be on Cloudflare for Turnstile to work.
2. **Open your profile.** Click the person icon at the top right, then **My Profile**.
3. **Go to API Tokens.** In the left column, click **API Tokens**, then **Create Token**.
4. **Start a custom token.** Scroll past the templates to **Create Custom Token** and
   click **Get started**.
5. **Name it** something you will recognise later, such as "thinkany design".
6. **Give it one permission.** Under Permissions choose **Account**, then
   **Turnstile**, then **Edit**. Nothing else.
7. **Point it at your account.** Under Account Resources choose **Include** and your
   account. Leave client IP filtering and TTL as they are.
8. **Create it.** Click **Continue to summary**, check it reads "Turnstile: Edit" for
   your account, then **Create Token**.
9. **Copy the token now.** Cloudflare shows it once. Paste it into the field here and
   click **Connect**. If you lose it, roll it from the API Tokens page and paste the
   new one.
10. **Your account ID**, if the app asks for it: it is the long string of letters and
    numbers in the dashboard's address after `dash.cloudflare.com/`, and it is shown
    as **Account ID** on the right of any site's Overview page.

What the app does with it: at every publish it looks for this site's widget in your
account, creates it if it is missing, keeps its hostnames in step with your custom
domains, and puts the secret key on the site's Vercel project. You can see the widgets
it made under **Turnstile** in the dashboard; they are named after the project.

Do not click: **Set up with Spin** or **Add widget manually** on the Turnstile page.
Those make a widget by hand; the app does that for you.

### B. Paste this site's keys yourself (only without a token)

Intro: "No Cloudflare token connected, so the app can't make the widget for you. Make
it by hand for this site and paste its two keys here. You will do this for each site
you protect, and again if the site's domain changes."

1. **Sign in to Cloudflare** and open **Turnstile** in the left column.
2. Click **Add widget manually** (not Set up with Spin).
3. **Widget name:** the site's name.
4. **Hostnames:** add the site's address without `https://`, for example
   `client.com`, and its Vercel address, for example `client-site.vercel.app`. Add
   `www.client.com` too if the site answers there. A hostname covers its subdomains.
5. **Widget mode:** **Managed**. Leave Pre-clearance off.
6. Click **Create**.
7. Cloudflare shows a **Site Key** and a **Secret Key**. Paste both here. The app
   checks the secret the moment you paste it.
8. When the site's domain changes later, open the widget in Cloudflare, add the new
   hostname under Hostname management, and publish again.

### Messages the app shows

- Token connected: "Connected to Cloudflare as <account name>."
- Token refused: "Cloudflare didn't accept that token. Make a new one with the
  Turnstile: Edit permission on your account (step 6)."
- Token can't create widgets: "This token can't manage Turnstile widgets. Make a new
  one with Turnstile: Edit (step 6), not a template."
- Widget limit: "This Cloudflare account has reached its Turnstile widget limit.
  Remove a widget you no longer use in Cloudflare, or paste this site's keys by hand."
- Secret checked (fallback): "That secret key works." / "That doesn't look like this
  widget's secret key. Copy it again from the widget's page in Cloudflare."

## Not in scope

reCAPTCHA in any form. Turnstile's invisible mode (Cloudflare can still show a
challenge, so the slot is needed anyway; `managed` is the honest default). Per-form
widgets (one per site is what the hostname binding wants). Layer 3.

## Phases

1. **Protect** (one day): the block markup and script, the site key in site.json, the
   handler's verify, the test keys in dev, the toggle renamed and migrated, the
   hand-paste fallback in the Delivery fold with validation, `TURNSTILE_SECRET` in
   `siteEnv`. Test: the mocked handler test gains the verify cases (pass, fail, no
   secret, outage); the site builds with a protected form.
2. **Manage** (a day and a half): the token card and IPC, the widget lookup / create /
   update at publish with the hostnames, the publish row wording, the errors above,
   `.thinkany/turnstile.json`. Test: the Cloudflare calls behind a small client module
   with a mocked fetch (create, reuse, domain update, each error).

## Open questions (settle before phase 2)

- Cloudflare's widget limit and hostname-per-widget limit on the free plan: decides
  whether an agency with many client sites needs the paid plan, and what the limit
  error should suggest.
- Whether a token scoped only to Turnstile Edit can list accounts. If not, the card
  asks for the account id, which is easy to find: it is in the dashboard's URL after
  `dash.cloudflare.com/` and on any site's Overview page (help step A10).
- Whether the `.vercel.app` preview hostname should be on the widget (yes by default,
  so the site works before a custom domain exists; confirm Cloudflare accepts it).
