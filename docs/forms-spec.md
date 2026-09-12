# Forms (a Forms tab in the site builder)

**Status:** spec'd 2026-09-04 from Rob's brief and answers. P1 (define and place) BUILT and app-tested 2026-09-04. P2 (deliver) BUILT 2026-09-04: api/forms.js + site/src/lib/forms-providers.mjs (Resend, Postmark, SendGrid), Delivery card (provider, from, key in userData, Send a test), FORMS_* env vars set or cleared on site publish, includeFiles in the site vercel.json; verified by a mocked handler test, site build and type check; not yet app-tested or live-published. P3 not started. reCAPTCHA keys moved to P3 with the verification; **2026-09-12: P3 spam protection is Cloudflare Turnstile, not reCAPTCHA, with the app creating the widget per site from one API token, see [turnstile-spec.md](turnstile-spec.md).** P4 (CRM sync, Mailchimp first) added 2026-09-12 as a follow-on after P3, NOT built.

## Goal

A designer defines a form in the app (name, fields, submit label, what happens
after), places it on a page, and submissions reach the client by email once the
site is published. No terminal, no Vercel dashboard, no third-party form widget.

## How this fits Vercel

Vercel has no form product. The site is static (`site/astro.config.mjs`,
`output: "static"`), so a form needs a receiver. A file in the project's root
`api/` folder deploys as a serverless function at `/api/<name>` automatically,
whatever the build settings, so no routing is configured anywhere. The function
receives the POST and delivers it through a mail provider whose key is an env var
on the site's Vercel project. The publish path already sets env vars on a project
(`setEnv` in `desktop/publish.cjs`), so delivery is wired at publish time.

## Decisions (Rob, 2026-09-04)

1. **Delivery providers first.** Resend, Postmark and SendGrid are the encouraged
   path: the designer creates an account, verifies the client's sending domain,
   and pastes the provider key in the app. The app carries full instructions
   for each provider.
2. **The thinkany relay is the fallback**, licensed separately from Design and
   Figma (a third license in Keys & Licenses). With no provider key, submissions
   go through derive, which emails them on the client's behalf.
3. **Recipients**: one or more addresses per form, comma delimited.
4. **Reply-to** is a plain text field per form, placeholder `noreply@domain.com`,
   with help text on when to use a real address (so the client can reply from
   their inbox) versus a submitter's email (see field binding below).
5. **Forms is a top-level tab** in the site rail, beside Types.
6. **A designed form is recorded, not replaced.** The designer's contact section
   keeps its markup. When a design with a form is promoted, that form and its
   fields become an entry in the Forms tab and the promoted block binds to it. A
   generic Form block also exists for pages that need a form the design did not
   draw.
7. **Spam**: a hidden honeypot field on every form (always on), plus optional
   Google reCAPTCHA v3 (site key per site, secret in the app, verified server
   side).

## Data

### `content/forms/<id>.json` (designer-owned, one file per form)

```json
{
  "id": "contact",
  "name": "Contact",
  "fields": [
    { "id": "name",    "type": "text",     "label": "Name",    "required": true },
    { "id": "email",   "type": "email",    "label": "Email",   "required": true },
    { "id": "phone",   "type": "phone",    "label": "Phone" },
    { "id": "topic",   "type": "select",   "label": "Topic", "options": ["Sales", "Support"] },
    { "id": "message", "type": "textarea", "label": "Message", "required": true, "placeholder": "How can we help?" },
    { "id": "consent", "type": "checkbox", "label": "You may contact me about this enquiry" }
  ],
  "submit": { "label": "Send" },
  "after": { "mode": "message", "message": "Thanks, we'll be in touch within a day.", "page": null },
  "recipients": "hello@client.com, owner@client.com",
  "replyTo": "noreply@client.com",
  "replyToField": "email",
  "recaptcha": false,
  "updated": "2026-09-04T18:00:00.000Z"
}
```

- **Field types (v1)**: `text`, `email`, `phone`, `textarea`, `select`,
  `checkbox`. Each has `label`, optional `placeholder`, `help`, `required`;
  `select` has `options`. File upload is out of scope (needs storage).
- **Field id** is slugified from the label with the page-slug rule (lowercase,
  spaces to dashes), editable, unique within the form. Renaming an id after the
  site is live changes the key in every delivered email; the editor says so.
- **`after`**: `message` shows the thank-you text in place; `page` navigates to a
  page picked from `content/pages`. Both are the same POST; only the success
  behaviour differs.
- **`replyToField`**: optional; when set, the submitter's value in that field
  becomes the email's reply-to and `replyTo` is the fallback. Covers the common
  "reply straight to the person who wrote" case without a second concept.
