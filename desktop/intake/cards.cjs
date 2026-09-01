// Intake card schema — the typed vocabulary the AGENT uses to drive a rich, in-pane
// intake (not a static form). See docs/onboarding-intake-spec.md + Phase-1 ticket T2.
//
// WHY this exists: the SDK's built-in AskUserQuestion is multiple-choice ONLY. A
// creative-director intake needs free text, chips, and a "reference + why" pair, so
// we define our own card types and ship them to the renderer over a dedicated
// channel (the `intake` MCP tool → agent:intake IPC → pane host). This module is the
// single source of truth for what a card looks like and what makes one valid; it is
// pure CommonJS (no deps) so BOTH main.cjs (routing/validation) and, later, the
// renderer host (T3/T4) can share it.
//
// A CardSpec:
//   { id, type, label, field?, help?, placeholder?, options?, skippable?,
//     agentDecidesLabel? }
//   id                — stable, unique within the batch; the answer comes back keyed by it.
//   type              — one of CARD_TYPES.
//   label             — the question/prompt shown on the card.
//   field             — OPTIONAL Brief field this answer folds into (brief.cjs applyAnswers
//                       is keyed by field). Omit for cards that don't map 1:1 to the Brief.
//   help              — optional sub-label / hint under the label.
//   placeholder       — optional input placeholder (open-text / reference).
//   options           — REQUIRED for single-choice / multi-choice / chips; the choice pool.
//   long              — OPTIONAL (open-text): render a multi-line textarea instead of one line.
//   maxLength         — OPTIONAL (open-text / reference): cap + show a "N / max" counter.
//   skippable         — if true, the designer may skip; a skip records `null` (= agent decides).
//   agentDecidesLabel — optional label for the skip affordance (e.g. "I'll let you choose").
//
// Answer VALUE shapes (host-interpreted downstream in T4; T2 passes them through
// opaquely and does NOT enforce them):
//   open-text     → string | null
//   single-choice → string | null
//   multi-choice  → string[] | null
//   chips         → string[] | null
//   reference     → { url: string, reason: string|null } | null
//   voice         → string[] | null  (rules for THIS design; also persisted to the
//                   project's copy-voice by the renderer, so `field` is optional)

const CARD_TYPES = ["open-text", "single-choice", "multi-choice", "chips", "reference", "color-swatch", "font-pick", "voice"];

// Card types that must carry a non-empty `options` pool.
//   color-swatch options = hex colors (e.g. "#2b3a67"); the answer is the picked hex.
//   font-pick    options = font family names (Google Fonts); the answer is the picked name.
const OPTION_TYPES = ["single-choice", "multi-choice", "chips", "color-swatch", "font-pick"];

/**
 * Validate ONE card. Returns `{ ok, errors }` (errors = human-readable strings).
 * Fails loud on bad agent output so a malformed card surfaces as a clear tool error
 * instead of a silently-broken pane.
 */
function isValidCardSpec(card) {
  const errors = [];
  if (!card || typeof card !== "object") return { ok: false, errors: ["card is not an object"] };

  if (!card.id || typeof card.id !== "string") errors.push("`id` (non-empty string) is required");
  if (!CARD_TYPES.includes(card.type)) errors.push(`\`type\` must be one of: ${CARD_TYPES.join(", ")}`);
  if (!card.label || typeof card.label !== "string") errors.push("`label` (non-empty string) is required");

  if (OPTION_TYPES.includes(card.type)) {
    if (!Array.isArray(card.options) || card.options.length === 0) {
      errors.push(`\`${card.type}\` requires a non-empty \`options\` array`);
    } else if (!card.options.every((o) => typeof o === "string" && o.length > 0)) {
      errors.push("`options` must all be non-empty strings");
    }
  }

  // Optional fields — only type-checked when present.
  if (card.field != null && typeof card.field !== "string") errors.push("`field` must be a string");
  if (card.help != null && typeof card.help !== "string") errors.push("`help` must be a string");
  if (card.placeholder != null && typeof card.placeholder !== "string") errors.push("`placeholder` must be a string");
  if (card.long != null && typeof card.long !== "boolean") errors.push("`long` must be a boolean");
  if (card.maxLength != null && (typeof card.maxLength !== "number" || card.maxLength <= 0)) errors.push("`maxLength` must be a positive number");
  if (card.skippable != null && typeof card.skippable !== "boolean") errors.push("`skippable` must be a boolean");
  if (card.agentDecidesLabel != null && typeof card.agentDecidesLabel !== "string") errors.push("`agentDecidesLabel` must be a string");

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a BATCH of cards (what the `intake` tool receives). Enforces a non-empty
 * array and unique ids across the batch, and aggregates per-card errors with an index
 * so the agent can see exactly which card to fix. Returns `{ ok, errors }`.
 */
function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { ok: false, errors: ["`cards` must be a non-empty array"] };
  }
  const errors = [];
  const seen = new Set();
  cards.forEach((c, i) => {
    const r = isValidCardSpec(c);
    if (!r.ok) errors.push(`card[${i}]${c && c.id ? ` ("${c.id}")` : ""}: ${r.errors.join("; ")}`);
    if (c && typeof c.id === "string" && c.id) {
      if (seen.has(c.id)) errors.push(`duplicate card id "${c.id}"`);
      seen.add(c.id);
    }
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { CARD_TYPES, OPTION_TYPES, isValidCardSpec, validateCards };
