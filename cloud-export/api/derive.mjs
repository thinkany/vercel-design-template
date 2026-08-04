// ©2026 thinkany llc. All rights reserved.
/**
 * api/derive.mjs — the Vercel serverless entry for `POST /api/derive`.
 *
 * A THIN shell: it only guards the HTTP method and hands off to `handler()` in
 * ../derive.mjs, which does the license check and runs the derive IP. Keeping the
 * IP in derive.mjs (not here) means the same logic is unit-testable offline
 * (handler.test.mjs) without a Vercel runtime.
 *
 * Deploy: this file's parent dir (cloud-export/) is the Vercel project root, so
 * Vercel routes it as /api/derive. The IP (derive.mjs + color.mjs) is traced and
 * bundled into the function — it never leaves the server. See DEPLOY.md.
 */
import { handler } from "../derive.mjs";

export default function derive(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("allow", "POST");
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "method not allowed — POST a CaptureBundle" }));
  }
  return handler(req, res);
}