- **Honeypot** is not a field in the list. Every form renders a visually hidden
  `website` input plus a submit-time token; the endpoint rejects a filled
  honeypot or a submission faster than three seconds.

### Site-level delivery (`content/site.json` → `forms`)

```json
"forms": { "provider": "resend", "from": "Website <forms@client.com>", "recaptchaSiteKey": "" }
```

Nothing secret lives in content. The **provider key**, the **reCAPTCHA secret**
and the relay license are stored by the app (safeStorage-encrypted in userData,
per project, like the Vercel token) and pushed to the site's Vercel project as
env vars on publish: `FORMS_PROVIDER`, `FORMS_PROVIDER_KEY`, `FORMS_FROM`,
`RECAPTCHA_SECRET`, `FORMS_LICENSE_KEY` (relay).

## The endpoint: `api/forms.js` (CORE, shipped by the scaffold and refresh)

One Node function, no dependencies, everything via `fetch`.

1. Accept `POST /api/forms` as JSON (the block's client) or
   `application/x-www-form-urlencoded` (a native post, JS off). The body carries
   `form` (the id), the field values, the honeypot and the timing token.
2. Load the form definition. `desktop/publish.cjs`'s site `vercel.json` gains
   `functions: { "api/forms.js": { includeFiles: "content/forms/**" } }` so the
   definitions ride with the function. Unknown form id: 404.
3. Reject spam: honeypot filled, token too young, or reCAPTCHA v3 score under
   0.5 when the form has it on (verify against Google with `RECAPTCHA_SECRET`).
4. Validate against the definition: required fields present, email shape, select
   value in options, length caps. Unknown keys are dropped.
5. Deliver. One `send()` in `site/src/lib/forms-providers.mjs` (Resend, Postmark,
   SendGrid; the relay arrives in P3), signature `send({ provider, key, from, to,
   replyTo, subject, text, html })`. Lives outside `api/` so the app can run it
   for "Send a test" and Vercel never mistakes it for a function. Subject `"<form name> from <site name>"`, body a
   labelled list of the fields in form order.
6. Respond. JSON `{ ok: true }` for the client; for a native post, `303` to the
   after-page or back to the referrer with `?sent=<form id>`.

If no provider and no relay license reached the deployment, the function returns
a clear 503 and the block shows "This form isn't connected yet." The publish log
warns before that ever happens (below).

## Rendering: the `form` prop kind and the Form block

- `site/src/lib/blocks.ts` (CORE) exports `formRef = z.string().describe("form")`.
  The block editor renders a form picker for the `form` kind, the way `richtext`
  and `image` get their own controls.
- `site/src/lib/form-client.ts` (CORE): the shared client. Serializes the form,
  adds the honeypot and timing token, fetches a reCAPTCHA token when enabled,
  posts to `/api/forms`, then shows the message or navigates. Without JS the
  `<form method="post" action="/api/forms">` still works through the 303 path.
- `site/blocks/Form.tsx` (designer-owned, copied in from a template the first
  time a form is created, like a promoted block): renders any form definition
  with the design's tokens and the shadcn inputs. Props: `formRef`, optional
  heading and intro. `hydrate: "visible"`, since today only the chrome hydrates.
- **Promoted contact sections** keep their own markup. `/promote-blocks` gains a
  step: for a section containing a `<form>`, write `content/forms/<id>.json` from
  its inputs (label, type, required, placeholder), give the block a `formRef`
  prop defaulting to that id, and route its submit through `form-client.ts`.
  The design-phase form (fake success) is untouched; Figma export is unaffected.
- **Site-tab preview**: Astro dev has no functions. An Astro integration
  (`site/src/lib/forms-dev.mjs`) answers `POST /api/forms` in dev with
  `{ ok: true, preview: true }`, and the block shows the thank-you state with a
  "Preview: nothing was sent" note.

## The Forms tab (site rail, after Types)

Left: the list of forms with "Used on" page counts, and "Add a form" (name →
id). Right: the editor for the selected form.

1. **Fields**: the list in order, drag to reorder, per-field label, id, required,
   placeholder, help, options (select). "Add a field" is a picker of the six
   types. Delete a field.
2. **Submit button**: label text (default "Submit").
3. **After submitting**: message, or go to a page (page picker).
4. **Delivery for this form**: recipients (comma delimited, each validated),
   reply-to text field with placeholder and help, "use the submitter's email as
   reply-to" bound to an email field when the form has one, reCAPTCHA toggle.
5. **Where it's used**: pages whose blocks reference the form; delete warns when
   the form is referenced.

A **Delivery** card at the top of the tab (site level, not per form) holds the
provider picker (Resend, Postmark, SendGrid, thinkany relay), the from address,
the provider key, the reCAPTCHA site key and secret, and a "Send a test" button
that runs the endpoint's provider module locally and reports the result. Each
provider has an instruction block: sign up, verify the client's domain, create a
key, what "from" must be, plus a link. The instructions live in `desktop/copy.js`
and in the tab's help entries.

**Publish**: `publishSite` sets the env vars, then logs "Forms: delivering via
Resend to hello@client.com" or warns "No delivery set up: forms on this site
won't send" (publish continues).

## Gating

The Forms tab is part of the site-builder license like the rest of the CMS. The
relay is a separate license (`FORMS_LICENSE_KEY`, Keys & Licenses, its own
status/save/clear IPC like the Design and Figma licenses). A site using its own
provider key never touches derive.

## Out of scope (v1)

File uploads, a submissions inbox in the app, conditional logic, multi-step
forms, radio groups (select covers them), storing submissions anywhere. A CRM
destination is out of v1 too, but it is specced as the P4 follow-on below
rather than ruled out.

## Phases

- **P1 Define and place**: `content/forms/*.json`, the Forms tab, `formRef`, the
  Form block, the dev preview shim.
- **P2 Deliver**: `api/forms.js`, the three providers, the Delivery card, keys in
  userData, env vars on publish, "Send a test".
- **P3 Capture and protect**: promote-blocks form capture, reCAPTCHA v3, the
  relay endpoint on derive and its license.
- **P4 CRM sync (follow-on, after P3)**: a submission can also land in a list CRM
  (Mailchimp first). Not a fourth `FORMS_PROVIDER`: `send()` is a transactional
  mail verb (`to`, `subject`, `html`) and a CRM's operation is an audience upsert
  (`PUT /3.0/lists/{id}/members/{hash}` with merge fields and tags), so it gets
  its own `site/src/lib/forms-crm.mjs` with a `subscribe()`. Shape:
  - **Email stays the system of record.** The sync runs in `api/forms.js` *after*
    `send()` succeeds, wrapped in its own try/catch that logs and swallows. A
    Mailchimp outage must never show the visitor an error or cost the client a
    lead, and it must not add latency before the thank-you.
  - **Per-form and opt-in**, as `mailchimp: { listId, emailField, tags,
    consentField }` in `content/forms/<id>.json`, so it inherits the existing
    `includeFiles` bundling. A contact form does not quietly join a mailing list.
  - **Consent is explicit**: `status: "pending"` (double opt-in) unless the form
    has a ticked `consentField`, which makes `"subscribed"` defensible. Same class
    of defect as a reCAPTCHA toggle wired to nothing: never ship a switch that
    subscribes people with no consent path.
  - **Key plumbing** reuses the `siteEnv` seam (`main.cjs` builds it,
    `publish.cjs` sets or deletes each key): `MAILCHIMP_KEY`, `MAILCHIMP_LIST_ID`.
    Mailchimp keys carry a datacenter suffix (`...-us21`) that the base URL must
    match, so parse it off the key rather than asking for a second field, and fail
    in the app's Delivery card at setup, not at request time on the live site.
  - **Ordering note**: P3's reCAPTCHA should land first. With a CRM attached, spam
    stops being junk email and starts polluting the client's audience and their
    paid contact count. Double opt-in is the floor if P4 ever ships first.
  - Mailchimp *Transactional* (ex-Mandrill) is a different product and would be a
    genuine peer in `send()`, roughly six lines. Out of scope here, and not what
    "a CRM like Mailchimp" means. Mailchimp's embedded signup form (browser posts
    straight to them, no key, no function) stays the option for a pure newsletter
    field, at the cost of their markup and no server-side validation.

## Files

- `content/forms/*.json`, `content/site.json` (`forms`): data.
- `api/forms.js`, `api/_providers/*.js`: the endpoint (CORE).
- `site/src/lib/forms-crm.mjs`: the CRM `subscribe()` (P4, CORE, not built).
- `site/src/lib/blocks.ts` (`formRef`), `site/src/lib/form-client.ts`,
  `site/src/lib/forms-dev.mjs`: rendering and dev (CORE).
- `site/blocks/Form.tsx`: the generic block (designer-owned, from a template).
- `desktop/main.cjs`: `site:forms`, `site:saveForm`, `site:deleteForm`,
  `site:formsDelivery`, `site:saveFormsDelivery`, `forms:test`, relay license IPC;
  `publishSite` env wiring. `desktop/publish.cjs`: `includeFiles` in the site
  `vercel.json`. `desktop/shell.js`: the tab. `desktop/copy.js`: copy and help.
- `.claude/commands/promote-blocks.md` and `desktop/skills/promote-blocks.md`:
  the form-capture step.
