// Preload — the only bridge between the sandboxed renderer and the main process.
// CommonJS (.cjs) so it loads regardless of sandbox/ESM settings.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // ---- Agent ----
  sendPrompt: (prompt, sessionId, opts) =>
    ipcRenderer.invoke("agent:prompt", { prompt, sessionId, reviewMode: !!(opts && opts.reviewMode), model: (opts && opts.model) || null }),
  interruptAgent: () => ipcRenderer.invoke("agent:interrupt"),
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

  // ---- Intake (rich in-pane onboarding cards — ticket T2) ----
  onAgentIntake: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on("agent:intake", listener);
    return () => ipcRenderer.removeListener("agent:intake", listener);
  },
  answerIntake: (id, answers) => ipcRenderer.invoke("agent:intakeAnswer", { id, answers }),
  cancelIntake: (id) => ipcRenderer.invoke("agent:cancelIntake", { id }),
  reviewDesign: (id) => ipcRenderer.invoke("artdirector:review", { id }),
  loadRecs: (id) => ipcRenderer.invoke("artdirector:loadRecs", { id }),
  saveRecs: (id, active, dismissed, completed) => ipcRenderer.invoke("artdirector:saveRecs", { id, active, dismissed, completed }),
  onAgentSuggestions: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on("agent:suggestions", listener);
    return () => ipcRenderer.removeListener("agent:suggestions", listener);
  },
  beginIntake: (deliverableType, projectType) => ipcRenderer.invoke("intake:begin", { deliverableType, projectType }),
  addBriefNote: (text) => ipcRenderer.invoke("intake:addNote", { text }),
  setBriefTone: (tone) => ipcRenderer.invoke("intake:setTone", { tone }),
  applyIntakeAnswers: (cards, answers) => ipcRenderer.invoke("intake:applyAnswers", { cards, answers }),
  directionMeta: () => ipcRenderer.invoke("intake:directionMeta"),
  sampleDirection: (opts) => ipcRenderer.invoke("intake:sampleDirection", opts || {}),
  sampleDirectionFor: (signals, opts) => ipcRenderer.invoke("direction:sampleFor", { signals, ...(opts || {}) }),
  readVariation: (id) => ipcRenderer.invoke("variation:read", { id }),
  createRerollFork: (sourceId, direction) => ipcRenderer.invoke("variation:createRerollFork", { sourceId, direction }),
  getDesignPrompt: () => ipcRenderer.invoke("intake:designPrompt"),
  onAgentBrief: (cb) => {
    const listener = (_e, brief) => cb(brief);
    ipcRenderer.on("agent:brief", listener);
    return () => ipcRenderer.removeListener("agent:brief", listener);
  },

  // ---- API key ----
  getKeyStatus: () => ipcRenderer.invoke("key:status"),
  saveKey: (key) => ipcRenderer.invoke("key:save", { key }),
  clearKey: () => ipcRenderer.invoke("key:clear"),

  // ---- Competitor research (licensed toggle) ----
  getImagesMode: () => ipcRenderer.invoke("images:get"),
  setImagesMode: (placeholder) => ipcRenderer.invoke("images:set", { placeholder }),
  getResearch: () => ipcRenderer.invoke("research:get"),
  setResearchGlobal: (enabled) => ipcRenderer.invoke("research:setGlobal", { enabled }),
  setResearchVariation: (enabled) => ipcRenderer.invoke("research:setVariation", { enabled }),
  setResearchBroadGlobal: (enabled) => ipcRenderer.invoke("research:setBroadGlobal", { enabled }),
  setResearchBroadVariation: (enabled) => ipcRenderer.invoke("research:setBroadVariation", { enabled }),

  // ---- Session history ----
  listSessions: () => ipcRenderer.invoke("session:list"),
  archiveSession: (sessionId) => ipcRenderer.invoke("session:archive", { sessionId }),
  loadSession: (id) => ipcRenderer.invoke("session:load", { id }),
  deleteSession: (id) => ipcRenderer.invoke("session:delete", { id }),
  deleteAllSessions: () => ipcRenderer.invoke("session:deleteAll"),

  // ---- Derive license (Figma export) ----
  getLicenseStatus: () => ipcRenderer.invoke("license:status"),
  readFigmaMeta: () => ipcRenderer.invoke("figma:readMeta"),
  applyFigmaBrand: () => ipcRenderer.invoke("figma:applyBrand"),
  installFont: (family) => ipcRenderer.invoke("font:install", { family }),
  uploadLogo: () => ipcRenderer.invoke("figma:uploadLogo"),
  saveLicense: (key) => ipcRenderer.invoke("license:save", { key }),
  clearLicense: () => ipcRenderer.invoke("license:clear"),
  getDesignLicenseStatus: () => ipcRenderer.invoke("license:designStatus"),
  saveDesignLicense: (key) => ipcRenderer.invoke("license:designSave", { key }),
  clearDesignLicense: () => ipcRenderer.invoke("license:designClear"),

  // ---- Publish (direct-to-Vercel) ----
  getVercelStatus: () => ipcRenderer.invoke("vercel:status"),
  connectVercel: () => ipcRenderer.invoke("vercel:oauthStart"),
  saveVercelToken: (token) => ipcRenderer.invoke("vercel:save", { token }),
  getVercelTeams: () => ipcRenderer.invoke("vercel:teams"),
  getVercelDomains: () => ipcRenderer.invoke("vercel:domains"),
  setPublishDomain: (domain) => ipcRenderer.invoke("publish:setDomain", { domain }),
  selectVercelScope: (teamId, teamName) => ipcRenderer.invoke("vercel:selectScope", { teamId, teamName }),
  clearVercel: () => ipcRenderer.invoke("vercel:clear"),
  getPublishStatus: () => ipcRenderer.invoke("publish:status"),
  runPublish: (opts) => ipcRenderer.invoke("publish:run", opts || {}),
  onPublishProgress: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on("publish:progress", listener);
    return () => ipcRenderer.removeListener("publish:progress", listener);
  },

  // ---- Model ----
  getModels: () => ipcRenderer.invoke("models:list"),
  getModel: () => ipcRenderer.invoke("model:get"),
  setModel: (model) => ipcRenderer.invoke("model:set", { model }),

  // ---- Project (workspace) ----
  getProjectStatus: () => ipcRenderer.invoke("project:status"),
  getDesignState: () => ipcRenderer.invoke("project:design"),
  probePreview: (url) => ipcRenderer.invoke("preview:probe", { url }),
  getCompanyStatus: () => ipcRenderer.invoke("company:status"),
  applyCompany: (form) => ipcRenderer.invoke("company:apply", form),
  downloadCompany: () => ipcRenderer.invoke("company:download"),
  getDefaultCompany: () => ipcRenderer.invoke("company:defaultStatus"),
  saveDefaultCompany: () => ipcRenderer.invoke("company:saveDefault"),
  clearDefaultCompany: () => ipcRenderer.invoke("company:clearDefault"),
  createProject: () => ipcRenderer.invoke("project:create"),
  openProject: () => ipcRenderer.invoke("project:open"),
  getRecentProjects: () => ipcRenderer.invoke("projects:recent"),
  openProjectPath: (path) => ipcRenderer.invoke("project:openPath", { path }),
  resetProject: () => ipcRenderer.invoke("project:reset"),
  onViteReady: (cb) => {
    const listener = (_e, url) => cb(url);
    ipcRenderer.on("vite:ready", listener);
    return () => ipcRenderer.removeListener("vite:ready", listener);
  },
  // A preview page opened a new window (target=_blank / window.open) — the main
  // process routes the URL here so the shell can open it as a new browser tab.
  onPreviewOpenUrl: (cb) => {
    const listener = (_e, url) => cb(url);
    ipcRenderer.on("preview:open-url", listener);
    return () => ipcRenderer.removeListener("preview:open-url", listener);
  },

  // ---- Design references (reference-ingest T0: store + list, no model) ----
  listReferences: () => ipcRenderer.invoke("references:list"),
  addReferences: () => ipcRenderer.invoke("references:add"),
  addReferencePaths: (paths) => ipcRenderer.invoke("references:addPaths", { paths }),
  removeReference: (id) => ipcRenderer.invoke("references:remove", { id }),
  onReferencesChanged: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on("references:changed", listener);
    return () => ipcRenderer.removeListener("references:changed", listener);
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

  // ---- Copy voice (tone + rules) ----
  getVoice: () => ipcRenderer.invoke("voice:get"),
  saveProjectVoice: (v) => ipcRenderer.invoke("voice:saveProject", v),
  saveGlobalRules: (rules) => ipcRenderer.invoke("voice:saveGlobal", { rules }),

  // ---- Misc ----
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),

  // Absolute file: URL of the preview inspector (point & comment), attached as the
  // preview <webview>'s preload. Resolved in MAIN (a sandboxed preload has no
  // __dirname), fetched once at boot by the shell.
  getPreviewInspectPreload: () => ipcRenderer.invoke("preview:preloadPath"),
});
