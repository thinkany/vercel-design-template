// The Brief — the single structured object every intake flow (Get Designing = the
// conversation, Client Setup = the wall of choices) compiles to, and the input the
// build engine consumes. See docs/onboarding-intake-spec.md §3.2.
//
// CONVENTION: a field left `null` means "not answered — the agent decides." Arrays
// stay `null` until explicitly answered (so "skipped" and "answered as empty" differ).
// The "why" is captured alongside references / color / font sources on purpose: the
// reason is the taste (warmth, breeziness), not a clone of the source.

/**
 * @typedef {Object} SourceRef  A reference/source plus WHY it was chosen.
 * @property {string} value     A URL, a pasted value, or a name.
 * @property {string|null} reason  What the designer likes about it.
 *
 * @typedef {Object} Brief
 * @property {string|null} deliverableType   A deliverables.cjs id (e.g. "web-pages").
 * @property {string|null} projectType        "website" | "app" (the first fork).
 * @property {string|null} what              Free-text: what we're making, in their words.
 * @property {string[]|null} audience        Who it's for.
 * @property {SourceRef[]|null} references    Sites they like + why.
 * @property {SourceRef[]|null} colorSources  Color URLs/pastes/swatches + why.
 * @property {SourceRef[]|null} fontSources   Font names/links + why.
 * @property {string[]|null} sections        Sections/screens to include.
 * @property {string[]|null} variationAxes   Where to show variations.
 * @property {string|null} existingCode      Pointer/description of code to build on.
 * @property {string|null} tone              Voice/feel in a phrase.
 * @property {string[]|null} deviceTargets   e.g. ["desktop","mobile"].
 * @property {string|null} clientName        The company / brand the site is for.
 * @property {string|null} projectName       A name for this project / site.
 * @property {string[]|null} notes           Free-form extra context the designer added.
 * @property {object[]|null} referenceAssets  Uploaded design references (mirrors the ingest manifest).
 * @property {string|null} referenceDigest    The distilled reference direction (digest.md text).
 */

const BRIEF_FIELDS = [
  "deliverableType", "projectType", "what", "audience", "references", "colorSources", "fontSources",
  "sections", "variationAxes", "existingCode", "tone", "deviceTargets",
  "clientName", "projectName", "notes",
  // Reference-ingest (set from the ingest, not from a card — see references.cjs / ingest.cjs):
  "referenceAssets", "referenceDigest",
  // Design-variety: the sampled Direction (design-variety-spec.md), set at build handoff,
  // not a designer card. Persisted with the design for reproduction + the P2 knobs.
  "direction",
];

/** A fresh Brief with everything unanswered (null = agent decides). */
function createEmptyBrief(deliverableType = null) {
  const b = {};
  for (const f of BRIEF_FIELDS) b[f] = null;
  b.deliverableType = deliverableType;
  return b;
}

/**
 * Fold a set of answers into the Brief and return a NEW Brief (does not mutate).
 * `answers` is keyed by Brief FIELD name (the intake host translates card ids to
 * fields via each card's `field`, see cards.cjs). Unknown keys are ignored.
 */
function applyAnswers(brief, answers) {
  const next = { ...brief };
  for (const [k, v] of Object.entries(answers || {})) {
    if (BRIEF_FIELDS.includes(k)) next[k] = v;
  }
  return next;
}

/** The fields still null — i.e. the ones the agent will decide on its own. The
 * reference fields are set by the ingest (not designer choices), so they never
 * count as "unspecified"; deliverableType is the flow's own routing key. */
const NON_DESIGNER_FIELDS = new Set(["deliverableType", "referenceAssets", "referenceDigest", "direction"]);
function unspecifiedFields(brief) {
  return BRIEF_FIELDS.filter((f) => brief[f] == null && !NON_DESIGNER_FIELDS.has(f));
}

module.exports = { BRIEF_FIELDS, createEmptyBrief, applyAnswers, unspecifiedFields };
