// ©2004-2026 Deep Focus Review. All rights reserved.
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type C3Theme = "dark" | "light";

export const C3_DARK = {
  pageBg: "#0d0c0b",
  navBg: "#0d0c0b",
  navBorder: "rgba(201,168,76,0.12)",
  cardBg: "#1a1814",
  dropdownBg: "#141210",
  surfaceTint: "rgba(201,168,76,0.04)",
  textPrimary: "#ede9e0",
  textHero: "#f0e8d8",
  textBody: "#d0c8b8",
  textSub: "#c8bfa8",
  textMuted: "rgba(237,233,224,0.65)",
  textFaint: "rgba(237,233,224,0.4)",
  textDimmer: "rgba(237,233,224,0.35)",
  gold: "#c9a84c",
  goldMuted: "rgba(201,168,76,0.5)",
  goldFaint: "rgba(201,168,76,0.25)",
  goldFainter: "rgba(201,168,76,0.15)",
  goldFaintest: "rgba(201,168,76,0.07)",
  border: "rgba(201,168,76,0.15)",
  borderFaint: "rgba(201,168,76,0.07)",
  heroGradient: "linear-gradient(to bottom, transparent 30%, #0d0c0b 100%)",
  heroGradientTop: "linear-gradient(to top, #0d0c0b 0%, rgba(13,12,11,0.4) 60%, transparent 100%)",
  heroCardOverlay: "linear-gradient(to top, #0d0c0b 0%, rgba(13,12,11,0.2) 55%, transparent 100%)",
  cardOverlay: "linear-gradient(to top, rgba(13,12,11,0.8) 0%, transparent 55%)",
  divider: "rgba(255,255,255,0.07)",
  imgFilterFeatured: "brightness(0.38)",
  imgFilter: "brightness(0.45)",
  imgFilter2: "brightness(0.55)",
  imgFilterHero: "brightness(0.2) saturate(0.6)",
};

export const C3_LIGHT = {
  pageBg: "#f5efe4",
  navBg: "#f5efe4",
  navBorder: "rgba(140,100,20,0.15)",
  cardBg: "#e6dece",
  dropdownBg: "#faf6ee",
  surfaceTint: "rgba(140,100,20,0.05)",
  textPrimary: "#1a1510",
  textHero: "#f0e8d8",
  textBody: "#2a2018",
  textSub: "#46392c",
  textMuted: "rgba(26,21,16,0.62)",
  textFaint: "rgba(26,21,16,0.48)",
  textDimmer: "rgba(26,21,16,0.33)",
  gold: "#9a7218",
  goldMuted: "rgba(130,95,15,0.65)",
  goldFaint: "rgba(130,95,15,0.3)",
  goldFainter: "rgba(130,95,15,0.18)",
  goldFaintest: "rgba(130,95,15,0.09)",
  border: "rgba(130,95,15,0.18)",
  borderFaint: "rgba(130,95,15,0.09)",
  heroGradient: "linear-gradient(to bottom, transparent 30%, #f5efe4 100%)",
  heroGradientTop: "linear-gradient(to top, #f5efe4 0%, rgba(245,239,228,0.4) 60%, transparent 100%)",
  heroCardOverlay: "linear-gradient(to top, #f5efe4 0%, rgba(245,239,228,0.2) 55%, transparent 100%)",
  cardOverlay: "linear-gradient(to top, rgba(245,239,228,0.7) 0%, transparent 55%)",
  divider: "rgba(0,0,0,0.07)",
  imgFilterFeatured: "brightness(0.7)",
  imgFilter: "brightness(0.78)",
  imgFilter2: "brightness(0.82)",
  imgFilterHero: "brightness(0.28) saturate(0.5)",
};

export type C3Colors = typeof C3_DARK;

const C3ThemeContext = createContext<{
  theme: C3Theme;
  toggle: () => void;
  c: C3Colors;
}>({ theme: "dark", toggle: () => {}, c: C3_DARK });

export function C3ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<C3Theme>("dark");
  const c = theme === "dark" ? C3_DARK : C3_LIGHT;
  return (
    <C3ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")), c }}>
      {children}
    </C3ThemeContext.Provider>
  );
}

export function useC3Theme() {
  return useContext(C3ThemeContext);
}
