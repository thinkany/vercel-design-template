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
const railPublish = el("rail-publish");
const railCompany = el("rail-company");
const railFigma = el("rail-figma");
const railVoice = el("rail-voice");
const railClaude = el("rail-claude");
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
function quickUrl(kind) {
  const v = design.variationId;
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
  feedbackBtn.hidden = !tab; // the toggle only makes sense with a live preview
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
  const onNav = () => { if (tab === activeTab) syncNav(); };
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
document.querySelectorAll(".qlink").forEach((b) =>
  b.addEventListener("click", () => {
    if (!viteUrl) return;
    const kind = b.dataset.nav;
    const url = quickUrl(kind);
    const label = NAV_LABEL[kind];
    if (activeTab) {
      navigate(activeTab, url);
      // Pin the tab label to the destination so the title reflects where we
      // navigated. Without this the startup Home/Style-guide tabs (fixed-title)
      // keep their original label forever when moved via the quick-links.
      if (label) { activeTab.title = label; activeTab.fixedTitle = true; renderTabs(); }
    } else {
      openTab(url, label);
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
  guarding = false;
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  showPreviewHelp(); // updated preview shown → offer the blank-recovery help
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
  homeBuilding = true;
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  const style = openTab(quickUrl("styleguide"), "Style guide");
  homeTab = openTab(quickUrl("home"), "Home");
  setActiveTab(style); // land on the ready brand guidelines
  startBuildRotation();
}

// Turn ended: the home design is complete — drop the cover and load the result.
function finishBuildReveal() {
  homeBuilding = false;
  stopBuildRotation();
  buildoverlay.hidden = true;
  if (homeTab) {
    navigate(homeTab, quickUrl("home")); // reload to the finished design
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

async function showBrowser() {
  if (!viteUrl || tabsOpened) return;
  tabsOpened = true; // claim immediately so re-entrant calls don't double-open
  // Keep the "Working…" placeholder up until the server actually SERVES the
  // styleguide (200). Vite may be up but still compiling the just-created
  // variation, so opening now would flash blank tabs. Bounded (~10s) — the
  // webview's own connection-refused retry is the backstop.
  const styleUrl = quickUrl("styleguide");
  for (let i = 0; i < 20; i++) {
    const { ok } = await window.desktop.probePreview(styleUrl);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  stopWorking();
  previewph.hidden = true;
  browser.hidden = false;
  const style = openTab(styleUrl, "Style guide");
  openTab(quickUrl("home"), "Home");
  setActiveTab(style); // default to the styleguide — that's where the swatches are
  // Only when the styleguide was just created this session: reload once so its
  // fresh swatches show without a manual refresh (avoids churn on reopen).
  if (designJustActivated) {
    designJustActivated = false;
    setTimeout(() => { if (tabs.includes(style)) navigate(style, quickUrl("styleguide")); }, 1200);
  }
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

function showStage(stage) {
  applyStaticCopy();
  const app = el("app");
  app.classList.toggle("onboarding-key", stage === "key"); // rail muting during the key screen
  setChatCollapsed(stage === "key"); // collapsed at the key screen; the start flow closes/opens it after
  // The rail is inert until the key is connected (no focus/keyboard either).
  const sidebar = el("sidebar");
  if (sidebar) sidebar.inert = stage === "key";
  toggleGate(keygate, stage === "key");
  toggleGate(projectgate, stage === "project");
  // Chat content is ready from the project stage on (empty & waiting); only the
  // key stage hides it, and there the whole pane is collapsed anyway.
  chatmain.hidden = stage === "key";
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
    const [k, l, vc] = await Promise.all([
      window.desktop.getKeyStatus(),
      window.desktop.getLicenseStatus(),
      window.desktop.getVercelStatus(),
    ]);
    railClaude.classList.toggle("activated", !!(k && k.hasKey));
    railFigma.classList.toggle("activated", !!(l && l.hasLicense));
    railPublish.classList.toggle("activated", !!(vc && vc.connected));
  } catch {}
}

async function boot() {
  refreshRailActivation(); // color the Claude/Figma icons per key + license state
  const { hasKey } = await window.desktop.getKeyStatus();
  if (!hasKey) {
    noProjectPlaceholder();
    showStage("key");
    return;
  }
  const proj = await window.desktop.getProjectStatus();
  if (!proj.hasProject) {
    noProjectPlaceholder();
    showStage("project");
    return;
  }
  setProjTitle(proj);
  viteUrl = proj.viteUrl || null;
  design = proj.design || { active: false, variationId: null, previewReady: false };
  showStage("workspace");
  refreshPreview();
  // Optionally resume the last session; otherwise offer the two starting paths.
  if (!(await maybeAutoRestoreSession())) renderStartChoices();
}

// Vite may become ready after the project is chosen — or re-ready after a
// self-heal restart. Reload any open preview tabs onto the fresh server so they
// don't sit on stale/broken content; otherwise re-evaluate whether to open.
window.desktop.onViteReady((url) => {
  const prev = viteUrl;
  viteUrl = url;
  if (chatmain.hidden) return;
  if (tabs.length && prev) {
    tabs.forEach((t) => {
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
const RAILS = { help: railHelp, projects: railProjects, publish: railPublish, company: railCompany, figma: railFigma, voice: railVoice, claude: railClaude };
const PANELS = {
  help: { title: COPY.panels.help, render: renderHelp },
  projects: { title: COPY.panels.projects, render: renderProjects },
  publish: { title: COPY.panels.publish, render: renderPublish },
  company: { title: COPY.panels.company, render: renderCompany },
  figma: { title: COPY.panels.figma, render: renderFigma },
  voice: { title: COPY.panels.voice, render: renderVoice },
  claude: { title: COPY.panels.claude, render: renderClaude },
};

function closeModal() {
  Object.values(RAILS).forEach((b) => b.classList.remove("active"));
  if (modal.hidden) return;
  modal.classList.remove("open"); // slide out
  // Hide after the slide-out finishes — unless it was reopened in the meantime.
  setTimeout(() => { if (!modal.classList.contains("open")) modal.hidden = true; }, 240);
}
async function openModal(kind) {
  const { title, render } = PANELS[kind];
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
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
railPublish.addEventListener("click", () => toggleModal("publish"));
railCompany.addEventListener("click", () => toggleModal("company"));
railFigma.addEventListener("click", () => toggleModal("figma"));
railVoice.addEventListener("click", () => toggleModal("voice"));
railClaude.addEventListener("click", () => toggleModal("claude"));

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

async function renderHelp(body) {
  const intro = document.createElement("p");
  intro.className = "muted";
  intro.style.margin = "0 0 12px";
  intro.textContent = COPY.commands.helpIntro;
  body.appendChild(intro);
  COMMANDS.forEach(([cmd, desc]) => {
    const row = document.createElement("div");
    row.className = "cmd";
    // The command itself IS the button: click → paste + run it in the chat
    // (same as typing it and hitting enter), then reveal the chat.
    const btn = document.createElement("button");
    btn.className = "cmdbtn";
    btn.title = COPY.commands.runTitle(cmd);
    const label = document.createElement("span");
    label.textContent = cmd;
    const run = document.createElement("span");
    run.className = "run";
    run.textContent = COPY.commands.run;
    btn.append(label, run);
    btn.addEventListener("click", () => { closeModal(); sendText(cmd); });
    const d = document.createElement("div");
    d.className = "d";
    d.textContent = desc;
    row.append(btn, d);
    body.appendChild(row);
  });

  // ── Footer: version + credit ──
  const hr = document.createElement("div");
  hr.className = "help-divider";
  body.appendChild(hr);

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
  createBtn.addEventListener("click", createNewProject);
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
  design = await window.desktop.getDesignState();
  showStage("workspace");
  refreshPreview();
  if (!(await maybeAutoRestoreSession())) renderStartChoices();
  return true;
}
async function openRecentProject(dir) {
  closeModal();
  await enterProjectFromResult(await window.desktop.openProjectPath(dir));
}
async function createNewProject() {
  closeModal();
  await enterProjectFromResult(await window.desktop.createProject());
}
async function switchToExisting() {
  closeModal();
  await enterProjectFromResult(await window.desktop.openProject());
}

// --- Company profile: export the agency identity ---
async function renderCompany(body) {
  // --- App DEFAULT profile: your agency identity, auto-applied to new projects ---
  const def = await window.desktop.getDefaultCompany();
  const row = document.createElement("div");
  row.className = "setrow";
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = COPY.company.defaultTitle;
  const badge = document.createElement("span");
  badge.className = "badge " + (def.has ? "ok" : "off");
  badge.textContent = def.has ? (def.companyName ? COPY.company.activeWith(def.companyName) : COPY.common.active) : COPY.common.notSet;
  row.append(k, badge);
  body.appendChild(row);

  const defNote = document.createElement("div");
  defNote.className = "muted";
  defNote.textContent = COPY.company.defaultNote;
  body.appendChild(defNote);

  const proj = await window.desktop.getProjectStatus();

  if (proj.hasProject) {
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.textContent = COPY.company.saveDefault;
    const msg = document.createElement("div");
    msg.className = "muted";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = COPY.common.saving;
      msg.textContent = "";
      const res = await window.desktop.saveDefaultCompany();
      if (res.ok) {
        openModal("company"); // refresh → Active
      } else {
        msg.textContent = res.error || COPY.common.couldNotSave;
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = COPY.company.saveDefault;
      }
    });
    body.append(saveBtn, msg);
  }
  if (def.has) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "panelbtn danger";
    clearBtn.textContent = COPY.company.clearDefault;
    clearBtn.addEventListener("click", async () => {
      await window.desktop.clearDefaultCompany();
      openModal("company");
    });
    body.appendChild(clearBtn);
  }

  // --- Export THIS project's profile to a portable file (move between machines) ---
  const hr = document.createElement("div");
  hr.style.cssText = "height:1px;background:var(--border,#2a2a2a);margin:14px 0;";
  body.appendChild(hr);

  if (!proj.hasProject) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.company.exportNeedsProject;
    body.appendChild(note);
    return;
  }
  const intro = document.createElement("p");
  intro.className = "muted";
  intro.style.margin = "0 0 12px";
  intro.textContent = COPY.company.exportIntro;
  body.appendChild(intro);
  const exportBtn = document.createElement("button");
  exportBtn.className = "panelbtn";
  exportBtn.textContent = COPY.company.exportBtn;
  exportBtn.disabled = !proj.companyProfile;
  exportBtn.addEventListener("click", () => exportCompany(exportBtn));
  body.appendChild(exportBtn);
  if (!proj.companyProfile) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = COPY.company.noProfileYet;
    body.appendChild(note);
  }
}

// --- Figma export: license (cloud derive) — its own panel, separate from Claude ---
async function renderFigma(body) {
  const lic = await window.desktop.getLicenseStatus();
  railFigma.classList.toggle("activated", !!lic.hasLicense); // color the icon on save/clear

  body.appendChild(connStatusRow(COPY.figma.licenseLabel, lic.hasLicense, lic.hasLicense ? COPY.common.active : COPY.common.notSet, COPY.figma.removeLicense,
    async () => { await window.desktop.clearLicense(); openModal("figma"); }));

  if (lic.hasLicense) {
    body.appendChild(setRow("Key", `…${lic.hint || "????"}`));
  } else {
    const input = document.createElement("input");
    input.className = "field";
    input.type = "password";
    input.placeholder = COPY.figma.pasteKey;
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.textContent = COPY.figma.saveLicense;
    const msg = document.createElement("div");
    msg.className = "muted";
    const doSave = async () => {
      const key = input.value.trim();
      if (!key) return;
      saveBtn.disabled = true;
      saveBtn.textContent = COPY.figma.validating;
      msg.textContent = "";
      const res = await window.desktop.saveLicense(key);
      if (res.ok) {
        openModal("figma"); // refresh → shows Active
      } else {
        msg.textContent = res.error || COPY.figma.couldNotSave;
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = COPY.figma.saveLicense;
      }
    };
    saveBtn.addEventListener("click", doSave);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
    body.append(input, saveBtn, msg);
  }

  const note = document.createElement("div");
  note.className = "muted";
  note.textContent = COPY.figma.note;
  body.appendChild(note);
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
  return (evt) => {
    const { step, status, detail } = evt;
    let r = rows[step];
    if (!r) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:13px;";
      const icon = document.createElement("span");
      icon.style.cssText = "flex:0 0 14px;";
      const label = document.createElement("span");
      label.style.cssText = "flex:0 0 120px;color:var(--muted,#9a9aa2);";
      label.textContent = LABELS[step] || step;
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
    err.style.cssText = "margin-top:10px;color:#e5484d;";
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
      ap.btn.textContent = res.ok ? (label === "Publish this design" ? "Publish changes" : label) : label;
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
    setup.addEventListener("click", () => { closeModal(); sendText("/setup-project"); });
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
  let refreshDomains = null;

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
      if (refreshDomains) refreshDomains(); // reload the Preview domain list for the new scope
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
    // Existing live URL (if already published).
    if (pub.url) {
      const liveRow = document.createElement("div");
      liveRow.style.cssText = "display:flex;gap:8px;align-items:center;min-height:38px;margin-bottom:4px;";
      const live = document.createElement("a");
      live.href = pub.url;
      live.textContent = pub.url.replace(/^https?:\/\//, "");
      live.style.cssText = "flex:1;color:#1a1a1a;text-decoration:underline;font-size:13px;word-break:break-all;";
      live.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(pub.url); });
      liveRow.append(live, copyBtn(() => pub.url));
      body.appendChild(liveRow);

      if (pub.gatePassword) {
        const pwRow = document.createElement("div");
        pwRow.style.cssText = "display:flex;gap:8px;align-items:center;min-height:38px;margin-bottom:4px;";
        const lab = document.createElement("span");
        lab.className = "muted"; lab.style.cssText = "font-size:12px;flex:0 0 auto;";
        lab.textContent = COPY.publish.passwordLabel;
        const pw = document.createElement("code");
        pw.textContent = pub.gatePassword;
        pw.style.cssText = "flex:1;font-size:13px;letter-spacing:.5px;word-break:break-all;";
        pwRow.append(lab, pw, copyBtn(() => pub.gatePassword));
        body.appendChild(pwRow);
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
    domLabel.textContent = COPY.publish.domainLabel;
    const domBody = document.createElement("div"); // filled once Vercel responds
    domSec.append(domLabel, domBody);
    body.appendChild(domSec);

    const domNote = document.createElement("div");
    domNote.className = "muted";
    domNote.style.cssText = "font-size:11.5px;margin:2px 0 12px;";
    body.appendChild(domNote);

    const baseSlug = pub.projectName || "preview";
    const slugifyLabel = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    // Load (and reload, on a scope change) the owned domains WITHOUT blocking the
    // rest of the panel — show the pulsing dots so the wait never reads as a glitch.
    refreshDomains = () => {
      domBody.innerHTML = "";
      domBody.appendChild(loadingDots());
      domNote.textContent = "";
      window.desktop.getVercelDomains().then(({ domains }) => {
        domBody.innerHTML = "";
        let curBase = "", curLabel = "";
        if (pub.customDomain && domains && domains.length) {
          const match = domains.find((d) => pub.customDomain === d.name || pub.customDomain.endsWith("." + d.name));
          if (match) { curBase = match.name; curLabel = pub.customDomain === match.name ? "" : pub.customDomain.slice(0, -(match.name.length + 1)); }
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
        subInput.className = "field"; subInput.placeholder = COPY.publish.subdomain; subInput.style.cssText = "flex:0 1 140px;";
        subInput.value = curLabel || (curBase ? baseSlug : "");
        const domPreview = document.createElement("span");
        domPreview.className = "muted"; domPreview.style.cssText = "font-size:12px;word-break:break-all;";
        subWrap.append(subInput, domPreview);

        const updateDomPreview = () => {
          const base = domSel.value;
          subWrap.style.display = base ? "flex" : "none";
          if (!base) return;
          const label = slugifyLabel(subInput.value.trim());
          domPreview.textContent = label ? `→ ${label}.${base}` : `→ name.${base}`;
        };
        const saveDom = () => {
          const base = domSel.value;
          if (!base) { window.desktop.setPublishDomain(null); return; }
          const label = slugifyLabel(subInput.value.trim());
          if (label) window.desktop.setPublishDomain(`${label}.${base}`);
        };
        domSel.addEventListener("change", () => { if (domSel.value && !subInput.value.trim()) subInput.value = baseSlug; updateDomPreview(); saveDom(); });
        subInput.addEventListener("input", updateDomPreview);
        subInput.addEventListener("change", saveDom);
        subInput.addEventListener("blur", saveDom);

        domBody.append(domSel, subWrap);
        updateDomPreview();
        domNote.textContent = (domains && domains.length)
          ? COPY.publish.ownedDomainNote
          : COPY.publish.noDomainsNote;
      }).catch(() => {
        domBody.innerHTML = "";
        domNote.textContent = COPY.publish.domainsError;
      });
    };
    refreshDomains();

    const host = document.createElement("div"); // progress + result target
    host.hidden = true;

    const publishBtn = document.createElement("button");
    publishBtn.className = "panelbtn primary";
    publishBtn.textContent = pub.url ? COPY.publish.publishChanges : COPY.publish.publishDesign;
    publishBtn.disabled = !pub.canPublish;
    publishBtn.addEventListener("click", () => runPublishFlow(publishBtn, host, { resetPassword: false }));
    body.appendChild(publishBtn);

    let resetBtn = null;
    if (pub.url) {
      resetBtn = document.createElement("button");
      resetBtn.className = "panelbtn";
      resetBtn.textContent = COPY.publish.resetPassword;
      resetBtn.title = COPY.publish.resetPasswordTitle;
      resetBtn.addEventListener("click", () => runPublishFlow(resetBtn, host, { resetPassword: true }));
      body.appendChild(resetBtn);
    }

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
  }

  addHelp();
}

// --- Copy voice: per-project tone + rules, plus global rules ---
const TONE_EXAMPLES = COPY.voice.toneExamples;
const RULE_EXAMPLES = COPY.voice.ruleExamples;

// A row of clickable "+ example" chips; onPick(text) adds/sets it.
function exampleChips(examples, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "chips";
  examples.forEach((ex) => {
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.textContent = "+ " + ex;
    b.addEventListener("click", () => onPick(ex));
    wrap.appendChild(b);
  });
  return wrap;
}

// An editable list bound to `arr` (mutated in place). disabled → read-only + struck.
function ruleListEl(arr, opts = {}) {
  const box = document.createElement("div");
  box.className = "rulelist" + (opts.disabled ? " disabled" : "");
  const rows = document.createElement("div");
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
    box.appendChild(exampleChips(opts.examples || [], add));
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
  toneInput.addEventListener("input", () => { state.tone = toneInput.value; });
  body.appendChild(toneInput);
  body.appendChild(exampleChips(TONE_EXAMPLES, (ex) => { state.tone = ex; toneInput.value = ex; }));

  const prLabel = document.createElement("div"); prLabel.className = "voice-label"; prLabel.textContent = COPY.voice.projectRulesLabel;
  body.appendChild(prLabel);
  body.appendChild(ruleListEl(state.projRules, { examples: RULE_EXAMPLES, placeholder: COPY.voice.projectRulePlaceholder, emptyText: COPY.voice.projectRulesEmpty }));

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
    }));
  };
  chk.addEventListener("change", () => { state.decline = chk.checked; renderGlobal(); });
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
  body.appendChild(connStatusRow(COPY.claude.keyLabel, status.hasKey, status.hasKey ? COPY.claude.connected : COPY.claude.notConnected, COPY.claude.disconnect, disconnectKey));

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

  // Disconnect lives in the status header (top-right unplug), matching Vercel/Figma.
  const keyNote = document.createElement("div");
  keyNote.className = "muted";
  keyNote.textContent = COPY.claude.keyNote;
  body.appendChild(keyNote);

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

async function disconnectKey() {
  closeModal();
  await window.desktop.clearKey();
  await boot();
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
      if (!assistantEl) { assistantEl = addMsg("assistant", ""); updateThinking(); lastAutoScrollTop = log.scrollTop; }
      assistantEl.textContent += evt.text;
      stickStreamScroll();
      break;
    case "tool":
      finalizeAssistant();
      autoDismissTool(addMsg("tool", toolBubbleLabel(evt)));
      updateThinking(); // re-pin the dots below the tool bubble while it's still working
      // A tool call may have just written the color palette — poll until the
      // styleguide is preview-ready (not merely when the variation folder
      // appears), then open the live preview mid-turn.
      if (!design.previewReady) {
        window.desktop.getDesignState().then((d) => {
          const flipped = d.previewReady && !design.previewReady;
          design = d;
          if (!flipped) return;
          designJustActivated = true;
          // In the Get-Designing build: reveal the Style guide LIVE now and keep
          // the Home tab covered (it's still being written). Otherwise (setup),
          // the normal reveal opens both tabs.
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
    case "activity":
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
      // Turn ended mid-intake → the brief is complete: show the review actions.
      if (intakeActive && intakeph.classList.contains("flow")) showBriefComplete();
      endTurnGate(); // release serialization AFTER showBriefComplete decided for this turn
      updateSessionGauge(evt.usage, evt.modelUsage); // refresh the context gauge + maybe nudge
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
      if (homeBuilding) { finishBuildReveal(); break; }
      if (guarding) { revealPreviewAfterEdit(); break; }
      refreshPreview();
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
    if (Array.isArray(brief.colorSources) && brief.colorSources.length) {
      add("Colors", brief.colorSources.map((c) => c && c.value).filter(Boolean).join(", "));
    }
    if (Array.isArray(brief.fontSources) && brief.fontSources.length) {
      add("Fonts", brief.fontSources.map((f) => f && f.value).filter(Boolean).join(", "));
    }
    if (Array.isArray(brief.sections) && brief.sections.length) add("Sections", brief.sections.join(", "));
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
function openReferencesHelp() {
  const overlay = document.createElement("div");
  overlay.className = "iref-help";
  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() { overlay.classList.remove("show"); document.removeEventListener("keydown", onKey); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener("click", close);

  const card = document.createElement("div");
  card.className = "iref-help-card";
  card.addEventListener("click", (e) => e.stopPropagation()); // clicks inside don't dismiss
  card.innerHTML = COPY.intake.referencesHelpHtml;
  card.querySelector(".iref-help-x").addEventListener("click", close);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("show"));
}

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
    setTimeout(showBriefComplete, 520); // let "✓ Got it" flash, then the review
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
function startClientIntake(type) {
  const gen = ++clientIntakeGen;
  const kind = type === "app" ? "app" : "web site";
  const script = [
    [{ id: "what", field: "what", type: "open-text", long: true, maxLength: 400, label: COPY.intake.q.what, placeholder: COPY.intake.q.whatPlaceholder }],
    [
      { id: "clientName", field: "clientName", type: "open-text", label: COPY.intake.q.clientName, skippable: true, agentDecidesLabel: COPY.intake.skip },
      { id: "projectName", field: "projectName", type: "open-text", label: COPY.intake.q.projectName, skippable: true, agentDecidesLabel: COPY.intake.skip },
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
    label.textContent = (COPY.intake.direction.axisLabels || {})[name] || name;
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
  const btn = el("reroll-btn");
  if (!btn) return;
  const meta = await getDirectionMeta();
  const licensed = !!(meta.axes && Object.keys(meta.axes).length);
  const v = currentPreviewVariation(url);
  btn.hidden = !(licensed && v && v !== "v00");
}
{
  const b = el("reroll-btn");
  if (b) b.addEventListener("click", () => startReroll(currentPreviewVariation()));
}

// ---- Start designing (#3) ---------------------------------------------------
// Animate the whole pane clean (brief rail included), then hand off to the build
// with a persistent "preparing" status + rotating messages until the design shows.
function startDesigning() {
  intakePhase = "designing";
  setChatCollapsed(false); // questions are answered → slide the chat open for the build
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
    // Kick the agent FIRST (while intakeActive still guards refreshPreview from
    // showing its own "working" placeholder), THEN swap the pane to preparing.
    runAgent(prompt);
    showPreparing();
  };
  if (anims.length) Promise.allSettled(anims.map((a) => a.finished)).then(go);
  else go();
}

const PREPARING_MESSAGES = COPY.preview.preparingMessages;
function showPreparing() {
  resetIntake(); // leave the intake host; the preview placeholder takes the pane
  browser.hidden = true;
  previewph.hidden = false;
  setPhEmoji("✨");
  phTitle.textContent = COPY.preview.preparingElements;
  phProgress.hidden = false;
  stopWorking(); // clear any stale rotation so ours (build-flavored) takes over
  startWorking(PREPARING_MESSAGES);
  // The mid-turn readiness poll (in the "tool" handler) reveals the Style guide the
  // moment previewReady flips, keeping the Home tab covered until the build ends.
  resetBuildReveal();
}

// Dispatch to the per-type renderer. Every builder returns
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

  return {
    el: elc,
    getValue: () => (skipped ? null : built.getValue()),
    // A card is ready only when it has a value OR was explicitly skipped (the Skip
    // button). Skippable no longer means ready-by-default, so Continue / Enter can
    // never pass a question the designer hasn't answered or skipped on purpose.
    isReady: () => skipped || built.hasValue(),
    // Post-submit: replace the inputs with a plain read-only value + drop the skip.
    collapse: () => {
      const text = skipped ? "" : built.display();
      body.innerHTML = "";
      const ans = document.createElement("div");
      ans.className = "icard-answer" + (text ? "" : " empty");
      ans.textContent = text || COPY.intake.skipped;
      body.appendChild(ans);
      if (skipBtn) skipBtn.remove();
    },
  };
}

// open-text → single line, or a textarea when `long`. Optional maxLength counter.
function buildOpenText(card, body, onChange, requestSubmit) {
  const long = card.long === true;
  const field = document.createElement(long ? "textarea" : "input");
  field.className = long ? "icard-textarea" : "icard-input";
  if (card.placeholder) field.placeholder = card.placeholder;
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

  return {
    getValue: () => selected,
    hasValue: () => !!selected,
    setDisabled: (d) => { options.forEach((o) => { o.btn.disabled = d; }); input.disabled = d; add.disabled = d; },
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
  input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
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
  const projRules = (proj.rules || []).filter(Boolean);

  const persist = () => {
    try { window.desktop.saveProjectVoice({ ...proj, tone: toneInput.value.trim(), rules: projRules.slice() }); } catch {}
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

  // Global rules, applied (read-only) — only shown when one or more is set.
  if (globals.length) {
    const note = document.createElement("div"); note.className = "voice-applied-note";
    note.textContent = COPY.voice.globalsApplied;
    const gw = document.createElement("div"); gw.className = "ichips"; gw.style.marginBottom = "12px";
    globals.forEach((g) => { const s = document.createElement("span"); s.className = "ichip applied"; s.textContent = g; gw.appendChild(s); });
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

  // A fresh project starts with the fork in the big pane and the chat slid shut;
  // Client Setup / Get-Designing decide when it opens again.
  setChatCollapsed(true);

  // The start fork lives in the BIG PANE now (feedback #1), as two side-by-side
  // choice cards — not a chat card. The chat rail stays for the conversation.
  enterIntakeMode();
  intakePhase = "idle";
  updateBackButton();
  intakeph.classList.add("start"); // center the fork vertically + center the head text
  intakeph.classList.remove("flow", "hasbrief");
  setIntakeHead(COPY.intake.start.headTitle, COPY.intake.start.headSubtitle);
  el("intake-brief").innerHTML = "";
  intakeStack.innerHTML = "";

  // Icons are static, trusted SVG (Lucide): a numbered list for step-by-step
  // setup, a pencil-drawing-a-line for the free-form "just design it" path.
  const ICON_LIST_ORDERED =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>';
  const ICON_PENCIL_LINE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  const opts = [
    {
      label: COPY.intake.start.clientSetupLabel,
      desc: COPY.intake.start.clientSetupDesc,
      icon: ICON_LIST_ORDERED,
      // Chat-driven: slide the chat open, point the big pane at it, then kick off.
      onClick: () => {
        resetIntake();                              // leave the fork
        setChatCollapsed(false);                    // slide the chat pane open
        showPlaceholder(COPY.preview.clientSetupStart); // big-pane "get started in the chat" message
        sendText("/setup-project");
      },
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
    icon.className = "istart-icon";
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
  } else if (intakePhase === "deliverable") {
    resetIntake();
    renderStartChoices();
  }
}
function updateBackButton() {
  intakeBack.hidden = !(intakePhase === "deliverable" || intakePhase === "gathering");
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

async function runAgent(toSend, echoText) {
  // Never overlap turns: wait for any in-flight turn's result to be handled first.
  try { await turnGate; } catch { /* prior turn already reported its error */ }
  beginTurnGate();
  dismissWelcome();
  // One-time lean reset at the build→edit boundary: archive the heavy build session and
  // start this edit fresh with a disk-pointer preamble, so it (and the edits after it)
  // run on a slim base instead of re-caching the whole build every turn.
  if (leanEditPending) {
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
  conversationStarted = true;
  updateThinking(); // dots up immediately, until the first text/tool arrives
  refreshPreview(); // show the working placeholder while the browser is closed (no-op during intake)
  send.disabled = true;
  try {
    const res = await window.desktop.sendPrompt(toSend, sessionId);
    if (res && res.sessionId) sessionId = res.sessionId;
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
