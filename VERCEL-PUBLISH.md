# Publishing a design to Vercel

How to put a design online behind a password, straight from the app. No terminal,
no GitHub, no Vercel dashboard. This is the direct-to-Vercel path (Phase 0 of the
Publish feature).

## One-time setup: connect Vercel

You only do this once. The token is stored encrypted in your OS keychain and reused
for every future publish.

1. Open **vercel.com/account/tokens** (or click **Create a token on Vercel** in the
   Publish panel).
2. Create a token. Give it any name (for example "thinkany design"). Leave the scope
   at your account, or pick the team you want to deploy into. Copy the token.
3. In the app, click the **Publish** icon in the left rail (the cloud-with-arrow, near
   the top). The icon turns green once you are connected.
4. Paste the token and click **Connect Vercel**.
5. If your token belongs to one or more Vercel teams, a **Deploy to** dropdown appears.
   Pick **Personal account** or the team you want. This is remembered.

## Publish a design

1. Make sure the project you want to publish is open and has a finished design (the live
   preview is showing a real page, not the setup placeholder). The **Publish this design**
   button is disabled until a design is ready.
2. Open the **Publish** panel and click **Publish this design**.
3. Watch the progress: **Vercel project → Preview gate → Uploading files → Building on
   Vercel → Live**. The build (pnpm install plus the Vite build, run on Vercel) usually
   takes one to two minutes.
4. When it finishes you get:
   - a **live URL** (`your-project.vercel.app`), with a **Copy** button, and
   - a **preview password**, shown once, with a **Copy** button.

## Share it with your client

Send the client two things: the **live URL** and the **preview password**. The site is
locked until they enter the password, so it is safe to share the link.

> Save the password when it is shown. It is set on Vercel but not stored in the app, so
> it is not displayed again. If you lose it, use **Reset preview password** (below), which
> generates a new one and republishes.

## Publish changes (republish)

After the first publish, the button becomes **Publish changes**. Whenever you update the
design, open the Publish panel and click it. Only the files that changed are re-uploaded,
so republishing is fast. The URL and password stay the same.

## Reset the preview password

In the Publish panel, click **Reset preview password**. This generates a new password,
sets it on Vercel, and republishes so it takes effect. Share the new password with your
client. (Changing the password requires a republish because the gate reads it from the
live deployment.)

## Switch which Vercel account or team you deploy to

In the Publish panel, use the **Deploy to** dropdown to change scope. To sign out entirely,
click **Disconnect Vercel** at the bottom, then reconnect with a different token.

## What gets published

The app uploads your project's source (everything except `node_modules`, build output, and
local-only files like `.env.local`), and Vercel builds it the same way it would from a git
repo. The password gate (`middleware.js`) and the brand values (client name, project title)
are wired up automatically from your project's `.env`.

## Troubleshooting

- **"Publish this design" is greyed out.** The project has no finished design yet. Build or
  finish a design first, then come back.
- **"That token was rejected."** The token is wrong, expired, or was revoked. Create a fresh
  one at vercel.com/account/tokens and reconnect.
- **The build failed on Vercel.** Something in the design did not build. Open the design in
  the app, confirm the live preview works, then republish. If it keeps failing, the Vercel
  dashboard for the project shows the full build log.
- **Two projects landed on the same URL.** Projects are named from the client name, so two
  projects with the same client name map to the same Vercel project. Give them distinct
  client names if you want separate URLs.
- **The link shows a login/lock screen.** That is the password gate working. Enter the
  preview password. If you never saw a password, use **Reset preview password**.

## What this does not do (yet)

- No GitHub backup or push-to-deploy. That is a later, opt-in addition; this path deploys
  straight to Vercel.
- No custom domain. You get a `*.vercel.app` URL. Custom domains are set in the Vercel
  dashboard for now.
