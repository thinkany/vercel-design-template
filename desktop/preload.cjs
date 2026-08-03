// Preload — the only bridge between the sandboxed renderer and the main process.
// CommonJS (.cjs) so it loads regardless of sandbox/ESM settings.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // Send a prompt to the agent; resolves with { sessionId } when the turn ends.
  sendPrompt: (prompt, sessionId) =>
    ipcRenderer.invoke("agent:prompt", { prompt, sessionId }),

  // Subscribe to streamed agent events. Returns an unsubscribe fn.
  onAgentEvent: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },

  // API key: check status, save (validated + persisted), or clear.
  getKeyStatus: () => ipcRenderer.invoke("key:status"),
  saveKey: (key) => ipcRenderer.invoke("key:save", { key }),
  clearKey: () => ipcRenderer.invoke("key:clear"),

  // Open a URL in the user's real browser (not an Electron window).
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
});
