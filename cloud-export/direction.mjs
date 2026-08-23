// ©2026 thinkany llc. All rights reserved.
/**
 * direction.mjs — the CLOUD half of design-variety: the curated lens deck + the
 * deterministic sampler, off the distributed app. Turns brief signals into a sampled
 * Design Direction (lens + semantic axes + motifs) plus its rendered prompt block, or
 * returns the knob-panel metadata. Pure computation, NO model call, no npm deps.
 *
 * Two ops (POST { op }):
 *   { op: "meta" }                                        → { axes, lenses }   (knob panel)
 *   { op: "sample", what?, tone?, projectType?, axes?,
 *      lens?, seed? }                                     → { direction, block }
 *
 * The deck (direction/direction.cjs + direction/lenses.cjs) is bundled into the function
 * and NEVER ships to the client — that's the whole point (the IP moat). See DEPLOY.md.
 *
 * Entrypoints:
 *   runDirection(body) → result   the pure function (import this / test offline)
 *   handler(req, res)             the Vercel-Function wrapper (license-gated)
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { sampleDirection, renderDirectionPrompt, directionMeta, lensLabel } = require("./direction/direction.cjs");

// Run one op. `sample` stamps the human lens label onto the returned object (so the client
// never needs the deck's label map) and renders the prompt block server-side (so the template
// stays off the client too). `seed` (with `lens`) reproduces a prior direction.
export function runDirection(body = {}) {
  const op = body && body.op;
  if (op === "meta") return directionMeta();
  if (op === "sample") {
    const { what, tone, projectType, axes, lens, seed } = body;
    const direction = sampleDirection({ what, tone, projectType, axes, lens, seed });
    const stamped = direction ? { ...direction, lensLabel: lensLabel(direction.lens) } : null;
    return { direction: stamped, block: stamped ? renderDirectionPrompt(stamped) : "" };
  }
  throw new Error(`unknown op: ${JSON.stringify(op)} (expected "meta" or "sample")`);
}

// License-gated Vercel wrapper — identical x-license-key gate as derive.mjs.
export async function handler(req, res) {
  const send = (code, obj) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
  const expected = (process.env.DERIVE_LICENSE_KEY || "").trim();
  if (!expected) return send(503, { error: "service not configured: DERIVE_LICENSE_KEY unset (add it in Vercel env, then redeploy)" });
  const provided = (req.headers["x-license-key"] || req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
  if (provided !== expected) return send(401, { error: "unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    return send(200, runDirection(body || {}));
  } catch (e) {
    return send(400, { error: e.message });
  }
}
