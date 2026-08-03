// Preload — the only bridge between the sandboxed renderer and the main process.
// CommonJS (.cjs) so it loads regardless of sandbox/ESM settings.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // ---- Agent ----
  sendPrompt: (prompt, sessionId) =>
    ipcRenderer.invoke("agent:prompt", { prompt, sessionId }),
  onAgentEvent: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
  onAgentAsk: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on("agent:ask", listener);
    return () => ipcRenderer.removeListener("agent:ask", listener);
  },
  answerAgent: (id, answers) => ipcRenderer.invoke("agent:answer", { id, answers }),
  cancelAsk: (id) => ipcRenderer.invoke("agent:cancelAsk", { id }),

  // ---- API key ----
  getKeyStatus: () => ipcRenderer.invoke("key:status"),
  saveKey: (key) => ipcRenderer.invoke("key:save", { key }),
  clearKey: () => ipcRenderer.invoke("key:clear"),

  // ---- Model ----
  getModels: () => ipcRenderer.invoke("models:list"),
  getModel: () => ipcRenderer.invoke("model:get"),
  setModel: (model) => ipcRenderer.invoke("model:set", { model }),

  // ---- Project (workspace) ----
  getProjectStatus: () => ipcRenderer.invoke("project:status"),
  getDesignState: () => ipcRenderer.invoke("project:design"),
  getCompanyStatus: () => ipcRenderer.invoke("company:status"),
  downloadCompany: () => ipcRenderer.invoke("company:download"),
  createProject: () => ipcRenderer.invoke("project:create"),
  openProject: () => ipcRenderer.invoke("project:open"),
  resetProject: () => ipcRenderer.invoke("project:reset"),
  onViteReady: (cb) => {
    const listener = (_e, url) => cb(url);
    ipcRenderer.on("vite:ready", listener);
    return () => ipcRenderer.removeListener("vite:ready", listener);
  },

  // ---- File attach ----
  attachFile: () => ipcRenderer.invoke("file:attach"),
  attachFilePath: (srcPath) => ipcRenderer.invoke("file:attachPath", { srcPath }),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },

  // ---- Misc ----
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
});
