// Preload — the only bridge between the sandboxed renderer and the main process.
// CommonJS (.cjs) so it loads regardless of sandbox/ESM settings.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // ---- Agent ----
  sendPrompt: (prompt, sessionId) =>
    ipcRenderer.invoke("agent:prompt", { prompt, sessionId }),
  onAgentEvent: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },

  // ---- API key ----
  getKeyStatus: () => ipcRenderer.invoke("key:status"),
  saveKey: (key) => ipcRenderer.invoke("key:save", { key }),
  clearKey: () => ipcRenderer.invoke("key:clear"),

  // ---- Project (workspace) ----
  getProjectStatus: () => ipcRenderer.invoke("project:status"),
  getDesignState: () => ipcRenderer.invoke("project:design"),
  createProject: () => ipcRenderer.invoke("project:create"),
  openProject: () => ipcRenderer.invoke("project:open"),
  resetProject: () => ipcRenderer.invoke("project:reset"),
  onViteReady: (cb) => {
    const listener = (_e, url) => cb(url);
    ipcRenderer.on("vite:ready", listener);
    return () => ipcRenderer.removeListener("vite:ready", listener);
  },

  // ---- Misc ----
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
});
