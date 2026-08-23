// ©2026 thinkany llc. All rights reserved.
/**
 * api/direction.mjs — the Vercel serverless entry for `POST /api/direction`.
 *
 * A THIN shell: it guards the HTTP method and hands off to `handler()` in
 * ../direction.mjs, which does the license check and runs the deck. Keeping the deck
 * (../direction/*.cjs) out of here means it's the same logic that's unit-testable
 * offline, and the deck is traced + bundled into the function — it never leaves the
 * server. See DEPLOY.md.
 */
import { handler } from "../direction.mjs";

export default function direction(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("allow", "POST");
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: 'method not allowed — POST { op: "meta" | "sample" }' }));
  }
  return handler(req, res);
}
