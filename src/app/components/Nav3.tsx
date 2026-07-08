// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useRef } from "react";
import { NAV_ITEMS } from "./navData";
import { useC3Theme } from "./c3Theme";

interface Props {
  onNavigate: (page: string) => void;
  activePage?: string;
}

function handleSubClick(label: string, onNavigate: (page: string) => void) {
  if (label === "Reviews A-Z") onNavigate("reviews");
  else if (label === "The Definitives") onNavigate("definitives");
}

function handleTopClick(label: string, onNavigate: (page: string) => void) {
  if (label === "The Definitives") onNavigate("definitives");
  else if (label === "Reviews") onNavigate("reviews");
  else if (label === "Patreon") { /* external */ }
  else onNavigate("home");
}

function MoonIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function Nav3({ onNavigate, activePage }: Props) {
  const { theme, toggle, c } = useC3Theme();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = (label: string) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpenMenu(label); };
  const close = () => { timeoutRef.current = setTimeout(() => setOpenMenu(null), 120); };

  return (
    <header style={{ background: c.navBg, borderBottom: `1px solid ${c.navBorder}`, width: "100%", position: "relative", zIndex: 200, transition: "background 0.2s" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px", height: 64, display: "flex", alignItems: "center", position: "relative" }}>

        {/* Logo mark + wordmark */}
        <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: 0, flexShrink: 0 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <circle cx="20" cy="20" r="19" fill={c.gold} />
            <circle cx="20" cy="20" r="19" fill="none" stroke={c.pageBg} strokeWidth="0.75" />
            <circle cx="20" cy="20" r="16" fill={c.pageBg} />
            <circle cx="20" cy="20" r="14.5" fill="none" stroke={c.gold} strokeWidth="0.6" strokeOpacity="0.5" />
            <circle cx="20" cy="20" r="12" fill="none" stroke={c.gold} strokeWidth="0.6" strokeOpacity="0.35" />
            <circle cx="20" cy="20" r="9.5" fill="none" stroke={c.gold} strokeWidth="0.6" strokeOpacity="0.25" />
            <circle cx="20" cy="20" r="7" fill="none" stroke={c.gold} strokeWidth="0.8" strokeOpacity="0.7" />
            <circle cx="20" cy="20" r="3.5" fill={c.gold} />
            {[0, 60, 120, 180, 240, 300].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 20 + 16 * Math.cos(rad);
              const y1 = 20 + 16 * Math.sin(rad);
              const x2 = 20 + 19 * Math.cos(rad);
              const y2 = 20 + 19 * Math.sin(rad);
              return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pageBg} strokeWidth="2.5" strokeLinecap="round" />;
            })}
            <text x="20" y="24.5" textAnchor="middle" fontFamily="'Bodoni Moda', Georgia, serif" fontSize="10" fontWeight="700" fill={c.gold} letterSpacing="0.04em">DF</text>
          </svg>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", color: c.textPrimary, lineHeight: 1.1 }}>Deep Focus</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <div style={{ flex: 1, height: "0.5px", background: c.goldMuted }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: c.gold, lineHeight: 1, flexShrink: 0 }}>REVIEW</div>
              <div style={{ flex: 1, height: "0.5px", background: c.goldMuted }} />
            </div>
          </div>
        </button>

        {/* Centered nav */}
        <nav style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 0 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = (item.label === "The Definitives" && activePage === "definitives")
              || (item.label === "Reviews" && activePage === "reviews");
            return (
              <div key={item.label} style={{ position: "relative" }}
                onMouseEnter={() => item.sub ? open(item.label) : setOpenMenu(null)}
                onMouseLeave={close}
              >
                <button
                  onClick={() => handleTopClick(item.label, onNavigate)}
                  style={{ background: "none", border: "none", padding: "0 18px", height: 64, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: isActive ? c.gold : c.textMuted, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = c.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? c.gold : c.textMuted)}
                >
                  {item.label.toUpperCase()}
                  {item.sub && (
                    <svg width="7" height="4" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.5 }}>
                      <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
                {item.sub && openMenu === item.label && (
                  <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", background: c.dropdownBg, border: `1px solid ${c.goldFainter}`, borderTop: `2px solid ${c.gold}`, minWidth: 200, zIndex: 50, boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
                    onMouseEnter={() => open(item.label)} onMouseLeave={close}>
                    {item.sub.map((sub) => (
                      <a key={sub.label} href="#"
                        onClick={(e) => { e.preventDefault(); handleSubClick(sub.label, onNavigate); setOpenMenu(null); }}
                        style={{ display: "block", padding: "10px 18px", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, color: c.textMuted, textDecoration: "none", borderBottom: `1px solid ${c.goldFaintest}`, letterSpacing: "0.04em", transition: "background 0.1s, color 0.1s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = c.surfaceTint; e.currentTarget.style.color = c.gold; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = c.textMuted; }}
                      >{sub.label}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: search + theme toggle + subscribe */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: c.textFaint, padding: 4, display: "flex", alignItems: "center" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = c.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = c.textFaint)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background: "none", border: `1px solid ${c.goldFainter}`, borderRadius: 11, padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", height: 22, transition: "border-color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.goldFaint; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.goldFainter; }}
          >
            <MoonIcon color={theme === "dark" ? c.gold : c.textDimmer} />
            <div style={{ width: "0.5px", height: 9, background: c.goldFainter }} />
            <SunIcon color={theme === "light" ? c.gold : c.textDimmer} />
          </button>

          <button
            style={{ background: c.gold, border: "none", cursor: "pointer", padding: "7px 18px", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#0d0c0b", fontWeight: 600, borderRadius: 2, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Subscribe
          </button>
        </div>

      </div>
    </header>
  );
}
