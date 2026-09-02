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
    dragResize: "Drag to resize the chat",
  },

  // ── Icon rail tooltips (data-tip + aria-label) ──────────────────────────────
  rail: {
    help: "Help with Commands",
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
    failed: (why) => `Art Director couldn’t review this design (${why}).`,
  },
  // The Director drawer (Phase 3): recommendations, the modal, and the Archive.
  director: {
    needDesign: "Open a built design to review it — the Art Director reviews the design you’re previewing.",
    lead: (id) => `Reviewing ${id}. Open a recommendation to read it in full, then apply or dismiss it.`,
    review: "Review this design",
    reReview: "Review again",
    none: "No recommendations yet. Run a review to get the Art Director’s read.",
    allHandled: "All caught up — nothing active. Re-review to check the latest, or reopen the Archive below.",
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
    assetNote: "Needs a new asset — your call to supply it.",
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
    site: "Pages",
    help: "Commands",
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
    notReady: {
      "no-site": "This project doesn’t have a site yet.",
      "not-promoted": "Approve a design and run /promote-blocks in the chat. The site is built from that; then its pages appear here.",
      "no-home": "The site has no home page yet.",
      "no-project": "Open a project to edit its site.",
    },
    liveAt: "Live at",
    previewNote: "Previewing in the Site tab. Publish from the Publish panel when it’s ready.",
    pagesHeading: "Pages",
    addPage: "Add a page",
    newPagePlaceholder: "Page title (e.g. About)",
    create: "Create",
    pageTitle: "Title",
    pageSlug: "Address",
    homeSlug: "/ (home)",
    seoHeading: "Search & sharing",
    seoTitle: "Search title",
    seoTitleHint: "Shown in the browser tab and search results. Leave empty to use the page title.",
    seoDescription: "Description",
    seoDescriptionHint: "One or two sentences for search results and link previews.",
    seoImage: "Share image",
    seoImageHint: "A path in public/ (e.g. /images/hero.jpg) or a full URL.",
    seoNoindex: "Hide this page from search engines",
    blocksHeading: "Blocks",
    noBlocks: "No blocks yet. Add one below.",
    addBlock: "Add a block",
    editContent: "Edit content",
    hideContent: "Hide content",
    moveUp: "Move up",
    moveDown: "Move down",
    removeBlock: "Remove",
    addItem: "+ Add",
    removeItem: "Remove",
    listItem: (n) => `Item ${n}`,
    save: "Save page",
    saved: "Saved",
    saving: "Saving…",
    deletePage: "Delete page",
    deleteConfirm: (t) => `Delete “${t}”? This removes its content file.`,
    navHeading: "Navigation",
    navDesc: "The links in the header and footer. An address can be a page (/about), a section on the home page (/#contact), or a full URL.",
    navLabel: "Label",
    navHref: "Address",
    addLink: "+ Add link",
    addSubLink: "+ Sub-link",
    subLinks: "Sub-links",
    footerHeading: "Footer-only links",
    saveNav: "Save navigation",
    postsHeading: "Blog posts",
    noPosts: "No posts yet.",
    addPost: "Add a post",
    newPostPlaceholder: "Post title",
    postDate: "Date",
    postDescription: "Summary",
    postDescriptionHint: "Shown in the blog list and used as the search description.",
    postImage: "Cover image",
    postTags: "Tags",
    postTagsHint: "Comma-separated.",
    postDraft: "Draft (not published)",
    postBody: "Body",
    postBodyHint: "Markdown: # headings, **bold**, - lists, [links](/about).",
    savePost: "Save post",
    deletePost: "Delete post",
    deletePostConfirm: (t) => `Delete “${t}”? This removes its file.`,
    draftTag: "draft",
    // content types
    typesHeading: "Content types",
    typesDesc: "Your own kinds of content, like products or landing pages. Each has fields, a page template built from your blocks, and its own address.",
    addType: "Add a content type",
    newTypePlaceholder: "Type name, plural (e.g. Products)",
    editType: "Edit type",
    typeLabel: "Name (plural)",
    typeSingular: "Name (singular)",
    typePath: "Address",
    typePathHint: "Entries live under this address, e.g. /products/blue-widget.",
    typeIndexToggle: "Show an index page listing all entries at the address",
    typeIndexTitle: "Index title",
    typeIndexDescription: "Index intro",
    fieldsHeading: "Fields",
    fieldsDesc: "Every entry gets a title and an address; add the rest here.",
    fieldKey: "key",
    fieldLabel: "Label",
    fieldKind: "Kind",
    fieldRequired: "Required",
    fieldOptions: "Options (comma-separated)",
    fieldReference: "Refers to",
    addField: "+ Add field",
    kinds: { text: "Text", textarea: "Long text", richtext: "Rich text (markdown)", number: "Number", boolean: "Yes / no", date: "Date", image: "Image", select: "Choice", list: "List of text", link: "Link", reference: "Reference to another type" },
    templateHeading: "Page template",
    templateDesc: "The blocks that render each entry. In any text, {{field}} fills in that field; {{title}} is the entry’s title. A text field like {{image}} alone hands over the whole image.",
    saveType: "Save type",
    deleteType: "Delete type",
    deleteTypeConfirm: (t) => `Delete the “${t}” type? Its entries stay on disk but stop being published.`,
    entries: (n) => n === 1 ? "1 entry" : `${n} entries`,
    noEntries: "No entries yet.",
    addEntry: (s) => `Add ${s}`,
    newEntryPlaceholder: "Title",
    entryOwnBlocks: "This entry uses its own blocks instead of the template",
    saveEntry: "Save",
    deleteEntry: "Delete",
    deleteEntryConfirm: (t) => `Delete “${t}”?`,
    imageSrc: "Image path or URL",
    imageAlt: "Alt text",
    linkLabel: "Label",
    linkHref: "Address",
    listHint: "One per line.",
    noneOption: "(none)",
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
    designLabel: "Design, Research & Art Director",
    designDesc: "Unlocks design directions, competitor research, and the Art Director review.",
    figmaLabel: "Figma Export",
    figmaDesc: "Unlocks exporting your designs to Figma.",
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
        "not-promoted": "Approve a design and run /promote-blocks in the chat to turn it into a site. Then you can publish it here.",
        "no-home": "The site has no home page yet.",
      },
      domainLabel: "Site domain",
      subdomainOptional: "subdomain (optional)",
      ownedDomainNote: "A domain you own on Vercel, or a subdomain of one. Leave the subdomain empty to use the domain itself. Applied on the next publish.",
      publishSite: "Publish the site",
      publishSiteChanges: "Publish site changes",
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
    fidelityDesc: "Design builds run on Sonnet by default — fast and low-cost. Turn on for a high-fidelity final on Opus: slower and pricier, but it follows a detailed design (like an imported Figma page) far more closely.",
    fidelityOn: "High fidelity · Opus",
    fidelityOff: "Fast · Sonnet",
    imagesLabel: "Images",
    imagesDesc: "By default the design sources real images. Turn this on to skip that and hold every image spot with a marked placeholder instead, so you can drop in your own.",
    imagesToggle: "No images, placeholders only",
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
    reviewQuestion: "That’s a solid start. Ready we ready to design, or want would you like to add more context first?",
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
        convention: "How familiar or novel the design language is — from common, expected patterns to experimental.",
        energy: "The visual intensity — from calm and restrained to loud and maximal.",
        structure: "How the layout is organized — from strict, ordered grids to loose and organic.",
        era: "The stylistic era it evokes — from timeless to avant-garde and forward-looking.",
        motion: "How much movement and animation — from fully static to kinetic.",
      },
      groupDirections: "Directions",
      groupMovements: "Movements",
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
      <p>Nudging a slider steers the design toward that feel and picks the closest matching style.</p>

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
      heroLayout: "How should the hero (the first thing visitors see) be laid out?",
      heroLayoutHelp: "Pick a starting structure, or let me choose.",
      menuLayout: "How should the site header and navigation be laid out?",
      menuLayoutHelp: "Pick a header style, or let me choose.",
      ctaType: "How should the contact / call-to-action section work?",
      ctaTypeHelp: "A contact form, or a button-led call to action. Or let me choose.",
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
