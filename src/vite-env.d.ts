/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Company / organization name — shown in the dashboard header wordmark. */
  readonly VITE_COMPANY_NAME: string;
  /** Client name — fills the primary part of the title lockup. */
  readonly VITE_CLIENT_NAME: string;
  /** Project name — fills the secondary part of the title lockup. */
  readonly VITE_PROJECT_NAME: string;
  /** Phase II marker — "true" once the styleguide is configured for the project. */
  readonly VITE_STYLEGUIDE_READY: string;
  /** Brand-palette marker (base scope) — "true" once the --ta-* brand is established. */
  readonly VITE_BRAND_READY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
