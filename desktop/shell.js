// Renderer logic: point the preview iframe at Vite, gate the chat behind an
// API-key connect screen, and pipe messages through window.desktop to the agent.

const params = new URLSearchParams(location.search);
const viteUrl = params.get("viteUrl") || "about:blank";
document.getElementById("frame").src = viteUrl;

const status = document.getElementById("status");
const resetkey = document.getElementById("resetkey");
const keygate = document.getElementById("keygate");
const keyinput = document.getElementById("keyinput");
const keysave = document.getElementById("keysave");
const keyerror = document.getElementById("keyerror");
const chatmain = document.getElementById("chatmain");
const log = document.getElementById("log");
const input = document.getElementById("input");
const send = document.getElementById("send");

let sessionId = null;
let assistantEl = null; // the streaming assistant bubble we're appending into

// ---- Key gate ----------------------------------------------------------------
async function refreshKeyState() {
  const { hasKey } = await window.desktop.getKeyStatus();
  keygate.hidden = hasKey;
  chatmain.hidden = !hasKey;
  resetkey.hidden = !hasKey;
  status.textContent = hasKey ? "ready" : "not connected";
  if (hasKey) input.focus();
  else keyinput.focus();
}

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
      await refreshKeyState();
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
  await refreshKeyState();
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
  const el = document.createElement("div");
  el.className = "msg " + cls;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
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
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    submit();
  }
});

// ---- Boot --------------------------------------------------------------------
refreshKeyState();
