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
const railCompany = el("rail-company");
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

// Preview / embedded browser
const browser = el("browser");
const tabbar = el("tabbar");
const views = el("views");
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
}

function openTab(url, title) {
  const wv = document.createElement("webview");
  wv.setAttribute("partition", "persist:preview");
  wv.setAttribute("src", url);
  const tab = { id: ++tabSeq, wv, title: title || "Loading…", fixedTitle: !!title, url, retries: 0 };
  wv.addEventListener("page-title-updated", (e) => {
    if (!tab.fixedTitle) { tab.title = e.title; renderTabs(); }
  });
  const onNav = () => { if (tab === activeTab) syncNav(); };
  wv.addEventListener("did-navigate", onNav);
  wv.addEventListener("did-navigate-in-page", onNav);
  wv.addEventListener("did-finish-load", () => { tab.retries = 0; });
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
  if (u) navigate(activeTab, u);
});
document.querySelectorAll(".qlink").forEach((b) =>
  b.addEventListener("click", () => {
    if (!viteUrl) return;
    const url = quickUrl(b.dataset.nav);
    if (activeTab) navigate(activeTab, url);
    else openTab(url);
  })
);

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
      text: "Your live preview opens on its own once your design's ready — pick up in the chat.",
    });
  }
  showPlaceholder({
    emoji: "👋",
    title: "Pick a starting point to your left",
    text: "Choose Client Setup or Get Designing in the chat — your live preview opens here on its own once your design is ready.",
  });
}

