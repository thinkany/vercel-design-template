// ©2026 thinkany llc. All rights reserved.
// English UI copy for the dashboard admin surface (framework CHROME only — never
// designer-authored page content, which stays inline in the variation components).
// One catalog per surface; keys read `area.item`. Parameterized copy is a function
// so pluralization / interpolation lives with the words. Phase 2 (languages) adds
// sibling locale files that must satisfy `Copy = typeof en`; index.ts picks one, so
// every consumer keeps importing `copy` unchanged. See the copy convention in CLAUDE.md.
export const en = {
  dashboard: {
    designedBy: "Designed by",
    signOut: "Sign Out",
    brandProject: "Brand This Project",
    makeVariation: "+ Make New Variation",
    variationCount: (n: number) => `${n} design variation${n !== 1 ? "s" : ""}`,
    startDesigning: "▶  Start designing",
    startDesigningBusy: "Creating your first design…",
    startDesigningHint:
      "Creates your working copy from the base template, your design lives there, base stays the clean starting point.",
    baseGuard: {
      title: "Can't remove this one",
      body: "Oh sorry! We can not remove the base variation, we need it as our foundation.",
      dismiss: "Got it",
    },
    remove: {
      title: "Remove this variation?",
      body: "This removes it from the dashboard. Files on disk are not deleted.",
      cancel: "Cancel",
      confirm: "Remove",
    },
  },
  variationCard: {
    base: "Base",
    briefAndPalette: "Brief & palette",
    paletteAndType: "Palette & type",
    // Rich nudge: the component keeps the markup (code chip, bold version, styleguide
    // link); these are its text fragments. "for" and the trailing "." stay as literal
    // glue in the component for now — the known limit of a fragment (vs slot) approach.
    setupNudge: {
      lead: "Styleguide not configured yet, run",
      command: "/setup-styleguide",
      tail: "to set its fonts & colors, then mark it done on its",
      linkText: "styleguide",
    },
    created: "Created",
    modified: "Modified",
    previewAlt: (title: string) => `Preview: ${title}`,
    viewTooltip: "Variation opens in a new browser tab.",
    viewDesign: "View Design ↗",
    styleguide: "Styleguide ↗",
    tryAnotherDirection: "Try Another Direction",
    remove: "Remove",
    close: "Close",
    briefHeading: "Original brief",
    directionHeading: "Design Direction",
    paletteHeading: "Palette",
    typeHeading: "Type",
    primaryTypeface: "Primary typeface",
    primaryFallbackName: "Primary",
  },
  makeVariation: {
    eyebrow: (version: string) => `New Variation: ${version}`,
    title: "Make New Variation",
    duplicateFrom: "Duplicate from",
    modifiedPrefix: (date: string) => `Modified ${date}`,
    titleLabel: "Variation Title",
    titlePlaceholder: (n: string) => `Variation ${n}`,
    descriptionLabel: "Description",
    descriptionPlaceholder: "Describe what's different about this variation…",
    needsStyleguideTitle: "This variation needs its own styleguide changes",
    needsStyleguideHint:
      "The source styleguide is copied either way. Check this to flag the copy for review, its styleguide will show a setup reminder until you mark it updated.",
    error: "Couldn't create the variation, is the dev server running?",
    cancel: "Cancel",
    create: "Create Variation",
    creating: "Creating…",
  },
  viewToggle: {
    view: "View",
    devices: { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" },
    orientation: { portrait: "portrait", landscape: "landscape" },
    rotate: "Rotate",
    rotateAria: "Rotate device",
    rotateTitle: (target: string) => `Rotate to ${target}`,
  },
  imageCredits: {
    count: (n: number) => `${n} image${n > 1 ? "s" : ""} not free to reuse`,
    sourceFallback: "source",
    footer: "Outlined in the design. License or replace them, then click the badge to turn this off.",
    badgeTitle: "Unlicensed Images",
    badgeAria: (n: number, on: boolean) =>
      `Unlicensed images: ${n} not free to reuse${on ? " (highlighting on)" : ""}`,
  },
  updateCheck: {
    // Pill states (admin + local-dev only).
    checking: "Checking…",
    available: (v: string) => `Update available · v${v}`,
    current: (v: string) => `v${v} · up to date`,
    checkForUpdates: (v: string) => `v${v} · check for updates`,
    idle: (v: string) => `v${v}`,
    titleAvailable: "A newer template version is available.",
    titleCheck: "Check for template updates",
    revert: "↩ Revert update",
    revertTitle: (to: string, from: string) => `Undo the last update (v${to} → v${from})`,
    // Upgrade modal.
    modal: {
      eyebrow: (v: string) => `Template update · v${v}`,
      titleApplied: "Update applied",
      titleApply: "Update this project",
      preparing: "Preparing update…",
      applying: "Applying update, writing files…",
      rowVersion: "Version",
      rowApplied: "Files to update",
      rowReview: "Need review (sidecar)",
      rowKept: "Your files kept",
      cancel: "Cancel",
      applyAnyway: "Apply anyway",
      apply: "Apply update",
      close: "Close",
      refresh: "Refresh",
      working: "Working…",
    },
    // Revert modal.
    revertModal: {
      titleReverted: "Update reverted",
      titleConfirm: "Revert the last update?",
      restoring: "Restoring…",
      defaultMsg: "Reverted.",
      cancel: "Cancel",
      revert: "Revert",
      reload: "Reload",
      close: "Close",
      working: "Working…",
    },
  },
} as const;
