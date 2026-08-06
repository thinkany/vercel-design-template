// Renderer logic: a three-stage flow — connect key → choose project → workspace
// (chat + live preview). The preview shows a welcome placeholder for a fresh
// project and swaps to the live design (/?v=<id>) once setup creates a variation.

const el = (id) => document.getElementById(id);

// Bar
const status = el("status");
const projname = el("projname");

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
const phTitle = el("ph-title");
const phText = el("ph-text");
const phProgress = el("ph-progress");

let sessionId = null;
let assistantEl = null;

// Preview state
let viteUrl = null;
let design = { active: false, variationId: null, previewReady: false };
let agentBusy = false;
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
  add.title = "New tab";
  // New user tab: no fixed title, so it reflects the real page (and updates as
  // they navigate) instead of always reading "Home".
  add.addEventListener("click", () => openTab(quickUrl("home")));
  tabbar.appendChild(add);
}

function setActiveTab(tab) {
  activeTab = tab;
  tabs.forEach((t) => { t.wv.style.display = t === tab ? "flex" : "none"; });
  renderTabs();
  syncNav();
  setFeedbackMode(false); // don't carry feedback mode across tab switches
  feedbackBtn.hidden = !tab; // the toggle only makes sense with a live preview
}

// ---- Point & comment: element feedback from the preview → chat ----------------
let feedbackOn = false;
function setFeedbackButton(on) {
  feedbackOn = !!on;
  feedbackBtn.classList.toggle("active", feedbackOn);
  feedbackLabel.textContent = feedbackOn ? "Pointing… (Esc to exit)" : "Point & Comment";
}
function setFeedbackMode(on) {
  if (activeTab && activeTab.wv) {
    try { activeTab.wv.send("feedback:toggle", !!on); } catch { /* webview not ready */ }
  }
  setFeedbackButton(on);
}
function handleFeedbackSubmit(ctx) {
  if (!ctx || !ctx.note) return;
  const lines = ["Design feedback, pointed at an element in the live preview:", ""];
  if (ctx.dataBlockName || ctx.dataBlock) {
    lines.push(`- Section: ${ctx.dataBlockName || ctx.dataBlock}${ctx.dataBlock ? ` (data-block="${ctx.dataBlock}")` : ""}`);
  }
  lines.push(`- Element: <${ctx.tag}>${ctx.classes ? ` class="${ctx.classes}"` : ""}`);
  if (ctx.text) lines.push(`- Text: "${ctx.text}"`);
  if (ctx.selector) lines.push(`- Selector: ${ctx.selector}`);
  if (ctx.variation) lines.push(`- Variation: ${ctx.variation}`);
  lines.push("", `My note: ${ctx.note}`, "", "Make this change in the working variation's components (not the base).");
  sendText(lines.join("\n"));
}
feedbackBtn.addEventListener("click", () => setFeedbackMode(!feedbackOn));
// Escape exits pointing even when focus is in the shell (the webview's own Esc
// handler only fires when the preview itself has keyboard focus).
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && feedbackOn) setFeedbackMode(false);
});

function openTab(url, title) {
  const wv = document.createElement("webview");
  wv.setAttribute("partition", "persist:preview");
  wv.setAttribute("allowpopups", "true"); // let target=_blank reach the window-open handler (→ new tab)
  if (PREVIEW_PRELOAD) wv.setAttribute("preload", PREVIEW_PRELOAD); // point & comment inspector
  wv.setAttribute("src", url);
  // Messages from the inspector (point & comment) running inside the preview.
  wv.addEventListener("ipc-message", (e) => {
    if (e.channel === "feedback:submit") handleFeedbackSubmit(e.args[0]);
    else if (e.channel === "feedback:state") setFeedbackButton(!!e.args[0]);
  });
  const tab = { id: ++tabSeq, wv, title: title || "Loading…", fixedTitle: !!title, url, retries: 0 };
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
  views.appendChild(wv);
  tabs.push(tab);
  setActiveTab(tab);
  return tab;
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
  feedbackBtn.hidden = true; setFeedbackButton(false);
  renderTabs();
}

function syncNav() {
  if (!activeTab) { urlbar.value = ""; return; }
  let u = activeTab.wv.getAttribute("src") || "";
  try { u = activeTab.wv.getURL() || u; } catch { /* not ready yet */ }
  urlbar.value = u;
}

navback.addEventListener("click", () => { if (activeTab && activeTab.wv.canGoBack()) activeTab.wv.goBack(); });
navfwd.addEventListener("click", () => { if (activeTab && activeTab.wv.canGoForward()) activeTab.wv.goForward(); });
navreload.addEventListener("click", () => { if (activeTab) navigate(activeTab, activeTab.url); });
urlbar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !activeTab) return;
  const u = resolveUrl(urlbar.value);
  // A typed URL should show the real page title, even if this tab was pinned to a
  // nav label (Home/Style guide/Dashboard) by a quick-link earlier.
  if (u) { activeTab.fixedTitle = false; navigate(activeTab, u); }
});
const NAV_LABEL = { home: "Home", styleguide: "Style guide", dashboard: "Dashboard" };
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
window.desktop.onPreviewOpenUrl((url) => openTab(url));