// ---- Stage routing -----------------------------------------------------------
function showStage(stage) {
  keygate.hidden = stage !== "key";
  projectgate.hidden = stage !== "project";
  chatmain.hidden = stage !== "workspace";
  status.textContent =
    stage === "key" ? "not connected" : stage === "project" ? "no project" : "ready";
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

async function boot() {
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
  renderWelcomeChips(); // fresh project → offer the two starting paths
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
      renderWelcomeChips(); // fresh project → offer the two starting paths
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
const RAILS = { help: railHelp, projects: railProjects, company: railCompany, claude: railClaude };
const PANELS = {
  help: { title: "Commands", render: renderHelp },
  projects: { title: "Switch project", render: renderProjects },
  company: { title: "Company profile", render: renderCompany },
  claude: { title: "Claude settings", render: renderClaude },
};

function closeModal() {
  modal.hidden = true;
  Object.values(RAILS).forEach((b) => b.classList.remove("active"));
}
async function openModal(kind) {
  const { title, render } = PANELS[kind];
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  Object.values(RAILS).forEach((b) => b.classList.remove("active"));
  RAILS[kind].classList.add("active");
  modal.hidden = false;
  await render(modalBody);
}

railHelp.addEventListener("click", () => openModal("help"));
railProjects.addEventListener("click", () => openModal("projects"));
railCompany.addEventListener("click", () => openModal("company"));
railClaude.addEventListener("click", () => openModal("claude"));
modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// --- Help: the project's commands ---
const COMMANDS = [
  ["/setup-project", "Brand the template — client/company name, project type, fonts, logo, menu style."],
  ["/setup-styleguide", "Set the client's fonts, colors, and example styleguide sections."],
  ["/design", "Build or edit a page (hero, sections, landing) — the design phase."],
  ["/guide", "Show the list of commands."],
  ["/export-company", "Save your agency identity (name, admin fonts, logo) as a portable file."],
  ["/import-company", "Apply a saved company profile into this project."],
  ["export to Figma", "Ask in plain language to push the styleguide, blocks, or pages to Figma."],
  ["/upgrade", "Apply the latest template version (keeps your design work)."],
];
function renderHelp(body) {
  const intro = document.createElement("p");
  intro.className = "muted";
  intro.style.margin = "0 0 12px";
  intro.textContent = "Type these in the chat. Setup runs first, then design freely.";
  body.appendChild(intro);
  COMMANDS.forEach(([cmd, desc]) => {
    const row = document.createElement("div");
    row.className = "cmd";
    const c = document.createElement("code");
    c.textContent = cmd;
    const d = document.createElement("div");
    d.className = "d";
    d.textContent = desc;
    row.append(c, d);
    body.appendChild(row);
  });
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
  body.appendChild(setRow("Current project", proj.name || "—"));
  body.appendChild(setRow("Folder", proj.path || "—"));
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
  defNote.textContent = "Applied automatically to every new project — set your agency identity once and skip it on every future setup.";
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
    note.textContent = "No company-profile.json yet — run /export-company in the chat to create one first.";
    body.appendChild(note);
  }
}

// --- Figma export license (cloud derive) ---
async function renderLicenseSection(body) {
  const lic = await window.desktop.getLicenseStatus();
  const row = document.createElement("div");
  row.className = "setrow";
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = "Figma export license";
  const badge = document.createElement("span");
  badge.className = "badge " + (lic.hasLicense ? "ok" : "off");
  badge.textContent = lic.hasLicense ? "Active" : "Not set";
  row.append(k, badge);
  body.appendChild(row);

  if (lic.hasLicense) {
    body.appendChild(setRow("Key", `…${lic.hint || "????"}`));
    const rm = document.createElement("button");
    rm.className = "panelbtn danger";
    rm.textContent = "Remove license";
    rm.addEventListener("click", async () => {
      await window.desktop.clearLicense();
      openModal("claude");
    });
    body.appendChild(rm);
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
        openModal("claude"); // refresh → shows Active
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

  const hr = document.createElement("div");
  hr.style.cssText = "height:1px;background:var(--border,#2a2a2a);margin:14px 0;";
  body.appendChild(hr);
}

// --- Claude settings: API key + model ---
async function renderClaude(body) {
  const status = await window.desktop.getKeyStatus();
  const row = document.createElement("div");
  row.className = "setrow";
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = "Claude API key";
  const badge = document.createElement("span");
  badge.className = "badge " + (status.hasKey ? "ok" : "off");
  badge.textContent = status.hasKey ? "Connected" : "Not connected";
  row.append(k, badge);
  body.appendChild(row);

  // Figma-export license (gates the cloud derive) — shown regardless of API key.
  await renderLicenseSection(body);

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

  const modelNote = document.createElement("div");
  modelNote.className = "muted";
  modelNote.textContent = "Applies to your next message; switching keeps the conversation.";
  body.appendChild(modelNote);

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

  const disc = document.createElement("button");
  disc.className = "panelbtn danger";
  disc.textContent = "Disconnect / change key";
  disc.addEventListener("click", disconnectKey);
  body.appendChild(disc);

  const note = document.createElement("div");
  note.className = "muted";
  note.textContent = "Key stored encrypted in your OS keychain.";
  body.appendChild(note);
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
      if (!assistantEl) assistantEl = addMsg("assistant", "");
      assistantEl.textContent += evt.text;
      log.scrollTop = log.scrollHeight;
      break;
    case "tool":
      finalizeAssistant();
      addMsg("tool", `⚙ ${evt.name}${evt.input ? " " + JSON.stringify(evt.input) : ""}`);
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
      break;
    case "activity":
      // Narrate what's happening in plain language in the preview placeholder
      // while the preview is still closed during setup; ignore once it's open.
      if (!tabsOpened) setWorkingMessage(friendlyActivity(evt.name, evt.target));
      break;
    case "result":
      finalizeAssistant();
      agentBusy = false;
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
      addMsg("error", "✖ " + evt.message);
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
const BRIEF_PLACEHOLDER = "Describe the site you want — paste links for style, colors, or fonts…";
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

  const opts = [
    {
      label: "Client Setup",
      desc: "Brand a new project step by step — logo, fonts, colors — then design.",
      onClick: () => sendText("/setup-project"),
    },
    {
      label: "Get Designing",
      desc: "Jump straight in — describe the site (paste style, color, or font links) and I'll design it.",
      onClick: enterDesignBriefMode,
    },
  ];
  for (const o of opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qopt";
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = o.label;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = o.desc;
    btn.append(lbl, desc);
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
    "Tell me about the site you want — the vibe, plus any links for style, colors, or fonts — and I'll start designing."
  );
  input.placeholder = BRIEF_PLACEHOLDER;
  input.focus();
}

// One send path for both typed messages and chip-fired prompts.
async function sendText(text) {
  text = (text || "").trim();
  if (!text) return;
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
  refreshPreview(); // show the working placeholder while the browser is closed
  send.disabled = true;
  try {
    const res = await window.desktop.sendPrompt(toSend, sessionId);
    if (res && res.sessionId) sessionId = res.sessionId;
  } catch (e) {
    agentBusy = false;
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
