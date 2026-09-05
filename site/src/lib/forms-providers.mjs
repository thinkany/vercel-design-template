// ©2026 thinkany llc. All rights reserved.
// FORM DELIVERY PROVIDERS (CORE). One `send()` over the three transactional mail
// APIs a designer can bring a key for. Plain fetch, no dependencies: it runs in the
// site's Vercel function (api/forms.js) and in the app ("Send a test"). The from
// address must belong to a domain verified with the provider.
export const PROVIDERS = {
  resend: { name: "Resend", url: "https://resend.com", keysUrl: "https://resend.com/api-keys" },
  postmark: { name: "Postmark", url: "https://postmarkapp.com", keysUrl: "https://account.postmarkapp.com/servers" },
  sendgrid: { name: "SendGrid", url: "https://sendgrid.com", keysUrl: "https://app.sendgrid.com/settings/api_keys" },
};

async function post(url, headers, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (r.ok) return r;
  let detail = "";
  try {
    const j = await r.json();
    detail = j.message || j.Message || (Array.isArray(j.errors) ? j.errors.map((e) => e.message || e).join("; ") : "") || JSON.stringify(j);
  } catch { detail = await r.text().catch(() => ""); }
  throw new Error(`${r.status} ${detail}`.trim());
}
/** "Name <addr>" or "addr" → { name?, email } */
function addr(s) {
  const m = String(s).trim().match(/^(.*?)\s*<([^>]+)>$/);
  return m ? { name: m[1].replace(/^"|"$/g, ""), email: m[2].trim() } : { email: String(s).trim() };
}

/**
 * Send one message. `to` is an address or a list; `replyTo` optional.
 * Throws with the provider's message on failure.
 */
export async function send({ provider, key, from, to, replyTo, subject, text, html }) {
  const list = (Array.isArray(to) ? to : [to]).map((s) => String(s).trim()).filter(Boolean);
  if (!list.length) throw new Error("No recipients.");
  if (provider === "resend") {
    return post("https://api.resend.com/emails", { Authorization: `Bearer ${key}` },
      { from, to: list, ...(replyTo ? { reply_to: replyTo } : {}), subject, text, html });
  }
  if (provider === "postmark") {
    return post("https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": key, Accept: "application/json" },
      { From: from, To: list.join(","), ...(replyTo ? { ReplyTo: replyTo } : {}), Subject: subject, TextBody: text, HtmlBody: html, MessageStream: "outbound" });
  }
  if (provider === "sendgrid") {
    return post("https://api.sendgrid.com/v3/mail/send", { Authorization: `Bearer ${key}` },
      { personalizations: [{ to: list.map(addr) }], from: addr(from), ...(replyTo ? { reply_to: addr(replyTo) } : {}), subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }] });
  }
  throw new Error(`Unknown provider "${provider}".`);
}