// Rotating status shown in the preview while the agent works and the browser
// is still closed (during setup).
// Generic rotation shown between live-activity updates. Timer-based, NOT tied to
// real progress — so keep every line progress-neutral (no "almost there" / "just
// a moment" that would over-promise while setup is still going).
const WORKING_MESSAGES = [
  "We're getting your workspace set up…",
  "Setting things up for you…",
  "Getting everything ready…",
  "Your live preview will open on its own once it's ready…",
  "Thanks for hanging in there with us…",
];
function startWorking() {
  if (workingTimer) return;
  let i = 0;
  phText.textContent = WORKING_MESSAGES[0];
  workingTimer = setInterval(() => {
    i = (i + 1) % WORKING_MESSAGES.length;
    phText.textContent = WORKING_MESSAGES[i];
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
  phEmoji.textContent = emoji;
  phTitle.textContent = title;
  phText.textContent = text;
  phProgress.hidden = true;
  browser.hidden = true;
  previewph.hidden = false;
}

function showWorking() {
  browser.hidden = true;
  previewph.hidden = false;
  phEmoji.textContent = "✨";
  phTitle.textContent = "Getting set up";
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
  phEmoji.textContent = "✨";
  phTitle.textContent = "Updating your design";
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
  // Open the live browser only when the design's styleguide is READY (palette
  // written — not just the variation folder created) AND the server is up.
  if (design.previewReady && viteUrl) return showBrowser();
  // Otherwise the browser stays closed.
  if (agentBusy) return showWorking();
  if (!viteUrl) {
    return showPlaceholder({
      emoji: "⏳",
      title: "We're spinning up your preview…",
      text: "Just a moment while your dev server starts up.",
    });
  }
  // Idle, preview not open yet. Only greet on a TRULY fresh start — once the
  // conversation has begun or a design exists, setup is underway, so show a
  // gentle "in progress" line instead of re-welcoming.
  if (conversationStarted || design.active) {
    return showPlaceholder({
      emoji: "✨",
      title: "Setting up your project",
      text: "Your live preview opens on its own once your design's ready. Pick up in the chat.",
    });
  }
  showPlaceholder({
    emoji: "👋",
    title: "Pick a starting point to your left",
    text: "Choose Client Setup or Get Designing in the chat pane. Your live preview opens here on its own once your design is ready for viewing.",
  });
}

// ---- Stage routing -----------------------------------------------------------
function showStage(stage) {
  keygate.hidden = stage !== "key";
  projectgate.hidden = stage !== "project";
  chatmain.hidden = stage !== "workspace";
  // Workspace label left BLANK on purpose — the #status slot is reserved for a
  // future app-level message/alert (update, license, activity). The connect /
  // no-project states keep their labels since those screens rely on them.
  status.textContent =
    stage === "key" ? "not connected" : stage === "project" ? "no project" : "";
  if (stage === "key") keyinput.focus();
  if (stage === "workspace") input.focus();
}

function noProjectPlaceholder() {
  viteUrl = null;
  design = { active: false, variationId: null, previewReady: false };
  agentBusy = false;
  conversationStarted = false; // a new/blank project greets fresh again
  closeAllTabs();
  showPlaceholder({
    emoji: "👋",
    title: "The live preview appears here",
    text: "Open or create a project to begin.",
  });
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
  projname.textContent = proj.name || "";
  viteUrl = proj.viteUrl || null;
  design = proj.design || { active: false, variationId: null, previewReady: false };
  showStage("workspace");
  refreshPreview();
  // Optionally resume the last session; otherwise offer the two starting paths.
  if (!(await maybeAutoRestoreSession())) renderWelcomeChips();
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
    keyerror.textContent = "Paste your key first.";
    return;
  }
  keysave.disabled = true;
  keysave.textContent = "Checking…";
  try {
    const res = await window.desktop.saveKey(key);
    if (res.ok) {
      keyinput.value = "";
      await boot();
    } else {
      keyerror.textContent = res.error || "Could not save the key.";
    }
  } catch (e) {
    keyerror.textContent = String(e);
  } finally {
    keysave.disabled = false;
    keysave.textContent = "Save & connect";
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
  busyBtn.textContent = kind === "create" ? "Creating…" : "Opening…";
  try {
    const res =
      kind === "create"
        ? await window.desktop.createProject()
        : await window.desktop.openProject();
    if (res.canceled) return;
    if (res.ok) {
      closeAllTabs(); // fresh browser tabs for the new project
      projname.textContent = res.name || "";
      viteUrl = res.viteUrl || null;
      design = await window.desktop.getDesignState();
      showStage("workspace");
      refreshPreview();
      // Optionally resume the last session; otherwise offer the two starting paths.
      if (!(await maybeAutoRestoreSession())) renderWelcomeChips();
    } else {
      projecterror.textContent = res.error || "Could not open the project.";
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
  help: { title: "Commands", render: renderHelp },
  projects: { title: "Switch Project", render: renderProjects },
  publish: { title: "Publish", render: renderPublish },
  company: { title: "Company Profile", render: renderCompany },
  figma: { title: "Figma Export", render: renderFigma },
  voice: { title: "Copy Voice", render: renderVoice },
  claude: { title: "Claude Settings", render: renderClaude },
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
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  railCollapse.title = label;
  railCollapse.setAttribute("aria-label", label);
}
railCollapse.addEventListener("mouseenter", () => { if (!gearConsumed) setGear(gearBase + gearDir()); });
railCollapse.addEventListener("mouseleave", () => { gearConsumed = false; setGear(gearBase); });
// Staggered icon animation on collapse/expand. Quick, not alarming (~0.5s total).
const RAIL_ANIM_MS = 500; // last icon: 5*45ms stagger + 250ms transition
let railAnimTimer = null;
function railLabel() {
  const label = document.body.classList.contains("rail-collapsed") ? "Expand sidebar" : "Collapse sidebar";
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
const COMMANDS = [
  ["/setup-project", "Brand the template: client/company name, project type, fonts, logo, menu style."],
  ["/setup-styleguide", "Set the client's fonts, colors, and example styleguide sections."],
  ["/design", "Build or edit a page (hero, sections, landing) in the design phase."],
  ["/guide", "Show the list of commands."],
  ["/clear", "Start a fresh session, clearing the chat for faster replies (saved work is kept)."],
  ["/export-company", "Save your agency identity (name, admin fonts, logo) as a portable file."],
  ["/import-company", "Apply a saved company profile into this project."],
  ["export to Figma", "Ask in plain language to push the styleguide, blocks, or pages to Figma."],
  ["/upgrade", "Apply the latest template version (keeps your design work)."],
];

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
  intro.textContent = "Click a command to run it in the chat, or type it yourself. Setup runs first, then design freely.";
  body.appendChild(intro);
  COMMANDS.forEach(([cmd, desc]) => {
    const row = document.createElement("div");
    row.className = "cmd";
    // The command itself IS the button: click → paste + run it in the chat
    // (same as typing it and hitting enter), then reveal the chat.
    const btn = document.createElement("button");
    btn.className = "cmdbtn";
    btn.title = `Run: ${cmd}`;
    const label = document.createElement("span");
    label.textContent = cmd;
    const run = document.createElement("span");
    run.className = "run";
    run.textContent = "▸ run";
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
  try { ver.textContent = "Version " + (await window.desktop.getAppVersion()); } catch { ver.textContent = ""; }
  footer.appendChild(ver);

  const credit = document.createElement("div");
  credit.className = "help-credit";
  // orange (#F98F3A) heart between "made with" and the thinkany.co link
  credit.innerHTML = 'made with <svg class="heart" viewBox="0 0 24 24" fill="#F98F3A" aria-label="love"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> by ';
  const link = document.createElement("a");
  link.className = "help-link";
  link.href = "https://thinkany.co";
  link.textContent = "thinkany.co";
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
    note.textContent = "Create or open a project from the chooser to get started.";
    body.appendChild(note);
    return;
  }
  body.appendChild(setRow("Current project", proj.name || "None"));
  body.appendChild(setRow("Folder", proj.path || "None"));
  const switchBtn = document.createElement("button");
  switchBtn.className = "panelbtn";
  switchBtn.textContent = "Switch project…";
  switchBtn.addEventListener("click", switchProject);
  body.appendChild(switchBtn);
}

// --- Company profile: export the agency identity ---
async function renderCompany(body) {
  // --- App DEFAULT profile: your agency identity, auto-applied to new projects ---
  const def = await window.desktop.getDefaultCompany();
  const row = document.createElement("div");
  row.className = "setrow";
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = "Default company profile";
  const badge = document.createElement("span");
  badge.className = "badge " + (def.has ? "ok" : "off");
  badge.textContent = def.has ? (def.companyName ? `Active · ${def.companyName}` : "Active") : "Not set";
  row.append(k, badge);
  body.appendChild(row);

  const defNote = document.createElement("div");
  defNote.className = "muted";
  defNote.textContent = "Applied automatically to every new project. Set your agency identity once and skip it on every future setup.";
  body.appendChild(defNote);

  const proj = await window.desktop.getProjectStatus();

  if (proj.hasProject) {
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.textContent = "Save this project's identity as my default";
    const msg = document.createElement("div");
    msg.className = "muted";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      msg.textContent = "";
      const res = await window.desktop.saveDefaultCompany();
      if (res.ok) {
        openModal("company"); // refresh → Active
      } else {
        msg.textContent = res.error || "Could not save.";
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save this project's identity as my default";
      }
    });
    body.append(saveBtn, msg);
  }
  if (def.has) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "panelbtn danger";
    clearBtn.textContent = "Clear default";
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
    note.textContent = "Open a project to export its company profile to a file.";
    body.appendChild(note);
    return;
  }
  const intro = document.createElement("p");
  intro.className = "muted";
  intro.style.margin = "0 0 12px";
  intro.textContent = "Export this project's agency identity as a portable file (to move between machines or share).";
  body.appendChild(intro);
  const exportBtn = document.createElement("button");
  exportBtn.className = "panelbtn";
  exportBtn.textContent = "⬇ Export company profile to a file";
  exportBtn.disabled = !proj.companyProfile;
  exportBtn.addEventListener("click", () => exportCompany(exportBtn));
  body.appendChild(exportBtn);
  if (!proj.companyProfile) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = "No company-profile.json yet. Run /export-company in the chat to create one first.";
    body.appendChild(note);
  }
}

// --- Figma export: license (cloud derive) — its own panel, separate from Claude ---
async function renderFigma(body) {
  const lic = await window.desktop.getLicenseStatus();
  railFigma.classList.toggle("activated", !!lic.hasLicense); // color the icon on save/clear

  body.appendChild(connStatusRow("Figma export license", lic.hasLicense, lic.hasLicense ? "Active" : "Not set", "Remove license",
    async () => { await window.desktop.clearLicense(); openModal("figma"); }));

  if (lic.hasLicense) {
    body.appendChild(setRow("Key", `…${lic.hint || "????"}`));
  } else {
    const input = document.createElement("input");
    input.className = "field";
    input.type = "password";
    input.placeholder = "Paste your license key";
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.textContent = "Save license";
    const msg = document.createElement("div");
    msg.className = "muted";
    const doSave = async () => {
      const key = input.value.trim();
      if (!key) return;
      saveBtn.disabled = true;
      saveBtn.textContent = "Validating…";
      msg.textContent = "";
      const res = await window.desktop.saveLicense(key);
      if (res.ok) {
        openModal("figma"); // refresh → shows Active
      } else {
        msg.textContent = res.error || "Could not save the license.";
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save license";
      }
    };
    saveBtn.addEventListener("click", doSave);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
    body.append(input, saveBtn, msg);
  }

  const note = document.createElement("div");
  note.className = "muted";
  note.textContent = "Unlocks Figma export. Validated with the derive service; stored encrypted in your OS keychain.";
  body.appendChild(note);
}

// --- Publish: direct-to-Vercel (connect + one-click publish) ---
// A tiny "copy to clipboard" affordance shared by the URL + password rows.
function copyBtn(getText) {
  const b = document.createElement("button");
  b.className = "panelbtn";
  b.style.cssText = "padding:2px 10px;font-size:12px;flex:0 0 auto;";
  b.textContent = "Copy";
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(getText()); b.textContent = "Copied ✓"; setTimeout(() => (b.textContent = "Copy"), 1400); }
    catch { b.textContent = "Copy failed"; }
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

// Shared run handler for both "Publish" and "Reset password" (a republish with a
// fresh gate password). Streams progress, then shows the live URL + any new password.
async function runPublishFlow(btn, host, opts) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Publishing…";
  host.innerHTML = "";
  host.hidden = false;
  const list = document.createElement("div");
  host.appendChild(list);
  const onEvt = publishProgressList(list);
  const unsub = window.desktop.onPublishProgress(onEvt);
  try {
    const res = await window.desktop.runPublish(opts || {});
    if (res.ok) {
      const done = document.createElement("div");
      done.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#2a2a2a);";

      // Live URL row: open + copy.
      const urlRow = document.createElement("div");
      urlRow.style.cssText = "display:flex;gap:8px;align-items:center;";
      const link = document.createElement("a");
      link.href = res.url;
      link.textContent = res.url.replace(/^https?:\/\//, "");
      link.style.cssText = "flex:1;color:#1a1a1a;text-decoration:underline;font-size:13px;word-break:break-all;";
      link.addEventListener("click", (e) => { e.preventDefault(); window.desktop.openExternal(res.url); });
      urlRow.append(link, copyBtn(() => res.url));
      done.appendChild(urlRow);

      // Freshly generated preview password (shown once — never persisted).
      if (res.password) {
        const pwWrap = document.createElement("div");
        pwWrap.style.cssText = "margin-top:10px;padding:10px;border:1px solid var(--border,#2a2a2a);border-radius:8px;";
        const pwLabel = document.createElement("div");
        pwLabel.className = "muted";
        pwLabel.style.cssText = "font-size:12px;margin-bottom:6px;";
        pwLabel.textContent = "Preview password (share with your client)";
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
      // Only the primary publish button becomes "Publish changes" after the first
      // publish; the reset button keeps its own label (don't create a duplicate).
      btn.textContent = label === "Publish this design" ? "Publish changes" : label;
    } else {
      const err = document.createElement("div");
      err.className = "muted";
      err.style.cssText = "margin-top:10px;color:#e5484d;";
      err.textContent = res.error || "Publish failed.";
      host.appendChild(err);
      btn.textContent = label;
    }
  } catch (e) {
    const err = document.createElement("div");
    err.className = "muted";
    err.style.cssText = "margin-top:10px;color:#e5484d;";
    err.textContent = String(e);
    host.appendChild(err);
    btn.textContent = label;
  } finally {
    unsub();
    btn.disabled = false;
    refreshRailActivation();
  }
}

// --- Publish help: a tabbed, step-by-step walkthrough (assumes no Vercel account) ---
const PUBHELP = {
  start: {
    intro: "Publishing puts your design online behind a password so you can share it with a client. It uses Vercel, a free hosting service. Here is the one-time setup.",
    steps: [
      { h: "Create a free Vercel account", d: "Sign up with GitHub, GitLab, or an email address. It is free for design previews, no credit card needed.", link: { label: "Open vercel.com/signup", url: "https://vercel.com/signup" } },
      { h: "Create an access token", d: "In Vercel, open Account Settings, then Tokens. Create one, name it something like \"thinkany design\", and copy it.", note: "A token is safe to store: it only lets an app deploy on your behalf, and you can delete it from that same Vercel page at any time.", link: { label: "Open the token page", url: "https://vercel.com/account/tokens" } },
      { h: "Connect it here", d: "Close this window, paste the token into the Publish panel, and click Connect Vercel. It is stored encrypted on your computer, so you only do this once." },
      { h: "You are ready to publish", d: "Switch to the How to publish tab for the rest." },
    ],
  },
  how: {
    intro: "Once Vercel is connected, publishing a design is a few clicks.",
    steps: [
      { h: "Open a finished design", d: "Open the project you want to share. The Publish button stays greyed out until a design is ready to show." },
      { h: "Click Publish this design", d: "The app creates the site, uploads your design, and Vercel builds it. This usually takes a minute or two, and you will see the progress." },
      { h: "Copy your link and password", d: "You get a live link (like yourproject.vercel.app) and a one-time preview password. Copy both.", note: "Save the password when it is shown, it is not displayed again. If you lose it, Reset preview password generates a new one." },
      { h: "Share with your client", d: "Send them the link and the password. The site stays locked until they enter it, so the link is safe to share." },
      { h: "Update anytime", d: "Made changes? Click Publish changes to refresh the same link. Use Reset preview password to set a new password." },
    ],
  },
};
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
    helpBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg><span>Help with publishing</span>';
    helpBtn.addEventListener("click", () => openPubHelp(st.connected ? "how" : "start"));
    foot.append(sep, helpBtn);
    col.appendChild(foot);
  };

  // ── Connection ──
  const badgeText = st.connected ? (st.user ? `Connected · ${st.user}` : "Connected") : "Not connected";
  body.appendChild(connStatusRow("Vercel", st.connected, badgeText, "Disconnect Vercel",
    async () => { await window.desktop.clearVercel(); refreshRailActivation(); openModal("publish"); }));

  if (!st.connected) {
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.style.margin = "0 0 12px";
    intro.textContent = "Publish your design straight to a private, password-gated URL you can send a client. Paste a Vercel access token to connect.";
    body.appendChild(intro);

    const input = document.createElement("input");
    input.className = "field";
    input.type = "password";
    input.placeholder = "Paste your Vercel token";
    const saveBtn = document.createElement("button");
    saveBtn.className = "panelbtn primary";
    saveBtn.textContent = "Connect Vercel";
    const msg = document.createElement("div");
    msg.className = "muted";
    const doSave = async () => {
      const token = input.value.trim();
      if (!token) return;
      saveBtn.disabled = true;
      saveBtn.textContent = "Connecting…";
      msg.textContent = "";
      const res = await window.desktop.saveVercelToken(token);
      if (res.ok) { refreshRailActivation(); openModal("publish"); }
      else {
        msg.textContent = res.error || "Could not connect.";
        msg.style.color = "#e5484d";
        saveBtn.disabled = false;
        saveBtn.textContent = "Connect Vercel";
      }
    };
    saveBtn.addEventListener("click", doSave);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
    body.append(input, saveBtn, msg);

    const tokenLink = document.createElement("button");
    tokenLink.className = "panelbtn";
    tokenLink.textContent = "Create a token on Vercel ↗";
    tokenLink.addEventListener("click", () => window.desktop.openExternal("https://vercel.com/account/tokens"));
    body.appendChild(tokenLink);

    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = "Stored encrypted in your OS keychain. Only used to deploy your design.";
    body.appendChild(note);
    addHelp();
    return;
  }

  // Divider: connection status sits above; the deploy controls (scope + this
  // project) are grouped together below it.
  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;background:#ececf1;margin:14px 0;";
  body.appendChild(sep);

  // Deploy-to scope (grouped with This project, below the divider).
  const { teams } = await window.desktop.getVercelTeams();
  if (teams && teams.length) {
    const scopeRow = document.createElement("div");
    scopeRow.className = "setrow";
    const sk = document.createElement("div");
    sk.className = "k";
    sk.textContent = "Deploy to";
    const sel = document.createElement("select");
    sel.className = "field";
    const personal = document.createElement("option");
    personal.value = "";
    personal.textContent = "Personal account";
    sel.appendChild(personal);
    teams.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      sel.appendChild(o);
    });
    sel.value = st.teamId || "";
    sel.addEventListener("change", () => {
      const name = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : null;
      window.desktop.selectVercelScope(sel.value || null, sel.value ? name : null);
    });
    scopeRow.append(sk, sel);
    body.appendChild(scopeRow);
  }

  // ── This project ──
  const pub = await window.desktop.getPublishStatus();
  if (!pub.hasProject) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = "Open a project to publish it.";
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
        lab.textContent = "Password:";
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
        ? "Publish this design to a private URL. The first publish sets a preview password you share with your client."
        : "Finish a design first — then you can publish it here.";
      body.appendChild(lead);
    }

    // ── Preview domain: default *.vercel.app, or a subdomain of a domain you own ──
    const domSec = document.createElement("div");
    domSec.style.cssText = "margin: 2px 0 4px;";
    const domLabel = document.createElement("div");
    domLabel.className = "k";
    domLabel.textContent = "Preview domain";
    domSec.appendChild(domLabel);

    const { domains } = await window.desktop.getVercelDomains();
    const baseSlug = pub.projectName || "preview";
    let curBase = "", curLabel = "";
    if (pub.customDomain && domains && domains.length) {
      const match = domains.find((d) => pub.customDomain === d.name || pub.customDomain.endsWith("." + d.name));
      if (match) { curBase = match.name; curLabel = pub.customDomain === match.name ? "" : pub.customDomain.slice(0, -(match.name.length + 1)); }
    }

    const domSel = document.createElement("select");
    domSel.className = "field";
    const optDefault = document.createElement("option");
    optDefault.value = ""; optDefault.textContent = "Vercel subdomain (default)";
    domSel.appendChild(optDefault);
    (domains || []).forEach((d) => {
      const o = document.createElement("option"); o.value = d.name; o.textContent = d.name; domSel.appendChild(o);
    });
    domSel.value = curBase;

    const subWrap = document.createElement("div");
    subWrap.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:6px;";
    const subInput = document.createElement("input");
    subInput.className = "field"; subInput.placeholder = "subdomain"; subInput.style.cssText = "flex:0 1 140px;";
    subInput.value = curLabel || (curBase ? baseSlug : "");
    const domPreview = document.createElement("span");
    domPreview.className = "muted"; domPreview.style.cssText = "font-size:12px;word-break:break-all;";
    subWrap.append(subInput, domPreview);

    const slugifyLabel = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
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

    domSec.append(domSel, subWrap);
    body.appendChild(domSec);
    updateDomPreview();

    const domNote = document.createElement("div");
    domNote.className = "muted";
    domNote.style.cssText = "font-size:11.5px;margin:2px 0 12px;";
    domNote.textContent = (domains && domains.length)
      ? "A subdomain of a domain you own on Vercel. Applied on the next publish."
      : "No domains on your Vercel account yet. Add one in Vercel and it'll appear here.";
    body.appendChild(domNote);

    const host = document.createElement("div"); // progress + result target
    host.hidden = true;

    const publishBtn = document.createElement("button");
    publishBtn.className = "panelbtn primary";
    publishBtn.textContent = pub.url ? "Publish changes" : "Publish this design";
    publishBtn.disabled = !pub.canPublish;
    publishBtn.addEventListener("click", () => runPublishFlow(publishBtn, host, { resetPassword: false }));
    body.appendChild(publishBtn);

    if (pub.url) {
      const resetBtn = document.createElement("button");
      resetBtn.className = "panelbtn";
      resetBtn.textContent = "Reset preview password";
      resetBtn.title = "Generate a new client password and republish";
      resetBtn.addEventListener("click", () => runPublishFlow(resetBtn, host, { resetPassword: true }));
      body.appendChild(resetBtn);
    }

    body.appendChild(host);

    if (pub.lastDeployAt) {
      const last = document.createElement("div");
      last.className = "muted";
      last.style.marginTop = "8px";
      try { last.textContent = "Last published " + new Date(pub.lastDeployAt).toLocaleString(); } catch { last.textContent = ""; }
      body.appendChild(last);
    }
  }

  addHelp();
}

