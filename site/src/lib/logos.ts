// ©2026 thinkany llc. All rights reserved.
/**
 * LOGOS (CORE). Four slots: header, header on mobile, footer, footer on mobile.
 * Settings → Logos fills any of them; the rest resolve from what's there, so one
 * logo serves every slot and none at all falls back to the wordmark (text, the
 * project name unless set). The design's brand logo (VITE_BRAND_LOGO) seeds the
 * desktop header slot when the site has nothing of its own.
 */
export type LogoSlot = "header" | "headerMobile" | "footer" | "footerMobile";
export type LogosSetting = { items?: { slot: LogoSlot; src: string }[]; wordmark?: string };
export type ResolvedLogos = { header?: string; headerMobile?: string; footer?: string; footerMobile?: string; wordmark: string };

export function resolveLogos(setting: LogosSetting | undefined, brandLogo: string | undefined, siteName: string): ResolvedLogos {
  const set: Partial<Record<LogoSlot, string>> = {};
  for (const it of (setting && setting.items) || []) if (it && it.src && it.slot && !set[it.slot]) set[it.slot] = it.src;
  const header = set.header || brandLogo || set.footer || set.headerMobile || set.footerMobile;
  const footer = set.footer || header;
  return {
    header,
    headerMobile: set.headerMobile || header,
    footer,
    footerMobile: set.footerMobile || set.headerMobile || footer,
    wordmark: (setting && setting.wordmark && setting.wordmark.trim()) || siteName,
  };
}
