// ©2026 thinkany llc. All rights reserved.
// FORMS ENDPOINT (CORE): the one Vercel function on the published site. Every
// form the Forms tab defines posts here (site/src/lib/form-client.ts as JSON, or a
// native post without JS). It loads the form's definition from content/forms
// (shipped with the function: see the site's vercel.json in desktop/publish.cjs),
// drops spam, validates the values, and emails them to the form's recipients
// through the provider set up in the app's Delivery card:
//   FORMS_PROVIDER      resend | postmark | sendgrid
//   FORMS_PROVIDER_KEY  the provider's API key
//   FORMS_FROM          the verified sender, "Website <forms@client.com>"
//   FORMS_SITE_NAME     the client name, for the subject line
// Locally, Astro dev answers this route with a preview stub (forms-dev.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { send } from "../site/src/lib/forms-providers.mjs";

const ID = /^[a-z0-9][a-z0-9-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { textarea: 5000, other: 500 };
const MIN_MS = 3000; // faster than this is not a person

function projectRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const d of [process.cwd(), path.resolve(here, "..")]) if (fs.existsSync(path.join(d, "content", "forms"))) return d;
  return process.cwd();
}
function loadForm(id) {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot(), "content", "forms", `${id}.json`), "utf8")); } catch { return null; }
}
function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return Object.fromEntries(new URLSearchParams(b)); } }
  return {};
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const withParam = (url, k, v) => url + (url.includes("?") ? "&" : "?") + k + "=" + encodeURIComponent(v);

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "POST only." }); }
  const body = parseBody(req);
  const wantsJson = /application\/json/i.test(req.headers.accept || "") || /application\/json/i.test(req.headers["content-type"] || "");
  const id = String(body.form || "");
  // JSON for the client script; a 303 back to the page (or on to the thank-you page) for a native post.
  const reply = (status, payload, next) => {
    if (wantsJson) return res.status(status).json(payload);
    const ref = String(req.headers.referer || "/");
    res.statusCode = 303;
    res.setHeader("Location", payload.ok ? (next || withParam(ref, "sent", id)) : withParam(ref, "error", payload.error || "error"));
    return res.end();
  };
  if (!ID.test(id)) return reply(404, { ok: false, error: "Unknown form." });
  const def = loadForm(id);
  if (!def) return reply(404, { ok: false, error: "Unknown form." });

  // Spam: a filled honeypot, or a submission faster than a person could type, is dropped quietly.
  const t = Number(body._t || 0);
  if (String(body.website || "").trim() || (t && Date.now() - t < MIN_MS)) return reply(200, { ok: true });
  const next = typeof body._next === "string" && /^\/(?!\/)/.test(body._next) ? body._next : null;

  // Validate against the definition; unknown keys are ignored.
  const values = [];
  for (const f of Array.isArray(def.fields) ? def.fields : []) {
    const label = f.label || f.id;
    let v = body[f.id]; v = v == null ? "" : String(v).trim();
    if (f.type === "checkbox") v = v && v !== "false" && v !== "0" ? "Yes" : "";
    if (f.required && !v) return reply(400, { ok: false, error: `${label} is required.` });
    if (v && f.type === "email" && !EMAIL.test(v)) return reply(400, { ok: false, error: `${label} isn't an email address.` });
    if (v && f.type === "select" && Array.isArray(f.options) && f.options.length && !f.options.includes(v)) return reply(400, { ok: false, error: `${label}: choose one of the options.` });
    const max = f.type === "textarea" ? MAX_LEN.textarea : MAX_LEN.other;
    if (v.length > max) v = v.slice(0, max);
    values.push({ id: f.id, type: f.type, label, value: v });
  }

  const provider = process.env.FORMS_PROVIDER, key = process.env.FORMS_PROVIDER_KEY, from = process.env.FORMS_FROM;
  if (!provider || !key || !from) return reply(503, { ok: false, error: "This form isn't connected yet." });
  const to = String(def.recipients || "").split(",").map((s) => s.trim()).filter((s) => EMAIL.test(s));
  if (!to.length) return reply(503, { ok: false, error: "This form has no recipients yet." });
  const rf = def.replyToField && values.find((x) => x.id === def.replyToField);
  const replyTo = (rf && EMAIL.test(rf.value) && rf.value) || (def.replyTo && EMAIL.test(def.replyTo) ? def.replyTo : undefined);
  const siteName = process.env.FORMS_SITE_NAME || req.headers.host || "the website";
  const name = def.name || id;
  const subject = `${name} from ${siteName}`;
  const text = values.map((x) => `${x.label}:\n${x.value || "(empty)"}`).join("\n\n") + `\n\nSent from the ${siteName} "${name}" form.`;
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222">`
    + values.map((x) => `<p style="margin:0 0 14px"><strong>${esc(x.label)}</strong><br>${esc(x.value || "(empty)").replace(/\n/g, "<br>")}</p>`).join("")
    + `<p style="color:#888;font-size:12px">Sent from the ${esc(siteName)} “${esc(name)}” form.</p></div>`;
  try { await send({ provider, key, from, to, replyTo, subject, text, html }); }
  catch (e) { console.error("[forms] delivery failed:", e && e.message); return reply(502, { ok: false, error: "Sending failed. Please try again in a moment." }); }
  return reply(200, { ok: true }, next);
}
