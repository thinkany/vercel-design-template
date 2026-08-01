/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Company / organization name — shown in the dashboard header wordmark. */
  readonly VITE_COMPANY_NAME: string;
  /** Client name — fills the primary part of the title lockup. */
  readonly VITE_CLIENT_NAME: string;
  /** Project name — fills the secondary part of the title lockup. */
  readonly VITE_PROJECT_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
