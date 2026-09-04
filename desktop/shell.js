// Renderer logic: a three-stage flow — connect key → choose project → workspace
// (chat + live preview). The preview shows a welcome placeholder for a fresh
// project and swaps to the live design (/?v=<id>) once setup creates a variation.

const el = (id) => document.getElementById(id);

// Bar
const status = el("status");
const projname = el("projname");
// Title for the chat bar: "Client - Project" when both exist, else whichever is set,
// else the folder name. Sets a tooltip too so the full name shows when truncated.
function projectTitle(m) {
  const client = ((m && m.client) || "").trim();
  const project = ((m && m.project) || "").trim();
  if (client && project) return `${client} - ${project}`;
  return client || project || (m && m.name) || "";
}
function setProjTitle(m) {
  const t = projectTitle(m);
  projname.textContent = t;
  projname.title = t;
}

// Sidebar + modal
const railHelp = el("rail-help");
const railProjects = el("rail-projects");
const railSite = el("rail-site");
const railPublish = el("rail-publish");
const railCompany = el("rail-company");
const railFigma = el("rail-figma");
const railVoice = el("rail-voice");
const railClaude = el("rail-claude");
const railDirector = el("rail-artdirector");
const railA11y = el("rail-a11y");
const railLicenses = el("rail-licenses");
const modal = el("modal");
const modalTitle = el("modal-title");
const modalBody = el("modal-body");
const modalClose = el("modal-close");

// Gates
const keygate = el("keygate");
const keyinput = el("keyinput");
const keysave = el("keysave");
const keyerror = el("keyerror");
const projectgate = el("projectgate");
const createproject = el("createproject");
const openproject = el("openproject");
const projecterror = el("projecterror");

// Workspace
const chatmain = el("chatmain");
const log = el("log");
const input = el("input");
const send = el("send");
const attach = el("attach");
const cmdbtn = el("cmdbtn");
const cmdmenu = el("cmdmenu");
const gauge = el("gauge");
const gaugeProg = gauge.querySelector(".prog");
const gaugePct = gauge.querySelector(".pct");
const confirmEl = el("confirm");
const confirmTitle = el("confirm-title");
const confirmMsg = el("confirm-msg");
const confirmCancel = el("confirm-cancel");
const confirmOk = el("confirm-ok");

// Preview / embedded browser
const browser = el("browser");
const tabbar = el("tabbar");
const views = el("views");
const feedbackBtn = el("feedback-toggle");
const feedbackLabel = el("feedback-toggle-label");
// Absolute file: URL of the preview inspector, attached as each preview webview's
// preload so "point & comment" works (and survives the preview's hot-reloads).
// Resolved in main and fetched here at boot (webviews open after boot, so it's set
// in time); a preview that opens before it lands just skips the inspector.
let PREVIEW_PRELOAD = "";
if (window.desktop && window.desktop.getPreviewInspectPreload) {
  window.desktop.getPreviewInspectPreload().then((p) => { PREVIEW_PRELOAD = p || ""; }).catch(() => {});
}
const urlbar = el("urlbar");
const navback = el("navback");
const navfwd = el("navfwd");
const navreload = el("navreload");
const previewph = el("previewph");
const phEmoji = previewph.querySelector(".ph-emoji");

// Preview-pane glyphs as thin, 1px-stroke line icons (the brand rail palette),
// keyed by the emoji they replace. setPhEmoji renders the icon (falls back to the
// raw character if unmapped); the static build-overlay/placeholder glyphs are
// converted once at load.
const PREVIEW_ICONS = {
  "⏳": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
  "✨": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0Z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',
  "👋": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
  "💬": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
};
function setPhEmoji(char) { phEmoji.innerHTML = PREVIEW_ICONS[char] || char; }
document.querySelectorAll(".bo-emoji, .ph-emoji").forEach((e) => {
  const t = (e.textContent || "").trim();
  if (PREVIEW_ICONS[t]) e.innerHTML = PREVIEW_ICONS[t];
});

const phTitle = el("ph-title");
const phText = el("ph-text");
const phProgress = el("ph-progress");
const buildoverlay = el("buildoverlay");
const boText = el("bo-text");
// Intake host (in-pane onboarding — T3/T4)
const intakeph = el("intakeph");
const intakeStack = el("intake-stack");
const intakeBack = el("intake-back");
let intakeActive = false; // while true, refreshPreview() leaves the pane to the intake host
let intakePhase = "idle"; // idle | deliverable | gathering | review | designing
let currentIntakeId = null; // the pending intake batch's id (for Back → cancel)
let deliverableType = "website"; // "website" | "app" — the first fork
// Post-answer "taking it in" lines, cycled so consecutive waits read differently.
const TAKING_IN_MESSAGES = COPY.preview.takingInMessages;
let takingInIdx = 0;

let sessionId = null;
// Set true when a design finishes building (finishBuildReveal). The FIRST edit after
// a build then starts a FRESH, lean editing session instead of resuming the heavy
// build history (which carries ~100k+ tokens + any diagnose screenshots, re-cached on
// every follow-up). The design lives on disk, so a lean preamble pointing at the files
// reconstructs everything the edit needs at a fraction of the cost. See the
// design-build efficiency work.
let leanEditPending = false;
let assistantEl = null;

// Preview state
let viteUrl = null;
let siteUrl = null; // the site (public website) dev server, once the design is promoted
let design = { active: false, variationId: null, previewReady: false };
let agentBusy = false;
// Serialization gate: a re-picked deliverable can't start a new turn until the prior
// turn's result/error EVENT has been handled (i.e. after showBriefComplete has already
// decided). Without it, a backed-out turn's completion hijacks the fresh turn's
// "gathering" state → the false "review" screen + fragmented chat (the Back bug).
let turnGate = Promise.resolve();
let releaseTurnGate = null;
function beginTurnGate() { turnGate = new Promise((r) => { releaseTurnGate = r; }); }
function endTurnGate() { const r = releaseTurnGate; releaseTurnGate = null; if (r) r(); }
let conversationStarted = false; // once true, don't re-show the fresh-start welcome
let tabs = [];
let activeTab = null;
let tabSeq = 0;
let tabsOpened = false; // whether default tabs were opened for the active design
let designJustActivated = false; // design went active this session (freshly created)
let workingTimer = null;
// Live-edit guard: while the agent is editing design files with the preview
// already open, we cover it with the calm placeholder so transient Vite/HMR
// error states never reach the designer; revealed only when the turn is done AND
// the design compiles cleanly. guardSeq lets a stale reveal bail if a new edit
// turn starts mid-settle.
let guarding = false;
let guardSeq = 0;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
// Progressive build reveal: once previewReady flips mid-build, we open the Style
// guide tab LIVE and keep the Home tab under a progress cover until the turn ends.
let homeTab = null;         // the Home tab opened during the early reveal
let homeBuilding = false;   // true while the Home tab is still being designed
let buildMsgTimer = null;   // rotates the build-overlay subline
// Quiet build (Get Designing): hold the preparing pane + a closed chat for the WHOLE
// initial build — no mid-build browser/Style-guide reveal, no chat narration — then
// reveal the finished design at the turn's end. Scoped to startDesigning so setup /
// edit / reroll flows keep their normal progressive reveal.
let quietBuildActive = false;

// ---- Resizable chat | preview divider (min 400px, remembered) ---------------
(function initChatResize() {
  const dragbar = el("dragbar");
  const chatPanel = el("chat");
  const preview = el("preview");
  if (!dragbar || !chatPanel) return;
  const KEY = "chatWidth";
  const clampWidth = (w) => {
    const min = 400;
    const max = Math.max(min, window.innerWidth - 460); // leave room for rail + preview
    return Math.min(Math.max(Math.round(w), min), max);
  };
  const saved = parseInt(localStorage.getItem(KEY) || "", 10);
  if (saved) chatPanel.style.width = clampWidth(saved) + "px";

  let dragging = false;
  dragbar.addEventListener("mousedown", (e) => {
    dragging = true;
    dragbar.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    if (preview) preview.style.pointerEvents = "none"; // don't let the webview eat the drag
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    chatPanel.style.width = clampWidth(e.clientX - chatPanel.getBoundingClientRect().left) + "px";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    dragbar.classList.remove("dragging");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (preview) preview.style.pointerEvents = "";
    localStorage.setItem(KEY, String(parseInt(chatPanel.style.width, 10) || 400));
  });
  // Keep within bounds when the window resizes.
  window.addEventListener("resize", () => {
    if (chatPanel.style.width) chatPanel.style.width = clampWidth(parseInt(chatPanel.style.width, 10) || 400) + "px";
  });
})();

// ---- Preview: embedded tabbed browser ---------------------------------------
// The browser stays CLOSED until a design exists AND Vite is serving — so it
// never shows a "server not ready" error page. Webviews auto-retry failed loads
// so they can't get wedged.
// `vid` pins a variation (the startup reveal wants the one setup just created); by
// default the quick-links follow the variation the ACTIVE tab is showing, so Home
// and Style guide reach v02+ once the designer has opened one from the dashboard.
function quickUrl(kind, vid) {
  const v = vid !== undefined ? vid : (currentPreviewVariation() || design.variationId);
  if (kind === "styleguide") return v ? `${viteUrl}/?v=${v}&styleguide` : `${viteUrl}/?styleguide`;
  if (kind === "dashboard") return `${viteUrl}/`;
  return v ? `${viteUrl}/?v=${v}` : `${viteUrl}/`; // home
}

// Resolve URL-bar input: local paths/routes go to the project's dev server,
// bare domains and full URLs navigate externally.
function resolveUrl(input) {
  const u = (input || "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u; // full URL → as typed
  if (/^localhost(:\d+)?([/?#]|$)/i.test(u)) return "http://" + u; // localhost[:port]
  if (/^[/?#]/.test(u)) return viteUrl + (u[0] === "/" ? u : "/" + u); // /path, ?query, #hash → local
  if (/^[^\s/]+\.[^\s/]+/.test(u)) return "https://" + u; // bare domain (has a dot) → external
  return `${viteUrl}/${u}`; // bare route name (e.g. "styleguide") → local
}

// Navigate a tab robustly (loadURL, falling back to the src attribute).
// loadURL rejects with -3 when a load is superseded — swallow that.
function navigate(tab, url) {
  tab.url = url;
  tab.retries = 0;
  try {
    const p = tab.wv.loadURL(url);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    tab.wv.setAttribute("src", url);
  }
}

function renderTabs() {
  tabbar.innerHTML = "";
  tabs.forEach((t) => {
    const tabEl = document.createElement("div");
    tabEl.className = "tab" + (t === activeTab ? " active" : "");
    const label = document.createElement("span");
    label.className = "tablabel";
    label.textContent = t.title || "Tab";
    tabEl.appendChild(label);
    const x = document.createElement("button");
    x.className = "tabclose";
    x.textContent = "×";
    x.addEventListener("click", (e) => { e.stopPropagation(); closeTab(t); });
    tabEl.appendChild(x);
    tabEl.addEventListener("click", () => setActiveTab(t));
    tabbar.appendChild(tabEl);
  });
  const add = document.createElement("button");
  add.className = "tabadd";
  add.textContent = "+";
  add.title = COPY.chrome.newTab;
  // New user tab: no fixed title, so it reflects the real page (and updates as
  // they navigate) instead of always reading "Home".
  add.addEventListener("click", () => openTab(quickUrl("home")));
  tabbar.appendChild(add);
}

function setActiveTab(tab) {
  activeTab = tab;
  tabs.forEach((t) => { t.wv.style.display = t === tab ? "flex" : "none"; });
  applyBuildOverlay(); // cover the Home tab if it's still designing
  renderTabs();
  syncNav();
  setFeedbackMode(false); // don't carry feedback mode across tab switches
  // The toggle only makes sense on a DESIGN preview: pointed-at feedback routes to a
  // design edit, and on the Site tab the same element is a block + content the
  // router doesn't reach yet. Hidden there until feedback can target content.
  feedbackBtn.hidden = !tab || !!tab.site;
}

// Show the progress cover only when the Home tab is active AND still designing;
// the half-written home webview stays display:none behind it.
function applyBuildOverlay() {
  const cover = !!(homeBuilding && homeTab && activeTab === homeTab);
  buildoverlay.hidden = !cover;
  if (cover) homeTab.wv.style.display = "none";
}

// ---- Point & comment: element feedback from the preview → chat ----------------
let feedbackOn = false;
function setFeedbackButton(on) {
  feedbackOn = !!on;
  feedbackBtn.classList.toggle("active", feedbackOn);
  feedbackLabel.textContent = feedbackOn ? COPY.feedback.pointing : COPY.feedback.label;
}
function setFeedbackMode(on) {
  if (activeTab && activeTab.wv) {
    try { activeTab.wv.send("feedback:toggle", !!on); } catch { /* webview not ready */ }
  }
  setFeedbackButton(on);
}
// A one-line routing hint keyed off what was pointed at (ctx.scope from the
// inspector), so a scoped element tweak edits directly instead of loading the whole
// /design skill, while a section-level target can still escalate. It's a default the
// model may override from the note (e.g. a note that asks for a layout rework). No
// em-dashes: this text is read by a person in the chat.
function feedbackRouting(scope) {
  if (scope === "section") {
    return "Scope: section. Edit in the working variation's components (never the base). If this is styling or content, edit the file directly; use /design only if it needs structural, layout, or responsive rules.";
  }
  return "Scope: single element. Make this as a localized edit in the working variation's components (never the base): find the node and Read, then Edit, its file. Do not run /design unless my note asks for a brand-new section, a layout or responsive rework, or changes spanning multiple sections.";
}
function handleFeedbackSubmit(ctx) {
  if (!ctx || !ctx.note) return;
  setFeedbackMode(false);   // exit pointing mode
  setChatCollapsed(false);  // make sure the chat pane is open to receive the note
  dismissWelcome();
  const lines = ["Design feedback, pointed at an element in the live preview:", ""];
  if (ctx.dataBlockName || ctx.dataBlock) {
    lines.push(`- Section: ${ctx.dataBlockName || ctx.dataBlock}${ctx.dataBlock ? ` (data-block="${ctx.dataBlock}")` : ""}`);
  }
  lines.push(`- Element: <${ctx.tag}>${ctx.classes ? ` class="${ctx.classes}"` : ""}`);
  if (ctx.text) lines.push(`- Text: "${ctx.text}"`);
  if (ctx.selector) lines.push(`- Selector: ${ctx.selector}`);
  if (ctx.variation) lines.push(`- Variation: ${ctx.variation}`);
  lines.push("", `My note: ${ctx.note}`, "", feedbackRouting(ctx.scope));

  // Send Claude the full technical context, but show a clean, human note in the chat.
  const toClaude = lines.join("\n");
  const section = ctx.dataBlockName || ctx.dataBlock;
  const text = ctx.text ? (ctx.text.length > 60 ? ctx.text.slice(0, 57) + "…" : ctx.text) : "";
  let where;
  if (section && text) where = `the ${section} section (“${text}”)`;
  else if (section) where = `the ${section} section`;
  else if (text) where = `“${text}”`;
  else where = "an element";
  const echo = `Design note, pointed at ${where}:\n${ctx.note}`;
  runAgent(toClaude, echo);
}
feedbackBtn.addEventListener("click", () => setFeedbackMode(!feedbackOn));
// Escape exits pointing even when focus is in the shell (the webview's own Esc
// handler only fires when the preview itself has keyboard focus).
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && feedbackOn) setFeedbackMode(false);
});

// Build a preview <webview> element for a tab (its src + all listeners). Extracted so
// the blank/crashed recovery (restartWebview) can rebuild a tab's webview with the
// exact same wiring, not just reload it.
function buildPreviewWebview(tab) {
  const wv = document.createElement("webview");
  wv.setAttribute("partition", "persist:preview");
  wv.setAttribute("allowpopups", "true"); // let target=_blank reach the window-open handler (→ new tab)
  if (PREVIEW_PRELOAD) wv.setAttribute("preload", PREVIEW_PRELOAD); // point & comment inspector
  wv.setAttribute("src", tab.url);
  // Messages from the inspector (point & comment) running inside the preview.
  wv.addEventListener("ipc-message", (e) => {
    if (e.channel === "feedback:submit") handleFeedbackSubmit(e.args[0]);
    else if (e.channel === "feedback:state") setFeedbackButton(!!e.args[0]);
    else if (e.channel === "reroll:request") startReroll(e.args[0]); // dashboard-card entry
  });
  // Tell the page (dashboard) whether design-variety is licensed, so a variation card can
  // show its "Try another direction" button.
  wv.addEventListener("dom-ready", async () => {
    try { const m = await getDirectionMeta(); wv.send("variety:licensed", !!(m.axes && Object.keys(m.axes).length)); }
    catch { /* webview gone */ }
  });
  wv.addEventListener("page-title-updated", (e) => {
    if (!tab.fixedTitle) { tab.title = e.title; renderTabs(); }
  });
  const onNav = () => {
    if (tab === activeTab) syncNav();
    // A pinned Home / Style guide label follows the variation the tab now shows.
    if (tab.fixedTitle && tab.navKind) { const l = navLabel(tab.navKind, currentPreviewVariation(tab.wv.getURL())); if (l !== tab.title) { tab.title = l; renderTabs(); } }
  };
  wv.addEventListener("did-navigate", onNav);
  wv.addEventListener("did-navigate-in-page", onNav);
  wv.addEventListener("did-finish-load", () => { tab.retries = 0; if (tab === activeTab) setFeedbackButton(false); });
  // Vite may still be starting (ERR_CONNECTION_REFUSED) — retry so the webview
  // can't get stuck on an error page and need a manual restart.
  wv.addEventListener("did-fail-load", (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3 = aborted (superseded)
    if (tab.retries < 15) {
      tab.retries++;
      setTimeout(() => navigate(tab, tab.url), 600);
    }
  });
  return wv;
}

function openTab(url, title) {
  const tab = { id: ++tabSeq, wv: null, title: title || "Loading…", fixedTitle: !!title, url, retries: 0 };
  tab.wv = buildPreviewWebview(tab);
  views.appendChild(tab.wv);
  tabs.push(tab);
  setActiveTab(tab);
  return tab;
}

// Restart a tab's webview PROCESS (blank/crashed recovery). Swaps in a fresh webview
// element loading the same URL — the renderer is tied to the element, so this truly
// restarts it, beyond what a reload can fix.
function restartWebview(tab) {
  if (!tab || !tab.wv) return;
  tab.retries = 0;
  const fresh = buildPreviewWebview(tab);
  const wasActive = tab === activeTab;
  fresh.style.display = wasActive ? "flex" : "none";
  tab.wv.replaceWith(fresh);
  tab.wv = fresh;
  if (wasActive) syncNav();
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i === -1) return;
  tab.wv.remove();
  tabs.splice(i, 1);
  if (activeTab === tab) setActiveTab(tabs[Math.min(i, tabs.length - 1)] || null);
  else renderTabs();
}

function closeAllTabs() {
  tabs.forEach((t) => t.wv.remove());
  tabs = [];
  activeTab = null;
  tabsOpened = false;
  guarding = false; guardSeq++; // drop any in-flight live-edit guard
  resetBuildReveal(); // drop any home-tab cover / dangling homeTab ref
  feedbackBtn.hidden = true; setFeedbackButton(false);
  renderTabs();
}

function syncNav() {
  if (!activeTab) { urlbar.value = ""; updateRerollBtn(null); return; }
  let u = activeTab.wv.getAttribute("src") || "";
  try { u = activeTab.wv.getURL() || u; } catch { /* not ready yet */ }
  urlbar.value = u;
  updateRerollBtn(u);
}

navback.addEventListener("click", () => { if (activeTab && activeTab.wv.canGoBack()) activeTab.wv.goBack(); });
navfwd.addEventListener("click", () => { if (activeTab && activeTab.wv.canGoForward()) activeTab.wv.goForward(); });
navreload.addEventListener("click", () => { if (activeTab) navigate(activeTab, activeTab.url); });

// ---- Blank-preview recovery: post-update help banner + "Refresh Browser" ----------
// Blanks can happen after a design update (a broken HMR push, a wedged/crashed
// preview renderer). After each update we surface a small banner pointing at the tab
// reload, then a "Refresh Browser" button that recovers for real.
const previewHelp = el("preview-help");
const previewRefreshBtn = el("preview-refresh");
const previewHelpX = el("preview-help-x");
// No-Claude-key reminder banner (read-only mode) — its button opens Keys & Licenses.
const nokeyBanner = el("nokey-banner");
const nokeyBannerBtn = el("nokey-banner-btn");
if (nokeyBannerBtn) nokeyBannerBtn.addEventListener("click", () => toggleModal("licenses"));
let previewHelpTimer = null;
function showPreviewHelp() {
  if (!previewHelp || browser.hidden) return; // only while a preview is actually shown
  previewHelp.hidden = false;
  clearTimeout(previewHelpTimer);
  previewHelpTimer = setTimeout(hidePreviewHelp, 15000); // auto-dismiss
}
function hidePreviewHelp() {
  if (!previewHelp) return;
  previewHelp.hidden = true;
  clearTimeout(previewHelpTimer);
}
// "Refresh Browser": validate the active preview, then take the lightest fix that
// works. Responsive renderer → reload the tab; crashed/wedged (no answer) → restart
// the webview process, since reload alone can't recover a dead renderer.
async function refreshBrowser() {
  const tab = activeTab;
  if (!tab || !tab.wv) return;
  hidePreviewHelp();
  let responsive = false;
  try {
    if (!(tab.wv.isCrashed && tab.wv.isCrashed())) {
      // A live renderer answers executeJavaScript; a wedged/crashed one throws or hangs.
      await Promise.race([
        tab.wv.executeJavaScript("1"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
      ]);
      responsive = true;
    }
  } catch { responsive = false; }
  if (responsive) navigate(tab, tab.url); // reload — clears a stale/broken HMR blank
  else restartWebview(tab);               // renderer gone — rebuild the webview process
}
if (previewRefreshBtn) previewRefreshBtn.addEventListener("click", refreshBrowser);
if (previewHelpX) previewHelpX.addEventListener("click", hidePreviewHelp);
urlbar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !activeTab) return;
  const u = resolveUrl(urlbar.value);
  // A typed URL should show the real page title, even if this tab was pinned to a
  // nav label (Home/Style guide/Dashboard) by a quick-link earlier.
  if (u) { activeTab.fixedTitle = false; navigate(activeTab, u); }
});
const NAV_LABEL = { home: COPY.nav.home, styleguide: COPY.nav.styleguide, dashboard: COPY.nav.dashboard };
// A pinned quick-link label carries the variation it shows ("Home · v02"), so the tab
// says which design it is; refreshed on navigation (see onNav) when the tab moves.
function navLabel(kind, v) { const l = NAV_LABEL[kind]; return v && kind !== "dashboard" ? COPY.nav.withVariation(l, v) : l; }
document.querySelectorAll(".qlink").forEach((b) =>
  b.addEventListener("click", () => {
    if (!viteUrl) return;
    const kind = b.dataset.nav;
    const url = quickUrl(kind);
    const label = navLabel(kind, currentPreviewVariation(url));
    if (activeTab) {
      navigate(activeTab, url);
      // Pin the tab label to the destination so the title reflects where we
      // navigated. Without this the startup Home/Style-guide tabs (fixed-title)
      // keep their original label forever when moved via the quick-links.
      if (label) { activeTab.title = label; activeTab.fixedTitle = true; activeTab.navKind = kind; renderTabs(); }
    } else {
      const t = openTab(url, label); if (t) t.navKind = kind;
    }
  })
);
// A preview page's target=_blank / window.open (e.g. dashboard "View Design ↗")
// → open it as a new tab in this browser.
window.desktop.onPreviewOpenUrl((url) => {
  // A preview button can run an app command via window.open("tacmd:/command"), e.g. the
  // dashboard "Brand This Project" button (tacmd:/setup-project). Run it in the chat
  // instead of opening a tab. Restricted to slash-commands so a page can't run arbitrary text.
  // Company Setup (P3): the dashboard "Brand This Project" button opens the in-pane
  // company form instead of running a chat command.
  if (url === "tacmd:brand-company") { renderCompanyForm(); return; }
  const m = typeof url === "string" && url.match(/^tacmd:(\/[\w-]+.*)$/);
  if (m) { sendText(m[1]); return; }
  openTab(url);
});

// Rotating status shown in the preview while the agent works and the browser
// is still closed (during setup).
// Generic rotation shown between live-activity updates. Timer-based, NOT tied to
// real progress — so keep every line progress-neutral (no "almost there" / "just
// a moment" that would over-promise while setup is still going).
const WORKING_MESSAGES = COPY.preview.workingMessages;
function startWorking(messages = WORKING_MESSAGES) {
  if (workingTimer) return;
  let i = 0;
  phText.textContent = messages[0];
  workingTimer = setInterval(() => {
    i = (i + 1) % messages.length;
    phText.textContent = messages[i];
  }, 4200);
}
function stopWorking() {
  if (workingTimer) { clearInterval(workingTimer); workingTimer = null; }
}

// Plain-language description of the agent's current activity for the preview
// placeholder during setup — derived from the tool + the file/command it's
// touching, so it says WHAT is happening with no technical detail. Returns null
// for anything without a friendly phrase (leaves the current message as-is).
function friendlyActivity(name, target) {
  const t = (target || "").toLowerCase();
  if (name === "Bash") {
    if (/mkdir\b[^|]*variations|cp\b[^|]*variations|variations\/v\d/.test(t)) return "We're setting up your design workspace…";
    if (/npm (run )?dev\b|vite\b/.test(t)) return "We're spinning up your live preview…";
    if (/npm (ci|install|i)\b/.test(t)) return "We're getting a few things ready…";
    if (/curl\b/.test(t)) return "We're taking a look at what you shared…";
    return null;
  }
  if (name === "Write" || name === "Edit" || name === "MultiEdit") {
    if (/(^|\/)\.env$/.test(t)) return "We're getting your brand set up…";
    if (t.includes("variation.json")) return "We're setting up your design workspace…";
    if (t.includes("brand.ts")) return "We're bringing your colors to life…";
    if (t.includes("fonts.css")) return "We're getting your fonts in place…";
    if (t.includes("tokens.css")) return "We're setting your colors and type…";
    if (t.includes("middleware.js") || t.includes("/brand/")) return "We're setting up your sign-in screen…";
    if (t.includes("/components/") || t.endsWith("home.tsx")) return "We're laying out your page…";
    if (t.includes("styleguide")) return "We're building your style guide…";
    return null;
  }
  if (name === "WebFetch") return "We're taking a look at what you shared…";
  return null;
}

// Show a live activity in the preview placeholder during setup. Once a real
// activity is shown it takes over from the generic rotation and persists until
// the next one (no jarring switch back to "Hang tight…").
function setWorkingMessage(text) {
  if (!text) return;
  if (workingTimer) { clearInterval(workingTimer); workingTimer = null; }
  phText.textContent = text;
}

function showPlaceholder({ emoji, title, text }) {
  stopWorking();
  setPhEmoji(emoji);
  phTitle.textContent = title;
  phText.textContent = text;
  phProgress.hidden = true;
  browser.hidden = true;
  previewph.hidden = false;
}

function showWorking() {
  browser.hidden = true;
  previewph.hidden = false;
  setPhEmoji("✨");
  phTitle.textContent = COPY.preview.gettingSetUp;
  phProgress.hidden = false;
  startWorking();
}

// ---- Live-edit guard ---------------------------------------------------------
// Cover the OPEN live preview while the agent edits design files, so half-written
// components / missing imports / Vite error overlays never flash at the designer.
// No-op during setup (the browser isn't open yet — that path already shows the
// working placeholder). Idempotent: repeated edit tools in a turn just refresh
// the narration.
function guardPreviewForEdit(activityText) {
  if (!tabsOpened) return; // preview not open yet — setup already guards this
  if (!guarding) { guarding = true; guardSeq++; }
  browser.hidden = true;
  previewph.hidden = false;
  setPhEmoji("✨");
  phTitle.textContent = COPY.preview.updatingDesign;
  phProgress.hidden = false;
  stopWorking();
  phText.textContent = activityText || "We're applying your changes…";
}

// Reveal the preview once the edit turn is done AND the design compiles cleanly.
// Polls the webview for Vite's <vite-error-overlay> (the definitive "broken right
// now" signal). If already clean, un-hide instantly — HMR has rendered the final
// design behind the overlay, so there's no flash. If still erroring, force one
// reload to clear a wedged overlay, then reveal when clean or after a bound.
async function revealPreviewAfterEdit() {
  const myGen = guardSeq;
  const deadline = Date.now() + 8000;
  let reloaded = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 350));
    if (guardSeq !== myGen) return; // a newer edit turn took over — abandon this reveal
    if (!activeTab) break;
    let broken;
    try { broken = await activeTab.wv.executeJavaScript("!!document.querySelector('vite-error-overlay')"); }
    catch { continue; } // mid-load / not ready — keep waiting
    if (!broken) break; // compiled clean
    if (!reloaded) { reloaded = true; tabs.forEach((t) => navigate(t, t.url)); } // clear a wedged overlay once
  }
  if (guardSeq !== myGen) return;
  // Force one reload of EVERY tab before revealing. Vite's HMR doesn't hot-apply CSS-variable
  // edits (a --ta-font-* / --ta-* swap, a new Google-Fonts @import), and it never refreshes a
  // non-active tab like the Styleguide — so without this a token change shows only after a
  // manual refresh. It runs behind the guard placeholder, so there's no flash, just the fresh
  // result. (Skip the extra reload if the wedged-overlay path above already reloaded.)
  if (activeTab && !reloaded) {
    tabs.forEach((t) => navigate(t, t.url));
    await new Promise((res) => onceWebviewLoaded(activeTab.wv, res));
    if (guardSeq !== myGen) return;
    await new Promise((r) => setTimeout(r, 120)); // brief settle so the reloaded paint is in
  }
  guarding = false;
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  showPreviewHelp(); // updated preview shown → offer the blank-recovery help
  updateRerollBtn(); // edit turn settled → re-evaluate the reroll button
  applyAdFocus(); // an Art Director action → land on the design, at the target
}

// ---- Progressive build reveal (styleguide live, home still designing) --------
// While the design is being built, poll for the previewReady flip (which
// apply-brand writes as soon as the styleguide tokens land). On the flip, reveal
// the Style guide tab LIVE and open the Home tab under a progress cover; the turn
// end (finishBuildReveal) uncovers the finished home.
const BUILD_MESSAGES = COPY.preview.buildMessages;
function startBuildRotation() {
  stopBuildRotation();
  let i = 0;
  boText.textContent = BUILD_MESSAGES[0];
  buildMsgTimer = setInterval(() => { i = (i + 1) % BUILD_MESSAGES.length; boText.textContent = BUILD_MESSAGES[i]; }, 4200);
}
function stopBuildRotation() { if (buildMsgTimer) { clearInterval(buildMsgTimer); buildMsgTimer = null; } }
function setBuildMessage(text) { if (text) { stopBuildRotation(); boText.textContent = text; } }

function resetBuildReveal() {
  stopBuildRotation();
  homeBuilding = false;
  homeTab = null;
  buildoverlay.hidden = true;
}

// The previewReady flip landed mid-build: reveal the Style guide live, park the
// Home tab under the progress cover. Driven by the existing mid-turn readiness
// poll in the "tool" event handler (no separate timer).
function revealDuringBuild() {
  if (tabsOpened || !viteUrl) return;
  tabsOpened = true;
  setTimeout(syncSiteTabOnOpen, 0);
  homeBuilding = true;
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  const style = openTab(quickUrl("styleguide", design.variationId), navLabel("styleguide", design.variationId)); if (style) style.navKind = "styleguide";
  homeTab = openTab(quickUrl("home", design.variationId), navLabel("home", design.variationId)); if (homeTab) homeTab.navKind = "home";
  setActiveTab(style); // land on the ready brand guidelines
  startBuildRotation();
}

// Turn ended: the home design is complete — drop the cover and load the result.
function finishBuildReveal() {
  homeBuilding = false;
  stopBuildRotation();
  buildoverlay.hidden = true;
  if (homeTab) {
    navigate(homeTab, quickUrl("home", design.variationId)); // reload to the finished design
    homeTab.wv.style.display = activeTab === homeTab ? "flex" : "none";
  }
  applyBuildOverlay();
  showPreviewHelp(); // finished design shown → offer the blank-recovery help
  healBuildPreview(); // auto-clear a blank/premature first paint (fire-and-forget)
  // The build (esp. Get Designing) captures the client/project name into .env, but
  // the chat-bar title was set at project-open BEFORE that existed. Refresh it now
  // from the updated project meta so the bar shows the real name once built.
  window.desktop.getProjectStatus().then((p) => { if (p) setProjTitle(p); }).catch(() => {});
  // The build session is now heavy (full build history + any diagnose screenshots).
  // The next turn is an edit → start it fresh + lean instead of resuming all that.
  leanEditPending = true;
  updateRerollBtn(); // initial build done → the reroll button may now appear
  maybeAutoA11yReview(); // auto-run the accessibility review if that setting is on
}

// Quiet build (Get Designing) finished: nothing showed during the build, so now reveal the
// completed design — both tabs, landing on the Home page — and open the chat for iteration.
async function finishQuietBuild() {
  quietBuildActive = false;
  await buildNarration.finish(); // fill through the last step + a brief "done" beat, then clear
  try { design = await window.desktop.getDesignState(); } catch {}
  designJustActivated = true;
  await showBrowser("home");   // probes the preview, opens Style guide + Home, lands on Home
  setChatCollapsed(false);     // open the chat now, for iteration
  showPreviewHelp();
  healBuildPreview();          // clear any blank/premature first paint
  // Get Designing captured the client/project name into .env after the bar title was set;
  // refresh it now so the bar shows the real name.
  window.desktop.getProjectStatus().then((p) => { if (p) setProjTitle(p); }).catch(() => {});
  leanEditPending = true;      // next turn is an edit → fresh, lean session
  updateRerollBtn();
  maybeAutoA11yReview();       // auto-run the accessibility review if that setting is on
}

// A large fresh design can PAINT a beat before Vite finishes compiling it, so the
// first reveal sometimes shows a blank (empty #root) or error-overlay'd tab. Auto-
// heal ONCE, a short settle after the reveal: reload any build tab that reads blank
// or broken (or is unresponsive), so the designer's first result never LOOKS broken.
// Healthy tabs (root already populated) are left alone — no reload, no flash. The
// manual "Refresh Browser" button stays as the backstop.
async function healBuildPreview() {
  await new Promise((r) => setTimeout(r, 1600));
  for (const t of tabs.slice()) {
    if (!t || !t.wv) continue;
    let broken = false;
    try {
      broken = await Promise.race([
        t.wv.executeJavaScript(
          "!!document.querySelector('vite-error-overlay') || " +
          "!((document.getElementById('root') || {}).childElementCount)"
        ),
        new Promise((res) => setTimeout(() => res(true), 2500)), // unresponsive → treat as broken
      ]);
    } catch { broken = true; }
    if (broken) navigate(t, t.url); // one reload clears a stale/blank HMR paint
  }
}

async function showBrowser(landOn) {
  if (!viteUrl || tabsOpened) return;
  tabsOpened = true; // claim immediately so re-entrant calls don't double-open
  setTimeout(syncSiteTabOnOpen, 0);
  // Keep the "Working…" placeholder up until the server actually SERVES the
  // styleguide (200). Vite may be up but still compiling the just-created
  // variation, so opening now would flash blank tabs. Bounded (~10s) — the
  // webview's own connection-refused retry is the backstop.
  const styleUrl = quickUrl("styleguide", design.variationId);
  for (let i = 0; i < 20; i++) {
    const { ok } = await window.desktop.probePreview(styleUrl);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  const style = openTab(styleUrl, navLabel("styleguide", design.variationId)); if (style) style.navKind = "styleguide";
  const home = openTab(quickUrl("home", design.variationId), navLabel("home", design.variationId)); if (home) home.navKind = "home";
  // Default to the styleguide (swatches); the quiet-build finished reveal lands on Home (the design).
  setActiveTab(landOn === "home" ? home : style);
  ensureSiteTab(); // a promoted project also gets its Site tab (stays in the background)
  // Only when the styleguide was just created this session: reload once so its
  // fresh swatches show without a manual refresh (avoids churn on reopen).
  if (designJustActivated) {
    designJustActivated = false;
    setTimeout(() => { if (tabs.includes(style)) navigate(style, quickUrl("styleguide", design.variationId)); }, 1200);
  }
}

// The "Site" tab: the public website's live preview (its own Astro server), shown
// next to Home + Style guide once the design has been promoted. Idempotent: opens
// the tab if the site server is up and no Site tab exists yet; never steals focus.
function ensureSiteTab(url) {
  url = url || (siteUrl ? siteUrl + "/" : null);
  if (!url || !tabsOpened) return;
  if (tabs.some((t) => t.site)) return;
  const keep = activeTab;
  const tab = openTab(url, COPY.preview.siteTab);
  tab.site = true;
  if (keep && tabs.includes(keep)) setActiveTab(keep);
}
window.desktop.onSiteReady((url) => {
  siteUrl = url;
  if (currentStage !== "workspace") return;
  const existing = tabs.find((t) => t.site);
  if (existing) navigate(existing, url + "/"); // restarted on a new port → follow it
  else ensureSiteTab();
});
// Site builder switched off (or opened off): the Site tab shows a note, not the site.
function siteOffPage() {
  const P = COPY.preview;
  const html = `<!doctype html><meta charset="utf-8"><title>${P.siteTab}</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#555;background:#fafafb;text-align:center}div{max-width:420px;padding:24px}h1{font-size:15px;font-weight:600;color:#17171b;margin:0 0 6px}p{margin:0}</style><div><h1>${P.siteOffTitle}</h1><p>${P.siteOffBody}</p></div>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}
function showSiteOff() {
  siteUrl = null;
  const existing = tabs.find((t) => t.site);
  if (existing) navigate(existing, siteOffPage());
  else ensureSiteTab(siteOffPage());
}
window.desktop.onSiteOff(() => { if (currentStage === "workspace") showSiteOff(); });
// The "off" signal on project open can land before the workspace tabs exist (the
// "ready" one arrives seconds later, after Astro starts); ask once the tabs are up.
async function syncSiteTabOnOpen() {
  try { const st = await window.desktop.getSiteStatus(); if (st && st.ready && st.enabled === false && !st.url) showSiteOff(); } catch {}
}

function refreshPreview() {
  // The intake host owns the pane while an onboarding conversation is live — don't
  // let a working/placeholder refresh stomp it.
  if (intakeActive) return;
  // Open the live browser only when the design's styleguide is READY (palette
  // written — not just the variation folder created) AND the server is up.
  if (design.previewReady && viteUrl) return showBrowser();
  // Otherwise the browser stays closed.
  if (agentBusy) return showWorking();
  if (!viteUrl) {
    return showPlaceholder(COPY.preview.spinningUp);
  }
  // Idle, preview not open yet. Only greet on a TRULY fresh start — once the
  // conversation has begun or a design exists, setup is underway, so show a
  // gentle "in progress" line instead of re-welcoming.
  if (conversationStarted || design.active) {
    return showPlaceholder(COPY.preview.settingUp);
  }
  showPlaceholder(COPY.preview.pickStart);
}

// ---- Stage routing -----------------------------------------------------------
// Soft show/hide for a big-pane onboarding gate (key / project): unhide → fade the
// backdrop in + rise the card; on hide, fade out then set hidden. A pending hide is
// cancelled if the same gate is re-shown before it lands.
const gateHideTimers = new WeakMap();
function toggleGate(gateEl, on) {
  if (!gateEl) return;
  const pending = gateHideTimers.get(gateEl);
  if (pending) { clearTimeout(pending); gateHideTimers.delete(gateEl); }
  if (on) {
    gateEl.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => gateEl.classList.add("show")));
  } else if (!gateEl.hidden) {
    gateEl.classList.remove("show");
    gateHideTimers.set(gateEl, setTimeout(() => { gateEl.hidden = true; gateHideTimers.delete(gateEl); }, 480));
  }
}

// Opening the chat pane out of the collapsed state: ease it to its minimum width
// (the drag handle can widen it afterward). Only fires when we were actually
// collapsed (never on a normal launch, where the saved width is kept).
let chatWasCollapsed = false;
// No Claude key → read-only mode: you can open + browse established projects, but the chat
// pane is hidden and every agent-driven action (create project, chat, reroll, Art Director
// review/apply, Figma export) is blocked. Adding a key in Keys & Licenses re-enables them.
let appHasKey = false;
function settleChatWidthToMin() {
  const chatPanel = el("chat");
  if (!chatPanel) return;
  chatPanel.classList.add("chat-opening"); // clip content only during the open animation
  chatPanel.style.width = "400px";
  try { localStorage.setItem("chatWidth", "400"); } catch {}
  setTimeout(() => chatPanel.classList.remove("chat-opening"), 620);
}

// Slide the chat pane closed (0 width) or open (eased to its minimum). Used across
// the onboarding flow: closed for the key screen, the project fork, and the
// Get-Designing questions; open for Client Setup, once a design starts, and the
// normal workspace. Idempotent, so callers can fire it freely.
function setChatCollapsed(collapsed) {
  const app = el("app");
  if (!app) return;
  if (collapsed) {
    app.classList.add("chat-collapsed");
    chatWasCollapsed = true;
  } else {
    app.classList.remove("chat-collapsed");
    if (chatWasCollapsed) { chatWasCollapsed = false; settleChatWidthToMin(); }
  }
}

// Resolve a dotted path (e.g. "rail.help", "preview.buildMessages.0") against COPY.
function C(path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), COPY);
}

// Populate every static-markup string from the copy catalog. Elements carry the
// copy KEY (data-copy / -html / -tip / -aria / -title / -ph), so wording lives
// only in copy.js. Runs once before the first stage renders; runtime code may
// overwrite individual nodes afterward (rotating placeholders, per-context titles).
let staticCopyApplied = false;
function applyStaticCopy() {
  if (staticCopyApplied) return;
  staticCopyApplied = true;
  const set = (sel, ds, fn) => document.querySelectorAll(sel).forEach((e) => {
    const v = C(e.dataset[ds]);
    if (v != null) fn(e, v);
  });
  set("[data-copy]", "copy", (e, v) => { e.textContent = v; });
  set("[data-copy-html]", "copyHtml", (e, v) => { e.innerHTML = v; });
  set("[data-copy-tip]", "copyTip", (e, v) => e.setAttribute("data-tip", v));
  set("[data-copy-aria]", "copyAria", (e, v) => e.setAttribute("aria-label", v));
  set("[data-copy-title]", "copyTitle", (e, v) => e.setAttribute("title", v));
  set("[data-copy-ph]", "copyPh", (e, v) => e.setAttribute("placeholder", v));
}

let currentStage = null;
function showStage(stage) {
  applyStaticCopy();
  currentStage = stage;
  const app = el("app");
  // Read-only workspace: a project is open but there's no key → no chat, no agent actions.
  const noKeyWorkspace = stage === "workspace" && !appHasKey;
  // The no-key reminder banner rides the preview browser whenever we're read-only.
  if (nokeyBanner) nokeyBanner.hidden = !noKeyWorkspace;
  app.classList.toggle("onboarding-key", stage === "key"); // rail muting during the key screen
  app.classList.toggle("no-key", noKeyWorkspace); // CSS hook to disable agent-driven affordances
  // Collapse the chat column (preview goes full-width) at the key screen and in read-only mode.
  setChatCollapsed(stage === "key" || noKeyWorkspace);
  // The rail is inert until the key is connected (no focus/keyboard either).
  const sidebar = el("sidebar");
  if (sidebar) sidebar.inert = stage === "key";
  toggleGate(keygate, stage === "key");
  toggleGate(projectgate, stage === "project");
  // Chat content is ready from the project stage on (empty & waiting); the key stage and
  // read-only (no-key) workspace hide it, and there the whole pane is collapsed anyway.
  chatmain.hidden = stage === "key" || noKeyWorkspace;
  // Workspace label left BLANK on purpose — the #status slot is reserved for a
  // future app-level message/alert (update, license, activity). The connect /
  // no-project states keep their labels since those screens rely on them.
  status.textContent =
    stage === "key" ? COPY.status.notConnected : stage === "project" ? COPY.status.noProject : "";
  // Enable pane transitions only after the first stage paints, so the initial
  // collapsed/open state doesn't animate on launch.
  if (app.classList.contains("preload")) {
    requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove("preload")));
  }
  if (stage === "key") setTimeout(() => { try { keyinput.focus(); } catch {} }, 120);
  if (stage === "workspace") input.focus();
}

function noProjectPlaceholder() {
  viteUrl = null;
  siteUrl = null;
  design = { active: false, variationId: null, previewReady: false };
  agentBusy = false;
  conversationStarted = false; // a new/blank project greets fresh again
  resetIntake();
  closeAllTabs();
  showPlaceholder(COPY.preview.noProject);
}

// The Claude + Figma rail icons show their brand colors only once their key /
// license is active; otherwise they stay monochrome white like the rest of the
// rail. Toggled via the .activated class.
async function refreshRailActivation() {
  try {
    const [k, l, dl, vc] = await Promise.all([
      window.desktop.getKeyStatus(),
      window.desktop.getLicenseStatus(),
      window.desktop.getDesignLicenseStatus(),
      window.desktop.getVercelStatus(),
    ]);
    railClaude.classList.toggle("activated", !!(k && k.hasKey));
    railFigma.classList.toggle("activated", !!(l && l.hasLicense));
    railPublish.classList.toggle("activated", !!(vc && vc.connected));
    // All three credentials present → the app is unlocked: open the padlock.
    const unlocked = !!(k && k.hasKey) && !!(l && l.hasLicense) && !!(dl && dl.hasLicense);
    if (railLicenses) {
      railLicenses.innerHTML = unlocked ? OPEN_LOCK_SVG : CLOSED_LOCK_SVG;
      railLicenses.classList.toggle("activated", unlocked);
    }
  } catch {}
}
const CLOSED_LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
const OPEN_LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 7.9-1.2"/></svg>';

async function boot() {
  refreshRailActivation(); // color the Claude/Figma icons per key + license state
  const { hasKey } = await window.desktop.getKeyStatus();
  appHasKey = hasKey;
  const proj = await window.desktop.getProjectStatus();
  // No key AND no project → nothing to browse and can't create one → the connect screen.
  if (!hasKey && !proj.hasProject) {
    noProjectPlaceholder();
    showStage("key");
    return;
  }
  // Has a key but no project → pick/create one.
  if (!proj.hasProject) {
    noProjectPlaceholder();
    showStage("project");
    return;
  }
  // A project exists → open it. Without a key this is READ-ONLY (showStage hides the chat
  // pane; agent actions are disabled), but the designer can still view + switch projects.
  setProjTitle(proj);
  viteUrl = proj.viteUrl || null;
  siteUrl = proj.siteUrl || null;
  design = proj.design || { active: false, variationId: null, previewReady: false };
  showStage("workspace");
  refreshPreview();
  // The chat-driven start (resume session / two starting paths) needs the agent → key only.
  if (hasKey && !(await maybeAutoRestoreSession())) renderStartChoices();
}

// Vite may become ready after the project is chosen — or re-ready after a
// self-heal restart. Reload any open preview tabs onto the fresh server so they
// don't sit on stale/broken content; otherwise re-evaluate whether to open.
window.desktop.onViteReady((url) => {
  const prev = viteUrl;
  viteUrl = url;
  // Only touch the preview once we're in the workspace (a project is open). This is true
  // in read-only mode too (no key) — the preview must still open so projects are viewable;
  // it's chatmain.hidden that used to (wrongly) block that. Skip on the key/project gates.
  if (currentStage !== "workspace") return;
  if (tabs.length && prev) {
    tabs.forEach((t) => {
      if (t.site) return; // the Site tab points at the Astro server, not Vite
      const fresh = /https?:\/\/localhost:\d+/.test(t.url || "")
        ? t.url.replace(/https?:\/\/localhost:\d+/, url)
        : (t.url || url);
      navigate(t, fresh);
    });
  } else {
    refreshPreview();
  }
});

// ---- Key gate ----------------------------------------------------------------
async function saveKey() {
  keyerror.textContent = "";
  const key = keyinput.value.trim();
  if (!key) {
    keyerror.textContent = COPY.keygate.pasteFirst;
    return;
  }
  keysave.disabled = true;
  keysave.textContent = COPY.keygate.checking;
  try {
    const res = await window.desktop.saveKey(key);
    if (res.ok) {
      keyinput.value = "";
      await boot();
    } else {
      keyerror.textContent = res.error || COPY.keygate.couldNotSave;
    }
  } catch (e) {
    keyerror.textContent = String(e);
  } finally {
    keysave.disabled = false;
    keysave.textContent = COPY.keygate.save;
  }
}
keysave.addEventListener("click", saveKey);
keyinput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveKey();
  }
});

// ---- Project gate ------------------------------------------------------------
async function chooseProject(kind) {
  projecterror.textContent = "";
  createproject.disabled = openproject.disabled = true;
  const busyBtn = kind === "create" ? createproject : openproject;
  const label = busyBtn.textContent;
  busyBtn.textContent = kind === "create" ? COPY.project.creating : COPY.project.opening;
  try {
    const res =
      kind === "create"
        ? await window.desktop.createProject()
        : await window.desktop.openProject();
    if (res.canceled) return;
    if (res.ok) {
      closeAllTabs(); // fresh browser tabs for the new project
      setProjTitle(res);
      viteUrl = res.viteUrl || null;
  siteUrl = res.siteUrl || null;
      design = await window.desktop.getDesignState();
      showStage("workspace");
      refreshPreview();
      // Optionally resume the last session; otherwise offer the two starting paths.
      if (!(await maybeAutoRestoreSession())) renderStartChoices();
    } else {
      projecterror.textContent = res.error || COPY.project.couldNotOpen;
    }
  } catch (e) {
    projecterror.textContent = String(e);
  } finally {
    createproject.disabled = openproject.disabled = false;
    busyBtn.textContent = label;
  }
}
createproject.addEventListener("click", () => chooseProject("create"));
openproject.addEventListener("click", () => chooseProject("open"));

// ---- Sidebar panels ----------------------------------------------------------
const RAILS = { help: railHelp, projects: railProjects, site: railSite, publish: railPublish, company: railCompany, figma: railFigma, voice: railVoice, claude: railClaude, director: railDirector, a11y: railA11y, licenses: railLicenses };
const PANELS = {
  help: { title: COPY.panels.help, render: renderHelp },
  projects: { title: COPY.panels.projects, render: renderProjects },
  site: { title: COPY.panels.site, render: renderSite, wide: true },
  publish: { title: COPY.panels.publish, render: renderPublish },
  company: { title: COPY.panels.company, render: renderCompany },
  figma: { title: COPY.panels.figma, render: renderFigma },
  voice: { title: COPY.panels.voice, render: renderVoice },
  claude: { title: COPY.panels.claude, render: renderClaude },
  director: { title: COPY.panels.director, render: renderDirector },
  a11y: { title: COPY.panels.a11y, render: renderA11y },
  licenses: { title: COPY.panels.licenses, render: renderLicenses },
};

function closeModal() {
  Object.values(RAILS).forEach((b) => b.classList.remove("active"));
  if (modal.hidden) return;
  modal.classList.remove("open"); // slide out
  // Hide after the slide-out finishes — unless it was reopened in the meantime.
  setTimeout(() => { if (!modal.classList.contains("open")) modal.hidden = true; }, 240);
}
async function openModal(kind) {
  // A drawer opening ends an on-page review walk (Art Director / Accessibility bar).
  if (adReview) exitAdReview();
  if (typeof a11yReview !== "undefined" && a11yReview) exitA11yReview();
  const { title, render, wide } = PANELS[kind];
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  // Wide panels (the CMS) take most of the window; the rest keep the narrow drawer.
  // The width switches before the slide so a fresh open animates at its final size.
  el("modal-card").classList.toggle("wide", !!wide);
  el("modal-card").dataset.panel = kind; // lets CSS style a panel's controls (the CMS switches)
  Object.values(RAILS).forEach((b) => b.classList.remove("active"));
  RAILS[kind].classList.add("active");
  // Slide in on a fresh open (or if interrupted mid-close). When a drawer is
  // already open, switching panels just re-renders the body — no re-animation.
  if (modal.hidden || !modal.classList.contains("open")) {
    modal.hidden = false;
    void modal.offsetWidth; // commit the closed transform, then transition to open
    modal.classList.add("open");
  }
  await render(modalBody);
}
// Rail click: if this panel's drawer is already open, close it; else open/switch.
function toggleModal(kind) {
  const alreadyOpen = !modal.hidden && modal.classList.contains("open") && RAILS[kind].classList.contains("active");
  if (alreadyOpen) closeModal();
  else openModal(kind);
}

railHelp.addEventListener("click", () => toggleModal("help"));
railProjects.addEventListener("click", () => toggleModal("projects"));
railSite.addEventListener("click", () => toggleModal("site"));
railPublish.addEventListener("click", () => toggleModal("publish"));
railCompany.addEventListener("click", () => toggleModal("company"));
railFigma.addEventListener("click", () => toggleModal("figma"));
railVoice.addEventListener("click", () => toggleModal("voice"));
railClaude.addEventListener("click", () => toggleModal("claude"));
railDirector.addEventListener("click", () => toggleModal("director"));
if (railA11y) railA11y.addEventListener("click", () => toggleModal("a11y"));
railLicenses.addEventListener("click", () => toggleModal("licenses"));

// Sidebar collapse pull-tab (the gear). Preference persists in localStorage — the
// shell is one app-wide renderer, so it's global across projects and sessions.
// The gear spins as it does its "job": hover = a half-turn (left when open, right
// when collapsed), click = the remaining half-turn in the same direction (a full
// revolution total), then the rail toggles.
const railCollapse = el("rail-collapse");
const railGear = railCollapse.querySelector("svg");
const SIDEBAR_COLLAPSED_KEY = "ta-sidebar-collapsed";
let gearBase = 0;          // committed rotation (deg)
let gearConsumed = false;  // after a click, hold position until the pointer leaves
// Hover direction: collapsed → clockwise (right); open → counter-clockwise (left).
const gearDir = () => (document.body.classList.contains("rail-collapsed") ? 180 : -180);
const setGear = (deg) => { railGear.style.transform = `rotate(${deg}deg)`; };

function applySidebarCollapsed() {
  const collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  document.body.classList.toggle("rail-collapsed", collapsed);
  const label = collapsed ? COPY.chrome.expandSidebar : COPY.chrome.collapseSidebar;
  railCollapse.title = label;
  railCollapse.setAttribute("aria-label", label);
}
railCollapse.addEventListener("mouseenter", () => { if (!gearConsumed) setGear(gearBase + gearDir()); });
railCollapse.addEventListener("mouseleave", () => { gearConsumed = false; setGear(gearBase); });
// Staggered icon animation on collapse/expand. Quick, not alarming (~0.5s total).
const RAIL_ANIM_MS = 500; // last icon: 5*45ms stagger + 250ms transition
let railAnimTimer = null;
function railLabel() {
  const label = document.body.classList.contains("rail-collapsed") ? COPY.chrome.expandSidebar : COPY.chrome.collapseSidebar;
  railCollapse.title = label;
  railCollapse.setAttribute("aria-label", label);
}
railCollapse.addEventListener("click", () => {
  gearBase += gearDir() * 2;   // complete a full turn in the hover direction
  gearConsumed = true;         // don't re-apply the hover offset until the pointer leaves
  setGear(gearBase);
  const willCollapse = !document.body.classList.contains("rail-collapsed");
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, willCollapse ? "1" : "0");
  clearTimeout(railAnimTimer);
  document.body.classList.remove("rail-anim-in", "rail-anim-out", "rail-anim-prep");
  if (willCollapse) {
    // Collapse the rail (narrow + hide) AND drift the icons out to the left in
    // PARALLEL — same timing as open. The icons stay rendered during the out
    // transition (CSS override) even though rail-collapsed is already applied.
    void document.body.offsetWidth; // start the transition cleanly
    document.body.classList.add("rail-collapsed", "rail-anim-out");
    railLabel();
    railAnimTimer = setTimeout(() => document.body.classList.remove("rail-anim-out"), RAIL_ANIM_MS);
  } else {
    // Expand, park the icons off to the left + invisible instantly, then let them
    // settle to their resting (muted) opacity, staggered — no overshoot to full.
    document.body.classList.remove("rail-collapsed");
    railLabel();
    document.body.classList.add("rail-anim-prep");
    void document.body.offsetWidth; // commit the parked state before releasing it
    document.body.classList.remove("rail-anim-prep");
    document.body.classList.add("rail-anim-in");
    railAnimTimer = setTimeout(() => document.body.classList.remove("rail-anim-in"), RAIL_ANIM_MS);
  }
});
applySidebarCollapsed(); // restore the remembered state on load
modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// --- Help: the project's commands ---
const COMMANDS = COPY.commands.list;

// The composer's "Commands ▾" popover — same list as the Help drawer, one click
// away above the input. Each item runs its command exactly like typing it.
function buildCommandMenu() {
  COMMANDS.forEach(([cmd, desc]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmdmenu-item";
    const c = document.createElement("div");
    c.className = "cmd";
    c.textContent = cmd;
    const d = document.createElement("div");
    d.className = "desc";
    d.textContent = desc;
    b.append(c, d);
    b.addEventListener("click", () => { closeCmdMenu(); sendText(cmd); });
    cmdmenu.appendChild(b);
  });
}
function openCmdMenu() { cmdmenu.hidden = false; cmdbtn.setAttribute("aria-expanded", "true"); }
function closeCmdMenu() { cmdmenu.hidden = true; cmdbtn.setAttribute("aria-expanded", "false"); }
cmdbtn.addEventListener("click", (e) => { e.stopPropagation(); cmdmenu.hidden ? openCmdMenu() : closeCmdMenu(); });
document.addEventListener("click", (e) => { if (!cmdmenu.hidden && !e.target.closest("#cmdbar")) closeCmdMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cmdmenu.hidden) closeCmdMenu(); });
buildCommandMenu();

// The About drawer: version + byline. (The command list used to live here; the
// chat pane is where commands are found now.)
async function renderHelp(body) {
  // ── Version + credit ──
  const footer = document.createElement("div");
  footer.className = "help-footer";
  const ver = document.createElement("div");
  ver.className = "help-version";
  try { ver.textContent = COPY.about.versionPrefix + (await window.desktop.getAppVersion()); } catch { ver.textContent = ""; }
  footer.appendChild(ver);

  const credit = document.createElement("div");
  credit.className = "help-credit";
  // orange (#F98F3A) heart between "made with" and the thinkany.co link
  credit.innerHTML = 'made with <svg class="heart" viewBox="0 0 24 24" fill="#F98F3A" aria-label="love"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> by ';
  const link = document.createElement("a");
  link.className = "help-link";
  link.href = "https://thinkany.co";
  link.textContent = COPY.about.siteLink;
  link.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal("https://thinkany.co"); });
  credit.appendChild(link);
  footer.appendChild(credit);
  body.appendChild(footer);
}

function setRow(k, valueText) {
  const row = document.createElement("div");
  row.className = "setrow";
  const kk = document.createElement("div");
  kk.className = "k";
  kk.textContent = k;
  const vv = document.createElement("div");
  vv.className = "v";
  vv.textContent = valueText;
  row.append(kk, vv);
  return row;
}

// Inline pulsing loading dots (same animation as the chat "thinking" indicator),
// shown while a panel waits on a network call so it doesn't read as frozen.
function loadingDots() {
  const d = document.createElement("span");
  d.className = "ta-dots";
  d.innerHTML = "<i></i><i></i><i></i>";
  return d;
}

// The unplug mark (disconnect), shared across integration drawers.
const UNPLUG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 5 3-3"/><path d="m2 22 3-3"/><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"/></svg>';

// A drawer's connection header: an uppercase `.k` title, a status badge, and (when
// connected) a collapse-on-hover unplug button on the right edge. Shared by the
// Vercel / Claude / Figma drawers so they read identically.
function connStatusRow(label, connected, badgeText, disconnectLabel, onDisconnect) {
  const row = document.createElement("div");
  row.className = "setrow";
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = label;
  row.appendChild(k);
  const line = document.createElement("div");
  line.style.cssText = "display:flex;align-items:center;gap:8px;";
  const badge = document.createElement("span");
  badge.className = "badge " + (connected ? "ok" : "off");
  badge.textContent = badgeText;
  line.appendChild(badge);
  if (connected && onDisconnect) {
    const disc = document.createElement("button");
    disc.className = "disc-collapse";
    disc.style.marginLeft = "auto";
    disc.title = disconnectLabel;
    disc.setAttribute("aria-label", disconnectLabel);
    disc.innerHTML = `<span class="lbl">${disconnectLabel}</span>${UNPLUG_SVG}`;
    disc.addEventListener("click", onDisconnect);
    line.appendChild(disc);
  }
  row.appendChild(line);
  return row;
}

// --- Switch project: current project + switch ---
async function renderProjects(body) {
  const proj = await window.desktop.getProjectStatus();
  if (!proj.hasProject) {
    body.appendChild(setRow("Project", "None open"));
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.project.emptyNote;
    body.appendChild(note);
    return;
  }
  body.appendChild(setRow("Current project", projectTitle(proj) || "None"));
  body.appendChild(setRow("Folder", proj.path || "None"));

  // ── Recent projects — one click back into a project you had open. ──
  const recents = await window.desktop.getRecentProjects();
  if (recents && recents.length) {
    const sep = document.createElement("div");
    sep.className = "drawer-sep";
    body.appendChild(sep);
    const rl = document.createElement("div");
    rl.className = "sess-label";
    rl.textContent = COPY.project.recentTitle;
    body.appendChild(rl);
    const rd = document.createElement("div");
    rd.className = "sess-desc";
    rd.textContent = COPY.project.recentDesc;
    body.appendChild(rd);

    const list = document.createElement("div");
    list.className = "sesslist";
    recents.forEach((r) => {
      const row = document.createElement("div");
      row.className = "sessrow";
      const open = document.createElement("button");
      open.className = "sessrow-open";
      open.title = r.path;

      // Client name → project name → path (folder names aren't reliable IDs).
      const primary = r.client || r.project || r.name;
      const nm = document.createElement("div");
      nm.className = "sess-title";
      nm.textContent = primary;
      open.appendChild(nm);
      if (r.client && r.project && r.project !== r.client) {
        const sub = document.createElement("div");
        sub.className = "recent-sub";
        sub.textContent = r.project;
        open.appendChild(sub);
      }
      const pth = document.createElement("div");
      pth.className = "recent-path";
      pth.textContent = r.path;
      open.appendChild(pth);

      open.addEventListener("click", () => openRecentProject(r.path));
      row.appendChild(open);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  // ── Create or switch project ──
  const csep = document.createElement("div");
  csep.className = "drawer-sep";
  body.appendChild(csep);
  const clabel = document.createElement("div");
  clabel.className = "sess-label";
  clabel.textContent = COPY.project.createSwitch;
  body.appendChild(clabel);

  const btnRow = document.createElement("div");
  btnRow.className = "projbtns";
  const createBtn = document.createElement("button");
  createBtn.className = "panelbtn primary";
  createBtn.textContent = COPY.project.createNew;
  // Creating a project runs the agent → needs a Claude key. Disabled in read-only mode.
  if (!appHasKey) { createBtn.disabled = true; createBtn.title = COPY.project.needKeyToCreate; }
  else createBtn.addEventListener("click", createNewProject);
  const switchBtn = document.createElement("button");
  switchBtn.className = "panelbtn";
  switchBtn.textContent = COPY.project.switchExisting;
  switchBtn.addEventListener("click", switchToExisting);
  btnRow.append(createBtn, switchBtn);
  body.appendChild(btnRow);
}

// Boot the workspace from a create/open/openPath result, with a clean slate for the
// incoming project. Returns true on success. Shared by all three entry points.
async function enterProjectFromResult(res) {
  if (!res || res.canceled) return false;
  if (!res.ok) { addMsg("error", res.error || COPY.project.couldNotOpen); return false; }
  sessionId = null;
  conversationStarted = false;
  resetChatUi();   // clears chat log + gauge + any live intake
  closeAllTabs();  // fresh preview tabs + reset build reveal
  setProjTitle(res);
  viteUrl = res.viteUrl || null;
  siteUrl = res.siteUrl || null;
  design = await window.desktop.getDesignState();
  showStage("workspace");
  refreshPreview();
  // Chat-driven start needs the agent → only with a key (read-only mode just shows the design).
  if (appHasKey && !(await maybeAutoRestoreSession())) renderStartChoices();
  return true;
}
async function openRecentProject(dir) {
  closeModal();
  await enterProjectFromResult(await window.desktop.openProjectPath(dir));
}
async function createNewProject() {
  if (!appHasKey) return; // read-only mode: creating a project needs a key
  closeModal();
  await enterProjectFromResult(await window.desktop.createProject());
}
async function switchToExisting() {
  closeModal();
  await enterProjectFromResult(await window.desktop.openProject());
}

// --- Company profile: the agency identity, created/edited right here + auto-applied to
// every new project. Create or Update reveals the fields (name, admin/gate fonts, logo);
// "Save profile" writes them straight to the default. An open project with a company name
// can also push its identity up as the default. When active, an unplug delete clears it. ---
// One-shot: a caller (Publish's "set up project") can ask the company drawer to jump
// straight into the create/edit profile form on open. Cleared as soon as it's honored.
let companyAutoCreate = false;

async function renderCompany(body) {
  const def = await window.desktop.getDefaultCompany(); // { has, companyName, headingFont, bodyFont, logoName }
  const proj = await window.desktop.getProjectStatus();

  // Header (Licenses-style): title + Active/Not-set badge + an unplug delete when active.
  body.appendChild(connStatusRow(
    COPY.company.defaultTitle,
    def.has,
    def.has ? (def.companyName ? COPY.company.activeWith(def.companyName) : COPY.common.active) : COPY.common.notSet,
    def.has ? COPY.company.clearDefault : null,
    def.has ? async () => { await window.desktop.clearDefaultCompany(); openModal("company"); } : null,
  ));
  const defNote = document.createElement("div");
  defNote.className = "muted";
  defNote.textContent = COPY.company.defaultNote;
  body.appendChild(defNote);

  // The fields form (name / heading font / body font / logo), hidden until Create/Update.
  const formWrap = document.createElement("div");
  formWrap.className = "company-form"; // column + 14px gap (matches the intake card spacing)
  formWrap.hidden = true;

  // Create (no profile yet) or Update (profile exists) → reveal the prefilled fields.
  const editBtn = document.createElement("button");
  editBtn.className = "panelbtn" + (def.has ? "" : " primary");
  editBtn.textContent = def.has ? COPY.company.updateProfile : COPY.company.createProfile;
  editBtn.addEventListener("click", () => {
    editBtn.hidden = true;
    if (saveProjBtn) saveProjBtn.hidden = true;
    buildForm();
    formWrap.hidden = false;
  });
  body.appendChild(editBtn);

  // Quick path: push THIS project's identity up as the default. Only offered when a project
  // is open AND its company identity is completed (a company name is set). (req #4)
  let saveProjBtn = null;
  if (proj.hasProject && proj.company) {
    saveProjBtn = document.createElement("button");
    saveProjBtn.className = "panelbtn";
    saveProjBtn.textContent = COPY.company.saveDefault;
    const pmsg = document.createElement("div");
    pmsg.className = "muted";
    pmsg.style.marginTop = "6px";
    saveProjBtn.addEventListener("click", async () => {
      saveProjBtn.disabled = true;
      saveProjBtn.textContent = COPY.common.saving;
      pmsg.textContent = "";
      const res = await window.desktop.saveDefaultCompany();
      if (res.ok) openModal("company");
      else {
        pmsg.textContent = res.error || COPY.common.couldNotSave;
        pmsg.style.color = "#e5484d";
        saveProjBtn.disabled = false;
        saveProjBtn.textContent = COPY.company.saveDefault;
      }
    });
    body.append(saveProjBtn, pmsg);
  }

  body.appendChild(formWrap);

  function buildForm() {
    formWrap.innerHTML = "";
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.style.marginTop = "6px";
    saveBtn.textContent = COPY.company.saveProfile;
    const saveMsg = document.createElement("div");
    saveMsg.className = "muted";
    saveMsg.style.marginTop = "8px";
    const cards = [
      { id: "companyName", type: "open-text", label: COPY.companyForm.nameLabel, placeholder: COPY.companyForm.namePlaceholder, maxLength: 60, value: def.companyName || undefined },
      { id: "headingFont", type: "font-pick", label: COPY.companyForm.headingFontLabel, help: COPY.companyForm.headingFontHelp, options: COMPANY_HEADING_FONTS, value: def.headingFont || undefined, allowUpload: true, skippable: true, agentDecidesLabel: COPY.companyForm.useDefault },
      { id: "bodyFont", type: "font-pick", label: COPY.companyForm.bodyFontLabel, options: COMPANY_BODY_FONTS, value: def.bodyFont || undefined, allowUpload: true, skippable: true, agentDecidesLabel: COPY.companyForm.useDefault },
      { id: "logo", type: "logo", label: COPY.companyForm.logoLabel, placeholder: COPY.companyForm.logoPlaceholder }, // optional: the upload zone is the affordance, no skip button
    ];
    // Only the company name is required; fonts + logo are optional (default fonts / no logo),
    // so gate Save on the name alone rather than every card being filled-or-skipped.
    const refreshSave = () => {
      const nameCtl = controls.find((c) => c.card.id === "companyName");
      saveBtn.disabled = !nameCtl || !nameCtl.isReady();
    };
    const controls = cards.map((card) => {
      const r = renderIntakeCard(card, refreshSave, () => {});
      formWrap.appendChild(r.el);
      return { card, ...r };
    });
    if (def.logoName) {
      const n = document.createElement("div");
      n.className = "muted";
      n.textContent = COPY.company.currentLogo(def.logoName);
      formWrap.appendChild(n);
    }
    saveBtn.addEventListener("click", async () => {
      const vals = {};
      const files = {};
      for (const c of controls) { vals[c.card.id] = c.getValue(); if (c.getUpload) files[c.card.id] = c.getUpload(); }
      if (!vals.companyName) { saveMsg.textContent = COPY.company.nameRequired; saveMsg.style.color = "#e5484d"; return; }
      saveBtn.disabled = true;
      saveBtn.textContent = COPY.common.saving;
      const res = await window.desktop.saveDefaultCompanyFields({
        companyName: vals.companyName,
        headingFont: vals.headingFont || null,
        bodyFont: vals.bodyFont || null,
        headingFontFile: files.headingFont || null, // a self-hosted upload (or null)
        bodyFontFile: files.bodyFont || null,
        logo: vals.logo || null,
      });
      if (res && res.ok) openModal("company"); // refresh → Active + collapsed
      else {
        saveMsg.textContent = (res && res.error) || COPY.common.couldNotSave;
        saveMsg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = COPY.company.saveProfile;
      }
    });
    formWrap.append(saveBtn, saveMsg);
    refreshSave();
  }

  // --- Export the profile to a portable file (move between machines) — only when the open
  // project already has an exported company-profile.json. ---
  if (proj.hasProject && proj.companyProfile) {
    const hr = document.createElement("div");
    hr.style.cssText = "height:1px;background:var(--border,#2a2a2a);margin:14px 0;";
    body.appendChild(hr);
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.style.margin = "0 0 12px";
    intro.textContent = COPY.company.exportIntro;
    body.appendChild(intro);
    const exportBtn = document.createElement("button");
    exportBtn.className = "panelbtn";
    exportBtn.textContent = COPY.company.exportBtn;
    exportBtn.addEventListener("click", () => exportCompany(exportBtn));
    body.appendChild(exportBtn);
  }

  // Honor a requested jump into the create/edit form (e.g. from Publish's "set up project").
  if (companyAutoCreate) { companyAutoCreate = false; editBtn.click(); }
}

// --- Figma export panel: status + note; the license input now lives in Licenses ---
async function renderFigma(body) {
  const lic = await window.desktop.getLicenseStatus();
  railFigma.classList.toggle("activated", !!lic.hasLicense); // color the icon on save/clear

  body.appendChild(connStatusRow(COPY.figma.licenseLabel, lic.hasLicense, lic.hasLicense ? COPY.common.active : COPY.common.notSet, null, null));

  // Export scope (P15) as checkboxes — shown once licensed. "Export Design" builds the chat
  // command from the ticked parts so the agent runs straight away without re-asking the scope.
  // (Destination / update-vs-new file (P16/P17) are still confirmed in chat on first export.)
  let cbStyleguide = null;
  let cbPages = null;
  if (lic.hasLicense) {
    // "What to export" header, with a "?" pushed to the right that opens the options help.
    const scopeHead = document.createElement("div");
    scopeHead.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;";
    const scopeLabel = document.createElement("div");
    scopeLabel.className = "sess-label";
    scopeLabel.style.marginBottom = "0"; // the flex header owns the spacing now
    scopeLabel.textContent = COPY.figma.exportScopeLabel;
    const help = document.createElement("button");
    help.type = "button";
    help.className = "row-help";
    help.title = COPY.figma.exportHelpTitle;
    help.setAttribute("aria-label", COPY.figma.exportHelpTitle);
    help.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
    help.addEventListener("click", () => openHelpOverlay(COPY.figma.exportHelpHtml));
    scopeHead.append(scopeLabel, help);
    body.appendChild(scopeHead);
    const scopeRow = (text, checked) => {
      const row = document.createElement("label");
      row.className = "toggle-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      const t = document.createElement("span");
      t.textContent = text;
      row.append(cb, t);
      body.appendChild(row);
      return cb;
    };
    // Styleguide + Blocks on by default (the recommended first export); Pages off — it's
    // re-sent separately once the first export is confirmed.
    cbStyleguide = scopeRow(COPY.figma.scopeStyleguide, true);
    cbPages = scopeRow(COPY.figma.scopePages, false);
  }

  // Export Design — enabled only when licensed, a build has finished (previewReady), and at
  // least one scope is ticked.
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "ifigma-export";
  exportBtn.textContent = COPY.figma.exportDesign;
  const updateExport = () => {
    const anyScope = !cbStyleguide || cbStyleguide.checked || cbPages.checked;
    exportBtn.disabled = !(lic.hasLicense && design.previewReady) || !anyScope;
    exportBtn.title =
      !lic.hasLicense ? COPY.figma.exportDisabledHint
      : !design.previewReady ? COPY.figma.exportAfterBuild
      : !anyScope ? COPY.figma.exportPickScope
      : "";
  };
  if (cbStyleguide) { cbStyleguide.addEventListener("change", updateExport); cbPages.addEventListener("change", updateExport); }
  updateExport();
  exportBtn.addEventListener("click", () => {
    if (exportBtn.disabled) return;
    closeModal();
    const sg = !cbStyleguide || cbStyleguide.checked;
    const pg = !cbPages || cbPages.checked;
    sendText(COPY.figma.exportCommandFor(sg, pg));
  });
  body.appendChild(exportBtn);

  // Licensed but no finished build yet → explain why the button is waiting.
  if (lic.hasLicense && !design.previewReady) {
    const waitMsg = document.createElement("div");
    waitMsg.className = "muted";
    waitMsg.style.marginTop = "8px";
    waitMsg.textContent = COPY.figma.exportAfterBuild;
    body.appendChild(waitMsg);
  }

  // What the license unlocks — shown only when it's NOT active (removed once licensed).
  if (!lic.hasLicense) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.figma.note;
    body.appendChild(note);
  }

  const manage = document.createElement("div");
  manage.className = "muted";
  manage.style.marginTop = "10px";
  manage.textContent = COPY.figma.manageInLicenses;
  body.appendChild(manage);
}

const EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a15.7 15.7 0 0 1-2.9 3.8"/><path d="M6.1 6.1A15.6 15.6 0 0 0 2 11s3.5 7 10 7a10.8 10.8 0 0 0 4-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>';

// A password input with a show/hide (eye) toggle so the entered value isn't
// always obscured. Returns { wrap (append it), input (read .value) }.
function revealField(placeholder) {
  const wrap = document.createElement("div");
  wrap.className = "field-reveal";
  const input = document.createElement("input");
  input.className = "field";
  input.type = "password";
  input.placeholder = placeholder;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "reveal-btn";
  btn.innerHTML = EYE_SVG;
  btn.setAttribute("aria-label", COPY.licenses.showKey);
  btn.title = COPY.licenses.showKey;
  btn.addEventListener("click", () => {
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    btn.innerHTML = reveal ? EYE_OFF_SVG : EYE_SVG;
    const label = reveal ? COPY.licenses.hideKey : COPY.licenses.showKey;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    input.focus();
  });
  wrap.append(input, btn);
  return { wrap, input };
}

// --- Keys & Licenses panel: your API key + both app licenses, one place ---
function licensesGroupHead(body, text) {
  const h = document.createElement("div");
  h.className = "drawer-sep";
  body.appendChild(h);
  const l = document.createElement("div");
  l.className = "sess-label";
  l.textContent = text;
  body.appendChild(l);
}
function licensesDivider(body) {
  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;background:#2a2a2a;margin:20px 0;";
  body.appendChild(sep);
}
async function renderLicenses(body) {
  // Your keys — the Anthropic API key the studio runs on.
  licensesGroupHead(body, COPY.licenses.keysGroup);
  await claudeKeySection(body);

  // Licenses — the feature unlocks, in order: Figma, then Design.
  licensesGroupHead(body, COPY.licenses.licensesGroup);
  await licenseSection(body, {
    label: COPY.licenses.figmaLabel,
    desc: COPY.licenses.figmaDesc,
    getStatus: () => window.desktop.getLicenseStatus(),
    save: (k) => window.desktop.saveLicense(k),
    clear: () => window.desktop.clearLicense(),
  });

  licensesDivider(body);

  await licenseSection(body, {
    label: COPY.licenses.designLabel,
    desc: COPY.licenses.designDesc,
    getStatus: () => window.desktop.getDesignLicenseStatus(),
    save: (k) => window.desktop.saveDesignLicense(k),
    clear: () => window.desktop.clearDesignLicense(),
    // The design license gates the Art Director rail (+ lens picker). On change,
    // drop the cached meta and re-evaluate so the rail appears/disappears at once.
    onChange: () => { _directionMeta = null; updateRerollBtn(); },
  });
}

// The Claude API key row — status + remove when connected, or a validated input
// when not. Same encrypted-keychain storage as before; just entered here now.
async function claudeKeySection(body) {
  const head = document.createElement("div");
  head.className = "sess-label";
  head.textContent = COPY.licenses.claudeLabel;
  body.appendChild(head);

  const desc = document.createElement("div");
  desc.className = "muted";
  desc.style.cssText = "font-size:12px;margin:2px 0 10px;";
  desc.textContent = COPY.licenses.claudeDesc;
  body.appendChild(desc);

  const status = await window.desktop.getKeyStatus();
  body.appendChild(connStatusRow(COPY.licenses.claudeStatus, status.hasKey, status.hasKey ? COPY.common.active : COPY.common.notSet, COPY.licenses.removeKey,
    // Removing the key drops the workspace into read-only → re-gate (hides chat, disables actions).
    async () => { await window.desktop.clearKey(); refreshRailActivation(); boot(); openModal("licenses"); }));

  if (status.hasKey) {
    body.appendChild(setRow(COPY.licenses.keyLabel, `sk-ant-…${status.keyHint || "????"}`));
    return;
  }

  const { wrap, input } = revealField(COPY.licenses.pasteClaudeKey);
  const saveBtn = document.createElement("button");
  saveBtn.className = "panelbtn primary";
  saveBtn.textContent = COPY.licenses.saveKey;
  const msg = document.createElement("div");
  msg.className = "muted";
  const doSave = async () => {
    const key = input.value.trim();
    if (!key) return;
    saveBtn.disabled = true;
    saveBtn.textContent = COPY.licenses.validating;
    msg.textContent = "";
    const res = await window.desktop.saveKey(key);
    if (res.ok) {
      refreshRailActivation();
      boot(); // key added → re-gate (reveals chat + enables agent actions)
      openModal("licenses"); // refresh → shows Active
    } else {
      msg.textContent = res.error || COPY.common.couldNotSave;
      msg.style.color = "#e5484d";
      saveBtn.disabled = false;
      saveBtn.textContent = COPY.licenses.saveKey;
    }
  };
  saveBtn.addEventListener("click", doSave);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
  body.append(wrap, saveBtn, msg);
}

// One license row: status + remove when active, or a validated key input when not.
// Both sections re-open the panel on change so the rail icons + status refresh.
async function licenseSection(body, opts) {
  const head = document.createElement("div");
  head.className = "sess-label";
  head.textContent = opts.label;
  body.appendChild(head);

  if (opts.desc) {
    const d = document.createElement("div");
    d.className = "muted";
    d.style.cssText = "font-size:12px;margin:2px 0 10px;";
    d.textContent = opts.desc;
    body.appendChild(d);
  }

  const lic = await opts.getStatus();
  body.appendChild(connStatusRow(COPY.licenses.status, lic.hasLicense, lic.hasLicense ? COPY.common.active : COPY.common.notSet, COPY.licenses.remove,
    async () => { await opts.clear(); if (opts.onChange) opts.onChange(); refreshRailActivation(); openModal("licenses"); }));

  if (lic.hasLicense) {
    body.appendChild(setRow(COPY.licenses.keyLabel, `…${lic.hint || "????"}`));
    return;
  }

  const { wrap, input } = revealField(COPY.licenses.pasteKey);
  const saveBtn = document.createElement("button");
  saveBtn.className = "panelbtn primary";
  saveBtn.textContent = COPY.licenses.save;
  const msg = document.createElement("div");
  msg.className = "muted";
  const doSave = async () => {
    const key = input.value.trim();
    if (!key) return;
    saveBtn.disabled = true;
    saveBtn.textContent = COPY.licenses.validating;
    msg.textContent = "";
    const res = await opts.save(key);
    if (res.ok) {
      if (opts.onChange) opts.onChange();
      refreshRailActivation();
      openModal("licenses"); // refresh → shows Active
    } else {
      msg.textContent = res.error || COPY.licenses.couldNotSave;
      msg.style.color = "#e5484d";
      saveBtn.disabled = false;
      saveBtn.textContent = COPY.licenses.save;
    }
  };
  saveBtn.addEventListener("click", doSave);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
  body.append(wrap, saveBtn, msg);
}

// --- Publish: direct-to-Vercel (connect + one-click publish) ---
// A tiny "copy to clipboard" affordance shared by the URL + password rows.
function copyBtn(getText) {
  const b = document.createElement("button");
  b.className = "panelbtn";
  b.style.cssText = "padding:2px 10px;font-size:12px;flex:0 0 auto;";
  b.textContent = COPY.common.copy;
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(getText()); b.textContent = COPY.common.copied; setTimeout(() => (b.textContent = COPY.common.copy), 1400); }
    catch { b.textContent = COPY.common.copyFailed; }
  });
  return b;
}

// A live progress row per step, upserted as publish:progress events arrive.
function publishProgressList(container) {
  const rows = {};
  const LABELS = { project: "Vercel project", env: "Preview gate", upload: "Uploading files", deploy: "Building on Vercel", domain: "Custom domain", ready: "Live", error: "Problem" };
  // The site publish shares the steps but not the gate: its env step sets the site
  // address, and it runs a local build check first.
  const SITE_LABELS = { ...LABELS, env: "Site address", check: "Build check" };
  return (evt) => {
    const { step, status, detail } = evt;
    const labels = evt.target === "site" ? SITE_LABELS : LABELS;
    let r = rows[step];
    if (!r) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:13px;";
      const icon = document.createElement("span");
      icon.style.cssText = "flex:0 0 14px;";
      const label = document.createElement("span");
      label.style.cssText = "flex:0 0 120px;color:var(--muted,#9a9aa2);";
      label.textContent = labels[step] || step;
      const det = document.createElement("span");
      det.style.cssText = "flex:1;";
      row.append(icon, label, det);
      container.appendChild(row);
      r = rows[step] = { icon, det };
    }
    r.icon.textContent = status === "done" ? "✓" : status === "error" ? "✗" : "…";
    r.icon.style.color = status === "done" ? "#17171b" : status === "error" ? "#e5484d" : "#9a9aa2";
    if (detail) r.det.textContent = detail;
    if (status === "error") r.det.style.color = "#e5484d";
  };
}

// --- Publish run state (survives an accidental drawer close) -----------------
// The publish itself runs in the MAIN process, so closing the drawer never aborts
// it. But the progress + result render into drawer DOM; if the drawer is closed
// mid-run and reopened, that output would be orphaned. So we hold the run at module
// scope and repaint it into whatever host the (re)rendered Publish drawer provides.
// (The finished URL + password are also recoverable from the persisted publish
// status at the top of the drawer, so only the IN-FLIGHT view needs re-attaching.)
let activePublish = null; // { opts, label, events:[], result:null, running:bool, host, btn }

// Render the freshly-published URL + password (or an error) below the progress list.
function paintPublishResult(host, res) {
  if (res.ok) {
    const done = document.createElement("div");
    done.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#2a2a2a);";
    // Live URL row: open + copy.
    const urlRow = document.createElement("div");
    urlRow.style.cssText = "display:flex;gap:8px;align-items:center;";
    const link = document.createElement("a");
    link.href = res.url;
    link.textContent = (res.url || "").replace(/^https?:\/\//, "");
    link.style.cssText = "flex:1;color:#1a1a1a;text-decoration:underline;font-size:13px;word-break:break-all;";
    link.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(res.url); });
    urlRow.append(link, copyBtn(() => res.url));
    done.appendChild(urlRow);
    if (res.password) {
      const pwWrap = document.createElement("div");
      pwWrap.style.cssText = "margin-top:10px;padding:10px;border:1px solid var(--border,#2a2a2a);border-radius:8px;";
      const pwLabel = document.createElement("div");
      pwLabel.className = "muted";
      pwLabel.style.cssText = "font-size:12px;margin-bottom:6px;";
      pwLabel.textContent = COPY.publish.previewPasswordLabel;
      const pwRow = document.createElement("div");
      pwRow.style.cssText = "display:flex;gap:8px;align-items:center;";
      const pw = document.createElement("code");
      pw.textContent = res.password;
      pw.style.cssText = "flex:1;font-size:14px;letter-spacing:1px;";
      pwRow.append(pw, copyBtn(() => res.password));
      pwWrap.append(pwLabel, pwRow);
      done.appendChild(pwWrap);
    }
    host.appendChild(done);
  } else {
    const err = document.createElement("div");
    err.className = "muted";
    err.style.cssText = "margin-top:10px;color:#e5484d;white-space:pre-wrap;word-break:break-word;font-size:12.5px;";
    err.textContent = res.error || COPY.publish.publishFailed;
    host.appendChild(err);
  }
}

// Repaint the active run into its current host from scratch (idempotent — the
// progress list upserts by step, so replaying all events rebuilds the rows).
function repaintPublish() {
  const ap = activePublish;
  if (!ap || !ap.host) return;
  ap.host.hidden = false;
  ap.host.innerHTML = "";
  const list = document.createElement("div");
  ap.host.appendChild(list);
  const paint = publishProgressList(list);
  ap.events.forEach(paint);
  if (ap.result) paintPublishResult(ap.host, ap.result);
}

// Point an in-flight run at a freshly-rendered drawer (host + button) and repaint,
// so a reopened Publish drawer reflects the ongoing publish instead of a stale idle
// state. Called by renderPublish. Returns true when a running publish was re-attached.
function reattachPublish(host, btn) {
  const ap = activePublish;
  if (!ap || !ap.running) return false;
  ap.host = host; ap.btn = btn;
  btn.disabled = true;
  btn.textContent = COPY.publish.publishing;
  repaintPublish();
  return true;
}

// Shared run handler for both "Publish" and "Reset password" (a republish with a
// fresh gate password). Streams progress, then shows the live URL + any new password.
async function runPublishFlow(btn, host, opts) {
  if (activePublish && activePublish.running) return; // one publish at a time
  const label = btn.textContent;
  const ap = activePublish = { opts: opts || {}, label, events: [], result: null, running: true, host, btn };
  btn.disabled = true;
  btn.textContent = COPY.publish.publishing;
  const unsub = window.desktop.onPublishProgress((evt) => { ap.events.push(evt); repaintPublish(); });
  repaintPublish();
  try {
    const res = await window.desktop.runPublish(ap.opts);
    ap.result = res;
    ap.running = false;
    repaintPublish();
    if (ap.btn) {
      ap.btn.disabled = false;
      // Only the primary publish button becomes "Publish changes"; the reset button
      // keeps its own label (don't create a duplicate).
      ap.btn.textContent = !res.ok ? label
        : label === COPY.publish.publishDesign ? COPY.publish.publishChanges
        : label === COPY.publish.site.publishSite ? COPY.publish.site.publishSiteChanges
        : label;
    }
  } catch (e) {
    ap.result = { ok: false, error: String(e) };
    ap.running = false;
    repaintPublish();
    if (ap.btn) { ap.btn.disabled = false; ap.btn.textContent = label; }
  } finally {
    unsub();
    // Run's done. The persisted status (URL + password) now covers reopens, so drop
    // the run so a future drawer open starts clean.
    if (activePublish === ap) activePublish = null;
    refreshRailActivation();
  }
}

// --- Publish help: a tabbed, step-by-step walkthrough (assumes no Vercel account) ---
const PUBHELP = COPY.publish.help;
const pubhelp = el("pubhelp");
const pubhelpBody = el("pubhelp-body");
const pubhelpTabs = Array.from(document.querySelectorAll(".pubhelp-tab"));
function renderPubHelp(tab) {
  const data = PUBHELP[tab] || PUBHELP.start;
  pubhelpTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  pubhelpBody.innerHTML = "";
  const intro = document.createElement("p");
  intro.className = "ph-intro";
  intro.textContent = data.intro;
  pubhelpBody.appendChild(intro);
  data.steps.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "ph-step";
    const num = document.createElement("div");
    num.className = "ph-num";
    num.textContent = String(i + 1);
    const b = document.createElement("div");
    b.style.flex = "1";
    const h = document.createElement("div"); h.className = "ph-step-h"; h.textContent = s.h;
    const d = document.createElement("div"); d.className = "ph-step-d"; d.textContent = s.d;
    b.append(h, d);
    // A helper note reads as part of the step, tucked right under its copy.
    if (s.note) {
      const note = document.createElement("div");
      note.className = "ph-step-note";
      note.textContent = s.note;
      b.appendChild(note);
    }
    if (s.link) {
      const a = document.createElement("button");
      a.className = "ph-link";
      const label = document.createElement("span");
      label.textContent = s.link.label;
      // Short-stemmed up-right arrow (external link) — neat, not the long ↗ glyph.
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrow.setAttribute("viewBox", "0 0 10 10");
      arrow.setAttribute("fill", "none");
      arrow.setAttribute("stroke", "currentColor");
      arrow.setAttribute("stroke-width", "1.3");
      arrow.setAttribute("stroke-linecap", "round");
      arrow.setAttribute("stroke-linejoin", "round");
      arrow.innerHTML = '<path d="M3.2 6.8 6.8 3.2"/><path d="M4.4 3.2H6.8V5.6"/>';
      a.append(label, arrow);
      a.addEventListener("click", () => window.desktop.openExternal(s.link.url));
      b.appendChild(a);
    }
    row.append(num, b);
    pubhelpBody.appendChild(row);
  });
}
function openPubHelp(tab) { renderPubHelp(tab || "start"); pubhelp.hidden = false; }
function closePubHelp() { pubhelp.hidden = true; }
pubhelpTabs.forEach((t) => t.addEventListener("click", () => renderPubHelp(t.dataset.tab)));
el("pubhelp-close").addEventListener("click", closePubHelp);
pubhelp.addEventListener("click", (e) => { if (e.target === pubhelp) closePubHelp(); });
// Esc closes the help first (capture phase, so the drawer's Esc handler doesn't also fire).
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pubhelp.hidden) { closePubHelp(); e.stopPropagation(); }
}, true);

// The "domain" control: default *.vercel.app, or a subdomain of a domain the account
// owns. Mounted once per deploy target (the preview and the site each keep their own
// domain). Returns a refresh() that (re)loads the owned domains for the current scope;
// the picker saves through setPublishDomain(domain, target).
function mountDomainPicker(domBody, domNote, { customDomain, baseSlug, target }) {
  // The SITE may sit on the domain itself (an empty subdomain = the apex); the gated
  // preview always takes a subdomain, so a password page never lands on a client's apex.
  const allowApex = target === "site";
  const slugifyLabel = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return () => {
    domBody.innerHTML = "";
    domBody.appendChild(loadingDots());
    domNote.textContent = "";
    window.desktop.getVercelDomains().then(({ domains }) => {
      domBody.innerHTML = "";
      let curBase = "", curLabel = "";
      if (customDomain && domains && domains.length) {
        const match = domains.find((d) => customDomain === d.name || customDomain.endsWith("." + d.name));
        if (match) { curBase = match.name; curLabel = customDomain === match.name ? "" : customDomain.slice(0, -(match.name.length + 1)); }
      }
      const domSel = document.createElement("select");
      domSel.className = "field";
      const optDefault = document.createElement("option");
      optDefault.value = ""; optDefault.textContent = COPY.publish.domainDefault;
      domSel.appendChild(optDefault);
      (domains || []).forEach((d) => { const o = document.createElement("option"); o.value = d.name; o.textContent = d.name; domSel.appendChild(o); });
      domSel.value = curBase;

      const subWrap = document.createElement("div");
      subWrap.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:6px;";
      const subInput = document.createElement("input");
      subInput.className = "field"; subInput.placeholder = allowApex ? COPY.publish.site.subdomainOptional : COPY.publish.subdomain; subInput.style.cssText = "flex:0 1 140px;";
      // Preview: prefill a subdomain. Site: keep whatever was chosen (empty = the apex).
      subInput.value = curLabel || (curBase && !allowApex ? baseSlug : "");
      const domPreview = document.createElement("span");
      domPreview.className = "muted"; domPreview.style.cssText = "font-size:12px;word-break:break-all;";
      subWrap.append(subInput, domPreview);

      const updateDomPreview = () => {
        const base = domSel.value;
        subWrap.style.display = base ? "flex" : "none";
        if (!base) return;
        const label = slugifyLabel(subInput.value.trim());
        domPreview.textContent = label ? `→ ${label}.${base}` : (allowApex ? `→ ${base}` : `→ name.${base}`);
      };
      const saveDom = () => {
        const base = domSel.value;
        if (!base) { window.desktop.setPublishDomain(null, target); return; }
        const label = slugifyLabel(subInput.value.trim());
        if (label) window.desktop.setPublishDomain(`${label}.${base}`, target);
        else if (allowApex) window.desktop.setPublishDomain(base, target);
      };
      domSel.addEventListener("change", () => { if (domSel.value && !subInput.value.trim() && !allowApex) subInput.value = baseSlug; updateDomPreview(); saveDom(); });
      subInput.addEventListener("input", updateDomPreview);
      subInput.addEventListener("change", saveDom);
      subInput.addEventListener("blur", saveDom);

      domBody.append(domSel, subWrap);
      updateDomPreview();
      domNote.textContent = (domains && domains.length)
        ? (allowApex ? COPY.publish.site.ownedDomainNote : COPY.publish.ownedDomainNote)
        : COPY.publish.noDomainsNote;
    }).catch(() => {
      domBody.innerHTML = "";
      domNote.textContent = COPY.publish.domainsError;
    });
  };
}

async function renderPublish(body) {
  const st = await window.desktop.getVercelStatus();
  railPublish.classList.toggle("activated", !!st.connected);

  // Fill the drawer height so the help button can pin to the bottom, with the gap
  // beneath it matching the drawer's top padding.
  const col = document.createElement("div");
  col.style.cssText = "min-height:100%;display:flex;flex-direction:column;";
  body.appendChild(col);
  body = col;

  // Appended last (before any early return) so it sits at the very bottom, as a
  // footer separated from the content above (e.g. the Disconnect button) by a rule.
  const addHelp = () => {
    const foot = document.createElement("div");
    foot.style.cssText = "margin-top:auto;"; // pin the footer to the bottom of the drawer
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:#ececf1;margin:18px 0 14px;";
    const helpBtn = document.createElement("button");
    helpBtn.className = "pubhelp-open";
    helpBtn.style.margin = "0"; // spacing comes from the separator above
    // Life-buoy icon — the same "help" mark used in the rail.
    helpBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg><span>' + COPY.publish.helpButton + '</span>';
    helpBtn.addEventListener("click", () => openPubHelp(st.connected ? "how" : "start"));
    foot.append(sep, helpBtn);
    col.appendChild(foot);
  };

  // ── Connection ──
  const badgeText = st.connected ? (st.user ? COPY.publish.connectedWith(st.user) : COPY.publish.connected) : COPY.publish.notConnected;
  body.appendChild(connStatusRow(COPY.publish.vercelLabel, st.connected, badgeText, COPY.publish.disconnect,
    async () => { await window.desktop.clearVercel(); refreshRailActivation(); openModal("publish"); }));

  // ── Company info nudge — the shared preview's sign-in screen shows the agency's
  // name + logo to the client; if it isn't set, offer to add it before publishing
  // (still optional). Shown whether or not Vercel is connected.
  const proj = await window.desktop.getProjectStatus();
  if (proj.hasProject && !((proj.company || "").trim())) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin: 6px 0 18px;";
    const rule = document.createElement("div");
    rule.style.cssText = "height: 2px; background: #c0261e; border-radius: 2px; margin-bottom: 12px;";
    const title = document.createElement("div");
    title.style.cssText = "font-size: 13px; font-weight: 600; color: #c0261e; margin-bottom: 5px;";
    title.textContent = COPY.publish.companyNudge.title;
    const desc = document.createElement("div");
    desc.className = "sess-desc";
    desc.style.marginTop = "0";
    desc.textContent = COPY.publish.companyNudge.desc;
    const btns = document.createElement("div");
    btns.className = "projbtns";
    const upload = document.createElement("button");
    upload.className = "panelbtn primary";
    upload.textContent = COPY.publish.companyNudge.upload;
    upload.addEventListener("click", () => { closeModal(); sendText("/import-company"); });
    const setup = document.createElement("button");
    setup.className = "panelbtn";
    setup.textContent = COPY.publish.companyNudge.setup;
    setup.addEventListener("click", () => { companyAutoCreate = true; openModal("company"); });
    btns.append(upload, setup);
    wrap.append(rule, title, desc, btns);
    body.appendChild(wrap);
  }

  if (!st.connected) {
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.style.margin = "0 0 12px";
    intro.textContent = COPY.publish.connectIntro;
    body.appendChild(intro);

    // Primary: Sign in with Vercel (OAuth) — opens the browser, no token to copy.
    const connectBtn = document.createElement("button");
    connectBtn.className = "panelbtn primary";
    connectBtn.textContent = COPY.publish.connect;
    const connMsg = document.createElement("div");
    connMsg.className = "muted";
    connMsg.style.marginTop = "6px";
    connectBtn.addEventListener("click", async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = COPY.publish.waitingAuth;
      connMsg.style.color = "";
      connMsg.textContent = COPY.publish.browserOpened;
      const res = await window.desktop.connectVercel();
      if (res.ok) { refreshRailActivation(); openModal("publish"); }
      else {
        connMsg.textContent = res.error || COPY.publish.couldNotConnect;
        connMsg.style.color = "#e5484d";
        connectBtn.disabled = false;
        connectBtn.textContent = COPY.publish.connect;
      }
    });
    body.append(connectBtn, connMsg);

    // Fallback: paste an access token.
    const orSep = document.createElement("div");
    orSep.className = "muted";
    orSep.style.cssText = "text-align:center;font-size:11.5px;margin:16px 0 8px;";
    orSep.textContent = COPY.publish.orToken;
    body.appendChild(orSep);

    const input = document.createElement("input");
    input.className = "field";
    input.type = "password";
    input.placeholder = COPY.publish.pasteToken;
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn";
    saveBtn.textContent = COPY.publish.saveToken;
    const msg = document.createElement("div");
    msg.className = "muted";
    const doSave = async () => {
      const token = input.value.trim();
      if (!token) return;
      saveBtn.disabled = true;
      saveBtn.textContent = COPY.publish.connecting;
      msg.textContent = "";
      const res = await window.desktop.saveVercelToken(token);
      if (res.ok) { refreshRailActivation(); openModal("publish"); }
      else {
        msg.textContent = res.error || COPY.publish.couldNotConnect;
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = COPY.publish.saveToken;
      }
    };
    saveBtn.addEventListener("click", doSave);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
    body.append(input, saveBtn, msg);

    const tokenLink = document.createElement("button");
    tokenLink.className = "panelbtn";
    tokenLink.textContent = COPY.publish.createToken;
    tokenLink.addEventListener("click", () => window.desktop.openExternal("https://vercel.com/account/tokens"));
    body.appendChild(tokenLink);

    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.publish.tokenNote;
    body.appendChild(note);
    addHelp();
    return;
  }

  // Divider: connection status sits above; the deploy controls (scope + this
  // project) are grouped together below it.
  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;background:#ececf1;margin:14px 0;";
  body.appendChild(sep);

  // Reloads the Preview domain list for the current scope (set once the domain
  // control exists); called on a scope change so we don't re-render the whole panel.
  const domainRefreshers = [];
  const refreshDomains = () => domainRefreshers.forEach((f) => f());

  // Deploy-to scope (grouped with This project, below the divider).
  const { teams } = await window.desktop.getVercelTeams();
  if (teams && teams.length) {
    const scopeRow = document.createElement("div");
    scopeRow.className = "setrow";
    const sk = document.createElement("div");
    sk.className = "k";
    sk.textContent = COPY.publish.deployTo;
    const sel = document.createElement("select");
    sel.className = "field";
    const personal = document.createElement("option");
    personal.value = "";
    personal.textContent = COPY.publish.personalAccount;
    sel.appendChild(personal);
    teams.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      sel.appendChild(o);
    });
    sel.value = st.teamId || "";
    sel.addEventListener("change", async () => {
      const name = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : null;
      await window.desktop.selectVercelScope(sel.value || null, sel.value ? name : null);
      refreshDomains(); // reload every domain list (preview + site) for the new scope
    });
    scopeRow.append(sk, sel);
    body.appendChild(scopeRow);
  }

  // ── This project ──
  const pub = await window.desktop.getPublishStatus();
  if (!pub.hasProject) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.publish.needsProject;
    body.appendChild(note);
  } else {
    // The live URL + preview password (once published) render together in a bordered
    // "credentials" box, appended just above the Publish button (see below) so the
    // shareable details sit next to the primary action. Built here, placed later.
    let credBox = null;
    if (pub.url) {
      credBox = document.createElement("div");
      // Right margin (8px) matches .panelbtn so the box lines up with the buttons' width;
      // no bottom margin so the button below sets the even 8px gap for the whole stack.
      credBox.style.cssText = "border:1px solid #e2e2e8;border-radius:10px;padding:10px 12px 6px;margin:4px 8px 0 0;background:#fafafb;";

      const liveRow = document.createElement("div");
      liveRow.style.cssText = "display:flex;gap:8px;align-items:center;min-height:34px;margin-bottom:2px;";
      const live = document.createElement("a");
      live.href = pub.url;
      live.textContent = pub.url.replace(/^https?:\/\//, "");
      live.style.cssText = "flex:1;color:#1a1a1a;text-decoration:underline;font-size:13px;word-break:break-all;";
      live.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(pub.url); });
      liveRow.append(live, copyBtn(() => pub.url));
      credBox.appendChild(liveRow);

      if (pub.gatePassword) {
        const pwRow = document.createElement("div");
        pwRow.style.cssText = "display:flex;gap:8px;align-items:center;min-height:34px;";
        const lab = document.createElement("span");
        lab.className = "muted"; lab.style.cssText = "font-size:12px;flex:0 0 auto;";
        lab.textContent = COPY.publish.passwordLabel;
        const pw = document.createElement("code");
        pw.textContent = pub.gatePassword;
        pw.style.cssText = "flex:1;font-size:13px;letter-spacing:.5px;word-break:break-all;";
        pwRow.append(lab, pw, copyBtn(() => pub.gatePassword));
        credBox.appendChild(pwRow);
      }
    } else {
      const lead = document.createElement("p");
      lead.className = "muted";
      lead.style.margin = "0 0 12px";
      lead.textContent = pub.canPublish
        ? COPY.publish.publishLead
        : COPY.publish.finishFirst;
      body.appendChild(lead);
    }

    // ── Preview domain: default *.vercel.app, or a subdomain of a domain you own ──
    const domSec = document.createElement("div");
    domSec.style.cssText = "margin: 2px 0 4px;";
    const domLabel = document.createElement("div");
    domLabel.className = "k";
    domLabel.style.marginBottom = "10px"; // match the label→control gap of other sections
    domLabel.textContent = COPY.publish.domainLabel;
    const domBody = document.createElement("div"); // filled once Vercel responds
    domSec.append(domLabel, domBody);
    body.appendChild(domSec);

    const domNote = document.createElement("div");
    domNote.className = "muted";
    domNote.style.cssText = "font-size:11.5px;margin:2px 0 12px;";
    body.appendChild(domNote);

    const baseSlug = pub.projectName || "preview";
    // Load (and reload, on a scope change) the owned domains WITHOUT blocking the
    // rest of the panel — show the pulsing dots so the wait never reads as a glitch.
    domainRefreshers.push(mountDomainPicker(domBody, domNote, { customDomain: pub.customDomain, baseSlug, target: "preview" }));
    refreshDomains();

    const host = document.createElement("div"); // progress + result target
    host.hidden = true;

    const publishBtn = document.createElement("button");
    publishBtn.className = "panelbtn primary";
    publishBtn.textContent = pub.url ? COPY.publish.publishChanges : COPY.publish.publishDesign;
    publishBtn.disabled = !pub.canPublish;
    publishBtn.addEventListener("click", () => runPublishFlow(publishBtn, host, { resetPassword: false }));

    let resetBtn = null;
    if (pub.url) {
      resetBtn = document.createElement("button");
      resetBtn.className = "panelbtn";
      resetBtn.textContent = COPY.publish.resetPassword;
      resetBtn.title = COPY.publish.resetPasswordTitle;
      resetBtn.addEventListener("click", () => runPublishFlow(resetBtn, host, { resetPassword: true }));
    }

    // Bottom stack, top → bottom: a "Manage Deployment" section header (only once the
    // site is live), the bordered URL + password box, then Reset, then the primary
    // Publish button (the shareable credentials sit above both actions).
    if (credBox) {
      const manageSec = document.createElement("div");
      manageSec.style.cssText = "margin:18px 0 10px;";
      const manageRule = document.createElement("div");
      manageRule.style.cssText = "height:1px;background:#ececf1;margin-bottom:10px;";
      const manageTitle = document.createElement("div");
      manageTitle.style.cssText = "font-size:13px;font-weight:600;color:#1a1a1a;";
      manageTitle.textContent = COPY.publish.manageTitle;
      manageSec.append(manageRule, manageTitle);
      body.appendChild(manageSec);
      body.appendChild(credBox);
    }
    if (resetBtn) body.appendChild(resetBtn);
    body.appendChild(publishBtn);
    body.appendChild(host);

    // A publish is already running (drawer was closed mid-run and reopened) → show
    // its live progress here and keep the buttons disabled until it finishes, rather
    // than a stale idle state that could trigger a second, conflicting publish.
    if (reattachPublish(host, publishBtn) && resetBtn) resetBtn.disabled = true;

    if (pub.lastDeployAt) {
      const last = document.createElement("div");
      last.className = "muted";
      last.style.marginTop = "8px";
      try { last.textContent = COPY.publish.lastPublishedPrefix + new Date(pub.lastDeployAt).toLocaleString(); } catch { last.textContent = ""; }
      body.appendChild(last);
    }

    // ── Live site: the public website (its own Vercel project, no gate) ──
    renderSitePublish(body, pub.site || {}, domainRefreshers);
  }

  addHelp();
}

// The site half of the Publish drawer. Mirrors the preview's shape (domain picker,
// live URL box, one primary button, progress host) with no password anywhere.
// Off, with the reason, until the design has been promoted (/promote-blocks).
function renderSitePublish(body, site, domainRefreshers) {
  const S = COPY.publish.site;
  const sec = document.createElement("div");
  sec.style.cssText = "margin:18px 0 10px;";
  const rule = document.createElement("div");
  rule.style.cssText = "height:1px;background:#ececf1;margin-bottom:10px;";
  const title = document.createElement("div");
  title.style.cssText = "font-size:13px;font-weight:600;color:#1a1a1a;";
  title.textContent = S.title;
  sec.append(rule, title);
  body.appendChild(sec);

  const lead = document.createElement("p");
  lead.className = "muted";
  lead.style.margin = "0 0 12px";
  lead.textContent = site.ready ? (site.enabled === false ? S.cmsOff : S.lead) : (S.notReady[site.reason] || S.notReady["not-promoted"]);
  body.appendChild(lead);
  if (!site.ready) return;
  if (site.enabled === false) {
    // Off per project (the Settings switch): the button is shown but can't run.
    const off = document.createElement("button"); off.className = "panelbtn primary"; off.disabled = true;
    off.textContent = site.url ? S.publishSiteChanges : S.publishSite; off.title = S.cmsOff;
    body.appendChild(off);
    return;
  }

  let liveBox = null;
  if (site.url) {
    liveBox = document.createElement("div");
    liveBox.style.cssText = "border:1px solid #e2e2e8;border-radius:10px;padding:10px 12px 6px;margin:4px 8px 0 0;background:#fafafb;";
    const liveRow = document.createElement("div");
    liveRow.style.cssText = "display:flex;gap:8px;align-items:center;min-height:34px;margin-bottom:2px;";
    const live = document.createElement("a");
    live.href = site.url;
    live.textContent = site.url.replace(/^https?:\/\//, "");
    live.style.cssText = "flex:1;color:#1a1a1a;text-decoration:underline;font-size:13px;word-break:break-all;";
    live.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(site.url); });
    liveRow.append(live, copyBtn(() => site.url));
    liveBox.appendChild(liveRow);
  }

  const domSec = document.createElement("div");
  domSec.style.cssText = "margin: 2px 0 4px;";
  const domLabel = document.createElement("div");
  domLabel.className = "k";
  domLabel.style.marginBottom = "10px";
  domLabel.textContent = S.domainLabel;
  const domBody = document.createElement("div");
  domSec.append(domLabel, domBody);
  body.appendChild(domSec);
  const domNote = document.createElement("div");
  domNote.className = "muted";
  domNote.style.cssText = "font-size:11.5px;margin:2px 0 12px;";
  body.appendChild(domNote);
  const refresh = mountDomainPicker(domBody, domNote, { customDomain: site.customDomain, baseSlug: (site.projectName || "site").replace(/-site$/, ""), target: "site" });
  domainRefreshers.push(refresh);
  refresh();

  const host = document.createElement("div");
  host.hidden = true;
  const btn = document.createElement("button");
  btn.className = "panelbtn primary";
  btn.textContent = site.url ? S.publishSiteChanges : S.publishSite;
  btn.addEventListener("click", () => runPublishFlow(btn, host, { target: "site" }));

  if (liveBox) body.appendChild(liveBox);
  body.appendChild(btn);
  body.appendChild(host);
  if (site.lastDeployAt) {
    const last = document.createElement("div");
    last.className = "muted";
    last.style.marginTop = "8px";
    try { last.textContent = S.lastPublishedPrefix + new Date(site.lastDeployAt).toLocaleString(); } catch { last.textContent = ""; }
    body.appendChild(last);
  }
}

// --- Site rail: pages, SEO, blocks and navigation, edited as content ------------
// Everything here is a file edit through main (site:*), never a model turn. Astro's
// dev server watches content/, so a save shows in the Site tab at once; the build
// check on publish is the validator of last resort for block props.
let siteRailState = { tab: "pages", open: {}, expanded: {}, selected: null }; // active tab, selection, open block editors

function siteEl(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function siteField(labelText, value, { textarea, placeholder, hint, type } = {}) {
  const wrap = siteEl("div", "site-kv");
  wrap.appendChild(siteEl("div", "k", labelText));
  const input = document.createElement(textarea ? "textarea" : "input");
  input.className = "field";
  if (!textarea) input.type = type || "text";
  if (placeholder) input.placeholder = placeholder;
  input.value = value == null ? "" : String(value);
  wrap.appendChild(input);
  if (hint) wrap.appendChild(siteEl("div", "sess-desc", hint));
  return { wrap, input };
}
function siteMini(label, onClick, { danger, title, disabled } = {}) {
  const b = siteEl("button", "site-mini" + (danger ? " danger" : ""), label);
  b.type = "button";
  if (title) b.title = title;
  if (disabled) b.disabled = true;
  b.addEventListener("click", onClick);
  return b;
}
// Foldable sections in the CMS drawer. Which are open is kept WITH THE PROJECT
// (.thinkany/cms.json ui.folds, loaded when the drawer renders), not in the
// window's storage, so it holds per project and across reinstalls.
let siteFolds = {}; // key → false when folded (absent = open)
let siteFoldsTimer = null;
let siteFoldsPending = {}; // every change since the last save (a quick run of clicks is one write)
function siteFoldSet(key, open) {
  siteFolds[key] = open;
  siteFoldsPending[key] = open;
  clearTimeout(siteFoldsTimer);
  siteFoldsTimer = setTimeout(async () => {
    const folds = siteFoldsPending; siteFoldsPending = {};
    try { const r = await window.desktop.setCmsSettings({ ui: { folds } }); if (!r || !r.ok) console.warn("[cms] fold state not saved:", r && r.error); }
    catch (e) { console.warn("[cms] fold state not saved:", e); }
  }, 150);
}
function siteFold(title, key) {
  const isOpen = siteFolds[key] !== false;
  const sec = siteEl("div", "site-acc" + (isOpen ? " open" : ""));
  const head = siteEl("button", "site-acc-head"); head.type = "button"; head.setAttribute("aria-expanded", String(isOpen));
  head.append(siteEl("span", "site-acc-chev"), siteEl("span", "site-acc-title", title));
  const body = siteEl("div", "site-acc-body"); body.hidden = !isOpen;
  head.addEventListener("click", () => { const now = body.hidden; body.hidden = !now; sec.classList.toggle("open", now); head.setAttribute("aria-expanded", String(now)); siteFoldSet(key, now); });
  sec.append(head, body);
  return { sec, body, head };
}

// Drag-and-drop reordering for a block list (the arrows stay). Each row gets a grip;
// dragging over another row shows a line above or below it (by pointer half), and
// dropping moves the item there. `move(from, to)` reorders the data and repaints.
let siteDragFrom = -1;
function siteMakeDraggable(row, i, move) {
  const grip = siteEl("span", "site-grip"); grip.title = COPY.site.dragToReorder; grip.setAttribute("aria-hidden", "true");
  grip.innerHTML = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
  row.insertBefore(grip, row.firstChild);
  row.draggable = true;
  row.addEventListener("dragstart", (e) => { siteDragFrom = i; row.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } catch {} });
  row.addEventListener("dragend", () => { siteDragFrom = -1; row.classList.remove("dragging"); row.parentElement && row.parentElement.querySelectorAll(".drop-before,.drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")); });
  const half = (e) => { const r = row.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 ? "before" : "after"; };
  row.addEventListener("dragover", (e) => {
    if (siteDragFrom < 0 || siteDragFrom === i) return;
    e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch {}
    const h = half(e); row.classList.toggle("drop-before", h === "before"); row.classList.toggle("drop-after", h === "after");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-before", "drop-after"));
  row.addEventListener("drop", (e) => {
    if (siteDragFrom < 0 || siteDragFrom === i) return;
    e.preventDefault();
    const from = siteDragFrom; let to = i + (half(e) === "after" ? 1 : 0); if (from < to) to--;
    siteDragFrom = -1; row.classList.remove("drop-before", "drop-after");
    if (from !== to) move(from, to);
  });
}
// A delete control: a red, 1px-stroke trash can (lucide trash-2), mini-button sized.
function siteTrashBtn(onClick, title) {
  const b = document.createElement("button"); b.type = "button"; b.className = "site-mini site-trash"; b.title = title || ""; b.setAttribute("aria-label", title || "");
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
  b.addEventListener("click", onClick);
  return b;
}
function siteFlash(host, text) {
  const s = siteEl("span", "site-saved", text);
  host.appendChild(s);
  setTimeout(() => s.remove(), 1800);
}

// Does this prop hold an image? By schema kind when the introspection knows, else
// by name (image, photo, logo, background, icon…) or by value (a /images path or
// an image file). A designer never types a path: these get the upload field.
const IMAGE_KEY = /(image|img|photo|picture|logo|icon|background|cover|thumbnail|thumb|avatar|poster|banner|src)$/i;
const IMAGE_VALUE = /^\/images\/|\.(avif|webp|png|jpe?g|gif|svg)(\?.*)?$/i;
function siteLooksLikeImage(key, v, meta) {
  if (meta && meta.kind === "image") return true;
  if (meta && meta.kind && meta.kind !== "string") return false;
  return IMAGE_KEY.test(key) || (typeof v === "string" && IMAGE_VALUE.test(v));
}
// A visual choice among the design's marks (enum over site/blocks/lib/marks.tsx).
function siteMarkPicker(options, value, onPick, marks) {
  const wrap = siteEl("div");
  const grid = siteEl("div", "site-marks");
  const paint = () => grid.querySelectorAll(".site-mark").forEach((b) => b.classList.toggle("on", b.dataset.key === value));
  const tile = (k) => {
    const b = siteEl("button", "site-mark"); b.type = "button"; b.dataset.key = k; b.title = k;
    b.innerHTML = marks[k];
    b.addEventListener("click", () => { value = k; onPick(k); paint(); });
    return b;
  };
  options.forEach((k) => grid.appendChild(tile(k)));
  // "Add icon": an SVG file becomes one more inline mark in this design's set.
  const add = siteEl("button", "site-mark add"); add.type = "button"; add.title = COPY.site.marks.add;
  add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const note = siteEl("div", "sess-desc"); note.hidden = true;
  add.addEventListener("click", async () => {
    add.disabled = true; note.hidden = true;
    const r = await window.desktop.addMark();
    add.disabled = false;
    if (r && r.ok) { marks[r.key] = r.svg; options.push(r.key); grid.insertBefore(tile(r.key), add); value = r.key; onPick(r.key); paint(); }
    else if (r && r.error) { note.textContent = r.error; note.style.color = "#c0261e"; note.hidden = false; }
  });
  grid.appendChild(add);
  wrap.append(grid, note);
  return wrap;
}
let siteMarks = {}; // the current project's rendered marks, from site:content
let siteBlogPath = "blog"; // the posts directory (Settings → Blog), from site:content

// Alternating layout: a new two-column block lands on the opposite side from the
// nearest sided block above it, so a page alternates without anyone asking.
function siteAlternateSide(list, props, def) {
  const f = def && def.fields && def.fields.side;
  if (!f || f.ui !== "side" || !props || typeof props.side !== "string") return props;
  for (let i = list.length - 1; i >= 0; i--) {
    const prev = list[i] && list[i].props && list[i].props.side;
    if (prev === "left" || prev === "right") { props.side = prev === "left" ? "right" : "left"; break; }
  }
  return props;
}

// The live block preview beside the fields: a webview onto the design surface's
// blockpreview mode, fed the draft props (debounced) as the designer edits. Desktop
// renders at 1280px scaled to the pane (zoom), Mobile at 390px.
let siteDesignId = null; // the pinned design, from site:content
function siteBlockPreview(type, getProps, { onExpand } = {}) {
  const el = siteEl("div", "site-block-preview");
  const bar = siteEl("div", "site-block-preview-bar");
  const stage = siteEl("div", "site-block-preview-stage");
  el.append(bar, stage);
  if (!viteUrl || !siteDesignId) { stage.appendChild(siteEl("div", "sess-desc", COPY.site.previewUnavailable)); return { el, push() {} }; }
  const wv = document.createElement("webview");
  wv.setAttribute("partition", "persist:preview");
  wv.setAttribute("src", `${viteUrl}/?v=${encodeURIComponent(siteDesignId)}&blockpreview=${encodeURIComponent(type)}`);
  stage.appendChild(wv);
  let mode = "desktop"; let ready = false; let timer = null;
  const fit = () => {
    const w = stage.clientWidth || 600;
    if (mode === "mobile") { wv.style.width = "390px"; wv.style.margin = "0 auto"; try { wv.setZoomFactor(1); } catch {} }
    else { wv.style.width = "100%"; wv.style.margin = "0"; try { wv.setZoomFactor(Math.max(0.2, Math.min(1, w / 1280))); } catch {} }
  };
  const send = () => { if (!ready) return; try { wv.executeJavaScript(`window.__taSetBlockProps && window.__taSetBlockProps(${JSON.stringify(getProps() || {})})`); } catch {} };
  const push = () => { clearTimeout(timer); timer = setTimeout(send, 150); };
  wv.addEventListener("dom-ready", () => { ready = true; fit(); send(); });
  wv.addEventListener("did-finish-load", () => { ready = true; fit(); send(); });
  const mk = (m, label) => { const b = siteEl("button", "site-mini" + (mode === m ? " on" : ""), label); b.type = "button"; b.addEventListener("click", () => { mode = m; bar.querySelectorAll(".site-mini").forEach((x) => x.classList.toggle("on", x === b)); fit(); }); return b; };
  bar.append(mk("desktop", COPY.site.previewDesktop), mk("mobile", COPY.site.previewMobile));
  if (onExpand) { const ex = siteMini(COPY.site.previewExpand, onExpand, { title: COPY.site.previewExpandTip }); ex.style.marginLeft = "auto"; bar.appendChild(ex); }
  window.addEventListener("resize", fit);
  return { el, push, fit };
}

// The block editor expanded into its own overlay: fields in a column on the left, the
// block filling the rest at a much larger size. Edits the SAME draft as the inline
// editor (nothing to sync); Done closes and repaints the inline view.
function openBlockEditModal({ title, type, props, ctx, onChange, onSave, canSave, onClose }) {
  const ov = siteEl("div", "blockedit");
  const card = siteEl("div", "blockedit-card");
  const head = siteEl("div", "blockedit-head");
  head.appendChild(siteEl("div", "blockedit-title", title));
  const acts = siteEl("div", "blockedit-acts");
  const save = siteEl("button", "panelbtn primary", COPY.site.save); save.style.cssText = "margin:0;width:auto;"; save.disabled = !canSave();
  const done = siteEl("button", "panelbtn", COPY.site.blockEditDone); done.style.cssText = "margin:0;width:auto;";
  acts.append(save, done); head.appendChild(acts);
  const body = siteEl("div", "blockedit-body");
  const fields = siteEl("div", "blockedit-fields");
  const preview = siteBlockPreview(type, () => props);
  const change = () => { onChange(); preview.push(); save.disabled = !canSave(); };
  fields.appendChild(sitePropsEditor(props, change, 0, ctx));
  const pv = siteEl("div", "blockedit-preview"); pv.appendChild(preview.el);
  body.append(fields, pv); card.append(head, body); ov.appendChild(card);
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  done.addEventListener("click", close);
  save.addEventListener("click", async () => { save.disabled = true; await onSave(); save.disabled = !canSave(); });
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(ov);
  requestAnimationFrame(() => preview.fit && preview.fit());
  return { close };
}

// Generic editor for a block's props: strings → input/textarea, numbers, booleans,
// arrays of strings, and nested objects / arrays of objects (add/remove, a new item
// cloned from the last one's shape). `ctx` carries the schema introspection
// ({ templates, fields }): list-item templates and field kinds by dotted path.
// Without it the value's shape decides; the build validates either way.
function sitePropsEditor(value, onChange, depth = 0, ctx = {}, at = "") {
  const templates = ctx.templates || {};
  const fields = ctx.fields || {};
  const box = siteEl("div", depth ? "" : "site-props");
  const keys = Object.keys(value || {});
  for (const key of keys) {
    const v = value[key];
    const here = at ? `${at}.${key}` : key; // dotted path, list indices skipped
    const meta = fields[here];
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
    if (typeof v === "boolean") {
      const row = siteEl("label", "toggle-row");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = v;
      cb.addEventListener("change", () => { value[key] = cb.checked; onChange(); });
      row.append(cb, siteEl("span", "", label));
      box.appendChild(row);
    } else if (typeof v === "number") {
      const { wrap, input } = siteField(label, v, { type: "number" });
      input.addEventListener("input", () => { value[key] = Number(input.value); onChange(); });
      box.appendChild(wrap);
    } else if (typeof v === "string" && meta && meta.kind === "enum" && meta.options && meta.options.length) {
      // A choice. Over the design's marks it's a visual picker; otherwise a select.
      const wrap = siteEl("div", "site-kv");
      wrap.appendChild(siteEl("div", "k", label));
      if (meta.ui === "side") {
        // Two-column layout: a segmented Image left / Image right control.
        wrap.querySelector(".k").textContent = COPY.site.side.label;
        const seg = siteEl("div", "site-side");
        const mk = (opt, text, icon) => {
          const b = siteEl("button", "site-side-opt" + (v === opt ? " on" : "")); b.type = "button";
          b.innerHTML = icon + `<span>${text}</span>`;
          b.addEventListener("click", () => { value[key] = opt; v = opt; onChange(); seg.querySelectorAll(".site-side-opt").forEach((x) => x.classList.toggle("on", x === b)); });
          return b;
        };
        seg.append(
          mk("left", COPY.site.side.left, '<svg viewBox="0 0 24 16" aria-hidden="true"><rect x="1" y="1" width="9" height="14" rx="1.5"/><rect x="13" y="3" width="10" height="2" rx="1"/><rect x="13" y="7" width="10" height="2" rx="1"/><rect x="13" y="11" width="7" height="2" rx="1"/></svg>'),
          mk("right", COPY.site.side.right, '<svg viewBox="0 0 24 16" aria-hidden="true"><rect x="14" y="1" width="9" height="14" rx="1.5"/><rect x="1" y="3" width="10" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="11" width="7" height="2" rx="1"/></svg>'),
        );
        wrap.appendChild(seg);
      } else if (meta.options.every((o) => siteMarks[o])) {
        wrap.appendChild(siteMarkPicker(meta.options, v, (k) => { value[key] = k; onChange(); }, siteMarks));
      } else {
        const sel = document.createElement("select"); sel.className = "field";
        meta.options.forEach((o) => { const opt = document.createElement("option"); opt.value = String(o); opt.textContent = String(o).replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase()); sel.appendChild(opt); });
        sel.value = v; sel.addEventListener("change", () => { value[key] = sel.value; onChange(); });
        wrap.appendChild(sel);
      }
      box.appendChild(wrap);
    } else if (typeof v === "string" && meta && meta.kind === "richtext") {
      // Prose: the rich text editor (markdown on disk, rendered by <Rich> in the block).
      const wrap = siteEl("div", "site-kv");
      wrap.appendChild(siteEl("div", "k", label));
      const rich = siteRichEditor(v, () => { value[key] = rich.getMarkdown(); onChange(); }, { compact: true });
      wrap.appendChild(rich.wrap);
      box.appendChild(wrap);
    } else if (typeof v === "string" && siteLooksLikeImage(key, v, meta)) {
      // A bare path prop: the upload field, writing the path back (no alt to keep).
      box.appendChild(siteImageControl(v, (next) => { value[key] = next ? next.src : ""; onChange(); }, { label, noAlt: true }));
    } else if (typeof v === "string") {
      const { wrap, input } = siteField(label, v, { textarea: v.length > 60 || /\n/.test(v) });
      input.addEventListener("input", () => { value[key] = input.value; onChange(); });
      box.appendChild(wrap);
    } else if (Array.isArray(v)) {
      const wrap = siteEl("div", "site-kv");
      wrap.appendChild(siteEl("div", "k", label));
      const tplItem = templates[here];
      const allStrings = v.length ? v.every((x) => typeof x === "string") : !(tplItem && typeof tplItem === "object");
      if (allStrings) {
        const ta = document.createElement("textarea"); ta.className = "field"; ta.value = v.join("\n");
        ta.placeholder = "One per line";
        ta.addEventListener("input", () => { value[key] = ta.value.split("\n").map((x) => x.trim()).filter(Boolean); onChange(); });
        wrap.appendChild(ta);
      } else {
        const list = siteEl("div");
        const paint = () => {
          list.innerHTML = "";
          v.forEach((item, i) => {
            const card = siteEl("div", "site-item");
            const head = siteEl("div", "site-item-head");
            head.appendChild(siteEl("span", "", COPY.site.listItem(i + 1)));
            const acts = siteEl("span");
            acts.append(
              siteMini("↑", () => { if (i > 0) { [v[i - 1], v[i]] = [v[i], v[i - 1]]; onChange(); paint(); } }, { disabled: i === 0, title: COPY.site.moveUp }),
              " ",
              siteMini("↓", () => { if (i < v.length - 1) { [v[i + 1], v[i]] = [v[i], v[i + 1]]; onChange(); paint(); } }, { disabled: i === v.length - 1, title: COPY.site.moveDown }),
              " ",
              siteMini(COPY.site.removeItem, () => { v.splice(i, 1); onChange(); paint(); }, { danger: true }),
            );
            head.appendChild(acts);
            card.appendChild(head);
            if (item && typeof item === "object") card.appendChild(sitePropsEditor(item, onChange, depth + 1, ctx, here));
            list.appendChild(card);
          });
        };
        paint();
        wrap.appendChild(list);
        wrap.appendChild(siteMini(COPY.site.addItem, () => {
          // A new item from the schema's template for this list; failing that, the
          // last item's shape with its text blanked.
          const tpl = templates[here];
          const last = v[v.length - 1];
          const blank = tpl !== undefined ? JSON.parse(JSON.stringify(tpl))
            : (last && typeof last === "object" ? JSON.parse(JSON.stringify(last), (k, x) => (typeof x === "string" ? "" : x)) : "");
          v.push(blank); onChange(); paint();
        }));
      }
      box.appendChild(wrap);
    } else if (v && typeof v === "object" && "src" in v) {
      // An image-shaped prop ({ src, alt }): the picker, never a typed path.
      box.appendChild(siteImageControl(v, (next) => { if (next) { value[key].src = next.src; value[key].alt = next.alt; } else { value[key].src = ""; } onChange(); }, { label }));
    } else if (v && typeof v === "object") {
      const wrap = siteEl("div", "site-kv");
      wrap.appendChild(siteEl("div", "k", label));
      wrap.appendChild(sitePropsEditor(v, onChange, depth + 1, ctx, here));
      box.appendChild(wrap);
    }
  }
  return box;
}

function renderSitePage(page, blocks, refresh, forceOpen) {
  const card = siteEl("div", forceOpen ? "" : "site-page");
  if (!forceOpen) {
    const head = siteEl("div", "site-page-head");
    const chevron = siteEl("span", "muted", siteRailState.open[page.id] ? "▾" : "▸");
    const title = siteEl("div", "site-page-title", page.title);
    const slug = siteEl("div", "site-page-slug", page.id === "home" ? COPY.site.homeSlug : "/" + (page.slug || page.id));
    head.append(chevron, title, slug);
    head.addEventListener("click", () => { siteRailState.open[page.id] = !siteRailState.open[page.id]; refresh(); });
    card.appendChild(head);
    if (!siteRailState.open[page.id]) return card;
  } else {
    const h = siteEl("div"); h.style.cssText = "display:flex;align-items:baseline;gap:10px;margin-bottom:10px;";
    h.append(siteEl("div", "site-page-title", page.title), siteEl("div", "site-page-slug", page.id === "home" ? COPY.site.homeSlug : "/" + (page.slug || page.id)));
    h.querySelector(".site-page-title").style.fontSize = "15px";
    card.appendChild(h);
  }

  // Working copy; Save writes it. Deep-cloned so a cancelled edit changes nothing.
  const draft = JSON.parse(JSON.stringify({ title: page.title, slug: page.slug, parent: page.parent || null, seo: page.seo || {}, blocks: page.blocks || [] }));
  let dirty = false;
  const markDirty = () => { dirty = true; saveBtn.disabled = false; };
  const body = siteEl("div"); body.style.marginTop = "10px";

  const ps = siteFold(COPY.site.pageSettings, "page-settings:" + page.id); body.appendChild(ps.sec);
  const t = siteField(COPY.site.pageTitle, draft.title); t.input.addEventListener("input", () => { draft.title = t.input.value; markDirty(); }); ps.body.appendChild(t.wrap);
  if (page.id !== "home") {
    const sl = siteField(COPY.site.pageSlug, draft.slug || page.id, { hint: COPY.site.pageSlugHint }); sl.input.addEventListener("input", () => { draft.slug = sl.input.value; markDirty(); }); ps.body.appendChild(sl.wrap);
    // Parent page: any page but home, itself, or one of its own descendants.
    const all = (renderSitePage.pages || []);
    const under = (id) => { let cur = all.find((x) => x.id === id); let g = 0; while (cur && cur.parent && g++ < 16) { if (cur.parent === page.id) return true; cur = all.find((x) => x.id === cur.parent); } return false; };
    const pw = siteEl("div", "site-kv"); pw.appendChild(siteEl("div", "k", COPY.site.pageParent));
    const psel = document.createElement("select"); psel.className = "field";
    const o0 = document.createElement("option"); o0.value = ""; o0.textContent = COPY.site.pageParentNone; psel.appendChild(o0);
    all.filter((x) => x.id !== "home" && x.id !== page.id && !under(x.id)).forEach((x) => { const o = document.createElement("option"); o.value = x.id; o.textContent = `${x.title}  ·  /${x.route || x.slug || x.id}`; psel.appendChild(o); });
    psel.value = draft.parent || ""; psel.addEventListener("change", () => { draft.parent = psel.value || null; markDirty(); });
    pw.appendChild(psel); pw.appendChild(siteEl("div", "sess-desc", COPY.site.pageParentHint)); ps.body.appendChild(pw);
  }

  ps.body.appendChild(siteEl("div", "sess-label", COPY.site.seoHeading)).style.marginTop = "12px";
  const st = siteField(COPY.site.seoTitle, draft.seo.title, { hint: COPY.site.seoTitleHint }); st.input.addEventListener("input", () => { draft.seo.title = st.input.value; markDirty(); }); ps.body.appendChild(st.wrap);
  const sd = siteField(COPY.site.seoDescription, draft.seo.description, { textarea: true, hint: COPY.site.seoDescriptionHint }); sd.input.addEventListener("input", () => { draft.seo.description = sd.input.value; markDirty(); }); ps.body.appendChild(sd.wrap);
  ps.body.appendChild(siteImageControl(draft.seo.image, (next) => { draft.seo.image = next ? next.src : ""; markDirty(); }, { label: COPY.site.seoImage }));
  const nx = siteEl("label", "toggle-row"); const nxCb = document.createElement("input"); nxCb.type = "checkbox"; nxCb.checked = !!draft.seo.noindex;
  nxCb.addEventListener("change", () => { draft.seo.noindex = nxCb.checked; markDirty(); }); nx.append(nxCb, siteEl("span", "", COPY.site.seoNoindex)); ps.body.appendChild(nx);

  const bf = siteFold(COPY.site.blocksHeading, "blocks:" + page.id); body.appendChild(bf.sec);
  const blockList = siteEl("div");
  const byKey = Object.fromEntries(blocks.map((b) => [b.key, b]));
  const paintBlocks = () => {
    blockList.innerHTML = "";
    if (!draft.blocks.length) blockList.appendChild(siteEl("div", "sess-desc", COPY.site.noBlocks));
    draft.blocks.forEach((b, i) => {
      const row = siteEl("div", "site-block");
      const def = byKey[b.type];
      row.appendChild(siteEl("div", "site-block-name", def ? def.name : b.type));
      siteMakeDraggable(row, i, (from, to) => { const [m] = draft.blocks.splice(from, 1); draft.blocks.splice(to, 0, m); markDirty(); paintBlocks(); });
      const ek = page.id + ":" + i;
      row.append(
        siteMini("↑", () => { [draft.blocks[i - 1], draft.blocks[i]] = [draft.blocks[i], draft.blocks[i - 1]]; markDirty(); paintBlocks(); }, { disabled: i === 0, title: COPY.site.moveUp }),
        siteMini("↓", () => { [draft.blocks[i + 1], draft.blocks[i]] = [draft.blocks[i], draft.blocks[i + 1]]; markDirty(); paintBlocks(); }, { disabled: i === draft.blocks.length - 1, title: COPY.site.moveDown }),
        siteMini(siteRailState.expanded[ek] ? COPY.site.hideContent : COPY.site.editContent, () => { siteRailState.expanded[ek] = !siteRailState.expanded[ek]; paintBlocks(); }),
        siteTrashBtn(() => { draft.blocks.splice(i, 1); markDirty(); paintBlocks(); }, COPY.site.removeBlock),
      );
      blockList.appendChild(row);
      if (siteRailState.expanded[ek]) {
        // Older content may lack fields the block accepts: fill them from the defaults.
        const dflt = (def && def.defaults) || {};
        b.props = { ...JSON.parse(JSON.stringify(dflt)), ...(b.props || {}) };
        // Fields left, the block as designed right, live (docs/block-editor-preview-spec.md).
        const edit = siteEl("div", "site-block-edit");
        const ctx = { templates: (def && def.templates) || {}, fields: (def && def.fields) || {} };
        const preview = siteBlockPreview(b.type, () => b.props, {
          onExpand: () => openBlockEditModal({
            title: def ? def.name : b.type, type: b.type, props: b.props, ctx,
            onChange: markDirty, canSave: () => dirty,
            onSave: async () => { saveBtn.click(); await new Promise((r) => setTimeout(r, 400)); },
            onClose: paintBlocks, // the inline fields catch up with what was edited large
          }),
        });
        const onChange = () => { markDirty(); preview.push(); };
        edit.appendChild(sitePropsEditor(b.props, onChange, 0, ctx));
        edit.appendChild(preview.el);
        blockList.appendChild(edit);
      }
    });
  };
  paintBlocks();
  bf.body.appendChild(blockList);
  if (blocks.length) {
    const addRow = siteEl("div"); addRow.style.cssText = "display:flex;gap:6px;align-items:center;margin:6px 0 4px;";
    const sel = document.createElement("select"); sel.className = "field"; sel.style.marginBottom = "0";
    const o0 = document.createElement("option"); o0.value = ""; o0.textContent = COPY.site.addBlock; sel.appendChild(o0);
    blocks.forEach((b) => { const o = document.createElement("option"); o.value = b.key; o.textContent = b.name; if (b.description) o.title = b.description; sel.appendChild(o); });
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      const def = byKey[sel.value];
      draft.blocks.push({ type: sel.value, props: siteAlternateSide(draft.blocks, JSON.parse(JSON.stringify((def && def.defaults) || {})), def) });
      siteRailState.expanded[page.id + ":" + (draft.blocks.length - 1)] = true; // open it: the fields are the point
      sel.value = ""; markDirty(); paintBlocks();
    });
    // "Design a new block…": the designer describes it, the request goes to the chat as
    // /design-block (a licensed skill); the block appears in the list when it lands.
    const dz = siteEl("div"); dz.style.cssText = "margin:4px 0 8px;";
    const dzBtn = siteEl("button", "site-link", COPY.site.designBlock); dzBtn.type = "button";
    const dzForm = siteEl("div"); dzForm.hidden = true; dzForm.style.cssText = "margin-top:8px;";
    dzForm.appendChild(siteEl("div", "sess-desc", COPY.site.designBlockPrompt));
    const dzIn = document.createElement("textarea"); dzIn.className = "field"; dzIn.placeholder = COPY.site.designBlockPlaceholder; dzIn.style.minHeight = "56px";
    const dzRow = siteEl("div"); dzRow.style.cssText = "display:flex;gap:8px;align-items:center;";
    const dzGo = siteEl("button", "panelbtn primary", COPY.site.designBlockGo); dzGo.style.cssText = "margin:0;width:auto;";
    const dzNo = siteMini(COPY.site.designBlockCancel, () => { dzForm.hidden = true; });
    dzRow.append(dzGo, dzNo); dzForm.append(dzIn, dzRow);
    dzBtn.addEventListener("click", () => { dzForm.hidden = !dzForm.hidden; if (!dzForm.hidden) dzIn.focus(); });
    dzGo.addEventListener("click", () => {
      // Strip a page suffix someone typed or pasted ("(add it to the … page)", "Page: …")
      // so the request carries the page exactly once.
      const desc = dzIn.value.trim().replace(/\s*\(add it to the [^)]*page\)?\s*/gi, " ").replace(/\n?\s*Page:\s*.+$/i, "").trim();
      if (!desc) return;
      closeModal();
      // The command goes to Claude; the chat echoes a plain sentence.
      runAgent(COPY.site.designBlockRequest(desc, page.title), COPY.site.designBlockEcho(desc, page.title));
    });
    dz.append(dzBtn, dzForm);
    addRow.appendChild(sel); bf.body.appendChild(addRow); bf.body.appendChild(dz);
  }

  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;";
  const saveBtn = siteEl("button", "panelbtn primary", COPY.site.save); saveBtn.disabled = true; saveBtn.style.margin = "0";
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true; saveBtn.textContent = COPY.site.saving;
    const res = await window.desktop.saveSitePage(page.id, draft);
    saveBtn.textContent = COPY.site.save;
    if (res && res.ok) { dirty = false; siteFlash(actions, COPY.site.saved); refresh(); }
    else { saveBtn.disabled = false; const e = siteEl("div", "muted", (res && res.error) || "Couldn't save."); e.style.color = "#e5484d"; actions.appendChild(e); }
  });
  actions.appendChild(saveBtn);
  if (page.id !== "home") {
    actions.appendChild(siteMini(COPY.site.deletePage, async () => {
      if (!confirm(COPY.site.deleteConfirm(page.title))) return;
      const res = await window.desktop.deleteSitePage(page.id);
      if (res && res.ok) { siteRailState.selected = null; refresh(); }
    }, { danger: true }));
  }
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

function renderSitePost(post, refresh) {
  const S = COPY.site;
  const card = siteEl("div");
  const h = siteEl("div"); h.style.cssText = "display:flex;align-items:baseline;gap:10px;margin-bottom:10px;";
  h.append(siteEl("div", "site-page-title", post.title), siteEl("div", "site-page-slug", "/" + siteBlogPath + "/" + post.id));
  h.querySelector(".site-page-title").style.fontSize = "15px";
  card.appendChild(h);
  const draft = JSON.parse(JSON.stringify({ title: post.title, date: post.date, description: post.description, image: post.image, tags: post.tags || [], draft: !!post.draft, seo: post.seo || {}, body: post.body || "" }));
  let saveBtn;
  const dirty = () => { saveBtn.disabled = false; };
  const t = siteField(S.pageTitle, draft.title); t.input.addEventListener("input", () => { draft.title = t.input.value; dirty(); }); card.appendChild(t.wrap);
  const d = siteField(S.postDate, draft.date, { type: "date" }); d.input.addEventListener("input", () => { draft.date = d.input.value; dirty(); }); card.appendChild(d.wrap);
  const upd = siteEl("div", "site-kv"); upd.appendChild(siteEl("div", "k", S.postUpdated));
  let updText = S.postNeverSaved;
  if (post.updated) { try { updText = new Date(post.updated).toLocaleString(); } catch { updText = String(post.updated); } }
  upd.appendChild(siteEl("div", "sess-desc", updText)); card.appendChild(upd);
  const ds = siteField(S.postDescription, draft.description, { textarea: true, hint: S.postDescriptionHint }); ds.input.addEventListener("input", () => { draft.description = ds.input.value; dirty(); }); card.appendChild(ds.wrap);
  card.appendChild(siteImageControl(draft.image, (next) => { draft.image = next ? next.src : ""; dirty(); }, { label: S.postImage }));
  const tg = siteField(S.postTags, draft.tags.join(", "), { hint: S.postTagsHint }); tg.input.addEventListener("input", () => { draft.tags = tg.input.value.split(",").map((x) => x.trim()).filter(Boolean); dirty(); }); card.appendChild(tg.wrap);
  const bodyWrap = siteEl("div", "site-kv"); bodyWrap.appendChild(siteEl("div", "k", S.postBody));
  const rich = siteRichEditor(draft.body, () => { draft.body = rich.getMarkdown(); dirty(); });
  bodyWrap.appendChild(rich.wrap); bodyWrap.appendChild(siteEl("div", "sess-desc", S.postBodyHint)); card.appendChild(bodyWrap);
  card.appendChild(siteEl("div", "sess-label", S.seoHeading)).style.marginTop = "12px";
  const st = siteField(S.seoTitle, draft.seo.title, { hint: S.seoTitleHint }); st.input.addEventListener("input", () => { draft.seo.title = st.input.value; dirty(); }); card.appendChild(st.wrap);
  const nx = siteEl("label", "toggle-row"); const nxCb = document.createElement("input"); nxCb.type = "checkbox"; nxCb.checked = !!draft.seo.noindex;
  nxCb.addEventListener("change", () => { draft.seo.noindex = nxCb.checked; dirty(); }); nx.append(nxCb, siteEl("span", "", S.seoNoindex)); card.appendChild(nx);

  // Status + actions. A draft is never built; Publish flips it live on save.
  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;";
  const status = siteEl("span", "site-status" + (draft.draft ? " draft" : ""), draft.draft ? S.statusDraft : S.statusPublished);
  const doSave = async (btn, asDraft) => {
    const label = btn.textContent; btn.disabled = true; btn.textContent = S.saving;
    const res = await window.desktop.saveSitePost(post.id, { ...draft, draft: asDraft });
    btn.textContent = label;
    if (res && res.ok) { siteFlash(actions, S.saved); refresh(); }
    else { btn.disabled = false; const e = siteEl("div", "muted", (res && res.error) || "Couldn't save."); e.style.color = "#e5484d"; actions.appendChild(e); }
  };
  saveBtn = siteEl("button", "panelbtn primary", draft.draft ? S.saveDraft : S.savePost); saveBtn.disabled = true; saveBtn.style.margin = "0";
  saveBtn.addEventListener("click", () => doSave(saveBtn, draft.draft));
  const flipBtn = siteEl("button", "panelbtn", draft.draft ? S.publish : S.unpublish); flipBtn.style.margin = "0"; flipBtn.style.width = "auto";
  flipBtn.addEventListener("click", () => doSave(flipBtn, !draft.draft));
  actions.append(status, saveBtn, flipBtn);
  actions.appendChild(siteMini(S.deletePost, async () => {
    if (!confirm(S.deletePostConfirm(post.title))) return;
    const res = await window.desktop.deleteSitePost(post.id);
    if (res && res.ok) { siteRailState.selected = null; refresh(); }
  }, { danger: true }));
  card.appendChild(actions);
  return card;
}

// --- Content types in the Pages drawer -----------------------------------------
// A type = fields + a page template (blocks with {{field}} bindings) + an address.
// Entry forms are rendered FROM the field definitions (a real form per kind), so
// a designer's type gets a proper editor without any code.

// One field's control, by kind. Returns { wrap, get } where get() reads the value.
function siteTypeFieldControl(f, value, onChange, ctx) {
  const S = COPY.site;
  const wrap = siteEl("div", "site-kv");
  wrap.appendChild(siteEl("div", "k", f.label + (f.required ? " *" : "")));
  let get;
  const change = () => onChange();
  if (f.kind === "boolean") {
    wrap.className = "";
    const row = siteEl("label", "toggle-row"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!value;
    cb.addEventListener("change", change); row.append(cb, siteEl("span", "", f.label)); wrap.innerHTML = ""; wrap.appendChild(row);
    get = () => cb.checked;
  } else if (f.kind === "select") {
    const sel = document.createElement("select"); sel.className = "field";
    const o0 = document.createElement("option"); o0.value = ""; o0.textContent = S.noneOption; sel.appendChild(o0);
    (f.options || []).forEach((o) => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; sel.appendChild(opt); });
    sel.value = value || ""; sel.addEventListener("change", change); wrap.appendChild(sel);
    get = () => sel.value;
  } else if (f.kind === "reference") {
    const sel = document.createElement("select"); sel.className = "field";
    const o0 = document.createElement("option"); o0.value = ""; o0.textContent = S.noneOption; sel.appendChild(o0);
    ((ctx.entries && ctx.entries[f.reference]) || []).forEach((e) => { const opt = document.createElement("option"); opt.value = e.id; opt.textContent = e.title; sel.appendChild(opt); });
    sel.value = value || ""; sel.addEventListener("change", change); wrap.appendChild(sel);
    get = () => sel.value;
  } else if (f.kind === "image") {
    let cur = value && value.src ? { src: value.src, alt: value.alt || "" } : "";
    wrap.appendChild(siteImageControl(cur, (next) => { cur = next; change(); }));
    get = () => cur;
  } else if (f.kind === "link") {
    const lab = document.createElement("input"); lab.className = "field"; lab.placeholder = S.linkLabel; lab.value = (value && value.label) || "";
    const href = document.createElement("input"); href.className = "field"; href.placeholder = S.linkHref; href.value = (value && value.href) || "";
    lab.addEventListener("input", change); href.addEventListener("input", change); wrap.append(lab, href);
    get = () => (href.value.trim() ? { label: lab.value.trim(), href: href.value.trim() } : "");
  } else if (f.kind === "list") {
    const ta = document.createElement("textarea"); ta.className = "field"; ta.value = Array.isArray(value) ? value.join("\n") : ""; ta.placeholder = S.listHint;
    ta.addEventListener("input", change); wrap.appendChild(ta);
    get = () => ta.value.split("\n").map((x) => x.trim()).filter(Boolean);
  } else if (f.kind === "richtext") {
    const rich = siteRichEditor(value == null ? "" : String(value), change, { compact: true });
    wrap.appendChild(rich.wrap);
    get = () => rich.getMarkdown();
  } else {
    const multi = f.kind === "textarea";
    const input = document.createElement(multi ? "textarea" : "input"); input.className = "field";
    if (!multi) input.type = f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text";
    input.value = value == null ? "" : String(value);
    input.addEventListener("input", change); wrap.appendChild(input);
    get = () => (f.kind === "number" ? (input.value === "" ? "" : Number(input.value)) : input.value);
  }
  if (f.hint) wrap.appendChild(siteEl("div", "sess-desc", f.hint));
  return { wrap, get };
}

function renderSiteEntry(type, entry, ctx, refresh) {
  const S = COPY.site;
  const card = siteEl("div");
  const h = siteEl("div"); h.style.cssText = "display:flex;align-items:baseline;gap:10px;margin-bottom:10px;";
  h.append(siteEl("div", "site-page-title", entry.title), siteEl("div", "site-page-slug", `${type.path}/${entry.slug || entry.id}`));
  h.querySelector(".site-page-title").style.fontSize = "15px";
  card.appendChild(h);
  let saveBtn; const dirty = () => { saveBtn.disabled = false; };
  const t = siteField(S.pageTitle, entry.title); t.input.addEventListener("input", dirty); card.appendChild(t.wrap);
  const sl = siteField(S.pageSlug, entry.slug || entry.id); sl.input.addEventListener("input", dirty); card.appendChild(sl.wrap);
  const controls = type.fields.map((f) => { const c = siteTypeFieldControl(f, entry[f.key], dirty, ctx); card.appendChild(c.wrap); return [f.key, c.get]; });
  // Own blocks (a landing page) instead of the template.
  const blocksDraft = Array.isArray(entry.blocks) ? JSON.parse(JSON.stringify(entry.blocks)) : null;
  const own = siteEl("label", "toggle-row"); const ownCb = document.createElement("input"); ownCb.type = "checkbox"; ownCb.checked = !!blocksDraft;
  own.append(ownCb, siteEl("span", "", S.entryOwnBlocks)); card.appendChild(own);
  const ownHost = siteEl("div"); card.appendChild(ownHost);
  let ownBlocks = blocksDraft || [];
  const paintOwn = () => {
    ownHost.innerHTML = "";
    if (!ownCb.checked) return;
    ownHost.appendChild(siteBlocksEditor(ownBlocks, ctx.blocks, dirty, type.key + ":" + entry.id));
  };
  ownCb.addEventListener("change", () => { dirty(); paintOwn(); });
  paintOwn();
  card.appendChild(siteEl("div", "sess-label", S.seoHeading)).style.marginTop = "12px";
  const seo = entry.seo || {};
  const st = siteField(S.seoTitle, seo.title, { hint: S.seoTitleHint }); st.input.addEventListener("input", dirty); card.appendChild(st.wrap);
  const sd = siteField(S.seoDescription, seo.description, { textarea: true, hint: S.seoDescriptionHint }); sd.input.addEventListener("input", dirty); card.appendChild(sd.wrap);
  const nx = siteEl("label", "toggle-row"); const nxCb = document.createElement("input"); nxCb.type = "checkbox"; nxCb.checked = !!seo.noindex; nxCb.addEventListener("change", dirty);
  nx.append(nxCb, siteEl("span", "", S.seoNoindex)); card.appendChild(nx);

  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;";
  saveBtn = siteEl("button", "panelbtn primary", S.saveEntry); saveBtn.disabled = true; saveBtn.style.margin = "0";
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true; saveBtn.textContent = S.saving;
    const data = { title: t.input.value, slug: sl.input.value, seo: { title: st.input.value, description: sd.input.value, noindex: nxCb.checked } };
    for (const [k, get] of controls) data[k] = get();
    if (ownCb.checked) data.blocks = ownBlocks;
    const res = await window.desktop.saveSiteEntry(type.key, entry.id, data);
    saveBtn.textContent = S.saveEntry;
    if (res && res.ok) { siteFlash(actions, S.saved); refresh(); }
    else { saveBtn.disabled = false; const e = siteEl("div", "muted", (res && res.error) || "Couldn't save."); e.style.color = "#e5484d"; actions.appendChild(e); }
  });
  actions.appendChild(saveBtn);
  actions.appendChild(siteMini(S.deleteEntry, async () => {
    if (!confirm(S.deleteEntryConfirm(entry.title))) return;
    const res = await window.desktop.deleteSiteEntry(type.key, entry.id);
    if (res && res.ok) { siteRailState.selected = null; refresh(); }
  }, { danger: true }));
  card.appendChild(actions);
  return card;
}

// A reorderable block list with add-from-registry and the props editor. Shared by
// an entry's own blocks and a type's template (where props may hold {{field}}).
function siteBlocksEditor(list, blocks, onChange, stateKey) {
  const S = COPY.site;
  const host = siteEl("div");
  const byKey = Object.fromEntries(blocks.map((b) => [b.key, b]));
  const paint = () => {
    host.innerHTML = "";
    if (!list.length) host.appendChild(siteEl("div", "sess-desc", S.noBlocks));
    list.forEach((b, i) => {
      const row = siteEl("div", "site-block");
      const def = byKey[b.type];
      row.appendChild(siteEl("div", "site-block-name", def ? def.name : b.type));
      siteMakeDraggable(row, i, (from, to) => { const [m] = list.splice(from, 1); list.splice(to, 0, m); onChange(); paint(); });
      const ek = stateKey + ":" + i;
      row.append(
        siteMini("↑", () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; onChange(); paint(); }, { disabled: i === 0, title: S.moveUp }),
        siteMini("↓", () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; onChange(); paint(); }, { disabled: i === list.length - 1, title: S.moveDown }),
        siteMini(siteRailState.expanded[ek] ? S.hideContent : S.editContent, () => { siteRailState.expanded[ek] = !siteRailState.expanded[ek]; paint(); }),
        siteTrashBtn(() => { list.splice(i, 1); onChange(); paint(); }, S.removeBlock),
      );
      host.appendChild(row);
      if (siteRailState.expanded[ek]) {
        const dflt = (def && def.defaults) || {};
        b.props = { ...JSON.parse(JSON.stringify(dflt)), ...(b.props || {}) };
        host.appendChild(sitePropsEditor(b.props, onChange, 0, { templates: (def && def.templates) || {}, fields: (def && def.fields) || {} }));
      }
    });
    if (blocks.length) {
      const sel = document.createElement("select"); sel.className = "field"; sel.style.margin = "6px 0 4px";
      const o0 = document.createElement("option"); o0.value = ""; o0.textContent = S.addBlock; sel.appendChild(o0);
      blocks.forEach((bd) => { const o = document.createElement("option"); o.value = bd.key; o.textContent = bd.name; sel.appendChild(o); });
      sel.addEventListener("change", () => {
        if (!sel.value) return;
        const def = byKey[sel.value];
        list.push({ type: sel.value, props: siteAlternateSide(list, JSON.parse(JSON.stringify((def && def.defaults) || {})), def) });
        siteRailState.expanded[stateKey + ":" + (list.length - 1)] = true;
        sel.value = ""; onChange(); paint();
      });
      host.appendChild(sel);
    }
  };
  paint();
  return host;
}

function renderSiteTypeEditor(type, ctx, refresh) {
  const S = COPY.site;
  const isNew = !type.key;
  const draft = JSON.parse(JSON.stringify({ key: type.key || "", label: type.label || "", singular: type.singular || "", path: type.path || "", fields: type.fields || [], template: type.template || [], index: type.index || null }));
  const card = siteEl("div");
  card.appendChild(siteEl("div", "site-page-title", isNew ? S.addType : S.editType + ": " + type.label)).style.cssText = "font-size:15px;margin-bottom:10px;";
  let saveBtn; const dirty = () => { saveBtn.disabled = false; };
  const lab = siteField(S.typeLabel, draft.label); card.appendChild(lab.wrap);
  const sing = siteField(S.typeSingular, draft.singular); card.appendChild(sing.wrap);
  const pth = siteField(S.typePath, draft.path, { hint: S.typePathHint }); card.appendChild(pth.wrap);
  const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  lab.input.addEventListener("input", () => { dirty(); if (isNew) { draft.key = slug(lab.input.value); if (!pth.input.dataset.touched) pth.input.value = "/" + draft.key; } });
  pth.input.addEventListener("input", () => { pth.input.dataset.touched = "1"; dirty(); });
  sing.input.addEventListener("input", dirty);
  if (isNew && !pth.input.value) pth.input.value = "/";
  // index page
  const ix = siteEl("label", "toggle-row"); const ixCb = document.createElement("input"); ixCb.type = "checkbox"; ixCb.checked = !!draft.index;
  ix.append(ixCb, siteEl("span", "", S.typeIndexToggle)); card.appendChild(ix);
  const ixHost = siteEl("div"); card.appendChild(ixHost);
  const ixT = siteField(S.typeIndexTitle, draft.index && draft.index.title); const ixD = siteField(S.typeIndexDescription, draft.index && draft.index.description, { textarea: true });
  ixT.input.addEventListener("input", dirty); ixD.input.addEventListener("input", dirty);
  const paintIx = () => { ixHost.innerHTML = ""; if (ixCb.checked) ixHost.append(ixT.wrap, ixD.wrap); };
  ixCb.addEventListener("change", () => { dirty(); paintIx(); }); paintIx();

  // fields
  card.appendChild(siteEl("div", "sess-label", S.fieldsHeading)).style.marginTop = "12px";
  card.appendChild(siteEl("div", "sess-desc", S.fieldsDesc));
  const fieldsHost = siteEl("div");
  const paintFields = () => {
    fieldsHost.innerHTML = "";
    draft.fields.forEach((f, i) => {
      const item = siteEl("div", "site-item");
      const head = siteEl("div", "site-item-head");
      head.appendChild(siteEl("span", "", f.key || COPY.site.listItem(i + 1)));
      const acts = siteEl("span");
      acts.append(siteMini("↑", () => { if (i > 0) { [draft.fields[i - 1], draft.fields[i]] = [draft.fields[i], draft.fields[i - 1]]; dirty(); paintFields(); } }, { disabled: i === 0 }), " ",
        siteMini(S.removeItem, () => { draft.fields.splice(i, 1); dirty(); paintFields(); }, { danger: true }));
      head.appendChild(acts); item.appendChild(head);
      const grid = siteEl("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;";
      const fl = document.createElement("input"); fl.className = "field"; fl.placeholder = S.fieldLabel; fl.value = f.label || "";
      const fk = document.createElement("input"); fk.className = "field"; fk.placeholder = S.fieldKey; fk.value = f.key || "";
      fl.addEventListener("input", () => { f.label = fl.value; if (!fk.dataset.touched) { f.key = slug(fl.value).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); fk.value = f.key; } dirty(); });
      fk.addEventListener("input", () => { fk.dataset.touched = "1"; f.key = fk.value.trim(); dirty(); });
      const kind = document.createElement("select"); kind.className = "field";
      Object.entries(S.kinds).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v; kind.appendChild(o); });
      kind.value = f.kind || "text";
      const req = siteEl("label", "toggle-row"); const reqCb = document.createElement("input"); reqCb.type = "checkbox"; reqCb.checked = !!f.required;
      reqCb.addEventListener("change", () => { f.required = reqCb.checked; dirty(); }); req.append(reqCb, siteEl("span", "", S.fieldRequired)); req.style.marginBottom = "0";
      grid.append(fl, fk, kind, req); item.appendChild(grid);
      const extra = siteEl("div"); item.appendChild(extra);
      const paintExtra = () => {
        extra.innerHTML = "";
        if (kind.value === "select") { const op = document.createElement("input"); op.className = "field"; op.placeholder = S.fieldOptions; op.value = (f.options || []).join(", "); op.style.marginTop = "6px"; op.addEventListener("input", () => { f.options = op.value.split(",").map((x) => x.trim()).filter(Boolean); dirty(); }); extra.appendChild(op); }
        if (kind.value === "reference") { const rf = document.createElement("select"); rf.className = "field"; rf.style.marginTop = "6px"; const o0 = document.createElement("option"); o0.value = ""; o0.textContent = S.fieldReference; rf.appendChild(o0); ctx.types.forEach((t) => { if (t.key !== draft.key) { const o = document.createElement("option"); o.value = t.key; o.textContent = t.label; rf.appendChild(o); } }); rf.value = f.reference || ""; rf.addEventListener("change", () => { f.reference = rf.value; dirty(); }); extra.appendChild(rf); }
      };
      kind.addEventListener("change", () => { f.kind = kind.value; dirty(); paintExtra(); });
      paintExtra();
      fieldsHost.appendChild(item);
    });
    fieldsHost.appendChild(siteMini(S.addField, () => { draft.fields.push({ key: "", label: "", kind: "text", required: false }); dirty(); paintFields(); }));
  };
  paintFields(); card.appendChild(fieldsHost);

  // template
  card.appendChild(siteEl("div", "sess-label", S.templateHeading)).style.marginTop = "12px";
  card.appendChild(siteEl("div", "sess-desc", S.templateDesc));
  card.appendChild(siteBlocksEditor(draft.template, ctx.blocks, dirty, "type:" + (draft.key || "new")));

  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;";
  saveBtn = siteEl("button", "panelbtn primary", S.saveType); saveBtn.disabled = !isNew; saveBtn.style.margin = "0";
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const out = { key: draft.key || slug(lab.input.value), label: lab.input.value, singular: sing.input.value, path: pth.input.value || ("/" + (draft.key || slug(lab.input.value))), fields: draft.fields, template: draft.template };
    if (ixCb.checked) out.index = { title: ixT.input.value, description: ixD.input.value };
    const res = await window.desktop.saveSiteType(out);
    if (res && res.ok) { siteRailState.selected = { kind: "type", id: res.type.key }; siteFlash(actions, S.saved); refresh(); }
    else { saveBtn.disabled = false; const e = siteEl("div", "muted", (res && res.error) || "Couldn't save."); e.style.color = "#e5484d"; actions.appendChild(e); }
  });
  actions.appendChild(saveBtn);
  if (!isNew) actions.appendChild(siteMini(S.deleteType, async () => {
    if (!confirm(S.deleteTypeConfirm(type.label))) return;
    const res = await window.desktop.deleteSiteType(type.key);
    if (res && res.ok) { siteRailState.selected = null; refresh(); }
  }, { danger: true }));
  card.appendChild(actions);
  return card;
}

// The Content types section of the left column: each type with its entries and an
// "Add <singular>" row; "Add a content type" at the end. Selection kinds:
// "type" (editing the declaration), "entry" (editing one entry), "newtype".
function renderSiteTypesList(left, right, ctx, refresh) {
  const S = COPY.site;
  const sel = siteRailState.selected && typeof siteRailState.selected === "object" ? siteRailState.selected : null;
  left.appendChild(siteEl("div", "sess-label", S.typesHeading)).style.marginTop = "12px";
  left.appendChild(siteEl("div", "sess-desc", S.typesDesc));
  ctx.types.forEach((t) => {
    const row = siteEl("div", "site-list-row" + (sel && sel.kind === "type" && sel.id === t.key ? " active" : ""));
    row.append(siteEl("div", "site-page-title", t.label), siteEl("div", "site-page-slug", S.entries((ctx.entries[t.key] || []).length)));
    row.addEventListener("click", () => { siteRailState.selected = { kind: "type", id: t.key }; refresh(); });
    left.appendChild(row);
    const list = siteEl("div"); list.style.cssText = "margin:0 0 6px 14px;";
    (ctx.entries[t.key] || []).forEach((e) => {
      const er = siteEl("div", "site-list-row" + (sel && sel.kind === "entry" && sel.id === t.key + "/" + e.id ? " active" : ""));
      er.style.padding = "6px 10px";
      er.append(siteEl("div", "site-page-title", e.title), siteEl("div", "site-page-slug", "/" + (e.slug || e.id)));
      er.addEventListener("click", () => { siteRailState.selected = { kind: "entry", id: t.key + "/" + e.id }; refresh(); });
      list.appendChild(er);
    });
    const addRow = siteEl("div"); addRow.style.cssText = "display:flex;gap:6px;align-items:center;margin:2px 0 6px;";
    const inp = document.createElement("input"); inp.className = "field"; inp.placeholder = S.newEntryPlaceholder; inp.style.marginBottom = "0";
    const btn = siteEl("button", "panelbtn", S.addEntry(t.singular || t.label)); btn.style.cssText = "margin:0;width:auto;white-space:nowrap;";
    const create = async () => { const v = inp.value.trim(); if (!v) return; const res = await window.desktop.createSiteEntry(t.key, v); if (res && res.ok) { siteRailState.selected = { kind: "entry", id: t.key + "/" + res.entry.id }; refresh(); } };
    btn.addEventListener("click", create); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") create(); });
    addRow.append(inp, btn); list.appendChild(addRow);
    left.appendChild(list);
  });
  const addType = siteEl("button", "panelbtn", S.addType); addType.style.margin = "4px 0 0";
  addType.addEventListener("click", () => { siteRailState.selected = { kind: "newtype", id: "" }; refresh(); });
  left.appendChild(addType);

  if (sel && sel.kind === "type") { const t = ctx.types.find((x) => x.key === sel.id); if (t) right.appendChild(renderSiteTypeEditor(t, ctx, refresh)); }
  else if (sel && sel.kind === "newtype") right.appendChild(renderSiteTypeEditor({}, ctx, refresh));
  else if (sel && sel.kind === "entry") {
    const [key, id] = sel.id.split("/");
    const t = ctx.types.find((x) => x.key === key); const e = t && (ctx.entries[key] || []).find((x) => x.id === id);
    if (t && e) right.appendChild(renderSiteEntry(t, e, ctx, refresh));
  }
}

// --- Media picker + the image control -------------------------------------------
// Every image field in the CMS is this control: a thumbnail with Choose / Change /
// Remove and an alt-text input. Choose opens the picker over the project's
// public/images (thumbnails, filter, add from disk); the path is written for the
// designer, never typed.
const mediapick = el("mediapick");
const mediapickBody = el("mediapick-body");
const mediapickBar = el("mediapick-bar");
let mediaPickResolve = null;

function closeMediaPicker(result) {
  mediapick.hidden = true;
  const r = mediaPickResolve; mediaPickResolve = null;
  if (r) r(result || null);
}
el("mediapick-close").addEventListener("click", () => closeMediaPicker(null));
mediapick.addEventListener("click", (e) => { if (e.target === mediapick) closeMediaPicker(null); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !mediapick.hidden) { closeMediaPicker(null); e.stopPropagation(); } }, true);

/** Open the picker; resolves with { url, name, width, height } or null. */
function openMediaPicker(current) {
  const M = COPY.site.media;
  el("mediapick-title").textContent = M.title;
  mediapick.hidden = false;
  return new Promise((resolve) => {
    mediaPickResolve = resolve;
    let items = []; let filter = ""; let selected = current || null;
    mediapickBar.innerHTML = ""; mediapickBody.innerHTML = "";
    const filterIn = document.createElement("input"); filterIn.className = "field"; filterIn.placeholder = M.filter;
    const upBtn = siteEl("button", "panelbtn", M.upload); upBtn.style.cssText = "margin:0;width:auto;white-space:nowrap;";
    const useBtn = siteEl("button", "panelbtn primary", M.use); useBtn.style.cssText = "margin:0;width:auto;white-space:nowrap;"; useBtn.disabled = true;
    mediapickBar.append(filterIn, upBtn, useBtn);
    upBtn.title = M.uploadNote;
    const paint = () => {
      mediapickBody.innerHTML = "";
      const shown = items.filter((it) => !filter || it.name.toLowerCase().includes(filter));
      mediapickBody.appendChild(siteEl("div", "sess-desc", M.uploadNote));
      if (!items.length) { mediapickBody.appendChild(siteEl("div", "muted", M.empty)); return; }
      const grid = siteEl("div", "media-grid");
      shown.forEach((it) => {
        const tile = siteEl("button", "media-tile" + (selected === it.url ? " active" : "")); tile.type = "button";
        const img = document.createElement("img"); img.src = it.file; img.alt = it.name; img.loading = "lazy";
        const meta = siteEl("div", "media-meta");
        meta.appendChild(siteEl("div", "", it.name));
        meta.appendChild(siteEl("div", "muted", (it.width ? M.dims(it.width, it.height) + " · " : "") + Math.max(1, Math.round(it.size / 1024)) + " KB"));
        tile.append(img, meta);
        tile.addEventListener("click", () => { selected = it.url; useBtn.disabled = false; paint(); });
        tile.addEventListener("dblclick", () => { closeMediaPicker(it); });
        tile.addEventListener("contextmenu", async (e) => {
          e.preventDefault();
          if (!confirm(M.deleteConfirm(it.name))) return;
          const r = await window.desktop.deleteMedia(it.rel);
          if (r && r.ok) { items = items.filter((x) => x !== it); if (selected === it.url) { selected = null; useBtn.disabled = true; } paint(); }
        });
        grid.appendChild(tile);
      });
      mediapickBody.appendChild(grid);
    };
    const load = async () => { items = await window.desktop.listMedia().catch(() => []); if (selected && !items.some((i) => i.url === selected)) { /* keep: may be a subfolder path */ } useBtn.disabled = !selected; paint(); };
    filterIn.addEventListener("input", () => { filter = filterIn.value.trim().toLowerCase(); paint(); });
    upBtn.addEventListener("click", async () => {
      upBtn.disabled = true; upBtn.textContent = M.uploading;
      const r = await window.desktop.uploadMedia();
      upBtn.disabled = false; upBtn.textContent = M.upload;
      if (r && r.ok && r.added && r.added.length) { selected = r.added[0]; await load(); }
    });
    useBtn.addEventListener("click", () => { const it = items.find((i) => i.url === selected); closeMediaPicker(it || (selected ? { url: selected } : null)); });
    load();
  });
}

// --- Rich text editor (TipTap, markdown on disk) --------------------------------
// One editor for every prose field in the CMS (post body, richtext fields): the
// designer types in a rendered document, the file keeps markdown. window.TAEditor
// is desktop/vendor/editor.js (bundled by desktop/build/bundle-editor.cjs).
const EDITOR_ICONS = {
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
  bullet: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  numbered: '<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  rule: '<path d="M5 12h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
};
const liveEditors = new Set(); // destroyed when the CMS drawer re-renders
function destroyLiveEditors() { liveEditors.forEach((e) => { try { e.destroy(); } catch {} }); liveEditors.clear(); }

/**
 * Mount a rich text editor. `markdown` is the initial value; onChange() fires on every
 * edit (read the value back through getMarkdown()). Returns { wrap, getMarkdown }.
 * Without the bundle (or if it fails) the field degrades to a markdown textarea.
 */
function siteRichEditor(markdown, onChange, { compact } = {}) {
  const E = COPY.site.editor;
  const wrap = siteEl("div", "ta-editor" + (compact ? " compact" : ""));
  const bar = siteEl("div", "ta-editor-bar");
  const ask = siteEl("div", "ta-editor-ask"); ask.hidden = true;
  const host = siteEl("div");
  const raw = document.createElement("textarea"); raw.className = "field raw"; raw.hidden = true; raw.value = markdown || "";
  const foot = siteEl("div", "ta-editor-foot");
  wrap.append(bar, ask, host, raw, foot);
  raw.addEventListener("input", onChange);

  let ed = null;
  try {
    ed = window.TAEditor && window.TAEditor.create(host, {
      markdown: markdown || "", placeholder: E.placeholder,
      resolveSrc: (src) => (/^\/images\//.test(src) ? (siteMediaFileUrl(src) || src) : src),
      onChange: () => { paint(); onChange(); },
    });
  } catch (e) { console.warn("[editor]", e); ed = null; }
  if (!ed) { bar.hidden = true; foot.hidden = true; host.hidden = true; raw.hidden = false; return { wrap, getMarkdown: () => raw.value }; }
  liveEditors.add(ed);
  const editor = ed.editor;

  // A one-row inline prompt (Electron has no window.prompt): link address, image alt.
  const showAsk = ({ label, placeholder, value, apply, onApply, extra }) => {
    ask.innerHTML = ""; ask.hidden = false;
    ask.appendChild(siteEl("span", "k", label));
    const inp = document.createElement("input"); inp.className = "field"; inp.placeholder = placeholder || ""; inp.value = value || "";
    const ok = siteMini(apply, () => { onApply(inp.value.trim()); hideAsk(); });
    const no = siteMini(E.cancel, () => { hideAsk(); editor.commands.focus(); });
    ask.append(inp, ok);
    if (extra) ask.appendChild(siteMini(extra.label, () => { extra.run(); hideAsk(); }, { danger: true }));
    ask.appendChild(no);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } if (e.key === "Escape") { e.preventDefault(); no.click(); } });
    inp.focus();
  };
  const hideAsk = () => { ask.hidden = true; ask.innerHTML = ""; };

  const buttons = [];
  const btn = (key, title, run, isOn, canRun) => {
    const b = document.createElement("button"); b.type = "button"; b.title = title;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${EDITOR_ICONS[key]}</svg>`;
    b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection
    b.addEventListener("click", run);
    bar.appendChild(b); buttons.push({ b, isOn, canRun }); return b;
  };
  const sep = () => bar.appendChild(siteEl("span", "sep"));
  const chain = () => editor.chain().focus();

  // Block type: Text / Heading / Subheading (H1 is the title).
  const block = document.createElement("select"); block.className = "field";
  [["p", E.blockText], ["h2", E.blockH2], ["h3", E.blockH3]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; block.appendChild(o); });
  block.addEventListener("change", () => { if (block.value === "p") chain().setParagraph().run(); else chain().toggleHeading({ level: Number(block.value.slice(1)) }).run(); });
  bar.appendChild(block); sep();
  btn("bold", E.bold, () => chain().toggleBold().run(), () => editor.isActive("bold"));
  btn("italic", E.italic, () => chain().toggleItalic().run(), () => editor.isActive("italic"));
  btn("strike", E.strike, () => chain().toggleStrike().run(), () => editor.isActive("strike"));
  sep();
  btn("bullet", E.bullet, () => chain().toggleBulletList().run(), () => editor.isActive("bulletList"));
  btn("numbered", E.numbered, () => chain().toggleOrderedList().run(), () => editor.isActive("orderedList"));
  btn("quote", E.quote, () => chain().toggleBlockquote().run(), () => editor.isActive("blockquote"));
  btn("code", E.code, () => chain().toggleCodeBlock().run(), () => editor.isActive("codeBlock"));
  sep();
  btn("link", E.link, () => {
    const cur = editor.getAttributes("link").href || "";
    showAsk({
      label: E.linkAsk, placeholder: E.linkPlaceholder, value: cur, apply: E.linkApply,
      onApply: (href) => { if (!href) chain().extendMarkRange("link").unsetLink().run(); else chain().extendMarkRange("link").setLink({ href }).run(); },
      extra: cur ? { label: E.linkRemove, run: () => chain().extendMarkRange("link").unsetLink().run() } : null,
    });
  }, () => editor.isActive("link"));
  btn("image", E.image, async () => {
    const it = await openMediaPicker(null);
    if (!it || !it.url) { editor.commands.focus(); return; }
    showAsk({ label: E.altAsk, placeholder: E.altPlaceholder, value: "", apply: E.altApply, onApply: (alt) => chain().setImage({ src: it.url, alt }).run() });
  }, () => editor.isActive("image"));
  btn("rule", E.rule, () => chain().setHorizontalRule().run(), () => false);
  sep();
  btn("undo", E.undo, () => chain().undo().run(), () => false, () => editor.can().undo());
  btn("redo", E.redo, () => chain().redo().run(), () => false, () => editor.can().redo());

  function paint() {
    buttons.forEach(({ b, isOn, canRun }) => { b.classList.toggle("on", !!isOn()); if (canRun) b.disabled = !canRun(); });
    block.value = editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";
  }
  editor.on("selectionUpdate", paint); editor.on("transaction", paint); paint();

  // Markdown toggle: the raw file, for the fix the toolbar can't make (and for trust).
  let showingRaw = false;
  const toggle = siteMini(E.showMarkdown, () => {
    showingRaw = !showingRaw;
    if (showingRaw) { raw.value = ed.getMarkdown(); raw.hidden = false; host.hidden = true; bar.hidden = true; hideAsk(); raw.focus(); }
    else { ed.setMarkdown(raw.value); raw.hidden = true; host.hidden = false; bar.hidden = false; onChange(); editor.commands.focus(); }
    toggle.textContent = showingRaw ? E.showEditor : E.showMarkdown;
  });
  foot.appendChild(toggle);
  return { wrap, getMarkdown: () => (showingRaw ? raw.value : ed.getMarkdown()) };
}

/**
 * The image control: the same drop/click upload zone as Get Designing (a file is
 * dropped or chosen, brought into public/images and optimized, and selected), a
 * link to pick an existing project image, and the alt text beneath. `value` is
 * { src, alt } (or a string path for legacy props); onChange(next) receives
 * { src, alt } or "" when cleared.
 */
function siteImageControl(value, onChange, { label, noAlt, raw, accept } = {}) {
  const M = COPY.site.media;
  let cur = typeof value === "string" ? { src: value, alt: "" } : (value && typeof value === "object" ? { src: value.src || "", alt: value.alt || "" } : { src: "", alt: "" });
  const wrap = siteEl("div", "site-kv");
  if (label) wrap.appendChild(siteEl("div", "k", label));

  const zone = document.createElement("label"); zone.className = "site-img-zone";
  const preview = document.createElement("img"); preview.className = "site-img-preview";
  const hint = siteEl("div", "site-img-hint");
  const input = document.createElement("input"); input.type = "file"; input.accept = accept || "image/*,.heic,.heif,.tif,.tiff"; input.style.display = "none";
  zone.append(preview, hint, input);
  wrap.appendChild(zone);

  const links = siteEl("div", "site-img-links");
  const chooseLink = siteEl("button", "site-link", M.chooseExisting); chooseLink.type = "button";
  const removeLink = siteEl("button", "site-link danger", M.clear); removeLink.type = "button";
  links.append(chooseLink, removeLink);
  wrap.appendChild(links);

  const alt = document.createElement("input"); alt.className = "field"; alt.value = cur.alt;
  if (!noAlt) { wrap.appendChild(siteEl("div", "k site-img-altlabel", M.altLabel)); wrap.appendChild(alt); }

  const emit = () => onChange(cur.src ? { src: cur.src, alt: alt.value.trim() } : "");
  const paint = () => {
    const file = cur.src ? (/^https?:/.test(cur.src) ? cur.src : siteMediaFileUrl(cur.src)) : null;
    if (cur.src && file) { preview.src = file; preview.style.display = "block"; }
    else { preview.removeAttribute("src"); preview.style.display = "none"; }
    hint.textContent = cur.src ? (cur.src.split("/").pop() + " · " + M.dropReplace) : M.dropHint;
    zone.classList.toggle("has-image", !!cur.src);
    removeLink.hidden = !cur.src;
  };
  const importFiles = async (files) => {
    const paths = Array.from(files || []).map((f) => { try { return window.desktop.pathForFile(f); } catch { return null; } }).filter(Boolean);
    if (!paths.length) return;
    hint.textContent = M.importing;
    const r = await window.desktop.importMedia(paths, { raw: !!raw });
    if (r && r.ok && r.added && r.added.length) {
      mediaIndex = await window.desktop.listMedia().catch(() => mediaIndex);
      cur = { src: r.added[0], alt: cur.alt }; paint(); emit();
    } else paint();
  };
  input.addEventListener("change", () => { importFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => importFiles(e.dataTransfer && e.dataTransfer.files));
  chooseLink.addEventListener("click", async () => { const it = await openMediaPicker(cur.src || null); if (it && it.url) { cur = { src: it.url, alt: cur.alt }; paint(); emit(); } });
  removeLink.addEventListener("click", () => { cur = { src: "", alt: cur.alt }; paint(); emit(); });
  alt.addEventListener("input", () => { cur.alt = alt.value; emit(); });
  paint();
  return wrap;
}
// Thumbnails for existing values need the file URL behind a "/images/…" path. The
// listing is preloaded when the Pages drawer renders (mediaIndex), so this is sync.
let mediaIndex = [];
function siteMediaFileUrl(url) {
  const hit = mediaIndex.find((i) => i.url === url);
  return hit ? hit.file : null;
}

// Everything in the project a link can point at, for the URL combo in Navigation.
// Drag-and-drop for the Pages tree. While dragging, a GHOST row shows exactly where
// the page will land: above a row (upper half), or below it (lower half) at a level
// set by how far the pointer has moved SIDEWAYS since the drag began: right = a
// child of that row (drawn indented beneath it), left = one level up from it,
// neither = the same level. Home is the root: nothing nests under it.
let pageDrag = null;
let pageDragX = 0; // pointer x at dragstart; sideways movement picks the level
const PAGE_INDENT = 14; // px per tree level (matches the rows' marginLeft)
let pageDropTarget = null; // { p, zone, grandparent } the ghost currently stands for
function sitePageGhost() {
  let g = document.querySelector(".site-drop-ghost");
  if (!g) {
    g = siteEl("div", "site-drop-ghost"); g.appendChild(siteEl("span", "site-drop-ghost-arrow")); g.appendChild(siteEl("span", "site-drop-ghost-title"));
    // Inserting the ghost shifts rows, so the pointer is often over the ghost itself
    // at release: it accepts the drop for the target it represents.
    g.addEventListener("dragover", (e) => { if (pageDrag && pageDropTarget) { e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch {} } });
    g.addEventListener("drop", (e) => { if (pageDrag && pageDropTarget) { e.preventDefault(); sitePageDrop(pageDropTarget); } });
  }
  return g;
}
async function sitePageDrop({ p, zone, grandparent, pages, refresh }) {
  const g = document.querySelector(".site-drop-ghost"); if (g) g.remove();
  const moved = pageDrag; pageDrag = null; pageDropTarget = null;
  if (!moved) return;
  // Where it lands: the parent, and its position among that parent's children (the
  // moved page itself excluded, so the index matches what main will splice into).
  const kidsOf = (pid) => pages.filter((x) => x.id !== "home" && x.id !== moved.id && (x.parent || null) === (pid || null)).sort((a, b) => ((a.order ?? 1e9) - (b.order ?? 1e9)) || a.title.localeCompare(b.title));
  let parent, index;
  if (zone === "into") { parent = p.id; index = kidsOf(p.id).length; }
  else if (zone === "out") { parent = grandparent; const par = pages.find((x) => x.id === p.parent); index = kidsOf(grandparent).findIndex((x) => x.id === (par && par.id)) + 1; }
  else { parent = p.parent || null; const sibs = kidsOf(parent); const i = sibs.findIndex((x) => x.id === p.id); index = p.id === "home" ? 0 : Math.max(0, i) + (zone === "after" ? 1 : 0); }
  const r = await window.desktop.moveSitePage(moved.id, parent, index);
  if (r && r.ok) refresh(); else if (r && r.error) alert(r.error);
}
function sitePageDraggable(row, p, pages, refresh, depth = 0) {
  row.draggable = p.id !== "home";
  row.dataset.depth = String(depth);
  if (p.id !== "home") {
    const grip = siteEl("span", "site-grip"); grip.title = COPY.site.dragToReorder; grip.setAttribute("aria-hidden", "true");
    grip.innerHTML = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
    row.insertBefore(grip, row.firstChild);
  }
  const isDesc = (id, of) => { let cur = pages.find((x) => x.id === id); let g = 0; while (cur && cur.parent && g++ < 16) { if (cur.parent === of) return true; cur = pages.find((x) => x.id === cur.parent); } return false; };
  const ok = () => pageDrag && pageDrag.id !== p.id && !isDesc(p.id, pageDrag.id);
  const grandparent = () => { const par = pages.find((x) => x.id === p.parent); return (par && par.parent) || null; };
  const zone = (e) => {
    const r = row.getBoundingClientRect();
    if (e.clientY <= r.top + r.height / 2) return "before";
    const dx = e.clientX - pageDragX;
    if (dx > 20 && p.id !== "home") return "into"; // moved right: a child of this row
    if (dx < -20 && p.parent) return "out";        // moved left: one level up from this row
    return "after";
  };
  const levelOf = (z) => (z === "into" ? depth + 1 : z === "out" ? depth - 1 : depth);
  const showGhost = (z) => {
    const g = sitePageGhost();
    pageDropTarget = { p, zone: z, grandparent: grandparent(), pages, refresh };
    g.querySelector(".site-drop-ghost-title").textContent = pageDrag.title;
    g.classList.toggle("child", z === "into");
    g.style.marginLeft = (levelOf(z) * PAGE_INDENT) + "px";
    if (z === "before") row.before(g); else row.after(g);
  };
  row.addEventListener("dragstart", (e) => { pageDrag = p; pageDragX = e.clientX; row.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); } catch {} });
  row.addEventListener("dragend", () => { pageDrag = null; pageDropTarget = null; row.classList.remove("dragging"); const g = document.querySelector(".site-drop-ghost"); if (g) g.remove(); });
  row.addEventListener("dragover", (e) => { if (!ok()) return; e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch {} showGhost(zone(e)); });
  row.addEventListener("drop", (e) => { if (!ok()) return; e.preventDefault(); sitePageDrop({ p, zone: zone(e), grandparent: grandparent(), pages, refresh }); });
}

function siteLinkOptions(data, posts, ctx) {
  const out = [];
  data.pages.forEach((p) => out.push({ group: "pages", label: p.title, href: "/" + (p.id === "home" ? "" : (p.route || p.slug || p.id)) }));
  // Home-page sections: a block instance that sets its own id (nav anchors), plus any
  // anchor the nav already uses (blocks whose id is a schema default don't expose it).
  const home = data.pages.find((p) => p.id === "home");
  const seen = new Set();
  const addAnchor = (id, label) => { if (id && !seen.has(id)) { seen.add(id); out.push({ group: "sections", label: label || id, href: "/#" + id }); } };
  if (home) home.blocks.forEach((b) => { const id = b.props && b.props.id; const label = b.props && (b.props.heading || b.props.title); if (id) addAnchor(id, label); });
  (data.site.nav || []).forEach((l) => { const m = (l.href || "").match(/^\/#([a-z0-9-]+)$/); if (m) addAnchor(m[1], l.label); (l.links || []).forEach((s) => { const n = (s.href || "").match(/^\/#([a-z0-9-]+)$/); if (n) addAnchor(n[1], s.label); }); });
  const blog = "/" + ((data.site && data.site.blogPath) || "blog");
  if (posts.length) out.push({ group: "posts", label: COPY.site.tabs.posts, href: blog });
  posts.filter((p) => !p.draft).forEach((p) => out.push({ group: "posts", label: p.title, href: blog + "/" + p.id }));
  ctx.types.forEach((t) => {
    if (t.index) out.push({ group: "indexes", label: t.label, href: t.path });
    (ctx.entries[t.key] || []).forEach((e) => out.push({ group: "types", label: `${e.title} (${t.singular || t.label})`, href: `${t.path}/${e.slug || e.id}` }));
  });
  return out;
}

// Drag-and-drop for the navigation editor. Rows are top-level items, sub-links,
// mega-menu columns and column links. Each row says what it REORDERS with (kinds
// dropped before/after it, into `target`) and what it NESTS (dropped on its middle,
// into `into`). A top-level item drags with its whole group; nesting is one level,
// so an item with children can't be nested. Footer links reorder among themselves.
let navDrag = null; // { item, arr, kind, hasKids }
function siteNavDraggable(row, { item, kind, owners = [], reorder, nest, repaint, dirty }) {
  const grip = siteEl("span", "site-grip"); grip.title = COPY.site.dragToReorder; grip.setAttribute("aria-hidden", "true");
  grip.innerHTML = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
  row.insertBefore(grip, row.firstChild);
  row.draggable = true;
  const clear = () => row.classList.remove("drop-before", "drop-after", "drop-into");
  const nestable = (d) => d.kind === "link" || (d.kind === "item" && !d.hasKids);
  const canReorder = () => !!(reorder && reorder.kinds.includes(navDrag.kind) && (navDrag.kind !== "item" || reorder.topLevel || !navDrag.hasKids));
  const canNest = () => !!(nest && nestable(navDrag));
  const ok = () => navDrag && navDrag.item !== item && !owners.includes(navDrag.item) && (canReorder() || canNest());
  const zone = (e) => {
    const r = row.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height;
    if (canReorder() && canNest()) return y < 0.3 ? "before" : y > 0.7 ? "after" : "into";
    if (canNest()) return "into";
    return y < 0.5 ? "before" : "after";
  };
  row.addEventListener("dragstart", (e) => { e.stopPropagation(); navDrag = { item, kind, hasKids: !!((item.links && item.links.length) || (item.columns && item.columns.length)) }; row.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "nav"); } catch {} });
  row.addEventListener("dragend", () => { navDrag = null; row.classList.remove("dragging"); document.querySelectorAll(".site-nav-row.drop-before,.site-nav-row.drop-after,.site-nav-row.drop-into").forEach((r) => r.classList.remove("drop-before", "drop-after", "drop-into")); });
  row.addEventListener("dragover", (e) => { if (!ok()) return; e.preventDefault(); e.stopPropagation(); try { e.dataTransfer.dropEffect = "move"; } catch {} const z = zone(e); clear(); row.classList.add("drop-" + z); });
  row.addEventListener("dragleave", clear);
  row.addEventListener("drop", (e) => {
    if (!ok()) return;
    e.preventDefault(); e.stopPropagation(); const z = zone(e); clear();
    const moved = navDrag.item; const d = navDrag; navDrag = null;
    if (!d.remove) { /* removal by identity from wherever it lives */ }
    siteNavRemove(moved);
    const strip = () => { delete moved.links; delete moved.columns; };
    if (z === "into") { strip(); nest.into().push(moved); }
    else {
      const to = reorder.target();
      if (reorder.topLevel) { moved.links = Array.isArray(moved.links) ? moved.links : []; moved.columns = Array.isArray(moved.columns) ? moved.columns : []; }
      else if (d.kind !== "column") strip();
      const at = to.indexOf(item) + (z === "after" ? 1 : 0);
      to.splice(at, 0, moved);
    }
    dirty(); repaint();
  });
}
// Remove a dragged thing from wherever it sits in the nav draft (by identity).
let siteNavRemove = () => {};

function renderSiteNav(site, refresh, options = [], megaMenu = false) {
  const wrap = siteEl("div");
  const hf = siteFold(COPY.site.navHeading, "nav:header"); wrap.appendChild(hf.sec);
  hf.body.appendChild(siteEl("div", "sess-desc", site.manageNav === false ? COPY.site.navAuto : COPY.site.navDesc));
  // One datalist shared by every URL field: the project's pages, sections, posts,
  // content entries and indexes. Chromium renders it as a combo: type, or pick.
  const listId = "site-nav-links";
  const dl = document.createElement("datalist"); dl.id = listId;
  options.forEach((o) => { const opt = document.createElement("option"); opt.value = o.href; opt.label = `${o.label} · ${COPY.site.navGroups[o.group] || o.group}`; dl.appendChild(opt); });
  wrap.appendChild(dl);
  const labelFor = (href) => { const o = options.find((x) => x.href === href); return o ? o.label : ""; };
  const draft = JSON.parse(JSON.stringify({ nav: site.nav || [], footerLinks: site.footerLinks || [] }));
  // Autosave: every change (typing, drag, add, remove) writes content/site.json a
  // moment after the last one. No re-render on save, so typing keeps its focus;
  // the drawer picks the saved menu up next time it opens.
  let saveTimer = null; let status;
  const setStatus = (text, error) => { status.textContent = text || ""; status.style.color = error ? "#c0261e" : "#999"; };
  const saveNow = async () => {
    setStatus(COPY.site.saving);
    const res = await window.desktop.saveSiteSettings(draft.nav, draft.footerLinks);
    if (res && res.ok) { site.nav = res.site.nav; site.footerLinks = res.site.footerLinks; setStatus(COPY.site.saved); setTimeout(() => { if (status.textContent === COPY.site.saved) setStatus(""); }, 1800); }
    else setStatus((res && res.error) || "Couldn't save.", true);
  };
  const dirty = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); };
  siteNavRemove = (x) => {
    const pull = (arr) => { const i = arr.indexOf(x); if (i >= 0) { arr.splice(i, 1); return true; } return false; };
    if (pull(draft.nav) || pull(draft.footerLinks)) return;
    for (const it of draft.nav) {
      if (Array.isArray(it.links) && pull(it.links)) return;
      for (const c of it.columns || []) { if (Array.isArray(c.links) && pull(c.links)) return; }
      if (Array.isArray(it.columns) && pull(it.columns)) return;
    }
  };
  const linkRow = (l, arr, i, paint, withSub, dnd) => {
    const row = siteEl("div", "site-nav-row");
    if (dnd) siteNavDraggable(row, { item: l, kind: dnd.kind, owners: dnd.owners, reorder: dnd.reorder, nest: dnd.nest, repaint: dnd.repaint, dirty });
    const lab = document.createElement("input"); lab.className = "field"; lab.placeholder = COPY.site.navLabel; lab.value = l.label || "";
    const href = document.createElement("input"); href.className = "field"; href.placeholder = COPY.site.navHref; href.value = l.href || "";
    href.setAttribute("list", listId); href.title = COPY.site.navHrefHint;
    lab.addEventListener("input", () => { l.label = lab.value; dirty(); });
    href.addEventListener("input", () => {
      l.href = href.value; dirty();
      // Picked from the list (an exact match) with no text yet → fill the text too.
      if (!lab.value.trim()) { const t = labelFor(href.value); if (t) { lab.value = t; l.label = t; } }
    });
    row.append(lab, href);
    let paintCols = null; // set below when this item can hold mega-menu panels
    if (withSub && megaMenu && dnd) {
      const addPanel = siteMini(COPY.site.addColumn, () => { l.columns = Array.isArray(l.columns) ? l.columns : []; l.columns.push({ heading: "", links: [] }); dirty(); if (paintCols) paintCols(); }, { title: COPY.site.addColumnTip });
      row.appendChild(addPanel);
    }
    row.appendChild(siteTrashBtn(() => { arr.splice(i, 1); dirty(); paint(); }, COPY.site.removeItem));
    const out = siteEl("div");
    out.appendChild(row);
    if (withSub) {
      l.links = Array.isArray(l.links) ? l.links : [];
      const sub = siteEl("div"); sub.style.cssText = "margin:0 0 6px 14px;";
      const paintSub = () => { sub.innerHTML = ""; if (l.links.length) sub.appendChild(siteEl("div", "sess-desc", COPY.site.subLinks)); l.links.forEach((s, j) => sub.appendChild(linkRow(s, l.links, j, paintSub, false, dnd && { kind: "link", owners: [l], reorder: { kinds: ["link", "item"], target: () => l.links }, nest: null, repaint: dnd.repaint }))); sub.appendChild(siteMini(COPY.site.addSubLink, () => { l.links.push({ label: "", href: l.href || "" }); dirty(); paintSub(); })); };
      paintSub();
      out.appendChild(sub);
      // Mega menu: columns under this item (only when the header renders them).
      if (megaMenu && dnd) {
        l.columns = Array.isArray(l.columns) ? l.columns : [];
        const cols = siteEl("div"); cols.style.cssText = "margin:0 0 6px 14px;";
        paintCols = () => {
          cols.innerHTML = "";
          if (l.columns.length) cols.appendChild(siteEl("div", "sess-desc", COPY.site.columns));
          l.columns.forEach((c, k) => cols.appendChild(columnBox(c, l, k, dnd.repaint)));
        };
        paintCols();
        out.appendChild(cols);
      }
    }
    return out;
  };
  // One mega-menu column: heading, its links, an optional feature panel.
  const columnBox = (c, item, k, repaint) => {
    c.links = Array.isArray(c.links) ? c.links : [];
    const box = siteEl("div", "site-nav-col");
    const head = siteEl("div", "site-nav-row col");
    const hd = document.createElement("input"); hd.className = "field"; hd.placeholder = COPY.site.columnHeading; hd.value = c.heading || "";
    hd.addEventListener("input", () => { c.heading = hd.value; dirty(); });
    head.append(hd, siteTrashBtn(() => { item.columns.splice(k, 1); dirty(); repaint(); }, COPY.site.removeColumn));
    siteNavDraggable(head, { item: c, kind: "column", owners: [item], reorder: { kinds: ["column"], target: () => item.columns }, nest: { into: () => c.links }, repaint, dirty });
    box.appendChild(head);
    const linksHost = siteEl("div"); linksHost.style.cssText = "margin:0 0 6px 14px;";
    const paintLinks = () => {
      linksHost.innerHTML = "";
      c.links.forEach((s, j) => linksHost.appendChild(linkRow(s, c.links, j, paintLinks, false, { kind: "link", owners: [item, c], reorder: { kinds: ["link", "item"], target: () => c.links }, nest: null, repaint })));
      linksHost.appendChild(siteMini(COPY.site.addLink, () => { c.links.push({ label: "", href: "/" }); dirty(); paintLinks(); }));
    };
    paintLinks(); box.appendChild(linksHost);
    // Feature panel (image, title, text, link), folded by default.
    const f = siteFold(COPY.site.columnFeature, "nav-feature"); f.body.style.paddingLeft = "14px";
    c.feature = c.feature && typeof c.feature === "object" ? c.feature : {};
    const ft = siteField(COPY.site.featureTitle, c.feature.title); ft.input.addEventListener("input", () => { c.feature.title = ft.input.value; dirty(); }); f.body.appendChild(ft.wrap);
    const fx = siteField(COPY.site.featureText, c.feature.text, { textarea: true }); fx.input.addEventListener("input", () => { c.feature.text = fx.input.value; dirty(); }); f.body.appendChild(fx.wrap);
    f.body.appendChild(siteImageControl(c.feature.image, (next) => { c.feature.image = next ? { src: next.src, alt: next.alt } : undefined; dirty(); }, { label: COPY.site.featureImage }));
    const fl = siteEl("div", "site-nav-row"); fl.style.gridTemplateColumns = "1fr 1fr";
    const fll = document.createElement("input"); fll.className = "field"; fll.placeholder = COPY.site.navLabel; fll.value = (c.feature.link && c.feature.link.label) || "";
    const flh = document.createElement("input"); flh.className = "field"; flh.placeholder = COPY.site.navHref; flh.value = (c.feature.link && c.feature.link.href) || ""; flh.setAttribute("list", listId);
    const setLink = () => { c.feature.link = flh.value.trim() ? { label: fll.value, href: flh.value } : undefined; dirty(); };
    fll.addEventListener("input", setLink); flh.addEventListener("input", setLink);
    fl.append(fll, flh); f.body.appendChild(siteEl("div", "k", COPY.site.featureLink)); f.body.appendChild(fl);
    box.appendChild(f.sec);
    return box;
  };
  const navList = siteEl("div");
  const paintNav = () => { navList.innerHTML = ""; draft.nav.forEach((l, i) => navList.appendChild(linkRow(l, draft.nav, i, paintNav, true, { kind: "item", owners: [], reorder: { kinds: ["item", "link"], target: () => draft.nav, topLevel: true }, nest: { into: () => (l.links = Array.isArray(l.links) ? l.links : []) }, repaint: paintNav }))); navList.appendChild(siteMini(COPY.site.addLink, () => { draft.nav.push({ label: "", href: "/", links: [] }); dirty(); paintNav(); })); };
  paintNav();
  if (site.manageNav !== false) hf.body.appendChild(navList); // derived menus aren't edited here
  const ff = siteFold(COPY.site.footerHeading, "nav:footer"); wrap.appendChild(ff.sec);
  const footList = siteEl("div");
  const paintFoot = () => { footList.innerHTML = ""; draft.footerLinks.forEach((l, i) => footList.appendChild(linkRow(l, draft.footerLinks, i, paintFoot, false, { kind: "footer", owners: [], reorder: { kinds: ["footer"], target: () => draft.footerLinks }, nest: null, repaint: paintFoot }))); footList.appendChild(siteMini(COPY.site.addLink, () => { draft.footerLinks.push({ label: "", href: "/" }); dirty(); paintFoot(); })); };
  paintFoot();
  ff.body.appendChild(footList);
  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;min-height:18px;";
  status = siteEl("div", "sess-desc"); status.style.margin = "0";
  actions.appendChild(status);
  wrap.appendChild(actions);
  return wrap;
}

// Per-tab help modal: the tab's actions as an outline (headed bullet lists).
const cmshelp = el("cmshelp");
function openCmsHelp(tab) {
  const h = COPY.site.help[tab] || COPY.site.help.pages;
  el("cmshelp-title").textContent = h.title;
  const body = el("cmshelp-body"); body.innerHTML = "";
  const intro = siteEl("p", "ch-intro", h.intro); body.appendChild(intro);
  h.sections.forEach((sec) => {
    const wrap = siteEl("div", "ch-section");
    wrap.appendChild(siteEl("div", "ch-h", sec.h));
    const ul = siteEl("ul", "ch-list");
    sec.items.forEach((it) => { const li = document.createElement("li"); li.innerHTML = it; ul.appendChild(li); }); // copy-catalog HTML, not user input
    wrap.appendChild(ul); body.appendChild(wrap);
  });
  cmshelp.hidden = false;
}
function closeCmsHelp() { cmshelp.hidden = true; }
el("cmshelp-close").addEventListener("click", closeCmsHelp);
cmshelp.addEventListener("click", (e) => { if (e.target === cmshelp) closeCmsHelp(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cmshelp.hidden) { closeCmsHelp(); e.stopPropagation(); } }, true);

// The Settings tab: image optimization (per project, .thinkany/cms.json) + site facts.
// An on/off switch row: label left, the switch right. onChange(next) fires on toggle.
function siteSwitch(label, on, onChange) {
  const row = siteEl("label", "ta-switch" + (on ? " on" : ""));
  const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = on;
  const track = siteEl("span", "ta-switch-track");
  row.append(siteEl("span", "k", label), cb, track);
  cb.addEventListener("change", () => { row.classList.toggle("on", cb.checked); onChange(cb.checked); });
  return row;
}

// The Settings tab. While the site builder is OFF it holds only the switch; ON, the
// switch is the last item and the other tabs open up.
async function renderSiteSettings(host, data, st) {
  const S = COPY.site.settings;
  st = st || await window.desktop.getCmsSettings().catch(() => ({ media: { quality: 55, maxWidth: 2400 }, defaults: { media: { quality: 55, maxWidth: 2400 } }, enabled: false }));
  const wrap = siteEl("div", "site-single");
  host.appendChild(wrap);
  const enableRow = () => {
    const box = siteEl("div", "site-kv site-enable-row"); // stays outside the folded sections
    box.appendChild(siteSwitch(S.enable, !!st.enabled, async (next) => {
      const r = await window.desktop.setCmsSettings({ enabled: next });
      if (r && r.ok) { siteRailState.tab = "settings"; if (RAILS.site.classList.contains("active")) openModal("site"); }
    }));
    box.appendChild(siteEl("div", "sess-desc", st.enabled ? S.enableOnHint : S.enableOffHint));
    return box;
  };
  if (!st.enabled) { wrap.appendChild(enableRow()); return; }

  wrap.appendChild(siteEl("div", "sess-label", S.mediaHeading));
  wrap.appendChild(siteEl("div", "sess-desc", S.mediaDesc));
  const rangeRow = (label, hint, min, max, value, fmt, onCommit) => {
    const kv = siteEl("div", "site-kv");
    kv.appendChild(siteEl("div", "k", label));
    const row = siteEl("div", "site-range");
    const r = document.createElement("input"); r.type = "range"; r.min = String(min); r.max = String(max); r.value = String(value);
    const v = siteEl("span", "val", fmt(value));
    // The rail's fill follows the grabber (a CSS variable the track's gradient reads).
    const fill = () => r.style.setProperty("--pct", ((Number(r.value) - min) / (max - min) * 100) + "%");
    fill();
    r.addEventListener("input", () => { v.textContent = fmt(Number(r.value)); fill(); });
    r.addEventListener("change", () => onCommit(Number(r.value)));
    row.append(r, v); kv.appendChild(row);
    kv.appendChild(siteEl("div", "sess-desc", hint));
    return { kv, r, v };
  };
  const status = siteEl("div"); status.style.cssText = "min-height:18px;";
  const save = async (patch) => {
    const res = await window.desktop.setCmsSettings({ media: patch });
    status.innerHTML = "";
    if (res && res.ok) siteFlash(status, S.saved);
  };
  const q = rangeRow(S.quality, S.qualityHint, 20, 95, st.media.quality, (x) => String(x), (x) => save({ quality: x, maxWidth: Number(w.r.value) }));
  const w = rangeRow(S.maxWidth, S.maxWidthHint, 800, 6000, st.media.maxWidth, (x) => x + "px", (x) => save({ quality: Number(q.r.value), maxWidth: x }));
  w.r.step = "100";
  wrap.append(q.kv, w.kv);
  const actions = siteEl("div"); actions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:4px;";
  actions.appendChild(siteMini(S.reset, async () => {
    const d = st.defaults.media;
    q.r.value = String(d.quality); q.r.dispatchEvent(new Event("input")); // label + rail fill follow
    w.r.value = String(d.maxWidth); w.r.dispatchEvent(new Event("input"));
    await save({ quality: d.quality, maxWidth: d.maxWidth });
  }));
  actions.appendChild(status);
  wrap.appendChild(actions);

  // ── Search engines: robots.txt, the sitemap, llms.txt (content/site.json seo) ──
  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(siteEl("div", "sess-label", S.searchHeading));
  const seo = JSON.parse(JSON.stringify((data.site && data.site.seo) || { discourage: false, sitemap: true, llms: { enabled: true, content: null } }));
  const seoStatus = siteEl("div"); seoStatus.style.cssText = "min-height:18px;";
  const saveSeo = async () => { const res = await window.desktop.saveSiteSeo(seo); seoStatus.innerHTML = ""; if (res && res.ok) siteFlash(seoStatus, S.saved); };
  const toggle = (label, hint, checked, onChange) => {
    const row = siteEl("label", "toggle-row"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = checked;
    cb.addEventListener("change", () => onChange(cb.checked)); row.append(cb, siteEl("span", "", label));
    const h = siteEl("div", "sess-desc", hint); h.style.margin = "-6px 0 12px 22px";
    return { row, cb, hint: h };
  };
  const disc = toggle(S.discourage, S.discourageHint, seo.discourage, (on) => { seo.discourage = on; paintSeo(); saveSeo(); });
  const smap = toggle(S.sitemap, S.sitemapHint, seo.sitemap, (on) => { seo.sitemap = on; saveSeo(); });
  const llm = toggle(S.llms, S.llmsHint, seo.llms.enabled, (on) => { seo.llms.enabled = on; paintSeo(); saveSeo(); });
  wrap.append(disc.row, disc.hint, smap.row, smap.hint, llm.row, llm.hint);
  // llms.txt content: the saved custom text, or the generated version as a starting point.
  const llmBox = siteEl("div", "site-kv"); llmBox.style.marginLeft = "22px";
  llmBox.appendChild(siteEl("div", "k", S.llmsContent));
  const llmTa = document.createElement("textarea"); llmTa.className = "field"; llmTa.style.cssText = "min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:12px;";
  const llmActions = siteEl("div"); llmActions.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:6px;";
  const llmSave = siteEl("button", "panelbtn primary", S.llmsSave); llmSave.style.margin = "0"; llmSave.disabled = true;
  const llmReset = siteMini(S.llmsReset, async () => { llmTa.value = await window.desktop.getLlmsDefault().catch(() => ""); seo.llms.content = null; llmSave.disabled = true; saveSeo(); });
  llmActions.append(llmSave, llmReset, seoStatus);
  llmBox.append(llmTa, llmActions);
  wrap.appendChild(llmBox);
  llmTa.addEventListener("input", () => { llmSave.disabled = false; });
  llmSave.addEventListener("click", async () => { seo.llms.content = llmTa.value.trim() ? llmTa.value : null; llmSave.disabled = true; await saveSeo(); });
  const paintSeo = async () => {
    // Discouraging search engines also means no sitemap: gray the toggle out.
    smap.cb.disabled = seo.discourage; smap.row.style.opacity = seo.discourage ? "0.45" : "1";
    llmBox.hidden = !seo.llms.enabled;
    if (seo.llms.enabled && !llmTa.value) llmTa.value = seo.llms.content || (await window.desktop.getLlmsDefault().catch(() => ""));
  };
  await paintSeo();

  // Icons: paths in content/site.json; uploads are kept as they are (no AVIF).
  // Navigation: managed by hand (the Navigation tab) or derived from the page outline.
  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(siteEl("div", "sess-label", S.navHeading));
  const navBox = siteEl("div", "site-kv");
  const manage = !!(data.site && data.site.manageNav !== false);
  const locked = !!(data.site && data.site.navHasPanels); // panels in the menu: can't be outline-driven
  const navSwitch = siteSwitch(S.manageNav, locked ? true : manage, async (next) => {
    const r = await window.desktop.setManageNav(next);
    if (r && r.ok) { siteFlash(navBox, S.saved); }
    else if (r && r.error) { const e = siteEl("div", "sess-desc", r.error); e.style.color = "#c0261e"; navBox.appendChild(e); }
  });
  if (locked) { const cb = navSwitch.querySelector("input"); cb.disabled = true; navSwitch.style.cursor = "default"; navSwitch.classList.add("locked"); }
  navBox.appendChild(navSwitch);
  navBox.appendChild(siteEl("div", "sess-desc", locked ? S.manageNavMegaNote : (manage ? S.manageNavOnHint : S.manageNavOffHint)));
  wrap.appendChild(navBox);

  // Blog: the posts directory.
  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(siteEl("div", "sess-label", S.blogHeading));
  const bp = siteField(S.postsDir, (data.site && data.site.blogPath) || "blog", { hint: S.postsDirHint });
  const bpStatus = siteEl("div"); bpStatus.style.cssText = "min-height:18px;";
  // Autosave a second after the last keystroke (Enter saves at once); green "Saved" flash.
  let bpTimer = null;
  const saveBlogPath = async () => {
    clearTimeout(bpTimer);
    const v = bp.input.value.trim(); if (!v || v === ((data.site && data.site.blogPath) || "blog")) return;
    const r = await window.desktop.setBlogPath(v);
    bpStatus.innerHTML = "";
    if (r && r.ok) { bp.input.value = r.path; data.site.blogPath = r.path; siteBlogPath = r.path; siteFlash(bpStatus, S.saved); }
    else if (r && r.error) { const e = siteEl("div", "sess-desc", r.error); e.style.color = "#c0261e"; bpStatus.appendChild(e); }
  };
  bp.input.addEventListener("input", () => { clearTimeout(bpTimer); bpTimer = setTimeout(saveBlogPath, 1000); });
  bp.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveBlogPath(); } });
  bp.wrap.appendChild(bpStatus); wrap.appendChild(bp.wrap);

  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(siteEl("div", "sess-label", S.iconsHeading));
  wrap.appendChild(siteEl("div", "sess-desc", S.iconsDesc));
  const fav = { ...((data.site && data.site.favicon) || { icon: "", touch: "" }) };
  const iconStatus = siteEl("div"); iconStatus.style.cssText = "min-height:18px;";
  const saveIcons = async () => { const r = await window.desktop.saveSiteFavicon(fav); iconStatus.innerHTML = ""; if (r && r.ok) siteFlash(iconStatus, S.saved); };
  const iconCtl = siteImageControl(fav.icon, (next) => { fav.icon = next ? next.src : ""; saveIcons(); }, { label: S.favicon, noAlt: true, raw: true, accept: ".svg,.png,image/svg+xml,image/png" });
  iconCtl.appendChild(siteEl("div", "sess-desc", S.faviconHint)); wrap.appendChild(iconCtl);
  const touchCtl = siteImageControl(fav.touch, (next) => { fav.touch = next ? next.src : ""; saveIcons(); }, { label: S.touch, noAlt: true, raw: true, accept: ".png,image/png" });
  touchCtl.appendChild(siteEl("div", "sess-desc", S.touchHint)); wrap.appendChild(touchCtl);
  wrap.appendChild(iconStatus);

  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(siteEl("div", "sess-label", S.siteHeading));
  if (data.design) wrap.appendChild(siteEl("div", "sess-desc", S.designPinned(data.design)));
  if (data.liveUrl) {
    const row = siteEl("div"); row.style.cssText = "display:flex;gap:8px;align-items:center;font-size:12.5px;";
    row.appendChild(siteEl("span", "muted", COPY.site.liveAt));
    const a = siteEl("a", "", data.liveUrl.replace(/^https?:\/\//, "")); a.href = data.liveUrl; a.style.cssText = "color:#1a1a1a;text-decoration:underline;";
    a.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(data.liveUrl); });
    row.appendChild(a); wrap.appendChild(row);
  } else wrap.appendChild(siteEl("div", "sess-desc", COPY.site.previewNote));

  wrap.appendChild(siteEl("div", "drawer-sep"));
  wrap.appendChild(enableRow());
  siteAccordionize(wrap);
}

// Settings sections fold. Each `.sess-label` heading starts a section (its content
// runs to the next heading); the trailing Site builder switch stays outside. Which
// sections are open is remembered per project.
function siteAccordionize(wrap) {
  const nodes = Array.from(wrap.childNodes);
  wrap.innerHTML = "";
  let section = null;
  const tail = []; // nodes after the last section's content that belong outside (the switch)
  nodes.forEach((n) => {
    const isLabel = n.nodeType === 1 && n.classList.contains("sess-label");
    const isSep = n.nodeType === 1 && n.classList.contains("drawer-sep");
    const isSwitch = n.nodeType === 1 && n.classList.contains("site-enable-row"); // the Site builder row only
    if (isLabel) {
      const title = n.textContent; const key = "settings:" + title;
      const isOpen = siteFolds[key] !== false; // open unless remembered closed
      // `sec` is this section's own reference: `section` (the walk's cursor) moves on
      // and ends null, so a click handler must not read it.
      const sec = siteEl("div", "site-acc" + (isOpen ? " open" : ""));
      section = sec;
      const head = siteEl("button", "site-acc-head"); head.type = "button"; head.setAttribute("aria-expanded", String(isOpen));
      head.append(siteEl("span", "site-acc-chev"), siteEl("span", "site-acc-title", title));
      const body = siteEl("div", "site-acc-body"); body.hidden = !isOpen;
      head.addEventListener("click", () => { const now = body.hidden; body.hidden = !now; sec.classList.toggle("open", now); head.setAttribute("aria-expanded", String(now)); siteFoldSet(key, now); });
      sec.append(head, body); wrap.appendChild(sec);
      return;
    }
    if (isSwitch) { section = null; tail.push(n); return; }
    if (isSep) return; // section frames replace the separators
    if (section) section.querySelector(".site-acc-body").appendChild(n); else tail.push(n);
  });
  tail.forEach((n) => wrap.appendChild(n));
}

async function renderSite(body) {
  destroyLiveEditors();
  const data = await window.desktop.getSiteContent().catch(() => ({ ready: false, reason: "no-project", pages: [], blocks: [], site: { nav: [], footerLinks: [] } }));
  const refresh = () => { if (RAILS.site.classList.contains("active")) openModal("site"); };
  if (data.licensed === false) {
    // Part of the Design bundle: without the key the drawer explains, the Site tab still previews.
    body.appendChild(siteEl("div", "muted", COPY.site.lead)).style.cssText = "font-size:12.5px;margin-bottom:12px;";
    body.appendChild(siteEl("div", "muted", COPY.site.notLicensed));
    return;
  }
  if (!data.ready) {
    body.appendChild(siteEl("div", "muted", COPY.site.lead)).style.cssText = "font-size:12.5px;margin-bottom:12px;";
    body.appendChild(siteEl("div", "muted", COPY.site.notReady[data.reason] || COPY.site.notReady["not-promoted"]));
    return;
  }
  const posts = await window.desktop.getSitePosts().catch(() => []);
  const typesData = await window.desktop.getSiteTypes().catch(() => ({ types: [], entries: {} }));
  const ctx = { types: typesData.types || [], entries: typesData.entries || {}, blocks: data.blocks };
  mediaIndex = await window.desktop.listMedia().catch(() => []); // thumbnails for image fields
  siteMarks = data.marks || {};
  siteBlogPath = (data.site && data.site.blogPath) || "blog";
  siteDesignId = data.design || null;

  // ── Tabs: Pages · Posts · Types · Navigation · Settings ──
  // Off per project until the Settings switch is on: only Settings is reachable then.
  const cms = await window.desktop.getCmsSettings().catch(() => ({ media: { quality: 55, maxWidth: 2400 }, defaults: { media: { quality: 55, maxWidth: 2400 } }, enabled: false }));
  siteFolds = { ...((cms.ui && cms.ui.folds) || {}) };
  const TABS = ["pages", "posts", "types", "nav", "settings"];
  if (!TABS.includes(siteRailState.tab)) siteRailState.tab = "pages";
  if (!cms.enabled) siteRailState.tab = "settings";
  const counts = { pages: data.pages.length, posts: posts.length, types: ctx.types.length };
  const tabs = siteEl("div", "site-tabs");
  TABS.forEach((t) => {
    const b = siteEl("button", "site-tab" + (siteRailState.tab === t ? " active" : ""), COPY.site.tabs[t]); b.type = "button";
    if (counts[t] != null) b.appendChild(siteEl("span", "count", String(counts[t])));
    if (!cms.enabled && t !== "settings") b.disabled = true;
    b.addEventListener("click", () => { siteRailState.tab = t; refresh(); });
    tabs.appendChild(b);
  });
  // The "?" at the far right: help for the current tab.
  const helpBtn = siteEl("button", "site-tabs-help"); helpBtn.type = "button"; helpBtn.title = COPY.site.helpTip; helpBtn.setAttribute("aria-label", COPY.site.helpTip);
  helpBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>';
  helpBtn.addEventListener("click", () => openCmsHelp(siteRailState.tab));
  tabs.appendChild(helpBtn);
  body.appendChild(tabs);

  // Selection is per tab: a kind that belongs to another tab is ignored here.
  const sel = siteRailState.selected && typeof siteRailState.selected === "object" ? siteRailState.selected : null;
  const isSel = (kind, id) => !!sel && sel.kind === kind && sel.id === id;
  const two = () => { const cols = siteEl("div", "site-cols"); const left = siteEl("div"); const right = siteEl("div", "site-detail"); cols.append(left, right); body.appendChild(cols); return { left, right }; };
  const listRow = (title, sub, active, onClick) => { const row = siteEl("div", "site-list-row" + (active ? " active" : "")); row.append(siteEl("div", "site-page-title", title), siteEl("div", "site-page-slug", sub)); row.addEventListener("click", onClick); return row; };
  const addRow = (placeholder, label, onCreate) => {
    const row = siteEl("div"); row.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0 14px;";
    const inp = document.createElement("input"); inp.className = "field"; inp.placeholder = placeholder; inp.style.marginBottom = "0";
    const btn = siteEl("button", "panelbtn", label); btn.style.cssText = "margin:0;width:auto;white-space:nowrap;";
    const go = () => { const v = inp.value.trim(); if (v) onCreate(v); };
    btn.addEventListener("click", go); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    row.append(inp, btn); return row;
  };

  if (siteRailState.tab === "pages") {
    const { left, right } = two();
    const cur = sel && sel.kind === "page" && data.pages.some((p) => p.id === sel.id) ? sel : (data.pages[0] ? { kind: "page", id: data.pages[0].id } : null);
    // A tree: children indented under their parent (home first, then by title). Drag a
    // page onto another to nest it; drop between pages to sit at that level.
    const kids = (pid) => data.pages.filter((p) => (p.parent || null) === pid && p.id !== "home").sort((a, b) => ((a.order ?? 1e9) - (b.order ?? 1e9)) || a.title.localeCompare(b.title));
    const walk = (pid, depth) => kids(pid).forEach((p) => { pageRow(p, depth); walk(p.id, depth + 1); });
    const pageRow = (p, depth) => {
      const row = listRow(p.title, p.id === "home" ? COPY.site.homeSlug : "/" + (p.route || p.slug || p.id), cur && cur.id === p.id, () => { siteRailState.selected = { kind: "page", id: p.id }; refresh(); });
      row.style.marginLeft = depth * PAGE_INDENT + "px";
      sitePageDraggable(row, p, data.pages, refresh, depth);
      left.appendChild(row);
    };
    const home = data.pages.find((p) => p.id === "home"); if (home) pageRow(home, 0);
    walk(null, 0);
    left.appendChild(addRow(COPY.site.newPagePlaceholder, COPY.site.create, async (t) => { const res = await window.desktop.createSitePage(t); if (res && res.ok) { siteRailState.selected = { kind: "page", id: res.page.id }; refresh(); } }));
    renderSitePage.pages = data.pages; // for the parent picker
    if (cur) right.appendChild(renderSitePage(data.pages.find((p) => p.id === cur.id), data.blocks, refresh, true));
  } else if (siteRailState.tab === "posts") {
    const { left, right } = two();
    const cur = sel && sel.kind === "post" && posts.some((p) => p.id === sel.id) ? sel : (posts[0] ? { kind: "post", id: posts[0].id } : null);
    if (!posts.length) left.appendChild(siteEl("div", "sess-desc", COPY.site.noPosts));
    posts.forEach((p) => left.appendChild(listRow(p.title, p.draft ? COPY.site.draftTag : (p.date || ""), cur && cur.id === p.id, () => { siteRailState.selected = { kind: "post", id: p.id }; refresh(); })));
    left.appendChild(addRow(COPY.site.newPostPlaceholder, COPY.site.create, async (t) => { const res = await window.desktop.createSitePost(t); if (res && res.ok) { siteRailState.selected = { kind: "post", id: res.post.id }; refresh(); } }));
    if (cur) right.appendChild(renderSitePost(posts.find((p) => p.id === cur.id), refresh));
  } else if (siteRailState.tab === "types") {
    const { left, right } = two();
    renderSiteTypesList(left, right, ctx, refresh);
  } else if (siteRailState.tab === "nav") {
    const wrap = siteEl("div", "site-single"); body.appendChild(wrap);
    wrap.appendChild(renderSiteNav(data.site, refresh, siteLinkOptions(data, posts, ctx), !!data.megaMenu));
  } else {
    await renderSiteSettings(body, data, cms);
  }
}

// --- Copy voice: per-project tone + rules, plus global rules ---
const TONE_EXAMPLES = COPY.voice.toneExamples;
const RULE_EXAMPLES = COPY.voice.ruleExamples;

// A row of clickable "+ example" chips; onPick(text) adds/sets it. `hidden(ex)` (optional)
// filters out options that are already selected, and the returned refresh() re-applies that
// filter after the selection changes. Returns { el, refresh }.
function exampleChips(examples, onPick, hidden) {
  const wrap = document.createElement("div");
  wrap.className = "chips";
  const refresh = () => {
    wrap.innerHTML = "";
    (examples || []).forEach((ex) => {
      if (hidden && hidden(ex)) return; // already picked → drop it from the options
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = "+ " + ex;
      b.addEventListener("click", () => onPick(ex));
      wrap.appendChild(b);
    });
  };
  refresh();
  return { el: wrap, refresh };
}

// An editable list bound to `arr` (mutated in place). disabled → read-only + struck.
function ruleListEl(arr, opts = {}) {
  const box = document.createElement("div");
  box.className = "rulelist" + (opts.disabled ? " disabled" : "");
  const rows = document.createElement("div");
  let chipRefresh = null; // set once the example chips exist; refreshes their picked-out filter
  const rerender = () => {
    rows.innerHTML = "";
    if (!arr.length) {
      const e = document.createElement("div"); e.className = "muted rule-empty";
      e.textContent = opts.emptyText || COPY.ruleList.emptyDefault; rows.appendChild(e);
    }
    arr.forEach((r, i) => {
      const row = document.createElement("div"); row.className = "rulerow";
      const t = document.createElement("span"); t.className = "rule-t"; t.textContent = r; row.appendChild(t);
      if (!opts.disabled) {
        const x = document.createElement("button"); x.className = "rule-x"; x.type = "button"; x.textContent = "×";
        x.addEventListener("click", () => { arr.splice(i, 1); rerender(); opts.onChange && opts.onChange(); });
        row.appendChild(x);
      }
      rows.appendChild(row);
    });
    if (chipRefresh) chipRefresh(); // a removed rule reappears as an option; an added one drops
  };
  box.appendChild(rows);
  const add = (text) => {
    const t = (text || "").trim();
    if (t && !arr.some((r) => r.toLowerCase() === t.toLowerCase())) { arr.push(t); rerender(); opts.onChange && opts.onChange(); }
  };
  if (!opts.disabled) {
    const addRow = document.createElement("div"); addRow.className = "rule-add";
    const inp = document.createElement("input"); inp.className = "field"; inp.placeholder = opts.placeholder || COPY.ruleList.addPlaceholder;
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { add(inp.value); inp.value = ""; } });
    const btn = document.createElement("button"); btn.className = "panelbtn"; btn.type = "button"; btn.textContent = COPY.ruleList.add;
    btn.addEventListener("click", () => { add(inp.value); inp.value = ""; });
    addRow.append(inp, btn); box.appendChild(addRow);
    const chips = exampleChips(opts.examples || [], add, (ex) => arr.some((r) => r.toLowerCase() === ex.toLowerCase()));
    chipRefresh = chips.refresh;
    box.appendChild(chips.el);
  }
  rerender();
  return box;
}

function voiceHeader(title, sub) {
  const h = document.createElement("div"); h.className = "voice-h";
  const k = document.createElement("div"); k.className = "voice-h-k"; k.textContent = title; h.appendChild(k);
  if (sub) { const s = document.createElement("div"); s.className = "voice-h-sub"; s.textContent = sub; h.appendChild(s); }
  return h;
}

async function renderVoice(body) {
  const data = await window.desktop.getVoice();
  const state = {
    tone: (data.project && data.project.tone) || "",
    projRules: [...((data.project && data.project.rules) || [])],
    decline: !!(data.project && data.project.declineGlobal),
    globalRules: [...(data.global || [])],
  };

  const intro = document.createElement("p");
  intro.className = "muted"; intro.style.margin = "-8px 0 6px"; // tighten the space above by ~50%
  intro.textContent = COPY.voice.intro;
  body.appendChild(intro);

  // ── This project ──
  body.appendChild(voiceHeader(COPY.voice.thisProject));
  const toneLabel = document.createElement("div"); toneLabel.className = "voice-label"; toneLabel.textContent = COPY.voice.tone;
  body.appendChild(toneLabel);
  const toneInput = document.createElement("input");
  toneInput.className = "field"; toneInput.placeholder = COPY.voice.tonePlaceholder; toneInput.value = state.tone;
  toneInput.addEventListener("input", () => { state.tone = toneInput.value; toneChips.refresh(); });
  body.appendChild(toneInput);
  // The picked tone drops out of the options (a single-value list); refresh on every change.
  const toneChips = exampleChips(
    TONE_EXAMPLES,
    (ex) => { state.tone = ex; toneInput.value = ex; toneChips.refresh(); },
    (ex) => state.tone.trim().toLowerCase() === ex.toLowerCase(),
  );
  body.appendChild(toneChips.el);

  const prLabel = document.createElement("div"); prLabel.className = "voice-label"; prLabel.textContent = COPY.voice.projectRulesLabel;
  body.appendChild(prLabel);
  body.appendChild(ruleListEl(state.projRules, { examples: RULE_EXAMPLES, placeholder: COPY.voice.projectRulePlaceholder, emptyText: COPY.voice.projectRulesEmpty }));

  // Applied global rules — shown here (read-only, selected) so This project reflects what's
  // actually in effect. Hidden when the project ignores globals. Kept in sync as the Global
  // section is edited or the Ignore toggle flips (see below).
  const appliedNote = document.createElement("div"); appliedNote.className = "voice-applied-note"; appliedNote.textContent = COPY.voice.appliedFromGlobal;
  const appliedWrap = document.createElement("div"); appliedWrap.className = "chips";
  const renderAppliedGlobals = () => {
    const show = !state.decline && state.globalRules.length > 0;
    appliedNote.hidden = !show;
    appliedWrap.hidden = !show;
    appliedWrap.innerHTML = "";
    if (!show) return;
    state.globalRules.forEach((g) => {
      const c = document.createElement("span"); c.className = "chip applied"; c.textContent = "✓ " + g;
      appliedWrap.appendChild(c);
    });
  };
  body.append(appliedNote, appliedWrap);
  renderAppliedGlobals();

  // ── Global rules ── (divider to set it apart from the project grouping)
  const divider = document.createElement("div"); divider.className = "voice-divider";
  body.appendChild(divider);
  body.appendChild(voiceHeader(COPY.voice.globalRules, COPY.voice.globalRulesSub));
  const toggle = document.createElement("label"); toggle.className = "voice-toggle";
  const chk = document.createElement("input"); chk.type = "checkbox"; chk.checked = state.decline;
  const tTxt = document.createElement("span"); tTxt.textContent = COPY.voice.ignoreGlobal;
  toggle.append(chk, tTxt); body.appendChild(toggle);

  // Re-render the global list when Decline flips (read-only + struck when declined).
  const globalWrap = document.createElement("div");
  const renderGlobal = () => {
    globalWrap.innerHTML = "";
    globalWrap.appendChild(ruleListEl(state.globalRules, {
      examples: RULE_EXAMPLES, placeholder: COPY.voice.globalRulePlaceholder,
      emptyText: COPY.voice.globalRulesEmpty, disabled: state.decline,
      onChange: renderAppliedGlobals, // editing a global updates the This-project mirror
    }));
  };
  chk.addEventListener("change", () => { state.decline = chk.checked; renderGlobal(); renderAppliedGlobals(); });
  renderGlobal();
  body.appendChild(globalWrap);

  // ── Save (both project + global) ──
  const save = document.createElement("button"); save.className = "panelbtn primary"; save.textContent = COPY.voice.save;
  save.style.marginTop = "16px";
  const msg = document.createElement("div"); msg.className = "muted"; msg.style.marginTop = "8px";
  save.addEventListener("click", async () => {
    save.disabled = true; save.textContent = COPY.common.saving;
    await window.desktop.saveProjectVoice({ tone: state.tone, rules: state.projRules, declineGlobal: state.decline });
    await window.desktop.saveGlobalRules(state.globalRules);
    save.disabled = false; save.textContent = COPY.voice.save;
    msg.textContent = COPY.voice.saved;
  });
  body.appendChild(save);
  body.appendChild(msg);
}

// --- Claude settings: API key + model ---
// Thin trash icon (Lucide trash-2) for session deletes.
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>';

// A tri-state Inherit/On/Off <select> for a per-variation override (null|true|false).
function triSelect(value) {
  const sel = document.createElement("select");
  sel.className = "field";
  [["", COPY.tri.inherit], ["on", COPY.tri.on], ["off", COPY.tri.off]].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    sel.appendChild(o);
  });
  sel.value = value === true ? "on" : value === false ? "off" : "";
  return sel;
}
function triVal(sel) { return sel.value === "on" ? true : sel.value === "off" ? false : null; }

// Friendly relative timestamp for a session's saved date.
function relTime(iso) {
  const then = new Date(iso), now = new Date();
  const time = then.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000
  );
  if (days === 0) return COPY.time.todayPrefix + time;
  if (days === 1) return COPY.time.yesterdayPrefix + time;
  if (days < 7) return then.toLocaleDateString([], { weekday: "short" }) + " " + time;
  return then.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function renderClaude(body) {
  const status = await window.desktop.getKeyStatus();
  body.appendChild(connStatusRow(COPY.claude.keyLabel, status.hasKey, status.hasKey ? COPY.claude.connected : COPY.claude.notConnected, null, null));

  if (!status.hasKey) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.claude.pasteKeyNote;
    body.appendChild(note);
    return;
  }

  body.appendChild(setRow("Key", `sk-ant-…${status.keyHint || "????"}`));

  // Model picker — populated from the models this key can use.
  const modelRow = document.createElement("div");
  modelRow.className = "setrow";
  const mk = document.createElement("div");
  mk.className = "k";
  mk.textContent = COPY.claude.model;
  const select = document.createElement("select");
  select.className = "field";
  const loadingOpt = document.createElement("option");
  loadingOpt.textContent = COPY.claude.loadingModels;
  select.appendChild(loadingOpt);
  modelRow.append(mk, select);
  body.appendChild(modelRow);

  const [{ model: current }, res] = await Promise.all([
    window.desktop.getModel(),
    window.desktop.getModels(),
  ]);
  select.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = COPY.claude.modelDefault;
  select.appendChild(def);
  if (res.ok) {
    res.models.forEach((m) => {
      const o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.name;
      select.appendChild(o);
    });
  } else {
    const o = document.createElement("option");
    o.disabled = true;
    o.textContent = res.error || COPY.claude.couldNotLoadModels;
    select.appendChild(o);
  }
  select.value = current || "";
  select.addEventListener("change", async () => {
    await window.desktop.setModel(select.value || null);
    const label = select.options[select.selectedIndex].textContent;
    addMsg("system", select.value ? COPY.claude.modelSetTo(label) : COPY.claude.modelSetDefault);
  });

  // Key management (add/remove) now lives in the Keys & Licenses drawer.
  const keyNote = document.createElement("div");
  keyNote.className = "muted";
  keyNote.textContent = COPY.claude.manageKeyInLicenses;
  body.appendChild(keyNote);

  // ── Build fidelity (Sonnet default ↔ Opus high-fidelity) ─────────────────────
  const fidSep = document.createElement("div"); fidSep.className = "drawer-sep"; body.appendChild(fidSep);
  const fidLabel = document.createElement("div"); fidLabel.className = "sess-label"; fidLabel.textContent = COPY.claude.fidelityLabel; body.appendChild(fidLabel);
  const fidDesc = document.createElement("div"); fidDesc.className = "sess-desc"; fidDesc.textContent = COPY.claude.fidelityDesc; body.appendChild(fidDesc);
  const fidRow = document.createElement("div"); fidRow.className = "fidelity-row";
  const fidState = document.createElement("span"); fidState.className = "fidelity-state";
  const fidSwitch = document.createElement("label"); fidSwitch.className = "fidelity-switch";
  const fidCb = document.createElement("input"); fidCb.type = "checkbox"; fidCb.checked = buildHiFi;
  const fidSlider = document.createElement("span"); fidSlider.className = "slider";
  fidSwitch.append(fidCb, fidSlider);
  const paintFid = () => { fidState.textContent = fidCb.checked ? COPY.claude.fidelityOn : COPY.claude.fidelityOff; };
  paintFid();
  fidCb.addEventListener("change", async () => { buildHiFi = fidCb.checked; paintFid(); try { await window.desktop.setBuildFidelity(buildHiFi); } catch { /* best-effort */ } });
  fidRow.append(fidState, fidSwitch);
  body.appendChild(fidRow);

  // ── Images ──────────────────────────────────────────────────────────────────
  const imgSep = document.createElement("div");
  imgSep.className = "drawer-sep";
  body.appendChild(imgSep);
  const imgLabel = document.createElement("div");
  imgLabel.className = "sess-label";
  imgLabel.textContent = COPY.claude.imagesLabel;
  body.appendChild(imgLabel);
  const imgDesc = document.createElement("div");
  imgDesc.className = "sess-desc";
  imgDesc.textContent = COPY.claude.imagesDesc;
  body.appendChild(imgDesc);

  const imgMode = await window.desktop.getImagesMode();
  const imgRow = document.createElement("label");
  imgRow.className = "toggle-row";
  const imgCb = document.createElement("input");
  imgCb.type = "checkbox";
  imgCb.checked = !!imgMode.placeholder;
  const imgTxt = document.createElement("span");
  imgTxt.textContent = COPY.claude.imagesToggle;
  imgRow.append(imgCb, imgTxt);
  imgCb.addEventListener("change", () => {
    window.desktop.setImagesMode(imgCb.checked);
    addMsg("system", imgCb.checked ? COPY.claude.imagesOnPlaceholders : COPY.claude.imagesOnSourcing);
  });
  body.appendChild(imgRow);

  // ── Narrate builds (the live Art-Director line during the quiet build) ────────
  const narSep = document.createElement("div"); narSep.className = "drawer-sep"; body.appendChild(narSep);
  const narLabel = document.createElement("div"); narLabel.className = "sess-label"; narLabel.textContent = COPY.claude.narrateLabel; body.appendChild(narLabel);
  const narDesc = document.createElement("div"); narDesc.className = "sess-desc"; narDesc.textContent = COPY.claude.narrateDesc; body.appendChild(narDesc);
  const narMode = await window.desktop.getNarrate();
  const narRow = document.createElement("label"); narRow.className = "toggle-row";
  const narCb = document.createElement("input"); narCb.type = "checkbox"; narCb.checked = !!narMode.enabled;
  const narTxt = document.createElement("span"); narTxt.textContent = COPY.claude.narrateToggle;
  narRow.append(narCb, narTxt);
  narCb.addEventListener("change", () => { window.desktop.setNarrate(narCb.checked); });
  body.appendChild(narRow);

  // ── Research the field (licensed enhancement — only rendered when licensed) ──
  const research = await window.desktop.getResearch();
  if (research.licensed) {
    const rsep = document.createElement("div");   // divider, called out like Sessions
    rsep.className = "drawer-sep";
    body.appendChild(rsep);
    const rlabel = document.createElement("div");
    rlabel.className = "sess-label";
    rlabel.textContent = COPY.claude.researchLabel;
    body.appendChild(rlabel);
    const rlead = document.createElement("div");
    rlead.className = "sess-desc";
    rlead.textContent = COPY.claude.researchDesc;
    body.appendChild(rlead);

    const gRow = document.createElement("label");
    gRow.className = "toggle-row";
    const gCb = document.createElement("input");
    gCb.type = "checkbox";
    gCb.checked = research.global;
    const gTxt = document.createElement("span");
    gTxt.textContent = COPY.claude.researchGlobal;
    gRow.append(gCb, gTxt);
    body.appendChild(gRow);

    // Sub-option: "broad" — look BEYOND same-category competitors (style + regional
    // references, cross-category). Only usable when Research itself is on.
    const bgRow = document.createElement("label");
    bgRow.className = "toggle-row";
    const bgCb = document.createElement("input");
    bgCb.type = "checkbox";
    bgCb.checked = research.broadGlobal;
    bgCb.disabled = !research.global;
    const bgTxt = document.createElement("span");
    bgTxt.textContent = COPY.claude.researchBroad;
    bgRow.append(bgCb, bgTxt);
    body.appendChild(bgRow);

    gCb.addEventListener("change", () => { window.desktop.setResearchGlobal(gCb.checked); bgCb.disabled = !gCb.checked; });
    bgCb.addEventListener("change", () => window.desktop.setResearchBroadGlobal(bgCb.checked));

    // Per-VARIATION overrides (the current working design). One variation can research
    // (and go broad) while another designs straight away. Only once a variation exists.
    if (research.variationId) {
      const pRow = document.createElement("div");
      pRow.className = "setrow";
      const pk = document.createElement("div");
      pk.className = "k";
      pk.textContent = COPY.claude.researchForDesign(research.variationId);
      const pSel = triSelect(research.variation);
      pRow.append(pk, pSel);
      body.appendChild(pRow);

      const bpRow = document.createElement("div");
      bpRow.className = "setrow";
      const bpk = document.createElement("div");
      bpk.className = "k";
      bpk.textContent = COPY.claude.researchBroadForDesign;
      const bpSel = triSelect(research.broadVariation);
      bpSel.disabled = !(research.variation === null ? research.global : research.variation);
      bpRow.append(bpk, bpSel);
      body.appendChild(bpRow);

      pSel.addEventListener("change", () => {
        const val = triVal(pSel);
        window.desktop.setResearchVariation(val);
        bpSel.disabled = !(val === null ? research.global : val); // broad follows research
      });
      bpSel.addEventListener("change", () => window.desktop.setResearchBroadVariation(triVal(bpSel)));
    }

  }

  // ── Sessions (project-scoped history) — called out under a rule. ──
  const sep = document.createElement("div");
  sep.className = "sess-sep";
  body.appendChild(sep);

  const sh = document.createElement("div");
  sh.className = "sess-label";
  sh.textContent = COPY.claude.sessionsLabel;
  body.appendChild(sh);

  const sdesc = document.createElement("div");
  sdesc.className = "sess-desc";
  sdesc.textContent = COPY.claude.sessionsDesc;
  body.appendChild(sdesc);

  // Auto-restore the most recent session when a project opens (global preference).
  const autoRow = document.createElement("label");
  autoRow.className = "toggle-row";
  const autoCb = document.createElement("input");
  autoCb.type = "checkbox";
  autoCb.checked = localStorage.getItem(AUTO_RESTORE_KEY) === "1";
  const autoTxt = document.createElement("span");
  autoTxt.textContent = COPY.claude.autoRestore;
  autoRow.append(autoCb, autoTxt);
  autoCb.addEventListener("change", () => localStorage.setItem(AUTO_RESTORE_KEY, autoCb.checked ? "1" : "0"));
  body.appendChild(autoRow);

  // Actions row: "+ New" (left) and a "delete all" trash button (right edge).
  const sessions = await window.desktop.listSessions();
  const actions = document.createElement("div");
  actions.className = "sess-actions";
  const newBtn = document.createElement("button");
  newBtn.className = "sess-new";
  newBtn.textContent = COPY.claude.newSession;
  newBtn.title = COPY.claude.newSessionTitle;
  newBtn.addEventListener("click", async () => { closeModal(); await clearSession(); });
  const delAllBtn = document.createElement("button");
  delAllBtn.className = "sess-delall";
  delAllBtn.title = COPY.claude.deleteAllTitle;
  delAllBtn.innerHTML = TRASH_SVG;
  delAllBtn.disabled = !sessions.length;
  delAllBtn.addEventListener("click", () => showConfirm({
    title: COPY.claude.deleteAllConfirmTitle,
    okLabel: COPY.claude.deleteAllOk,
    danger: true,
    message: COPY.claude.deleteAllMessage,
    onOk: async () => { await window.desktop.deleteAllSessions(); openModal("claude"); },
  }));
  actions.append(newBtn, delAllBtn);
  body.appendChild(actions);

  const list = document.createElement("div");
  list.className = "sesslist";
  body.appendChild(list);
  // The section description above covers the empty state, so just render whatever exists.
  sessions.forEach((s) => {
    const row = document.createElement("div");
    row.className = "sessrow";
    const open = document.createElement("button");
    open.className = "sessrow-open";
    open.title = COPY.claude.reopenSession;
    const t = document.createElement("div");
    t.className = "sess-title";
    t.textContent = s.title || COPY.claude.untitledSession;
    const d = document.createElement("div");
    d.className = "sess-date";
    d.textContent = relTime(s.createdAt);
    open.append(t, d);
    open.addEventListener("click", async () => { closeModal(); await openSession(s.id); });
    const del = document.createElement("button");
    del.className = "sessrow-del";
    del.title = COPY.claude.deleteSessionTooltip;
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm({
        title: COPY.claude.deleteSessionTitle,
        okLabel: COPY.claude.deleteSessionOk,
        danger: true,
        message: COPY.claude.deleteSessionMessage(s.title || COPY.claude.untitledSession),
        onOk: async () => { await window.desktop.deleteSession(s.id); openModal("claude"); },
      });
    });
    row.append(open, del);
    list.appendChild(row);
  });

  const modelNote = document.createElement("div");
  modelNote.className = "muted";
  modelNote.style.marginTop = "14px";
  modelNote.textContent = COPY.claude.modelNote;
  body.appendChild(modelNote);
}

async function exportCompany(btn) {
  try {
    btn.disabled = true;
    btn.textContent = COPY.common.saving;
    const res = await window.desktop.downloadCompany();
    if (!res.canceled) {
      if (res.ok) addMsg("system", `✓ Company profile saved to ${res.path}`);
      else addMsg("error", res.error || "Could not save the company profile.");
    }
  } catch (e) {
    addMsg("error", String(e));
  } finally {
    closeModal();
  }
}

// External links open in the real browser, not an Electron window.
document.querySelectorAll("a[data-external]").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    window.desktop.openExternal(a.href);
  })
);

// ---- Chat --------------------------------------------------------------------
function addMsg(cls, text) {
  const node = document.createElement("div");
  node.className = "msg " + cls;
  node.textContent = text;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
  updateScrollDownBtn();
  return node;
}

// Auto-scroll for the streaming assistant reply. Instead of always chasing the
// bottom (which pushes the start of a long reply off the top before you can read
// it), keep the latest line visible only while the reply fits; once it grows
// taller than the pane, PIN its top at the top of the pane. So you never lose the
// spot where the reply began — read from the top, then scroll to the end yourself.
// Respects a manual scroll: if you move the pane away from where we last put it,
// we stop auto-scrolling until the next reply.
let lastAutoScrollTop = 0;
function offsetTopWithin(child, parent) {
  let y = 0, n = child;
  while (n && n !== parent && n.offsetParent) { y += n.offsetTop; n = n.offsetParent; }
  return y;
}
// The tool bubble's label. Most tools show their name (+ input), but a raw "Bash"
// (and its shell command) is technical noise the designer shouldn't see, so we swap
// it for a rotating action verb, a small "something's happening" cue that fades out
// with the bubble. Any other tool keeps its normal name + input.
const BASH_VERBS = COPY.chat.bashVerbs;
function toolBubbleLabel(evt) {
  if (evt.name === "Bash") {
    return `⚙ ${BASH_VERBS[Math.floor(Math.random() * BASH_VERBS.length)]}…`;
  }
  return `⚙ ${evt.name}${evt.input ? " " + JSON.stringify(evt.input) : ""}`;
}

function stickStreamScroll() {
  if (!assistantEl) { log.scrollTop = log.scrollHeight; updateScrollDownBtn(); return; }
  // The user scrolled away from our last auto position → don't fight them.
  if (Math.abs(log.scrollTop - lastAutoScrollTop) > 4) { updateScrollDownBtn(); return; }
  const top = offsetTopWithin(assistantEl, log);
  const target = Math.max(0, Math.min(top, log.scrollHeight - log.clientHeight));
  log.scrollTop = target;
  lastAutoScrollTop = target;
  updateScrollDownBtn();
}

// Jump-to-latest button: visible only when the log is scrolled up from the newest
// message (including while a long reply is pinned to its top mid-stream, where the
// end sits below the fold). Click smooth-scrolls to the bottom.
const scrolldown = el("scrolldown");
function updateScrollDownBtn() {
  if (!scrolldown) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  scrolldown.classList.toggle("show", !atBottom);
}
if (scrolldown) {
  scrolldown.addEventListener("click", () => {
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  });
  log.addEventListener("scroll", updateScrollDownBtn, { passive: true });
  window.addEventListener("resize", updateScrollDownBtn);
}

// The pulsing "thinking" indicator. It's shown whenever the agent is busy but
// nothing is actively on screen — i.e. no assistant text is currently streaming
// (`assistantEl` is null). That covers the first beat after a prompt and the gap
// left when a tool bubble collapses out, so the log never sits empty mid-turn.
// updateThinking() is the single reconciler: call it at every state transition
// (send / text / tool / result / error) and it derives visibility from state.
let thinkingEl = null;
function updateThinking() {
  const shouldShow = agentBusy && !assistantEl;
  if (shouldShow) {
    if (!thinkingEl) {
      thinkingEl = document.createElement("div");
      thinkingEl.className = "msg thinking";
      thinkingEl.innerHTML = "<i></i><i></i><i></i>";
    }
    log.appendChild(thinkingEl); // keep it pinned below the latest content
    log.scrollTop = log.scrollHeight;
  } else if (thinkingEl) {
    thinkingEl.remove();
    thinkingEl = null;
  }
}

// Tool bubbles are transient — flash in for a beat of live feedback, then
// collapse out so the chat stays conversation-only (the assistant explains what
// it did in prose anyway). Height is locked to px first so max-height can
// animate to 0; the node removes itself once the transition finishes.
function autoDismissTool(node, delay = 1100) {
  setTimeout(() => {
    if (!node.isConnected) return;
    node.style.maxHeight = node.scrollHeight + "px";
    requestAnimationFrame(() => {
      node.classList.add("fade-out");
      node.style.maxHeight = "0px";
    });
    setTimeout(() => node.remove(), 320);
  }, delay);
}

// ── Context-length gauge + long-session nudges ───────────────────────────────
// The SDK reports token usage at the end of each turn. The last turn's input
// (prompt + cache) ≈ how full the context window is, so we use it to fill the
// corner ring and to nudge the designer toward /clear before things slow down.
const DEFAULT_CONTEXT_WINDOW = 200000;
const GAUGE_CIRCUMFERENCE = 81.68; // 2π·13, matches the SVG radius
// Fire each nudge once per session as the context crosses these fractions.
const SESSION_NUDGES = COPY.chat.sessionNudges;
let sessionTokens = 0;
let sessionPct = 0;
const nudgesFired = new Set();

function contextTokensFrom(usage) {
  if (!usage) return 0;
  const g = (a, b) => usage[a] ?? usage[b] ?? 0;
  // Sum the whole last prompt: fresh input + both cache tiers + this turn's reply.
  return g("input_tokens", "inputTokens")
    + g("cache_read_input_tokens", "cacheReadInputTokens")
    + g("cache_creation_input_tokens", "cacheCreationInputTokens")
    + g("output_tokens", "outputTokens");
}

// Pull an exact per-model context window out of modelUsage when the SDK provides
// it (field name varies by version); otherwise fall back to the 200k default.
function contextWindowFrom(modelUsage) {
  if (modelUsage && typeof modelUsage === "object") {
    for (const m of Object.values(modelUsage)) {
      const w = m?.contextWindow ?? m?.context_window;
      if (typeof w === "number" && w > 0) return w;
    }
  }
  return DEFAULT_CONTEXT_WINDOW;
}

function updateSessionGauge(usage, modelUsage) {
  const tokens = contextTokensFrom(usage);
  if (!tokens) return; // no usage on this turn → leave the gauge as-is
  sessionTokens = tokens;
  const windowSize = contextWindowFrom(modelUsage);
  const frac = Math.max(0, Math.min(1, tokens / windowSize));
  const pct = Math.round(frac * 100);
  sessionPct = pct;

  gauge.hidden = false;
  gauge.dataset.level = frac >= 0.85 ? "high" : frac >= 0.6 ? "mid" : "low";
  gaugeProg.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE * (1 - frac));
  gaugePct.textContent = pct + "%";
  gauge.dataset.tip = COPY.rail.sessionUsageTip(pct); // hover tooltip shows the live %
  gauge.setAttribute("aria-label", COPY.rail.sessionUsageAriaLive(pct));

  for (const n of SESSION_NUDGES) {
    if (frac >= n.at && !nudgesFired.has(n.at)) {
      nudgesFired.add(n.at);
      addMsg("system", n.msg);
      log.scrollTop = log.scrollHeight;
    }
  }
}

// /clear — reset the conversation: drop the SDK session (next prompt starts
// fresh), wipe the chat log, and zero the gauge/nudges. Files on disk untouched.
// Reset the visible chat + gauge state (no archive, no message). Shared by
// starting a new session and reopening a past one.
function resetChatUi() {
  assistantEl = null;
  thinkingEl = null;
  log.innerHTML = "";
  resetIntake(); // never carry a live intake into a fresh/reopened session
  sessionTokens = 0;
  sessionPct = 0;
  nudgesFired.clear();
  gauge.hidden = true;
  gauge.removeAttribute("data-level");
  gaugeProg.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);
  gaugePct.textContent = "";
}

// Start a fresh session. The current one is ARCHIVED into the project first (so
// it lands in the Claude panel's Sessions list) — never discarded.
async function clearSession() {
  const old = sessionId;
  if (old) { try { await window.desktop.archiveSession(old); } catch {} }
  sessionId = null;
  resetChatUi();
  addMsg("system", COPY.chat.startedFresh);
}

// Reopen a past session: replay its chat (Part B) and resume its model context
// (Part A). Archives whatever's currently live before switching away.
async function openSession(id) {
  const data = await window.desktop.loadSession(id);
  if (!data) return;
  if (sessionId && sessionId !== data.sessionId) { try { await window.desktop.archiveSession(sessionId); } catch {} }
  resetChatUi();
  sessionId = data.sessionId;      // Part A — the next turn resumes this session
  conversationStarted = true;
  dismissWelcome();
  for (const m of data.messages) { // Part B — replay the conversation
    if (m.role === "assistant") { const elx = addMsg("assistant", ""); renderMarkdownInto(elx, m.text); }
    else addMsg("user", m.text);
  }
  addMsg("system", COPY.chat.resumedSession);
  log.scrollTop = log.scrollHeight;
}

// "Auto-restore last session on project start" — a global preference (localStorage,
// like the sidebar-collapsed pref). When on, opening a project reopens its most
// recent saved session instead of starting empty. Returns true if it restored one.
const AUTO_RESTORE_KEY = "ta-auto-restore-session";
async function maybeAutoRestoreSession() {
  if (localStorage.getItem(AUTO_RESTORE_KEY) !== "1") return false;
  try {
    const sessions = await window.desktop.listSessions(); // newest first
    if (sessions && sessions.length) { await openSession(sessions[0].id); return true; }
  } catch { /* fall through to a fresh start */ }
  return false;
}

// Generic centered confirm dialog. Reused for the gauge's "new session", and for
// deleting sessions. Pass a title, message, OK label, danger flag, and an onOk.
let confirmAction = null;
function showConfirm({ title, message, okLabel, danger, onOk }) {
  confirmTitle.textContent = title || "Are you sure?";
  confirmMsg.textContent = message || "";
  confirmOk.textContent = okLabel || "Confirm";
  confirmOk.className = "cbtn " + (danger ? "danger" : "primary");
  confirmAction = onOk || null;
  confirmEl.hidden = false;
  confirmOk.focus();
}
function closeConfirm() { confirmEl.hidden = true; confirmAction = null; }

// Clicking the gauge offers to start a new session (which archives the current one).
function openClearConfirm() {
  showConfirm({
    title: COPY.chat.newConfirmTitle,
    okLabel: COPY.chat.newConfirmOk,
    message: COPY.chat.newConfirmMessage(sessionTokens.toLocaleString(), sessionPct),
    onOk: () => sendText("/clear"),
  });
}

gauge.addEventListener("click", openClearConfirm);
gauge.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openClearConfirm(); }
});
confirmCancel.addEventListener("click", closeConfirm);
confirmEl.addEventListener("click", (e) => { if (e.target === confirmEl) closeConfirm(); }); // backdrop
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !confirmEl.hidden) closeConfirm(); });
confirmOk.addEventListener("click", () => { const a = confirmAction; closeConfirm(); if (a) a(); });

// Render a finished assistant message with lightweight inline markdown:
// **bold**, `code`, and hex color chips. Built with DOM nodes (never innerHTML)
// so message text can't inject markup. Applied on finalize — text streams in
// raw, then resolves to formatting when the block completes.
function appendSwatchText(parent, text) {
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const chip = document.createElement("span");
    chip.className = "swatch";
    chip.style.background = m[0];
    parent.appendChild(chip);
    parent.appendChild(document.createTextNode(m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function appendCodeSpans(parent, text) {
  const re = /`([^`]+?)`/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) appendSwatchText(parent, text.slice(last, m.index));
    const code = document.createElement("code");
    code.textContent = m[1];
    parent.appendChild(code);
    last = m.index + m[0].length;
  }
  if (last < text.length) appendSwatchText(parent, text.slice(last));
}

function renderMarkdownInto(parent, text) {
  const re = /\*\*([\s\S]+?)\*\*/g; // **bold** (may wrap a `code` span)
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) appendCodeSpans(parent, text.slice(last, m.index));
    const strong = document.createElement("strong");
    appendCodeSpans(strong, m[1]);
    parent.appendChild(strong);
    last = m.index + m[0].length;
  }
  if (last < text.length) appendCodeSpans(parent, text.slice(last));
}

function finalizeAssistant() {
  if (assistantEl) {
    const text = assistantEl.textContent;
    assistantEl.textContent = "";
    renderMarkdownInto(assistantEl, text);
    assistantEl = null;
  }
}

window.desktop.onAgentEvent((evt) => {
  switch (evt.type) {
    case "text":
      if (quietBuildActive) break; // quiet build: no chat narration until the finished reveal
      if (!assistantEl) { assistantEl = addMsg("assistant", ""); updateThinking(); lastAutoScrollTop = log.scrollTop; }
      assistantEl.textContent += evt.text;
      stickStreamScroll();
      break;
    case "tool":
      finalizeAssistant();
      if (!quietBuildActive) { autoDismissTool(addMsg("tool", toolBubbleLabel(evt))); updateThinking(); } // suppress tool bubbles during the quiet build
      // A tool call may have just written the color palette — poll until the
      // styleguide is preview-ready (not merely when the variation folder
      // appears), then open the live preview mid-turn.
      if (!design.previewReady) {
        window.desktop.getDesignState().then((d) => {
          const flipped = d.previewReady && !design.previewReady;
          design = d;
          if (!flipped) return;
          designJustActivated = true;
          // Quiet build: DON'T reveal mid-build (no browser, no Style guide) — the preparing
          // pane holds until the whole turn finishes (finishQuietBuild). Setup/other flows
          // keep the normal reveal.
          if (quietBuildActive) { buildNarration.advancePast("foundations"); return; }
          if (intakePhase === "designing" && !tabsOpened) revealDuringBuild();
          else refreshPreview();
        });
      }
      // Live preview already open + a file edit is starting → guard it so the
      // designer never sees mid-edit error states. Skip while the Home cover is up
      // (that cover already hides the in-progress home; the Style guide stays live).
      if (tabsOpened && EDIT_TOOLS.has(evt.name) && !homeBuilding) {
        guardPreviewForEdit(friendlyActivity(evt.name, evt.target));
      }
      break;
    case "todo":
      // Authoritative spine advance: the agent moved to a new todo (Phase 2 hook).
      if (quietBuildActive) { const ph = phaseForTodo(evt.todos); if (ph) buildNarration.advanceTo(ph); }
      break;
    case "activity":
      // Quiet build: the Art-Director spine owns the pane; use activity only to advance
      // the phase (never overwrite its curated line with the plain friendlyActivity text).
      if (quietBuildActive) { const ph = phaseForActivity(evt.name, evt.target); if (ph) buildNarration.advanceTo(ph); break; }
      // Narrate what's happening in plain language: in the preview placeholder
      // (setup / guarded edit) or on the Home-tab cover during the build.
      if (!tabsOpened || guarding) setWorkingMessage(friendlyActivity(evt.name, evt.target));
      else if (homeBuilding) setBuildMessage(friendlyActivity(evt.name, evt.target));
      break;
    case "result":
      finalizeAssistant();
      agentBusy = false;
      updateThinking(); // turn done → clear the dots
      clearIntakePending();
      // Figma ingest just finished → read figma.json + show the findings/next-step in the pane.
      if (awaitingFigmaIngest) { awaitingFigmaIngest = false; showFigmaFindings(); }
      // Turn ended mid-intake → the brief is complete: show the review actions.
      if (intakeActive && intakeph.classList.contains("flow")) showBriefComplete();
      endTurnGate(); // release serialization AFTER showBriefComplete decided for this turn
      updateSessionGauge(evt.usage, evt.modelUsage); // refresh the context gauge + maybe nudge
      // Quiet build finished → reveal the completed design now (both tabs, land on Home) and
      // open the chat for iteration. Nothing showed during the build.
      if (quietBuildActive) { finishQuietBuild(); break; }
      // Home was revealed mid-build under a cover → the design is done: uncover it.
      if (homeBuilding) { finishBuildReveal(); break; }
      // Guarding a live edit → the agent is DONE; settle Vite, then reveal.
      if (guarding) { revealPreviewAfterEdit(); break; }
      // A turn may have written the palette — re-check readiness and open the
      // live preview when it flips; otherwise revert the working placeholder.
      if (!design.previewReady) {
        window.desktop.getDesignState().then((d) => {
          const flipped = d.previewReady && !design.previewReady;
          design = d;
          if (flipped) designJustActivated = true;
          refreshPreview();
        });
      } else {
        refreshPreview();
      }
      updateRerollBtn(); // turn settled → re-evaluate the reroll button
      break;
    case "error":
      finalizeAssistant();
      agentBusy = false;
      updateThinking(); // turn errored → clear the dots
      clearIntakePending();
      addMsg("error", "✖ " + evt.message);
      endTurnGate(); // release serialization on error too
      // Even on error, settle-then-reveal so the designer isn't stuck behind a
      // cover (the chat carries the error detail).
      if (quietBuildActive) { finishQuietBuild(); break; } // reveal + open chat (the error is in it)
      if (homeBuilding) { finishBuildReveal(); break; }
      if (guarding) { revealPreviewAfterEdit(); break; }
      refreshPreview();
      applyAdFocus(); // an Art Director action that edited nothing still lands on the design
      break;
  }
});

// AskUserQuestion → render clickable choices in the chat and answer via IPC.
window.desktop.onAgentAsk(({ id, questions }) => renderQuestionCard(id, questions));

// A question wants a file (the company-profile import, or any option that reads
// like "upload/attach a file") → we inject a 📎 Upload choice. While such a card
// is open, an attach (button or drag-drop) fulfills it instead of prefilling.
let pendingFileFulfill = null;
function isFileQuestion(q) {
  const h = (q.header || "").toLowerCase();
  const t = (q.question || "").toLowerCase();
  if (h.includes("company profile") || t.includes("company profile")) return true;
  // Logos (the designer's company logo AND a client's) → offer the same upload.
  if (h.includes("logo") || t.includes("logo")) return true;
  return (q.options || []).some((o) => /upload|attach|choose a file/i.test(o.label || ""));
}

// A design-references question (setup-styleguide's "share reference material" step)
// → the 📎 Upload routes files through the reference-INGEST pipeline (stored under
// .thinkany/references + distilled into the digest, PDFs rasterized), NOT a plain
// file attach. Checked BEFORE isFileQuestion so a "Upload references" option doesn't
// fall through to the plain-attach path. The skill uses the header "Design references".
function isReferenceQuestion(q) {
  const h = (q.header || "").toLowerCase();
  const t = (q.question || "").toLowerCase();
  if (h.includes("reference")) return true;
  return /upload.*(reference|brand guide|moodboard)/i.test(t) ||
    (q.options || []).some((o) => /(reference|brand guide|moodboard)/i.test(o.label || ""));
}

// A font/typeface question → render each option in its ACTUAL typefaces so the
// designer can see a pairing, not just read font names. Heuristic on the header/
// question wording (the model composes these at the styleguide's Fonts step).
function isFontQuestion(q) {
  const h = (q.header || "").toLowerCase();
  const t = (q.question || "").toLowerCase();
  return /font|typeface|pairing/.test(h) || /typeface|font pairing|display face|body copy/.test(t);
}
// Split a pairing label ("Playfair Display + Inter", "Fraunces / Inter") into the
// family names, first = display/heading face, second (if any) = body face.
function parsePairingFonts(label) {
  return String(label || "")
    .split(/\s*(?:\+|\/|·|—|&|,|\band\b|\bwith\b|\bover\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderQuestionCard(id, questions) {
  pendingFileFulfill = null;
  const card = document.createElement("div");
  card.className = "qcard";

  // Per-question state: single-select → string | {other} | null; multi → Set.
  const state = questions.map((q) => (q.multiSelect ? new Set() : null));
  const fileAnswer = questions.map(() => null); // uploaded value per question
  const uploadRefs = [];
  const otherInputs = [];
  const optButtonsByQ = [];

  function applyFile(res, qi) {
    fileAnswer[qi] =
      res.name === "company-profile.json"
        ? `Yes — import the company profile I just uploaded (${res.rel})`
        : res.rel;
    optButtonsByQ[qi]?.forEach((b) => b.classList.remove("selected"));
    const refs = uploadRefs[qi];
    if (refs) {
      refs.uploadBtn.classList.add("selected");
      refs.uploadNote.textContent = COPY.intake.attached(res.name);
    }
    maybeComplete();
  }

  // Uploaded references were ingested (references:add) → set an answer that TELLS the
  // agent to read the digest and use it as the styleguide basis.
  function applyReferences(res, qi) {
    const added = (res.added || []).length;
    if (!added) return;
    const names = (res.added || []).map((a) => a.name).filter(Boolean).slice(0, 6).join(", ");
    fileAnswer[qi] =
      `Uploaded ${added} design reference${added > 1 ? "s" : ""}${names ? ` (${names})` : ""}. ` +
      "They are ingested: read `.thinkany/references/digest.json` for the exact palette and fonts " +
      "(and `digest.md` for the style direction) and use them as the basis for the colors and fonts below.";
    optButtonsByQ[qi]?.forEach((b) => b.classList.remove("selected"));
    const refs = uploadRefs[qi];
    if (refs) {
      refs.uploadBtn.classList.add("selected");
      refs.uploadNote.textContent = COPY.intake.referencesAdded(added);
    }
    maybeComplete();
  }

  const submitBtn = document.createElement("button");
  submitBtn.className = "qsubmit";
  submitBtn.textContent = COPY.intake.submit;
  submitBtn.disabled = true;

  function valueFor(qi) {
    if (fileAnswer[qi]) return fileAnswer[qi];
    const q = questions[qi];
    const otherVal = otherInputs[qi] && !otherInputs[qi].hidden ? otherInputs[qi].value.trim() : "";
    if (q.multiSelect) {
      const labels = [...state[qi]];
      if (otherVal) labels.push(otherVal);
      return labels.length ? labels.join(", ") : null;
    }
    if (state[qi] && typeof state[qi] === "object") return otherVal || null; // "Other" chosen
    return state[qi];
  }
  const isComplete = () => questions.every((_, qi) => {
    const v = valueFor(qi);
    return v != null && v !== "";
  });
  function maybeComplete() {
    submitBtn.disabled = !isComplete();
    // Snappy: a single single-select question auto-submits on choice.
    if (!submitBtn.disabled && questions.length === 1 && !questions[0].multiSelect) doSubmit();
  }
  async function doSubmit() {
    if (card.classList.contains("answered")) return;
    pendingFileFulfill = null;
    card.classList.add("answered");
    // Drop focus so a pasted "Other" value doesn't leave a blinking caret in the
    // now-answered field (paste auto-submits a single single-select question).
    otherInputs.forEach((i) => i && i.blur());
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    submitBtn.remove();
    const answers = {};
    questions.forEach((q, qi) => (answers[q.question] = valueFor(qi)));
    await window.desktop.answerAgent(id, answers);
    addMsg("system", "✓ " + questions.map((q) => `${q.header}: ${answers[q.question]}`).join(" · "));
  }

  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "qblock";
    const hdr = document.createElement("span");
    hdr.className = "qheader";
    hdr.textContent = q.header || COPY.intake.questionFallback;
    const txt = document.createElement("div");
    txt.className = "qtext";
    txt.textContent = q.question;
    block.append(hdr, txt);

    const optButtons = [];
    const otherInput = document.createElement("input");
    otherInput.className = "qother-input";
    otherInput.placeholder = COPY.intake.otherPlaceholder;
    otherInput.hidden = true;
    otherInputs[qi] = otherInput;

    // References question → 📎 Upload routes to the ingest pipeline (multi-file
    // picker via references:add), distinct from the plain file attach below.
    if (isReferenceQuestion(q)) {
      const uploadBtn = document.createElement("button");
      uploadBtn.className = "qopt qupload";
      const ul = document.createElement("div");
      ul.className = "lbl";
      ul.textContent = COPY.intake.uploadReferences;
      const ud = document.createElement("div");
      ud.className = "desc";
      ud.textContent = COPY.intake.uploadReferencesDesc;
      uploadBtn.append(ul, ud);
      const uploadNote = document.createElement("div");
      uploadNote.className = "qupload-note";
      // Shared by the picker AND drag-drop: run the ingest, then WAIT for the vision
      // pass to finish so the digest is complete before the agent reads it, then answer.
      async function ingestFromCard(resultPromise) {
        if (card.classList.contains("answered")) return;
        uploadNote.textContent = COPY.intake.readingReferences;
        try {
          const res = await resultPromise;
          if (res && res.canceled) { uploadNote.textContent = ""; return; }
          if (!res || !res.ok) { uploadNote.textContent = (res && res.error) || COPY.intake.couldNotAddReferences; return; }
          handleRefResult(res); // fold into the rail + a soft chat line (reuse)
          if (!(res.added || []).length) { uploadNote.textContent = COPY.intake.alreadyAdded; return; }
          if (res.analyzing) { // T2 vision still running → wait so the digest is whole
            uploadNote.textContent = COPY.intake.readingReferencesDistilling;
            await waitForIngest();
          }
          applyReferences(res, qi);
        } catch (e) { uploadNote.textContent = String(e); }
      }
      uploadBtn.addEventListener("click", () => ingestFromCard(window.desktop.addReferences()));
      ["dragenter", "dragover"].forEach((t) => uploadBtn.addEventListener(t, (e) => {
        e.preventDefault(); e.stopPropagation(); uploadBtn.classList.add("drag");
      }));
      ["dragleave", "drop"].forEach((t) => uploadBtn.addEventListener(t, (e) => {
        e.preventDefault(); e.stopPropagation(); uploadBtn.classList.remove("drag");
      }));
      uploadBtn.addEventListener("drop", (e) => {
        const paths = [];
        for (const f of [...(e.dataTransfer?.files || [])]) {
          const src = window.desktop.pathForFile(f);
          if (src) paths.push(src);
        }
        if (paths.length) ingestFromCard(window.desktop.addReferencePaths(paths));
      });
      uploadRefs[qi] = { uploadBtn, uploadNote };
      block.append(uploadBtn, uploadNote);
    } else if (isFileQuestion(q)) {
      const uploadBtn = document.createElement("button");
      uploadBtn.className = "qopt qupload";
      const ul = document.createElement("div");
      ul.className = "lbl";
      ul.textContent = COPY.intake.uploadFile;
      const ud = document.createElement("div");
      ud.className = "desc";
      ud.textContent = COPY.intake.uploadFileDesc;
      uploadBtn.append(ul, ud);
      const uploadNote = document.createElement("div");
      uploadNote.className = "qupload-note";
      uploadBtn.addEventListener("click", async () => {
        if (card.classList.contains("answered")) return;
        try {
          const res = await window.desktop.attachFile();
          if (res && res.ok) applyFile(res, qi);
          else if (res && !res.canceled && res.error) uploadNote.textContent = res.error;
        } catch (e) {
          uploadNote.textContent = String(e);
        }
      });
      uploadRefs[qi] = { uploadBtn, uploadNote };
      pendingFileFulfill = (res) => applyFile(res, qi);
      block.append(uploadBtn, uploadNote);
    }

    const fontQuestion = isFontQuestion(q);
    if (fontQuestion) loadGoogleFonts((q.options || []).flatMap((o) => parsePairingFonts(o.label)));

    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "qopt" + (fontQuestion ? " qfont" : "");
      if (fontQuestion) {
        // Show the pairing in its ACTUAL faces: the display family rendered large in
        // itself, then a sentence in the companion body face, so the choice is
        // something you can see rather than a name to go research.
        const fams = parsePairingFonts(opt.label);
        const display = fams[0] || opt.label;
        const bodyFam = fams[1] || fams[0] || display;
        const head = document.createElement("div");
        head.className = "qfont-head";
        head.style.fontFamily = `'${display}', Georgia, serif`;
        head.textContent = display;
        const sample = document.createElement("div");
        sample.className = "qfont-body";
        sample.style.fontFamily = `'${bodyFam}', system-ui, -apple-system, sans-serif`;
        sample.textContent = (fams[1] ? bodyFam + " · " : "") + "The quick brown fox jumps over the lazy dog";
        btn.append(head, sample);
      } else {
        const lbl = document.createElement("div");
        lbl.className = "lbl";
        lbl.textContent = opt.label;
        btn.appendChild(lbl);
      }
      if (opt.description) {
        const desc = document.createElement("div");
        desc.className = "desc";
        desc.textContent = opt.description;
        btn.appendChild(desc);
      }
      btn.addEventListener("click", () => {
        if (card.classList.contains("answered")) return;
        if (q.multiSelect) {
          if (state[qi].has(opt.label)) { state[qi].delete(opt.label); btn.classList.remove("selected"); }
          else { state[qi].add(opt.label); btn.classList.add("selected"); }
        } else {
          state[qi] = opt.label;
          optButtons.forEach((b) => b.classList.remove("selected"));
          otherBtn.classList.remove("selected");
          otherInput.hidden = true;
          btn.classList.add("selected");
        }
        maybeComplete();
      });
      optButtons.push(btn);
      block.appendChild(btn);
    });
    optButtonsByQ[qi] = optButtons;

    const otherBtn = document.createElement("button");
    otherBtn.className = "qopt";
    const olbl = document.createElement("div");
    olbl.className = "lbl";
    olbl.textContent = COPY.intake.other;
    otherBtn.appendChild(olbl);
    otherBtn.addEventListener("click", () => {
      if (card.classList.contains("answered")) return;
      otherInput.hidden = false;
      otherInput.focus();
      if (!q.multiSelect) {
        optButtons.forEach((b) => b.classList.remove("selected"));
        state[qi] = { other: true };
      }
      otherBtn.classList.add("selected");
      maybeComplete();
    });
    otherInput.addEventListener("input", maybeComplete);
    otherInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !submitBtn.disabled) { e.preventDefault(); doSubmit(); }
    });
    block.append(otherBtn, otherInput);
    card.appendChild(block);
  });

  submitBtn.addEventListener("click", doSubmit);
  card.appendChild(submitBtn);
  log.appendChild(card);
  log.scrollTop = log.scrollHeight;
}

// ---- Intake host (in-pane onboarding — T3/T4) -------------------------------
// The agent drives the onboarding conversation by calling the `intake` tool
// (agent.mjs) with a batch of cards; main.cjs routes each batch here as an
// `agent:intake` event. This host renders each batch as a card GROUP in the pane
// (not the chat), collects the answers, and posts them back with `answerIntake`
// so the agent's tool call resolves and it can send the next batch. Prior groups
// stay in the stack as answered history. See tickets T3 (host) + T4 (renderers).

// ---- Intake motion (soft, GSAP-like, via the Web Animations API) ------------
// A single ease-out curve (≈ GSAP power3.out) + generous durations give the
// "intentional and soft" feel. anim() cancels any prior animations on the element
// first so re-entrances (start → design) don't composite oddly.
const INTAKE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
function anim(elem, keyframes, opts = {}) {
  if (!elem || typeof elem.animate !== "function") return null;
  try { elem.getAnimations().forEach((a) => a.cancel()); } catch {}
  return elem.animate(keyframes, { easing: INTAKE_EASE, fill: "both", ...opts });
}
// Fade + slide into place from an (dx,dy) offset.
function fadeSlideIn(elem, { dx = 0, dy = 0, duration = 640, delay = 0 } = {}) {
  return anim(elem, [
    { opacity: 0, transform: `translate(${dx}px, ${dy}px)` },
    { opacity: 1, transform: "translate(0px, 0px)" },
  ], { duration, delay });
}

// Show/clear the intake pane. Entering hides the browser + placeholder; the guard
// in refreshPreview() keeps them from stomping the host while a flow is live.
function enterIntakeMode() {
  intakeActive = true;
  browser.hidden = true;
  previewph.hidden = true;
  intakeph.hidden = false;
}
function setIntakeHead(title, lead) {
  el("intake-title").textContent = title;
  el("intake-lead").innerHTML = lead; // lead is trusted COPY; allows <br> etc.
}
function resetIntake() {
  intakeActive = false;
  startChoicesShown = false;
  refsRevealed = false;
  voiceStepDone = false;
  heroStepDone = false;
  menuStepDone = false;
  ctaStepDone = false;
  intakePhase = "idle";
  currentIntakeId = null;
  exitReview(); // clear the review's head-hidden state
  intakeph.classList.remove("start", "flow", "hasbrief");
  intakeph.hidden = true;
  intakeStack.innerHTML = "";
  el("intake-brief").innerHTML = "";
  updateBackButton();
}

window.desktop.onAgentIntake(({ id, cards }) => {
  // Only render intake cards while we're actively gathering the brief. A late
  // batch from a stale agent turn (e.g. the designer hit Back, or backed all the
  // way to the start screen) would otherwise force the pane into gathering mode
  // and leak a question card onto the wrong screen. Cancel it instead — the
  // agent's tool call errors out and it stops.
  if (intakePhase !== "gathering") {
    try { window.desktop.cancelIntake(id); } catch { /* already gone */ }
    return;
  }
  renderIntakeGroup(id, cards);
});

// The Brief accumulated so far (T5) — main folds each answered batch in and pushes
// it here. Render it as a compact "Your brief so far" recap pinned above the cards.
window.desktop.onAgentBrief((brief) => renderBriefSummary(brief));

// Latest Brief + uploaded references, composed together into the pane's left rail.
// The brief channel (agent:brief) and the references channel (references:changed)
// each feed their own piece; composeRail() rebuilds the rail from whichever changed.
let lastBrief = null;
let lastReferences = [];
let lastDigest = null;    // digest.json from the ingest (T1 stub → T2 rich)
let refsBusy = false;     // brief local state while a drop is uploading
let refsAnalyzing = false; // main's vision pass is running (T2)
let railBriefRows = 0;   // prior brief-row count, so the Brief card eases in once
let refsRevealed = false; // the rail (Design References) stays hidden until the first question is answered
let voiceStepDone = false; // the Tone/rules step is injected by the renderer as the final question

function renderBriefSummary(brief) {
  lastBrief = brief;
  composeRail();
}

function applyRefPayload(p) {
  lastReferences = (p && p.assets) || [];
  if (p && "digest" in p) lastDigest = p.digest || null;
  refsAnalyzing = !!(p && p.analyzing);
  composeRail();
}

// Wait for the reference-ingest vision pass to finish (refsAnalyzing is kept live by
// references:changed broadcasts) so a caller reads a COMPLETE digest, not the T1 stub.
// Bounded so a failed/hung/keyless pass never blocks the flow.
async function waitForIngest(timeoutMs = 30000) {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 300)); // let the "analyzing" broadcast land
  while (refsAnalyzing && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 400));
  }
}

// Pull the open project's stored references into the rail. Called when the design
// intake enters flow mode so the upload zone is present from the very start, and
// on boot the references:changed channel keeps it live thereafter.
function loadReferences() {
  if (!window.desktop.listReferences) return;
  window.desktop.listReferences().then(applyRefPayload).catch(() => {});
}

// Copy-voice state for the intake's "voice" card (globals for reference + this
// project's rules). Loaded when a design flow starts so the card renders synchronously.
let lastVoice = null;
function loadVoice() {
  if (!window.desktop.getVoice) return;
  window.desktop.getVoice().then((v) => { lastVoice = v || { project: {}, global: [] }; }).catch(() => {});
}

window.desktop.onReferencesChanged(applyRefPayload);

// Build the left rail: the design-references panel (design intake only) above the
// "Your brief so far" recap. The rail shows whenever the design intake is running
// (so references can be dropped from the start) or the brief has any rows.
function composeRail() {
  const box = el("intake-brief");
  // Toggling `hasbrief` on the host is what animates the rail open (left 40%) and
  // makes room for the questions column; the CSS handles the transition.
  const showRail = (has) => intakeph.classList.toggle("hasbrief", has);
  const flow = intakeph.classList.contains("flow");

  const brief = lastBrief;
  const rows = [];
  const add = (key, val) => { if (val) rows.push([key, val]); };
  if (brief) {
    if (brief.projectType) add("Type", brief.projectType === "app" ? "App" : "Web site");
    add("Making", brief.what);
    add("Company", brief.clientName);
    add("Project", brief.projectName);
    if (brief.logo && brief.logo.filename) add("Logo", brief.logo.filename);
    if (Array.isArray(brief.colorSources) && brief.colorSources.length) {
      add("Colors", brief.colorSources.map((c) => c && c.value).filter(Boolean).join(", "));
    }
    if (Array.isArray(brief.fontSources) && brief.fontSources.length) {
      add("Fonts", brief.fontSources.map((f) => f && f.value).filter(Boolean).join(", "));
    }
    if (Array.isArray(brief.sections) && brief.sections.length) add("Sections", brief.sections.join(", "));
    if (brief.menuLayout) add("Header", MENU_LAYOUT_TITLE[brief.menuLayout] || brief.menuLayout);
    if (brief.heroLayout) add("Hero", HERO_LAYOUT_TITLE[brief.heroLayout] || brief.heroLayout);
    if (brief.ctaType) add("Contact", CTA_TYPE_TITLE[brief.ctaType] || brief.ctaType);
    if (Array.isArray(brief.references) && brief.references.length) {
      add("Likes", brief.references.map((r) => r.url + (r.reason ? ` (${r.reason})` : "")).join("; "));
    }
    if (Array.isArray(brief.audience) && brief.audience.length) add("For", brief.audience.join(", "));
    add("Tone", brief.tone);
    if (Array.isArray(brief.notes) && brief.notes.length) add("Notes", brief.notes.join("; "));
  }

  if (!flow) railBriefRows = 0; // reset so the Brief eases in fresh on re-entry

  box.innerHTML = "";
  // Design References only appear once the first question has been answered.
  if (flow && refsRevealed) box.appendChild(buildReferencesPanel());
  let briefCard = null;
  if (rows.length) {
    briefCard = document.createElement("div");
    briefCard.className = "ibrief-card";
    const title = document.createElement("div");
    title.className = "ibrief-title";
    title.textContent = COPY.intake.briefTitle;
    briefCard.appendChild(title);
    for (const [key, val] of rows) {
      const row = document.createElement("div");
      row.className = "ibrief-row";
      const k = document.createElement("span");
      k.className = "ibrief-key";
      k.textContent = key;
      const v = document.createElement("span");
      v.className = "ibrief-val";
      v.textContent = val;
      row.append(k, v);
      briefCard.appendChild(row);
    }
    box.appendChild(briefCard);
  }
  showRail((flow && refsRevealed) || rows.length > 0);

  // Ease the Brief card in the first time it appears (not a harsh pop), and softly
  // scroll it into view as it grows, mirroring the questions column's motion.
  if (briefCard && rows.length > railBriefRows) {
    if (railBriefRows === 0) fadeSlideIn(briefCard, { dy: 14, duration: 520, delay: 40 });
    try { briefCard.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch { /* older webview */ }
  }
  railBriefRows = rows.length;
}

// The design-references panel in the rail: a header, a hint, an upload/drop zone,
// and the thumbnail grid of what's uploaded. Files land in the private .thinkany
// store (reference-ingest T0) — no ingest yet, just capture + show.
function buildReferencesPanel() {
  const panel = document.createElement("div");
  panel.className = "iref-panel";

  const title = document.createElement("div");
  title.className = "iref-title";
  title.textContent = COPY.intake.referencesTitle;
  panel.appendChild(title);

  // Thin-line "?" in the corner → opens the "how references work" overlay.
  const info = document.createElement("button");
  info.type = "button";
  info.className = "iref-info";
  info.title = COPY.intake.referencesHelpTitle;
  info.setAttribute("aria-label", COPY.intake.referencesHelpTitle);
  info.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
  info.addEventListener("click", (e) => { e.stopPropagation(); openReferencesHelp(); });
  panel.appendChild(info);

  const hint = document.createElement("div");
  hint.className = "iref-hint";
  hint.textContent = COPY.intake.referencesHint;
  panel.appendChild(hint);

  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "iref-drop";
  drop.innerHTML = '<span class="iref-plus">＋</span><span>' + COPY.intake.uploadReferencesShort + '</span>';
  drop.addEventListener("click", addReferencesViaPicker);
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation(); drop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation(); drop.classList.remove("drag");
  }));
  drop.addEventListener("drop", onReferenceDrop);
  panel.appendChild(drop);

  if (refsBusy || refsAnalyzing) {
    const reading = document.createElement("div");
    reading.className = "iref-reading";
    reading.textContent = refsAnalyzing ? COPY.intake.readingReferences : COPY.intake.addingReferences;
    panel.appendChild(reading);
  }

  if (lastReferences.length) {
    const grid = document.createElement("div");
    grid.className = "iref-grid";
    for (const a of lastReferences) grid.appendChild(buildReferenceChip(a));
    panel.appendChild(grid);
  }

  // Palette pulled from the images by the deterministic ingest (exact hexes).
  const palette = (lastDigest && lastDigest.palette) || [];
  if (palette.length) {
    const strip = document.createElement("div");
    strip.className = "iref-palette";
    const lbl = document.createElement("span");
    lbl.className = "iref-palette-lbl";
    lbl.textContent = COPY.intake.palette;
    strip.appendChild(lbl);
    for (const hex of palette) {
      const sw = document.createElement("span");
      sw.className = "iref-swatch";
      sw.style.background = hex;
      sw.title = hex;
      strip.appendChild(sw);
    }
    panel.appendChild(strip);
  }

  // The distilled "feel" from the vision pass (T2) — a one-line signal that the
  // references have been understood, not just captured.
  const feel = lastDigest && lastDigest.style && lastDigest.style.overallFeel;
  if (feel) {
    const line = document.createElement("div");
    line.className = "iref-feel";
    line.textContent = feel;
    panel.appendChild(line);
  }
  return panel;
}

// One uploaded reference: an image thumbnail (via file://, the assets dir is
// outside public/) or a type glyph for docs, its name, and a remove control.
function buildReferenceChip(a) {
  const chip = document.createElement("div");
  chip.className = "iref-chip";

  const thumb = document.createElement("div");
  thumb.className = "iref-thumb iref-" + (a.kind || "other");
  if (a.kind === "image" && a.abs) {
    const img = document.createElement("img");
    img.src = "file://" + encodeURI(a.abs);
    img.alt = a.name || "";
    img.onerror = () => { img.remove(); thumb.classList.add("iref-glyph"); thumb.textContent = "🖼"; };
    thumb.appendChild(img);
  } else {
    thumb.classList.add("iref-glyph");
    thumb.textContent = a.kind === "document" ? "📄" : "📎";
  }

  const name = document.createElement("div");
  name.className = "iref-name";
  name.textContent = a.name || (a.file || "").split("/").pop();
  name.title = name.textContent;

  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "iref-rm";
  rm.textContent = "✕";
  rm.title = COPY.intake.removeReference;
  rm.addEventListener("click", async (e) => {
    e.stopPropagation();
    try { handleRefResult(await window.desktop.removeReference(a.id)); }
    catch (err) { addMsg("error", String(err)); }
  });

  chip.append(thumb, name, rm);
  chip.style.cursor = "zoom-in";
  chip.title = COPY.intake.clickToView;
  chip.addEventListener("click", () => openReferenceLightbox(a));
  return chip;
}

// Lightbox a reference: images render full-size, other files show a glyph + an
// "Open file" action (Electron opens it in the OS default app). Filename is the
// caption. Click the backdrop or press Escape to close.
function openReferenceLightbox(a) {
  const overlay = document.createElement("div");
  overlay.className = "iref-lightbox";
  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() { overlay.classList.remove("show"); document.removeEventListener("keydown", onKey); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener("click", close);

  const fig = document.createElement("figure");
  fig.className = "iref-lb-fig";
  fig.addEventListener("click", (e) => e.stopPropagation()); // clicks inside don't dismiss

  if (a.kind === "image" && a.abs) {
    const img = document.createElement("img");
    img.src = "file://" + encodeURI(a.abs);
    img.alt = a.name || "";
    fig.appendChild(img);
  } else {
    const glyph = document.createElement("div");
    glyph.className = "iref-lb-glyph";
    glyph.textContent = a.kind === "document" ? "📄" : "📎";
    fig.appendChild(glyph);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "iref-lb-open";
    open.textContent = COPY.intake.openFile;
    open.addEventListener("click", () => { if (a.abs) window.desktop.openExternal("file://" + encodeURI(a.abs)); });
    fig.appendChild(open);
  }

  const cap = document.createElement("figcaption");
  cap.className = "iref-lb-cap";
  cap.textContent = a.name || (a.file || "").split("/").pop();
  fig.appendChild(cap);

  overlay.appendChild(fig);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("show"));
}

// The "how references work" overlay: what ingest attempts + guidance on what works
// best. Same dismiss pattern as the lightbox (backdrop / Escape / the × button).
// Generic help overlay (backdrop + card + Esc/close), reused by the references "?" and the
// design-direction "?". `html` supplies the card body (must include a `.iref-help-x` close).
function openHelpOverlay(html) {
  const overlay = document.createElement("div");
  overlay.className = "iref-help";
  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() { overlay.classList.remove("show"); document.removeEventListener("keydown", onKey); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener("click", close);

  const card = document.createElement("div");
  card.className = "iref-help-card";
  card.addEventListener("click", (e) => e.stopPropagation()); // clicks inside don't dismiss
  card.innerHTML = html;
  const x = card.querySelector(".iref-help-x");
  if (x) x.addEventListener("click", close);

  // Optional tabs: a card with .iref-help-tab buttons + .iref-help-panel sections switches
  // panels on click (no-op for the untabbed cards). data-tab on the button = data-panel on
  // the section it reveals.
  const tabBtns = card.querySelectorAll(".iref-help-tab");
  if (tabBtns.length) tabBtns.forEach((btn) => btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    card.querySelectorAll(".iref-help-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
  }));

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("show"));
}
function openReferencesHelp() { openHelpOverlay(COPY.intake.referencesHelpHtml); }
function openDirectionHelp() { openHelpOverlay(COPY.intake.direction.helpHtml); }

async function addReferencesViaPicker() {
  try { handleRefResult(await window.desktop.addReferences()); }
  catch (e) { addMsg("error", String(e)); }
}

async function onReferenceDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const paths = [];
  for (const f of [...(e.dataTransfer?.files || [])]) {
    const src = window.desktop.pathForFile(f);
    if (src) paths.push(src);
  }
  if (!paths.length) return;
  refsBusy = true; composeRail();
  try { handleRefResult(await window.desktop.addReferencePaths(paths)); }
  catch (err) { addMsg("error", String(err)); }
  finally { refsBusy = false; composeRail(); }
}

// Fold an add/remove result back into the rail and give a soft line in the chat.
function handleRefResult(res) {
  if (!res || res.canceled) return;
  if (!res.ok) { addMsg("error", res.error || "Could not add the references."); return; }
  lastReferences = res.assets || lastReferences;
  if ("digest" in res) lastDigest = res.digest || lastDigest;
  composeRail();
  const added = (res.added || []).length;
  const dupes = (res.skipped || []).filter((s) => s.reason === "duplicate").length;
  if (added) addMsg("system", `📎 Added ${added} design reference${added > 1 ? "s" : ""}.`);
  if (dupes) addMsg("system", `${dupes} already added, skipped.`);
}

// Render ONE intake() batch as a group: its cards + a single Continue button.
function renderIntakeGroup(id, cards) {
  enterIntakeMode();
  clearIntakePending(); // the next questions are here → fade the "hang tight" line
  exitReview(); // a new question means we're back to gathering, not reviewing
  intakePhase = "gathering";
  currentIntakeId = id; // Back can cancel this pending batch
  updateBackButton();

  const group = document.createElement("div");
  group.className = "intake-group";

  // Each renderer reports { getValue(), isReady() } up to the group so Continue
  // can enable itself. getValue() → the answer (null = skipped/empty); isReady()
  // → whether this card is complete enough to submit (skippable is always ready).
  const controls = (cards || []).map((card) => {
    const r = renderIntakeCard(card, refreshReady, requestSubmit);
    group.appendChild(r.el);
    return { card, ...r };
  });

  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;
  function refreshReady() { continueBtn.disabled = !controls.every((c) => c.isReady()); }
  refreshReady();

  // Advance without a second click: a card (Enter in a text field, or toggling
  // "you decide") can ask to submit; it only goes through if the whole group is
  // ready. Keeps single-field steps to zero extra clicks.
  function requestSubmit() {
    if (group.classList.contains("answered")) return;
    if (controls.every((c) => c.isReady())) submit();
  }

  async function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const answers = {};
    for (const c of controls) { answers[c.card.id] = c.getValue(); c.collapse(); }
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900); // flash "✓ Got it", then fade + collapse it away
    if (currentIntakeId === id) currentIntakeId = null; // answered, not cancellable now
    // First answer is in → fade the Design References rail in (it stayed hidden until now).
    if (!refsRevealed) { refsRevealed = true; composeRail(); }
    // Conversational feedback while the agent takes it in — cycled so the line after
    // the second answer differs from the first (works whether or not more follow).
    showIntakePending(TAKING_IN_MESSAGES[takingInIdx % TAKING_IN_MESSAGES.length]);
    takingInIdx++;
    makeCardsEditable(group, controls, persistIntakeEdit);
    await window.desktop.answerIntake(id, answers);
  }
  continueBtn.addEventListener("click", submit);
  group.appendChild(continueBtn);

  intakeStack.appendChild(group);
  // In flow mode the scroll lives on the questions column, not the pane.
  const scroller = intakeph.classList.contains("flow")
    ? intakeph.querySelector(".intake-inner")
    : intakeph;
  // Center THIS question in the view, bumping the answered ones up above it. Measure
  // before the entrance transform so we target its final resting spot, then smooth-
  // scroll there while it rises in.
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) {
    try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); }
    catch { scroller.scrollTop = centerTo; }
  }
}

// The scrollTop that vertically centers `elm` within `scroller` (clamped to range).
// Used so each new intake question lands centered while answered ones bump up above.
function intakeCenterTarget(scroller, elm) {
  const sRect = scroller.getBoundingClientRect();
  const eRect = elm.getBoundingClientRect();
  const elmTop = (eRect.top - sRect.top) + scroller.scrollTop;
  const target = elmTop - (scroller.clientHeight - eRect.height) / 2;
  return Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
}

function doneNote() {
  const d = document.createElement("div");
  d.className = "intake-done";
  d.textContent = COPY.intake.gotIt;
  return d;
}

// Click-to-edit: once a card group is answered (collapsed), let the designer re-open it
// to revise their answer instead of getting one shot at each question. Clicking the
// collapsed card (or its "Edit" link) re-opens the live controls with a Save button; Save
// re-persists just those fields via `persist` (the brief rail refreshes itself from the
// agent:brief echo) and re-collapses — it does NOT advance or rewind the flow. Note:
// editing an early free-text/sections answer won't re-run the model turn that already
// consumed it, but the revised value IS what the build reads from the Brief.
function makeCardsEditable(group, controls, persist) {
  if (!controls || !controls.length) return;
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "intake-edit";
  edit.textContent = COPY.intake.edit;
  // Lives INSIDE the (last) card, tucked into its lower-right corner — not floating below
  // the card in the group. The Save button, by contrast, sits at group level like Continue.
  (controls[controls.length - 1].el || group).appendChild(edit);

  let editing = false, saveBtn = null;
  function open() {
    if (editing || !group.classList.contains("answered")) return;
    editing = true;
    group.classList.add("editing");
    edit.style.display = "none";
    controls.forEach((c) => c.expand());
    saveBtn = document.createElement("button");
    saveBtn.className = "intake-continue";
    saveBtn.textContent = COPY.intake.saveEdit;
    saveBtn.addEventListener("click", commit);
    group.appendChild(saveBtn);
  }
  async function commit() {
    if (!controls.every((c) => c.isReady())) return; // a required field was cleared
    const answers = {}, meta = [];
    controls.forEach((c) => { answers[c.card.id] = c.getValue(); meta.push({ id: c.card.id, field: c.card.field, type: c.card.type }); c.collapse(); });
    if (saveBtn) { saveBtn.remove(); saveBtn = null; }
    edit.style.display = "";
    group.classList.remove("editing");
    editing = false;
    try { await persist(meta, answers); } catch {}
  }
  edit.addEventListener("click", open);
  // The whole collapsed card is a click target too (the literal "click to edit").
  group.addEventListener("click", (e) => {
    if (editing || e.target.closest("button")) return;
    if (e.target.closest(".icard.collapsed")) open();
  });
}

// The default edit persist for cards that fold into the Brief (everything but the voice
// step). applyIntakeAnswers re-folds identically to the original submit and echoes the
// updated Brief back (agent:brief → rail refresh).
const persistIntakeEdit = (meta, answers) => window.desktop.applyIntakeAnswers(meta, answers);

// A soft, conversational "thinking" line under the answered card, shown while the
// agent lines up the next batch (the designer is watching the pane, not the chat).
// It fades away when the next questions arrive (renderIntakeGroup) or the turn ends.
function showIntakePending(text) {
  clearIntakePending();
  const p = document.createElement("div");
  p.className = "intake-pending";
  p.id = "intake-pending";
  const t = document.createElement("span");
  t.className = "intake-pending-text";
  t.textContent = text;
  const dots = document.createElement("span");
  dots.className = "intake-pending-dots";
  dots.innerHTML = "<i></i><i></i><i></i>";
  p.append(t, dots);
  intakeStack.appendChild(p);
  fadeSlideIn(p, { dy: 10, duration: 520 });
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
function clearIntakePending() {
  const p = document.getElementById("intake-pending");
  if (!p) return;
  p.id = ""; // release the id so a fresh pending can appear during this fade-out
  const a = anim(p, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 360 });
  if (a && a.finished) a.finished.then(() => p.remove(), () => p.remove());
  else p.remove();
}

// ---- Brief-complete review state (#2) ---------------------------------------
// When the agent finishes gathering (its turn ends mid-intake), the pane animates
// the head + question groups OFF (keeping the brief rail) and offers two choices:
// start designing, or add more context first.
// The Tone / copy-rules step, INJECTED by the renderer (not the agent) so it always
// appears as the final question, right before the review. buildVoiceRules persists
// tone + rules to the project voice on change (auto-handed to the agent), so there's
// no tool call to resolve — on submit we simply advance to the review.
function renderVoiceStep() {
  if (intakeStack.querySelector(".voice-step")) return; // already showing
  currentIntakeId = null;
  const card = { id: "tone", type: "voice", label: "What is the desired tone for the copy?", skippable: true, agentDecidesLabel: COPY.intake.letYouChoose };
  const group = document.createElement("div");
  group.className = "intake-group voice-step";
  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;

  const refreshReady = () => { continueBtn.disabled = !ctl.isReady(); };
  const requestSubmit = () => { if (!group.classList.contains("answered") && ctl.isReady()) submit(); };
  const ctl = renderIntakeCard(card, refreshReady, requestSubmit);
  group.append(ctl.el, continueBtn);
  refreshReady();

  function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const val = ctl.getValue();
    ctl.collapse();
    if (val) {
      if (lastBrief) { lastBrief.tone = val; composeRail(); }   // immediate: brief rail
      try { window.desktop.setBriefTone(val); } catch {}        // → Brief (design prompt + dashboard card)
    }
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900);
    voiceStepDone = true;
    // Editable: re-picking a tone re-persists it (rules persist live in buildVoiceRules).
    makeCardsEditable(group, [ctl], (_meta, a) => window.desktop.setBriefTone(a.tone || null));
    setTimeout(showBriefComplete, 520); // let "✓ Got it" flash, then the review
  }
  continueBtn.addEventListener("click", submit);

  intakeStack.appendChild(group);
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) { try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); } catch { scroller.scrollTop = centerTo; } }
}

// ---- Hero-layout step (renderer-injected, after sections) --------------------
// Shown right after the model turn (which gathers sections), but ONLY when Hero is
// among the chosen sections. Mirrors the voice step: a single client card, folded
// into the Brief via applyIntakeAnswers, then on submit advances the brief-complete
// flow. Skippable ("I'll let you choose") = null = the agent decides the hero.
let heroStepDone = false;

function heroStepApplicable() {
  const s = lastBrief && Array.isArray(lastBrief.sections) ? lastBrief.sections : null;
  return !!(s && s.some((x) => /hero/i.test(String(x))));
}

function renderHeroStep() {
  if (intakeStack.querySelector(".hero-step")) return; // already showing
  currentIntakeId = null;
  const card = {
    id: "heroLayout", field: "heroLayout", type: "hero-layout",
    label: COPY.intake.q.heroLayout, help: COPY.intake.q.heroLayoutHelp,
    skippable: true, agentDecidesLabel: COPY.intake.letYouChoose,
  };
  const group = document.createElement("div");
  group.className = "intake-group hero-step";
  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;

  const refreshReady = () => { continueBtn.disabled = !ctl.isReady(); };
  const requestSubmit = () => { if (!group.classList.contains("answered") && ctl.isReady()) submit(); };
  const ctl = renderIntakeCard(card, refreshReady, requestSubmit);
  group.append(ctl.el, continueBtn);
  refreshReady();

  async function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const val = ctl.getValue();
    ctl.collapse();
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900);
    heroStepDone = true;
    if (val && lastBrief) { lastBrief.heroLayout = val; composeRail(); } // immediate: brief rail
    makeCardsEditable(group, [ctl], persistIntakeEdit);
    try { await window.desktop.applyIntakeAnswers([{ id: card.id, field: card.field, type: card.type }], { [card.id]: val }); } catch {}
    setTimeout(showBriefComplete, 520); // let "✓ Got it" flash, then continue the flow
  }
  continueBtn.addEventListener("click", submit);

  intakeStack.appendChild(group);
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) { try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); } catch { scroller.scrollTop = centerTo; } }
}

// ---- Header / navigation step (renderer-injected, just before the hero step) --
// Only for website projects (app/brand projects render no global header). Same shape
// as the hero step: one client card (grouped menu wireframes), folded into the Brief,
// then advances the flow. Skippable ("I'll let you choose") = null = the agent decides.
let menuStepDone = false;

function menuStepApplicable() {
  // The site header/nav only renders for website projects (see DesignSurface chrome gate).
  return !!(lastBrief && lastBrief.projectType !== "app");
}

function renderMenuStep() {
  if (intakeStack.querySelector(".menu-step")) return; // already showing
  currentIntakeId = null;
  const card = {
    id: "menuLayout", field: "menuLayout", type: "menu-layout",
    label: COPY.intake.q.menuLayout, help: COPY.intake.q.menuLayoutHelp,
    skippable: true, agentDecidesLabel: COPY.intake.letYouChoose,
  };
  const group = document.createElement("div");
  group.className = "intake-group menu-step";
  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;

  const refreshReady = () => { continueBtn.disabled = !ctl.isReady(); };
  const requestSubmit = () => { if (!group.classList.contains("answered") && ctl.isReady()) submit(); };
  const ctl = renderIntakeCard(card, refreshReady, requestSubmit);
  group.append(ctl.el, continueBtn);
  refreshReady();

  async function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const val = ctl.getValue();
    ctl.collapse();
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900);
    menuStepDone = true;
    if (val && lastBrief) { lastBrief.menuLayout = val; composeRail(); } // immediate: brief rail
    makeCardsEditable(group, [ctl], persistIntakeEdit);
    try { await window.desktop.applyIntakeAnswers([{ id: card.id, field: card.field, type: card.type }], { [card.id]: val }); } catch {}
    setTimeout(showBriefComplete, 520); // let "✓ Got it" flash, then continue the flow
  }
  continueBtn.addEventListener("click", submit);

  intakeStack.appendChild(group);
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) { try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); } catch { scroller.scrollTop = centerTo; } }
}

// ---- Contact / CTA type step (renderer-injected, after the hero step) --------
// Shown only when Contact or CTA is among the chosen sections. Same shape as the hero
// step: one client card (Form vs Contact Button), folded into the Brief, then advances
// the flow. Skippable ("I'll let you choose") = null = the agent decides.
let ctaStepDone = false;

function ctaStepApplicable() {
  const s = lastBrief && Array.isArray(lastBrief.sections) ? lastBrief.sections : null;
  return !!(s && s.some((x) => /contact|cta|call[\s-]?to[\s-]?action/i.test(String(x))));
}

function renderCtaStep() {
  if (intakeStack.querySelector(".cta-step")) return; // already showing
  currentIntakeId = null;
  const card = {
    id: "ctaType", field: "ctaType", type: "cta-type",
    label: COPY.intake.q.ctaType, help: COPY.intake.q.ctaTypeHelp,
    skippable: true, agentDecidesLabel: COPY.intake.letYouChoose,
  };
  const group = document.createElement("div");
  group.className = "intake-group cta-step";
  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;

  const refreshReady = () => { continueBtn.disabled = !ctl.isReady(); };
  const requestSubmit = () => { if (!group.classList.contains("answered") && ctl.isReady()) submit(); };
  const ctl = renderIntakeCard(card, refreshReady, requestSubmit);
  group.append(ctl.el, continueBtn);
  refreshReady();

  async function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const val = ctl.getValue();
    ctl.collapse();
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900);
    ctaStepDone = true;
    if (val && lastBrief) { lastBrief.ctaType = val; composeRail(); } // immediate: brief rail
    makeCardsEditable(group, [ctl], persistIntakeEdit);
    try { await window.desktop.applyIntakeAnswers([{ id: card.id, field: card.field, type: card.type }], { [card.id]: val }); } catch {}
    setTimeout(showBriefComplete, 520); // let "✓ Got it" flash, then continue the flow
  }
  continueBtn.addEventListener("click", submit);

  intakeStack.appendChild(group);
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) { try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); } catch { scroller.scrollTop = centerTo; } }
}

// ---- Client-rendered intake (no model turn) ---------------------------------
// The fixed brief questions (what / names / reference) are posed by the RENDERER and
// folded straight into the Brief via applyIntakeAnswers — zero tokens, same rails as
// the agent path. The questions whose OPTIONS need judgment (sections tailored to the
// type, plus taste-matched color + font) stay model-driven in one turn afterward
// (beginModelIntakeTurn). This mirrors the voice step, which already proved a
// client-owned intake card.
const CLIENT_STEP_DELAY = 620; // a short "taking it in" beat between client questions

// Render ONE batch of client cards (usually one card; the name pair is two) with a
// Continue button, persist the answers to the Brief, then call onDone().
function renderClientBatch(cards, onDone) {
  enterIntakeMode();
  clearIntakePending();
  exitReview();
  intakePhase = "gathering";
  currentIntakeId = null; // client questions aren't a cancellable agent tool batch
  updateBackButton();

  const group = document.createElement("div");
  group.className = "intake-group";

  const controls = (cards || []).map((card) => {
    const r = renderIntakeCard(card, refreshReady, requestSubmit);
    group.appendChild(r.el);
    return { card, ...r };
  });

  const continueBtn = document.createElement("button");
  continueBtn.className = "intake-continue";
  continueBtn.textContent = COPY.intake.continue;
  function refreshReady() { continueBtn.disabled = !controls.every((c) => c.isReady()); }
  refreshReady();
  function requestSubmit() {
    if (group.classList.contains("answered")) return;
    if (controls.every((c) => c.isReady())) submit();
  }

  async function submit() {
    if (group.classList.contains("answered")) return;
    group.classList.add("answered");
    const answers = {};
    const meta = [];
    for (const c of controls) {
      answers[c.card.id] = c.getValue();
      meta.push({ id: c.card.id, field: c.card.field, type: c.card.type });
      c.collapse();
    }
    const done = doneNote();
    continueBtn.replaceWith(done);
    autoDismissTool(done, 900);
    if (!refsRevealed) { refsRevealed = true; composeRail(); } // first answer reveals the rail
    showIntakePending(TAKING_IN_MESSAGES[takingInIdx % TAKING_IN_MESSAGES.length]);
    takingInIdx++;
    makeCardsEditable(group, controls, persistIntakeEdit);
    try { await window.desktop.applyIntakeAnswers(meta, answers); } catch {}
    onDone();
  }
  continueBtn.addEventListener("click", submit);
  group.appendChild(continueBtn);

  intakeStack.appendChild(group);
  const scroller = intakeph.classList.contains("flow") ? intakeph.querySelector(".intake-inner") : intakeph;
  const centerTo = scroller ? intakeCenterTarget(scroller, group) : 0;
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
  if (scroller) {
    try { scroller.scrollTo({ top: centerTo, behavior: "smooth" }); }
    catch { scroller.scrollTop = centerTo; }
  }
}

// A monotonic token so a Back + re-pick invalidates any in-flight question chain
// (a stale step timer from the abandoned run bails instead of injecting its card).
let clientIntakeGen = 0;

// Build the fixed question script for this deliverable and walk it, one batch at a
// time, then hand off to the model turn (sections + color + font, tailored to type).
async function startClientIntake(type) {
  const gen = ++clientIntakeGen;
  const kind = type === "app" ? "app" : "web site";
  // If a Figma frame was imported, its gleaned brand name + project name pre-fill the fields
  // (the logo is already wired via VITE_BRAND_LOGO by /figma-ingest). Null for a normal flow.
  let seed = null;
  try { seed = await window.desktop.readFigmaMeta(); } catch {}
  if (gen !== clientIntakeGen || intakePhase !== "gathering") return; // superseded / backed out during the await
  const script = [
    [{ id: "what", field: "what", type: "open-text", long: true, maxLength: 400, label: COPY.intake.q.what, placeholder: COPY.intake.q.whatPlaceholder }],
    [
      { id: "clientName", field: "clientName", type: "open-text", label: COPY.intake.q.clientName, skippable: true, agentDecidesLabel: COPY.intake.skip, value: (seed && seed.brandName) || undefined },
      { id: "projectName", field: "projectName", type: "open-text", label: COPY.intake.q.projectName, skippable: true, agentDecidesLabel: COPY.intake.skip, value: (seed && seed.nameSuggestion) || undefined },
      { id: "logo", field: "logo", type: "logo", label: COPY.intake.q.logo, placeholder: COPY.intake.q.logoPlaceholder, skippable: true, agentDecidesLabel: COPY.intake.skip },
    ],
    [{ id: "reference", field: "references", type: "reference", maxLength: 200, label: COPY.intake.q.reference(kind), skippable: true, agentDecidesLabel: COPY.intake.skipReference }],
  ];
  runClientScript(script, 0, type, gen);
}

function runClientScript(script, i, type, gen) {
  if (intakePhase !== "gathering" || gen !== clientIntakeGen) return; // backed out / superseded
  if (i >= script.length) { beginModelIntakeTurn(type); return; }
  renderClientBatch(script[i], () => {
    setTimeout(() => runClientScript(script, i + 1, type, gen), CLIENT_STEP_DELAY);
  });
}

// After the fixed questions, spend ONE short model turn on the questions whose options
// need judgment: the sections/screens list (tailored to type + vibe) and, unless the
// designer already named them, a color and a font. Ends → showBriefComplete.
function beginModelIntakeTurn(type) {
  const b = lastBrief || {};
  const hasColor = Array.isArray(b.colorSources) && b.colorSources.length > 0;
  const hasFont = Array.isArray(b.fontSources) && b.fontSources.length > 0;
  runAgent(getModelIntakePrompt(type, b, hasColor, hasFont)); // silent; ends → showBriefComplete
}

function showBriefComplete() {
  if (intakePhase !== "gathering") return; // only from the gathering state
  // Header / navigation layout comes first (website projects only), just before the hero.
  if (!menuStepDone && menuStepApplicable()) { renderMenuStep(); return; }
  // Hero layout comes right after sections, but only if Hero is one of them.
  if (!heroStepDone && heroStepApplicable()) { renderHeroStep(); return; }
  // Contact/CTA type comes after the hero, but only if Contact or CTA is a section.
  if (!ctaStepDone && ctaStepApplicable()) { renderCtaStep(); return; }
  if (!voiceStepDone) { renderVoiceStep(); return; } // the Tone/rules step is the last question
  intakePhase = "review";
  currentIntakeId = null;
  updateBackButton();
  clearIntakePending();
  const head = intakeph.querySelector(".intake-head");
  const leaving = [head, ...Array.from(intakeStack.children)].filter(Boolean);
  const anims = leaving
    .map((elm) => anim(elm, [
      { opacity: 1, transform: "translateY(0px)" },
      { opacity: 0, transform: "translateY(-22px)" },
    ], { duration: 460 }))
    .filter(Boolean);
  const after = () => {
    if (intakePhase !== "review") return; // a new question arrived mid-animation
    intakeStack.innerHTML = "";
    if (head) head.classList.add("intake-hidden");
    intakeph.classList.add("reviewing"); // center the actions level with the brief rail
    renderReviewActions();
  };
  if (anims.length) Promise.allSettled(anims.map((a) => a.finished)).then(after);
  else after();
}

// Restore the head (a new question arrived after review sent us back to gathering).
function exitReview() {
  intakeph.classList.remove("reviewing");
  const head = intakeph.querySelector(".intake-head");
  if (head) head.classList.remove("intake-hidden");
}

// ---- P2: the Design direction knob panel ------------------------------------
// Shows the sampled Direction (lens + the 4 semantic-axis sliders) with a reroll, so the
// designer can steer or re-draw before building. All deck access is behind the seam
// (directionMeta + sampleDirection IPCs); the renderer never imports the deck. The current
// Direction is stored on the brief (main side) so "start designing" uses exactly this.
// A thin "i in a circle" info glyph (matches the app's line-icon style), used on each
// lever label to hang a hover tooltip off of.
const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/></svg>';

let _directionMeta = null;
async function getDirectionMeta() {
  if (_directionMeta) return _directionMeta;
  try { _directionMeta = await window.desktop.directionMeta(); }
  catch { _directionMeta = { axes: {}, lenses: [] }; }
  return _directionMeta;
}

// opts: { sample(axes)→{direction}, onChange(direction), initialDirection }. Defaults to the
// intake sampler (stores on the brief). The reroll passes a pure sampler bound to the source
// design's signals + an onChange to capture the chosen Direction.
async function renderDirectionPanel(host, opts = {}) {
  const sample = opts.sample || ((o) => window.desktop.sampleDirection(o));
  const onChange = opts.onChange || (() => {});
  const meta = await getDirectionMeta();
  const axisNames = Object.keys(meta.axes || {});
  if (!axisNames.length) return; // sampler unavailable / unlicensed → no panel

  const panel = document.createElement("div");
  panel.className = "idir";

  const head = document.createElement("div");
  head.className = "idir-head";
  head.textContent = COPY.intake.direction.title;

  // Thin-line "?" in the corner → opens the "how the direction picker works" overlay.
  const info = document.createElement("button");
  info.type = "button";
  info.className = "idir-info";
  info.title = COPY.intake.direction.helpTitle;
  info.setAttribute("aria-label", COPY.intake.direction.helpTitle);
  info.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
  info.addEventListener("click", (e) => { e.stopPropagation(); openDirectionHelp(); });
  panel.appendChild(info);

  // The lens name is a SELECTOR: click to pick a named style / movement directly.
  const lensSel = document.createElement("button");
  lensSel.type = "button";
  lensSel.className = "idir-lens idir-lens-sel";
  const lensDesc = document.createElement("div");
  lensDesc.className = "idir-desc";
  const menu = document.createElement("div");
  menu.className = "idir-menu";
  menu.hidden = true;
  panel.append(head, lensSel, lensDesc, menu);

  const pinned = {};      // axes the designer has steered
  let pinnedLens = null;  // a directly-picked lens (from the selector)
  let current = opts.initialDirection || null;

  // Selector menu, grouped: general Directions, then art Movements.
  const groups = [
    { label: COPY.intake.direction.groupDirections, items: (meta.lenses || []).filter((l) => !l.movement) },
    { label: COPY.intake.direction.groupMovements, items: (meta.lenses || []).filter((l) => l.movement) },
  ];
  for (const g of groups) {
    if (!g.items.length) continue;
    const gl = document.createElement("div");
    gl.className = "idir-menu-group";
    gl.textContent = g.label;
    menu.appendChild(gl);
    for (const l of g.items) {
      const it = document.createElement("button");
      it.type = "button";
      it.className = "idir-menu-item";
      it.textContent = l.label;
      it.addEventListener("click", () => {
        menu.hidden = true;
        pinnedLens = l.id;
        for (const k in pinned) delete pinned[k]; // a direct pick clears axis steering
        resample();
      });
      menu.appendChild(it);
    }
  }
  lensSel.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener("click", () => { menu.hidden = true; });

  const rows = {};
  const grid = document.createElement("div");
  grid.className = "idir-axes";
  for (const name of axisNames) {
    const row = document.createElement("div");
    row.className = "idir-axis";
    const label = document.createElement("div");
    label.className = "idir-axis-label";
    const labelText = document.createElement("span");
    labelText.textContent = (COPY.intake.direction.axisLabels || {})[name] || name;
    label.appendChild(labelText);
    // An "i" with a hover tooltip explaining the lever — so the meaning is available
    // inline, without opening the "?" help overlay (which stays as-is).
    const help = (COPY.intake.direction.axisHelp || {})[name];
    if (help) {
      const info = document.createElement("span");
      info.className = "idir-lev"; // NOT .idir-info — that's the panel's "?" help trigger
      info.tabIndex = 0;
      info.setAttribute("aria-label", help);
      const ic = document.createElement("span");
      ic.className = "idir-lev-ic";
      ic.innerHTML = INFO_SVG;
      const tip = document.createElement("span");
      tip.className = "idir-lev-tip";
      tip.setAttribute("role", "tooltip");
      tip.textContent = help;
      info.append(ic, tip);
      label.appendChild(info);
    }
    const stopsWrap = document.createElement("div");
    stopsWrap.className = "idir-stops";
    const btns = [];
    meta.axes[name].forEach((stop) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "idir-stop";
      b.textContent = stop;
      b.addEventListener("click", () => {
        pinnedLens = null; // steering by axes releases a direct pick
        if (!Object.keys(pinned).length && current) for (const n of axisNames) pinned[n] = current.axes[n];
        pinned[name] = stop;
        resample();
      });
      btns.push(b);
      stopsWrap.appendChild(b);
    });
    rows[name] = btns;
    row.append(label, stopsWrap);
    grid.appendChild(row);
  }
  panel.appendChild(grid);

  const reroll = document.createElement("button");
  reroll.type = "button";
  reroll.className = "idir-reroll";
  reroll.textContent = COPY.intake.direction.reroll;
  reroll.addEventListener("click", () => resample()); // keeps a pinned lens or axes, fresh seed
  panel.appendChild(reroll);

  function paint() {
    if (!current) return;
    const lens = (meta.lenses || []).find((l) => l.id === current.lens);
    lensSel.textContent = (lens ? lens.label : current.lens) + "  ▾";
    lensDesc.textContent = lens ? lens.description : "";
    for (const name of axisNames) {
      const active = name in pinned ? pinned[name] : current.axes[name];
      rows[name].forEach((b) => b.classList.toggle("active", b.textContent === active));
    }
  }

  async function resample() {
    reroll.disabled = true;
    panel.classList.add("busy");
    const o = {};
    if (pinnedLens) o.lens = pinnedLens;
    else if (Object.keys(pinned).length) o.axes = pinned;
    try {
      const r = await sample(o);
      if (r && r.direction) current = r.direction;
    } catch {}
    reroll.disabled = false;
    panel.classList.remove("busy");
    onChange(current);
    paint();
  }

  host.appendChild(panel);
  if (current) { onChange(current); paint(); } // show the provided direction; reroll/steer/pick redraws
  else { await resample(); }                    // no initial → auto-draw (the intake case)
}

function renderReviewActions() {
  const wrap = document.createElement("div");
  wrap.className = "intake-review";

  // The design-direction knob panel fills in asynchronously at the top of the review.
  const dirHost = document.createElement("div");
  dirHost.className = "idir-host";
  renderDirectionPanel(dirHost);

  const q = document.createElement("div");
  q.className = "intake-review-q";
  q.textContent = COPY.intake.reviewQuestion;

  const primary = document.createElement("button");
  primary.className = "intake-continue";
  primary.textContent = COPY.intake.startDesigning;
  primary.addEventListener("click", startDesigning);

  const secondary = document.createElement("button");
  secondary.className = "ireview-secondary";
  secondary.textContent = COPY.intake.addMoreContext;

  // Hidden "more context" input, revealed by the secondary button.
  const more = document.createElement("div");
  more.className = "ireview-more";
  more.hidden = true;
  const ta = document.createElement("textarea");
  ta.className = "icard-textarea";
  ta.placeholder = COPY.intake.moreContextPlaceholder;
  const send = document.createElement("button");
  send.className = "intake-continue";
  send.textContent = COPY.intake.addAndContinue;
  send.addEventListener("click", async () => {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    intakePhase = "gathering"; // the turn's result brings us back to review
    anim(wrap, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-12px)" }], { duration: 320 });
    if (wrap.remove) setTimeout(() => wrap.remove(), 320);
    showIntakePending(COPY.intake.foldingIntoBrief);
    // Update the brief rail in the pane (not just the chat), then let the agent see it too.
    try { await window.desktop.addBriefNote(text); } catch {}
    runAgent("A bit more context for the brief before we design: " + text);
  });
  more.append(ta, send);

  secondary.addEventListener("click", () => {
    secondary.hidden = true;
    more.hidden = false;
    fadeSlideIn(more, { dy: 10, duration: 420 });
    ta.focus();
  });

  wrap.append(dirHost, q, primary, secondary, more);
  intakeStack.appendChild(wrap);
  fadeSlideIn(wrap, { dy: 20, duration: 620, delay: 80 });
}

// ---- Post-build reroll: fork a built design with a new direction ------------
// A gated licensed action: open the knob panel on an existing design, steer/reroll to a
// new Direction, then FORK a new variation and rebuild only its Home.tsx. Costs a build
// per reroll (confirmed first). The source is never touched (separate variation folder).
function currentPreviewVariation(url) {
  try { return new URL(url || activeTab.wv.getURL()).searchParams.get("v"); }
  catch { return null; }
}

function buildRerollPrompt(targetId, sourceId, brief, block) {
  return [
    `/design Rebuild the Home page for design variation ${targetId}, a fork of ${sourceId} that already carries the same brand and brief.`,
    `Keep its existing brand (the --ta-* colors and fonts already in \`src/variations/${targetId}/styles/\`) and the same brief; re-compose the page to the NEW design direction below.`,
    `Edit ONLY \`src/variations/${targetId}/components/Home.tsx\` — do not touch ${sourceId} or any other variation.`,
    brief ? `Brief: ${brief}` : "",
    "",
    block,
  ].filter(Boolean).join("\n");
}

let rerollOverlayEl = null;
function closeReroll() { if (rerollOverlayEl) { rerollOverlayEl.remove(); rerollOverlayEl = null; } }

async function startReroll(sourceId) {
  if (!sourceId) return;
  let meta = null;
  try { const r = await window.desktop.readVariation(sourceId); meta = r && r.meta; } catch {}
  if (!meta) { addMsg("error", COPY.reroll.readError); return; }
  const signals = { what: meta.brief || "" }; // the source brief carries the fit signals
  let chosen = meta.direction || null;

  closeReroll();
  const overlay = document.createElement("div");
  overlay.className = "reroll-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeReroll(); });
  rerollOverlayEl = overlay;

  const card = document.createElement("div");
  card.className = "reroll-card";
  const title = document.createElement("div");
  title.className = "reroll-title";
  title.textContent = COPY.reroll.title;
  const sub = document.createElement("div");
  sub.className = "reroll-sub";
  sub.textContent = COPY.reroll.subtitle;
  card.append(title, sub);

  const panelHost = document.createElement("div");
  card.appendChild(panelHost);
  renderDirectionPanel(panelHost, {
    sample: (o) => window.desktop.sampleDirectionFor(signals, o),
    onChange: (d) => { chosen = d; },
    initialDirection: meta.direction || null,
  });

  const actions = document.createElement("div");
  actions.className = "reroll-actions";
  const cancel = document.createElement("button");
  cancel.className = "reroll-cancel";
  cancel.textContent = COPY.reroll.cancel;
  cancel.addEventListener("click", closeReroll);
  const create = document.createElement("button");
  create.className = "reroll-create";
  create.textContent = COPY.reroll.create;
  create.addEventListener("click", () => {
    if (!chosen) { closeReroll(); return; }
    showConfirm({
      title: COPY.reroll.confirmTitle,
      message: COPY.reroll.confirmMessage,
      okLabel: COPY.reroll.confirmOk,
      onOk: () => doReroll(sourceId, chosen),
    });
  });
  actions.append(cancel, create);
  card.appendChild(actions);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

async function doReroll(sourceId, direction) {
  closeReroll();
  let r = null;
  try { r = await window.desktop.createRerollFork(sourceId, direction); } catch {}
  if (!r || r.error || !r.targetId) { addMsg("error", COPY.reroll.createError); return; }
  addMsg("system", COPY.reroll.building(r.targetId));
  runAgent(buildRerollPrompt(r.targetId, sourceId, r.brief, r.block));
}

// The preview-toolbar reroll button shows only when licensed AND viewing a specific design.
async function updateRerollBtn(url) {
  updateArtDirectorRailBtn(url); // same readiness signal drives the rail Art Director icon
  updateA11yRailBtn(); // refresh the Accessibility rail dot for the previewed design
  const btn = el("reroll-btn");
  if (!btn) return;
  const meta = await getDirectionMeta();
  const licensed = !!(meta.axes && Object.keys(meta.axes).length);
  const v = currentPreviewVariation(url);
  // Only once the design is BUILT and idle — never during the intake, the initial build
  // (homeBuilding, when the Style guide tab is live), or any agent turn — so a designer
  // can't fork the design out from under an in-progress build.
  const ready = !homeBuilding && !agentBusy && !intakeActive;
  // Reroll forks + rebuilds via the agent → needs a key. Hidden in read-only mode.
  btn.hidden = !(appHasKey && licensed && ready && v && v !== "v00");
}
{
  const b = el("reroll-btn");
  if (b) b.addEventListener("click", () => startReroll(currentPreviewVariation()));
}

// ---- Art Director (confer) --------------------------------------------------
// A READ-ONLY design review the designer confers with from the variation card. v1 is
// deterministic (zero model tokens): main lints the design's files + palette against the
// /design rules and returns findings; we render them as an advisory chat report. Nothing
// is edited — acting on a finding is always the designer's own next move.
// The variation the last confer reviewed — so a suggestion's [Apply] can scope its edit
// to the right variation (only one review runs at a time).
let lastReviewedVariation = null;
async function reviewDesign(id, page) {
  if (!id || !appHasKey) return; // the critique is an agent turn → needs a key
  lastReviewedVariation = page ? `${id}:${page.id}` : id; // the recs store key
  addMsg("system", page ? COPY.artDirector.reviewingPage(page.title) : COPY.artDirector.reviewing(id));
  let res;
  try { res = await window.desktop.reviewDesign(id, page ? page.id : null); }
  catch (e) { addMsg("error", COPY.artDirector.failed(String((e && e.message) || e))); return; }
  if (!res || res.error) { addMsg("error", COPY.artDirector.failed(res && res.error ? res.error : "unknown")); return; }
  // The deterministic lint (res.findings) is INVISIBLE plumbing — it grounds the critique
  // but is never dumped raw at the designer (file:line rule names mean nothing to them).
  // The Art Director's read streams next: a readable critique (its own persona, isolated
  // fresh session), then structured suggestion cards via the `suggest` tool (Phase 3). The
  // important lint findings surface there, in plain language and as Apply-able cards.
  runAgent(buildArtDirectorCritiquePrompt(id, res), null, { reviewMode: true });
}

// The critique prompt: point the Art Director at the design's files, hand it the lint
// findings as established fact, and ask for the judgment a lint can't make. Read-only.
function buildArtDirectorCritiquePrompt(id, res) {
  const findings = (res.findings || [])
    .map((f) => `- [${f.severity}/${f.rule}] ${f.line ? `${f.file}:${f.line}` : f.file} · ${f.message}`)
    .join("\n") || "(nothing flagged)";
  // Surface the sampled DESIGN DIRECTION directly (don't rely on the model to read + internalize
  // variation.json), so the critique judges against the exact intended aesthetic.
  const dir = res.direction && typeof res.direction === "object" ? res.direction : null;
  const label = dir && (dir.lensLabel || dir.lens);
  const kv = (o) => (o && typeof o === "object" ? Object.entries(o).map(([k, v]) => `${k}=${v}`).join(", ") : "");
  const dirLines = [];
  if (dir) {
    if (label) dirLines.push(`- Lens / style: ${label}`);
    if (kv(dir.axes)) dirLines.push(`- Axes: ${kv(dir.axes)}`);
    if (kv(dir.motifs)) dirLines.push(`- Named motifs: ${kv(dir.motifs)}`);
  }
  const directionBlock = dirLines.length
    ? `This design was built to a specific DESIGN DIRECTION. Critique it AGAINST this (it's the intended aesthetic and the bar, not a suggestion):\n${dirLines.join("\n")}\n`
    : "";
  const directionJudgment = dirLines.length
    ? `and, most importantly, how well it DELIVERS ON THE DESIGN DIRECTION above: does the page read unmistakably as ${label || "its intended direction"}? do the named motifs and the axes (energy, structure, era, etc.) actually land, or has it drifted back toward a generic centroid? Call out any drift from the direction specifically.`
    : `and whether it reads as its intended design direction.`;
  // Page scope (a promoted site): the page's content file + the block files it uses.
  const page = res.pageId ? res.page || { title: res.pageId } : null;
  const reads = page
    ? `Read only what you need: the page's content in \`content/pages/${res.pageId}.json\` (its blocks, in order, and every word on the page), the block files it uses (${(res.filesReviewed || []).map((f) => `\`${f}\``).join(", ")}), the site's navigation in \`content/site.json\`, the palette in \`src/variations/${id}/styles/tokens.css\`, and the brief + design direction in \`src/variations/${id}/variation.json\`.`
    : `Read only what you need: \`src/variations/${id}/components/Home.tsx\` (and any other component in that folder), its palette in \`src/variations/${id}/styles/tokens.css\`, and its brief + design direction in \`src/variations/${id}/variation.json\`.`;
  const subject = page ? `the "${page.title}" page of the site built from design variation ${id} (blocks: ${(page.blocks || []).join(", ") || "none"})` : `design variation ${id}`;
  const applyWhere = page
    ? `give a precise \`apply\` instruction the builder can run verbatim: a DESIGN change edits the block file under \`site/blocks/\` (it changes every page using that block, say so when that matters), a COPY or IMAGE change edits \`content/pages/${res.pageId}.json\`, a PALETTE or TOKEN change edits \`src/variations/${id}/styles/tokens.css\` (the site imports the pinned design's tokens, so it recolors the whole site: say so)`
    : `give a precise \`apply\` instruction it can run verbatim on \`src/variations/${id}/\``;
  return [
    `Give your Art Director read of ${subject}. It is already built; you are reviewing, not building.`,
    reads,
    ``,
    directionBlock,
    `An automated rule + palette pass already ran. Treat these as established fact to build on, not something to re-derive or merely repeat:`,
    findings,
    ``,
    `Now give the judgment the lint can't: visual hierarchy, spacing rhythm and balance, type pairing and scale, palette harmony and how the palette carries the mood, imagery, ${directionJudgment} Lead with what's working, then the few highest-leverage changes, specific and grounded in the actual page. Keep it tight. Do NOT edit anything; this is advisory.`,
    ``,
    `Then, ONCE, call the \`suggest\` tool (mcp__artdirector__suggest) with your actionable items as structured cards, most impactful first. For each: a short imperative title, a one-line why, targets (file:line), and a kind: "code" (the builder can edit it: ${applyWhere}), "asset" (needs a new/replacement file you can't source, e.g. a photo, no apply), or "decision" (a client/human call, no apply). Whenever a suggestion points at a specific visible section or element, also give an \`anchor\` so the designer can SEE it highlighted on the page instead of hunting: prefer \`anchor.block\` (a data-block value on the section) or \`anchor.text\` (a short exact heading/button label from that element). Fold in the code-actionable lint findings above too.`,
  ].join("\n");
}

// (The raw lint findings are no longer rendered to the designer — they ground the critique
//  and surface as plain-language suggestion cards below. See reviewDesign.)

// ---- Art Director drawer: recommendations + Archive (Phase 3) ---------------
// The review turn's `suggest` tool forwards structured suggestions here. Rather than chat
// cards, each becomes a persisted RECOMMENDATION for its design, managed in the Director
// drawer (rail-opened): active recs show as titles → a modal (full description + Apply /
// Dismiss); dismissed ones drop into the drawer's Archive. State persists per variation
// (main store) so the Archive survives restarts. The prose critique still streams in chat.
const AD_KIND = { code: { label: "Actionable" }, asset: { label: "Needs an asset" }, decision: { label: "Your call" } };

let directorState = { id: null, active: [], dismissed: [], completed: [] };

function isModalOpen(kind) {
  return !modal.hidden && modal.classList.contains("open") && RAILS[kind] && RAILS[kind].classList.contains("active");
}
function refreshDirector() {
  if (!isModalOpen("director")) return;
  modalBody.innerHTML = "";
  renderDirector(modalBody);
}

// A fresh review's suggestions → the active recs for the reviewed design. Keep the existing
// Archive (dismissed) so re-reviewing never wipes it. Persist + (if open) refresh the drawer.
window.desktop.onAgentSuggestions(async ({ suggestions }) => {
  const id = lastReviewedVariation;
  if (!id || !Array.isArray(suggestions)) return;
  let prev = { active: [], dismissed: [], completed: [] };
  try { prev = await window.desktop.loadRecs(id); } catch {}
  const dismissed = (prev && prev.dismissed) || [];
  const completed = (prev && prev.completed) || [];
  // Don't resurface a rec the designer already dismissed OR completed.
  const seen = new Set([...dismissed, ...completed].map((r) => r.id));
  const active = suggestions.filter((s) => s && s.id && !seen.has(s.id));
  try { await window.desktop.saveRecs(id, active, dismissed, completed); } catch {}
  updateDirectorIndicator();
  refreshDirector();
});

// The rail clapperboard's dot reflects the CURRENT design's active queue: red if any item is
// actionable (code), white if only "needs an asset" / "your call" remain, none if empty. It
// persists (not cleared on open) — it's a queue-state cue, not an unread badge.
async function updateDirectorIndicator(id) {
  if (!railDirector) return;
  const v = id || currentPreviewVariation();
  railDirector.classList.remove("has-code", "has-passive");
  if (!v || v === "v00") return;
  // On a promoted site recs are stored per page: any page's active recs light the rail.
  let active = [];
  try {
    const siteData = await window.desktop.getSiteContent().catch(() => ({ ready: false, pages: [] }));
    const keys = siteData.ready && siteData.pages.length ? siteData.pages.map((p) => `${v}:${p.id}`) : [v];
    for (const k of keys) { const store = await window.desktop.loadRecs(k); active = active.concat((store && store.active) || []); }
  } catch {}
  if (active.some((r) => r && r.kind === "code")) railDirector.classList.add("has-code");
  else if (active.length) railDirector.classList.add("has-passive");
}

// On a promoted site the Art Director reviews one PAGE at a time (its blocks + chrome):
// the design lives in site/blocks + content/pages, and a page with new blocks is the
// natural unit of review. Recommendations are stored per "<variation>:<page>".
let directorPage = null; // { id, title, route } of the page being reviewed, or null (design scope)
async function renderDirector(body) {
  const id = currentPreviewVariation();
  if (!id || id === "v00") { const n = document.createElement("div"); n.className = "muted"; n.textContent = COPY.director.needDesign; body.appendChild(n); return; }

  const siteData = await window.desktop.getSiteContent().catch(() => ({ ready: false, pages: [] }));
  const pages = siteData.ready ? siteData.pages : [];
  if (pages.length) {
    if (!directorPage || !pages.some((p) => p.id === directorPage.id)) {
      // Default to the page the design surface is showing, else Home.
      const shown = pages.find((p) => p.id !== "home" && activeTab && activeTab.url && new URLSearchParams((activeTab.url.split("?")[1] || "")).has(p.slug || p.id));
      const p = shown || pages.find((x) => x.id === "home") || pages[0];
      directorPage = { id: p.id, title: p.title, route: p.id === "home" ? "" : (p.slug || p.id) };
    }
  } else directorPage = null;
  const key = directorPage ? `${id}:${directorPage.id}` : id;

  let store = { active: [], dismissed: [], completed: [] };
  try { store = await window.desktop.loadRecs(key); } catch {}
  directorState = { id: key, vid: id, page: directorPage, active: (store && store.active) || [], dismissed: (store && store.dismissed) || [], completed: (store && store.completed) || [] };

  if (directorPage) {
    const row = document.createElement("div"); row.className = "setrow";
    const k = document.createElement("div"); k.className = "k"; k.textContent = COPY.director.scopeLabel;
    const sel = document.createElement("select"); sel.className = "field";
    pages.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = COPY.director.scopePage(p.title); sel.appendChild(o); });
    sel.value = directorPage.id;
    sel.addEventListener("change", () => { const p = pages.find((x) => x.id === sel.value); if (p) { directorPage = { id: p.id, title: p.title, route: p.id === "home" ? "" : (p.slug || p.id) }; refreshDirector(); } });
    row.append(k, sel); body.appendChild(row);
  }

  const lead = document.createElement("div");
  lead.className = "muted"; lead.style.cssText = "font-size:12.5px;margin-bottom:12px;";
  lead.textContent = directorPage ? COPY.director.leadPage(directorPage.title) : COPY.director.lead(id);
  body.appendChild(lead);

  const reviewBtn = document.createElement("button");
  reviewBtn.className = "panelbtn primary";
  const reviewed = directorState.active.length || directorState.dismissed.length;
  reviewBtn.textContent = directorPage ? (reviewed ? COPY.director.reReviewPage : COPY.director.reviewPage) : (reviewed ? COPY.director.reReview : COPY.director.review);
  // The critique is an agent turn → needs a key. Past recs (Completed/Archive) stay viewable.
  reviewBtn.disabled = agentBusy || !appHasKey;
  if (!appHasKey) reviewBtn.title = COPY.director.needKey;
  reviewBtn.addEventListener("click", () => { reviewDesign(id, directorPage); closeModal(); });
  body.appendChild(reviewBtn);

  if (!directorState.active.length) {
    const empty = document.createElement("div");
    empty.className = "muted"; empty.style.cssText = "font-size:12.5px;margin-top:14px;";
    empty.textContent = (directorState.dismissed.length || directorState.completed.length) ? COPY.director.allHandled : COPY.director.none;
    body.appendChild(empty);
  } else {
    const list = document.createElement("div"); list.className = "adrec-list";
    for (const rec of directorState.active) list.appendChild(buildRecRow(rec));
    body.appendChild(list);
  }

  if (directorState.completed.length) body.appendChild(buildCompleted(directorState.completed));
  if (directorState.dismissed.length) body.appendChild(buildArchive(directorState.dismissed));
}

function buildRecRow(rec) {
  const row = document.createElement("button");
  row.className = "adrec";
  const title = document.createElement("span"); title.className = "adrec-title"; title.textContent = rec.title || rec.id;
  const kind = document.createElement("span"); kind.className = "adrec-kind adrec-kind-" + (rec.kind || "code");
  kind.textContent = (AD_KIND[rec.kind] || AD_KIND.code).label;
  row.append(title, kind);
  row.addEventListener("click", () => openRecModal(rec, "active"));
  return row;
}

function buildArchive(dismissed) {
  const wrap = document.createElement("details"); wrap.className = "adrec-archive";
  const sum = document.createElement("summary"); sum.textContent = COPY.director.archive(dismissed.length); wrap.appendChild(sum);
  const list = document.createElement("div"); list.className = "adrec-list";
  for (const rec of dismissed) {
    const row = document.createElement("div"); row.className = "adrec adrec-dismissed";
    const title = document.createElement("span"); title.className = "adrec-title"; title.textContent = rec.title || rec.id;
    const restore = document.createElement("button"); restore.className = "adrec-restore"; restore.textContent = COPY.director.restore;
    restore.addEventListener("click", (e) => { e.stopPropagation(); restoreRec(rec); });
    row.append(title, restore);
    row.addEventListener("click", () => openRecModal(rec, "archived"));
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

// Recommendations that have been applied (acted on). Collapsible, kept for reference —
// clicking a row reopens the modal read-only (Close only), no restore/apply.
function buildCompleted(completed) {
  const wrap = document.createElement("details"); wrap.className = "adrec-archive adrec-completed";
  const sum = document.createElement("summary"); sum.textContent = COPY.director.completed(completed.length); wrap.appendChild(sum);
  const list = document.createElement("div"); list.className = "adrec-list";
  for (const rec of completed) {
    const row = document.createElement("button"); row.className = "adrec adrec-done";
    const title = document.createElement("span"); title.className = "adrec-title"; title.textContent = rec.title || rec.id;
    const tag = document.createElement("span"); tag.className = "adrec-donetag"; tag.textContent = COPY.director.doneTag;
    row.append(title, tag);
    row.addEventListener("click", () => openRecModal(rec, "completed"));
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

// The recommendation modal: full description + actions by mode. "active" → Hold/Dismiss/Apply;
// "archived" → Hold/Apply (no dismiss); "completed" → Close only (read-only reference).
function closeRecModal() { const o = el("adrec-overlay"); if (o) o.remove(); }
function openRecModal(rec, mode) {
  mode = mode || "active";
  const archived = mode === "archived";
  closeRecModal();
  const overlay = document.createElement("div"); overlay.className = "adrec-overlay"; overlay.id = "adrec-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeRecModal(); });
  const card = document.createElement("div"); card.className = "adrec-modal";

  const title = document.createElement("div"); title.className = "adrec-modal-title"; title.textContent = rec.title || rec.id; card.appendChild(title);
  const kind = document.createElement("div"); kind.className = "adrec-modal-kind adrec-kind-" + (rec.kind || "code");
  kind.textContent = (AD_KIND[rec.kind] || AD_KIND.code).label; card.appendChild(kind);
  // Just the review — the why. The apply instruction + file targets are intentionally not
  // shown (they drive the builder on Apply, but the designer only needs the read).
  if (rec.why) { const w = document.createElement("div"); w.className = "adrec-modal-why"; w.textContent = rec.why; card.appendChild(w); }

  // A type/font 'decision' with candidates → an inline font-pick (reuse the brief's picker,
  // each shown in its own face + a custom-entry field). Apply below swaps the font role.
  let fontCtl = null, fontApplyBtn = null;
  const fontRole = rec.fontRole || "display";
  const isFontRec = mode !== "completed" && rec.kind === "decision" && Array.isArray(rec.fontOptions) && rec.fontOptions.length > 0;
  if (isFontRec) {
    const lab = document.createElement("div"); lab.className = "adrec-fontpick-label"; lab.textContent = COPY.director.fontPickLabel; card.appendChild(lab);
    const pickWrap = document.createElement("div"); pickWrap.className = "adrec-fontpick"; card.appendChild(pickWrap);
    fontCtl = buildFontPick({ type: "font-pick", options: rec.fontOptions }, pickWrap, () => {
      if (fontApplyBtn) fontApplyBtn.disabled = !fontCtl.hasValue() || !appHasKey;
    });
  }

  // A plain 'decision' / non-sourceable 'asset' has no one-click action. Show its note as its
  // OWN paragraph right under the description (same soft gray), rather than crammed into the
  // action row — that gives the Show-on-page button room to breathe.
  const isNoteOnly = mode !== "completed" && !(rec.kind === "code" && rec.apply) && !isFontRec && !(rec.kind === "asset" && rec.assetSourceable);
  if (isNoteOnly) {
    const note = document.createElement("div"); note.className = "adrec-modal-note";
    note.textContent = rec.kind === "asset" ? COPY.director.assetNote : COPY.director.decisionNote;
    card.appendChild(note);
  }

  // Assigned below: the inline "make the call" field the button reveals. Available for any
  // 'decision' (non-font) or 'asset' — including a sourceable asset, so the designer can
  // override the one-click auto-source with their own direction / file.
  let makeCallForm = null;
  const canMakeCall = mode !== "completed" && !isFontRec && !(rec.kind === "code" && rec.apply) && (rec.kind === "decision" || rec.kind === "asset");
  const buildMakeCallBtn = () => {
    const mk = document.createElement("button"); mk.className = "adrec-makecall-btn"; mk.textContent = COPY.director.makeCall;
    if (!appHasKey) { mk.disabled = true; mk.title = COPY.director.needKey; }
    else mk.addEventListener("click", () => {
      if (!makeCallForm) return;
      const opening = !makeCallForm.classList.contains("open");
      makeCallForm.classList.toggle("open", opening);
      mk.classList.toggle("active", opening);
      if (opening) { const ta = makeCallForm.querySelector("textarea"); setTimeout(() => ta && ta.focus(), 80); }
    });
    return mk;
  };
  const buildSourceBtn = () => {
    const source = document.createElement("button"); source.className = "adrec-source-btn"; source.textContent = COPY.director.sourceImagery;
    if (!appHasKey) { source.disabled = true; source.title = COPY.director.needKey; }
    else source.addEventListener("click", () => sourceAssetRec(rec));
    return source;
  };
  // A sourceable asset offers TWO actions (auto-source + make the call). Rather than cram both
  // into the action row, they get their own even-split row below it (see after `actions`).
  const dualAction = mode !== "completed" && rec.kind === "asset" && rec.assetSourceable;

  const actions = document.createElement("div"); actions.className = "adrec-modal-actions";
  if (mode === "completed") {
    // Read-only reference — the action was already taken. Close only.
    const close = document.createElement("button"); close.className = "adrec-hold-btn";
    close.textContent = COPY.director.close;
    close.addEventListener("click", () => closeRecModal());
    actions.appendChild(close);
  } else {
    // Hold — close the modal, change nothing (the suggestion stays where it is).
    const hold = document.createElement("button"); hold.className = "adrec-hold-btn";
    hold.textContent = COPY.director.hold; hold.title = COPY.director.holdTip;
    hold.addEventListener("click", () => closeRecModal());
    actions.appendChild(hold);
    if (!archived) {
      const dismiss = document.createElement("button"); dismiss.className = "adrec-dismiss-btn";
      dismiss.textContent = COPY.director.dismiss; dismiss.title = COPY.director.dismissTip;
      dismiss.addEventListener("click", () => { dismissRec(rec); closeRecModal(); });
      actions.appendChild(dismiss);
    }
    // Show on page + the primary action, grouped on the right — identical layout to the
    // AA modal (.a11y-right pushes them right; the green Show button sits before the action).
    const right = document.createElement("div"); right.className = "a11y-right";
    if (rec.anchor) {
      const show = document.createElement("button"); show.className = "a11y-show-btn";
      show.textContent = COPY.director.showOnPage; show.title = COPY.director.showOnPageTip;
      show.addEventListener("click", () => { closeRecModal(); showAdOnPage(rec); });
      right.appendChild(show);
    }
    if (rec.kind === "code" && rec.apply) {
      const apply = document.createElement("button"); apply.className = "adrec-apply-btn"; apply.textContent = COPY.director.applyThis;
      // Apply runs a builder turn → needs a key. Disabled (not hidden) in read-only mode.
      if (!appHasKey) { apply.disabled = true; apply.title = COPY.director.needKey; }
      else apply.addEventListener("click", () => { closeRecModal(); applyRec(rec); });
      right.appendChild(apply);
    } else if (isFontRec) {
      // Apply the picked font — enabled once a candidate is selected (and a key is present).
      const apply = document.createElement("button"); apply.className = "adrec-apply-btn"; apply.textContent = COPY.director.applyFont;
      apply.disabled = true;
      if (!appHasKey) apply.title = COPY.director.needKey;
      fontApplyBtn = apply;
      apply.addEventListener("click", () => {
        if (apply.disabled || !fontCtl) return;
        const font = fontCtl.getValue(); if (!font) return;
        applyFontRec(rec, font, fontRole);
      });
      right.appendChild(apply);
    } else if (dualAction) {
      // Source imagery + Make the call go on their own even-split row below — the top row
      // keeps only Show on page here.
    } else if (canMakeCall) {
      // Plain decision / non-sourceable asset → the ONLY right-side action is "Make the call".
      right.appendChild(buildMakeCallBtn());
    }
    actions.appendChild(right);
  }
  card.appendChild(actions);

  // Sourceable asset: the two actions on their own row, splitting the width evenly.
  if (dualAction) {
    const split = document.createElement("div"); split.className = "adrec-action-split";
    split.append(buildSourceBtn(), buildMakeCallBtn());
    card.appendChild(split);
  }

  // The "Make the call" field: soft-animated open below the action row. A comment to Claude +
  // an optional upload; Send closes the modal and hands off to a scoped builder turn that
  // executes on the designer's direction AND the Art Director's recommendation.
  if (canMakeCall) {
    makeCallForm = buildMakeCallField((comment, attached) => { closeRecModal(); makeCallRec(rec, comment, attached); });
    card.appendChild(makeCallForm);
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

async function persistDirector() {
  if (!directorState.id) return;
  try { await window.desktop.saveRecs(directorState.id, directorState.active, directorState.dismissed, directorState.completed); } catch {}
  updateDirectorIndicator(directorState.id);
  refreshDirector();
}
function dismissRec(rec) {
  directorState.active = directorState.active.filter((r) => r.id !== rec.id);
  if (!directorState.dismissed.some((r) => r.id === rec.id)) directorState.dismissed.push(rec);
  persistDirector();
}
function restoreRec(rec) {
  directorState.dismissed = directorState.dismissed.filter((r) => r.id !== rec.id);
  if (!directorState.active.some((r) => r.id === rec.id)) directorState.active.push(rec);
  persistDirector();
}
// Apply = a scoped BUILDER edit turn (never reviewMode). The rec moves from active into
// Completed (kept for later reference as an action that was addressed).
function applyRec(rec) {
  const id = directorState.id;
  if (!rec || !id || rec.kind !== "code" || !rec.apply || !appHasKey) return;
  directorState.active = directorState.active.filter((r) => r.id !== rec.id);
  if (!directorState.completed.some((r) => r.id === rec.id)) directorState.completed.push(rec);
  persistDirector();
  closeModal(); // surface the chat where the edit streams
  const page = directorState.page;
  const vid = directorState.vid || id;
  const prompt = page
    ? `[Apply an Art Director recommendation to the "${page.title}" page of the site.] Make ONLY this change, ` +
      `editing only the block file(s) under \`site/blocks/\`, the page's content in \`content/pages/${page.id}.json\`, or the palette in \`src/variations/${vid}/styles/tokens.css\` (the site imports the pinned design's tokens), as the instruction says. ` +
      `Nothing else under \`src/variations/${vid}/\`, and do not rebuild the page. Keep to the block contract (tokens/utilities, container queries, static HTML). ` +
      `Then run \`npx astro build --root site\` to check it builds.\n\n${rec.title}\n${rec.apply}`
    : `[Apply an Art Director recommendation to design variation ${vid}.] Make ONLY this change, ` +
      `editing only files under \`src/variations/${vid}/\`. Do not rebuild the page or touch anything else. ` +
      `Keep to the design rules (tokens/utilities, container queries).\n\n${rec.title}\n${rec.apply}`;
  queueAdFocus(rec);
  runAgent(prompt, COPY.director.applyingEcho(rec.title), {});
}

// A font 'decision': swap the designer's chosen font into the variation's type role.
function applyFontRec(rec, font, role) {
  const id = directorState.id;
  if (!rec || !id || !font || !appHasKey) return;
  const prompt =
    `[Apply an Art Director recommendation to design variation ${id}.] Set the ${role} typeface to "${font}" ` +
    `for this variation: point --ta-font-${role} at "${font}" (in the variation's tokens/theme), add the Google ` +
    `Fonts @import so it loads, and keep brand.ts's type role in sync. Change ONLY the ${role} type role — do ` +
    `not restyle the page. Keep to the design rules.\n\n${rec.title}`;
  runRecCommand(rec, prompt, COPY.director.applyingFont(font));
}

// A sourceable 'asset': source + place imagery via the /design §4b image pipeline.
function sourceAssetRec(rec) {
  const id = directorState.id;
  if (!rec || !id || !appHasKey) return;
  const hint = rec.assetHint ? ` Art direction for the image: ${rec.assetHint}.` : "";
  const prompt =
    `[Apply an Art Director recommendation to design variation ${id}.] Source and place imagery for this ` +
    `recommendation. Use the /design image flow: a licensed non-browser download into public/images with a ` +
    `credits.json entry (or a placeholder + a note if nothing suitable is free — never a headless browser), ` +
    `then wire it into the variation's design where the review describes.${hint} Keep to the design rules.` +
    `\n\n${rec.title}\n${rec.why}`;
  runRecCommand(rec, prompt, COPY.director.sourcingAsset);
}

// "Make the call" (a 'decision' / 'asset'): the designer sends direction + an optional file
// straight from the card, and a scoped builder turn executes on THAT plus the Art Director's
// recommendation. The rec is completed like any other applied item.
function makeCallRec(rec, comment, attached) {
  const id = directorState.id;
  if (!rec || !id || !appHasKey) return;
  const lines = [
    `[Act on an Art Director recommendation the designer is deciding, for design variation ${id}.]`,
    `Recommendation: ${rec.title}`,
  ];
  if (rec.why) lines.push(`Why: ${rec.why}`);
  if (Array.isArray(rec.targets) && rec.targets.length) lines.push(`Targets: ${rec.targets.join(", ")}`);
  lines.push("");
  lines.push(comment
    ? `The designer's direction:\n${comment}`
    : `The designer approved this call — act on it using your judgment per the recommendation.`);
  if (attached && attached.rel) lines.push(`\nThe designer attached a file to use: ${attached.rel} (${attached.kind}).`);
  lines.push(`\nMake the change now, editing only files under \`src/variations/${id}/\`. Follow the /design rules. Do not rebuild the page.`);
  runRecCommand(rec, lines.join("\n"), COPY.director.makingCall(rec.title));
}

// The inline "make the call" field (a comment to Claude + an optional upload). Shared by the
// suggestion modal and the review bar. `onSend(comment, attached)` runs on submit. Hidden
// until its trigger toggles the `.open` class (see makeCallToggleBtn).
function buildMakeCallField(onSend) {
  const form = document.createElement("div"); form.className = "adrec-makecall";
  const inner = document.createElement("div"); inner.className = "adrec-makecall-inner";
  const ta = document.createElement("textarea"); ta.className = "adrec-makecall-input"; ta.rows = 3; ta.placeholder = COPY.director.makeCallPlaceholder;
  const row = document.createElement("div"); row.className = "adrec-makecall-row";
  const upload = document.createElement("button"); upload.className = "adrec-upload-btn"; upload.textContent = COPY.director.makeCallUpload;
  const fname = document.createElement("span"); fname.className = "adrec-upload-name";
  let attached = null;
  upload.addEventListener("click", async () => {
    try {
      const res = await window.desktop.attachFile();
      if (res && res.ok) { attached = res; fname.textContent = res.name; fname.style.color = ""; }
      else if (res && res.error) { fname.textContent = res.error; fname.style.color = "#e5484d"; }
    } catch {}
  });
  const send = document.createElement("button"); send.className = "adrec-apply-btn"; send.textContent = COPY.director.makeCallSend;
  if (!appHasKey) { send.disabled = true; send.title = COPY.director.needKey; }
  else send.addEventListener("click", () => onSend(ta.value.trim(), attached));
  row.append(upload, fname, send);
  inner.append(ta, row);
  form.appendChild(inner);
  return form;
}

// A "Make the call" toggle button bound to a make-call field: click reveals/hides it (soft).
function makeCallToggleBtn(field) {
  const mk = document.createElement("button"); mk.className = "adrec-makecall-btn"; mk.textContent = COPY.director.makeCall;
  if (!appHasKey) { mk.disabled = true; mk.title = COPY.director.needKey; }
  else mk.addEventListener("click", () => {
    const opening = !field.classList.contains("open");
    field.classList.toggle("open", opening);
    mk.classList.toggle("active", opening);
    if (opening) { const ta = field.querySelector("textarea"); setTimeout(() => ta && ta.focus(), 80); }
  });
  return mk;
}

// Shared tail: move the rec to completed, close the drawer, and run the scoped builder turn.
function runRecCommand(rec, prompt, echo) {
  const id = directorState.id;
  if (!rec || !id || !appHasKey) return;
  directorState.active = directorState.active.filter((r) => r.id !== rec.id);
  if (!directorState.completed.some((r) => r.id === rec.id)) directorState.completed.push(rec);
  persistDirector();
  closeRecModal();
  closeModal();
  queueAdFocus(rec);
  runAgent(prompt, echo, {});
}

// Rail Art Director icon: exposed only while a built design is previewed and idle. Mirrors
// updateRerollBtn's readiness; hidden otherwise (and its drawer closed if it was open).
async function updateArtDirectorRailBtn(url) {
  if (!railDirector) return;
  // Gated on the same Research/design-variety license as the lens picker / reroll (the
  // Direction axes are present only when licensed). Ungated projects never see the clapperboard.
  const meta = await getDirectionMeta();
  const licensed = !!(meta.axes && Object.keys(meta.axes).length);
  const v = currentPreviewVariation(url);
  const ready = !homeBuilding && !agentBusy && !intakeActive;
  const avail = !!(licensed && ready && v && v !== "v00");
  railDirector.hidden = !avail;
  if (!avail) { railDirector.classList.remove("has-code", "has-passive"); if (isModalOpen("director")) closeModal(); return; }
  updateDirectorIndicator(v); // reflect the previewed design's queue state
}

// ---- Accessibility review drawer (P4) — axe findings → Fix/Hold/Dismiss --------
// Reuses the Art Director drawer's `.adrec` row/modal machinery, but the "review" is a
// DETERMINISTIC axe audit (main.auditA11y), not an agent turn. Findings are GROUPED by rule
// (38 low-contrast elements → one row), and Fix runs a scoped builder edit turn. Gated on the
// opt-in AA mode; on-demand + retroactive (works on any built design, incl. AA-off ones).
let a11yState = { id: null, active: [], dismissed: [], completed: [], ranAt: null };
let a11yAuditing = false;
let a11yError = "";

const A11Y_RULE_LABEL = {
  "color-contrast": "Low-contrast text", "color-contrast-enhanced": "Low-contrast text",
  "image-alt": "Images missing alt text", "heading-order": "Heading levels skip",
  "link-name": "Links without a name", "button-name": "Buttons without a name",
  "label": "Form controls without a label", "target-size": "Targets under 24px",
  "landmark-one-main": "No main landmark", "region": "Content outside a landmark",
  "list": "Broken list structure", "listitem": "List item out of a list",
  "definition-list": "Definition list structure", "dlitem": "Item outside a definition list",
  "aria-required-attr": "Missing required ARIA", "aria-required-children": "Missing required ARIA children",
  "aria-required-parent": "ARIA element out of its parent", "duplicate-id": "Duplicate id",
  "nested-interactive": "Nested interactive elements", "scrollable-region-focusable": "Scrollable region not focusable",
  "empty-heading": "Empty heading", "landmark-unique": "Duplicate landmark",
};
const A11Y_FIX = {
  "color-contrast": "Raise text/background contrast to at least 4.5:1 (3:1 for large text) — prefer the --ta-* tokens (they're contrast-safe) or darken the specific text color; never lighten a brand surface.",
  "image-alt": "Add a meaningful alt to each image (or alt=\"\" if purely decorative).",
  "heading-order": "Fix heading levels so they don't skip (h1 → h2 → h3; one h1 per page).",
  "link-name": "Give each link discernible text (visible label or aria-label).",
  "button-name": "Give each button a discernible accessible name (text or aria-label).",
  "label": "Associate every form control with a <label htmlFor> or an aria-label.",
  "target-size": "Make interactive targets at least 24×24px (pad small glyphs/buttons).",
  "landmark-one-main": "Wrap the page body in a single <main> landmark.",
  "region": "Ensure content sits within a landmark (header/nav/main/footer/section).",
};
function a11yFixHint(rule) { return A11Y_FIX[rule] || "Resolve this WCAG issue while keeping the design intact."; }
function a11yImpactRank(i) { return ({ critical: 0, serious: 1, moderate: 2, minor: 3 })[i] ?? 4; }

// axe returns per-node findings; group them into one row per rule (with its instances).
function groupA11yFindings(nodes) {
  const byRule = new Map();
  for (const n of nodes || []) {
    const g = byRule.get(n.rule);
    if (g) { g.instances.push(n); if (a11yImpactRank(n.impact) < a11yImpactRank(g.impact)) g.impact = n.impact; }
    else byRule.set(n.rule, { id: n.rule, rule: n.rule, impact: n.impact, help: n.help, helpUrl: n.helpUrl, wcag: n.wcag || [], kind: "code", instances: [n] });
  }
  const out = [...byRule.values()].map((g) => {
    const label = A11Y_RULE_LABEL[g.rule] || g.help || g.rule;
    return { ...g, count: g.instances.length, title: g.instances.length > 1 ? `${label} (${g.instances.length})` : label };
  });
  out.sort((a, b) => a11yImpactRank(a.impact) - a11yImpactRank(b.impact));
  return out;
}

function refreshA11y() { if (!isModalOpen("a11y")) return; modalBody.innerHTML = ""; renderA11y(modalBody); }

async function renderA11y(body) {
  const aa = await window.desktop.getA11yMode().catch(() => ({ enabled: false }));
  const lead = document.createElement("div"); lead.className = "muted"; lead.style.cssText = "font-size:12.5px;margin-bottom:12px;";
  lead.textContent = COPY.a11y.lead;
  body.appendChild(lead);

  if (!aa.enabled) {
    const off = document.createElement("div"); off.className = "muted"; off.style.cssText = "font-size:12.5px;margin-bottom:12px;";
    off.textContent = COPY.a11y.offNote;
    body.appendChild(off);
  } else {
    const id = currentPreviewVariation();
    if (!id || id === "v00") {
      const n = document.createElement("div"); n.className = "muted"; n.textContent = COPY.a11y.needDesign; body.appendChild(n);
    } else {
      let store = { active: [], dismissed: [], completed: [], ranAt: null };
      try { store = await window.desktop.loadA11y(id); } catch {}
      a11yState = { id, active: store.active || [], dismissed: store.dismissed || [], completed: store.completed || [], ranAt: store.ranAt || null };

      const runBtn = document.createElement("button"); runBtn.className = "panelbtn primary";
      runBtn.textContent = a11yAuditing ? COPY.a11y.running : (a11yState.ranAt ? COPY.a11y.reRun : COPY.a11y.run);
      runBtn.disabled = a11yAuditing || !design.previewReady;
      if (!design.previewReady) runBtn.title = COPY.a11y.needBuild;
      runBtn.addEventListener("click", () => runA11yReview(id));
      body.appendChild(runBtn);

      if (a11yError) { const e = document.createElement("div"); e.className = "muted"; e.style.cssText = "font-size:12.5px;margin-top:10px;color:#e5484d;"; e.textContent = a11yError; body.appendChild(e); }

      if (a11yState.ranAt && !a11yState.active.length && !a11yAuditing) {
        const clean = document.createElement("div"); clean.className = "muted"; clean.style.cssText = "font-size:12.5px;margin-top:14px;";
        clean.textContent = (a11yState.dismissed.length || a11yState.completed.length) ? COPY.a11y.allHandled : COPY.a11y.clean;
        body.appendChild(clean);
      } else if (a11yState.active.length) {
        const list = document.createElement("div"); list.className = "adrec-list"; list.style.marginTop = "14px";
        for (const f of a11yState.active) list.appendChild(buildA11yRow(f));
        body.appendChild(list);
      }
      if (a11yState.completed.length) body.appendChild(buildA11yArchive(a11yState.completed, true));
      if (a11yState.dismissed.length) body.appendChild(buildA11yArchive(a11yState.dismissed, false));
    }
  }

  // ── Global Rules ── always the last section: the AA-mode master switch + the
  // after-build auto-review toggle. Master lives here (not the Claude drawer) so
  // every accessibility control sits together.
  const gsep = document.createElement("div"); gsep.className = "drawer-sep"; body.appendChild(gsep);
  const glabel = document.createElement("div"); glabel.className = "sess-label"; glabel.textContent = COPY.a11y.globalHeading; body.appendChild(glabel);

  const mdesc = document.createElement("div"); mdesc.className = "sess-desc"; mdesc.textContent = COPY.a11y.modeDesc; body.appendChild(mdesc);
  const modeRow = document.createElement("label"); modeRow.className = "toggle-row";
  const modeCb = document.createElement("input"); modeCb.type = "checkbox"; modeCb.checked = !!aa.enabled;
  const modeTxt = document.createElement("span"); modeTxt.textContent = COPY.a11y.modeToggle;
  modeRow.append(modeCb, modeTxt);
  modeCb.addEventListener("change", async () => { await window.desktop.setA11yMode(modeCb.checked); refreshA11y(); updateA11yRailBtn(); });
  body.appendChild(modeRow);

  if (aa.enabled) {
    const adesc = document.createElement("div"); adesc.className = "sess-desc"; adesc.textContent = COPY.a11y.autoDesc; body.appendChild(adesc);
    const autoRow = document.createElement("label"); autoRow.className = "toggle-row";
    const autoCb = document.createElement("input"); autoCb.type = "checkbox"; autoCb.checked = !!aa.auto;
    const autoTxt = document.createElement("span"); autoTxt.textContent = COPY.a11y.autoToggle;
    autoRow.append(autoCb, autoTxt);
    autoCb.addEventListener("change", () => { window.desktop.setA11yAuto(autoCb.checked); });
    body.appendChild(autoRow);
  }
}

async function runA11yReview(id) {
  if (a11yAuditing) return;
  // Auto-run can fire with the drawer closed → make sure state is loaded for THIS variation
  // (so Held/Dismissed/Completed are honored) before merging in the fresh findings.
  if (a11yState.id !== id) {
    let store = { active: [], dismissed: [], completed: [], ranAt: null };
    try { store = await window.desktop.loadA11y(id); } catch {}
    a11yState = { id, active: store.active || [], dismissed: store.dismissed || [], completed: store.completed || [], ranAt: store.ranAt || null };
  }
  a11yAuditing = true; a11yError = ""; refreshA11y();
  let res = null;
  try { res = await window.desktop.auditA11y(id); } catch (e) { res = { ok: false, error: e.message }; }
  a11yAuditing = false;
  if (!res || !res.ok) { a11yError = (res && res.error) || COPY.a11y.failed; refreshA11y(); return; }
  const grouped = groupA11yFindings(res.findings);
  // Keep prior Held/Dismissed/Completed state — don't resurface a rule already handled.
  const seen = new Set([...(a11yState.dismissed || []), ...(a11yState.completed || [])].map((r) => r.id));
  a11yState.active = grouped.filter((g) => !seen.has(g.id));
  a11yState.ranAt = res.ranAt || Date.now();
  try { await window.desktop.saveA11y(id, a11yState.active, a11yState.dismissed, a11yState.completed, a11yState.ranAt); } catch {}
  updateA11yRailBtn(); // light the rail dot if issues were found
  refreshA11y();
}

// After a build completes: if AA mode + auto-review are both on, run the review (deterministic,
// no chat, no tokens) so the rail dot reflects any issues without the designer asking.
async function maybeAutoA11yReview() {
  try {
    const aa = await window.desktop.getA11yMode();
    if (!aa || !aa.enabled || !aa.auto) return;
    const id = currentPreviewVariation();
    if (!id || id === "v00" || !design.previewReady) return;
    await runA11yReview(id);
  } catch {}
}

function buildA11yRow(f) {
  const row = document.createElement("button"); row.className = "adrec";
  const title = document.createElement("span"); title.className = "adrec-title"; title.textContent = f.title;
  const chip = document.createElement("span"); chip.className = "adrec-kind a11y-impact-" + (f.impact || "moderate");
  chip.textContent = f.impact || "moderate";
  row.append(title, chip);
  row.addEventListener("click", () => openA11yModal(f, "active"));
  return row;
}
function buildA11yArchive(items, completed) {
  const wrap = document.createElement("details"); wrap.className = "adrec-archive" + (completed ? " adrec-completed" : "");
  const sum = document.createElement("summary"); sum.textContent = completed ? COPY.a11y.fixed(items.length) : COPY.a11y.dismissed(items.length); wrap.appendChild(sum);
  const list = document.createElement("div"); list.className = "adrec-list";
  for (const f of items) {
    const row = document.createElement("div"); row.className = "adrec " + (completed ? "adrec-done" : "adrec-dismissed");
    const title = document.createElement("span"); title.className = "adrec-title"; title.textContent = f.title;
    if (completed) { const tag = document.createElement("span"); tag.className = "adrec-donetag"; tag.textContent = COPY.a11y.fixedTag; row.appendChild(title); row.appendChild(tag); row.addEventListener("click", () => openA11yModal(f, "completed")); }
    else { const restore = document.createElement("button"); restore.className = "adrec-restore"; restore.textContent = COPY.director.restore; restore.addEventListener("click", (e) => { e.stopPropagation(); restoreA11y(f); }); row.append(title, restore); row.addEventListener("click", () => openA11yModal(f, "archived")); }
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

function closeA11yModal() { const o = el("a11y-overlay"); if (o) o.remove(); }
function openA11yModal(f, mode) {
  mode = mode || "active";
  closeA11yModal();
  const overlay = document.createElement("div"); overlay.className = "adrec-overlay"; overlay.id = "a11y-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeA11yModal(); });
  const card = document.createElement("div"); card.className = "adrec-modal";
  const title = document.createElement("div"); title.className = "adrec-modal-title"; title.textContent = f.title; card.appendChild(title);
  const meta = document.createElement("div"); meta.className = "adrec-modal-kind a11y-impact-" + (f.impact || "moderate");
  meta.textContent = `${f.impact || "moderate"}${(f.wcag || []).length ? " · " + f.wcag.join(", ").toUpperCase() : ""}`;
  card.appendChild(meta);
  if (f.help) { const w = document.createElement("div"); w.className = "adrec-modal-why"; w.textContent = f.help; card.appendChild(w); }
  // The offending elements (first several) — selector + why + which breakpoints.
  const inst = document.createElement("div"); inst.className = "a11y-instances";
  (f.instances || []).slice(0, 8).forEach((n) => {
    const row = document.createElement("div"); row.className = "a11y-inst";
    const sel = document.createElement("div"); sel.className = "a11y-inst-sel"; sel.textContent = n.selector + (n.breakpoints && n.breakpoints.length ? `  ·  ${n.breakpoints.join(", ")}` : "");
    row.appendChild(sel);
    if (n.failureSummary) { const fs = document.createElement("div"); fs.className = "a11y-inst-why"; fs.textContent = String(n.failureSummary).replace(/\s*\n\s*/g, " ").replace(/^Fix (any|all) of the following:\s*/i, ""); row.appendChild(fs); }
    inst.appendChild(row);
  });
  if ((f.instances || []).length > 8) { const more = document.createElement("div"); more.className = "a11y-inst-more"; more.textContent = COPY.a11y.andMore(f.instances.length - 8); inst.appendChild(more); }
  card.appendChild(inst);

  const actions = document.createElement("div"); actions.className = "adrec-modal-actions";
  if (mode === "completed") {
    const close = document.createElement("button"); close.className = "adrec-hold-btn"; close.textContent = COPY.director.close;
    close.addEventListener("click", () => closeA11yModal()); actions.appendChild(close);
  } else {
    const hold = document.createElement("button"); hold.className = "adrec-hold-btn"; hold.textContent = COPY.director.hold; hold.title = COPY.director.holdTip;
    hold.addEventListener("click", () => closeA11yModal()); actions.appendChild(hold);
    if (mode !== "archived") {
      const dismiss = document.createElement("button"); dismiss.className = "adrec-dismiss-btn"; dismiss.textContent = COPY.director.dismiss; dismiss.title = COPY.director.dismissTip;
      dismiss.addEventListener("click", () => { dismissA11y(f); closeA11yModal(); }); actions.appendChild(dismiss);
    }
    // Show on page + Fix, grouped together on the right.
    const right = document.createElement("div"); right.className = "a11y-right";
    const show = document.createElement("button"); show.className = "a11y-show-btn"; show.textContent = COPY.a11y.showOnPage; show.title = COPY.a11y.showOnPageTip;
    show.addEventListener("click", () => showA11yOnPage(f));
    const fix = document.createElement("button"); fix.className = "adrec-apply-btn"; fix.textContent = COPY.a11y.fix;
    if (!appHasKey) { fix.disabled = true; fix.title = COPY.director.needKey; }
    else fix.addEventListener("click", () => { closeA11yModal(); fixA11y(f); });
    right.append(show, fix);
    actions.appendChild(right);
  }
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function persistA11y() {
  if (!a11yState.id) return;
  try { window.desktop.saveA11y(a11yState.id, a11yState.active, a11yState.dismissed, a11yState.completed, a11yState.ranAt); } catch {}
  refreshA11y();
}
function dismissA11y(f) { a11yState.active = a11yState.active.filter((x) => x.id !== f.id); if (!a11yState.dismissed.some((x) => x.id === f.id)) a11yState.dismissed.push(f); persistA11y(); }
function restoreA11y(f) { a11yState.dismissed = a11yState.dismissed.filter((x) => x.id !== f.id); if (!a11yState.active.some((x) => x.id === f.id)) a11yState.active.push(f); persistA11y(); }
// Fix = a scoped BUILDER edit turn (never reviewMode), handed the rule + remediation + the
// exact elements axe flagged. Moves the finding to Completed (re-run to confirm it's gone).
function fixA11y(f) {
  const id = a11yState.id;
  if (!f || !id || !appHasKey) return;
  a11yState.active = a11yState.active.filter((x) => x.id !== f.id);
  if (!a11yState.completed.some((x) => x.id === f.id)) a11yState.completed.push(f);
  persistA11y();
  closeModal();
  const list = (f.instances || []).slice(0, 12).map((n, i) =>
    `${i + 1}. ${n.selector}\n   why: ${String(n.failureSummary || "").replace(/\s*\n\s*/g, " ")}\n   html: ${String(n.html || "").slice(0, 160)}`
  ).join("\n");
  const prompt =
    `[Fix an accessibility (WCAG 2.1 AA) finding in design variation ${id}.] Rule: ${f.rule} — ${f.help}. ` +
    `${a11yFixHint(f.rule)}\n` +
    `Fix ONLY this, editing only files under \`src/variations/${id}/\`; don't rebuild the page or touch anything else. ` +
    `Keep the design's look intact and use the --ta-* tokens/utilities. The ${f.count} element(s) axe flagged:\n${list}`;
  runAgent(prompt, COPY.a11y.fixingEcho(f.title), {});
}

// Rail icon: always available; when clicked, the drawer adapts to AA-mode on/off. No license gate.
async function updateA11yRailBtn() {
  if (!railA11y) return;
  railA11y.classList.remove("has-code", "has-passive");
  const v = currentPreviewVariation();
  if (!v || v === "v00") return;
  let store = { active: [] };
  try { store = await window.desktop.loadA11y(v); } catch {}
  if ((store.active || []).some((f) => a11yImpactRank(f.impact) <= 1)) railA11y.classList.add("has-code");
  else if ((store.active || []).length) railA11y.classList.add("has-passive");
}

// ---- Accessibility "Show on page" review overlay ----------------------------
// Selectors from axe match the CLEAN capture route, not the framed live preview — so
// "Show on page" flips the active tab to the capture render (what was audited) and injects
// this overlay: a pulsing accessibility marker + outline on each failing element. A floating
// toolbar (shell-side) steps through them and exits back to the normal preview.
const A11Y_HIGHLIGHT_JS = `(function(){
  if (window.__a11yHighlight) window.__a11yHighlight.clear();
  var els=[], boxes=[], icons=[], wraps=[], layer=null, styleEl=null;
  var ICON='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="1.4"/><path d="M4.5 8.5c2.4 1 4.9 1.5 7.5 1.5s5.1-.5 7.5-1.5"/><path d="M12 10v5"/><path d="m8.5 20 3.5-5 3.5 5"/></svg>';
  function css(){ if(styleEl) return; styleEl=document.createElement('style'); styleEl.id='__a11y-style'; styleEl.textContent='@keyframes __a11yP{0%{box-shadow:0 0 0 0 rgba(192,38,30,.55)}100%{box-shadow:0 0 0 11px rgba(192,38,30,0)}}#__a11y-layer{position:absolute;top:0;left:0;pointer-events:none;z-index:2147483000}#__a11y-layer .b{position:absolute;box-sizing:border-box;border:2px solid #0a7;border-radius:5px;background:rgba(10,119,105,.06)}#__a11y-layer .ic{position:absolute;width:22px;height:22px;border-radius:50%;background:#0a7;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(0,0,0,.35)}#__a11y-layer .cur .b{border-color:#c0261e;background:rgba(192,38,30,.09)}#__a11y-layer .cur .ic{background:#c0261e;animation:__a11yP 1.2s ease-out infinite}'; document.head.appendChild(styleEl); }
  function pos(){ for(var i=0;i<els.length;i++){ var el=els[i]; if(!el) continue; var r=el.getBoundingClientRect(); var t=r.top+window.scrollY,l=r.left+window.scrollX; boxes[i].style.top=t+'px'; boxes[i].style.left=l+'px'; boxes[i].style.width=r.width+'px'; boxes[i].style.height=r.height+'px'; icons[i].style.top=(t-8)+'px'; icons[i].style.left=(l-8)+'px'; } }
  window.__a11yHighlight={
    show:function(sels){ this.clear(); css(); layer=document.createElement('div'); layer.id='__a11y-layer'; document.body.appendChild(layer);
      els=sels.map(function(s){ try{return document.querySelector(s);}catch(e){return null;} });
      for(var i=0;i<els.length;i++){ var w=document.createElement('div'); w.className='wrap'; var b=document.createElement('div'); b.className='b'; var ic=document.createElement('div'); ic.className='ic'; ic.innerHTML=ICON; w.appendChild(b); w.appendChild(ic); layer.appendChild(w); wraps.push(w); boxes.push(b); icons.push(ic); }
      pos(); window.addEventListener('scroll',pos,true); window.addEventListener('resize',pos);
      return els.filter(Boolean).length; },
    focus:function(i){ for(var j=0;j<wraps.length;j++) wraps[j].className='wrap'+(j===i?' cur':''); var el=els[i]; if(el&&el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'center'}); },
    clear:function(){ if(layer){layer.remove();layer=null;} if(styleEl){styleEl.remove();styleEl=null;} window.removeEventListener('scroll',pos,true); window.removeEventListener('resize',pos); els=[];boxes=[];icons=[];wraps=[]; }
  };
})();`;

let a11yReview = null; // { finding, sels, idx, count, tab, prevUrl }
let a11yToolbarEl = null;

function onceWebviewLoaded(wv, fn) {
  let done = false;
  const h = () => { if (done) return; done = true; try { wv.removeEventListener("did-finish-load", h); } catch {} fn(); };
  try { wv.addEventListener("did-finish-load", h); } catch {}
  setTimeout(() => { if (!done) h(); }, 2600); // fallback if the event is missed
}
async function showA11yOnPage(f) {
  if (!f || !activeTab || !viteUrl) return;
  const id = a11yState.id || currentPreviewVariation();
  if (!id || id === "v00") return;
  closeA11yModal(); closeModal();
  const sels = (f.instances || []).map((n) => n.selector).filter(Boolean);
  const tab = activeTab;
  a11yReview = { finding: f, sels, idx: 0, count: 0, tab, prevUrl: tab.url };
  showA11yToolbar();
  navigate(tab, `${viteUrl}/?v=${id}&capture=desktop`);
  onceWebviewLoaded(tab.wv, async () => {
    if (!a11yReview) return;
    try {
      await tab.wv.executeJavaScript(A11Y_HIGHLIGHT_JS);
      const n = await tab.wv.executeJavaScript(`window.__a11yHighlight.show(${JSON.stringify(sels)})`);
      a11yReview.count = n || 0;
      a11yReviewFocus(0);
    } catch { updateA11yToolbar(); }
  });
}
function a11yReviewFocus(i) {
  if (!a11yReview) return;
  const n = a11yReview.count || 0;
  if (n) { a11yReview.idx = ((i % n) + n) % n; try { a11yReview.tab.wv.executeJavaScript(`window.__a11yHighlight.focus(${a11yReview.idx})`); } catch {} }
  updateA11yToolbar();
}
function a11yReviewNext() { if (a11yReview) a11yReviewFocus(a11yReview.idx + 1); }
function a11yReviewPrev() { if (a11yReview) a11yReviewFocus(a11yReview.idx - 1); }
// Kick off the fix for the finding being reviewed, straight from the banner: clear the
// overlay + restore the preview, then run the scoped builder turn (streams in chat).
function a11yReviewFix() {
  if (!a11yReview || !appHasKey) return;
  const f = a11yReview.finding;
  exitA11yReview();
  fixA11y(f);
}
function exitA11yReview() {
  if (!a11yReview) return;
  const r = a11yReview; a11yReview = null;
  try { r.tab.wv.executeJavaScript("window.__a11yHighlight && window.__a11yHighlight.clear()"); } catch {}
  if (r.prevUrl) navigate(r.tab, r.prevUrl);
  hideA11yToolbar();
}
function showA11yToolbar() {
  if (!a11yToolbarEl) {
    a11yToolbarEl = document.createElement("div");
    a11yToolbarEl.id = "a11y-toolbar";
    a11yToolbarEl.innerHTML =
      '<span class="a11y-tb-title"></span><span class="a11y-tb-count"></span>' +
      '<button class="a11y-tb-btn" data-a="prev">‹ Prev</button>' +
      '<button class="a11y-tb-btn" data-a="next">Next ›</button>' +
      '<button class="a11y-tb-btn a11y-tb-fix" data-a="fix"></button>' +
      '<button class="a11y-tb-btn a11y-tb-exit" data-a="exit"></button>';
    document.body.appendChild(a11yToolbarEl);
    a11yToolbarEl.addEventListener("click", (e) => {
      const a = e.target && e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "prev") a11yReviewPrev(); else if (a === "next") a11yReviewNext(); else if (a === "fix") a11yReviewFix(); else if (a === "exit") exitA11yReview();
    });
    a11yToolbarEl.querySelector(".a11y-tb-fix").textContent = COPY.a11y.fix;
    a11yToolbarEl.querySelector(".a11y-tb-exit").textContent = COPY.a11y.exitReview;
  }
  const fixBtn = a11yToolbarEl.querySelector(".a11y-tb-fix");
  fixBtn.disabled = !appHasKey;
  if (!appHasKey) fixBtn.title = COPY.director.needKey; else fixBtn.removeAttribute("title");
  a11yToolbarEl.hidden = false;
  updateA11yToolbar();
}
function hideA11yToolbar() { if (a11yToolbarEl) a11yToolbarEl.hidden = true; }
function updateA11yToolbar() {
  if (!a11yToolbarEl || !a11yReview) return;
  a11yToolbarEl.querySelector(".a11y-tb-title").textContent = a11yReview.finding.title;
  const n = a11yReview.count || 0;
  a11yToolbarEl.querySelector(".a11y-tb-count").textContent = n ? COPY.a11y.ofCount(a11yReview.idx + 1, n) : COPY.a11y.notAtSize;
  const dis = n < 2;
  a11yToolbarEl.querySelectorAll('[data-a="prev"],[data-a="next"]').forEach((b) => { b.disabled = dis; });
}

// ---- Art Director "Show on page" --------------------------------------------
// The AA review can point at exact elements because axe hands us CSS selectors. A
// Director suggestion has no selector — so it carries an `anchor` (a data-block value,
// a visible text snippet, or a CSS selector) that we resolve to an element on the clean
// capture route, then outline + pulse it. Amber accent + an eye marker set it apart from
// the red/green AA overlay. One anchor → one element, so there's no Prev/Next, just Fix
// (when the suggestion is code-actionable) + Exit.
const AD_HIGHLIGHT_JS = `(function(){
  if (window.__adHighlight) window.__adHighlight.clear();
  var els=[], boxes=[], icons=[], wraps=[], layer=null, styleEl=null;
  var ICON='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/></svg>';
  function css(){ if(styleEl) return; styleEl=document.createElement('style'); styleEl.id='__ad-style'; styleEl.textContent='@keyframes __adP{0%{box-shadow:0 0 0 0 rgba(217,119,6,.5)}100%{box-shadow:0 0 0 12px rgba(217,119,6,0)}}#__ad-layer{position:absolute;top:0;left:0;pointer-events:none;z-index:2147483000}#__ad-layer .b{position:absolute;box-sizing:border-box;border:2px solid #d97706;border-radius:6px;background:rgba(217,119,6,.07)}#__ad-layer .ic{position:absolute;width:22px;height:22px;border-radius:50%;background:#d97706;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(0,0,0,.35)}#__ad-layer .cur .b{border-color:#b45309;background:rgba(180,83,9,.11)}#__ad-layer .cur .ic{background:#b45309;animation:__adP 1.2s ease-out infinite}'; document.head.appendChild(styleEl); }
  function pos(){ for(var i=0;i<els.length;i++){ var el=els[i]; if(!el) continue; var r=el.getBoundingClientRect(); var t=r.top+window.scrollY,l=r.left+window.scrollX; boxes[i].style.top=t+'px'; boxes[i].style.left=l+'px'; boxes[i].style.width=r.width+'px'; boxes[i].style.height=r.height+'px'; icons[i].style.top=(t-8)+'px'; icons[i].style.left=(l-8)+'px'; } }
  function byText(txt){ txt=(txt||'').trim().toLowerCase(); if(!txt) return null; var best=null,bl=Infinity; var all=document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,p,span,li,figcaption,label,blockquote,strong,em'); for(var i=0;i<all.length;i++){ var e=all[i]; var t=(e.textContent||'').trim().toLowerCase(); if(!t) continue; if(t.indexOf(txt)!==-1 && t.length<bl){ best=e; bl=t.length; } } return best; }
  function resolve(a){ if(!a) return null; try{ if(a.block){ var e=document.querySelector('[data-block="'+String(a.block).replace(/"/g,'')+'"]'); if(e) return e; } }catch(_){} try{ if(a.selector){ var s=document.querySelector(a.selector); if(s) return s; } }catch(_){} if(a.text) return byText(a.text); return null; }
  window.__adHighlight={
    show:function(anchors){ this.clear(); css(); layer=document.createElement('div'); layer.id='__ad-layer'; document.body.appendChild(layer);
      els=(anchors||[]).map(resolve);
      for(var i=0;i<els.length;i++){ var w=document.createElement('div'); w.className='wrap'; var b=document.createElement('div'); b.className='b'; var ic=document.createElement('div'); ic.className='ic'; ic.innerHTML=ICON; w.appendChild(b); w.appendChild(ic); layer.appendChild(w); wraps.push(w); boxes.push(b); icons.push(ic); }
      pos(); window.addEventListener('scroll',pos,true); window.addEventListener('resize',pos);
      return els.filter(Boolean).length; },
    focus:function(i){ for(var j=0;j<wraps.length;j++) wraps[j].className='wrap'+(j===i?' cur':''); var el=els[i]; if(el&&el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'center'}); },
    clear:function(){ if(layer){layer.remove();layer=null;} if(styleEl){styleEl.remove();styleEl=null;} window.removeEventListener('scroll',pos,true); window.removeEventListener('resize',pos); els=[];boxes=[];icons=[];wraps=[]; }
  };
})();`;

let adReview = null;   // { recs, idx, tab, prevUrl, count, expanded }
let adToolbarEl = null;
const AD_CARET_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

// The DESIGN tab: the Home tab, else any tab showing the design (not the Style guide,
// not the Site). Art Director walks and actions happen there, never on whichever tab
// happened to be active (a review begun from the Style guide used to land back on it).
function designTab() {
  return tabs.find((t) => t.navKind === "home")
    || tabs.find((t) => t.url && /[?&]v=/.test(t.url) && !/styleguide/.test(t.url) && !t.site)
    || activeTab;
}
// After an Art Director action's turn: land on the design tab and scroll to what the
// recommendation targeted (a brief highlight), so the change is seen where it was made.
let adFocusAfter = null; // { tab, anchor }
function queueAdFocus(rec) { adFocusAfter = { tab: designTab(), anchor: (rec && rec.anchor) || null }; }
async function applyAdFocus() {
  const f = adFocusAfter; adFocusAfter = null;
  if (!f || !f.tab || !tabs.includes(f.tab)) return;
  setActiveTab(f.tab);
  if (!f.anchor) return;
  for (let i = 0; i < 8; i++) { // the tab may still be reloading behind the cover
    try {
      await f.tab.wv.executeJavaScript(AD_HIGHLIGHT_JS);
      const n = await f.tab.wv.executeJavaScript(`window.__adHighlight ? window.__adHighlight.show(${JSON.stringify([f.anchor])}) : 0`);
      if (n) { f.tab.wv.executeJavaScript("window.__adHighlight.focus(0)"); setTimeout(() => { try { f.tab.wv.executeJavaScript("window.__adHighlight && window.__adHighlight.clear()"); } catch {} }, 3000); }
      return;
    } catch { await new Promise((r) => setTimeout(r, 400)); }
  }
}

async function showAdOnPage(rec) {
  if (!rec || !viteUrl) return;
  const id = directorState.vid || currentPreviewVariation();
  if (!id || id === "v00") return;
  // Page scope: open THAT page in capture mode (its route flag), not the home page.
  const routeFlag = directorState.page && directorState.page.route ? `&${directorState.page.route}` : "";
  closeRecModal(); closeModal();
  // Walk the whole active list from this rec, so Next steps through every item; fall back to
  // just this rec when it isn't in the active list (e.g. opened from the archive).
  let recs = directorState.active || [];
  let idx = recs.findIndex((r) => r && r.id === rec.id);
  if (idx < 0) { recs = [rec]; idx = 0; }
  const tab = designTab(); if (!tab) return;
  setActiveTab(tab); // the walk happens on the design, whatever tab was active
  // Arrives OPEN so the action is one click away; the caret's state then holds across
  // Next / Prev until the designer toggles it again.
  adReview = { recs, idx, tab, prevUrl: tab.url, count: 0, expanded: true };
  showAdToolbar();
  navigate(tab, `${viteUrl}/?v=${id}${routeFlag}&capture=desktop`);
  onceWebviewLoaded(tab.wv, async () => {
    if (!adReview) return;
    try { await tab.wv.executeJavaScript(AD_HIGHLIGHT_JS); } catch { /* injection blocked → bar still exits */ }
    adHighlightCurrent();
  });
}
// (Re)highlight the current rec's anchor on the already-loaded capture page. No re-navigation,
// so Next/Prev are instant. An anchorless (or unresolvable) rec just clears the overlay.
async function adHighlightCurrent() {
  if (!adReview) return;
  const cur = adReview.recs[adReview.idx];
  const anchor = cur && cur.anchor ? [cur.anchor] : [];
  try {
    const n = await adReview.tab.wv.executeJavaScript(`window.__adHighlight ? window.__adHighlight.show(${JSON.stringify(anchor)}) : 0`);
    adReview.count = n || 0;
    if (n) adReview.tab.wv.executeJavaScript(`window.__adHighlight.focus(0)`);
    else adReview.tab.wv.executeJavaScript("window.__adHighlight && window.__adHighlight.clear()");
  } catch { adReview.count = 0; }
  updateAdToolbar();
}
function adReviewStep(d) {
  if (!adReview || adReview.recs.length < 2) return;
  const n = adReview.recs.length;
  adReview.idx = ((adReview.idx + d) % n + n) % n;
  // Keep the dropdown open across steps so the designer reads + acts on each rec in place;
  // updateAdToolbar (via adHighlightCurrent) rebuilds its title/why/actions for the new rec.
  adHighlightCurrent();
}
function adReviewNext() { adReviewStep(1); }
function adReviewPrev() { adReviewStep(-1); }
// Open/close the description. Width and corner radius are fixed (see CSS), so opening only
// grows the height via the dropdown's max-height transition — it stays a rounded rectangle
// the whole way, never morphing through a pill.
function adToggleExpand() { if (adReview) { adReview.expanded = !adReview.expanded; updateAdToolbar(); } }
// Fix straight from the bar (code suggestions only): clear the overlay + restore the preview,
// then run the same scoped builder turn Apply runs.
function adReviewFix() {
  if (!adReview || !appHasKey) return;
  const rec = adReview.recs[adReview.idx];
  if (!(rec && rec.kind === "code" && rec.apply)) return;
  exitAdReview(); applyRec(rec);
}
function exitAdReview() {
  if (!adReview) return;
  const r = adReview; adReview = null;
  try { r.tab.wv.executeJavaScript("window.__adHighlight && window.__adHighlight.clear()"); } catch {}
  if (r.prevUrl) navigate(r.tab, r.prevUrl);
  hideAdToolbar();
}
function showAdToolbar() {
  if (!adToolbarEl) {
    adToolbarEl = document.createElement("div");
    adToolbarEl.id = "ad-toolbar";
    // A FIXED top row (truncated title + caret + count + step/exit) that never moves, plus a
    // dropdown that animates open below it carrying the full title, the why, and the rec's
    // ACTIONS (Apply / Source imagery / Make the call) — everything for the walkthrough in one
    // spot. "Make the call" expands the dropdown further with its field baked in.
    adToolbarEl.innerHTML =
      '<div class="ad-tb-row">' +
        '<div class="ad-tb-head"><span class="a11y-tb-title"></span>' +
        '<button class="ad-tb-caret" data-a="expand" aria-label="Expand">' + AD_CARET_SVG + '</button></div>' +
        '<span class="a11y-tb-count"></span>' +
        '<button class="a11y-tb-btn" data-a="prev">‹ Prev</button>' +
        '<button class="a11y-tb-btn" data-a="next">Next ›</button>' +
        '<button class="a11y-tb-btn a11y-tb-exit" data-a="exit"></button>' +
      '</div>' +
      '<div class="ad-tb-drop"><div class="ad-tb-drop-inner"><div class="ad-tb-panel">' +
        '<div class="ad-tb-drop-title"></div>' +
        '<div class="ad-tb-why"></div>' +
        '<div class="ad-tb-actions"></div>' +
      '</div></div></div>';
    document.body.appendChild(adToolbarEl);
    adToolbarEl.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest("[data-a]");
      const a = t && t.getAttribute("data-a");
      if (a === "prev") adReviewPrev();
      else if (a === "next") adReviewNext();
      else if (a === "exit") { exitAdReview(); openModal("director"); } // back to the recommendations list
      else if (a === "expand") adToggleExpand();
    });
    adToolbarEl.querySelector(".a11y-tb-exit").textContent = COPY.director.exitReview;
  }
  adToolbarEl.hidden = false;
  // Every arrival (Show on page, a new walk) opens the details; only the caret, via
  // Next / Prev's updateAdToolbar path, carries a closed state along.
  if (adReview) adReview.expanded = true;
  updateAdToolbar();
}
function hideAdToolbar() { if (adToolbarEl) adToolbarEl.hidden = true; }
function updateAdToolbar() {
  if (!adToolbarEl || !adReview) return;
  const rec = adReview.recs[adReview.idx] || {};
  const multi = adReview.recs.length > 1;
  adToolbarEl.classList.toggle("expanded", !!adReview.expanded);
  adToolbarEl.querySelector(".a11y-tb-title").textContent = rec.title || "";
  // The dropdown carries the full title (as a heading) + the why; the row title stays
  // truncated and fixed, so opening the dropdown never shifts it.
  adToolbarEl.querySelector(".ad-tb-drop-title").textContent = rec.title || "";
  const why = adToolbarEl.querySelector(".ad-tb-why");
  why.textContent = rec.why || "";
  why.hidden = !rec.why;
  adToolbarEl.querySelector(".ad-tb-caret").classList.toggle("open", !!adReview.expanded);
  const status = adReview.count ? COPY.director.shownOnPage : COPY.director.notOnView;
  adToolbarEl.querySelector(".a11y-tb-count").textContent = multi ? `${adReview.idx + 1}/${adReview.recs.length} · ${status}` : status;
  adToolbarEl.querySelectorAll('[data-a="prev"],[data-a="next"]').forEach((b) => { b.hidden = !multi; });
  // The rec's actions live in the dropdown, rebuilt per rec as you step Next/Prev.
  renderAdBarActions(adToolbarEl.querySelector(".ad-tb-actions"), rec);
}

// Build the action buttons for the current rec INSIDE the review-bar dropdown — the same
// actions as the suggestion modal, so the designer can act mid-walkthrough. Each action exits
// the review (clears the overlay, restores the preview) then runs; "Make the call" reveals its
// field inline first. Rebuilt each step, so the field always starts fresh + collapsed.
function renderAdBarActions(el, rec) {
  if (!el) return;
  // Only rebuild when the rec actually changes (a step). Re-rendering for the SAME rec (a caret
  // toggle, a re-highlight) would wipe a half-typed make-the-call comment, so skip it.
  const recId = (rec && rec.id) || "";
  if (el.dataset.recId === recId && el.childElementCount) return;
  el.dataset.recId = recId;
  el.innerHTML = "";
  if (!rec || !rec.kind) return;
  const noKey = !appHasKey;
  const isFontRec = rec.kind === "decision" && Array.isArray(rec.fontOptions) && rec.fontOptions.length > 0;
  const row = document.createElement("div"); row.className = "adrec-action-split";

  if (rec.kind === "code" && rec.apply) {
    const apply = document.createElement("button"); apply.className = "adrec-apply-btn"; apply.textContent = COPY.director.applyThis;
    if (noKey) { apply.disabled = true; apply.title = COPY.director.needKey; }
    else apply.addEventListener("click", () => { const r = rec; exitAdReview(); applyRec(r); });
    row.appendChild(apply); el.appendChild(row);
  } else if (isFontRec) {
    // The font pick has its own inline picker — open the modal for it.
    const choose = document.createElement("button"); choose.className = "adrec-apply-btn"; choose.textContent = COPY.director.applyFont;
    if (noKey) { choose.disabled = true; choose.title = COPY.director.needKey; }
    else choose.addEventListener("click", () => { const r = rec; exitAdReview(); openRecModal(r, "active"); });
    row.appendChild(choose); el.appendChild(row);
  } else if (rec.kind === "decision" || rec.kind === "asset") {
    const field = buildMakeCallField((comment, attached) => { const r = rec; exitAdReview(); makeCallRec(r, comment, attached); });
    const mkBtn = makeCallToggleBtn(field);
    if (rec.kind === "asset" && rec.assetSourceable) {
      const source = document.createElement("button"); source.className = "adrec-source-btn"; source.textContent = COPY.director.sourceImagery;
      if (noKey) { source.disabled = true; source.title = COPY.director.needKey; }
      else source.addEventListener("click", () => { const r = rec; exitAdReview(); sourceAssetRec(r); });
      row.append(source, mkBtn);
    } else {
      row.appendChild(mkBtn);
    }
    el.append(row, field);
  }
}

// ---- Start designing (#3) ---------------------------------------------------
// Animate the whole pane clean (brief rail included), then hand off to the build
// with a persistent "preparing" status + rotating messages until the design shows.
function startDesigning() {
  intakePhase = "designing";
  quietBuildActive = true;    // hold a quiet pane + closed chat until the build fully finishes
  setChatCollapsed(true);     // keep the chat closed through the build (no narration) — opens on reveal
  updateBackButton();
  clearIntakePending();
  const leaving = [intakeph.querySelector(".intake-head"), el("intake-brief"), ...Array.from(intakeStack.children)].filter(Boolean);
  const anims = leaving
    .map((elm) => anim(elm, [
      { opacity: 1, transform: "translateY(0px)" },
      { opacity: 0, transform: "translateY(-18px)" },
    ], { duration: 440 }))
    .filter(Boolean);
  const go = async () => {
    // Assemble the Brief into a /design-brief invocation (Phase 2) and hand off.
    let prompt = "/design-brief a clean, modern marketing website";
    try { const r = await window.desktop.getDesignPrompt(); if (r && r.prompt) prompt = r.prompt; } catch {}
    // Is the licensed research step on? It adds a (slow) phase to the narration spine.
    let research = false;
    try { const rs = await window.desktop.getResearch(); research = !!(rs && rs.effective); } catch {}
    // Kick the agent FIRST (while intakeActive still guards refreshPreview from
    // showing its own "working" placeholder), THEN swap the pane to preparing and start
    // the Art-Director narration spine (owns the pane text through the whole quiet build).
    runAgent(prompt, null, { model: buildModel() }); // build on the fidelity-selected model
    showPreparing();
    buildNarration.begin(computePhaseList(lastBrief, { research }), briefBits(lastBrief));
  };
  if (anims.length) Promise.allSettled(anims.map((a) => a.finished)).then(go);
  else go();
}

// ---- Quiet-build narration: an Art-Director progress spine --------------------
// See docs/quiet-build-narration-spec.md. Derives an ordered phase list from the Brief,
// shows a determinate "Step N of M" spine in the preparing pane, and advances it on the
// signals that already flow during the quiet build (tool activity + the previewReady flip).
// Curated copy lives in COPY.build.phases; the TodoWrite hook (precise advance) is Phase 2.

// Ordered phase catalog. `when(brief, opts)` gates inclusion; ids match COPY.build.phases.
const NARRATION_PHASES = [
  { id: "understanding", when: () => true },
  { id: "research", when: (_b, o) => !!o.research },
  { id: "foundations", when: () => true },
  { id: "header", when: (b) => (b.projectType || "website") !== "app" },
  { id: "hero", when: (b) => narrationHasSection(b, /hero/i) || !!b.heroLayout },
  { id: "sections", when: () => true },
  { id: "contact", when: (b) => !!b.ctaType || narrationHasSection(b, /contact|cta|call[\s-]?to[\s-]?action/i) },
  { id: "polish", when: () => true },
];
function narrationHasSection(b, re) {
  return !!(b && Array.isArray(b.sections) && b.sections.some((s) => re.test(String(s))));
}
function computePhaseList(brief, opts) {
  const b = brief || {};
  return NARRATION_PHASES.filter((p) => p.when(b, opts || {})).map((p) => p.id);
}

// Map a completed tool activity (name + target) to the phase it implies — the fallback
// advance until the TodoWrite hook lands (Phase 2). Returns a phase id or null.
function phaseForActivity(name, target) {
  const t = (target || "").toLowerCase();
  if (/brand\.ts|tokens\.css|fonts\.css|theme\.css|apply-brand|extract-palette|resolve-fonts/.test(t)) return "foundations";
  if (name === "WebFetch" || /\bcurl\b/.test(t)) return "research";
  if (/header\.tsx|menustate|menu\.ts/.test(t)) return "header";
  if (/hero/.test(t)) return "hero";
  if (/contact|cta/.test(t)) return "contact";
  if (/home\.tsx|\/components\/|section/.test(t)) return "sections";
  return null;
}

// Map the agent's current TodoWrite item to a phase — the authoritative spine driver
// (Phase 2). Uses the in-progress todo (else the first pending), keyword-matched. Returns
// a phase id or null; advanceTo is forward-only, so a stale todo can never regress it.
function phaseForTodo(todos) {
  if (!Array.isArray(todos)) return null;
  const cur = todos.find((t) => t && t.status === "in_progress")
    || todos.find((t) => t && t.status === "pending");
  if (!cur) return null;
  const s = `${cur.content || ""} ${cur.activeForm || ""}`.toLowerCase();
  if (/research|competitor|comparable|study|reference site/.test(s)) return "research";
  if (/palette|brand|token|font|colou?r|foundation|style ?guide|theme/.test(s)) return "foundations";
  if (/header|nav|menu/.test(s)) return "header";
  if (/hero/.test(s)) return "hero";
  if (/contact|cta|call to action|\bform\b/.test(s)) return "contact";
  if (/polish|responsive|refine|final|\bqa\b|review|cleanup/.test(s)) return "polish";
  if (/section|feature|content|page|footer|about|pricing|faq/.test(s)) return "sections";
  return null;
}

// Brief → the tokens the AD copy interpolates, each with a graceful fallback so a sparse
// brief still reads well.
function briefBits(brief) {
  const b = brief || {};
  const vals = (arr) => (Array.isArray(arr) ? arr.map((x) => x && x.value).filter(Boolean) : []);
  const colors = vals(b.colorSources);
  const fonts = vals(b.fontSources);
  const sections = Array.isArray(b.sections) ? b.sections : [];
  const heroWord = b.heroLayout ? String(HERO_LAYOUT_TITLE[b.heroLayout] || "").toLowerCase() : "";
  return {
    paletteWord: colors.length ? colors.slice(0, 2).join(" and ") : "palette",
    fontWords: fonts.length ? fonts.slice(0, 2).join(" and ") : "your type",
    heroWord, // may be "" — token collapse handles the empty slot
    sectionsWord: sections.length ? "your sections" : "the page",
  };
}
function fillTokens(str, bits) {
  return String(str || "")
    .replace(/\{(\w+)\}/g, (_, k) => (bits && bits[k] != null ? bits[k] : ""))
    .replace(/ {2,}/g, " ")
    .trim();
}

const buildNarration = (() => {
  // Signals arrive in bursts and don't track wall-clock time, so we DON'T snap the display
  // straight to them. A ticker walks the SHOWN phase toward the signalled TARGET one step at
  // a time, holding each for a minimum dwell — jumps read as a smooth walk, nothing flashes,
  // and lines rotate slowly once settled. See docs/quiet-build-narration-spec.md.
  const TICK_MS = 300;         // ticker cadence
  const MIN_DWELL_MS = 2600;   // a step is held at least this long while catching up to target
  const ROTATE_MS = 22000;     // line rotation once settled on a phase (was 5000 — too quick)
  const FINISH_STEP_MS = 260;  // brisk walk through any remaining steps at the very end
  const FINISH_HOLD_MS = 500;  // a short "all done" beat before the reveal
  let phases = [];
  let target = -1;   // furthest phase reached from real signals
  let shown = -1;    // the phase currently on screen (walks toward target)
  let lineIdx = 0;
  let stepAt = 0;    // when `shown` last changed (Date.now)
  let lineAt = 0;    // when the line last changed
  let ticker = null;
  let bits = {};
  let reqSeq = 0;         // bumps each phase change; a late Haiku line for an old phase is dropped
  let haikuShown = false; // a bespoke line is up for this phase → pause the curated rotation
  let finishing = false;  // during the end flush we don't request new Haiku lines
  let noHaiku = false;    // begin({haiku:false}) → curated-only (the dev demo, token-free)
  let scale = 1;          // begin({scale}) → the dev demo scales ALL timing so fast mode stays faithful
  const now = () => Date.now();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const phaseDef = (id) => (COPY.build && COPY.build.phases && COPY.build.phases[id]) || null;

  // Phase 3: ask main for one live Art-Director sentence for this phase (default-on;
  // degrades silently to the curated line on disable/failure/timeout, or if it lands late).
  function requestNarration(phaseId) {
    if (noHaiku) return; // curated-only (dev demo) — no model call, no tokens
    const my = reqSeq;
    const def = phaseDef(phaseId);
    const title = def ? fillTokens(def.title, bits) : phaseId;
    if (!window.desktop || !window.desktop.narrateLine) return;
    window.desktop.narrateLine({ phase: phaseId, title, bits }).then((r) => {
      if (!r || !r.ok || !r.line) return;
      if (my !== reqSeq || !phases.length) return; // phase moved on / build ended
      haikuShown = true;
      phText.textContent = r.line;
    }).catch(() => {});
  }

  function renderSteps(allDone) {
    const box = el("ph-steps");
    if (!box) return;
    box.innerHTML = "";
    phases.forEach((_id, i) => {
      const cls = allDone ? "done" : i < shown ? "done" : i === shown ? "active" : "";
      const seg = document.createElement("span");
      seg.className = "seg" + (cls ? " " + cls : "");
      box.appendChild(seg);
    });
    box.hidden = phases.length === 0;
  }
  function showLine() {
    if (haikuShown) return; // a bespoke live line is up this phase — don't rotate over it
    const def = phaseDef(phases[shown]);
    if (!def || !def.lines || !def.lines.length) return;
    const pool = def.slowLine ? [...def.lines, def.slowLine] : def.lines;
    phText.textContent = fillTokens(pool[lineIdx % pool.length], bits);
  }
  // Render the currently-shown phase. Haiku is requested only once we've SETTLED on the
  // target (not for steps merely walked through), to avoid flashing lines + wasted calls.
  function renderPhase() {
    const def = phaseDef(phases[shown]);
    if (!def) return;
    reqSeq++;
    haikuShown = false;
    lineIdx = 0;
    lineAt = now();
    const label = el("ph-steplabel");
    if (label) { label.textContent = COPY.build.stepLabel(shown + 1, phases.length); label.hidden = false; }
    phTitle.textContent = fillTokens(def.title, bits);
    showLine();
    renderSteps(false);
    if (shown === target && !finishing) requestNarration(phases[shown]);
  }
  function tick() {
    const t = now();
    if (shown < target && (t - stepAt) >= MIN_DWELL_MS * scale) { shown++; stepAt = t; renderPhase(); return; }
    if (shown === target && !haikuShown && (t - lineAt) >= ROTATE_MS * scale) { lineIdx++; lineAt = t; showLine(); }
  }
  function stop() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    const box = el("ph-steps"); if (box) box.hidden = true;
    const label = el("ph-steplabel"); if (label) label.hidden = true;
    phases = []; target = shown = -1; finishing = false;
  }
  return {
    begin(phaseList, briefBitsObj, opts) {
      phases = phaseList && phaseList.length ? phaseList : ["understanding", "foundations", "sections", "polish"];
      bits = briefBitsObj || {};
      noHaiku = !!(opts && opts.haiku === false);
      scale = opts && opts.scale > 0 ? opts.scale : 1;
      target = 0; shown = 0; stepAt = now(); finishing = false;
      stopWorking();               // take over from the generic rotation
      renderPhase();
      if (ticker) clearInterval(ticker);
      ticker = setInterval(tick, TICK_MS);
    },
    // Signals only bump the TARGET; the ticker walks the display toward it (never backward).
    advanceTo(id) { const to = phases.indexOf(id); if (to > target) target = to; },
    advancePast(id) { const at = phases.indexOf(id); if (at >= 0 && at + 1 < phases.length && at + 1 > target) target = at + 1; },
    // Build finished: walk briskly through any remaining steps, fill every segment, hold a
    // short beat, then clear — so the final phase actually registers before the reveal
    // (fixes "step 7 feels non-existent"). Bounded, so the reveal never drags.
    async finish() {
      if (ticker) { clearInterval(ticker); ticker = null; }
      if (!phases.length) return;
      finishing = true;
      target = phases.length - 1;
      while (shown < target) { shown++; renderPhase(); await wait(FINISH_STEP_MS * scale); }
      renderSteps(true);           // every segment filled
      await wait(FINISH_HOLD_MS * scale);
      stop();
    },
    end() { stop(); },
    isActive() { return phases.length > 0; },
  };
})();

const PREPARING_MESSAGES = COPY.preview.preparingMessages;
function showPreparing() {
  resetIntake(); // leave the intake host; the preview placeholder takes the pane
  browser.hidden = true;
  previewph.hidden = false;
  setPhEmoji("✨");
  phTitle.textContent = COPY.preview.preparingElements;
  phProgress.hidden = true; // the segmented step spine replaces the wide bounce bar
  stopWorking(); // clear any stale rotation so ours (build-flavored) takes over
  // Quiet build: the Art-Director spine owns the pane text (begin() is called right after
  // in startDesigning). Otherwise fall back to the generic rotation.
  if (!buildNarration.isActive()) startWorking(PREPARING_MESSAGES);
  // The mid-turn readiness poll (in the "tool" handler) reveals the Style guide the
  // moment previewReady flips, keeping the Home tab covered until the build ends.
  resetBuildReveal();
}

// ---- Dev-only: narration pacing harness (NOT shipped) ------------------------
// The pacing tuner lives in desktop/dev/narration-harness.js — git-tracked for future
// reference, excluded from the packaged bundle (package.json build.files), and loaded ONLY
// when running unpackaged (preload's synchronous `dev` flag, set from main's --ta-dev arg).
// Here we just expose the internals the harness drives, then inject its script.
if (window.desktop && window.desktop.dev) {
  window.__taNarration = { buildNarration, computePhaseList, briefBits, showPreparing };
  const s = document.createElement("script");
  s.src = "dev/narration-harness.js"; // relative to shell.html (desktop/)
  document.head.appendChild(s);
}

// Dispatch to the per-type renderer. Every builder returns
// ---- Hero-layout picker (client-rendered, single-select wireframe chips) ------
// Shown after sections, only when Hero is among them (heroStepApplicable). Each chip
// is a black-bordered tile: an inline SVG wireframe + a title beneath. The value is
// the layout id → Brief.heroLayout → an explicit hero instruction in the design
// prompt. Keep the ids in sync with HERO_LAYOUT_PHRASES in main.cjs. First of a
// planned per-section "page flow"; the chip vocabulary here is meant to extend.
const HERO_LAYOUTS = [
  { id: "centered", title: "Centered", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="34" y="22" width="52" height="8" rx="2" fill="#111"/>' +
    '<rect x="40" y="36" width="40" height="5" rx="2" fill="#c7c7d0"/>' +
    '<rect x="44" y="45" width="32" height="5" rx="2" fill="#c7c7d0"/>' +
    '<rect x="40" y="56" width="18" height="9" rx="2" fill="#111"/>' +
    '<rect x="62" y="56" width="18" height="9" rx="2" fill="none" stroke="#111" stroke-width="1.5"/>' +
    '</svg>' },
  { id: "split", title: "Split", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="12" y="24" width="38" height="8" rx="2" fill="#111"/>' +
    '<rect x="12" y="38" width="32" height="5" rx="2" fill="#c7c7d0"/>' +
    '<rect x="12" y="47" width="28" height="5" rx="2" fill="#c7c7d0"/>' +
    '<rect x="12" y="58" width="20" height="9" rx="2" fill="#111"/>' +
    '<rect x="64" y="18" width="44" height="48" rx="3" fill="#ececf1"/>' +
    '</svg>' },
  { id: "full-screen", title: "Full Screen", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="6" y="8" width="108" height="68" rx="3" fill="#ececf1"/>' +
    '<rect x="40" y="30" width="40" height="8" rx="2" fill="#111"/>' +
    '<rect x="46" y="44" width="28" height="5" rx="2" fill="#8a8a94"/>' +
    '<rect x="48" y="55" width="24" height="9" rx="2" fill="#111"/>' +
    '</svg>' },
  { id: "minimal", title: "Type-led", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="12" y="26" width="70" height="11" rx="2" fill="#111"/>' +
    '<rect x="12" y="42" width="54" height="11" rx="2" fill="#111"/>' +
    '<rect x="12" y="61" width="30" height="5" rx="2" fill="#c7c7d0"/>' +
    '</svg>' },
  { id: "showcase", title: "Showcase", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="42" y="12" width="36" height="7" rx="2" fill="#111"/>' +
    '<rect x="48" y="23" width="24" height="4" rx="2" fill="#c7c7d0"/>' +
    '<rect x="20" y="34" width="80" height="40" rx="3" fill="#ececf1"/>' +
    '</svg>' },
];
const HERO_LAYOUT_TITLE = Object.fromEntries(HERO_LAYOUTS.map((h) => [h.id, h.title]));

function buildHeroLayout(card, body, onChange) {
  let selected = null;
  const tiles = [];
  const grid = document.createElement("div");
  grid.className = "ihero";
  HERO_LAYOUTS.forEach((h) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "ihero-chip";
    tile.dataset.id = h.id;
    const art = document.createElement("span");
    art.className = "ihero-art";
    art.innerHTML = h.svg;
    const cap = document.createElement("span");
    cap.className = "ihero-cap";
    cap.textContent = h.title;
    tile.append(art, cap);
    tile.addEventListener("click", () => {
      if (tile.disabled) return;
      selected = h.id;
      tiles.forEach((t) => t.classList.toggle("selected", t.dataset.id === selected));
      onChange();
    });
    tiles.push(tile);
    grid.appendChild(tile);
  });
  body.appendChild(grid);
  return {
    getValue: () => selected,
    hasValue: () => selected != null,
    setDisabled: (d) => tiles.forEach((t) => { t.disabled = d; }),
    display: () => (selected ? (HERO_LAYOUT_TITLE[selected] || selected) : ""),
  };
}

// ---- Header / navigation picker (client-rendered, grouped wireframe chips) -----
// Shown just before the hero step, for website projects. Three menu TYPES (simple /
// dropdown / mega), each with the same three logo/link placements, drawn as small
// header wireframes in the same chip style as the hero picker. Single-select across
// all nine; the value is a MENU_LAYOUTS id → Brief.menuLayout → an explicit header
// instruction in the design prompt. Keep ids in sync with MENU_LAYOUT_PHRASES (main.cjs).
const MENU_GROUPS = [
  { type: "simple", label: "Simple menu", panel: null, options: [
    { id: "simple-left-right", logo: "left", links: "right", title: "Logo left, links right" },
    { id: "simple-left-center", logo: "left", links: "center", title: "Logo left, links center" },
    { id: "simple-center-split", logo: "center", links: "split", title: "Logo center, links sides" },
  ] },
  { type: "dropdown", label: "Dropdown menu", panel: "dropdown", options: [
    { id: "dropdown-left-right", logo: "left", links: "right", title: "Logo left, links right" },
    { id: "dropdown-left-center", logo: "left", links: "center", title: "Logo left, links center" },
    { id: "dropdown-center-split", logo: "center", links: "split", title: "Logo center, links sides" },
  ] },
  { type: "mega", label: "Mega menu", panel: "mega", options: [
    { id: "mega-left-right", logo: "left", links: "right", title: "Logo left, links right" },
    { id: "mega-left-center", logo: "left", links: "center", title: "Logo left, links center" },
    { id: "mega-center-split", logo: "center", links: "split", title: "Logo center, links sides" },
  ] },
];
const MENU_LAYOUT_TITLE = Object.fromEntries(
  MENU_GROUPS.flatMap((g) => g.options.map((o) => [o.id, `${g.label}, ${o.title.toLowerCase()}`])),
);

// Compose a small header wireframe: a header band with a logo mark + link bars placed
// per (logo/links), plus a dropdown or mega panel hint below for those types.
function menuChipSvg(logo, links, panel) {
  const bar = (x) => `<rect x="${x}" y="19" width="12" height="4" rx="2" fill="#111"/>`;
  let s = '<svg viewBox="0 0 120 84" aria-hidden="true">';
  s += '<rect x="8" y="12" width="104" height="18" rx="3" fill="#ececf1"/>'; // header band
  s += `<rect x="${logo === "center" ? 55 : 14}" y="16.5" width="10" height="9" rx="1.5" fill="#111"/>`; // logo
  if (logo === "center") s += bar(16) + bar(32) + bar(74) + bar(90);        // split both sides
  else if (links === "right") s += bar(66) + bar(82) + bar(98);
  else s += bar(44) + bar(60) + bar(76);                                     // center
  if (panel === "dropdown") {
    const px = logo === "center" ? 74 : links === "center" ? 58 : 82;
    s += `<rect x="${px}" y="34" width="28" height="20" rx="2" fill="#fff" stroke="#111" stroke-width="1"/>`;
    s += `<rect x="${px + 5}" y="39" width="18" height="3" rx="1.5" fill="#c7c7d0"/>`;
    s += `<rect x="${px + 5}" y="46" width="14" height="3" rx="1.5" fill="#c7c7d0"/>`;
  } else if (panel === "mega") {
    s += '<rect x="8" y="34" width="104" height="34" rx="2" fill="#fff" stroke="#111" stroke-width="1"/>';
    for (let cx = 16; cx <= 94; cx += 26) {
      s += `<rect x="${cx}" y="40" width="16" height="3" rx="1.5" fill="#111"/>`;
      s += `<rect x="${cx}" y="47" width="14" height="2.5" rx="1.25" fill="#c7c7d0"/>`;
      s += `<rect x="${cx}" y="53" width="14" height="2.5" rx="1.25" fill="#c7c7d0"/>`;
      s += `<rect x="${cx}" y="59" width="10" height="2.5" rx="1.25" fill="#c7c7d0"/>`;
    }
  }
  return s + "</svg>";
}

function buildMenuLayout(card, body, onChange) {
  let selected = null;
  const tiles = [];
  MENU_GROUPS.forEach((group) => {
    const gl = document.createElement("div");
    gl.className = "imenu-group-label";
    gl.textContent = group.label;
    body.appendChild(gl);
    const grid = document.createElement("div");
    grid.className = "ihero imenu-grid";
    group.options.forEach((opt) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "ihero-chip";
      tile.dataset.id = opt.id;
      const art = document.createElement("span");
      art.className = "ihero-art";
      art.innerHTML = menuChipSvg(opt.logo, opt.links, group.panel);
      const cap = document.createElement("span");
      cap.className = "ihero-cap";
      cap.textContent = opt.title;
      tile.append(art, cap);
      tile.addEventListener("click", () => {
        if (tile.disabled) return;
        selected = opt.id;
        tiles.forEach((t) => t.classList.toggle("selected", t.dataset.id === selected));
        onChange();
      });
      tiles.push(tile);
      grid.appendChild(tile);
    });
    body.appendChild(grid);
  });
  return {
    getValue: () => selected,
    hasValue: () => selected != null,
    setDisabled: (d) => tiles.forEach((t) => { t.disabled = d; }),
    display: () => (selected ? (MENU_LAYOUT_TITLE[selected] || selected) : ""),
  };
}

// ---- Contact / CTA type picker (client-rendered, single-select wireframe chips) --
// Shown after the hero step, only when Contact or CTA is among the chosen sections
// (ctaStepApplicable). Two chips — a contact Form vs a button-led Contact CTA — drawn
// in the same chip style as the hero picker. The value is a CTA_TYPES id → Brief.ctaType
// → an explicit build instruction in the design prompt. Keep the ids in sync with
// CTA_TYPE_PHRASES in main.cjs.
const CTA_TYPES = [
  { id: "cta-form", title: "Contact form", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="30" y="12" width="60" height="6" rx="2" fill="#111"/>' +
    '<rect x="22" y="26" width="76" height="9" rx="2" fill="none" stroke="#c7c7d0" stroke-width="1.5"/>' +
    '<rect x="22" y="39" width="76" height="9" rx="2" fill="none" stroke="#c7c7d0" stroke-width="1.5"/>' +
    '<rect x="22" y="52" width="76" height="14" rx="2" fill="none" stroke="#c7c7d0" stroke-width="1.5"/>' +
    '<rect x="22" y="70" width="26" height="8" rx="2" fill="#111"/>' +
    '</svg>' },
  { id: "cta-button", title: "Contact button", svg:
    '<svg viewBox="0 0 120 84" aria-hidden="true">' +
    '<rect x="30" y="18" width="60" height="8" rx="2" fill="#111"/>' +
    '<rect x="38" y="31" width="44" height="5" rx="2" fill="#c7c7d0"/>' +
    '<rect x="42" y="44" width="36" height="12" rx="3" fill="#111"/>' +
    '<rect x="44" y="63" width="32" height="4" rx="2" fill="#c7c7d0"/>' +
    '<rect x="48" y="71" width="24" height="4" rx="2" fill="#c7c7d0"/>' +
    '</svg>' },
];
const CTA_TYPE_TITLE = Object.fromEntries(CTA_TYPES.map((c) => [c.id, c.title]));

function buildCtaType(card, body, onChange) {
  let selected = null;
  const tiles = [];
  const grid = document.createElement("div");
  grid.className = "ihero";
  CTA_TYPES.forEach((c) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "ihero-chip";
    tile.dataset.id = c.id;
    const art = document.createElement("span");
    art.className = "ihero-art";
    art.innerHTML = c.svg;
    const cap = document.createElement("span");
    cap.className = "ihero-cap";
    cap.textContent = c.title;
    tile.append(art, cap);
    tile.addEventListener("click", () => {
      if (tile.disabled) return;
      selected = c.id;
      tiles.forEach((t) => t.classList.toggle("selected", t.dataset.id === selected));
      onChange();
    });
    tiles.push(tile);
    grid.appendChild(tile);
  });
  body.appendChild(grid);
  return {
    getValue: () => selected,
    hasValue: () => selected != null,
    setDisabled: (d) => tiles.forEach((t) => { t.disabled = d; }),
    display: () => (selected ? (CTA_TYPE_TITLE[selected] || selected) : ""),
  };
}

// { getValue, hasValue, setDisabled, display }; renderIntakeCard wraps it in the
// card shell, adds the optional skip affordance, and exposes collapse() — which,
// on submit, swaps the live inputs for a clean read-only value so no disabled
// field lingers (feedback #2).
function renderIntakeCard(card, onChange, requestSubmit) {
  const elc = document.createElement("div");
  elc.className = "icard";

  const label = document.createElement("div");
  label.className = "icard-label";
  label.textContent = card.label || "";
  elc.appendChild(label);
  if (card.help) {
    const help = document.createElement("div");
    help.className = "icard-help";
    help.textContent = card.help;
    elc.appendChild(help);
  }
  const body = document.createElement("div");
  body.className = "icard-body";
  elc.appendChild(body);

  let skipped = false;
  const skippable = card.skippable === true;
  const built =
    card.type === "open-text" ? buildOpenText(card, body, onChange, requestSubmit)
    : card.type === "single-choice" ? buildChoice(card, body, false, onChange)
    : card.type === "multi-choice" ? buildChoice(card, body, true, onChange)
    : card.type === "chips" ? buildChips(card, body, onChange)
    : card.type === "reference" ? buildReference(card, body, onChange)
    : card.type === "color-swatch" ? buildColorSwatch(card, body, onChange)
    : card.type === "font-pick" ? buildFontPick(card, body, onChange)
    : card.type === "hero-layout" ? buildHeroLayout(card, body, onChange)
    : card.type === "menu-layout" ? buildMenuLayout(card, body, onChange)
    : card.type === "cta-type" ? buildCtaType(card, body, onChange)
    : card.type === "logo" ? buildLogoUpload(card, body, onChange)
    : card.type === "voice" ? buildVoiceRules(card, body, onChange)
    : buildOpenText(card, body, onChange); // defensive fallback

  // Skippable cards get a "let you decide" affordance that records null.
  let skipBtn = null;
  if (skippable) {
    skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "icard-skip";
    const skipLabel = card.agentDecidesLabel || COPY.intake.letYouChoose;
    skipBtn.textContent = skipLabel;
    skipBtn.addEventListener("click", () => {
      skipped = !skipped;
      elc.classList.toggle("skipped", skipped);
      built.setDisabled(skipped);
      skipBtn.textContent = skipped ? COPY.intake.undoSkip : skipLabel;
      skipBtn.classList.toggle("undo", skipped);
      onChange();
      // "You decide" / "Skip" should advance on its own — no extra Continue click.
      if (skipped && requestSubmit) requestSubmit();
    });
    elc.appendChild(skipBtn);
  }

  // Post-submit: show a read-only summary of the answer BUT keep the live inputs in
  // the DOM (hidden), so the card can be re-opened and edited later without re-seeding
  // every control type. expand() reverses it. (See makeCardsEditable / click-to-edit.)
  let answerEl = null;
  const paintAnswer = () => {
    const text = skipped ? "" : built.display();
    if (!answerEl) { answerEl = document.createElement("div"); answerEl.className = "icard-answer"; elc.appendChild(answerEl); }
    answerEl.classList.toggle("empty", !text);
    answerEl.textContent = text || COPY.intake.skipped;
  };
  return {
    el: elc,
    card, // the card meta (id/field/type) — used by the edit path to re-persist
    getValue: () => (skipped ? null : built.getValue()),
    // A card is ready only when it has a value OR was explicitly skipped (the Skip
    // button). Skippable no longer means ready-by-default, so Continue / Enter can
    // never pass a question the designer hasn't answered or skipped on purpose.
    isReady: () => skipped || built.hasValue(),
    collapse: () => {
      paintAnswer();
      elc.classList.add("collapsed");
      body.style.display = "none";
      if (skipBtn) skipBtn.style.display = "none";
      answerEl.style.display = "";
    },
    expand: () => {
      elc.classList.remove("collapsed");
      body.style.display = "";
      if (skipBtn) skipBtn.style.display = "";
      if (answerEl) answerEl.style.display = "none";
    },
  };
}

// open-text → single line, or a textarea when `long`. Optional maxLength counter.
function buildOpenText(card, body, onChange, requestSubmit) {
  const long = card.long === true;
  const field = document.createElement(long ? "textarea" : "input");
  field.className = long ? "icard-textarea" : "icard-input";
  if (card.placeholder) field.placeholder = card.placeholder;
  if (card.value != null) field.value = card.value; // pre-fill (e.g. brand name gleaned from Figma)
  // Enter advances (Continue with no extra click), on both a single line and a
  // textarea; Shift+Enter inserts a newline in the textarea (chat-input convention).
  field.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (requestSubmit) requestSubmit();
  });
  if (card.maxLength) field.maxLength = card.maxLength;
  body.appendChild(field);

  if (card.maxLength) {
    const counter = document.createElement("div");
    counter.className = "icard-counter";
    body.appendChild(counter);
    const paint = () => {
      counter.textContent = `${field.value.length} / ${card.maxLength}`;
      counter.classList.toggle("over", field.value.length >= card.maxLength);
    };
    paint();
    field.addEventListener("input", paint);
  }
  field.addEventListener("input", onChange);

  return {
    getValue: () => field.value.trim() || null,
    hasValue: () => field.value.trim().length > 0,
    setDisabled: (d) => { field.disabled = d; },
    display: () => field.value.trim(),
  };
}

// The house checkmark: a thin, straight-line 1px-stroke tick (matches the rail /
// drawer line icons), used for a selected choice/chip instead of a heavy glyph.
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// single-choice / multi-choice → bordered rows with a check/radio.
function buildChoice(card, body, multi, onChange) {
  const selected = new Set();
  const rows = [];
  (card.options || []).forEach((opt) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "iopt" + (multi ? "" : " radio");
    const check = document.createElement("span");
    check.className = "iopt-check";
    const lbl = document.createElement("span");
    lbl.className = "iopt-label";
    lbl.textContent = opt;
    row.append(check, lbl);
    row.addEventListener("click", () => {
      if (row.disabled) return;
      if (multi) {
        if (selected.has(opt)) selected.delete(opt);
        else selected.add(opt);
      } else {
        selected.clear();
        selected.add(opt);
        rows.forEach((r) => r.classList.remove("selected"));
      }
      row.classList.toggle("selected", selected.has(opt));
      if (multi) check.innerHTML = selected.has(opt) ? CHECK_SVG : "";
      else rows.forEach((r) => { r.querySelector(".iopt-check").innerHTML = r.classList.contains("selected") ? CHECK_SVG : ""; });
      onChange();
    });
    rows.push(row);
    body.appendChild(row);
  });
  return {
    getValue: () => {
      if (!selected.size) return null;
      return multi ? [...selected] : [...selected][0];
    },
    hasValue: () => selected.size > 0,
    setDisabled: (d) => rows.forEach((r) => { r.disabled = d; }),
    display: () => [...selected].join(", "),
  };
}

// chips → compact pill multi-select (returns string[]).
function buildChips(card, body, onChange) {
  const selected = new Set();
  const chips = [];
  const wrap = document.createElement("div");
  wrap.className = "ichips";
  (card.options || []).forEach((opt) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ichip";
    chip.textContent = opt;
    chip.addEventListener("click", () => {
      if (chip.disabled) return;
      if (selected.has(opt)) selected.delete(opt);
      else selected.add(opt);
      chip.classList.toggle("selected", selected.has(opt));
      onChange();
    });
    chips.push(chip);
    wrap.appendChild(chip);
  });
  body.appendChild(wrap);
  return {
    getValue: () => (selected.size ? [...selected] : null),
    hasValue: () => selected.size > 0,
    setDisabled: (d) => chips.forEach((c) => { c.disabled = d; }),
    display: () => [...selected].join(", "),
  };
}

// reference → up to 3 { url, why } pairs (feedback #4). The WHY is the taste we
// capture (not a clone of the source). getValue() → a SourceRef[] { url, reason }.
function buildReference(card, body, onChange) {
  const MAX = 3;
  const entries = []; // { row, url, why }

  const list = document.createElement("div");
  list.className = "iref-list";
  body.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "iref-add";
  addBtn.textContent = COPY.intake.addAnotherSite;

  function updateAddBtn() { addBtn.hidden = entries.length >= MAX; }

  function addEntry() {
    if (entries.length >= MAX) return;
    const row = document.createElement("div");
    row.className = "iref-entry";
    const mk = (cap, placeholder, isWhy) => {
      const f = document.createElement("div");
      f.className = "iref-field";
      const c = document.createElement("div");
      c.className = "iref-cap";
      c.textContent = cap;
      const inp = document.createElement(isWhy ? "textarea" : "input");
      inp.className = isWhy ? "icard-textarea" : "icard-input";
      if (isWhy) inp.style.minHeight = "58px";
      if (placeholder) inp.placeholder = placeholder;
      if (card.maxLength && isWhy) inp.maxLength = card.maxLength;
      inp.addEventListener("input", onChange);
      f.append(c, inp);
      row.appendChild(f);
      return inp;
    };
    const url = mk(COPY.intake.refLinkCap, card.placeholder || COPY.intake.refUrlPlaceholder, false);
    const why = mk(COPY.intake.refWhyCap, COPY.intake.refWhyPlaceholder, true);
    // Entries past the first get a Remove control.
    if (entries.length >= 1) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "iref-remove";
      rm.textContent = COPY.intake.refRemove;
      rm.addEventListener("click", () => {
        const i = entries.findIndex((e) => e.row === row);
        if (i >= 0) entries.splice(i, 1);
        row.remove();
        updateAddBtn();
        onChange();
      });
      row.appendChild(rm);
    }
    entries.push({ row, url, why });
    list.appendChild(row);
    updateAddBtn();
  }

  const collect = () =>
    entries
      .map((e) => ({ url: e.url.value.trim(), reason: e.why.value.trim() || null }))
      .filter((e) => e.url);

  addEntry(); // one to start
  addBtn.addEventListener("click", () => { addEntry(); onChange(); });
  body.appendChild(addBtn);

  return {
    getValue: () => { const v = collect(); return v.length ? v : null; },
    hasValue: () => collect().length > 0,
    setDisabled: (d) => {
      entries.forEach((e) => { e.url.disabled = d; e.why.disabled = d; });
      addBtn.disabled = d;
      list.querySelectorAll(".iref-remove").forEach((b) => { b.disabled = d; });
    },
    display: () => collect().map((e) => e.url + (e.reason ? ` (${e.reason})` : "")).join("; "),
  };
}

// color-swatch → pick one primary color: a few on-brief swatches (options = hex)
// PLUS a true color picker for any color the designer wants.
function buildColorSwatch(card, body, onChange) {
  let selected = null;
  const swatches = [];
  const wrap = document.createElement("div");
  wrap.className = "iswatches";

  const clearSelected = () => {
    swatches.forEach((s) => s.classList.remove("selected"));
    customEl.classList.remove("selected");
  };

  // Seed the swatches with the exact colors pulled from the uploaded references
  // (the ingest palette), then the card's own options, deduped. So "Pick a
  // primary color" offers the on-brief colors first, plus the picker below.
  const refPalette = (lastDigest && lastDigest.palette) || [];
  const seen = new Set();
  const options = [...refPalette, ...(card.options || [])].filter((hex) => {
    const k = String(hex).toLowerCase();
    if (!/^#[0-9a-f]{3,8}$/.test(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  options.forEach((hex) => {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "iswatch";
    sw.style.background = hex;
    sw.title = hex;
    sw.setAttribute("aria-label", hex);
    sw.addEventListener("click", () => {
      if (sw.disabled) return;
      const off = selected === hex;
      selected = off ? null : hex;
      clearSelected();
      if (!off) sw.classList.add("selected");
      onChange();
    });
    swatches.push(sw);
    wrap.appendChild(sw);
  });

  // True color picker (native): a rainbow "custom" swatch wrapping <input type=color>.
  const customEl = document.createElement("label");
  customEl.className = "iswatch iswatch-custom";
  customEl.title = COPY.intake.customColor;
  const picker = document.createElement("input");
  picker.type = "color";
  picker.className = "iswatch-input";
  picker.value = options[0] || "#888888";
  picker.addEventListener("input", () => {
    selected = picker.value;
    clearSelected();
    customEl.classList.add("selected", "has-color");
    customEl.style.background = selected;
    onChange();
  });
  customEl.appendChild(picker);
  wrap.appendChild(customEl);

  body.appendChild(wrap);
  return {
    getValue: () => selected,
    hasValue: () => !!selected,
    setDisabled: (d) => { swatches.forEach((s) => { s.disabled = d; }); picker.disabled = d; },
    display: () => selected || "",
  };
}

// font-pick → pick one font, shown in its actual typeface (options = Google Font
// family names). Loads the fonts for preview; falls back to the name if a load fails.
function buildFontPick(card, body, onChange) {
  let selected = null;
  const options = []; // { name, btn }
  const wrap = document.createElement("div");
  wrap.className = "ifonts";
  body.appendChild(wrap);

  const refreshSelected = () => options.forEach((o) => o.btn.classList.toggle("selected", o.name === selected));
  function select(name) { selected = selected === name ? null : name; refreshSelected(); onChange(); }

  // Add a font as a selectable option previewed in its own face. Deduped by name
  // (case-insensitive). `pick` selects it (used when the designer types a custom one).
  function addOption(name, { pick = false } = {}) {
    const exists = options.find((o) => o.name.toLowerCase() === name.toLowerCase());
    if (exists) { if (pick) { selected = exists.name; refreshSelected(); onChange(); } return; }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ifont";
    btn.style.fontFamily = `'${name}', system-ui, sans-serif`;
    const big = document.createElement("span");
    big.className = "ifont-preview";
    big.textContent = "Ag";
    const lbl = document.createElement("span");
    lbl.className = "ifont-name";
    lbl.textContent = name;
    btn.append(big, lbl);
    btn.addEventListener("click", () => { if (!btn.disabled) select(name); });
    options.push({ name, btn });
    wrap.appendChild(btn);
    if (pick) { selected = name; refreshSelected(); onChange(); }
  }

  const initial = (card.options || []).filter(Boolean);
  loadGoogleFonts(initial);
  initial.forEach((name) => addOption(name));
  // Pre-fill (e.g. the company drawer's Update form) — add + select the saved font, even if
  // it's not one of the presets. addOption dedupes, so a preset value just gets selected.
  if (card.value) { loadGoogleFonts([card.value]); addOption(card.value, { pick: true }); }

  // Custom entry: type any font family, load it from Google Fonts, add it as a picked
  // option previewed in its own face. If the name is not a real Google font the link
  // just no-ops and the preview falls back to system-ui (a visible "not found" signal).
  const custom = document.createElement("div");
  custom.className = "ifont-custom";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "icard-input";
  input.placeholder = COPY.intake.fontCustomPlaceholder;
  const add = document.createElement("button");
  add.type = "button";
  add.className = "ifont-add";
  add.textContent = COPY.intake.fontCustomAdd;
  function tryAdd() {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    loadGoogleFonts([name]);
    addOption(name, { pick: true });
    input.value = "";
  }
  add.addEventListener("click", tryAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); tryAdd(); } });
  custom.append(input, add);
  body.appendChild(custom);

  // Optional (company profile): upload a custom font FILE (a self-hosted brand font not on
  // Google). Gated on card.allowUpload so the design-intake picker is unchanged. Uploaded
  // fonts are tracked by family; getUpload() returns the file for the selected one so the
  // profile can embed it as @font-face.
  const uploads = new Map(); // family → { filename, mime, b64, family }
  let upBtn = null;
  const faceName = (filename) =>
    String(filename).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")
      .replace(/\b(regular|bold|italic|light|medium|semibold|thin|black|book|roman|variable|vf)\b/gi, "")
      .replace(/\s+/g, " ").trim() || "Custom Font";
  if (card.allowUpload) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".woff2,.woff,.ttf,.otf";
    fileInput.style.display = "none";
    upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "ifont-upload"; // full-width row, under the font list
    upBtn.textContent = COPY.intake.fontUpload;
    upBtn.addEventListener("click", () => { if (!upBtn.disabled) fileInput.click(); });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const b64 = dataUrl.split(",")[1] || "";
        if (!b64) return;
        const filename = (file.name || "font").replace(/[^\w.-]+/g, "-");
        let family = faceName(filename);
        while (uploads.has(family) && uploads.get(family).filename !== filename) family += " 2";
        uploads.set(family, { filename, mime: file.type || "", b64, family });
        // Inject an @font-face so the option previews + renders in the uploaded face.
        const style = document.createElement("style");
        style.textContent = `@font-face{font-family:'${family}';src:url('${dataUrl}');font-display:swap;}`;
        document.head.appendChild(style);
        addOption(family, { pick: true });
        fileInput.value = "";
      };
      reader.readAsDataURL(file);
    });
    // Under the selectable fonts, above the "or type" row — so the text input gets a full row.
    body.insertBefore(upBtn, custom);
    body.appendChild(fileInput); // hidden; position irrelevant
  }

  return {
    getValue: () => selected,
    // The uploaded file for the selected family (self-hosted), or null (a Google name / none).
    getUpload: () => (selected && uploads.has(selected) ? uploads.get(selected) : null),
    hasValue: () => !!selected,
    setDisabled: (d) => { options.forEach((o) => { o.btn.disabled = d; }); input.disabled = d; add.disabled = d; if (upBtn) upBtn.disabled = d; },
    display: () => selected || "",
  };
}

// Logo upload — a drop/click zone that reads an image file to base64. Used only by
// the local company form (renderCompanyForm), not an agent-sent card. getValue →
// { filename, mime, b64 } | null, matching the buildCompanyProfile logo shape.
function buildLogoUpload(card, body, onChange) {
  let value = null;
  let disabled = false;
  const zone = document.createElement("label");
  zone.style.cssText =
    "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;" +
    "min-height:92px;padding:16px;border:1.5px dashed rgba(0,0,0,0.22);border-radius:10px;" +
    "cursor:pointer;text-align:center;transition:border-color .15s ease,background .15s ease;";
  const preview = document.createElement("img");
  preview.style.cssText = "max-height:56px;max-width:180px;object-fit:contain;display:none;";
  const hint = document.createElement("div");
  hint.style.cssText = "font-size:13px;color:#777;";
  hint.textContent = card.placeholder || COPY.intake.logoDropDefault;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/avif,image/svg+xml";
  input.style.display = "none";
  zone.append(preview, hint, input);
  body.appendChild(zone);

  function read(file) {
    if (!file || disabled || !/^image\//.test(file.type || "")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const b64 = dataUrl.split(",")[1] || "";
      if (!b64) return;
      value = { filename: (file.name || "logo").replace(/[^\w.-]+/g, "-"), mime: file.type, b64 };
      preview.src = dataUrl;
      preview.style.display = "block";
      hint.textContent = value.filename;
      onChange();
    };
    reader.readAsDataURL(file);
  }
  input.addEventListener("change", () => read(input.files && input.files[0]));
  zone.addEventListener("dragover", (e) => { e.preventDefault(); if (!disabled) zone.style.borderColor = "#111"; });
  zone.addEventListener("dragleave", () => { zone.style.borderColor = "rgba(0,0,0,0.22)"; });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.style.borderColor = "rgba(0,0,0,0.22)";
    read(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  return {
    getValue: () => value,
    hasValue: () => !!value,
    setDisabled: (d) => { disabled = d; zone.style.opacity = d ? "0.5" : "1"; zone.style.pointerEvents = d ? "none" : "auto"; },
    display: () => (value ? value.filename : ""),
  };
}

// voice → the desired TONE (default tones as pills + a custom field) followed by
// copy RULES (suggestion pills you toggle + a custom field). Any GLOBAL rules are
// shown read-only as "applied" (only when present) — not editable here. Everything
// persists to the project voice (tone + rules), auto-handed to the agent; tone also
// folds into the Brief via the card field.
function buildVoiceRules(card, body, onChange) {
  const v = lastVoice || { project: {}, global: [] };
  const globals = (v.global || []).filter(Boolean);
  const proj = v.project || {};
  const isGlobal = (r) => globals.some((g) => g.toLowerCase() === r.toLowerCase());
  // Reconcile the loaded project voice into (a) the project's OWN rules (globals
  // stripped out) and (b) which globals are selected. Globals are on by default; a
  // project that previously opted out (declineGlobal) keeps the globals it copied
  // into its own rule list, so those read back as still-selected.
  const projRulesRaw = (proj.rules || []).filter(Boolean);
  const projRules = projRulesRaw.filter((r) => !isGlobal(r));
  const globalSel = new Set(
    proj.declineGlobal
      ? globals.filter((g) => projRulesRaw.some((r) => r.toLowerCase() === g.toLowerCase()))
      : globals,
  );

  // All globals on → keep the app-level merge (declineGlobal false, own rules only).
  // Any global unselected → this project opts OUT of the global set (declineGlobal,
  // which the drawer's "Ignore global rules" checkbox reflects); the kept globals are
  // copied into the project's own rules so they still apply.
  const persist = () => {
    const allOn = globals.every((g) => globalSel.has(g));
    const declineGlobal = globals.length > 0 && !allOn;
    const rules = declineGlobal
      ? [...globals.filter((g) => globalSel.has(g)), ...projRules]
      : projRules.slice();
    try { window.desktop.saveProjectVoice({ ...proj, tone: toneInput.value.trim(), rules, declineGlobal }); } catch {}
  };

  // ── Tone: default tones as pills + a custom field (the card label asks the tone) ──
  const toneWrap = document.createElement("div"); toneWrap.className = "ichips"; toneWrap.style.marginBottom = "8px";
  const toneInput = document.createElement("input");
  toneInput.className = "icard-input";
  toneInput.placeholder = card.placeholder || COPY.voice.tonePlaceholder;
  toneInput.value = proj.tone || "";
  const tonePills = [];
  const syncTone = () => {
    const cur = toneInput.value.trim().toLowerCase();
    tonePills.forEach(([p, ex]) => p.classList.toggle("selected", ex.toLowerCase() === cur));
  };
  TONE_EXAMPLES.forEach((ex) => {
    const p = document.createElement("button"); p.type = "button"; p.className = "ichip"; p.textContent = ex;
    p.addEventListener("click", () => {
      toneInput.value = (toneInput.value.trim().toLowerCase() === ex.toLowerCase()) ? "" : ex; // toggle
      persist(); syncTone(); onChange();
    });
    tonePills.push([p, ex]); toneWrap.appendChild(p);
  });
  toneInput.addEventListener("input", () => { persist(); syncTone(); onChange(); });
  body.append(toneWrap, toneInput);

  // ── Rules for this design ──
  const rLabel = voiceHeader(COPY.voice.projectRulesLabel); rLabel.style.marginTop = "18px";
  body.appendChild(rLabel);

  // Global rules — pre-selected, toggleable pills (only shown when one or more is set).
  // Unselecting any flips this project to "ignore global rules" (persist() sets the
  // declineGlobal flag + copies the kept globals into the project's own rules).
  if (globals.length) {
    const note = document.createElement("div"); note.className = "voice-applied-note";
    note.textContent = COPY.voice.globalsApplied;
    const gw = document.createElement("div"); gw.className = "ichips"; gw.style.marginBottom = "12px";
    globals.forEach((g) => {
      const p = document.createElement("button"); p.type = "button"; p.className = "ichip global"; p.textContent = g;
      p.classList.toggle("selected", globalSel.has(g));
      p.addEventListener("click", () => {
        if (globalSel.has(g)) globalSel.delete(g); else globalSel.add(g);
        p.classList.toggle("selected", globalSel.has(g));
        persist(); onChange();
      });
      gw.appendChild(p);
    });
    body.append(note, gw);
  }

  // Rule suggestion pills (toggle into this design's rules) + a custom field.
  const rWrap = document.createElement("div"); rWrap.className = "ichips"; rWrap.style.marginBottom = "8px";
  const has = (ex) => projRules.some((r) => r.toLowerCase() === ex.toLowerCase());
  const renderRulePills = () => {
    rWrap.innerHTML = "";
    const extras = projRules.filter((r) => !RULE_EXAMPLES.some((e) => e.toLowerCase() === r.toLowerCase()));
    [...RULE_EXAMPLES, ...extras].forEach((ex) => {
      const p = document.createElement("button"); p.type = "button"; p.className = "ichip"; p.textContent = ex;
      p.classList.toggle("selected", has(ex));
      p.addEventListener("click", () => {
        const i = projRules.findIndex((r) => r.toLowerCase() === ex.toLowerCase());
        if (i >= 0) projRules.splice(i, 1); else projRules.push(ex);
        persist(); renderRulePills(); onChange();
      });
      rWrap.appendChild(p);
    });
  };
  renderRulePills();
  const ruleInput = document.createElement("input");
  ruleInput.className = "icard-input";
  ruleInput.placeholder = COPY.voice.projectRulePlaceholder;
  ruleInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const t = ruleInput.value.trim();
    if (t && !has(t)) { projRules.push(t); ruleInput.value = ""; persist(); renderRulePills(); onChange(); }
  });
  body.append(rWrap, ruleInput);

  syncTone();

  return {
    getValue: () => toneInput.value.trim() || null, // tone → Brief.tone (field:"tone")
    hasValue: () => toneInput.value.trim().length > 0 || projRules.length > 0,
    setDisabled: (d) => body.querySelectorAll("input, button").forEach((e) => { e.disabled = d; }),
    display: () => [toneInput.value.trim(), ...projRules].filter(Boolean).join(" · "),
  };
}

// Inject a Google Fonts stylesheet for the given families (deduped). Best-effort —
// no CSP blocks it in the chrome; a failed load just leaves the name in a fallback.
const _loadedFonts = new Set();
function loadGoogleFonts(families) {
  const fresh = (families || []).filter((f) => f && !_loadedFonts.has(f));
  if (!fresh.length) return;
  fresh.forEach((f) => _loadedFonts.add(f));
  const q = fresh.map((f) => "family=" + encodeURIComponent(f).replace(/%20/g, "+")).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
  document.head.appendChild(link);
}

// ---- Company Setup form (in-pane "Brand This Project") ----------------------
// A deterministic, agent-free pane form (P3): the dashboard "Brand This Project"
// button (tacmd:brand-company) opens it to brand the COMPANY layer only — name,
// admin/gate fonts, login logo — which Get Designing skips. Reuses the intake card
// renderers; on submit it POSTs to company:apply (slice 1). Curated font pools
// (common Google families with 400 & 700 so the css2 request never fails).
const COMPANY_HEADING_FONTS = ["DM Sans", "Poppins", "Space Grotesk", "Fraunces", "Libre Franklin"];
const COMPANY_BODY_FONTS = ["Inter", "Work Sans", "IBM Plex Sans", "Source Sans 3", "Nunito Sans"];

function renderCompanyForm() {
  enterIntakeMode();
  intakePhase = "idle"; // NOT the agent 'gathering' flow — a stale agent:intake batch is cancelled
  startChoicesShown = false;
  exitReview();
  intakeph.classList.remove("start", "hasbrief");
  intakeph.classList.add("flow");
  updateBackButton();
  setIntakeHead(COPY.companyForm.headTitle, COPY.companyForm.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";

  const cards = [
    { id: "companyName", type: "open-text", label: COPY.companyForm.nameLabel, placeholder: COPY.companyForm.namePlaceholder, maxLength: 60 },
    { id: "headingFont", type: "font-pick", label: COPY.companyForm.headingFontLabel, help: COPY.companyForm.headingFontHelp, options: COMPANY_HEADING_FONTS, skippable: true, agentDecidesLabel: COPY.companyForm.useDefault },
    { id: "bodyFont", type: "font-pick", label: COPY.companyForm.bodyFontLabel, options: COMPANY_BODY_FONTS, skippable: true, agentDecidesLabel: COPY.companyForm.useDefault },
    { id: "logo", type: "logo", label: COPY.companyForm.logoLabel, placeholder: COPY.companyForm.logoPlaceholder, skippable: true },
  ];

  const group = document.createElement("div");
  group.className = "intake-group";
  function refreshReady() { applyBtn.disabled = !controls.every((c) => c.isReady()); }
  const controls = cards.map((card) => {
    const r = renderIntakeCard(card, refreshReady, () => {});
    group.appendChild(r.el);
    return { card, ...r };
  });

  const applyBtn = document.createElement("button");
  applyBtn.className = "intake-continue";
  applyBtn.textContent = COPY.companyForm.apply;
  refreshReady();
  applyBtn.addEventListener("click", async () => {
    if (group.classList.contains("answered")) return;
    const vals = {};
    for (const c of controls) vals[c.card.id] = c.getValue();
    if (!vals.companyName) return; // name is the one required field
    group.classList.add("answered");
    controls.forEach((c) => c.collapse());
    applyBtn.replaceWith(doneNote());
    showIntakePending(COPY.companyForm.applying);
    try {
      const res = await window.desktop.applyCompany({
        companyName: vals.companyName,
        headingFont: vals.headingFont || null,
        bodyFont: vals.bodyFont || null,
        logo: vals.logo || null,
      });
      clearIntakePending();
      if (!res || !res.ok) { showIntakePending((res && res.error) || COPY.companyForm.applyError); return; }
      // Leave the form back to the preview. Reload the active tab to pick up the new
      // admin fonts/logo; Vite also auto-restarts on the .env change (VITE_COMPANY_NAME),
      // which clears the dashboard's "Brand This Project" button (isCompanyBranded).
      resetIntake();
      previewph.hidden = true;
      browser.hidden = false;
      if (activeTab) navigate(activeTab, activeTab.url);
      window.desktop.getProjectStatus().then((p) => { if (p) setProjTitle(p); }).catch(() => {});
    } catch (e) {
      showIntakePending(COPY.companyForm.applyErrorPrefix + e.message);
    }
  });
  group.appendChild(applyBtn);
  intakeStack.appendChild(group);
  fadeSlideIn(group, { dy: 44, duration: 720, delay: 60 });
}

// ---- Start path picker (fresh-start choices in the pane) --------------------
// On a truly fresh project the BIG PANE shows two choices instead of guessing from
// a typed "hello": "Client Setup" (deterministic /setup-project) and "Get Designing"
// (the pane intake). Clicking a card is that path's "hello".
const DEFAULT_PLACEHOLDER = COPY.composer.placeholder; // catalog is the source (HTML sets it at runtime)
let startChoicesShown = false; // the pane is showing the start fork right now

// If the start fork is up and the user does something else (types a message,
// reopens a session), leave that screen so the normal view takes over.
function dismissWelcome() {
  if (startChoicesShown) { startChoicesShown = false; resetIntake(); }
}

function renderStartChoices() {
  // Only greet on a truly fresh start: a project is open, no design yet, and
  // nothing has been said. Self-guards so callers can fire it freely.
  if (conversationStarted || (design && design.active)) return;

  // A fresh project starts with the chat slid shut.
  setChatCollapsed(true);

  // Figma-licensed → the two-card fork (Start from Figma + Get Designing). Unlicensed →
  // SKIP the fork entirely and drop straight into Get Designing (least friction, one path).
  // See electron/docs/onboarding-figma-reframe-spec.md.
  Promise.resolve(window.desktop.getLicenseStatus())
    .then((fig) => {
      if (conversationStarted || (design && design.active)) return; // re-check after the await
      if (fig && fig.hasLicense) renderStartFork();
      else enterDesignBriefMode();
    })
    .catch(() => enterDesignBriefMode());
}

// The licensed two-card fork in the big pane: Start from Figma (left, where the setup card
// used to sit) + Get Designing (right). The chat rail stays for the conversation.
function renderStartFork() {
  enterIntakeMode();
  intakePhase = "idle";
  updateBackButton();
  intakeph.classList.add("start"); // center the fork vertically + center the head text
  intakeph.classList.remove("flow", "hasbrief");
  setIntakeHead(COPY.intake.start.headTitle, COPY.intake.start.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";

  // The Figma brand mark (same SVG as the sidebar rail), and a pencil-drawing-a-line
  // (Lucide) for the free-form "just design it" path.
  const ICON_FIGMA =
    '<svg viewBox="0 0 38 57" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1abcfe"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0acf83"/><path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#ff7262"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#f24e1e"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#a259ff"/></svg>';
  const ICON_PENCIL_LINE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  const opts = [
    {
      label: COPY.intake.start.figmaStartLabel,
      desc: COPY.intake.start.figmaStartDesc,
      icon: ICON_FIGMA,
      iconClass: "istart-icon-figma",
      onClick: enterFigmaStartMode,
    },
    {
      label: COPY.intake.start.getDesigningLabel,
      desc: COPY.intake.start.getDesigningDesc,
      icon: ICON_PENCIL_LINE,
      onClick: enterDesignBriefMode,
    },
  ];
  const row = document.createElement("div");
  row.className = "istart-row";
  for (const o of opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "istart-card";
    const icon = document.createElement("span");
    icon.className = "istart-icon" + (o.iconClass ? " " + o.iconClass : "");
    icon.innerHTML = o.icon;
    const lbl = document.createElement("div");
    lbl.className = "istart-label";
    lbl.textContent = o.label;
    const desc = document.createElement("div");
    desc.className = "istart-desc";
    desc.textContent = o.desc;
    btn.append(icon, lbl, desc);
    btn.addEventListener("click", o.onClick);
    row.appendChild(btn);
  }
  intakeStack.appendChild(row);
  startChoicesShown = true;

  // Entrance: the copy rises + fades, then the two cards slide in from the sides,
  // staggered (left first, right just after).
  fadeSlideIn(intakeph.querySelector(".intake-head"), { dy: 50, duration: 780, delay: 60 });
  fadeSlideIn(row.children[0], { dx: -64, duration: 720, delay: 340 });
  fadeSlideIn(row.children[1], { dx: 64, duration: 720, delay: 470 });
}

// "Start from Figma" step 1: the frame-link screen. One input (the Figma frame URL), an
// Import, and a skip. On Import we hand off to the /figma-ingest agent command (which pulls the
// frame via the Figma MCP and writes the standard reference digest), like the old Client Setup
// card kicked /setup-project.
let awaitingFigmaIngest = false; // true between kicking /figma-ingest and its turn settling
// Design BUILDS run on Sonnet by default (a spec-following, high-output turn: much cheaper +
// far less thinking than the reasoning-heavy intake). The "Build fidelity" toggle (Claude
// settings) flips builds to Opus for a high-fidelity final that follows a detailed spec more
// closely. buildModel() resolves the current choice; buildHiFi is loaded/persisted via ui-state.
const BUILD_MODEL_FAST = "claude-sonnet-5";
const BUILD_MODEL_HIFI = "claude-opus-5";
let buildHiFi = false;
window.desktop.getBuildFidelity().then((r) => { buildHiFi = !!(r && r.hiFi); }).catch(() => {});
const buildModel = () => (buildHiFi ? BUILD_MODEL_HIFI : BUILD_MODEL_FAST);

function isFigmaFrameUrl(u) {
  return typeof u === "string" && /figma\.com\/(design|file|proto|board)\//i.test(u);
}
// Pull the first Figma URL out of arbitrary pasted text — a designer often pastes something like
// "Implement this design from Figma.\n@https://figma.com/design/…?node-id=…". The match starts at
// `https`, so a leading `@` drops off for free; we also trim trailing punctuation. Returns "" if none.
function extractFigmaUrl(text) {
  if (typeof text !== "string") return "";
  const m = text.match(/https?:\/\/(?:www\.)?figma\.com\/[^\s<>"')]+/i);
  return m ? m[0].replace(/[.,;]+$/, "") : "";
}

function enterFigmaStartMode() {
  dismissWelcome();
  intakePhase = "figma";
  currentIntakeId = null;
  enterIntakeMode();
  intakeph.classList.add("start");
  intakeph.classList.remove("flow", "hasbrief");
  setIntakeHead(COPY.intake.figma.headTitle, COPY.intake.figma.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";
  renderBriefSummary(null);

  const wrap = document.createElement("div");
  wrap.className = "ifigma-wrap";
  const input = document.createElement("input");
  input.type = "url";
  input.className = "ifigma-url";
  input.placeholder = COPY.intake.figma.urlPlaceholder;
  input.spellcheck = false;
  const err = document.createElement("div");
  err.className = "ifigma-err";
  err.hidden = true;
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "ifigma-import";
  importBtn.textContent = COPY.intake.figma.importLabel;
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "ifigma-skip";
  skip.textContent = COPY.intake.figma.skip;

  // Stay FULL-SCREEN in the pane (no chat, like Get Designing): show a working state while
  // /figma-ingest pulls the frame via the Figma MCP and writes the digest + figma.json; the
  // result handler then reads figma.json and renders the findings + next-step cards here in the
  // pane (showFigmaFindings). A frame URL is required (the connected MCP is file-key-scoped).
  const kick = (arg) => {
    setChatCollapsed(true);
    intakePhase = "figma";
    intakeph.classList.add("start");
    intakeph.classList.remove("flow", "hasbrief");
    setIntakeHead(COPY.intake.figma.workingTitle, COPY.intake.figma.workingLead);
    el("intake-brief").innerHTML = "";
    intakeStack.innerHTML = "";
    const working = document.createElement("div");
    working.className = "ifigma-working";
    working.innerHTML = "<i></i><i></i><i></i>";
    intakeStack.appendChild(working);
    updateBackButton();
    awaitingFigmaIngest = true;
    // Send the real command but SHOW a friendly label in the chat (runAgent echoes echoText).
    runAgent("/figma-ingest " + arg, COPY.intake.figma.echoImport);
  };
  const submit = () => {
    const url = extractFigmaUrl(input.value) || input.value.trim();
    if (!isFigmaFrameUrl(url)) { err.textContent = COPY.intake.figma.invalidUrl; err.hidden = false; input.focus(); return; }
    err.hidden = true;
    kick(url);
  };
  importBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  // Paste "Implement this from Figma. @https://figma.com/…" → the field keeps just the clean URL.
  input.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData && e.clipboardData.getData("text")) || "";
    const clean = extractFigmaUrl(pasted);
    if (clean) { e.preventDefault(); input.value = clean; err.hidden = true; }
  });
  skip.addEventListener("click", enterDesignBriefMode);

  wrap.append(input, err, importBtn, skip);
  intakeStack.appendChild(wrap);
  updateBackButton();
  setTimeout(() => input.focus(), 0);
  fadeSlideIn(intakeph.querySelector(".intake-head"), { dy: 40, duration: 700, delay: 40 });
  fadeSlideIn(wrap, { dy: 30, duration: 640, delay: 260 });
}

// After /figma-ingest settles: read figma.json and render the findings + next-step cards in the
// full-screen pane (no chat), so the designer picks a card instead of typing. If the ingest wrote
// no figma.json (it needed a URL / errored), fall back to the chat where the agent explained.
async function showFigmaFindings() {
  let meta = null;
  try { meta = await window.desktop.readFigmaMeta(); } catch {}
  if (!meta) { resetIntake(); setChatCollapsed(false); return; }
  // Wire the brand into tokens.css NOW (deterministic), so the next step starts branded, not on
  // the template defaults — regardless of whether it's "Design this page" or "Start designing".
  try { await window.desktop.applyFigmaBrand(); } catch {}
  try { const fr = await window.desktop.getBuildFidelity(); buildHiFi = !!(fr && fr.hiFi); } catch {} // sync with settings

  const F = COPY.intake.figma;
  enterIntakeMode();
  intakePhase = "figma";
  intakeph.classList.add("start");
  intakeph.classList.remove("flow", "hasbrief");
  setIntakeHead(F.doneTitle(meta.fileName), meta.summary || F.doneLead);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";
  renderBriefSummary(null);

  // Findings: structure badge, palette swatches, type, caveats.
  const findings = document.createElement("div");
  findings.className = "ifigma-findings";
  const badge = document.createElement("div");
  badge.className = "ifigma-badge";
  badge.textContent = meta.structure === "page" ? F.badgePage : meta.structure === "styleguide" ? F.badgeStyleguide : F.badgeUnknown;
  findings.appendChild(badge);

  const colors = meta.tokens && meta.tokens.colors ? Object.values(meta.tokens.colors).filter((c) => typeof c === "string") : [];
  if (colors.length) {
    const lbl = document.createElement("div"); lbl.className = "ifigma-flabel"; lbl.textContent = F.paletteLabel;
    const sw = document.createElement("div"); sw.className = "ifigma-swatches";
    colors.slice(0, 12).forEach((hex) => { const s = document.createElement("span"); s.className = "ifigma-swatch"; s.style.background = hex; s.title = hex; sw.appendChild(s); });
    findings.append(lbl, sw);
  }
  const fonts = Array.isArray(meta.fonts) ? meta.fonts.filter(Boolean) : [];
  if (fonts.length) {
    const lbl = document.createElement("div"); lbl.className = "ifigma-flabel"; lbl.textContent = F.typeLabel;
    const val = document.createElement("div"); val.className = "ifigma-fval"; val.textContent = fonts.join(", ");
    findings.append(lbl, val);
  }
  const flags = Array.isArray(meta.flags) ? meta.flags.filter(Boolean) : [];
  if (flags.length) {
    const ul = document.createElement("ul"); ul.className = "ifigma-flags";
    flags.forEach((f) => { const li = document.createElement("li"); li.textContent = f; ul.appendChild(li); });
    findings.appendChild(ul);
  }

  // Curated images pulled from the file (the client's own assets, ready to use).
  const imgN = Array.isArray(meta.images) ? meta.images.filter((i) => i && i.path).length : 0;
  if (imgN) {
    const note = document.createElement("div"); note.className = "ifigma-fontup-note"; note.style.marginTop = "12px";
    note.textContent = F.imagesNote(imgN); findings.appendChild(note);
  }

  // Logo: a small "imported" note if auto-export worked, else a one-click upload fallback (the
  // reliable path when the logo is a nested component the agent couldn't cleanly export).
  if (meta.logo) {
    const done = document.createElement("div"); done.className = "ifigma-fontup-note"; done.style.marginTop = "14px";
    done.textContent = F.logoImported; findings.appendChild(done);
  } else {
    const box = document.createElement("div"); box.className = "ifigma-fontup";
    const lead = document.createElement("div"); lead.className = "ifigma-fontup-lead"; lead.textContent = F.logoUploadLead(meta.brandName);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "ifigma-fontup-btn"; btn.textContent = F.logoUploadBtn;
    const note = document.createElement("div"); note.className = "ifigma-fontup-note"; note.hidden = true;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      let res = null;
      try { res = await window.desktop.uploadLogo(); } catch {}
      btn.disabled = false;
      if (res && res.ok) { note.textContent = F.logoUploadDone; note.hidden = false; btn.hidden = true; }
      else if (res && !res.canceled) { note.textContent = (res && res.error) || F.logoUploadFail; note.hidden = false; }
    });
    box.append(lead, btn, note);
    findings.appendChild(box);
  }

  // A non-web font (e.g. DotMatrix Two) can't be assumed available → offer to upload its files
  // (one or several weights). font:install copies them into public/fonts/ + writes @font-face.
  const customFonts = Array.isArray(meta.customFonts) ? meta.customFonts.filter((f) => f && f.family) : [];
  for (const cf of customFonts) {
    const box = document.createElement("div");
    box.className = "ifigma-fontup";
    const lead = document.createElement("div"); lead.className = "ifigma-fontup-lead"; lead.textContent = F.fontUploadLead(cf.family);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "ifigma-fontup-btn"; btn.textContent = F.fontUploadBtn;
    const note = document.createElement("div"); note.className = "ifigma-fontup-note"; note.hidden = true;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      let res = null;
      try { res = await window.desktop.installFont(cf.family); } catch {}
      btn.disabled = false;
      if (res && res.ok) { note.textContent = F.fontUploadDone((res.files || []).length, res.family); note.hidden = false; btn.hidden = true; }
      else if (res && !res.canceled) { note.textContent = (res && res.error) || F.fontUploadFail; note.hidden = false; }
    });
    box.append(lead, btn, note);
    findings.appendChild(box);
  }
  intakeStack.appendChild(findings);

  // Build-fidelity toggle here too (the onboard main pane) — designers may not open Claude
  // settings. Shares the same global buildHiFi state (so it stays in sync with the drawer);
  // flipping it persists immediately, so the build kicked below uses the chosen model.
  const fid = document.createElement("div");
  fid.className = "ifigma-fidelity";
  const fidTxt = document.createElement("div"); fidTxt.className = "ifigma-fidelity-txt";
  const fidLbl = document.createElement("div"); fidLbl.className = "ifigma-fidelity-lbl"; fidLbl.textContent = COPY.claude.fidelityLabel;
  const fidSt = document.createElement("div"); fidSt.className = "ifigma-fidelity-state";
  fidTxt.append(fidLbl, fidSt);
  const fidSw = document.createElement("label"); fidSw.className = "fidelity-switch";
  const fidCb = document.createElement("input"); fidCb.type = "checkbox"; fidCb.checked = buildHiFi;
  const fidSl = document.createElement("span"); fidSl.className = "slider";
  fidSw.append(fidCb, fidSl);
  const paintFid = () => { fidSt.textContent = fidCb.checked ? COPY.claude.fidelityOn : COPY.claude.fidelityOff; };
  paintFid();
  fidCb.addEventListener("change", async () => { buildHiFi = fidCb.checked; paintFid(); try { await window.desktop.setBuildFidelity(buildHiFi); } catch { /* best-effort */ } });
  fid.append(fidTxt, fidSw);
  intakeStack.appendChild(fid);

  // Next-step cards (renderer-driven, pane-native).
  const opts = meta.structure === "page"
    ? [
        { label: F.designPageLabel, desc: F.designPageDesc, onClick: () => {
            resetIntake(); setChatCollapsed(false); showPlaceholder(COPY.preview.figmaIngestStart);
            runAgent("/design build this page from the imported Figma frame. The brand (--ta-* palette + fonts) is already wired into tokens.css, and `.thinkany/references/digest.md` has the section outline, component details, images and icons. Build from THAT and MATCH the source faithfully — fidelity comes first. To get the colors, icons, and detail right, DO look at the design: screenshot the frame's sections for visual reference (get_screenshot) as much as you need. Use the ingested images/icons by their `public/images/figma/` paths (already downloaded; do not re-fetch). The scaffold shape (DesignSurface, Header/Footer, pages.ts, menu.ts, tokens.css, brand.ts) is already inlined in /design — do not re-read those to recall structure. Work quietly per the low-chatter protocol: do not narrate routine setup (creating the working variation, etc.) — just do it.", COPY.intake.figma.echoBuildPage, { model: buildModel() });
          } },
        { label: F.briefLabel, desc: F.briefDesc, onClick: enterDesignBriefMode },
      ]
    : [ { label: F.startDesigningLabel, desc: F.startDesigningDesc, onClick: enterDesignBriefMode } ];

  const row = document.createElement("div");
  row.className = "istart-row";
  for (const o of opts) {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "istart-card istart-center";
    const lbl = document.createElement("div"); lbl.className = "istart-label"; lbl.textContent = o.label;
    const desc = document.createElement("div"); desc.className = "istart-desc"; desc.textContent = o.desc;
    btn.append(lbl, desc);
    btn.addEventListener("click", o.onClick);
    row.appendChild(btn);
  }
  intakeStack.appendChild(row);
  updateBackButton();
  fadeSlideIn(intakeph.querySelector(".intake-head"), { dy: 40, duration: 700, delay: 40 });
  fadeSlideIn(findings, { dy: 24, duration: 640, delay: 200 });
  fadeSlideIn(row, { dy: 24, duration: 640, delay: 320 });
}

// "Get Designing" — drive the intake in the PANE (T5), not a chat brief. Clicking
// enters intake mode immediately and silently kicks off the agent, which runs the
// conversation through the `intake` tool. beginIntake() starts a fresh Brief on the
// main side so each answered batch folds in and pushes back an updated summary.
// "Get Designing" step 1: pick what we're making (Web Site or App), THEN the
// agent-driven questions. Renderer-driven (before the agent), centered like the
// start fork.
function enterDesignBriefMode() {
  renderDeliverableChoice();
}

// 1px-stroke type icons. Website = a monitor + tablet + phone (responsive), baselines
// aligned; App = a single phone. Both drawn to the same 26px height so the two card
// labels line up (see .istart-center .istart-icon CSS).
const ICON_WEBSITE = '<svg viewBox="0 0 46 26" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="20" height="13" rx="1.5"/><path d="M11 16v4M6.5 20h9"/><rect x="26" y="6.5" width="9" height="13.5" rx="1.5"/><path d="M29.5 18h2"/><rect x="39" y="9.5" width="6" height="10.5" rx="1.5"/><path d="M41.2 18h1.6"/></svg>';
const ICON_APP = '<svg viewBox="0 0 14 26" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="11" height="22" rx="2.5"/><path d="M5.5 20.5h3"/></svg>';

function renderDeliverableChoice() {
  dismissWelcome();
  intakePhase = "deliverable";
  currentIntakeId = null;
  enterIntakeMode();
  intakeph.classList.add("start");        // centered, like the start fork
  intakeph.classList.remove("flow", "hasbrief");
  setIntakeHead(COPY.intake.deliverable.headTitle, COPY.intake.deliverable.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";
  renderBriefSummary(null); // clear the rail

  const opts = [
    { type: "website", label: COPY.intake.deliverable.websiteLabel, desc: COPY.intake.deliverable.websiteDesc, icon: ICON_WEBSITE },
    { type: "app", label: COPY.intake.deliverable.appLabel, desc: COPY.intake.deliverable.appDesc, icon: ICON_APP },
  ];
  const row = document.createElement("div");
  row.className = "istart-row";
  for (const o of opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "istart-card istart-center";
    const icon = document.createElement("span");
    icon.className = "istart-icon";
    icon.innerHTML = o.icon;
    const lbl = document.createElement("div");
    lbl.className = "istart-label";
    lbl.textContent = o.label;
    const desc = document.createElement("div");
    desc.className = "istart-desc";
    desc.textContent = o.desc;
    btn.append(icon, lbl, desc);
    btn.addEventListener("click", () => pickDeliverable(o.type));
    row.appendChild(btn);
  }
  intakeStack.appendChild(row);
  updateBackButton();

  // Entrance: head rises, cards stagger in from the sides.
  fadeSlideIn(intakeph.querySelector(".intake-head"), { dy: 40, duration: 700, delay: 40 });
  fadeSlideIn(row.children[0], { dx: -52, duration: 640, delay: 260 });
  fadeSlideIn(row.children[1], { dx: 52, duration: 640, delay: 360 });
}

// Deliverable picked → FLIP the head up into the flow and kick off the questions.
async function pickDeliverable(type) {
  // Let any backed-out turn's result settle before we flip into gathering, so a
  // late completion can't hijack this fresh turn (the Back-during-questioning bug).
  try { await turnGate; } catch { /* prior turn already reported */ }
  deliverableType = type;
  addMsg("system", COPY.intake.designingMessage(type));

  const head = intakeph.querySelector(".intake-head");
  const first = head.getBoundingClientRect();

  startChoicesShown = false;
  refsRevealed = false; // rail stays hidden until the first question is answered
  voiceStepDone = false; // the renderer-injected Tone/rules step hasn't run yet
  heroStepDone = false; // the hero-layout step (after sections, if Hero chosen)
  menuStepDone = false; // the header/nav step (before hero, website projects)
  ctaStepDone = false; // the contact/CTA type step (after hero, if Contact/CTA chosen)
  intakeph.classList.add("flow"); // two-column mode: questions left, references rail right
  intakeph.classList.remove("start", "hasbrief");
  enterIntakeMode();
  setIntakeHead(COPY.intake.gathering.headTitle, COPY.intake.gathering.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";
  loadReferences(); // open the rail with the references upload zone from the start
  loadVoice();      // prime copy-voice (globals + project rules) for the voice card

  const last = head.getBoundingClientRect();
  const flip = anim(head, [
    { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` },
    { transform: "translate(0px, 0px)" },
  ], { duration: 780 });

  intakePhase = "gathering";
  takingInIdx = 0;
  updateBackButton();
  try { await window.desktop.beginIntake("web-pages", type); } catch {}
  // The fixed questions are now client-rendered (zero tokens); only color/font later
  // spend a model turn. Start the question script once the head flip settles.
  const startQuestions = () => { if (intakePhase === "gathering") startClientIntake(type); };
  if (flip && flip.finished) flip.finished.then(startQuestions, startQuestions);
  else startQuestions();
}

// Step back through the flow. During questioning → back to the Web Site / App fork
// (cancels the pending question so the agent turn ends cleanly, and starts fresh on
// the next pick). At the fork → back to the Client Setup / Get Designing start.
function goBack() {
  conversationStarted = false;
  if (intakePhase === "gathering") {
    // Stop the running turn, not just the pending intake tool: a turn left running
    // would finish and hijack a fresh turn's state (the false "review" screen).
    try { window.desktop.interruptAgent(); } catch { /* best-effort */ }
    if (currentIntakeId != null) { try { window.desktop.cancelIntake(currentIntakeId); } catch {} currentIntakeId = null; }
    clearIntakePending();
    renderDeliverableChoice();
  } else if (intakePhase === "deliverable" || intakePhase === "figma") {
    resetIntake();
    renderStartChoices();
  }
}
function updateBackButton() {
  intakeBack.hidden = !(intakePhase === "deliverable" || intakePhase === "gathering" || intakePhase === "figma");
}
intakeBack.addEventListener("click", goBack);

// The ONE model turn in Get Designing: the fixed brief questions are already collected
// client-side (startClientIntake), so the model only supplies the questions whose
// OPTIONS need judgment — the sections/screens list (fitted to the type + vibe) and,
// unless the designer already named them, a color and a font. It reads the designer's
// own description (passed in) to tailor every option, asks only for what's still
// missing, then a one-line recap.
function getModelIntakePrompt(type, brief, hasColor, hasFont) {
  const kind = type === "app" ? "app" : "web site";
  const sectionsWord = type === "app" ? "screens/views (e.g. dashboard, settings, profile)" : "sections (e.g. hero, features, pricing)";
  const b = brief || {};
  const desc = b.what ? String(b.what).trim() : "";
  const lines = [
    `The designer is making a ${kind} and already gave the core of their brief. In their words:`,
    desc ? `“${desc}”` : "(they did not describe it in words)",
    "Offer ONLY the card(s) below via the `intake` tool (mcp__intake__intake) — one card per call, one at a",
    "time, rendered in the pane (never in chat). In ALL card text use a typographic apostrophe (’) and no",
    "em-dashes, never a straight ' or a --. Tailor every option to the vibe of their description AND to a " + kind + ":",
    `  - a chips card of likely ${sectionsWord} { id:"sections", field:"sections", options:[~8-10 fitting a ${kind} and the vibe] }, skippable:true;`,
  ];
  if (!hasColor) lines.push('  - a color-swatch card { id:"primaryColor", field:"colorSources", options:[~5 tasteful hex values fitting the vibe] }, skippable:true;');
  if (!hasFont) lines.push('  - a font-pick card { id:"font", field:"fontSources", options:[~4 Google-Font family names fitting the vibe] }, skippable:true;');
  lines.push("If their description already lists specific sections, names a color, or names a font, OMIT that card —");
  lines.push("only offer what they have NOT already decided. Do NOT ask about tone/voice, names, or references —");
  lines.push("those are already handled, never send those cards. If the designer DISMISSES a question (the tool");
  lines.push("returns an error), stop and wait, do not retry. Do NOT build or edit anything — the build launches");
  lines.push("from the pane's \"Start designing\" button. After the card(s) are answered, reply with ONE short, warm");
  lines.push("recap line of the brief, then stop. Do NOT mention phases, a \"step 2\", or ask them to confirm — the");
  lines.push("build starts on its own from the pane.");
  return lines.filter(Boolean).join("\n");
}

// Core send: fire a prompt at the agent. `echoText`, when given, is shown as the
// user's chat bubble; omit it to run a prompt silently (Get Designing's kickoff).
// The preamble that opens the fresh editing session — points the model at the design
// on disk so it reconstructs context cheaply, and steers it away from the expensive
// habits (re-reading the whole project, screenshotting) that a build accumulates.
function leanEditPreamble() {
  const id = (design && design.variationId) || "v01";
  return (
    `[Editing an existing, already-built design — do NOT rebuild from scratch.] ` +
    `The current design is in \`src/variations/${id}/components/Home.tsx\`, its tokens in ` +
    `\`src/variations/${id}/styles/tokens.css\`, and the original brief in ` +
    `\`src/variations/${id}/variation.json\`. Read only what you need from those, follow the ` +
    `/design rules, and make just the change below. Don't re-read the whole project or ` +
    `screenshot unless something is actually reported visually broken.`
  );
}

async function runAgent(toSend, echoText, opts) {
  // Backstop: no key → no agent turns at all (covers reroll, Art Director, Figma export,
  // and any path that reaches here). The UI already hides/disables these, this is the guard.
  if (!appHasKey) { addMsg("error", COPY.errors.needKey); return; }
  // A review turn (Art Director) is READ-ONLY and ISOLATED: it runs in a fresh session
  // with its own persona, must not touch the chat session, must not run the lean-edit
  // reset, and must leave the live design on screen (it isn't building anything).
  const review = !!(opts && opts.reviewMode);
  // Never overlap turns: wait for any in-flight turn's result to be handled first.
  try { await turnGate; } catch { /* prior turn already reported its error */ }
  beginTurnGate();
  dismissWelcome();
  // One-time lean reset at the build→edit boundary: archive the heavy build session and
  // start this edit fresh with a disk-pointer preamble, so it (and the edits after it)
  // run on a slim base instead of re-caching the whole build every turn.
  if (!review && leanEditPending) {
    leanEditPending = false;
    if (sessionId) { try { await window.desktop.archiveSession(sessionId); } catch {} }
    sessionId = null;
    toSend = leanEditPreamble() + "\n\n" + toSend;
  }
  if (echoText) addMsg("user", echoText);
  input.value = "";
  input.placeholder = DEFAULT_PLACEHOLDER;
  assistantEl = null;
  agentBusy = true;
  updateRerollBtn(); // a turn is running → hide reroll until it settles
  conversationStarted = true;
  updateThinking(); // dots up immediately, until the first text/tool arrives
  if (!review) refreshPreview(); // show the working placeholder (a review keeps the design visible)
  send.disabled = true;
  try {
    const res = await window.desktop.sendPrompt(toSend, review ? null : sessionId, { reviewMode: review, model: opts && opts.model });
    if (!review && res && res.sessionId) sessionId = res.sessionId; // never let a review hijack the chat session
  } catch (e) {
    agentBusy = false;
    updateThinking();
    addMsg("error", String(e));
    refreshPreview();
    endTurnGate(); // no result/error EVENT will arrive for an IPC-level failure
  } finally {
    send.disabled = false;
    input.focus();
  }
}

// Typed messages + the Client Setup chip. /clear is a local session reset.
async function sendText(text) {
  text = (text || "").trim();
  if (!text) return;
  if (text === "/clear") {
    input.value = "";
    input.placeholder = DEFAULT_PLACEHOLDER;
    dismissWelcome();
    await clearSession();
    input.focus();
    return;
  }
  await runAgent(text, text);
}

function submit() {
  return sendText(input.value);
}
send.addEventListener("click", submit);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
});

// ---- File attach -------------------------------------------------------------
function attachPrefill(res) {
  if (res.name === "company-profile.json") {
    return `Import the company profile I just added (${res.rel}).`;
  }
  if (res.kind === "image" && /logo/i.test(res.name)) {
    return `Use ${res.rel} as the login logo — place it in public/brand and wire it into middleware.`;
  }
  return res.rel;
}

function consumeAttach(res) {
  if (!res || res.canceled) return;
  if (!res.ok) {
    addMsg("error", res.error || "Could not attach the file.");
    return;
  }
  // If a file-question card is open, fulfill it instead of prefilling the input.
  if (pendingFileFulfill) {
    pendingFileFulfill(res);
    return;
  }
  addMsg("system", `📎 ${res.name} added as ${res.rel}`);
  input.value = input.value.trim() ? `${input.value.trim()} ${res.rel}` : attachPrefill(res);
  input.focus();
}

attach.addEventListener("click", async () => {
  try {
    consumeAttach(await window.desktop.attachFile());
  } catch (e) {
    addMsg("error", String(e));
  }
});

// Drag & drop a file onto the chat log.
["dragenter", "dragover"].forEach((t) =>
  log.addEventListener(t, (e) => {
    e.preventDefault();
    e.stopPropagation();
    log.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((t) =>
  log.addEventListener(t, (e) => {
    e.preventDefault();
    e.stopPropagation();
    log.classList.remove("dragover");
  })
);
log.addEventListener("drop", async (e) => {
  for (const f of [...(e.dataTransfer?.files || [])]) {
    const src = window.desktop.pathForFile(f);
    if (!src) continue;
    try {
      consumeAttach(await window.desktop.attachFilePath(src));
    } catch (err) {
      addMsg("error", String(err));
    }
  }
});
// Don't let the window navigate when a file is dropped outside the chat.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// ---- Launch splash -----------------------------------------------------------
// Show the welcome + logo for 3s, then fade it out to reveal the app (which boots
// underneath in the meantime). All soft: the logo/welcome ease in, the whole
// screen fades out.
(function initSplash() {
  const splash = el("splash");
  if (!splash) return;
  applyStaticCopy(); // populate the welcome line before it's shown
  const SPLASH_MS = 3000, FADE_MS = 650;
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => { splash.hidden = true; }, FADE_MS);
  }, SPLASH_MS);
})();

// ---- Boot --------------------------------------------------------------------
boot();