// --- Copy voice: per-project tone + rules, plus global rules ---
const TONE_EXAMPLES = ["Soft, professional, not pushy", "Confident and direct", "Warm and conversational", "Understated, editorial", "Playful and energetic"];
const RULE_EXAMPLES = ["No em dashes", "Short, clear sentences", "Active voice", "No exclamation points", "Avoid jargon", "Sentence case headings"];

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
      e.textContent = opts.emptyText || "None yet."; rows.appendChild(e);
    }
    arr.forEach((r, i) => {
      const row = document.createElement("div"); row.className = "rulerow";
      const t = document.createElement("span"); t.className = "rule-t"; t.textContent = r; row.appendChild(t);
      if (!opts.disabled) {
        const x = document.createElement("button"); x.className = "rule-x"; x.type = "button"; x.textContent = "×";
        x.addEventListener("click", () => { arr.splice(i, 1); rerender(); });
        row.appendChild(x);
      }
      rows.appendChild(row);
    });
  };
  box.appendChild(rows);
  const add = (text) => {
    const t = (text || "").trim();
    if (t && !arr.some((r) => r.toLowerCase() === t.toLowerCase())) { arr.push(t); rerender(); }
  };
  if (!opts.disabled) {
    const addRow = document.createElement("div"); addRow.className = "rule-add";
    const inp = document.createElement("input"); inp.className = "field"; inp.placeholder = opts.placeholder || "Add a rule…";
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { add(inp.value); inp.value = ""; } });
    const btn = document.createElement("button"); btn.className = "panelbtn"; btn.type = "button"; btn.textContent = "Add";
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
  intro.textContent = "Shape the words the AI writes into this design's copy. Nothing is set by default.";
  body.appendChild(intro);

  // ── This project ──
  body.appendChild(voiceHeader("This project"));
  const toneLabel = document.createElement("div"); toneLabel.className = "voice-label"; toneLabel.textContent = "Tone";
  body.appendChild(toneLabel);
  const toneInput = document.createElement("input");
  toneInput.className = "field"; toneInput.placeholder = "e.g. soft, professional, not pushy"; toneInput.value = state.tone;
  toneInput.addEventListener("input", () => { state.tone = toneInput.value; });
  body.appendChild(toneInput);
  body.appendChild(exampleChips(TONE_EXAMPLES, (ex) => { state.tone = ex; toneInput.value = ex; }));

  const prLabel = document.createElement("div"); prLabel.className = "voice-label"; prLabel.textContent = "Rules for this project";
  body.appendChild(prLabel);
  body.appendChild(ruleListEl(state.projRules, { examples: RULE_EXAMPLES, placeholder: "Add a project rule…", emptyText: "No project-specific rules." }));

  // ── Global rules ── (divider to set it apart from the project grouping)
  const divider = document.createElement("div"); divider.className = "voice-divider";
  body.appendChild(divider);
  body.appendChild(voiceHeader("Global rules", "Apply to every project."));
  const toggle = document.createElement("label"); toggle.className = "voice-toggle";
  const chk = document.createElement("input"); chk.type = "checkbox"; chk.checked = state.decline;
  const tTxt = document.createElement("span"); tTxt.textContent = "Ignore global rules for this project";
  toggle.append(chk, tTxt); body.appendChild(toggle);

  // Re-render the global list when Decline flips (read-only + struck when declined).
  const globalWrap = document.createElement("div");
  const renderGlobal = () => {
    globalWrap.innerHTML = "";
    globalWrap.appendChild(ruleListEl(state.globalRules, {
      examples: RULE_EXAMPLES, placeholder: "Add a global rule…",
      emptyText: "No global rules yet.", disabled: state.decline,
    }));
  };
  chk.addEventListener("change", () => { state.decline = chk.checked; renderGlobal(); });
  renderGlobal();
  body.appendChild(globalWrap);

  // ── Save (both project + global) ──
  const save = document.createElement("button"); save.className = "panelbtn primary"; save.textContent = "Save";
  save.style.marginTop = "16px";
  const msg = document.createElement("div"); msg.className = "muted"; msg.style.marginTop = "8px";
  save.addEventListener("click", async () => {
    save.disabled = true; save.textContent = "Saving…";
    await window.desktop.saveProjectVoice({ tone: state.tone, rules: state.projRules, declineGlobal: state.decline });
    await window.desktop.saveGlobalRules(state.globalRules);
    save.disabled = false; save.textContent = "Save";
    msg.textContent = "Saved, applies to your next message.";
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
  [["", "Inherit default"], ["on", "On"], ["off", "Off"]].forEach(([v, t]) => {
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
  if (days === 0) return "Today " + time;
  if (days === 1) return "Yesterday " + time;
  if (days < 7) return then.toLocaleDateString([], { weekday: "short" }) + " " + time;
  return then.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function renderClaude(body) {
  const status = await window.desktop.getKeyStatus();
  body.appendChild(connStatusRow("Claude API key", status.hasKey, status.hasKey ? "Connected" : "Not connected", "Disconnect", disconnectKey));

  if (!status.hasKey) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = "Close this and paste your key on the connect screen.";
    body.appendChild(note);
    return;
  }

  body.appendChild(setRow("Key", `sk-ant-…${status.keyHint || "????"}`));

  // Model picker — populated from the models this key can use.
  const modelRow = document.createElement("div");
  modelRow.className = "setrow";
  const mk = document.createElement("div");
  mk.className = "k";
  mk.textContent = "Model";
  const select = document.createElement("select");
  select.className = "field";
  const loadingOpt = document.createElement("option");
  loadingOpt.textContent = "Loading models…";
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
  def.textContent = "Default (Claude Code picks)";
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
    o.textContent = res.error || "Couldn't load models";
    select.appendChild(o);
  }
  select.value = current || "";
  select.addEventListener("change", async () => {
    await window.desktop.setModel(select.value || null);
    const label = select.options[select.selectedIndex].textContent;
    addMsg("system", select.value ? `✓ Model set to ${label}` : "✓ Model set to default");
  });

  // Disconnect lives in the status header (top-right unplug), matching Vercel/Figma.
  const keyNote = document.createElement("div");
  keyNote.className = "muted";
  keyNote.textContent = "Key stored encrypted in your OS keychain.";
  body.appendChild(keyNote);

  // ── Research the field (licensed enhancement — only rendered when licensed) ──
  const research = await window.desktop.getResearch();
  if (research.licensed) {
    const rsep = document.createElement("div");   // divider, called out like Sessions
    rsep.className = "drawer-sep";
    body.appendChild(rsep);
    const rlabel = document.createElement("div");
    rlabel.className = "sess-label";
    rlabel.textContent = "Research the field";
    body.appendChild(rlabel);
    const rlead = document.createElement("div");
    rlead.className = "sess-desc";
    rlead.textContent = "Studies a few comparable sites to ground the layout, colors, and flow, so the first design and later changes take a little longer when this is on.";
    body.appendChild(rlead);

    const gRow = document.createElement("label");
    gRow.className = "toggle-row";
    const gCb = document.createElement("input");
    gCb.type = "checkbox";
    gCb.checked = research.global;
    const gTxt = document.createElement("span");
    gTxt.textContent = "On by default (all projects)";
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
    bgTxt.textContent = "Also look beyond competitors for style & regional references";
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
      pk.textContent = `Research for this design (${research.variationId})`;
      const pSel = triSelect(research.variation);
      pRow.append(pk, pSel);
      body.appendChild(pRow);

      const bpRow = document.createElement("div");
      bpRow.className = "setrow";
      const bpk = document.createElement("div");
      bpk.className = "k";
      bpk.textContent = "Broad references for this design";
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
  sh.textContent = "Sessions";
  body.appendChild(sh);

  const sdesc = document.createElement("div");
  sdesc.className = "sess-desc";
  sdesc.textContent = "Saved chats for this project. They appear here when you start a new session or leave the project.";
  body.appendChild(sdesc);

  // Auto-restore the most recent session when a project opens (global preference).
  const autoRow = document.createElement("label");
  autoRow.className = "toggle-row";
  const autoCb = document.createElement("input");
  autoCb.type = "checkbox";
  autoCb.checked = localStorage.getItem(AUTO_RESTORE_KEY) === "1";
  const autoTxt = document.createElement("span");
  autoTxt.textContent = "Auto-restore last session when a project opens";
  autoRow.append(autoCb, autoTxt);
  autoCb.addEventListener("change", () => localStorage.setItem(AUTO_RESTORE_KEY, autoCb.checked ? "1" : "0"));
  body.appendChild(autoRow);

  // Actions row: "+ New" (left) and a "delete all" trash button (right edge).
  const sessions = await window.desktop.listSessions();
  const actions = document.createElement("div");
  actions.className = "sess-actions";
  const newBtn = document.createElement("button");
  newBtn.className = "sess-new";
  newBtn.textContent = "+ New";
  newBtn.title = "Start a new session (saves the current one here)";
  newBtn.addEventListener("click", async () => { closeModal(); await clearSession(); });
  const delAllBtn = document.createElement("button");
  delAllBtn.className = "sess-delall";
  delAllBtn.title = "Delete all saved sessions";
  delAllBtn.innerHTML = TRASH_SVG;
  delAllBtn.disabled = !sessions.length;
  delAllBtn.addEventListener("click", () => showConfirm({
    title: "Delete all saved sessions?",
    okLabel: "Delete all",
    danger: true,
    message: "This permanently removes every saved session for this project from the Claude panel. Your project files and design work are not affected.",
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
    open.title = "Reopen this session";
    const t = document.createElement("div");
    t.className = "sess-title";
    t.textContent = s.title || "Untitled session";
    const d = document.createElement("div");
    d.className = "sess-date";
    d.textContent = relTime(s.createdAt);
    open.append(t, d);
    open.addEventListener("click", async () => { closeModal(); await openSession(s.id); });
    const del = document.createElement("button");
    del.className = "sessrow-del";
    del.title = "Delete this session";
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm({
        title: "Delete this session?",
        okLabel: "Delete",
        danger: true,
        message: `Permanently remove "${s.title || "Untitled session"}"? Your project files and design work are not affected.`,
        onOk: async () => { await window.desktop.deleteSession(s.id); openModal("claude"); },
      });
    });
    row.append(open, del);
    list.appendChild(row);
  });

  const modelNote = document.createElement("div");
  modelNote.className = "muted";
  modelNote.style.marginTop = "14px";
  modelNote.textContent = "Applies to your next message; switching keeps the conversation.";
  body.appendChild(modelNote);
}

// --- Moved actions ---
async function switchProject() {
  closeModal();
  await window.desktop.resetProject();
  sessionId = null;
  log.innerHTML = "";
  noProjectPlaceholder();
  showStage("project");
}
async function disconnectKey() {
  closeModal();
  await window.desktop.clearKey();
  await boot();
}
async function exportCompany(btn) {
  try {
    btn.disabled = true;
    btn.textContent = "Saving…";
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
  return node;
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
const SESSION_NUDGES = [
  { at: 0.6, msg: "This conversation is getting long (~60% of the context window). If replies start to slow, type /clear to begin a fresh session. Your project files and design work are saved on disk and won't be lost." },
  { at: 0.85, msg: "Heads up: this conversation is ~85% full. /clear starts a clean, faster session (your saved work stays intact)." },
];
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
  addMsg("system", "Started a fresh session. Your previous one is saved in the Claude panel (Sessions).");
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
  addMsg("system", "Resumed this session. Pick up where you left off.");
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
    title: "Start a new session?",
    okLabel: "New session",
    message:
      "Starting a new session gives you a fresh, fast chat. Your current session is SAVED to the Claude " +
      "panel's Sessions list (not lost), reopen it anytime to pick up where you left off. Project files and " +
      "design work are unaffected.\n\n" +
      `You're currently at about ${sessionTokens.toLocaleString()} tokens (${sessionPct}% of the context window). ` +
      "It's a good time to start fresh when this climbs high (the ring turns amber, then red) or you're moving to a new task.",
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
      if (!assistantEl) { assistantEl = addMsg("assistant", ""); updateThinking(); }
      assistantEl.textContent += evt.text;
      log.scrollTop = log.scrollHeight;
      break;
    case "tool":
      finalizeAssistant();
      autoDismissTool(addMsg("tool", `⚙ ${evt.name}${evt.input ? " " + JSON.stringify(evt.input) : ""}`));
      updateThinking(); // re-pin the dots below the tool bubble while it's still working
      // A tool call may have just written the color palette — poll until the
      // styleguide is preview-ready (not merely when the variation folder
      // appears), then open the live preview mid-turn.
      if (!design.previewReady) {
        window.desktop.getDesignState().then((d) => {
          const flipped = d.previewReady && !design.previewReady;
          design = d;
          if (flipped) { designJustActivated = true; refreshPreview(); }
        });
      }
      // Live preview already open + a file edit is starting → guard it so the
      // designer never sees mid-edit error states. Held until the turn completes.
      if (tabsOpened && EDIT_TOOLS.has(evt.name)) {
        guardPreviewForEdit(friendlyActivity(evt.name, evt.target));
      }
      break;
    case "activity":
      // Narrate what's happening in plain language in the preview placeholder —
      // during setup (preview closed) OR while the live-edit guard is up.
      if (!tabsOpened || guarding) setWorkingMessage(friendlyActivity(evt.name, evt.target));
      break;
    case "result":
      finalizeAssistant();
      agentBusy = false;
      updateThinking(); // turn done → clear the dots
      updateSessionGauge(evt.usage, evt.modelUsage); // refresh the context gauge + maybe nudge
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
      addMsg("error", "✖ " + evt.message);
      // Even on error, settle-then-reveal so the designer isn't stuck behind the
      // guard overlay (the chat carries the error detail).
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
  return (q.options || []).some((o) => /upload|attach|choose a file/i.test(o.label || ""));
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
      refs.uploadNote.textContent = `✓ ${res.name} attached`;
    }
    maybeComplete();
  }

  const submitBtn = document.createElement("button");
  submitBtn.className = "qsubmit";
  submitBtn.textContent = "Submit";
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
    hdr.textContent = q.header || "Question";
    const txt = document.createElement("div");
    txt.className = "qtext";
    txt.textContent = q.question;
    block.append(hdr, txt);

    const optButtons = [];
    const otherInput = document.createElement("input");
    otherInput.className = "qother-input";
    otherInput.placeholder = "Type your own answer";
    otherInput.hidden = true;
    otherInputs[qi] = otherInput;

    // Injected first option for file questions: 📎 Upload (opens the picker;
    // a dropped file fulfills it too).
    if (isFileQuestion(q)) {
      const uploadBtn = document.createElement("button");
      uploadBtn.className = "qopt qupload";
      const ul = document.createElement("div");
      ul.className = "lbl";
      ul.textContent = "📎 Upload a file…";
      const ud = document.createElement("div");
      ud.className = "desc";
      ud.textContent = "Choose or drag a file (e.g. company-profile.json)";
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

    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "qopt";
      const lbl = document.createElement("div");
      lbl.className = "lbl";
      lbl.textContent = opt.label;
      btn.appendChild(lbl);
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
    olbl.textContent = "Other…";
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

// ---- Welcome path picker (fresh-start chips) --------------------------------
// On a truly fresh project the chat opens with two choices instead of guessing
// from a typed "hello": "Client Setup" (deterministic /setup-project) and "Get
// Designing" (the natural-language brief entry — the front door to the
// design-from-brief feature). Clicking a chip is that path's "hello".
const DEFAULT_PLACEHOLDER = input.placeholder;
const BRIEF_PLACEHOLDER = "Describe the site you want, paste links for style, colors, or fonts…";
let welcomeCard = null;
let designBriefMode = false; // set by "Get Designing"; the next message is the brief

function dismissWelcome() {
  if (welcomeCard) { welcomeCard.remove(); welcomeCard = null; }
}

function renderWelcomeChips() {
  // Only greet on a truly fresh start: a project is open, no design yet, and
  // nothing has been said. Self-guards so callers can fire it freely.
  if (conversationStarted || (design && design.active)) return;
  if (welcomeCard || log.children.length) return;

  const card = document.createElement("div");
  card.className = "qcard welcome-card";
  const title = document.createElement("div");
  title.className = "welcome-title";
  title.textContent = "How would you like to start?";
  card.appendChild(title);

  // Icons are static, trusted SVG (Lucide): a numbered list for step-by-step
  // setup, a pencil-drawing-a-line for the free-form "just design it" path.
  const ICON_LIST_ORDERED =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>';
  const ICON_PENCIL_LINE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  const opts = [
    {
      label: "Client Setup",
      desc: "Brand a new project step by step (logo, fonts, colors), then design.",
      icon: ICON_LIST_ORDERED,
      onClick: () => sendText("/setup-project"),
    },
    {
      label: "Get Designing",
      desc: "Jump straight in: describe the site (paste style, color, or font links) and I'll design it.",
      icon: ICON_PENCIL_LINE,
      onClick: enterDesignBriefMode,
    },
  ];
  for (const o of opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qopt welcome-opt";
    const icon = document.createElement("span");
    icon.className = "welcome-icon";
    icon.innerHTML = o.icon;
    const textWrap = document.createElement("div");
    textWrap.className = "welcome-opt-text";
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = o.label;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = o.desc;
    textWrap.append(lbl, desc);
    btn.append(icon, textWrap);
    btn.addEventListener("click", o.onClick);
    card.appendChild(btn);
  }
  log.appendChild(card);
  welcomeCard = card;
}

// "Get Designing" — collect the brief rather than firing a generic message.
// Focus the composer with a brief-oriented placeholder and invite the details;
// the next message the designer sends is their brief.
function enterDesignBriefMode() {
  dismissWelcome();
  designBriefMode = true;
  addMsg(
    "system",
    "Tell me about the site you want (the vibe, plus any links for style, colors, or fonts) and I'll start designing."
  );
  input.placeholder = BRIEF_PLACEHOLDER;
  input.focus();
}

// One send path for both typed messages and chip-fired prompts.
async function sendText(text) {
  text = (text || "").trim();
  if (!text) return;
  // /clear is handled locally — it's a session reset, not a prompt for the agent.
  if (text === "/clear") {
    input.value = "";
    input.placeholder = DEFAULT_PLACEHOLDER;
    dismissWelcome();
    await clearSession();
    input.focus();
    return;
  }
  dismissWelcome();
  // "Get Designing" brief → route to the /design-brief orchestrator (parse →
  // extract palette/fonts → apply into v01 → design). Show the designer's own
  // words in chat, but send the command. A slash-command the user typed
  // themselves (or the Client Setup chip) passes through untouched.
  const asBrief = designBriefMode && !text.startsWith("/");
  designBriefMode = false;
  const toSend = asBrief ? `/design-brief ${text}` : text;
  addMsg("user", text);
  input.value = "";
  input.placeholder = DEFAULT_PLACEHOLDER;
  assistantEl = null;
  agentBusy = true;
  conversationStarted = true;
  updateThinking(); // dots up immediately, until the first text/tool arrives
  refreshPreview(); // show the working placeholder while the browser is closed
  send.disabled = true;
  try {
    const res = await window.desktop.sendPrompt(toSend, sessionId);
    if (res && res.sessionId) sessionId = res.sessionId;
  } catch (e) {
    agentBusy = false;
    updateThinking();
    addMsg("error", String(e));
    refreshPreview();
  } finally {
    send.disabled = false;
    input.focus();
  }
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

// ---- Boot --------------------------------------------------------------------
boot();
