// ©2026 thinkany llc. All rights reserved.
// Single import point for UI copy: `import { copy } from "@/copy"`. Today it is
// English; Phase 2 selects a locale HERE (e.g. `catalogs[siteConfig.locale] ?? en`)
// and every consumer keeps importing `copy` unchanged. `Copy` is the shape any added
// locale must match, so a missing or misnamed key is a build error, not a runtime gap.
import { en } from "./en";

export type Copy = typeof en;
export const copy: Copy = en;
