// copy.js — the app shell’s user-facing copy, in one place.
//
// Same convention as the scaffold’s src/copy/en.ts and the preview gate’s local
// COPY: a keyed catalog reached as COPY.area.item, where parameterized entries
// are functions. This is a classic <script> (no modules in the shell), so it
// publishes a global `window.COPY` and MUST be loaded before shell.js.
//
// Scope: framework/admin CHROME only. Dynamic data (project titles, tool/file
// names in status lines, IPC channel strings) stays inline in shell.js. When you
// add or reword a shell string, do it here, not at the call site. House style:
// no em-dashes, and typographic apostrophes (’) not straight ones ('), especially
// for anything shown in the main pane.
window.COPY = {
  // ── Launch splash (logo + welcome, shown briefly on open) ───────────────────
  splash: {
    welcome: "Welcome to thinkany design, it’s your studio.",
  },

  // ── Status label in the top bar for the connect / no-project stages ─────────
  status: {
    notConnected: "not connected",
    noProject: "no project",
  },

  // ── Access gating (no Claude key → read-only) ───────────────────────────────
  errors: {
    needKey: "Connect a Claude API key in Keys & Licenses to do this.",
  },

  // ── Preview pane: placeholder states + the rotating "working" messages ──────
  preview: {
    siteTab: "Site", // the browser tab for the public website's live preview
    siteOffTitle: "The site builder is off",
    siteOffBody: "This project's site isn't being previewed. Turn the site builder on under CMS, Settings to see it here.",
    spinningUp: {
      emoji: "⏳",
      title: "We’re spinning up your preview…",
      text: "Just a moment while your dev server starts up.",
    },
    settingUp: {
      emoji: "✨",
      title: "Setting up your project",
      text: "Your live preview opens on its own once your design’s ready. Pick up in the chat.",
    },
    pickStart: {
      emoji: "👋",
      title: "Pick a starting point to your left",
      text: "Choose Client Setup or Get Designing in the chat pane. Your live preview opens here on its own once your design is ready for viewing.",
    },
    noProject: {
      emoji: "👋",
      title: "The live preview appears here",
      text: "Open or create a project to begin.",
    },
    clientSetupStart: {
      emoji: "💬",
      title: "Let’s set up your project",
      text: "I’ll walk you through it in the chat, one question at a time. Answer along and your project takes shape here.",
    },
    figmaIngestStart: {
      emoji: "🎨",
      title: "Importing your Figma frame",
      text: "I’m reading the frame’s colors, type, and structure. It rides along as the style direction while we design.",
    },
    gettingSetUp: "Getting set up",
    updatingDesign: "Updating your design",
    preparingElements: "Getting your site design elements prepared",
    workingMessages: [
      "We’re getting your workspace set up…",
      "Setting things up for you…",
      "Getting everything ready…",
      "Your live preview will open on its own once it’s ready…",
      "Thanks for hanging in there with us…",
    ],
    buildMessages: [
      "Laying out your sections…",
      "Placing your hero and headline…",
      "Building out the page…",
      "Adding your content and imagery…",
      "Bringing it all together…",
    ],
    preparingMessages: [
      "Please use the chat pane to make changes once your design is revealed.",
      "Laying out your sections…",
      "Bringing your colors and type together…",
      "Assembling your first draft…",
      "Your live preview opens here on its own once it’s ready…",
    ],
    // Shown after each answer while the agent takes it in. Presented IN ORDER: the
    // 1st answer shows line 1, the 2nd shows line 2, …, wrapping back to the top after
    // the last. So this array's order is the display order — reorder freely. Keep them
    // all neutral (none implying the walkthrough is over; the review screen ends it).
    takingInMessages: [
      "Got it, and setting up the design brief…",
      "Perfect, let me add that to the brief…",
      "Noted, written and next…",
      "Great, just a few more questions…",
      "I Love that tone choice, moving on...",
      "Cool, and we're almost there…",
      "Good deal, let’s get this going…",
    ],
  },

  // ── Quiet-build narration: the Art-Director progress spine ──────────────────
  // Shown in the preparing pane during the quiet Get-Designing build (chat hidden).
  // Keyed by phase id (see computePhaseList in shell.js). {tokens} are filled from the
  // Brief by briefBits() (paletteWord, fontWords, heroWord, sectionsWord, refName).
  // Lines are progress-neutral (no "almost done"); rotated ~5s. slowLine adds a beat of
  // reassurance for the long phases. Voice: a seasoned art director thinking aloud to a
  // client — warm, specific, unhurried, confident. See docs/quiet-build-narration-spec.md.
  build: {
    stepLabel: (n, m) => `Step ${n} of ${m}`,
    phases: {
      understanding: {
        title: "Reading your brief",
        lines: [
          "Taking in everything you told me and shaping the plan.",
          "Getting my head around the look and the feel you’re after.",
        ],
      },
      research: {
        title: "Studying comparable sites",
        lines: [
          "Pulling up the strongest sites in your space to see where the bar sits.",
          "Looking at how the best in your field handle this, so yours can go further.",
        ],
        slowLine: "This is the slow, worthwhile part. Good research is what keeps a design from feeling generic.",
      },
      foundations: {
        title: "Setting the palette and type",
        lines: [
          "Mixing your {paletteWord} and pairing it with {fontWords}.",
          "Getting the colors and type right first. Everything else hangs off this.",
          "Laying the foundation your whole design will stand on.",
        ],
      },
      header: {
        title: "The header and navigation",
        lines: [
          "Laying out the header so visitors always know where they are.",
          "Setting the navigation and the logo lockup.",
        ],
      },
      hero: {
        title: "The hero",
        lines: [
          "Blocking in the {heroWord} hero and giving the headline room to breathe.",
          "This is the first thing visitors see, so I’m making it land.",
        ],
      },
      sections: {
        title: "The page sections",
        lines: [
          "Building out {sectionsWord}, one considered block at a time.",
          "Setting the rhythm down the page so it reads with a clear flow.",
        ],
      },
      contact: {
        title: "The contact section",
        lines: [
          "Wiring up the contact section so reaching you feels effortless.",
          "Making the last step, getting in touch, the easy one.",
        ],
      },
      polish: {
        title: "Polish and responsive",
        lines: [
          "Tightening the spacing and the details until it feels considered.",
          "Making sure it holds together on every screen size.",
        ],
      },
    },
  },

  // ── Chat: tool-activity bubble verbs + the long-session nudges ──────────────
  chat: {
    // Playful stand-ins shown while a Bash tool runs.
    bashVerbs: [
      "Working", "Cooking", "Crunching", "Tinkering", "Wrangling", "Assembling",
      "Piecing things together", "Rustling something up", "Noodling on it", "Conjuring",
      "Fiddling with the bits", "Making it happen", "Checking under the hood", "Tidying the loose ends"
    ],
    // { at } is the fraction-of-context threshold that fires each nudge.
    sessionNudges: [
      { at: 0.6, msg: "This conversation is getting long (~60% of the context window). If replies start to slow, type /clear to begin a fresh session. Your project files and design work are saved on disk and won’t be lost." },
      { at: 0.85, msg: "Heads up: this conversation is ~85% full. /clear starts a clean, faster session (your saved work stays intact)." },
    ],
    startedFresh: "Started a fresh session. Your previous one is saved in the Claude panel (under Sessions).",
    resumedSession: "Resumed this session. Pick up where you left off.",
    // The "Start a new session?" confirmation (clicking the context gauge).
    newConfirmTitle: "Start a new session?",
    newConfirmOk: "New session",
    newConfirmMessage: (tokens, pct) =>
      "Starting a new session gives you a fresh, fast chat. Your current session is SAVED to the Claude " +
      "panel’s Sessions list (not lost), reopen it anytime to pick up where you left off. Project files and " +
      "design work are unaffected.\n\n" +
      `You’re currently at about ${tokens} tokens (${pct}% of the context window). ` +
      "It’s a good time to start fresh when this climbs high (the ring turns amber, then red) or you’re moving to a new task.",
  },

  // ── Global chrome: browser tabs, sidebar, shared controls ───────────────────
  chrome: {
    newTab: "New tab",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    close: "Close",
    previewInBrowser: "Preview in Browser",
    dragResize: "Drag to resize the chat",
  },

  // ── Icon rail tooltips (data-tip + aria-label) ──────────────────────────────
  rail: {
    help: "About thinkany design",
    projects: "Switch Projects",
    site: "CMS",
    publish: "Publish",
    company: "Company Profile",
    voice: "Copy Voice",
    figma: "Figma Export",
    claude: "Claude Settings",
    artdirector: "Art Director Review",
    a11y: "Accessibility Review",
    licenses: "Keys & Licenses",
    sessionUsage: "Claude Session Usage",
    sessionUsageAria: "Claude Session Usage, click to clear the session",
    sessionUsageTip: (pct) => `Claude Session Usage · ${pct}%`,
    sessionUsageAriaLive: (pct) => `Claude Session Usage, ${pct}% of the context used. Click to clear the session.`,
  },

  // ── Composer (chat input row) ───────────────────────────────────────────────
  composer: {
    jumpLatest: "Jump to the latest message",
    commands: "Commands",
    attach: "Attach a file (or drag one onto the chat)",
    attachAria: "Attach a file",
    placeholder: "Message the agent…  (Enter to send · Shift+Enter for newline)",
    send: "Send",
  },

  // ── No-Claude-key reminder banner (read-only mode) ──────────────────────────
  nokeyBanner: {
    text: "<b>No Claude API key connected.</b> You can browse and deploy your projects; designing, chat, and Figma export need a key.",
    button: "Add Claude key",
  },

  // ── Point & Comment feedback toggle ─────────────────────────────────────────
  feedback: {
    label: "Point & Comment",
    pointing: "Pointing… (Esc to exit)",
    toggleTitle: "Point at an element in the preview and leave a note for Claude",
    toggleAria: "Point and Comment",
  },

  // ── Post-build reroll (fork a design with a new direction) ──────────────────
  reroll: {
    toolbarBtn: "↻ Direction",
    cardBtn: "Try another direction",
    title: "A different direction",
    subtitle: "Steer or reroll the design direction, then create a new variation from it.",
    cancel: "Cancel",
    create: "Create variation",
    confirmTitle: "Create a new variation?",
    confirmMessage: "This runs a full design build (it takes time and uses your plan) and adds a new variation. Your current design is kept.",
    confirmOk: "Create it",
    building: (id) => `Creating a new direction as ${id}…`,
    readError: "Couldn’t read that design.",
    createError: "Couldn’t create the variation.",
  },

  // ── Art Director: the read-only confer report rendered in chat ──────────────
  artDirector: {
    reviewing: (id) => `Art Director is reviewing ${id}…`,
    reviewingPage: (title) => `Art Director is reviewing the ${title} page…`,
    failed: (why) => `Art Director couldn’t review this design (${why}).`,
  },
  // The Director drawer (Phase 3): recommendations, the modal, and the Archive.
  // The menu check's findings, shown as a section in the Art Director drawer. The
  // check itself is deterministic (no model, no tokens), so the copy never calls it
  // a review or an opinion: it reports what was measured.
  menu: {
    heading: "Menu",
    checking: "Checking the menu…",
    // A pass says what was actually verified, so "no findings" reads as work done.
    clean: (c) => `The menu checks out: ${c.items} item${c.items === 1 ? "" : "s"}${c.panels ? `, ${c.panels} panel${c.panels === 1 ? "" : "s"}` : ""}, verified at ${(c.widths || []).length} width${(c.widths || []).length === 1 ? "" : "s"}.`,
    never: "The menu hasn’t been checked yet. It runs itself after a build.",
    recheck: "Check the menu again",
    checkNow: "Check the menu",
    needBuild: "Available once the design has finished building.",
    // A configured header cannot produce a finding, so one means the framework is at
    // fault, not the designer. Say that plainly rather than implying they broke it.
    frameworkNote: "This header is configured, so a finding here is a problem with the tool rather than with your design. Re-seeding it from your header choice is worth a try; if it comes back, it’s worth reporting.",
    customNote: "This design uses a custom header, so the framework can’t guarantee it. These are the things that look wrong.",
    reseed: "Reset the header",
    reseedTip: "Rewrites the header’s configuration from the layout you picked, then checks again.",
    reseedNoLayout: "No header layout was recorded for this project, so there’s nothing to reset it to.",
    reseedFixed: "That sorted it: the menu now checks out.",
    reseedPersists: "Still failing after a reset. This is a bug in the tool, not in your design; it’s worth reporting.",
    fixTip: "Hand this finding to Claude as a scoped edit.",
    ruleName: {
      architecture: "The items don’t match",
      panels: "A menu panel is off",
      placement: "Something sits in the wrong place",
      mobile: "The mobile menu is off",
      fold: "The header is too tall",
    },
    at: (w) => `at ${w}`,
    expected: "Expected",
    actual: "Instead",
    dismissed: (n) => `Dismissed (${n})`,
  },
  director: {
    needDesign: "Open a built design to review it. The Art Director reviews the design you’re previewing.",
    lead: (id) => `Reviewing ${id}. Open a recommendation to read it in full, then apply or dismiss it.`,
    review: "Review this design",
    scopeLabel: "Review",
    scopePage: (title) => `The ${title} page`,
    leadPage: (title) => `Reviewing the ${title} page: its blocks, header and footer. Open a recommendation to read it in full, then apply or dismiss it.`,
    reviewPage: "Review this page",
    reReviewPage: "Review this page again",
    reReview: "Review again",
    none: "No recommendations yet. Run a review to get the Art Director’s read.",
    allHandled: "All caught up, nothing active. Re-review to check the latest, or reopen the Archive below.",
    archive: (n) => `Archive (${n})`,
    restore: "Restore",
    completed: (n) => `Completed (${n})`,
    doneTag: "Applied",
    close: "Close",
    needKey: "Connect a Claude API key in Keys & Licenses to do this.",
    hold: "Hold",
    holdTip: "Keep suggestion open for now",
    dismiss: "Dismiss",
    dismissTip: "Places suggestion in the archive",
    applyThis: "Apply",
    showOnPage: "Show on page",
    showOnPageTip: "Highlight what this points at on the preview",
    exitReview: "Exit",
    shownOnPage: "Highlighted on the page",
    notOnView: "not visible on this view",
    applyingEcho: (title) => `Apply: ${title}`,
    assetNote: "Needs a new asset: your call to supply it.",
    decisionNote: "A call for you (or the client) to make.",
    fontPickLabel: "Pick a typeface to apply, or type your own:",
    applyFont: "Apply font",
    applyingFont: (font) => `Apply font: ${font}`,
    sourceImagery: "Source imagery",
    sourcingAsset: "Sourcing imagery for this recommendation…",
    makeCall: "Make the call",
    makeCallPlaceholder: "Add any direction for Claude (optional)…",
    makeCallUpload: "Upload a file",
    makeCallSend: "Send to Claude",
    makingCall: (title) => `Make the call: ${title}`,
  },

  // ── Preview browser: nav buttons + quick links ──────────────────────────────
  nav: {
    back: "Back",
    forward: "Forward",
    reload: "Reload",
    home: "Home",
    styleguide: "Style guide",
    dashboard: "Dashboard",
    withVariation: (label, v) => `${label} · ${v}`,
  },

  // ── Preview "looks blank?" help strip ───────────────────────────────────────
  previewHelp: {
    blankHtml: "Preview looks blank? First try the tab’s <b>⟳</b> reload. Still blank?",
    refresh: "Refresh Browser",
    dismiss: "Dismiss",
  },

  // ── Home-build progress cover ───────────────────────────────────────────────
  buildOverlay: {
    title: "Designing your home page…",
    hint: "Your Style guide is ready, have a look while this finishes.",
  },

  // ── Publish help overlay (static chrome: title + tabs) ──────────────────────
  pubhelp: {
    title: "Publishing, step by step",
    tabStart: "Getting started",
    tabHow: "How to publish",
  },

  // ── Confirm dialog (static cancel; title/ok are set per call) ───────────────
  confirm: {
    cancel: "Cancel",
  },

  // ── Commands: the Help drawer + composer "Commands ▾" popover ────────────────
  commands: {
    helpIntro: "Click a command to run it in the chat, or type it yourself. Setup runs first, then design freely.",
    run: "▸ run",
    runTitle: (cmd) => `Run: ${cmd}`,
    list: [
      ["/setup-project", "Set the client/project name, project type, tablet preview, and menu style."],
      ["/setup-styleguide", "Set the client’s fonts, colors, and example styleguide sections."],
      ["/design", "Build or edit a page (hero, sections, landing) in the design phase."],
      ["/guide", "Show the list of commands."],
      ["/clear", "Start a fresh session, clearing the chat for faster replies (saved work is kept)."],
      ["/export-company", "Save your agency identity (name, admin fonts, logo) as a portable file."],
      ["/import-company", "Apply a saved company profile into this project."],
      ["export to Figma", "Ask in plain language to push the styleguide, blocks, or pages to Figma."],
      ["/upgrade", "Apply the latest template version (keeps your design work)."],
    ],
  },

  // ── Sidebar drawer titles (the PANELS map) ──────────────────────────────────
  panels: {
    site: "CMS",
    help: "About",
    projects: "Switch Project",
    publish: "Publish",
    company: "Company Profile",
    figma: "Figma Export",
    voice: "Copy Voice",
    claude: "Claude Settings",
    director: "Art Director",
    a11y: "Accessibility",
    licenses: "Keys & Licenses",
  },

  // ── Accessibility review drawer (P4) — axe findings → Fix/Hold/Dismiss ───────
  // ── Site rail: pages, SEO, blocks and navigation, edited as content ──
  site: {
    lead: "The pages of your site, their search settings, the blocks on each, and the navigation. Edits save to the project and show in the Site tab right away.",
    notLicensed: "The site builder is part of the Design, Research & Art Director license. Add your key under Keys & Licenses to edit pages, posts and settings and to publish the site.",
    notReady: {
      "no-site": "This project doesn’t have a site yet.",
      "not-promoted": "Nothing has been built yet. The site is made from a finished design: its sections become blocks you edit here, and its pages appear in this drawer.",
      "no-home": "The site has no home page yet.",
      "no-project": "Open a project to edit its site.",
    },
    tabs: { pages: "Pages", posts: "Posts", types: "Types", forms: "Forms", media: "Media", blocks: "Blocks", nav: "Navigation", settings: "Settings" },
    mediaTabDesc: "Every image in the project, the same library the image fields pick from. Hover an image to rename or delete it.",
    mediaVideoDesc: "The clips this site plays. Each one keeps the poster still taken when it was added, which is what shows before it starts and for visitors who ask for less motion.",
    mediaFilesDesc: "Documents and downloads for the site: PDFs, spreadsheets, decks, archives, audio and video. Link to one from any menu or link field.",
    mediaKinds: { image: "Images", video: "Video", file: "Files" },
    // "Build the site from this design": the one chat-driven step between designing and
    // running the site (/promote-blocks), started from a button here and in Publish.
    build: {
      button: (vid) => `Build the site from design ${vid}`,
      note: "Takes a few minutes. Each section becomes an editable block, the copy and images move into content you edit here, and the header and footer become the site’s frame. The chat shows progress; this drawer opens when it’s done.",
      needDesign: "Finish a design first: the site is built from it.",
      needLicense: "Building the site is part of the Design, Research & Art Director license. Add your key under Keys & Licenses.",
      running: (vid) => `Building the site from design ${vid}… The chat shows progress; this opens when it’s done.`,
      request: (vid) => `/promote-blocks ${vid}\nThe designer approved design variation ${vid} in the app. Promote that one; don't ask which.`,
      echo: (vid) => `Build the site from design ${vid}.`,
      failed: "The build didn't finish. The chat has the details; fix what it names, then try again.",
    },
    // Blocks tab sections (docs/wordpress-import-lossless-spec.md): the design's blocks,
    // and the imported ones that still need a design pass.
    blocksActive: "Active",
    blocksActiveDesc: "The design's blocks and the built-in ones. Their fields are the design's work; change them through a design pass.",
    blocksNeedsDesign: "Needs design",
    blocksNeedsDesignDesc: "Imported from WordPress with their content and options. Each renders plainly until you design it. Edit its fields first if you want to; once designed, fields are fixed.",
    blockImportedFrom: (wp, n) => `Imported from ${wp}${n ? `, used ${n === 1 ? "once" : `${n} times`}` : ""}`,
    blockFields: (list) => `Fields: ${list}`,
    blockEdit: "Edit fields",
    blockUpdateDesign: "Update design",
    blockDesignRunning: "Designing…",
    blockDesign: {
      title: (name) => `Design ${name}`,
      intro: "The block keeps its fields and its content; the design pass gives it this site’s look, with every option rendered. Add a line of direction if you have one.",
      placeholder: "e.g. photo left, copy right, like the hero's image treatment",
      briefLink: "The brief",
      go: "Send to the designer",
      cancel: "Cancel",
      request: (key, direction) => `/design-block --from-brief ${key}${direction ? `\n\nDirection: ${direction}` : ""}`,
      echo: (name) => `Design ${name} from its imported content`,
      pane: (name) => `Designing ${name}`,
    },
    blockUseExisting: "Use an existing design",
    blockUse: {
      title: (name) => `Use an existing design for ${name}`,
      intro: "Move this block’s content into one of the design’s blocks. Pair each field with where it lands; anything left unpaired is dropped. Every page using this block switches to the chosen one, and this block is removed.",
      target: "Design block",
      pick: "Choose a block…",
      pairing: "Where each field lands",
      drop: "Drop",
      unpaired: (n) => `${n === 1 ? "1 field" : `${n} fields`} will be dropped.`,
      apply: "Apply",
      cancel: "Cancel",
      confirmTitle: (name, target) => `Replace ${name} with ${target}?`,
      confirm: (n, dropped) => `${n === 1 ? "1 instance" : `${n} instances`} on the site switch to the chosen block with the pairing shown${dropped ? `, and ${dropped === 1 ? "1 field's content is dropped" : `${dropped} fields' content is dropped`}` : ""}. The imported block is removed. This can't be undone from here.`,
      confirmOk: "Replace",
      done: (n) => `Done: ${n === 1 ? "1 instance" : `${n} instances`} moved.`,
    },
    blockEditor: {
      title: (name) => `Fields of ${name}`,
      intro: "Name each field the way you want it to read in the page editor, or remove one you won’t need. A removed field leaves every page using this block in the same step.",
      remove: "Remove field",
      undo: "Keep this field",
      save: "Apply",
      cancel: "Cancel",
      applied: (n) => `Applied${n ? ` to ${n === 1 ? "1 content file" : `${n} content files`}` : ""}.`,
      nothing: "No changes.",
    },
    // Home page → Advanced: overwrite its blocks with another page's (after an import, or any time).
    homeAdvanced: {
      heading: "Advanced",
      overwriteLabel: "Overwrite the home page's content from another page",
      overwriteHint: "Replaces the home page's blocks with the chosen page's blocks. Title and search settings stay. The chosen page becomes a draft if it isn't one already, so the same sections aren't published twice.",
      pick: "Choose a page…",
      button: "Overwrite the home page",
      confirmTitle: "Overwrite the home page?",
      confirm: (title, n, alreadyDraft) => `The home page's blocks are replaced with the ${n === 1 ? "1 block" : `${n} blocks`} from "${title}". This happens at once and can't be undone from here. ${alreadyDraft ? `"${title}" stays a draft.` : `"${title}" becomes a draft, so its sections are published once, on the home page.`}`,
      confirmOk: "Overwrite",
      done: (title, drafted) => `Home page rewritten from "${title}".${drafted ? " That page is now a draft." : ""}`,
    },
    // Lists: the status filter and select-all publishing (Pages, Posts, Types).
    filterHeading: "Filter",
    filteredNote: (label) => `Filtered: ${label}`,
    statusFilter: { all: "All", published: "Published", draft: "Drafts" },
    selectAll: "Select all",
    selectedCount: (n) => (n === 1 ? "1 selected" : `${n} selected`),
    publishSelected: "Publish selected",
    unpublishSelected: "Unpublish selected",
    publishNote: "A draft is never on the published site. Publishing here makes the selected items part of the next publish.",
    publishConfirmTitle: (n) => `Publish ${n === 1 ? "1 item" : `${n} items`}?`,
    publishConfirm: (n) => `${n === 1 ? "This item joins" : "These items join"} the site on the next publish. Each address is checked first; anything whose address is already taken is left as a draft and named.`,
    unpublishConfirmTitle: (n) => `Unpublish ${n === 1 ? "1 item" : `${n} items`}?`,
    unpublishConfirm: (n) => `${n === 1 ? "This item becomes a draft" : "These items become drafts"}: previewed here, left out of the next publish.`,
    publishOk: "Publish",
    unpublishOk: "Unpublish",
    publishedDone: (n, refused) => `${n === 1 ? "1 item" : `${n} items`} published${refused ? `, ${refused === 1 ? "1 refused" : `${refused} refused`}` : ""}.`,
    unpublishedDone: (n) => `${n === 1 ? "1 item" : `${n} items`} unpublished.`,
    publishRefused: (r) => `"${r.title}" stays a draft: ${r.route} is already "${r.by}".`,
    blocksDesc: "Every block this site can use: the ones promoted from the design, plus the built-in ones every site has. Give a block a name that's easier to recognise when composing pages; the block itself doesn't change.",
    blockBuiltIn: "Built in",
    blockOriginal: (n) => `Design name: ${n}`,
    blockUsedOn: (pages) => `Used on: ${pages.join(", ")}`,
    blockUnused: "Not used on any page yet",
    codePlaceholder: "<script>…</script> or any HTML",
    helpTip: "Help with this tab",
    // forms (the Forms tab + the Form block's picker)
    formsHeading: "Forms",
    formsDesc: "Forms visitors fill in: their fields, the button, what happens after, and who receives each submission. Put one on a page with the Form block.",
    noForms: "No forms yet.",
    newFormPlaceholder: "Form name (e.g. Contact)",
    editForm: "Edit form",
    formName: "Name",
    formMeta: (fields, used) => `${fields === 1 ? "1 field" : `${fields} fields`} · ${used === 0 ? "not on a page yet" : used === 1 ? "on 1 page" : `on ${used} pages`}`,
    formFieldsHeading: "Fields",
    formFieldsDesc: "In the order they appear on the page.",
    formFieldLabel: "Label",
    formFieldId: "id",
    formFieldIdLabel: "Field ID",
    formFieldIdHint: "The name this value arrives under in each email. It’s made from the label; renaming it on a live form changes what the client’s emails look like.",
    fieldShowId: "Show ID",
    fieldHideId: "Hide ID",
    formFieldPlaceholder: "Placeholder",
    formFieldHelp: "Help text",
    formFieldTypes: { text: "Text", email: "Email", phone: "Phone", textarea: "Long text", select: "Choice", checkbox: "Checkbox" },
    formAddField: "+ Add a field…",
    honeypotNote: "Every form also carries a hidden honeypot field that bots fill in and people never see; those submissions are dropped.",
    formSubmitHeading: "Submit button",
    formSubmitLabel: "Button text",
    formAfterHeading: "After submitting",
    formAfterMode: "Then",
    formAfterMessage: "Show a message",
    formAfterPage: "Go to a page",
    formAfterMessageLabel: "Thank-you message",
    formAfterPageLabel: "Page",
    formAfterPageHint: "A page of this site, like a thank-you page. Make it in Pages first.",
    formDeliveryHeading: "Delivery",
    formDeliveryDesc: "Who receives each submission. The sending service is set up once for the whole site, in Delivery below the forms.",
    formRecipients: "Send to",
    formRecipientsPlaceholder: "hello@client.com, owner@client.com",
    formRecipientsHint: "One or more addresses, separated by commas.",
    formReplyTo: "Reply-to",
    formReplyToPlaceholder: "noreply@domain.com",
    formReplyToHint: "Where a reply goes when the client hits Reply. Use noreply@ their domain when replies shouldn’t reach anyone, a real address when they should. With an email field on the form, choose it below and the submitter’s own address is used instead.",
    formReplyToField: "Reply to the submitter",
    formReplyToFieldNone: "No, use the reply-to address",
    formReplyToFieldHint: "Pick the form’s email field so each reply goes straight back to the person who wrote.",
    formRecaptcha: "Protect with Google reCAPTCHA v3",
    formRecaptchaHint: "Invisible to visitors. Needs the site’s reCAPTCHA keys, which arrive with delivery; until then the choice is only remembered.",
    formUsedOn: "Used on",
    formUsedNowhere: "Not on any page yet. Add a Form block to a page and pick this form.",
    saveForm: "Save form",
    deleteForm: "Delete form",
    deleteFormConfirm: (n, used) => used ? `Delete “${n}”? It’s on ${used === 1 ? "1 page" : `${used} pages`}; those blocks show no form until you pick another.` : `Delete “${n}”?`,
    formPickNone: "Choose a form…",
    formPickMissing: (id) => `${id} (missing)`,
    formPickHint: "Forms are made in the Forms tab.",
    // delivery (site level, the card at the top of the Forms tab)
    delivery: {
      title: "Delivery",
      intro: "How submissions reach the client: a transactional mail service you set up once for this site. The key stays in the app and goes to the site’s hosting at publish; it’s never written into the project.",
      statusReady: (provider, from) => `Sending through ${provider} as ${from}.`,
      statusNoKey: "Not connected yet: choose a service, enter the from address and paste its key.",
      statusNoForms: "Forms on the published site can't send until this is set up.",
      provider: "Service",
      providerNone: "Not set up",
      providers: { resend: "Resend", postmark: "Postmark", sendgrid: "SendGrid" },
      from: "From address",
      fromPlaceholder: "Website <forms@client.com>",
      fromHint: "The sender the client sees. It must be at a domain verified with the service (the client’s own domain, not gmail.com); a name in front is optional.",
      key: "API key",
      keyPlaceholder: "Paste the key",
      keySaved: (hint) => `**********${hint}`,
      removeKey: "Remove key",
      show: "Show",
      hide: "Hide",
      save: "Save delivery",
      saved: "Saved",
      testTo: "Send a test to",
      testPlaceholder: "you@yourstudio.com",
      test: "Send a test",
      testing: "Sending…",
      testOk: (to) => `Sent. Check ${to} (and its spam folder the first time).`,
      testFail: (why) => `Not sent: ${why}`,
      open: (provider) => `Open ${provider}`,
      // Setup steps per service. Kept short; each ends where the key gets pasted here.
      steps: {
        resend: [
          "Create an account at resend.com. The free plan covers a website’s contact forms.",
          "API Keys → Create API key, with Sending access. Copy it and paste it below; it’s shown once.",
          "Domains → Add domain: the client’s domain (client.com). Add the DNS records it lists at the domain’s registrar and wait for it to show Verified.",
          "From address: an address at that domain, like Website <forms@client.com>.",
          "Follow Resend’s instructions for keeping email out of recipients’ spam folders (SPF, DKIM and DMARC records on the domain, a real reply-to address).",
        ],
        postmark: [
          "Sign up at postmarkapp.com. New accounts can send to addresses on their own domain right away; Postmark reviews the account before it sends anywhere else.",
          "Sender Signatures → Domains → Add domain: the client’s domain. Add the DKIM and Return-Path DNS records at the registrar and verify.",
          "Servers → your server → API Tokens: copy the Server API token and paste it below.",
          "From address: an address at the verified domain, like Website <forms@client.com>.",
        ],
        sendgrid: [
          "Sign up at sendgrid.com.",
          "Settings → Sender Authentication → Authenticate Your Domain: the client’s domain. Add the DNS records at the registrar and verify.",
          "Settings → API Keys → Create API Key, Restricted Access with Mail Send on. Copy it and paste it below; it’s shown once.",
          "From address: an address at the authenticated domain, like Website <forms@client.com>.",
        ],
      },
      fallback: "The thinkany relay, for sites without a service of their own, is coming as a separate license.",
    },
    // Per-tab help, as an outline: what the tab is for, then what you can do on it.
    help: {
      pages: {
        title: "Pages",
        intro: "Every page of your site, built from the blocks that came out of your approved design. Pick a page on the left to edit it on the right.",
        sections: [
          { h: "Find a page", items: ["<b>Search pages</b>, at the top of the list, matches page names as you type. The matches appear on the right as pills; click one to open it. Clear the search and what you were editing comes back."] },
          { h: "Add or remove pages", items: ["Type a title in the <b>Create</b> row under the search. The page’s permalink is made from the title and follows it until you edit it in the editor.", "<b>Delete page</b> removes its file. The home page can’t be deleted.", "A new page needs a link in <b>Navigation</b> to be reachable from the menu."] },
          { h: "Nested pages", items: ["Drag a page onto another to nest it (<i>/about/island-guide</i>); drop it between pages to put it at that level. <b>Parent page</b> in the editor does the same.", "Menu links to a moved page are updated to its new address."] },
          { h: "Edit a page", items: ["<b>Page settings</b>: title, permalink, parent page.", "<b>Save page</b> writes the changes; the Site tab updates right away."] },
          { h: "Blocks", items: ["Reorder with the arrows, remove with ×, add one from the list at the bottom.", "<b>Edit content</b> opens a block’s text, images and lists. Images use the upload zone: drop a file, or choose one already in the project.", "Blocks come from the approved design. To change how a block looks, edit the design in the chat; to change what it says, edit here."] },
          { h: "SEO", items: ["The last section: SEO title, meta description, share image, keyphrase, whether search engines may list the page, and an optional custom schema block. These go into the page's head on every version of the site: published, gated preview and local.", "<b>SEO</b> (the sparkle button at the top of the section) writes the title, description and keyphrase from the page's own content, plus a custom schema when the content is an FAQ, an event or a product. Review the fields, then save."] },
        ],
      },
      posts: {
        title: "Posts",
        intro: "Your blog. Posts are written here and listed at the posts directory (Settings, Blog: /blog by default), newest first.",
        sections: [
          { h: "Find a post", items: ["<b>Search posts</b>, at the top of the list, matches as you type: posts matching by name first, then posts carrying a matching tag. The matches appear on the right as pills; click one to open it. Clear the search and what you were editing comes back.", "<b>Tags</b>, under the Create row, expands to every tag with the number of posts carrying it. Click a tag to list its posts on the right, then click a post to edit it."] },
          { h: "Write a post", items: ["Type a title in the <b>Create</b> row to start a draft. Drafts are never published, so you can work on them across sessions.", "<b>Publish date</b> is the date shown on the post; <b>Last edited</b> is stamped automatically on every save.", "<b>Summary</b> appears in the blog list and as the search description.", "<b>Tags</b>: pick one another post already uses, or type a new one and press Enter. Each shows as a pill you can remove; reusing existing tags keeps spellings consistent."] },
          { h: "SEO", items: ["The last section: SEO title, meta description (leave empty to use the summary), share image, keyphrase, whether search engines may list the post, and an optional custom schema block. Posts also carry article structured data with their dates.", "<b>SEO</b> (the sparkle button at the top of the section) writes the title, description and keyphrase from the post itself. Review the fields, then save."] },
          { h: "Draft and publish", items: ["A draft shows <b>Save draft</b> and <b>Publish</b>. Publish makes it live on the next site publish.", "A published post shows <b>Save</b> and <b>Unpublish</b>. Unpublish takes it back to a draft without deleting it.", "<b>Delete post</b> removes the file for good."] },
        ],
      },
      types: {
        title: "Types",
        intro: "Your own kinds of content, like products, team members or landing pages. A type has fields, an address, and a content template built from your blocks; every entry gets a form made from those fields.",
        sections: [
          { h: "Create a type", items: ["<b>Add a content type</b>, give it a name (the address is made from it), and add <b>fields</b>: text, long text, rich text, number, yes/no, date, image, choice, list, link, or a reference to another type.", "Tick <b>Show an index page</b> to list every entry at the type’s address.", "In <b>Content template</b>, choose the blocks that render each entry. In any text, <code>{{field}}</code> fills in that field; <code>{{title}}</code> is the entry’s title. A field name alone in an image slot, like <code>{{photo}}</code>, hands over the whole image."] },
          { h: "Add entries", items: ["Under a type, type a title and <b>Add</b>. The entry’s form has one control per field.", "An entry can use <b>its own blocks</b> instead of the template, which is how a landing page works.", "Entries live at the type’s address plus their own, like /products/blue-widget."] },
          { h: "Change or remove", items: ["Click a type to edit its fields or template; existing entries keep their content.", "<b>Delete type</b> stops publishing its entries but leaves their files in the project."] },
        ],
      },
      blocks: {
        title: "Blocks",
        intro: "The block library: everything a page can be composed from.",
        sections: [
          { h: "Display names", items: ["Rename a block for recognition (<i>Alternating content</i> instead of <i>Island Guide</i>, say). The name shows in the block picker and on page rows; the block's design and fields are unchanged. Clear the field to go back to the design's name."] },
          { h: "Built-in blocks", items: ["<b>Code snippet</b>: paste HTML or a script (a HubSpot form, an embed, a widget) and it's placed on the page as written. It runs on the site; the design surface shows the markup but doesn't run scripts.", "<b>Form</b>: a form from the Forms tab, with an optional heading and intro, in the design's tokens."] },
          { h: "New blocks", items: ["Blocks come from the design: promote a design, or ask for a new section in the chat, and it appears here."] },
        ],
      },
      nav: {
        title: "Navigation",
        intro: "The links in the site’s header and footer.",
        sections: [
          { h: "Links", items: ["<b>Link Text</b> is what the visitor reads. <b>URL</b> is where it goes.", "The URL field is a list too: open it to pick any page, home-page section, post, content entry or index in the project. Picking fills the link text when it’s empty.", "Drag the grip to reorder, remove with the trash icon, <b>+ Add link</b> for a new one."] },
          { h: "Sub-links", items: ["<b>+ Sub-link</b> under a link makes a dropdown on desktop and an expandable group on mobile."] },
          { h: "Mega menu", items: ["When the site’s header was designed with a mega menu, each link also offers <b>+ Panel</b> (a heading and its links) and <b>+ Promo panel</b> (an image, a title, a line of text and a link, shown beside the other panels; one per menu), under its sub-links. The chevron on a link hides its sub-links and panels; the one on a panel folds it to its heading row. Headers designed with a plain dropdown don’t show panels.", "Drag to rearrange: a link moves with its group, sub-links and panel links can be dropped into any group or panel, or between top-level links to become one."] },
          { h: "Footer", items: ["The footer's own list, independent of the header menu. It starts as a copy of the design's footer links; from then on the two are managed separately.", "<b>Columns</b>: add sub-links to a footer link (or drop links into it) and it becomes a column headed by its text; leave its address empty when the heading shouldn't be a link."] },
          { h: "Legal", items: ["<b>Copyright line</b>: shown at the bottom of every page; <i>{year}</i> and <i>{siteName}</i> are filled in automatically.", "<b>Legal links</b>: Privacy, Terms and the like, shown beside the copyright line."] },
        ],
      },
      settings: {
        title: "Settings",
        intro: "Options for this site.",
        sections: [
          { h: "Images", items: ["Every image added through the site is optimized automatically (AVIF, scaled to the maximum width). SVG, GIF and AVIF files are kept as they are.", "<b>Quality</b>: lower is smaller. 55 suits photos; 70 or more suits illustrations and screenshots.", "<b>Maximum width</b>: larger images are scaled down on upload; smaller ones are never scaled up.", "Changes apply to new uploads; images already in the project are left alone."] },
          { h: "Search engines: defaults", items: ["<b>Website Name</b> follows every page title (<i>Island Guide | Visit Hawaii</i>) and names the site on shared links; <b>Title Separator</b> is the mark between them.", "<b>Site Image</b> is the share image for any page or post without one of its own."] },
          { h: "Structured data", items: ["Every page carries structured data (JSON-LD) generated for it: the website and its publisher (from the <b>Structured data</b> group here), the page with its breadcrumbs, posts as articles, indexes as collections. Set the publisher type, name, logo, social profiles and, for a local business, phone, address and hours.", "A page or post can add its own block in its SEO section (<b>Custom schema</b>): an FAQ, an event, a product.", "It's in every version of the site, published and previews alike, so it can be reviewed in the page source or a validator."] },
          { h: "Search engines: visibility", items: ["<b>Discourage search engines</b> asks them to stay away (robots.txt, noindex on every page, no sitemap): for a site that isn't public yet.", "<b>Enable sitemap</b> builds the sitemap search engines read; off while search engines are discouraged.", "<b>Enable llms.txt</b> publishes a plain-text summary for AI assistants, generated from the site's pages and posts, or your own text."] },
          { h: "Navigation", items: ["<b>Manage Navigation</b> on: the menu is whatever you build in the Navigation tab. Off: the menu follows the page outline (top-level pages in order, child pages as sub-links), so adding or moving a page updates the menu.", "A header designed with a mega menu can't be driven from the outline; the switch stays on."] },
          { h: "Blog", items: ["<b>Posts Directory</b> is the address posts are listed under and served from (<i>/blog</i>, <i>/blog/my-post</i>). Change it to <i>news</i>, <i>journal</i>, whatever fits. Menu links to posts follow the change, and no page may take that address."] },
          { h: "Scripts", items: ["<b>Google Tag Manager</b>: paste the container ID and both official snippets are added; or paste a snippet of your own for the head.", "<b>Additional scripts</b>: any tag, with a placement (header, after the opening body tag, before the closing body tag).", "Scripts go into the published site only. The design previews and the local site preview never carry them, so nothing is tracked while you work."] },
          { h: "Logos", items: ["Four spots: <b>Header</b> and <b>Footer</b>, each on desktop and on mobile. Add a logo and pick its spot. One logo covers every spot; a second one can take, say, the mobile header (a compact mark) or the footer (a light version on a dark band).", "The logo used during the design fills the desktop header spot automatically (marked <i>From the design</i>); change its spot or replace it as you like.", "With no logo at all, the <b>Wordmark</b> shows as text; it defaults to the project name.", "SVG is best; PNG is kept as uploaded."] },
          { h: "Icons", items: ["<b>Browser icon</b>: the tab, bookmark and search-result icon. SVG is best, sharp at every size. For a PNG, the classic sizes are <b>16 × 16</b> (tabs, bookmarks, history), <b>32 × 32</b> (high-resolution screens and taskbars; the one to pick if you supply a single PNG) and <b>48 × 48</b> (older Windows desktop use, optional). Square, and kept as uploaded, never converted.", "<b>Home-screen icon</b>: a 180 × 180 PNG without transparency, for phones that add the site to the home screen. Optional.", "Without an icon of its own, the site shows the template's default."] },
          { h: "Redirects", items: ["<b>Manage redirects</b> opens the list. Each one has a <b>type</b> (301 permanent by default; 302 for a temporary move), the <b>old address</b> as a path like <i>/old-page</i>, and where it <b>redirects to</b>: a path on this site or a full address elsewhere.", "Adding or removing saves at once. The local preview honours redirects right away; the published site picks them up on the next publish.", "<b>Import</b> reads a Redirection plugin export (JSON or CSV), a Yoast Premium CSV export, or a spreadsheet saved as CSV with the old and new addresses in two columns and an optional type column. Regex rules and 410/451 entries are skipped and counted; addresses already listed are left as they are."] },
          { h: "Import from WordPress", items: ["Moves an existing WordPress site's content into this site in four steps: <b>the plugin</b> (a read-only export you upload to the WordPress site), <b>the content</b> (fetched with the site's address and token, or loaded from a file made with <i>wp thinkany export</i>), <b>the mapping</b> (which old block or field lands in which of this site's blocks: proposed for you, confirmed by you in the mapping file), and <b>the import</b> (pages, posts, entries and images written in, plus a redirect for every old address that changed).", "Before the site is built, the same panel offers the inventory as a <b>brief</b> for the new design, so the pages and sections you design are the real ones.", "The import is honest about its limits: blocks and fields with no destination, embeds, shortcodes and forms are listed in the <b>report</b>, per page, as your punch list. Tables inside old content become Table blocks. Nothing is ever written to the WordPress site."] },
          { h: "Site", items: ["Which design the site is built from, and its live address once published. Publishing happens in the Publish panel."] },
          { h: "Site builder", items: ["The switch at the bottom turns the site builder off for this project: only Settings stays reachable, the Site tab shows a note, and publishing waits. Nothing is deleted; turn it back on any time."] },
        ],
      },
      media: {
        title: "Media",
        intro: "The project’s library, in two parts: Images (everything under the images folder, which is what every image field picks from) and Files (documents and downloads served at /files/, which the link pickers can point at). Each part has its own folders and tags.",
        sections: [
          { h: "Image settings", items: ["The gear across from <b>Images | Files</b> opens the image optimization sliders: quality and the largest width for new uploads. They are the same settings as <b>Settings → Images</b>; change them in either place."] },
          { h: "Add images", items: ["<b>Add images…</b> picks files from your computer; <b>From your phone…</b> shows a code your phone scans to send photos over Wi‑Fi.", "Added images are optimised for the web automatically (AVIF, up to 2400px wide). SVG, GIF and AVIF files are kept as they are."] },
          { h: "Files", items: ["Switch to <b>Files</b> for PDFs, spreadsheets, decks, CSV, text, ZIP, audio and video. <b>Add files…</b> copies them into the project as they are, served at <i>/files/name.pdf</i>.", "Files have their own folders and tags, rename and delete like images, and a detail view that previews PDFs.", "To use one, pick it from the <b>Files</b> group in any link field or menu item."] },
          { h: "Folders and tags", items: ["Folders are tags: an image sits in every folder it's tagged with, and <b>New folder</b> makes a tag. Drag an image onto a folder to file it, or click an image and add tags in its detail view; tags save as you add them.", "Rename or delete a folder from its hover controls; the change applies to every image carrying the tag, and deleting a folder never deletes images."] },
          { h: "Manage", items: ["Hover an image for <b>Rename</b> and <b>Delete</b>. A renamed image keeps its extension; a name already in use gets a number added, and every page using it is updated to match.", "Deleting moves the image to the Trash in Settings, restorable for 30 days. Pages using it show a broken image until it's restored or replaced.", "<b>Filter by name</b> narrows the grid."] },
        ],
      },
      redirects: {
        title: "Redirects",
        intro: "A redirect sends a visitor, and a search engine, from an old address on this site to a new one. Use one whenever a page moves, is renamed or is retired, so old links and search results still land somewhere useful.",
        sections: [
          { h: "Types", items: ["<b>301 Permanent</b>: the page has moved for good. Search engines pass the old page's ranking to the new address. The default, and right for almost every case.", "<b>302 Temporary</b>: the page is elsewhere for now and will come back. Search engines keep the old address in their index.", "<b>307</b> and <b>308</b> are the temporary and permanent variants that also keep the request method (a form submission stays a submission). Rare on a marketing site; use them only when a developer asks for them."] },
          { h: "Addresses", items: ["<b>Old address</b> is a path on this site, like <i>/old-page</i>. Full URLs are reduced to their path.", "<b>Redirect to</b> is a path on this site, like <i>/new-page</i>, or a full address elsewhere starting with <i>https://</i>.", "Each old address can appear once, and it can't point at itself."] },
          { h: "Import", items: ["<b>Redirection</b> (WordPress plugin): Tools → Redirection → Import/Export, export as JSON or CSV, then import the file here.", "<b>Yoast SEO Premium</b>: SEO → Redirects → Export, download the CSV, then import it here.", "<b>Spreadsheet</b>: save as CSV with the old address in one column and the new in the next, and an optional type column (301, 302, 307 or 308). Headings such as <i>Old URL</i> / <i>New URL</i> or <i>source</i> / <i>target</i> are recognised; without headings the first three columns are used.", "Regex rules and 410 / 451 “gone” entries can't be expressed here and are skipped; the result line says how many. Old addresses already in the list are left as they are."] },
          { h: "When they take effect", items: ["The local preview honours redirects as soon as they're saved. The published site picks them up on the next publish."] },
        ],
      },
      forms: {
        title: "Forms",
        intro: "Forms visitors fill in: a contact form, a quote request, a sign-up. Define the form here, then put it on a page with the Form block.",
        sections: [
          { h: "Create a form", items: ["Type a name in <b>Add a form</b>. It starts with name, email and message; change anything.", "<b>Add a field</b> offers text, email, phone, long text, a choice list and a checkbox. Each has a label, a placeholder, help text and a required switch. Drag isn't needed: the arrows reorder.", "The field <b>id</b> is made from the label (lowercase, dashes) and is the name the value arrives under. Renaming it on a live form changes what the client's emails look like."] },
          { h: "Button and after", items: ["<b>Button text</b> is the submit button's label.", "<b>After submitting</b>: show a thank-you message in the form's place, or go to a page of the site (a thank-you page you made in Pages)."] },
          { h: "Delivery (the section below the forms)", items: ["Set up once per site, one step at a time: pick the <b>service</b> (Resend, Postmark or SendGrid), follow its steps to verify the client's domain and create a key, enter the <b>from address</b> at that domain, paste the <b>API key</b>, then <b>Send a test</b> to yourself.", "The key is kept by the app on this computer and set on the site's hosting when you publish. It never goes into the project folder.", "Until this is set up, a published form tells the visitor it isn't connected yet, and the publish log says so. The Site tab preview always shows the success state without sending."] },
          { h: "Per form", items: ["<b>Send to</b>: the addresses that receive each submission, comma-separated.", "<b>Reply-to</b>: where a reply goes. Choose the form's email field to reply straight to the person who wrote; otherwise the address you enter is used (<i>noreply@</i> when replies shouldn't land anywhere).", "Every form carries a hidden honeypot field that bots fill in; those submissions are dropped. <b>reCAPTCHA v3</b> is an extra invisible check that needs the site's keys."] },
          { h: "On a page", items: ["Add a <b>Form</b> block to any page and choose the form. The block has an optional heading and intro.", "The Site tab shows the form working: sending shows the thank-you state with a note that nothing was sent.", "<b>Used on</b> lists the pages a form is on. Deleting a form leaves those blocks empty until another is chosen."] },
        ],
      },
    },
    liveAt: "Live at",
    previewNote: "Previewing in the Site tab. Publish from the Publish panel when it’s ready.",
    pagesHeading: "Pages",
    addPage: "Add a page",
    // Search + Tags at the top of the Pages / Posts lists
    searchPages: "Search pages",
    searchPosts: "Search posts by name or tag",
    searchResults: (q) => `Results for “${q}”`,
    searchNone: "No matches.",
    tagsExpander: "Tags",
    tagsNone: "No tags yet.",
    tagPosts: (t) => `Posts tagged “${t}”`,
    newPagePlaceholder: "Page title (e.g. About)",
    create: "Create",
    pageSettings: "Page settings",
    previewExpand: "Expand",
    previewExpandTip: "Edit this block in a larger view",
    blockEditDone: "Done",
    previewDesktop: "Desktop",
    previewMobile: "Mobile",
    previewUnavailable: "The design preview isn't running, so the block can't be shown here yet.",
    pageSlugHint: "Made from the title until you edit it. One word or hyphenated, no slashes; a nested page’s address follows its parent’s, like /about/island-guide.",
    pageParent: "Parent page",
    pageParentNone: "None (top level)",
    pageParentHint: "Nest this page under another. Its address becomes the parent's plus its own, and menu links to it are updated.",
    pageTitle: "Title",
    pageSlug: "Permalink",
    homeSlug: "/ (home)",
    seoHeading: "SEO",
    seoTitle: "SEO Title",
    seoTitleHint: "Shown in the browser tab and search results. Leave empty to use the page title.",
    seoDescription: "Meta Description",
    seoKeyphrase: "Keyphrase",
    seoJsonLd: "Custom schema (JSON-LD)",
    seoJsonLdPlaceholder: '{ "@type": "FAQPage", … }',
    seoJsonLdHint: "Optional. A JSON object or array added to this page's structured data, for an FAQ, an event, a product. The page already carries WebPage, breadcrumbs and the publisher; a post carries BlogPosting.",
    seoKeyphraseHint: "The phrase this page should be found for. Written into the page's keywords; use it in the title, description and headings.",
    postSettings: "Post settings",
    postSlug: "Permalink",
    postSlugHint: "The post's address under the posts directory. Leave it empty to use the title.",
    postContent: "Content",
    postSeoDescriptionHint: "For search results and link previews. Leave empty to use the post's summary.",
    seoDescriptionHint: "One or two sentences for search results and link previews.",
    seoImage: "Share Image",
    seoImageHint: "A path in public/ (e.g. /images/hero.jpg) or a full URL.",
    seoNoindex: "Hide this page from search engines",
    seoFill: "SEO",
    seoFillTitle: "Write the SEO title, description and keyphrase from this content with Claude",
    seoFillWorking: "Evaluating content",
    seoFillDone: "Filled from the content. Review, then save.",
    seoFillFail: "Couldn't write the SEO fields.",
    seoFillNoKey: "Connect a Claude API key first (Keys & Licenses).",
    blocksHeading: "Blocks",
    noBlocks: "No blocks yet. Add one below.",
    addBlock: "Add a block",
    designBlock: "Design a new block…",
    designBlockPrompt: "Describe the section you want (what it’s for, what it should show).",
    designBlockPlaceholder: "e.g. three customer testimonials with photos",
    designBlockGo: "Send to the designer",
    designBlockCancel: "Cancel",
    designBlockRequest: (desc, page, refs) => `/design-block ${desc}\nPage: ${page}` + (refs && refs.length ? `\nReferences (inspiration only, in .thinkany/references; digest at .thinkany/references/digest.md): ${refs.map((r) => `${r.id} (${r.name})`).join(", ")}` : ""),
    designBlockRefs: "Add reference images…",
    designBlockRefsHint: "Optional. Images or PDFs the new section can take inspiration from; the design's own colours, type and rhythm still apply. Drop files here or use the button.",
    designBlockRefsPhone: "Send from your phone",
    designBlockRefsReading: "Reading the references…",
    designBlockRefRemove: "Remove",
    // What the chat shows for that request (the command itself stays out of view).
    designBlockEcho: (desc, page) => `Design a new block for the ${page} page: ${desc}`,
    editContent: "Edit content",
    hideContent: "Hide content",
    moveUp: "Move up",
    moveDown: "Move down",
    removeBlock: "Remove Block",
    dragToReorder: "Drag to reorder",
    columns: "Panels",
    addColumn: "+ Panel",
    addColumnTip: "Add a mega menu panel",
    columnHeading: "Panel heading",
    panelCollapse: "Collapse this panel to its heading",
    panelExpand: "Show this panel's links and feature",
    panelLinkCount: (n) => (n === 1 ? "1 link" : `${n} links`),
    removeColumn: "Remove panel",
    columnFeature: "Promo panel",
    addPromo: "+ Promo panel",
    addPromoTip: "Add the promo panel: an image, a title, a line of text and a link, shown beside the other panels. One per menu.",
    removePromo: "Remove promo panel",
    promoEmpty: "Empty promo panel",
    navPreviewHint: "The site's header, live from what you edit. Click a link, or anything under it, and its menu opens here.",
    treeCollapse: "Hide the pages under this one",
    treeExpand: "Show the pages under this one",
    typeCollapse: "Hide this type's entries",
    typeExpand: "Show this type's entries",
    itemCollapse: "Hide this item's sub-links and panels",
    itemExpand: "Show this item's sub-links and panels",
    featureTitle: "Title",
    featureText: "Text",
    featureImage: "Image",
    featureLink: "Link",
    addItem: "+ Add",
    removeItem: "Remove",
    listItem: (n) => `Item ${n}`,
    save: "Save page",
    saved: "Saved",
    saving: "Saving…",
    leaveTitle: "Unsaved changes",
    leaveMessage: "There are unsaved changes to your content. If you leave, you will lose your changes.",
    leaveOk: "OK",
    cancelEdits: "Cancel",
    cancelEditsTip: "Drop the changes since the last save",
    revertTitle: "Revert changes?",
    revertConfirm: (kind) => `Are you sure you want to revert this ${kind} to its last saved version?`,
    revertOk: "Revert",
    kindPage: "page", kindPost: "post", kindEntry: "entry", kindType: "content type", kindForm: "form",
    deleteTitle: "Move to Trash?",
    deletePage: "Delete page",
    deletePageHasChildren: (n) => n === 1 ? "Has a child page. Move or delete it first." : `Has ${n} child pages. Move or delete them first.`,
    savePageDraft: "Save draft",
    saveEntryDraft: "Save draft",
    deleteConfirm: (t) => `“${t}” goes to the Trash in Settings, where it can be restored for 30 days.`,
    navHeading: "Primary Navigation",
    navHrefHeading: "Leave empty: this is the column's heading",
    navAuto: "The menu follows the page outline. Turn on Manage Navigation in Settings to edit it by hand.",
    footerDesc: "The footer's own links, independent of the header menu. Give a link sub-links and it becomes a column, with its text as the heading (the address is then optional).",
    legalHeading: "Legal",
    legalDesc: "The line at the bottom of every page: copyright, and links like Privacy and Terms.",
    copyright: "Copyright line",
    copyrightHint: "{year} becomes the current year and {siteName} the site name, so it never goes stale.",
    legalLinks: "Legal links",
    navDesc: "The links in the header and footer. A URL can be a page (/about), a section on the home page (/#contact), or a full web address; the list offers everything in the project.",
    navLabel: "Link Text",
    navHref: "URL",
    navHrefHint: "Type a URL, or open the list to choose from the project’s pages, posts, content and home-page sections.",
    navGroups: { pages: "Pages", sections: "Home page sections", posts: "Posts", types: "Content", indexes: "Content indexes", files: "Files" },
    addLink: "+ Add link",
    addSubLink: "+ Sub-link",
    subLinks: "Sub-links",
    footerHeading: "Footer",
    saveNav: "Save navigation",
    postsHeading: "Blog posts",
    noPosts: "No posts yet.",
    addPost: "Add a post",
    newPostPlaceholder: "Post title",
    postDate: "Publish date",
    postUpdated: "Last edited",
    postNeverSaved: "Not saved yet",
    statusDraft: "Draft",
    statusPublished: "Published",
    saveDraft: "Save draft",
    publish: "Publish",
    unpublish: "Unpublish",
    postDescription: "Summary",
    postDescriptionHint: "Shown in the blog list and used as the search description.",
    postImage: "Cover image",
    postTags: "Tags",
    postTagsHint: "Pick a tag other posts use, or type a new one and press Enter. Tags save with the post.",
    postNoTags: "No tags yet.",
    postDraft: "Draft (not published)",
    postBody: "Body",
    postBodyHint: "Format with the toolbar. Images come from the project's images, and a pasted YouTube or Vimeo link becomes the video; the file is saved as markdown.",
    editor: {
      blockText: "Text", blockH2: "Heading 2", blockH3: "Heading 3", blockH4: "Heading 4", blockH5: "Heading 5", blockH6: "Heading 6",
      alignLeft: "Align left", alignCenter: "Align center", alignRight: "Align right",
      blockType: "Text style",
      bold: "Bold", italic: "Italic", strike: "Strikethrough", clear: "Clear formatting (pasted styles, bold, links, headings)",
      bullet: "Bullet list", numbered: "Numbered list", quote: "Quote", code: "Code block",
      link: "Link", image: "Image", rule: "Divider", undo: "Undo", redo: "Redo",
      video: "Embed a video (YouTube or Vimeo)", videoAsk: "Video link", videoPlaceholder: "https://www.youtube.com/watch?v=… or https://vimeo.com/…", videoApply: "Embed",
      videoBad: "Not a YouTube or Vimeo link. Try again",
      linkAsk: "Link to", linkPlaceholder: "/about or https://…", linkApply: "Apply", linkRemove: "Remove link",
      altAsk: "Describe the image", altPlaceholder: "Alt text, for screen readers and search", altApply: "Insert", cancel: "Cancel",
      showMarkdown: "Markdown", showEditor: "Editor",
      placeholder: "Start writing…",
    },
    savePost: "Save post",
    deletePost: "Delete post",
    deletePostConfirm: (t) => `“${t}” goes to the Trash in Settings, where it can be restored for 30 days.`,
    draftTag: "draft",
    // content types
    typesHeading: "Content types",
    typesDesc: "Your own kinds of content, like products or landing pages. Each has fields, a content template built from your blocks, and its own address.",
    addType: "Add a content type",
    newTypePlaceholder: "Type name, plural (e.g. Products)",
    editType: "Edit type",
    typeLabel: "Name (plural)",
    typeSingular: "Name (singular)",
    typePath: "Path",
    typePathHint: "Entries live under this path: products gives /products/blue-widget.",
    siteUrlPlaceholder: "https://this-site-url.com",
    typeIndexToggle: "Show an index page listing all entries at the address",
    typeIndexTitle: "Index title",
    typeIndexDescription: "Index intro",
    typeSettingsHeading: "Settings",
    fieldsHeading: "Fields",
    fieldsDesc: "Every entry gets a title and an address; add the rest here. Drag the grip to reorder.",
    fieldCollapseTip: "Collapse this field",
    fieldExpandTip: "Expand this field",
    fieldUntitled: (n) => `Field ${n}`,
    fieldKey: "key",
    fieldLabel: "Label",
    fieldKind: "Kind",
    fieldRequired: "Required",
    fieldOptions: "Options (comma-separated)",
    fieldReference: "Refers to",
    addField: "+ Add field",
    kinds: { text: "Text", textarea: "Long text", richtext: "Rich text", number: "Number", boolean: "Yes / no", date: "Date", image: "Image", select: "Choice", list: "List of text", link: "Link", reference: "Reference to another type" },
    templateHeading: "Content template",
    templateDesc: "The blocks that render each entry. In any text, {{field}} fills in that field; {{title}} is the entry’s title. A text field like {{image}} alone hands over the whole image.",
    saveType: "Save type",
    deleteType: "Delete type",
    deleteTypeConfirm: (t) => `Delete the “${t}” type? Its entries stay on disk but stop being published.`,
    entries: (n) => n === 1 ? "1 entry" : `${n} entries`,
    noEntries: "No entries yet.",
    addEntry: (s) => `Add ${s}`,
    newEntryPlaceholder: "Title",
    entrySettings: "Entry settings",
    entryFieldsHeading: "Content",
    entryOwnBlocks: "This entry uses its own blocks instead of the template",
    saveEntry: "Save",
    deleteEntry: "Delete",
    deleteEntryConfirm: (t) => `“${t}” goes to the Trash in Settings, where it can be restored for 30 days.`,
    imageSrc: "Image path or URL",
    imageAlt: "Alt text",
    videoClipLabel: "Video clip",
    videoDropHint: "Drop a video here, or click to choose one",
    videoReplace: "· drop or click to replace",
    videoClipHint: "MP4 plays everywhere. The poster below is what shows before the video starts, in a Figma export, and for visitors who ask for less motion.",
    videoNeedsPoster: "This clip has no poster still yet. Add one below: without it the spot is blank before the video starts, in a Figma export, and for visitors who ask for less motion.",
    videoPosterFailed: "The clip is in, but no still could be read from it. Add a poster below.",
    videoHeavy: (mb) => `This clip is about ${mb} MB, which is heavy for a page to load. Keep it if it earns that, or swap in a shorter one.`,
    videoLinkLabel: "Or a YouTube / Vimeo video",
    videoLinkPlaceholder: "Paste the video's link: https://www.youtube.com/watch?v=… or https://vimeo.com/…",
    videoLinkBad: "That isn't a YouTube or Vimeo link.",
    videoEmbedYoutubeHint: "The video plays from YouTube. Its own still stands in as the poster unless you add one below.",
    videoEmbedVimeoHint: "The video plays from Vimeo. Add a poster still below: Vimeo has none to borrow, and the still is what a Figma export and visitors who ask for less motion see.",
    videoPosterLabel: "Poster still",
    videoPosterDropHint: "Drop a poster image here, or click to choose one",
    linkLabel: "Label",
    linkHref: "Address",
    listHint: "One per line.",
    noneOption: "(none)",
    // settings tab
    settings: {
      blogHeading: "Blog",
      postsDir: "Posts Directory",
      postsDirHint: "Where posts live: the list at /blog and each post at /blog/<post>. One word or hyphenated. No page can use this address.",
      navHeading: "Navigation",
      manageNav: "Manage Navigation",
      manageNavOnHint: "On: the menu is edited in the Navigation tab.",
      manageNavOffHint: "Off: the menu follows the page outline. Top-level pages in their order, with their child pages as sub-links.",
      manageNavMegaNote: "Sites with mega-menus must manually manage the navigation.",
      enable: "Site builder",
      enableOffHint: "Turn on to edit this site's pages, posts, types, navigation and settings.",
      enableOnHint: "Turn off to lock the site builder for this project. Nothing is deleted.",
      scriptsHeading: "Scripts",
      scriptsDesc: "Added to the published site only: never to the design previews or the local site preview.",
      gtm: "Google Tag Manager",
      gtmPlaceholder: "GTM-XXXXXXX, or paste the snippet",
      gtmHint: "Paste the container ID (GTM-XXXXXXX) and both official snippets are added, in the head and after the opening body tag. Or paste your own snippet to add it to the head as is.",
      extraScripts: "Additional scripts",
      scriptName: "Name (for you)",
      scriptPlaceholder: "<script>…</script>",
      placeHead: "Header",
      placeBodyStart: "After opening body tag",
      placeBodyEnd: "Before closing body tag",
      addScript: "+ Add script",
      removeScript: "Remove script",
      logosHeading: "Logos",
      logosDesc: "The logo in the header and footer, on desktop and on mobile. Add one and it's used everywhere; add more to give a spot its own. With none, the wordmark below shows instead.",
      logoHeader: "Header (desktop)",
      logoHeaderMobile: "Header (mobile)",
      logoFooter: "Footer (desktop)",
      logoFooterMobile: "Footer (mobile)",
      logoFromDesign: "From the design",
      logoAdd: "+ Add logo",
      logoRemove: "Remove logo",
      wordmark: "Wordmark",
      wordmarkHint: "Shown as text wherever there's no logo. Defaults to the project name.",
      iconsHeading: "Icons",
      iconsDesc: "The icons browsers and phones show for this site.",
      favicon: "Browser icon",
      faviconHint: "Shown in the tab, bookmarks and search results. An SVG is best (sharp at every size). For a PNG use the classic favicon sizes: 32 × 32 covers browser tabs and high-resolution screens (16 × 16 is the original tab size, and 48 × 48 suits older desktop use). Square, and kept as uploaded, not converted.",
      touch: "Home-screen icon",
      touchHint: "Used when someone adds the site to their phone's home screen. A square PNG, 180 × 180, without transparency (iOS fills it with black). Leave empty to skip.",
      siteNameLabel: "Website Name",
      siteNameHint: "Shown after the page title in browser tabs and search results, and as the site name on shared links. Defaults to the project name.",
      separatorLabel: "Title Separator",
      separatorHint: (sep, name) => `Between the page title and the website name: Island Guide ${sep} ${name || "Website Name"}`,
      schemaHeading: "Structured data",
      schemaDesc: "Who publishes the site, written into every page as structured data (JSON-LD) along with the page itself, its breadcrumbs, and posts as articles. Search engines read it; visitors don't see it.",
      schemaType: "Type",
      schemaOrg: "Organization",
      schemaPerson: "Person",
      schemaLocal: "Local business",
      schemaName: "Name",
      schemaNameHint: "Defaults to the website name.",
      schemaLogo: "Logo",
      schemaLogoHint: "Defaults to the brand logo. Square or wide, on a plain background.",
      schemaSameAs: "Social profiles",
      schemaSameAsHint: "One URL per line: Instagram, LinkedIn, Facebook, YouTube, X. Tells search engines these belong to the same publisher.",
      schemaPhone: "Phone",
      schemaAddress: "Address",
      schemaHours: "Opening hours",
      schemaHoursHint: "For example: Mo-Fr 09:00-17:00, Sa 10:00-14:00",
      fillAllLabel: "SEO for the whole site",
      fillAllHint: "Writes the SEO title, meta description and keyphrase of every page, post and entry from its own content, straight into each one. Open any of them to review what was written; nothing else changes.",
      fillAllButton: "Fill every page",
      fillAllRewrite: "Also rewrite the ones that already have SEO fields",
      fillAllRewriteHint: "Off: only pages, posts and entries missing a title or description are filled. On: every one is written again.",
      fillAllProgress: (done, total) => `Evaluating content, ${done} of ${total}`,
      fillAllDone: (filled, skipped, failed) => [
        filled === 1 ? "1 filled" : `${filled} filled`,
        skipped ? `${skipped} already had SEO fields` : "",
        failed ? (failed === 1 ? "1 failed" : `${failed} failed`) : "",
      ].filter(Boolean).join(", ") + ".",
      fillAllNothing: "Every page, post and entry already has its SEO fields.",
      siteImageLabel: "Site Image",
      siteImageHint: "The share image for pages and posts that don't set their own. 1200 × 630 works for every network.",
      mediaHeading: "Images",
      mediaDesc: "How added images are optimized. Applies to new uploads; existing images are left as they are.",
      quality: "Quality",
      qualityHint: "AVIF quality, 20 to 95. Lower is smaller; 55 is a good default for photos, 70 or more for illustrations and screenshots.",
      maxWidth: "Maximum width",
      maxWidthHint: "Pixels. Larger images are scaled down to this on upload; smaller ones are never scaled up.",
      reset: "Reset to defaults",
      saved: "Saved",
      searchHeading: "Search engines",
      discourage: "Discourage search engines from crawling this site",
      discourageHint: "Asks crawlers to stay out (robots.txt) and marks every page noindex. Use while a site isn’t ready to be found. Not a lock: the site is still reachable by its address.",
      sitemap: "Enable sitemap",
      sitemapHint: "A sitemap-index.xml listing every public page, post and entry, linked from robots.txt.",
      llms: "Enable llms.txt",
      llmsHint: "A plain-text map of the site for AI crawlers, generated from your content. Edit the text to publish your own instead; clear it to go back to the generated version.",
      llmsContent: "llms.txt content",
      llmsReset: "Reset to generated",
      llmsSave: "Save llms.txt",
      redirectsHeading: "Redirects",
      redirectsDesc: "Send an old address to a new one, so links and search results that point at a page you moved or removed still land somewhere.",
      redirectsManage: "Manage redirects…",
      redirectsCount: (n) => n === 0 ? "No redirects yet." : n === 1 ? "1 redirect." : `${n} redirects.`,
      redirects: {
        title: "Redirects",
        intro: "Each redirect sends visitors and search engines from an old address on this site to a new one. They take effect on the next publish; the local preview honours them right away.",
        type: "Type",
        types: { 301: "301 · Permanent", 302: "302 · Temporary", 307: "307 · Temporary, same method", 308: "308 · Permanent, same method" },
        from: "Old address",
        fromPlaceholder: "/old-page",
        to: "Redirect to",
        toPlaceholder: "/new-page or https://…",
        add: "Add redirect",
        remove: "Remove redirect",
        empty: "No redirects yet. Add the first one above.",
        saved: "Saved",
        close: "Done",
        import: "Import…",
        importHint: "Import from Redirection, Yoast or a CSV",
        help: "About redirects and importing",
        imported: (n, dup, skipped) => `${n === 1 ? "1 redirect" : `${n} redirects`} imported${dup ? `, ${dup} already listed` : ""}${skipped ? `, ${skipped} skipped (regex rules or gone codes)` : ""}.`,
        importedNone: "Nothing to import from that file.",
      },
      // Import from WordPress (docs/wordpress-migration-spec.md): the plugin, the fetch,
      // the inventory, the mapping, the import, the report. Steps unlock in that order.
      wp: {
        heading: "Import from WordPress",
        desc: "Bring an existing WordPress site's pages, posts and images into this site. Nothing is written to the WordPress site.",
        notReadyDesc: "Bring an existing WordPress site's structure and copy in as the brief for the new design. The content itself moves across once the site is built.",
        pluginStep: "1. The plugin",
        pluginHint: "Save the plugin folder, then put it on the WordPress site: copy the folder into wp-content/plugins, or zip it and use Plugins → Add New → Upload. Activate it and open Settings → thinkany design Export for the token. It only reads, so it's safe on a live site; deactivate it once you're done.",
        savePlugin: "Save the plugin folder…",
        pluginSaved: (p) => `Saved ${p}.`,
        fetchStep: "2. The content",
        url: "Site address",
        urlPlaceholder: "https://client-site.com",
        token: "Token",
        tokenPlaceholder: "From Settings → thinkany design Export",
        fetch: "Fetch the site",
        fetching: "Fetching…",
        loadFile: "Load an export file…",
        loadFileHint: "For a site exported on the command line: wp thinkany export --out=site.json",
        fetched: (n, m, when) => `${n === 1 ? "1 page" : `${n} pages`}, ${m === 1 ? "1 post" : `${m} posts`}, fetched ${when}.`,
        summary: (c) => `${c.pages} pages${c.classicPages ? ` (${c.classicPages} without blocks)` : ""}, ${c.posts} posts, ${c.images} images${c.imagesMissingAlt ? ` (${c.imagesMissingAlt} without alt text)` : ""}, ${c.forms} forms.`,
        viewInventory: "View the inventory",
        inventoryTitle: "What the WordPress site holds",
        briefStep: "3. The brief",
        briefHint: "Have the inventory summarized as a brief for the new design: real pages, real sections, real copy. Then design as usual and build the site.",
        brief: "Summarize as a brief",
        briefRequest: "/migrate-wordpress inventory",
        briefEcho: "Summarize the WordPress import as a brief",
        briefPane: "Importing WordPress Content",
        reveal: "Show the import files",
        open: "Import from WordPress…",
        modalTitle: "Import from WordPress",
        modalCancel: "Cancel",
        fetchOk: (name, c) => `Fetched ${name || "the site"}: ${c.pages} pages, ${c.posts} posts, ${c.images} images${c.forms ? `, ${c.forms} forms` : ""}.`,
        fetchFail: "The fetch didn't complete.",
        fetchNeeds: (url, token) => !url && !token ? "Enter the site address and the token from Settings → thinkany design Export." : !url ? "Enter the site address (starting with http:// or https://)." : "Enter the token from Settings → thinkany design Export on the WordPress site.",
        inventoryLink: "What the site holds",
        filesLink: "The import files",
        filesHint: "Kept beside the project under .thinkany/wp-import. The mapping is the audit trail of where everything landed.",
        filesReveal: "Show in Finder",
        importOk: "The import finished.",
        importFail: "The import didn't complete.",
        reportLink: "The import report",
        nextTitle: "Next steps",
        nextSteps: [
          "Review the imported pages, posts and entries: all drafts, listed with the rest, nothing published yet.",
          "Review the blocks under Needs design in the Blocks tab: name their fields the way they should read, remove any you won't need.",
          "Design each block: Update design authors it in this site's visual language with its real content in place.",
          "Edit content as you go: every imported page renders through its blocks, so you can see it as you work.",
          "Set the form's recipients and delivery in the Forms tab.",
          "Point the imported menus at real pages in the Navigation tab, and check Settings → Redirects.",
          "Publish when ready: the pages, posts and entries you choose, once their blocks are designed.",
        ],
        goTo: "Go to",
        importStep: "3. The import",
        importHint: "Every old section becomes a block of this site with the same fields, marked Needs design until you design it. Every page, post and entry arrives as a draft; nothing already in the site is replaced. Forms, images, menus and a redirect for every old address come with it. Re-run any time: it rewrites what it wrote and nothing else.",
        run: "Run the import",
        running: "Importing…",
        needSite: "Build the site from the approved design first. The import writes into the site's blocks.",
        done: (r) => `${r.blocks ? `${r.blocks === 1 ? "1 block" : `${r.blocks} blocks`} to design, ` : ""}${r.pages === 1 ? "1 page" : `${r.pages} pages`}, ${r.posts === 1 ? "1 post" : `${r.posts} posts`}, ${r.redirects === 1 ? "1 redirect" : `${r.redirects} redirects`}, ${r.media.downloaded} images${r.media.failed.length ? ` (${r.media.failed.length} failed)` : ""}${r.unmappedBlocks ? `, ${r.unmappedBlocks} block type${r.unmappedBlocks === 1 ? "" : "s"} without a destination` : ""}. All drafts.`,
        nextDesign: "Next: the Blocks tab lists what needs a design.",
        viewReport: "View the report",
        reportTitle: "Import report",
        forget: "Forget this import",
        forgetConfirm: "Forget the fetched content, the mapping and the report? Anything already written into the site stays.",
        close: "Done",
        help: "About importing from WordPress",
      },
      siteHeading: "Site",
      designPinned: (v) => `Built from design ${v}`,
      // Trash: what was deleted, restorable for 30 days.
      trashHeading: "Trash",
      trashDesc: "Pages, posts, entries, forms and images you delete land here for 30 days. Restore puts one back where it was; if its name has since been taken it comes back with a number added.",
      trashEmpty: "Nothing in the trash.",
      trashKinds: { page: "Page", post: "Post", entry: "Entry", form: "Form", image: "Image", file: "File" },
      trashDeleted: (when) => `Deleted ${when}`,
      trashRestore: "Restore",
      trashRestored: (t) => `Restored ${t}.`,
      trashRestoredRenamed: (t, to) => `Restored ${t} as ${to}, its old name was taken.`,
      trashDeleteForever: "Delete forever",
      trashDeleteForeverConfirm: (t) => `Delete ${t} for good? This can't be undone.`,
      trashEmptyAll: "Empty trash",
      trashEmptyConfirm: (n) => `Delete ${n === 1 ? "this item" : `all ${n} items`} for good? This can't be undone.`,
    },
    // media picker
    side: { label: "Layout", left: "Image left", right: "Image right" },
    marks: {
      add: "Add an icon from an SVG file. It joins this design's icon set, drawn inline so the block can color and animate it.",
      adding: "Adding…",
    },
    media: {
      title: "Images",
      lead: "Images in this project. Pick one, or add files from your computer.",
      upload: "Add images…",
      fromPhone: "From your phone…",
      settingsBtn: "Image Settings",
      uploadFiles: "Add files…",
      uploadFilesNote: "Files are kept exactly as uploaded and served at /files/. PDF, Word, Excel, PowerPoint, CSV, text, ZIP, audio and video.",
      emptyFiles: "No files yet. Add some to get started.",
      fileDetailNoPreview: "No preview for this kind of file.",
      folders: {
        heading: "Folders",
        desc: "Folders are the tags: an image sits in every folder it's tagged with. Drag an image onto a folder to file it.",
        all: "All images",
        allVideo: "All video",
        allFiles: "All files",
        untagged: "Untagged",
        add: "New folder",
        addPlaceholder: "Folder (tag) name",
        rename: "Rename folder",
        remove: "Delete folder",
        removeConfirm: (t, n) => n ? `Delete the “${t}” folder? The tag comes off ${n === 1 ? "1 image" : `${n} images`}; the images themselves stay.` : `Delete the “${t}” folder?`,
        dropHint: (t) => `Drop to tag with “${t}”`,
        emptyFolder: "No images in this folder yet. Drag some here, or tag them in their detail view.",
      },
      detail: {
        name: "File name",
        size: "Size",
        path: "Path",
        credit: "Credit",
        creditBy: "Photo by",
        creditNone: "No credit recorded. A photo sourced from Unsplash or Pexels carries its photographer here; for an upload, add one to public/images/credits.json.",
        creditNotFree: "Not free to reuse: license or replace before publishing.",
        tags: "Tags",
        tagsPlaceholder: "Type a tag, or pick one",
        tagsHint: "Tags save as you add or remove them.",
        addTag: (t) => `Add “${t}”`,
        removeTag: "Remove tag",
        noTags: "No tags yet.",
        close: "Done",
      },
      phone: {
        title: "Send photos from your phone",
        lead: "Scan this with the phone's camera. It opens a page on your Wi‑Fi where you can take a photo or pick from the library; each one lands here as you send it.",
        note: "Works while the phone and this Mac share a Wi‑Fi network. The code expires in ten minutes.",
        received: (n) => n === 1 ? "1 photo received" : `${n} photos received`,
        expired: "The code expired. Open it again for a new one.",
        done: "Done",
        noNetwork: "This Mac isn’t on a network a phone could reach.",
      },
      uploadNote: "Added images are optimized for the web automatically (AVIF, up to 2400px wide). SVG, GIF and AVIF files are kept as they are.",
      uploading: "Adding…",
      choose: "Choose",
      change: "Change",
      clear: "Remove",
      empty: "No images yet. Add some to get started.",
      filter: "Filter by name",
      use: "Use this image",
      delete: "Delete",
      deleteConfirm: (n) => `${n} goes to the Trash in Settings, restorable for 30 days. Pages using it show a broken image until then.`,
      rename: "Rename",
      renameHint: "Press Enter to save, Escape to cancel. A name already in use gets a number added.",
      renamed: (n, refs) => refs ? `Renamed to ${n}; ${refs === 1 ? "1 page" : `${refs} files`} updated to match.` : `Renamed to ${n}.`,
      dims: (w, h) => `${w} × ${h}`,
      noImage: "No image",
      altLabel: "Alt Text",
      dropHint: "Drop an image here, or click to upload",
      dropReplace: "Drop or click to replace",
      chooseExisting: "Choose from project images",
      // The video half of the picker: the same dialog, pointed at public/video.
      titleVideo: "Video",
      chooseExistingVideo: "Choose from project video",
      useVideo: "Use this video",
      uploadVideo: "Add video",
      uploadVideoNote: "MP4 plays everywhere. A poster still is taken from the clip when it is added.",
      emptyVideo: "No video in this project yet. Add one to get started.",
      importing: "Adding…",
    },
  },
  a11y: {
    lead: "A WCAG 2.1 AA review of the current design. Run it to see what needs fixing, then Fix, Hold, or Dismiss each item.",
    offNote: "Accessibility mode is off, so it never touches the creative work. Turn it on below to review this design and to build future designs to AA.",
    needDesign: "Open a built design to review it.",
    needBuild: "Available once the design has finished building.",
    run: "Run accessibility review",
    reRun: "Re-run accessibility review",
    globalHeading: "Global Rules",
    modeDesc: "Off by default so it never affects the creative work. On: builds are authored to WCAG 2.1 AA (contrast-safe palette + accessible markup) and this drawer lets you audit any design and fix issues.",
    modeToggle: "Build to WCAG 2.1 AA and enable the accessibility review",
    autoDesc: "On: the review runs on its own after every build, and the rail dot lights when it finds issues. Off: run it manually with the button above.",
    autoToggle: "Automatically review after each build",
    running: "Reviewing…",
    failed: "The review couldn't run. Make sure the preview is open, then try again.",
    clean: "No WCAG AA issues found. Nice.",
    allHandled: "All findings handled. Re-run to check again.",
    fix: "Fix",
    fixed: (n) => `Fixed (${n})`,
    fixedTag: "Fixed",
    dismissed: (n) => `Dismissed (${n})`,
    andMore: (n) => `+ ${n} more element${n === 1 ? "" : "s"}`,
    fixingEcho: (title) => `Fixing: ${title}`,
    showOnPage: "Show on page",
    showOnPageTip: "Highlight the failing elements in the preview",
    exitReview: "Exit review",
    ofCount: (i, n) => `${i} of ${n}`,
    notAtSize: "not visible at this width",
  },

  // ── Key gate (Connect Claude) — big-pane onboarding screen ──────────────────
  keygate: {
    heading: "Connect your Claude API key",
    intro: "The studio runs on the Claude Agent SDK, which authenticates with an API key. Paste yours to begin.",
    placeholder: "sk-ant-…",
    getKeyLink: "Get a key at platform.claude.com →",
    note: "Stored encrypted in your OS keychain,<br>never written into a project.",
    pasteFirst: "Paste your key first.",
    checking: "Checking…",
    save: "Save & connect",
    couldNotSave: "Could not save the key.",
  },

  // ── Developer-only affordances (never shown in a packaged build) ───────────
  dev: {
    rehearsalBadge: "Onboarding walkthrough",
    rehearsalBadgeTip: "You are walking the first-run flow. Your keys are still connected; nothing you do here changes them. Turn it off from the Developer menu.",
  },

  // ── First-run key setup (the stepper before the project chooser) ───────────
  setupGate: {
    heading: "Let’s get you set up",
    // Two facts, numbered so they read as the shape of what follows rather than a
    // paragraph to wade through.
    intro1: "Your Claude API key is the only one the studio needs to run.",
    intro2: "Everything after it is optional and can wait. Each one unlocks something extra.",
    done: "Done setting up!",
    connected: "Connected",
    skipped: "Skipped",
    reopen: "Change",
    skip: "Skip this step",
    claudeTitle: "Claude API key",
    claudeDesc: "This studio is powered by Anthropic\u2019s Claude AI using your own API key. Once you add your key, you\u2019re good to go; everything else on this screen is optional.",
    claudeAlso: "Your Anthropic API key is what lets the studio talk to Claude securely using your account.",
    figmaTitle: "Figma export",
    figmaDesc: "Export your finished design directly into Figma as a fully editable file, not a flat image. Text, colors, and spacing come through as real styles and organized layers, so designers can keep refining in Figma or hand off clean, production-ready files to developers.",
    researchTitle: "Design research & site building",
    researchDesc: "Add a design research feature that studies companies, brands, and products similar to your design brief, then surfaces the most relevant aesthetic directions and proven UX patterns. This research helps shape a clear \u201cdirection deck\u201d so every design stays distinctive and grounded in what works in the real world, while still respecting the originality of your ideas.",
    // The same key unlocks the site builder, so the step says so: skipping it quietly
    // removes the CMS icon, and a designer who later wondered where it went would have
    // been misled by a step called "Design research".
    researchAlso: "This key also unlocks the site builder, which turns an approved design into a publishable website with pages, posts and media.",
    mediaTitle: "Photos & Video",
    mediaDesc: "Add optional free stock image and video libraries so your build can automatically find visuals that match your design description and download them with proper photographer credit.",
    mediaOrder: "If you supply keys for each service provider, the build will search Unsplash first, then Pexels, then Pixabay. For videos, it will search Pexels first, then Pixabay. You can connect any or all of these services; the build will use whichever are connected and still have requests available. If no video libraries are connected, your designs will simply use still images only.",
    // Shown beside each library's name, and readable while its section is folded shut.
    offersImages: "Photos",
    offersBoth: "Photos & Video",
    unsplashOffer: "The best-curated photo library of the three, and the first one a build searches. Photos only: it has no video.",
    pexelsOffer: "Photos and video on one key, 200 requests an hour. The first library a build searches for footage.",
    pixabayOffer: "Photos and video on one key, and the widest library of the three, though less curated. Searched last for both, so it catches what the others miss.",
  },

  // ── Usage gate — the first screen on a new install, before the key ──────────
  usageGate: {
    heading: "How do you plan on using thinkany design?",
    intro: "No pressure, you can always change this later!",
    personalLabel: "Just for me",
    personalDesc: "Design and publish on your own. No company profile to keep.",
    companyLabel: "For my company",
    companyDesc: "Your studio's name & logo will greet clients on designs you create for them.",
  },

  // ── Project gate — first-run pick-a-project screen ──────────────────────────
  projectGate: {
    heading: "Choose a project",
    intro: "Your design work lives in a project folder, separate from the app, so the studio itself stays a pristine, unbranded template.",
    create: "New project…",
    open: "Open existing project…",
    note: "“New project” copies the blank template into an empty folder you pick, then runs it live.",
  },

  // ── Project gate + Switch Project drawer ────────────────────────────────────
  project: {
    creating: "Creating…",
    opening: "Opening…",
    couldNotOpen: "Could not open the project.",
    recentTitle: "Recent projects",
    recentDesc: "Jump straight back into a project you had open.",
    emptyNote: "Create or open a project from the chooser to get started.",
    createSwitch: "Create or switch project",
    createNew: "Create new",
    switchExisting: "Switch project…",
    needKeyToCreate: "Connect a Claude API key in Keys & Licenses to create a project.",
  },

  // ── About footer (version + site link) ──────────────────────────────────────
  about: {
    versionPrefix: "Version ",
    siteLink: "thinkany.co",
  },

  // ── Walkthrough tour: ordered tooltips that introduce the studio ────────────
  // The ORDER and targets live in shell.js (TOUR_STEPS); each step points at an
  // entry in `steps` by key, so only the wording lives here. The tour starts on
  // its own the first time a Claude key is connected, and can be replayed from
  // the About drawer at any time.
  tour: {
    stepOf: (n, total) => `${n} of ${total}`,
    next: "Next",
    back: "Back",
    done: "Got it",
    skip: "Skip the tour",
    closeAria: "Close the tour",
    // About drawer: the replay row
    // ── The design-editing tips (once, when the first design finishes; replayable from Help) ──
    design: {
      listBtn: "Design editing",
      hideListBtn: "Hide design editing steps",
      steps: {
        tabs: {
          title: "Your design, in two tabs",
          body: "Home is the finished design. Style guide is what it was built from: the palette, the type scale and the components, so you can see every choice in one place. The + opens another tab on any page.",
        },
        views: {
          title: "Desktop, tablet, phone",
          body: "The toggle at the top of the preview switches device frames. It is one design reflowing, not three copies, so a change you make shows in every frame.",
        },
        chat: {
          title: "Edit by asking",
          body: "Describe what you want in plain words: a warmer palette, a taller hero, a different photo, a section moved up. Each request edits this design in place, and small asks come back quickly.",
        },
        feedback: {
          title: "Point and comment",
          body: "Switch this on, then hover an element in the preview and click it to leave a note. Claude receives the exact element you pointed at, so the fix lands where you meant.",
        },
        credits: {
          title: "Images that need a license",
          body: "When a design uses photos that are not free to reuse, this badge appears in the preview. Click it to list them and outline each one on the page. Before the site goes live, license them or ask for a replacement: a different photo, a free one, or your own upload.",
        },
        reroll: {
          title: "Try another direction",
          body: "A fresh design from the same brief, steered to a different direction, as a new variation beside this one. The original stays as it is; keep whichever you prefer.",
        },
        artdirector: {
          title: "Art Director",
          body: "A second pair of eyes on the finished page: hierarchy, rhythm, type and color, with specific suggestions you can apply in one click or hold for later. It dims while a review runs.",
        },
        a11y: {
          title: "Accessibility review",
          body: "Checks the finished page against WCAG AA and lists what it finds, grouped by rule, each with a Fix. Switch AA mode on in the Claude settings to have it run after every build.",
        },
        figma: {
          title: "Send it to Figma",
          body: "When the design is where you want it, export it: the style guide as variables, every section as a component, and the pages composed from them.",
        },
        cms: {
          title: "Build the site",
          body: "Approve the design and build it into a site: every section becomes a block, the copy and images move into content you edit in the CMS, and the site publishes from here.",
        },
        help: {
          title: "These tips, whenever you like",
          body: "Replay them from the help drawer, under Design editing, alongside the studio tour and the CMS walkthrough.",
        },
      },
    },
    // ── The CMS walkthrough (the site builder's Pages tab, then the home page's sections) ──
    cms: {
      info: "Walk through the CMS",
      listBtn: "CMS",
      hideListBtn: "Hide CMS steps",
      expandTab: (tab) => `Show the ${tab} steps`,
      steps: {
        tabs: {
          title: "The site builder",
          body: "Everything the site is made of, one tab each: Pages, Posts, Types, Forms, Media, Blocks, Navigation and Settings. Edits save to the project and show in the Site tab right away. We’ll walk through Pages.",
        },
        help: {
          title: "Help for this tab",
          body: "The life preserver opens help for whichever tab is open: what it holds, how to add and change things, and tips.",
        },
        preview: {
          title: "Preview in browser",
          body: "Opens the page you’re editing in your browser, so you can check it at full size while you work.",
        },
        pageList: {
          title: "Your pages",
          body: "Search and Create at the top, then every page of the site: home first, with child pages indented under their parent. Click one to edit it on the right. Drag a page onto another to nest it, or between pages to move it.",
        },
        pageSearch: {
          title: "Search pages",
          body: "Type part of a page’s name and the matches appear on the right as pills. Click one to open it. Clear the search and whatever you were editing comes back.",
        },
        addPage: {
          title: "Add a page",
          body: "Type a title and press Create. The page’s permalink is made from the title, and you can adjust it in Page settings.",
        },
        pageHead: {
          title: "The page you’re editing",
          body: "The home page is open now. Everything below is its content: settings, the sections it’s built from, and its search settings.",
        },
        pageSettings: {
          title: "Page settings",
          body: "The title, the permalink (made from the title until you edit it by hand), and for any page but home, its parent. Home always lives at the site’s root.",
        },
        blocks: {
          title: "Blocks: the page’s sections",
          body: "Each section of your approved design became a block, and this list is the home page top to bottom, in order. Reorder, edit or remove any of them here.",
        },
        blockRow: {
          title: "One section",
          body: "Each row is a section. The arrows move it up or down, Edit content opens its fields with a live preview of the block beside them, and the bin removes it. You can drag rows to reorder too.",
        },
        addBlock: {
          title: "Add a block",
          body: "Pick any block the site has, from the design or built in, and it’s added to the bottom of the page with its fields open.",
        },
        designBlock: {
          title: "Design a new block",
          body: "Need a section the design doesn’t have? Describe it, add references if you like, and the assistant designs it in the site’s own language, adds it to the library and places it on this page.",
        },
        seo: {
          title: "SEO",
          body: "The search settings for this page: title, description, share image, keyphrase, whether search engines may list it, and structured data.",
        },
        actions: {
          title: "Save your changes",
          body: "Save writes the page and the Site tab updates. Cancel discards what you changed. Pages other than home can be drafts, previewed here but left out of the published site until you publish them.",
        },
        postsTab: {
          title: "Posts",
          body: "The blog. Posts live under the posts directory with a list page of their own, and each one is written here rather than composed from blocks.",
        },
        postList: {
          title: "Your posts",
          body: "Search, Create and Tags at the top, then every post with its date or a Draft tag. Click one to edit it. A new post starts as a draft, so you can work on it across sessions before it goes live.",
        },
        postSearch: {
          title: "Search posts",
          body: "Type part of a name or a tag. Posts matching by name come first, then posts carrying a matching tag, as pills on the right. Click one to open it; clear the search to get back to what you were editing.",
        },
        addPost: {
          title: "Add a post",
          body: "Type a title and press Create. The permalink is made from the title and follows it until you edit it by hand.",
        },
        postTags: {
          title: "Tags",
          body: "Expand to see every tag with the number of posts carrying it. Click a tag to list its posts on the right, then click a post to edit it. Tags are set on each post under Post settings.",
        },
        postSettings: {
          title: "Post settings",
          body: "Title, permalink, publish date, a summary for the blog list and search results, the cover image, and tags.",
        },
        postContent: {
          title: "Content",
          body: "Write the post here with the formatting toolbar. Images come from the project’s media library, and the file is saved as markdown.",
        },
        postSeo: {
          title: "SEO",
          body: "Search settings for the post: title, description (the summary is used when this is empty), share image, keyphrase, listing, and structured data.",
        },
        postActions: {
          title: "Draft and publish",
          body: "Save draft keeps working on it in private. Publish makes it part of the next site publish, and you can unpublish it again later. Delete moves it to the Trash under Settings.",
        },
        typesTab: {
          title: "Types",
          body: "Your own kinds of content, like products, team members or landing pages. A type has fields, an address, and a content template built from your blocks, and each entry gets a page of its own.",
        },
        typeList: {
          title: "Types and entries",
          body: "Each type lists its entries beneath it. Click a type to edit what it is made of, or an entry to edit its content.",
        },
        addEntry: {
          title: "Add an entry",
          body: "Type a title under a type to add an entry. Its form has one control per field, and it renders through the type’s template unless you give it blocks of its own.",
        },
        addType: {
          title: "Add a content type",
          body: "Name it in the plural, like Products. Its address is made from the name, and you add its fields next.",
        },
        typeSettings: {
          title: "Type settings",
          body: "The plural and singular names, the path entries live under, and whether an index page lists every entry at that address.",
        },
        typeFields: {
          title: "Fields",
          body: "Every entry gets a title and an address; add the rest here: text, long text, images, options, references to other entries, and more. Mark the required ones and drag the grip to reorder.",
        },
        typeTemplate: {
          title: "Content template",
          body: "The blocks that render each entry. In any text, {{field}} fills in that field and {{title}} the entry’s title, so one template serves every entry.",
        },
        typeActions: {
          title: "Save the type",
          body: "Save type writes the definition. Changing fields keeps existing entries and their content. Delete type stops its entries being published but leaves them on disk.",
        },
        formsTab: {
          title: "Forms",
          body: "Forms visitors fill in: their fields, the button, what happens after, and who receives each submission. A form reaches a page through the Form block.",
        },
        formList: {
          title: "Your forms",
          body: "Every form, with its field count and the pages it’s on. Click one to edit it. A form that isn’t on a page yet is waiting for a Form block to pick it.",
        },
        addForm: {
          title: "Add a form",
          body: "Name it, like Contact, and press Create. It starts empty; you add the fields next.",
        },
        formFields: {
          title: "Fields",
          body: "The fields in the order they appear on the page: text, email, phone, long text, choices and more. Each has a label, whether it’s required, a placeholder and help text. Add one from the list at the bottom.",
        },
        formAfter: {
          title: "After submitting",
          body: "What the visitor sees once they’ve sent it: a thank-you message in place, or a page of this site, like a thank-you page you made in Pages.",
        },
        formDelivery: {
          title: "Who receives it",
          body: "The addresses each submission goes to, the reply-to, and whether the visitor’s own email is used as the reply-to. Turn on reCAPTCHA here to keep bots out on top of the built-in honeypot.",
        },
        formActions: {
          title: "Save the form",
          body: "Save form writes it, and every page that uses it picks up the change. Delete form removes it; any Form block that used it shows no form until you pick another.",
        },
        siteDelivery: {
          title: "Delivery, once per site",
          body: "How submissions actually get sent: a transactional mail service you connect once for this site. Pick the service, paste its key and set the from address, then send a test. The key stays in the app and reaches the site’s hosting at publish; it’s never written into the project.",
        },
        mediaTab: {
          title: "Media",
          body: "Every image in the project, the same library the image fields pick from, plus the files the site offers for download.",
        },
        mediaKinds: {
          title: "Images and Files",
          body: "Two libraries. Images are optimized for the web as they’re added. Files, like PDFs, spreadsheets, decks, audio and video, are kept exactly as uploaded and served at /files/, ready to link from any menu or link field.",
        },
        mediaFolders: {
          title: "Folders",
          body: "Folders are tags, so an image sits in every folder it’s tagged with. Drag an image onto a folder to file it, and hover a folder to rename or delete it; the images themselves stay.",
        },
        mediaSettings: {
          title: "Image settings",
          body: "The gear opens the image optimization sliders right here: quality and the largest width for new uploads. They’re the same settings as Settings, Images, so a change in either place applies to both.",
        },
        addFolder: {
          title: "New folder",
          body: "Type a name and press New folder. Each library has its own folders; they never cross.",
        },
        mediaBar: {
          title: "Filter and add",
          body: "Filter the library by name, add images or files from your computer, or scan a code to send photos straight from your phone over Wi‑Fi.",
        },
        mediaGrid: {
          title: "The library",
          body: "Click an image to open it: its name, size, path, alt text and tags. Hover one to rename or delete it. Renaming updates every page that uses it; deleting sends it to the Trash under Settings, restorable for 30 days.",
        },
        blocksTab: {
          title: "Blocks",
          body: "The block library: everything a page can be composed from. The blocks promoted from your design, plus the built-in ones every site has, like the Form block.",
        },
        blockLibrary: {
          title: "Every block the site can use",
          body: "One card per block, with its design name, a description, and the pages it’s on. A block that’s on no page yet is still here, ready to add from any page’s Add a block list.",
        },
        blockCard: {
          title: "Name a block",
          body: "Give a block a name that’s easier to recognise when composing pages. Only the label changes; the block itself and every page using it stay as they are. Names save as you type.",
        },
        navTab: {
          title: "Navigation",
          body: "The links in the site’s header and footer, and the legal line at the bottom of every page. Everything here saves a moment after you change it.",
        },
        navHeader: {
          title: "Primary navigation",
          body: "The header menu. Each link has text and a URL; open the URL field to pick any page, home-page section, post or entry in the project. Add a sub-link for a dropdown, drag rows to reorder, and where the design has a mega menu, add panels under a link.",
        },
        navFooter: {
          title: "Footer",
          body: "The footer’s own links, independent of the header. It starts as a copy of the design’s footer links. Give a link sub-links and it becomes a column, with its text as the heading.",
        },
        navLegal: {
          title: "Legal",
          body: "The copyright line, where {year} and {siteName} fill in automatically, and links like Privacy and Terms shown beside it.",
        },
        settingsTab: {
          title: "Settings",
          body: "Everything about the site as a whole, one section each: images, search engines, logos, navigation, the blog, scripts, icons, redirects, the site itself, the Trash, and the switch that turns the site builder on. Each section folds; the studio remembers which you keep open.",
        },
        settingsImages: {
          title: "Images",
          body: "How added images are optimized: the quality and the largest width. Applies to new uploads; images already in the library are left as they are.",
        },
        settingsSearch: {
          title: "Search engines",
          body: "The site name, title separator and default share image every page falls back to, the publisher’s structured data, and the switches for robots.txt, the sitemap and llms.txt. Discourage crawling while a site isn’t ready to be found.",
        },
        settingsLogos: {
          title: "Logos",
          body: "The logo in the header and footer, on desktop and on mobile. Add one and it’s used everywhere; add more to give a spot its own. With none, the wordmark shows instead.",
        },
        settingsNav: {
          title: "Navigation",
          body: "On, the menu is edited by hand in the Navigation tab. Off, it follows the page outline: top-level pages in order, with their child pages as sub-links. A site with a mega menu stays on.",
        },
        settingsBlog: {
          title: "Blog",
          body: "The directory posts live under, which sets their addresses and the blog’s list page. It saves a moment after you stop typing.",
        },
        settingsScripts: {
          title: "Scripts",
          body: "Google Tag Manager and any other scripts, each with a placement in the page. They go to the published site only, never into the design previews or the local preview.",
        },
        settingsIcons: {
          title: "Icons",
          body: "The favicon browsers show and the icon phones use when the site is added to a home screen. Uploads are kept exactly as they are.",
        },
        settingsRedirects: {
          title: "Redirects",
          body: "Send an old address to a new one, so links that are out there keep working after a page moves or is renamed. Adding or removing one saves straight away.",
        },
        settingsSite: {
          title: "Site",
          body: "Which design this site is built from, and where the site’s preview runs. The design is pinned so the site keeps its look while you explore new directions.",
        },
        settingsTrash: {
          title: "Trash",
          body: "Pages, posts, entries, forms and images you delete land here for 30 days. Restore puts one back where it was; Delete forever removes it now.",
        },
        settingsEnable: {
          title: "The site builder switch",
          body: "Turns the CMS on for this project. Off, only this Settings tab is reachable and the Site tab stops previewing; on, every tab opens up. Your content is kept either way.",
        },
      },
    },
    replayTitle: "Take the tour",
    replayDesc: "A short walkthrough of the studio, one tip at a time. Replay it whenever you like.",
    replayBtn: "Start the tour",
    showSteps: "Show tour steps",
    hideSteps: "Hide tour steps",
    steps: {
      claude: {
        title: "You’re connected",
        body: "This is Claude Settings. Open it to choose the model, set build fidelity, and decide how the assistant works with you. Everything in the studio runs on the key you just added.",
      },
      licenses: {
        title: "Keys & Licenses",
        body: "Your Claude key and the studio’s licenses live here, in one place. Let’s open it and look at what each one covers.",
        next: "Open", // the button opens the drawer, so it says so
      },
      claudeKey: {
        title: "Your Claude API key",
        body: "The studio runs on it. Every design, edit and review is a conversation with Claude, billed to your own Anthropic account. It’s stored encrypted in your keychain and never written into a project.",
      },
      figmaLicense: {
        title: "Figma Export license",
        body: "This license unlocks exporting a finished design to Figma: real color variables, the type and spacing scales, and every section rebuilt as a reusable component.",
      },
      designLicense: {
        title: "Design, Research, Art Director & Site builder",
        body: "This license unlocks the studio’s own intelligence: design directions, competitor research, the Art Director review, and the site builder with pages, posts, media and publishing. Licenses are validated with thinkany and kept in your keychain too.",
      },
      unsplashKey: {
        title: "Photo libraries, optional",
        body: "Add your own Unsplash or Pexels key and a build searches the library for photos that match the brief, downloads them, and records the photographer credit. Both are free. Skip them and images are found the plain way.",
      },
      closeDrawer: {
        title: "Closing a drawer",
        body: "This X closes any drawer. A click anywhere outside the drawer, or the Escape key, closes it too. The rail stays live while a drawer is open, so you can switch straight to another.",
      },
      figma: {
        title: "Figma Export",
        body: "When a design is finished, send it to Figma from here: the styleguide as real variables, every section as a reusable component, and the pages composed from them. It needs the Figma Export license and a completed build.",
      },
      figmaHelp: {
        title: "More to read",
        body: "Wherever you see this life preserver, there is more to read. Click it to see exactly what a Figma export includes.",
        next: "Show help",
      },
      helpPanels: {
        title: "Help panels",
        body: "Panels like this one explain a feature in more depth: what it does, what to expect, and tips. Close one with the X, a click outside, or Escape. Look for the life preserver across the studio.",
      },
      company: {
        title: "Company Profile",
        body: "Your agency’s identity: the name, fonts and logo used on the login gate and the admin chrome. Set it once and every new project starts out branded as yours.",
        next: "Open",
      },
      companyDrawer: {
        title: "Your default profile",
        body: "Create or update the profile here. It’s applied automatically to every new project, so client setup skips those questions. With a project open, you can also save that project’s identity as the default.",
      },
      voice: {
        title: "Copy Voice",
        body: "How the assistant writes. Set the tone and the rules it follows whenever it drafts copy for a design. Nothing is set by default.",
        next: "Open",
      },
      voiceProject: {
        title: "This project",
        body: "A tone for this design, picked from an example or typed in your own words, plus rules that apply here only, like no exclamation points or sentence-case headings. Any global rules in effect are listed underneath.",
      },
      voiceGlobal: {
        title: "Global rules",
        body: "Rules that apply to every project. Add the ones you always want followed, and tick the box to ignore them on a project that needs a voice of its own.",
      },
      voiceSave: {
        title: "Save",
        body: "Saves both the project and the global settings together. Changes take effect from your next message to the assistant.",
      },
      publish: {
        title: "Publish",
        body: "Send a finished design to a private, password-protected link you can share with a client. Let’s open it and look at how publishing works.",
        next: "Open",
      },
      publishDrawer: {
        title: "How publishing works",
        body: "A design has to be built before it can be published. Once one is, connect your Vercel account here and publish: the first publish creates the private link and a preview password to share with your client, and its sign-in screen carries your company name and logo. Later publishes update the same link, and you can move it to a subdomain of a domain you own.",
      },
      projectsIntro: {
        title: "Switch Projects",
        body: "Every design lives in its own project folder, separate from the app. This is where you start a new one or jump between recent ones. Let’s open it.",
        next: "Open",
      },
      help: {
        title: "Help, whenever you need it",
        body: "Everything you have just seen lives behind this icon: replay this walkthrough, read how each part of the studio works, and find the version and your licenses. Come back to it any time.",
      },
      newProjectIntro: {
        title: "Your first project",
        body: "Everything you design lives in a project folder, separate from the app, so the studio itself stays a clean, unbranded template. Here’s how a new one begins.",
      },
      newProject: {
        title: "New project",
        body: "Copies the blank template into an empty folder you pick, then runs it live, so you watch the design take shape in the preview as you work.",
      },
      openProject: {
        title: "Open an existing project",
        body: "Have a project folder from before, or from another machine? Open it here. Recent projects are also one click away under Switch Projects, at the top of the rail.",
      },
    },
  },

  // ── Shared labels reused across drawers ─────────────────────────────────────
  common: {
    copy: "Copy",
    copied: "Copied ✓",
    copyFailed: "Copy failed",
    active: "Active",
    notSet: "Not set",
    saving: "Saving…",
    couldNotSave: "Could not save.",
  },

  // ── Company Profile drawer ──────────────────────────────────────────────────
  company: {
    defaultTitle: "Default company profile",
    activeWith: (name) => `Active · ${name}`,
    defaultNote: "Applied automatically to every new project. Set your agency identity once and skip it on every future setup.",
    saveDefault: "Save this project’s identity as my default",
    createProfile: "Create profile",
    updateProfile: "Update company profile",
    saveProfile: "Save profile",
    nameRequired: "Add a company name first.",
    currentLogo: (name) => `Current logo: ${name}. Upload a new one to replace it.`,
    clearDefault: "Clear default",
    exportNeedsProject: "Open a project to export its company profile to a file.",
    exportIntro: "Export this project’s agency identity as a portable file (to move between machines or share).",
    exportBtn: "⬇ Export company profile to a file",
    noProfileYet: "No company-profile.json yet. Run /export-company in the chat to create one first.",
  },

  // ── Figma Export drawer (status; the key input lives in Licenses) ────────────
  figma: {
    licenseLabel: "Figma export license",
    exportDesign: "Export Design",
    exportScopeLabel: "What to export",
    exportScopeLabelUnlicensed: "What gets exported", // the header when there's no license yet (help still opens)
    scopeStyleguide: "Styleguide + Blocks",
    scopePages: "Pages",
    exportPickScope: "Tick at least one thing to export.",
    // The chat command the drawer sends — names the ticked scope so the agent doesn't
    // re-ask it (P15). Kept in sync with export-figma.md's "already names a scope" cases.
    exportCommandFor: (styleguide, pages) =>
      styleguide && pages ? "export to Figma — both the Styleguide + Blocks and the Pages"
      : styleguide ? "export the Styleguide + Blocks to Figma"
      : pages ? "export just the Pages to Figma (recompose the pages from the blocks)"
      : "export to Figma",
    exportDisabledHint: "Add your Figma export license to enable",
    exportAfterBuild: "Export becomes available after build completes.",
    note: "Unlocks Figma export. Validated with the derive service; stored encrypted in your OS keychain.",
    manageInLicenses: "Add or remove this license in the Licenses drawer.",
    exportHelpTitle: "What gets exported to Figma",
    exportHelpHtml: `
    <div class="iref-help-head">
      <div class="iref-help-title">What gets exported to Figma</div>
      <button type="button" class="iref-help-x" aria-label="Close">✕</button>
    </div>
    <p>Pick what to send. You can choose either, or both. “Both” is the full, cohesive result in one Figma file.</p>

    <h4>Styleguide + Blocks</h4>
    <p>Your design system as editable Figma objects: real color <b>variables</b>, the spacing and radius scales, type specimens, and every section of the design rebuilt as a reusable <b>Block</b> (a component). This is the building blocks only, no full page layouts are assembled.</p>
    <p>Note: If you make changes to the variables (colors, fonts etc.) or structural changes to page sections after an initial export, you’ll need to re-run the export for Styleguide + Blocks before running your Page(s) export.</p>

    <h4>Pages</h4>
    <p>Your complete page layouts (app screens, for an app project), composed by stacking the Blocks above into full pages. It reuses the Styleguide + Blocks, so it assumes they were exported already.</p>

    <div class="iref-help-note">Styleguide + Blocks is recommended for a completed design’s first export. Upon confirming the export for accuracy, Pages can be exported separately and cheaply anytime a page (or pages) layout changes. The initial export will take some time and depends on the complexity of the design.</div>
  `,
  },

  // ── Keys & Licenses drawer (your keys + app licenses, one place) ────────────
  licenses: {
    keysGroup: "Your keys",
    licensesGroup: "Licenses",
    claudeLabel: "Claude API key",
    claudeDesc: "Your Anthropic key. The studio runs on it.",
    claudeStatus: "Key",
    pasteClaudeKey: "sk-ant-…",
    saveKey: "Save key",
    removeKey: "Remove key",
    designLabel: "Design, Research, Art Director & Site builder",
    designDesc: "Unlocks design directions, competitor research, the Art Director review, and the site builder (pages, posts, media, publishing).",
    figmaLabel: "Figma Export",
    figmaDesc: "Unlocks exporting your designs to Figma.",
    unsplashLabel: "Unsplash (optional)",
    unsplashDesc: "Your own Unsplash access key lets a build search the library for photos that fit the brief: free to use, credited to the photographer. Without it, images are found the plain way.",
    unsplashStepsHtml: "<b>To get a key:</b><br>1. Create an Unsplash account and confirm it from the email Unsplash sends.<br>2. Open <a href=\"https://unsplash.com/oauth/applications\" target=\"_blank\" rel=\"noopener\">unsplash.com/oauth/applications</a>, choose <i>New Application</i> and agree to the terms.<br>" +
      "3. Give it a name and a description (thinkany design, for example).<br>4. Copy its <b>Access Key</b> and paste it below.<br><br>" +
      "A new app allows 50 requests an hour; a build uses about two per photo, and the studio paces its calls and stops short of the limit.",
    imageUsageLabel: "This hour",
    imageUsage: (u) => u && u.limit ? `${u.requests} of ${u.limit} requests${typeof u.remaining === "number" ? `, ${u.remaining} left` : ""}, resets in ${u.resetsInMin} min` : "No requests yet",
    // Pixabay's allowance is a rolling MINUTE, not an hour, so it gets its own row.
    imageUsageMinuteLabel: "Right now",
    imageUsageMinute: (u) => u && u.limit ? `${u.requests} of ${u.limit} requests${typeof u.remaining === "number" ? `, ${u.remaining} left` : ""} in this minute` : "No requests yet",
    imageUsageMonthLabel: "This month",
    imageUsageMonth: (u) => u && u.limit ? `${u.limit - (typeof u.remaining === "number" ? u.remaining : u.limit)} of ${u.limit.toLocaleString()} requests used${typeof u.remaining === "number" ? `, ${u.remaining.toLocaleString()} left` : ""}` : "No requests yet",
    pexelsLabel: "Pexels (optional)",
    pexelsDesc: "A second photo library for builds, free to use with a link back to the photographer. With Unsplash also connected, a build uses whichever still has room this hour.",
    pexelsStepsHtml: "<b>To get a key:</b><br>1. Create a Pexels account and confirm it from the email Pexels sends.<br>" +
      "2. Visit <a href=\"https://www.pexels.com/api/key/\" target=\"_blank\" rel=\"noopener\">pexels.com/api/key</a> and copy your <b>API key</b>.<br>3. Paste it below.<br><br>" +
      "Pexels allows 200 requests an hour and 20,000 a month; a build uses about one per photo, and the studio paces its calls and stops short of the limit.",
    pixabayLabel: "Pixabay (optional)",
    pixabayDesc: "A third library, and the widest. One key covers photos AND video, so this is the simplest way to let a build use footage as well as stills.",
    pixabayStepsHtml: "<b>To get a key:</b><br>1. Create a Pixabay account and confirm it from the email Pixabay sends.<br>" +
      "2. Visit <a href=\"https://pixabay.com/api/docs/\" target=\"_blank\" rel=\"noopener\">pixabay.com/api/docs</a>; your <b>API key</b> is shown at the top once you are signed in.<br>3. Paste it below.<br><br>" +
      "Pixabay allows 100 requests a minute; the studio paces its calls and stops short of the limit.",
    videoGroup: "Video",
    videoNote: "Pexels and Pixabay also carry video, so a build can place a moving hero background or a clip in a content row. Unsplash is photos only. With no video library connected, designs stay stills only.",
    status: "License",
    keyLabel: "Key",
    remove: "Remove license",
    pasteKey: "Paste your license key",
    save: "Save license",
    validating: "Validating…",
    couldNotSave: "Could not save the license.",
    showKey: "Show",
    hideKey: "Hide",
  },

  // ── Publish drawer (Vercel connect + one-click publish) ─────────────────────
  publish: {
    vercelLabel: "Vercel",
    disconnect: "Disconnect Vercel",
    connectedWith: (user) => `Connected · ${user}`,
    connected: "Connected",
    notConnected: "Not connected",
    // The collapsed Profile section: how the app is used + the company information.
    profile: {
      title: "Profile",
      usageLabel: "Using thinkany design",
      personal: "Just for me",
      company: "For my company",
      personalNote: "The Company Profile stays out of the way. Creating or uploading one below brings it back.",
      companyNote: "The company profile signs shared previews and pre-fills new projects.",
    },
    companyNudge: {
      title: "Your Company Information",
      desc: "The private link you share opens on a sign-in screen branded with YOUR company name and logo, that’s what your client sees first. It isn’t set for this project yet. Add it so the preview looks like yours (you can still publish without it).",
      upload: "Upload a profile",
      setup: "Create profile",
    },
    connectIntro: "Publish your design straight to a private, password-gated URL you can send a client. Connect your Vercel account to start.",
    connect: "Connect with Vercel",
    waitingAuth: "Waiting for authorization…",
    browserOpened: "A Vercel page opened in your browser. Approve it there, then come back.",
    couldNotConnect: "Could not connect.",
    orToken: "or paste an access token",
    pasteToken: "Paste your Vercel token",
    saveToken: "Save token",
    connecting: "Connecting…",
    createToken: "Create a token on Vercel ↗",
    tokenNote: "Stored encrypted in your OS keychain. Only used to deploy your design.",
    deployTo: "Deploy to",
    personalAccount: "Personal account",
    needsProject: "Open a project to publish it.",
    passwordLabel: "Password:",
    publishLead: "Publish this design to a private URL. The first publish sets a preview password you share with your client.",
    finishFirst: "Finish a design first, then you can publish it here.",
    domainLabel: "Preview domain",
    domainDefault: "Vercel subdomain (default)",
    subdomain: "subdomain",
    ownedDomainNote: "A subdomain of a domain you own on Vercel. Applied on the next publish.",
    noDomainsNote: "No domains on your Vercel account yet. Add one in Vercel and it’ll appear here.",
    domainsError: "Couldn’t load your Vercel domains, check your connection.",
    manageTitle: "Manage Deployment",
    publishChanges: "Publish changes",
    publishDesign: "Publish this design",
    resetPassword: "Reset preview password",
    resetPasswordTitle: "Generate a new client password and republish",
    lastPublishedPrefix: "Last published ",
    helpButton: "Help with publishing",
    publishing: "Publishing…",
    publishFailed: "Publish failed.",
    previewPasswordLabel: "Preview password (share with your client)",
    // ── The public website (its own Vercel project, no password, indexable) ──
    site: {
      title: "Live site",
      lead: "Publish the website built from your approved design to a public address. No password, search engines welcome.",
      notReady: {
        "no-site": "This project doesn’t have a site yet.",
        "not-promoted": "Nothing has been built yet. Turn the finished design into a site first; then you can publish it here.",
        "no-home": "The site has no home page yet.",
      },
      domainLabel: "Site domain",
      subdomainOptional: "subdomain (optional)",
      ownedDomainNote: "A domain you own on Vercel, or a subdomain of one. Leave the subdomain empty to use the domain itself. Applied on the next publish.",
      publishSite: "Publish the site",
      publishSiteChanges: "Publish site changes",
      cmsOff: "The site builder is off for this project, so the site can't be published. Turn it on under CMS, Settings first.",
      liveLabel: "Live at",
      lastPublishedPrefix: "Site published ",
    },
    // The two-tab "Help with publishing" overlay (formerly PUBHELP).
    help: {
      start: {
        intro: "Publishing puts your design online behind a password so you can share it with a client. It uses Vercel, a free hosting service. Connecting takes about a minute, once.",
        steps: [
          { h: "Have a free Vercel account", d: "If you do not have one yet, sign up at vercel.com. It is free for design previews, no credit card needed.", link: { label: "Open vercel.com/signup", url: "https://vercel.com/signup" } },
          { h: "Click Connect with Vercel", d: "In the Publish panel, click Connect with Vercel. Your browser opens a Vercel page, there is no token to create, copy, or paste." },
          { h: "Approve, and you are in", d: "Sign into your Vercel account if asked, approve the request, then return to the app. The panel shows you are connected.", note: "Nothing to configure. If you would rather use a token instead, there is an \"or paste an access token\" option under the button." },
          { h: "You are ready to publish", d: "Switch to the How to publish tab for the rest." },
        ],
      },
      how: {
        intro: "Once Vercel is connected, publishing a design is a few clicks.",
        steps: [
          { h: "Open a finished design", d: "Open the project you want to share. The Publish button stays greyed out until a design is ready to show." },
          { h: "Choose where it goes (optional)", d: "Under Deploy to, pick your personal account or a team. Under Preview domain, keep the default vercel.app address or put it on a subdomain of a domain you own.", note: "The domain choice is remembered per project; Deploy to is shared across projects." },
          { h: "Click Publish this design", d: "The app creates the site, uploads your design, and Vercel builds it. This usually takes a minute or two, and you will see the progress." },
          { h: "Copy your link and password", d: "You get a live link and a preview password, both shown in the panel with copy buttons.", note: "The password stays visible in the panel. Use Reset preview password to rotate it." },
          { h: "Share with your client", d: "Send them the link and the password. The site stays locked until they enter it, so the link is safe to share." },
          { h: "Update anytime", d: "Made changes? Click Publish changes to refresh the same link." },
        ],
      },
    },
  },

  // ── Copy Voice drawer (per-project tone + rules) ────────────────────────────
  voice: {
    intro: "Shape the words the AI writes into this design’s copy. Nothing is set by default.",
    thisProject: "This project",
    tone: "Tone",
    tonePlaceholder: "e.g. soft, professional, not pushy",
    toneExamples: ["Soft, professional, not pushy", "Confident and direct", "Warm and conversational", "Understated, editorial", "Playful and energetic"],
    ruleExamples: ["No em dashes", "Short, clear sentences", "Active voice", "No exclamation points", "Avoid jargon", "Sentence case headings"],
    projectRulesLabel: "Rules for this project",
    projectRulePlaceholder: "Add a project rule…",
    projectRulesEmpty: "No project-specific rules.",
    globalRules: "Global rules",
    globalRulesSub: "Apply to every project.",
    globalsApplied: "Your global rules (on by default; click one to skip it for this project):",
    appliedFromGlobal: "Applied from your global rules:",
    ignoreGlobal: "Ignore global rules for this project",
    globalRulePlaceholder: "Add a global rule…",
    globalRulesEmpty: "No global rules yet.",
    save: "Save",
    saved: "Saved, applies to your next message.",
  },

  // ── Editable rule-list widget defaults (shared by Copy Voice) ───────────────
  ruleList: {
    emptyDefault: "None yet.",
    addPlaceholder: "Add a rule…",
    add: "Add",
  },

  // ── Tri-state Inherit/On/Off <select> ───────────────────────────────────────
  tri: {
    inherit: "Inherit default",
    on: "On",
    off: "Off",
  },

  // ── Relative timestamps (session dates) ─────────────────────────────────────
  time: {
    todayPrefix: "Today ",
    yesterdayPrefix: "Yesterday ",
  },

  // ── Claude Settings drawer (key, model, images, research, sessions) ─────────
  claude: {
    keyLabel: "Claude API key",
    connected: "Connected",
    notConnected: "Not connected",
    disconnect: "Disconnect",
    pasteKeyNote: "Add your key in the Keys & Licenses drawer to connect.",
    manageKeyInLicenses: "Add or remove your API key in the Keys & Licenses drawer.",
    model: "Model",
    loadingModels: "Loading models…",
    modelDefault: "Default (Claude Code picks)",
    couldNotLoadModels: "Couldn’t load models",
    modelSetTo: (label) => `✓ Model set to ${label}`,
    modelSetDefault: "✓ Model set to default",
    keyNote: "Key stored encrypted in your OS keychain.",
    fidelityLabel: "Build fidelity",
    fidelityDesc: "Design builds run on Sonnet by default, which is fast and low-cost. Turn on for a high-fidelity final on Opus: slower and pricier, but it follows a detailed design (like an imported Figma page) far more closely.",
    fidelityOn: "High fidelity · Opus",
    fidelityOff: "Fast · Sonnet",
    imagesLabel: "Images",
    imagesDesc: "By default the design sources real images. Turn this on to skip that and hold every image spot with a marked placeholder instead, so you can drop in your own.",
    imagesToggle: "No images, placeholders only",
    loggingLabel: "Logging",
    loggingDesc: "For testing and feedback. When on, the app keeps a daily log of what it does: build steps, tools the designer's assistant ran, anything it refused, and errors, with keys redacted. Seven days are kept.",
    loggingToggle: "Keep a log",
    loggingSave: "Save log file…",
    loggingCopy: "Copy log",
    loggingCopied: "Copied. Paste it into your message.",
    loggingEmpty: "Nothing logged yet today.",
    loggingReveal: "Show logs folder",
    loggingSaved: (p) => `Saved to ${p}`,
    loggingWhere: (f) => `Today’s log: ${f}`,
    loggingOff: "Logging is off; nothing is being written.",
    narrateLabel: "Narrate builds",
    narrateDesc: "While a design builds, narrate what’s happening behind the scenes in an art-director voice. On by default; turn it off for a quieter, no-frills progress bar.",
    narrateToggle: "Narrate the build with a live art-director voice",
    imagesOnPlaceholders: "✓ Placeholders only, I won’t source images.",
    imagesOnSourcing: "✓ Image sourcing back on.",
    researchLabel: "Research the field",
    researchDesc: "Studies a few comparable sites to ground the layout, colors, and flow, so the first design and later changes take a little longer when this is on.",
    researchGlobal: "On by default (all projects)",
    researchBroad: "Also look beyond competitors for style & regional references",
    researchForDesign: (id) => `Research for this design (${id})`,
    researchBroadForDesign: "Broad references for this design",
    sessionsLabel: "Sessions",
    sessionsDesc: "Saved chats for this project. They appear here when you start a new session or leave the project.",
    autoRestore: "Auto-restore last session when a project opens",
    newSession: "+ New",
    newSessionTitle: "Start a new session (saves the current one here)",
    deleteAllTitle: "Delete all saved sessions",
    deleteAllConfirmTitle: "Delete all saved sessions?",
    deleteAllOk: "Delete all",
    deleteAllMessage: "This permanently removes every saved session for this project from the Claude panel. Your project files and design work are not affected.",
    reopenSession: "Reopen this session",
    untitledSession: "Untitled session",
    deleteSessionTooltip: "Delete this session",
    deleteSessionTitle: "Delete this session?",
    deleteSessionOk: "Delete",
    deleteSessionMessage: (name) => `Permanently remove "${name}"? Your project files and design work are not affected.`,
    modelNote: "Applies to your next message; switching keeps the conversation.",
  },

  // ── In-pane intake: onboarding fork, agent question cards, brief, references ─
  intake: {
    questionFallback: "Question",
    submit: "Submit",
    other: "Other…",
    otherPlaceholder: "Type your own answer",
    attached: (name) => `✓ ${name} attached`,
    referencesAdded: (n) => `✓ ${n} reference${n > 1 ? "s" : ""} added`,
    uploadReferences: "📎 Upload references…",
    uploadReferencesDesc: "Click or drop images, PDFs, or brand guides, I’ll read them and pull the palette + fonts",
    uploadFromPhone: "Send from your phone",
    uploadFromPhoneLead: "Scan with the phone's camera; photos and screenshots you pick land here as references.",
    uploadFromPhoneReceived: (n) => n === 1 ? "1 file received, reading it…" : `${n} files received, reading them…`,
    readingReferences: "Reading your references…",
    readingReferencesDistilling: "Reading your references… distilling the style",
    addingReferences: "Adding your references…",
    couldNotAddReferences: "Could not add the references.",
    alreadyAdded: "Those were already added.",
    uploadFile: "📎 Upload a file…",
    uploadFileDesc: "Choose or drag a file (e.g. company-profile.json)",
    briefTitle: "Your brief so far",
    referencesTitle: "Design references",
    referencesHelpTitle: "How design references work",
    referencesHint: "Optional. Drop images, PDFs, or brand guides you want me to follow.",
    uploadReferencesShort: "Upload references",
    palette: "Palette",
    removeReference: "Remove reference",
    clickToView: "Click to view",
    openFile: "Open file",
    continue: "Continue",
    gotIt: "✓ Got it",
    skipped: "Skipped",
    edit: "Edit",
    saveEdit: "Save",
    letYouChoose: "I’ll let you choose",
    undoSkip: "Undo skip",
    reviewQuestion: "That’s a solid start. Are we ready to design, or would you like to add more context first?",
    startDesigning: "Looks good, start designing",
    addMoreContext: "Wait, let me add more context",
    moreContextPlaceholder: "Anything else that matters: company or site name, the client, the audience, must-haves…",
    addAndContinue: "Add this and continue",
    foldingIntoBrief: "Thanks, noted, and adding that into your brief…",
    refLinkCap: "Link",
    refUrlPlaceholder: "https://…",
    refWhyCap: "What do you like about it?",
    refWhyPlaceholder: "The feel, the layout, a detail…",
    refRemove: "Remove",
    addAnotherSite: "+ Add another site",
    customColor: "Custom color",
    logoDropDefault: "Drop a logo, or click to choose",
    designingMessage: (type) => `Designing ${type === "app" ? "an app" : "a website"}. I’ll ask you a few questions here and then we’ll get designing.`,
    kickoffPending: "Hold tight while we get things started. I’ll ask you a few questions right here.",
    skip: "Skip",
    skipReference: "Skip, I don’t have one",
    // P2 design-direction knob panel (shown on the review step).
    direction: {
      title: "Design direction",
      reroll: "↻ Reroll",
      axisLabels: { convention: "Convention", energy: "Energy", structure: "Structure", era: "Era", motion: "Motion" },
      // Hover-tooltip copy for the "i" beside each lever label (what the axis does).
      axisHelp: {
        convention: "How familiar or novel the design language is, from common, expected patterns to experimental.",
        energy: "The visual intensity, from calm and restrained to loud and maximal.",
        structure: "How the layout is organized, from strict, ordered grids to loose and organic.",
        era: "The stylistic era it evokes, from timeless to avant-garde and forward-looking.",
        motion: "How much movement and animation, from fully static to kinetic.",
      },
      groupDirections: "Directions",
      groupMovements: "Movements",
      // The gallery: three example images under the picked direction, and the lightbox
      // (image, credit, a fuller read on the direction).
      about: "About this direction",
      imageCredit: (credit, license) => `Image: ${credit}${license ? ` (${license})` : ""}`,
      imageSource: "source",
      gallerySoon: "Example images for this direction are on their way.",
      helpTitle: "How the design direction works",
      // The "?" overlay on the direction picker (static HTML card body).
      helpHtml: `
    <div class="iref-help-head">
      <div class="iref-help-title">How the design direction works</div>
      <button type="button" class="iref-help-x" aria-label="Close">✕</button>
    </div>
    <div class="iref-help-tabs">
      <button type="button" class="iref-help-tab active" data-tab="basics">The basics</button>
      <button type="button" class="iref-help-tab" data-tab="variety">Variety over time</button>
    </div>

    <div class="iref-help-panel active" data-panel="basics">
      <p>The design direction shapes the whole look of your page, its layout rhythm, type feel, and motifs, so your designs stay distinct instead of all landing on the same generic template. Each direction is a curated <b>style</b> (a “lens”).</p>

      <h4>Pick a style</h4>
      <p>The style name at the top is a menu. Click it to choose a named style or art movement directly, grouped into <b>Directions</b> (Swiss, Editorial, Brutalist, and more) and <b>Movements</b> (Bauhaus, Art Deco, Mid-Century Modern, Memphis, and more). Picking one sets the design to that style and moves the sliders to match.</p>

      <h4>Fine-tune with the sliders</h4>
      <ul>
        <li><b>Convention</b>: how far from a familiar layout, common through experimental.</li>
        <li><b>Energy</b>: how loud or quiet, calm through maximal.</li>
        <li><b>Structure</b>: how tidy, an ordered grid through freeform.</li>
        <li><b>Era</b>: the period feel, timeless through avant-garde.</li>
        <li><b>Motion</b>: how animated, static through kinetic.</li>
      </ul>
      <p>Nudging a slider steers the style you have toward that feel. The style stays; its details follow the sliders. Put a slider back and you have the same direction as before. To change the style itself, pick one from the menu at the top.</p>

      <h4>Reroll</h4>
      <p>Reroll draws a fresh take. If you have picked a style or set the sliders, it keeps that direction and just varies the details; left untouched, it draws a whole new direction.</p>

      <h4>You can also just say it</h4>
      <p>Mention a style in your brief, like “a Bauhaus site” or “make it art deco”, and the design will lead with it.</p>

      <div class="iref-help-note">Nothing here is required. Leave it alone and a fitting direction is chosen for you, and it differs each time, so the same brief never produces the same design.</div>
    </div>

    <div class="iref-help-panel" data-panel="variety">
      <p>To keep your work from drifting back into a rut, each finished design quietly remembers the <b>style</b> and <b>layout motifs</b> it used, across every project. The next design then makes those recent choices <b>less likely</b>, so your designs keep feeling fresh instead of repeating.</p>

      <h4>What it nudges</h4>
      <p>It works one layer below the mood. The sliders are always yours, they are never overridden. What rotates underneath is the <b>style</b> and the <b>compositional details</b> (the eyebrow treatment, hero shape, section rhythm, dividers, and the background texture or ornament).</p>

      <h4>Example: avant-garde, several in a row</h4>
      <p>Leave the <b>Era</b> on avant-garde and build four designs. They all stay avant-garde, that is your steer. But the style and layout shift each time, one leans brutalist, the next more futurist, another maximal, so they read as a series, not four copies.</p>

      <h4>It fades, and it never bans</h4>
      <p>A recent choice is only made less likely, never blocked, so anything can still come up. And the nudge decays: a style you have not used for a few weeks becomes fully fair game again.</p>

      <div class="iref-help-note">Choices you make on purpose always win: a style you pick from the menu, or one you name in your brief, is used as asked, memory and all.</div>
    </div>
  `,
    },
    fontCustomPlaceholder: "Or type any font name…",
    fontCustomAdd: "Add",
    fontUpload: "⬆ Upload a font file",
    // Client-rendered intake questions, asked in the pane with NO model turn. Sections,
    // color, and font stay model-driven (one turn) so their options fit the vibe + type.
    q: {
      what: "In your words, what are you making, and how should it feel?",
      whatPlaceholder: "A few sentences: what it’s for, who it’s for, the mood you’re after…",
      clientName: "Company or brand name",
      projectName: "A name for this project",
      logo: "Logo (optional)",
      logoPlaceholder: "Drop or choose a logo image (PNG, SVG, JPG)",
      reference: (kind) => `Is there a ${kind} you love? Share it and what draws you to it.`,
      direction: "Which design direction should we take?",
      heroLayout: "How should the hero (the first thing visitors see) be laid out?",
      heroLayoutHelp: "Pick a starting structure, or let me choose.",
      menuLayout: "How should the site header and navigation be laid out?",
      menuLayoutHelp: "Pick a header style, or let me choose.",
      ctaType: "How should the contact / call-to-action section work?",
      ctaTypeHelp: "A contact form, or a button-led call to action. Or let me choose.",
    },
    // The hero picker's nested background-material sub-choice (full-screen only, and
    // only when a library that carries video is connected).
    heroMedia: {
      label: "Hero background",
      image: "Image",
      video: "Video",
      videoSuffix: "with a video background",
    },
    // The Design References introduction: the rail's panel shown as a card right after
    // the first question, so it isn't overlooked; Continue hands it over to the rail.
    refsIntro: {
      label: "Anything we should look at?",
      help: "Sites, screenshots, brand files, anything with the feel you're after. Add them now or any time: this panel moves to the right and stays with you through every question.",
      continue: "Continue",
    },
    // The start fork. Shown only when Figma is licensed (Start from Figma + Get Designing);
    // unlicensed users skip it and go straight to Get Designing. (clientSetup* kept for now:
    // the "Client Setup" card is retired pending reconsideration, see onboarding-figma-reframe-spec.)
    start: {
      headTitle: "Let’s make something",
      headSubtitle: "Pick how you’d like to begin.",
      clientSetupLabel: "Client Setup Please",
      clientSetupDesc: "Brand a new project step by step (logo, fonts, colors), then design.",
      getDesigningLabel: "Let’s Get Designing",
      getDesigningDesc: "Jump straight in: tell me a little about the site and I’ll use your answers to start designing.",
      figmaStartLabel: "Start from Figma",
      figmaStartDesc: "Import a Figma frame to seed the brand, and design from it if it’s a page.",
    },
    // The "Start from Figma" frame-link screen (shown when that card is picked).
    figma: {
      headTitle: "Start from Figma",
      headSubtitle: "Paste a link to the Figma frame you want to build from.",
      urlPlaceholder: "https://figma.com/design/…?node-id=…",
      importLabel: "Import",
      skip: "Skip, just start designing",
      invalidUrl: "That doesn’t look like a Figma frame link.",
      echoImport: "Import my Figma URL",
      echoBuildPage: "Build the page",
      workingTitle: "Reading your Figma frame",
      workingLead: "Pulling the colors, type, and structure. One moment.",
      doneTitle: (name) => (name ? `Imported ${name}` : "Imported from Figma"),
      doneLead: "Here’s what came across. Choose how to continue.",
      paletteLabel: "Palette",
      typeLabel: "Type",
      badgePage: "Full page",
      badgeStyleguide: "Component library",
      badgeUnknown: "Figma frame",
      // Next-step cards.
      designPageLabel: "Design this page",
      designPageDesc: "Build a version of this frame, using its sections as the layout.",
      startDesigningLabel: "Start designing",
      startDesigningDesc: "Use this as the style direction, then tell me what you’re building.",
      briefLabel: "Start from a brief",
      briefDesc: "Describe what you’re making; this rides along as the reference.",
      fontUploadLead: (family) => `${family} isn’t a web font. Upload the files so the design can use it.`,
      fontUploadBtn: "Upload font files",
      fontUploadDone: (n, family) => `Added ${n} file${n === 1 ? "" : "s"} for ${family}.`,
      fontUploadFail: "Could not add those files.",
      logoImported: "Logo imported.",
      imagesNote: (n) => `${n} curated image${n === 1 ? "" : "s"} imported from the file, ready to use.`,
      logoUploadLead: (name) => (name ? `Couldn’t auto-export ${name}’s logo. Upload it (SVG or PNG) and it goes straight into the header.` : "Add a logo (SVG or PNG) and it goes straight into the header."),
      logoUploadBtn: "Upload logo",
      logoUploadDone: "Logo added.",
      logoUploadFail: "Could not add that logo.",
    },
    // "What are you designing for?" (Website vs App).
    deliverable: {
      headTitle: "What are you designing for?",
      headSubtitle: "Choose one to get started.",
      websiteLabel: "Website",
      websiteDesc: "A marketing site or landing pages.",
      appLabel: "App",
      appDesc: "Product UI, dashboards, in-app screens.",
    },
    // A saved intake for this project (auto-saved after every answer): offered on the
    // deliverable screen, which Back lands on too.
    resume: {
      title: "Pick up where you left off?",
      detail: (n, when) => `${n === 1 ? "1 question" : `${n} questions`} answered, saved ${when}. Your answers stay editable.`,
      resume: "Pick up where I left off",
      startOver: "Start over",
    },
    // The head shown once questions begin.
    gathering: {
      headTitle: "Let’s design something",
      headSubtitle: "Tell me a little about what you’re making. <br>The more you share, the closer the first draft lands.",
    },
    // The "?" overlay explaining how references work (static HTML card body).
    referencesHelpHtml: `
    <div class="iref-help-head">
      <div class="iref-help-title">How design references work</div>
      <button type="button" class="iref-help-x" aria-label="Close">✕</button>
    </div>
    <p>Upload anything you have already collected that captures the look you want: images, screenshots, moodboards, PDFs, brand or style guides. I read them once, up front, and distill them into a compact style direction that guides the design.</p>

    <h4>What I pull out</h4>
    <ul>
      <li><b>Exact colors</b>, from images and from the pages of a PDF.</li>
      <li><b>Type feel</b> and <b>layout patterns</b> (grid, spacing, density).</li>
      <li><b>Imagery style</b> and overall mood.</li>
      <li><b>Rules from brand docs</b>: voice, do’s and don’ts, named colors and fonts.</li>
    </ul>

    <h4>What works best</h4>
    <ul>
      <li><b>Fewer, stronger</b> references beat many weak ones. A handful that truly represent the look is ideal.</li>
      <li><b>Images:</b> clear and representative (JPG, PNG, WebP, and similar).</li>
      <li><b>PDFs:</b> brand and style guides are perfect. Text PDFs and scanned or vector ones both work, I render the pages and read them. The first few pages carry the most weight, so lead with your strongest.</li>
      <li><b>Color swatches:</b> if your guide shows swatches, I pick up those exact hex values.</li>
      <li><b>File size:</b> smaller is faster. Very large PDFs (100MB and up) still work, they just take a little longer to read.</li>
    </ul>

    <h4>Private by design</h4>
    <p>References are working material only. They are stored locally with your project, never committed, and never published to your shared preview. Because I read them once and keep just the distilled summary, they do not sit in the conversation or run up token cost.</p>

    <div class="iref-help-note">Add or remove references at any time. Removing one updates the distilled direction automatically.</div>
  `,
  },

  // ── In-pane Company Setup form ("Brand This Project") ───────────────────────
  companyForm: {
    headTitle: "Brand this project",
    headSubtitle: "Your company identity, set once and reused across every project.",
    nameLabel: "Company or agency name",
    namePlaceholder: "e.g. Northlight Studio",
    headingFontLabel: "Wordmark / heading font",
    headingFontHelp: "Used on the login gate and admin chrome.",
    bodyFontLabel: "Body / secondary font",
    useDefault: "Use default",
    logoLabel: "Login logo (optional)",
    logoPlaceholder: "Drop a logo image, or click to choose",
    apply: "Apply branding",
    applying: "Applying your company branding…",
    applyError: "Couldn’t apply the branding.",
    applyErrorPrefix: "Couldn’t apply the branding: ",
  },
};
