// copy.js — the app shell's user-facing copy, in one place.
//
// Same convention as the scaffold's src/copy/en.ts and the preview gate's local
// COPY: a keyed catalog reached as COPY.area.item, where parameterized entries
// are functions. This is a classic <script> (no modules in the shell), so it
// publishes a global `window.COPY` and MUST be loaded before shell.js.
//
// Scope: framework/admin CHROME only. Dynamic data (project titles, tool/file
// names in status lines, IPC channel strings) stays inline in shell.js. When you
// add or reword a shell string, do it here, not at the call site. House style:
// no em-dashes.
window.COPY = {
  // ── Launch splash (logo + welcome, shown briefly on open) ───────────────────
  splash: {
    welcome: "Welcome to thinkany design studio.",
  },

  // ── Status label in the top bar for the connect / no-project stages ─────────
  status: {
    notConnected: "not connected",
    noProject: "no project",
  },

  // ── Preview pane: placeholder states + the rotating "working" messages ──────
  preview: {
    spinningUp: {
      emoji: "⏳",
      title: "We're spinning up your preview…",
      text: "Just a moment while your dev server starts up.",
    },
    settingUp: {
      emoji: "✨",
      title: "Setting up your project",
      text: "Your live preview opens on its own once your design's ready. Pick up in the chat.",
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
      title: "Let's set up your project",
      text: "I'll walk you through it in the chat, one question at a time. Answer along and your project takes shape here.",
    },
    gettingSetUp: "Getting set up",
    updatingDesign: "Updating your design",
    preparingElements: "Getting your site design elements prepared",
    workingMessages: [
      "We're getting your workspace set up…",
      "Setting things up for you…",
      "Getting everything ready…",
      "Your live preview will open on its own once it's ready…",
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
      "Your live preview opens here on its own once it's ready…",
    ],
    takingInMessages: [
      "Got it, give me a moment while I take that in…",
      "Perfect, let me sit with that a second…",
      "Thanks for finishing that walkthrough…",
    ],
  },

  // ── Chat: tool-activity bubble verbs + the long-session nudges ──────────────
  chat: {
    // Playful stand-ins shown while a Bash tool runs.
    bashVerbs: [
      "Working", "Cooking", "Crunching", "Tinkering", "Wrangling", "Assembling",
      "Piecing things together", "Rustling something up", "Noodling on it", "Conjuring",
      "Fiddling with the bits", "Making it happen",
    ],
    // { at } is the fraction-of-context threshold that fires each nudge.
    sessionNudges: [
      { at: 0.6, msg: "This conversation is getting long (~60% of the context window). If replies start to slow, type /clear to begin a fresh session. Your project files and design work are saved on disk and won't be lost." },
      { at: 0.85, msg: "Heads up: this conversation is ~85% full. /clear starts a clean, faster session (your saved work stays intact)." },
    ],
    startedFresh: "Started a fresh session. Your previous one is saved in the Claude panel (Sessions).",
    resumedSession: "Resumed this session. Pick up where you left off.",
    // The "Start a new session?" confirmation (clicking the context gauge).
    newConfirmTitle: "Start a new session?",
    newConfirmOk: "New session",
    newConfirmMessage: (tokens, pct) =>
      "Starting a new session gives you a fresh, fast chat. Your current session is SAVED to the Claude " +
      "panel's Sessions list (not lost), reopen it anytime to pick up where you left off. Project files and " +
      "design work are unaffected.\n\n" +
      `You're currently at about ${tokens} tokens (${pct}% of the context window). ` +
      "It's a good time to start fresh when this climbs high (the ring turns amber, then red) or you're moving to a new task.",
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
    publish: "Publish",
    company: "Company Profile",
    voice: "Copy Voice",
    figma: "Figma Export",
    claude: "Claude Settings",
    sessionUsage: "Claude Session Usage",
    sessionUsageAria: "Claude Session Usage, click to clear the session",
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

  // ── Point & Comment feedback toggle ─────────────────────────────────────────
  feedback: {
    label: "Point & Comment",
    pointing: "Pointing… (Esc to exit)",
    toggleTitle: "Point at an element in the preview and leave a note for Claude",
    toggleAria: "Point and Comment",
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
    blankHtml: "Preview looks blank? First try the tab's <b>⟳</b> reload. Still blank?",
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
      ["/setup-project", "Brand the template: client/company name, project type, fonts, logo, menu style."],
      ["/setup-styleguide", "Set the client's fonts, colors, and example styleguide sections."],
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
    help: "Commands",
    projects: "Switch Project",
    publish: "Publish",
    company: "Company Profile",
    figma: "Figma Export",
    voice: "Copy Voice",
    claude: "Claude Settings",
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
    saveDefault: "Save this project's identity as my default",
    clearDefault: "Clear default",
    exportNeedsProject: "Open a project to export its company profile to a file.",
    exportIntro: "Export this project's agency identity as a portable file (to move between machines or share).",
    exportBtn: "⬇ Export company profile to a file",
    noProfileYet: "No company-profile.json yet. Run /export-company in the chat to create one first.",
  },

  // ── Figma Export license drawer ─────────────────────────────────────────────
  figma: {
    licenseLabel: "Figma export license",
    removeLicense: "Remove license",
    pasteKey: "Paste your license key",
    saveLicense: "Save license",
    validating: "Validating…",
    couldNotSave: "Could not save the license.",
    note: "Unlocks Figma export. Validated with the derive service; stored encrypted in your OS keychain.",
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
      desc: "The private link you share opens on a sign-in screen branded with YOUR company name and logo, that's what your client sees first. It isn't set for this project yet. Add it so the preview looks like yours (you can still publish without it).",
      upload: "Upload a profile",
      setup: "Set up project",
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
    noDomainsNote: "No domains on your Vercel account yet. Add one in Vercel and it'll appear here.",
    domainsError: "Couldn't load your Vercel domains, check your connection.",
    publishChanges: "Publish changes",
    publishDesign: "Publish this design",
    resetPassword: "Reset preview password",
    resetPasswordTitle: "Generate a new client password and republish",
    lastPublishedPrefix: "Last published ",
    helpButton: "Help with publishing",
    publishing: "Publishing…",
    publishFailed: "Publish failed.",
    previewPasswordLabel: "Preview password (share with your client)",
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
    intro: "Shape the words the AI writes into this design's copy. Nothing is set by default.",
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
    pasteKeyNote: "Close this and paste your key on the connect screen.",
    model: "Model",
    loadingModels: "Loading models…",
    modelDefault: "Default (Claude Code picks)",
    couldNotLoadModels: "Couldn't load models",
    modelSetTo: (label) => `✓ Model set to ${label}`,
    modelSetDefault: "✓ Model set to default",
    keyNote: "Key stored encrypted in your OS keychain.",
    imagesLabel: "Images",
    imagesDesc: "By default the design sources real images. Turn this on to skip that and hold every image spot with a marked placeholder instead, so you can drop in your own.",
    imagesToggle: "No images, placeholders only",
    imagesOnPlaceholders: "✓ Placeholders only, I won't source images.",
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
    uploadReferencesDesc: "Click or drop images, PDFs, or brand guides, I'll read them and pull the palette + fonts",
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
    letYouChoose: "I'll let you choose",
    undoSkip: "Undo skip",
    reviewQuestion: "That's a solid start. Ready to design, or want to add more context first?",
    startDesigning: "Looks good, start designing",
    addMoreContext: "Wait, let me add more context",
    moreContextPlaceholder: "Anything else that matters: company or site name, the client, the audience, must-haves…",
    addAndContinue: "Add this and continue",
    foldingIntoBrief: "Thanks, folding that into your brief…",
    refLinkCap: "Link",
    refUrlPlaceholder: "https://…",
    refWhyCap: "What do you like about it?",
    refWhyPlaceholder: "The feel, the layout, a detail…",
    refRemove: "Remove",
    addAnotherSite: "+ Add another site",
    customColor: "Custom color",
    logoDropDefault: "Drop a logo, or click to choose",
    designingMessage: (type) => `Designing ${type === "app" ? "an app" : "a website"}. I'll ask you a few quick things here in the panel, then put your brief together.`,
    kickoffPending: "Hold tight while we get things started. I'll ask you a few quick things right here.",
    // The two-panel start fork (Client Setup vs Get Designing).
    start: {
      headTitle: "Let's make something",
      headSubtitle: "Pick how you'd like to begin.",
      clientSetupLabel: "Client Setup",
      clientSetupDesc: "Brand a new project step by step (logo, fonts, colors), then design.",
      getDesigningLabel: "Get Designing",
      getDesigningDesc: "Jump straight in: tell me about the site and I'll gather the brief.",
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
      headTitle: "Let's design something",
      headSubtitle: "Tell me a little about what you're making. The more you share, the closer the first draft lands.",
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
      <li><b>Rules from brand docs</b>: voice, do's and don'ts, named colors and fonts.</li>
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
    applyError: "Couldn't apply the branding.",
    applyErrorPrefix: "Couldn't apply the branding: ",
  },
};
