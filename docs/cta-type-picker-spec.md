# Contact / CTA type picker — Form vs Contact Button — spec

**Status:** BUILT 2026-08-29 (feature/onboarding-intake, uncommitted). Spec'd 2026-08-28. Author: Rob's ask.
Default no-backend behavior: fake success state (option 1). Fixed field set (name/email/message).
**Where:** electron app intake picker (`desktop/shell.js` + `shell.html` + `copy.js`),
`main.cjs` phrase injection; scaffold `/design` build rule.

## Summary / feasibility

When **"Contact"** or **"CTA" / "Call to action"** is among the selected sections, offer
a choice for how that section is built: **Form** or **Contact Button**. Feasible now:
`react-hook-form@7.55.0` + the full shadcn form kit (`form/input/textarea/select/checkbox/
label/button`) are installed. **Caveat: no backend** — a form is *designed* (visually
complete, client-validated) but cannot submit server-side; see "No-backend handling".

## The picker

Mirrors the hero/menu pickers, gated on the sections list (like hero is gated on "Hero"):

- **Gate:** show this step only when the sections include **Contact** OR **CTA / Call to
  action** (case-insensitive match on the chosen sections).
- **Choice (two wireframe chips, single-select, skippable "let you choose"):**
  - **Form** (`cta-form`): a contact form (name / email / message + submit).
  - **Contact Button** (`cta-button`): a CTA section with a prominent button/link ("Get
    in touch", "Book a call") + contact details, no form.
- Placement: alongside the other section-driven pickers (after sections; order relative
  to hero/menu is a build detail). Simple binary, no nested reveal needed.

## Data model

- New Brief field **`ctaType`** = `cta-form` | `cta-button` | null (agent decides).
- `main.cjs` phrase injection (like HERO/MENU), e.g.:
  - `cta-form`: "Build the contact/CTA section as a contact form (name, email, message,
    submit), using react-hook-form + the shadcn form components, client-validated."
  - `cta-button`: "Build the contact/CTA section as a button-led call to action (a
    prominent button/link + supporting contact details), not a form."

## Build guidance (scaffold `/design`)

- **Form:** react-hook-form + shadcn `form/input/textarea/label/button`; client-side
  validation + inline errors; a graceful **success state** on submit ("Thanks — we'll be
  in touch"). Tokens/utilities only, container queries, matches the design direction.
- **Contact Button:** a focused CTA section, headline + a prominent button + contact
  details (email/phone/social); no form fields.

## No-backend handling (the implication)

The template has no server, so a form can't POST anywhere. Design it to feel real without
one, in priority order:
1. **Client-validated + fake success state** (default) — validates, then shows a success
   message; no real send.
2. **`mailto:`** — submit opens the visitor's email client (works on the static deploy);
   good when the client wants a working contact affordance now.
3. **Handoff placeholder** — leave a clearly-marked spot for the client to wire a form
   service (Formspree / Netlify Forms / their own endpoint) after handoff.
The build phrase should state there's no backend so the model builds (1) by default and
doesn't invent a fake API call. Decide at build whether `mailto:` is the better default.

## Figma export

Straightforward — a form is static DOM (inputs, labels, button), so it exports to Figma
cleanly with no special handling (unlike the slider's interactive-state problem). The
success state is a runtime toggle, so the export shows the default (empty) form, which is
correct.

## Open questions for build kickoff

- Default no-backend behavior: fake success state vs `mailto:` (recommend fake success).
- Does the CTA picker also apply when the section is literally named "CTA" but the design
  is button-led by nature? (Gate is fine; the choice just makes it explicit.)
- Form field set: fixed (name/email/message) or let the direction/brief shape it?

## Related

- [[design-variety-feature]] / [[hero-slider-option]] — the section-gated picker family
  (hero, header/menu, and now CTA type). Reuse the same client-rendered card + gating +
  phrase-injection pattern.
