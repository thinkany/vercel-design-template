// Deliverable-type registry — the extensibility seam (spec §3.1). The big pane is a
// "deliverable surface": today it renders designed web pages; tomorrow wireframes,
// content-flow diagrams, or brand guidelines slot in as new registrations, not a
// rewrite. The FIRST intake question ("what are we making") is derived from here.
//
// Each type: { id, label, description, comingSoon, outputRenderer, intakeHints }
//   comingSoon    — true = registered but not built yet (shown, not selectable).
//   outputRenderer — how the pane renders the finished deliverable ("preview" today).
//   intakeHints    — the fields this type gathers + option pools + the lead card, that
//                    the agent leans on when driving the conversation (null for stubs).

const DELIVERABLES = {
  "web-pages": {
    id: "web-pages",
    label: "Web pages",
    description: "Landing pages and multi-page marketing sites.",
    comingSoon: false,
    outputRenderer: "preview", // the existing DesignSurface live preview
    intakeHints: {
      leadWith: "what", // open with the free-text "what are we making"
      fields: ["what", "audience", "references", "colorSources", "fontSources", "sections", "variationAxes", "tone", "deviceTargets", "existingCode"],
      sectionOptions: ["Hero", "Features", "How it works", "Testimonials", "Pricing", "FAQ", "About", "Team", "Gallery", "Contact", "CTA", "Footer"],
      variationAxisOptions: ["Layout structure", "Color direction", "Type treatment", "Hero style", "Card / tile treatment"],
      deviceOptions: ["Desktop", "Tablet", "Mobile"],
    },
  },

  // ── Stubs: registered so the "what are we making" fork + the seam are exercised,
  //    but not built. Adding one for real = flip comingSoon + supply an outputRenderer
  //    + intakeHints. (wireframe ties to the earmarked low-fi mode.) ──
  "wireframe": {
    id: "wireframe", label: "Wireframes", description: "Low-fi structure and flow, before the visuals.",
    comingSoon: true, outputRenderer: null, intakeHints: null,
  },
  "flow-diagram": {
    id: "flow-diagram", label: "Content-flow diagram", description: "How content and users move through the product.",
    comingSoon: true, outputRenderer: null, intakeHints: null,
  },
  "brand-guideline": {
    id: "brand-guideline", label: "Brand guidelines", description: "Colors, type, and usage in one reference.",
    comingSoon: true, outputRenderer: null, intakeHints: null,
  },
};

function getDeliverable(id) { return DELIVERABLES[id] || null; }
function isBuilt(id) { const d = DELIVERABLES[id]; return !!(d && !d.comingSoon); }

/** The "what are we making" choices, derived from the registry (stubs flagged). */
function deliverableOptions() {
  return Object.values(DELIVERABLES).map((d) => ({
    id: d.id, label: d.label, description: d.description, comingSoon: d.comingSoon,
  }));
}

module.exports = { DELIVERABLES, getDeliverable, isBuilt, deliverableOptions };
