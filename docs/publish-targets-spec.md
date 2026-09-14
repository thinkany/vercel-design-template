# Publish targets beyond Vercel (a provider layer under Publish)

**Status:** TODO, sketched 2026-09-14 from Rob's ask ("are there other platforms we could
publish a built site to, not the gated bits"). Not built, not scheduled. The gated design
preview (middleware.js, Vercel edge) stays Vercel-only and is out of scope here; this is
about the SITE target only (the Astro build in dist-site plus the forms function).

## Why it is small

The published site is static Astro output (`site/astro.config.mjs`, `output: "static"`,
`build.format: "file"`) plus one Node function (`api/forms.js`) and a few Vercel
conventions. Everything Vercel-specific lives in `desktop/publish.cjs`:

- The deploy API: sha1 file digests, createDeployment, poll, domains, env vars.
- The forms handler shape: the `api/` folder and the `(req, res)` signature.
- Redirects and `includeFiles` in the generated vercel.json.
- Extensionless URLs: the build writes `about.html`, Vercel's clean URLs serve `/about`.
- OAuth sign-in for the designer (Sign in with Vercel, PKCE).

## Candidate targets, in order of how little changes

1. **Netlify** (first). Deploy API also works on file digests. Functions in
   `netlify/functions` with a Request/Response handler, redirects in `_redirects`,
   API endpoints for env vars and custom domains, supports OAuth apps. Netlify Forms
   could replace the forms function, but that drops provider delivery (Resend,
   Postmark, SendGrid) and Turnstile, so keep our function.
2. **Cloudflare Pages / Workers static assets** (second). Direct Upload via REST,
   Pages Functions at `functions/api/forms.js` (`onRequestPost({ request, env })`),
   `_redirects`, extensionless HTML served automatically. Turnstile is already
   Cloudflare, so spam protection and hosting share one account. Auth is an API
   token, not OAuth; the clipboard-filled Keys card covers that.
3. **GitHub Pages.** Static only: push to a branch or the Pages artifact API, custom
   domains. No functions, so forms need the relay fallback still open in
   forms-spec.md. Pairs with the opt-in GitHub backup path never built.
4. **Firebase Hosting.** REST deploy API, rewrites in firebase.json, Cloud Functions
   for forms. Works, but a Google Cloud project per site is heavy for a designer.
5. **Plain SFTP / rsync to any host** (cPanel, Kinsta, Hostinger, the client's
   existing host). Upload dist-site. Forms need the relay; extensionless URLs need an
   `.htaccess` rewrite the publish step generates. The escape hatch for "my client
   already pays for hosting."

Render, DigitalOcean App Platform, and S3 + CloudFront all work but add account and
infrastructure setup without offering anything the first three do not.

## Shape of the work

- **Forms core.** Refactor `api/forms.js` into a Web-standard Request/Response core
  with thin per-provider adapters (Vercel, Netlify, Cloudflare each a few lines).
- **Provider interface** in `desktop/publish.cjs`: upload files, set env, add domain,
  resolve URL, poll. The Vercel code already has exactly these verbs.
- **Per-provider config emit** from the same site.json data: vercel.json redirects and
  clean URLs vs `_redirects` vs `.htaccess`.
- **Publish panel**: a target picker per project (stored in `.thinkany/publish.json`),
  connect card per provider (OAuth where the provider offers it, pasted token otherwise).

## Phases

- P1 Netlify (deploy + forms adapter + `_redirects` + env + domain).
- P2 Cloudflare (Direct Upload + Pages Function + Turnstile account reuse).
- P3 Static export: a zip of dist-site with `.htaccess`, plus optional SFTP, gated on
  the forms relay.
- GitHub Pages and Firebase only if a need surfaces.
