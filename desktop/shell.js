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

// Preview
const frame = el("frame");
const previewph = el("previewph");
const phEmoji = previewph.querySelector(".ph-emoji");
const phTitle = el("ph-title");
const phText = el("ph-text");

let sessionId = null;
let assistantEl = null;

// Preview state
let viteUrl = null;
let design = { active: false, variationId: null };
let previewShownFor = null; // URL currently loaded, so we don't reload each turn

// ---- Preview -----------------------------------------------------------------
function showPlaceholder({ emoji, title, text }) {
  phEmoji.textContent = emoji;
  phTitle.textContent = title;
  phText.textContent = text;
  frame.hidden = true;
  frame.src = "about:blank";
  previewph.hidden = false;
  previewShownFor = null;
}

function showDesign() {
  const url = design.variationId ? `${viteUrl}/?v=${design.variationId}` : viteUrl;
  if (previewShownFor === url) return; // already loaded; let Vite HMR do the rest
  frame.src = url;
  frame.hidden = false;
  previewph.hidden = true;
  previewShownFor = url;
}

function refreshPreview() {
  if (!viteUrl) {
    showPlaceholder({
      emoji: "⏳",
      title: "Starting the preview…",
      text: "Spinning up the project's dev server.",
    });
  } else if (design.active) {
    showDesign();
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
      assistantEl = null;
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

// ---- Boot --------------------------------------------------------------------
boot();
