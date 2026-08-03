// Renderer logic: a three-stage flow — connect key → choose project → workspace
// (chat + live preview). The preview shows a welcome placeholder for a fresh
// project and swaps to the live design (/?v=<id>) once setup creates a variation.

const el = (id) => document.getElementById(id);

// Bar
const status = el("status");
const projname = el("projname");
const exportcompany = el("exportcompany");
const switchproject = el("switchproject");
const resetkey = el("resetkey");

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

let sessionId = null;
let assistantEl = null;

// Preview state
let viteUrl = null;
let design = { active: false, variationId: null };
let tabs = [];
let activeTab = null;
let tabSeq = 0;
let tabsOpened = false; // whether default tabs were opened for the active design

// ---- Preview: embedded tabbed browser ---------------------------------------
function quickUrl(kind) {
  const v = design.variationId;
  if (kind === "styleguide") return v ? `${viteUrl}/?v=${v}&styleguide` : `${viteUrl}/?styleguide`;
  if (kind === "dashboard") return `${viteUrl}/`;
  return v ? `${viteUrl}/?v=${v}` : `${viteUrl}/`; // home
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
  add.addEventListener("click", () => openTab(quickUrl("home"), "Home"));
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
  wv.setAttribute("src", url);
  wv.setAttribute("partition", "persist:preview");
  const tab = { id: ++tabSeq, wv, title: title || "Loading…", fixedTitle: !!title };
  wv.addEventListener("page-title-updated", (e) => {
    if (!tab.fixedTitle) { tab.title = e.title; renderTabs(); }
  });
  const onNav = () => { if (tab === activeTab) syncNav(); };
  wv.addEventListener("did-navigate", onNav);
  wv.addEventListener("did-navigate-in-page", onNav);
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
navreload.addEventListener("click", () => { if (activeTab) activeTab.wv.reload(); });
urlbar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !activeTab) return;
  let u = urlbar.value.trim();
  if (!/^https?:\/\//.test(u)) u = viteUrl + (u.startsWith("/") ? u : "/" + u);
  activeTab.wv.loadURL(u);
});
document.querySelectorAll(".qlink").forEach((b) =>
  b.addEventListener("click", () => {
    if (!viteUrl) return;
    const url = quickUrl(b.dataset.nav);
    if (activeTab) activeTab.wv.loadURL(url);
    else openTab(url);
  })
);

function showPlaceholder({ emoji, title, text }) {
  phEmoji.textContent = emoji;
  phTitle.textContent = title;
  phText.textContent = text;
  browser.hidden = true;
  previewph.hidden = false;
}

function showBrowser() {
  previewph.hidden = true;
  browser.hidden = false;
  if (!tabsOpened) {
    tabsOpened = true;
    openTab(quickUrl("styleguide"), "Style guide");
    const home = openTab(quickUrl("home"), "Home");
    setActiveTab(home);
  }
}

function refreshPreview() {
  if (!viteUrl) {
    showPlaceholder({
      emoji: "⏳",
      title: "Starting the preview…",
      text: "Spinning up the project's dev server.",
    });
  } else if (design.active) {
    showBrowser();
  } else {
    showPlaceholder({
      emoji: "👋",
      title: "Say hello to get started",
      text: "Message the agent to set up and design your project. This preview becomes your live design the moment it's ready.",
    });
  }
}

// ---- Stage routing -----------------------------------------------------------
function showStage(stage) {
  keygate.hidden = stage !== "key";
  projectgate.hidden = stage !== "project";
  chatmain.hidden = stage !== "workspace";
  resetkey.hidden = stage === "key";
  switchproject.hidden = stage !== "workspace";
  if (stage !== "workspace") exportcompany.hidden = true;
  status.textContent =
    stage === "key" ? "not connected" : stage === "project" ? "no project" : "ready";
  if (stage === "key") keyinput.focus();
  if (stage === "workspace") input.focus();
}

function refreshCompanyButton(exists) {
  exportcompany.hidden = !exists || chatmain.hidden;
}

function noProjectPlaceholder() {
  viteUrl = null;
  design = { active: false, variationId: null };
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
  design = proj.design || { active: false, variationId: null };
  showStage("workspace");
  refreshPreview();
  refreshCompanyButton(proj.companyProfile);
}

// Vite may become ready after the project is chosen.
window.desktop.onViteReady((url) => {
  viteUrl = url;
  if (!chatmain.hidden) refreshPreview();
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
resetkey.addEventListener("click", async () => {
  await window.desktop.clearKey();
  await boot();
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
      refreshCompanyButton((await window.desktop.getCompanyStatus()).exists);
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

exportcompany.addEventListener("click", async () => {
  try {
    const res = await window.desktop.downloadCompany();
    if (res.canceled) return;
    if (res.ok) addMsg("system", `✓ Company profile saved to ${res.path}`);
    else addMsg("error", res.error || "Could not save the company profile.");
  } catch (e) {
    addMsg("error", String(e));
  }
});

switchproject.addEventListener("click", async () => {
  await window.desktop.resetProject();
  sessionId = null;
  log.innerHTML = "";
  noProjectPlaceholder();
  showStage("project");
});

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
      break;
    case "result":
      finalizeAssistant();
      // A turn may have created the working variation — swap the placeholder
      // for the live design as soon as it exists.
      if (!design.active) {
        window.desktop.getDesignState().then((d) => {
          if (d.active) {
            design = d;
            refreshPreview();
          }
        });
      }
      // A turn may have run /export-company — reveal the download button.
      window.desktop.getCompanyStatus().then((c) => refreshCompanyButton(c.exists));
      break;
    case "error":
      finalizeAssistant();
      addMsg("error", "✖ " + evt.message);
      break;
  }
});

// AskUserQuestion → render clickable choices in the chat and answer via IPC.
window.desktop.onAgentAsk(({ id, questions }) => renderQuestionCard(id, questions));

function renderQuestionCard(id, questions) {
  const card = document.createElement("div");
  card.className = "qcard";

  // Per-question state: single-select → string | {other} | null; multi → Set.
  const state = questions.map((q) => (q.multiSelect ? new Set() : null));
  const otherInputs = [];
  const optButtonsByQ = [];

  const submitBtn = document.createElement("button");
  submitBtn.className = "qsubmit";
  submitBtn.textContent = "Submit";
  submitBtn.disabled = true;

  function valueFor(qi) {
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

async function submit() {
  const text = input.value.trim();
  if (!text) return;
  addMsg("user", text);
  input.value = "";
  assistantEl = null;
  send.disabled = true;
  try {
    const res = await window.desktop.sendPrompt(text, sessionId);
    if (res && res.sessionId) sessionId = res.sessionId;
  } catch (e) {
    addMsg("error", String(e));
  } finally {
    send.disabled = false;
    input.focus();
  }
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

function handleAttachResult(res) {
  if (!res || res.canceled) return;
  if (!res.ok) {
    addMsg("error", res.error || "Could not attach the file.");
    return;
  }
  addMsg("system", `📎 ${res.name} added as ${res.rel}`);
  input.value = input.value.trim() ? `${input.value.trim()} ${res.rel}` : attachPrefill(res);
  input.focus();
}

attach.addEventListener("click", async () => {
  try {
    handleAttachResult(await window.desktop.attachFile());
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
      handleAttachResult(await window.desktop.attachFilePath(src));
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
