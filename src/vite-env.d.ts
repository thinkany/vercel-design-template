/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Company / organization name — shown in the dashboard header wordmark. */
  readonly VITE_COMPANY_NAME: string;
  /** Public site name — fills the primary part of the title lockup. */
  readonly VITE_SITE_NAME: string;
  /** Public site subtitle — fills the secondary part of the title lockup. */
  readonly VITE_SITE_SUBTITLE: string;
  /** Public site tagline — shown in the masthead/header. Optional. */
  readonly VITE_SITE_TAGLINE: string;
  /** Phase II marker — "true" once the styleguide is configured for the project. */
  readonly VITE_STYLEGUIDE_READY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
