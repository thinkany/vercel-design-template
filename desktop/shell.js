// Renderer logic: a three-stage flow — connect key → choose project → workspace
// (chat + live preview). The preview points at the project's Vite server; the
// agent operates on the project folder (both wired in main.cjs).

const el = (id) => document.getElementById(id);

// Bar
const status = el("status");
const projname = el("projname");
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

// Preview
const frame = el("frame");
const previewph = el("previewph");

let sessionId = null;
let assistantEl = null;

// ---- Stage routing -----------------------------------------------------------
function showStage(stage) {
  keygate.hidden = stage !== "key";
  projectgate.hidden = stage !== "project";
  chatmain.hidden = stage !== "workspace";
  resetkey.hidden = stage === "key";
  switchproject.hidden = stage !== "workspace";
  status.textContent =
    stage === "key" ? "not connected" : stage === "project" ? "no project" : "ready";
  if (stage === "key") keyinput.focus();
  if (stage === "workspace") input.focus();
}

function setPreview(url) {
  if (!url) return;
  frame.src = url;
  frame.hidden = false;
  previewph.hidden = true;
}
function clearPreview(message) {
  frame.hidden = true;
  frame.src = "about:blank";
  previewph.hidden = false;
  previewph.textContent = message || "The live preview appears here once a project is open.";
}

async function boot() {
  const { hasKey } = await window.desktop.getKeyStatus();
  if (!hasKey) {
    clearPreview();
    showStage("key");
    return;
  }
  const proj = await window.desktop.getProjectStatus();
  if (!proj.hasProject) {
    clearPreview();
    showStage("project");
    return;
  }
  projname.textContent = proj.name || "";
  showStage("workspace");
  if (proj.viteUrl) setPreview(proj.viteUrl);
  else clearPreview("Starting the project preview…");
}

// Vite may become ready after the project is chosen — swap in the preview then.
window.desktop.onViteReady((url) => {
  if (!chatmain.hidden) setPreview(url);
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
  clearPreview(kind === "create" ? "Scaffolding & starting your project…" : "Starting the project…");
  try {
    const res = kind === "create"
      ? await window.desktop.createProject()
      : await window.desktop.openProject();
    if (res.canceled) return;
    if (res.ok) {
      projname.textContent = res.name || "";
      showStage("workspace");
      setPreview(res.viteUrl);
    } else {
      projecterror.textContent = res.error || "Could not open the project.";
      clearPreview();
    }
  } catch (e) {
    projecterror.textContent = String(e);
    clearPreview();
  } finally {
    createproject.disabled = openproject.disabled = false;
    busyBtn.textContent = label;
  }
}
createproject.addEventListener("click", () => chooseProject("create"));
openproject.addEventListener("click", () => chooseProject("open"));
switchproject.addEventListener("click", async () => {
  await window.desktop.resetProject();
  sessionId = null;
  log.innerHTML = "";
  clearPreview();
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

window.desktop.onAgentEvent((evt) => {
  switch (evt.type) {
    case "text":
      if (!assistantEl) assistantEl = addMsg("assistant", "");
      assistantEl.textContent += evt.text;
      log.scrollTop = log.scrollHeight;
      break;
    case "tool":
      assistantEl = null;
      addMsg("tool", `⚙ ${evt.name}${evt.input ? " " + JSON.stringify(evt.input) : ""}`);
      break;
    case "result":
      assistantEl = null;
      break;
    case "error":
      assistantEl = null;
      addMsg("error", "✖ " + evt.message);
      break;
  }
});

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
  // Enter sends; Shift+Enter inserts a newline.
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
});

// ---- Boot --------------------------------------------------------------------
boot();
