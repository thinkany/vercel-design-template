// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "./navData";

interface NavProps {
  onNavigate: (page: string) => void;
  activePage?: string;
}

// ── Masthead + Nav ────────────────────────────────────────────────────────────

export function MobileMasthead({ onNavigate, activePage }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ background: "#f8f7f3" }}>
      {/* Safe-area spacer — clears the Dynamic Island */}
      <div style={{ height: 10 }} />
      <div style={{ padding: "0 16px 0" }}>
      {/* Logo row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ marginLeft: -6, cursor: "pointer" }} onClick={() => onNavigate("home")}>
          <img
            src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo-header.png"
            alt="Deep Focus Review"
            style={{ width: 180, height: "auto", display: "block" }}
          />
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#333", letterSpacing: "0.06em", marginTop: 4, paddingLeft: 8 }}>
            Independent Film Criticism Since 2004
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          {/* Social icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "#777", display: "flex" }}>
              <svg width="18" height="12" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg>
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "#777", display: "flex" }}>
              <svg width="14" height="12" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg>
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "#777", display: "flex" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>

          {/* Hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 5 }}>
            {menuOpen
              ? <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#111", lineHeight: 1 }}>✕</span>
              : [0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 22, height: 1.5, background: "#111" }} />)
            }
          </button>
        </div>
      </div>

      {/* Full-screen nav overlay */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "#f8f7f3", zIndex: 1000,
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Overlay header */}
          <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #111" }}>
            <div style={{ marginLeft: -6, cursor: "pointer" }} onClick={() => { onNavigate("home"); setMenuOpen(false); }}>
              <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo-header.png" alt="Deep Focus Review" style={{ width: 160, height: "auto", display: "block" }} />
            </div>
            <button onClick={() => setMenuOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, fontSize: 22, color: "#111", lineHeight: 1, fontFamily: "system-ui" }}>
              ✕
            </button>
          </div>

          {/* Nav items */}
          <div style={{ padding: "8px 24px 32px", flex: 1 }}>
            {NAV_ITEMS.map((item) => (
              <div key={item.label}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid rgba(0,0,0,0.08)", cursor: "pointer" }}
                  onClick={() => {
                    if (item.sub) { setExpanded(expanded === item.label ? null : item.label); }
                    else {
                      if (item.label === "The Definitives") onNavigate("definitives");
                      else if (item.label === "Reviews") onNavigate("reviews");
                      else onNavigate("home");
                      setMenuOpen(false);
                    }
                  }}
                >
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: "#111" }}>
                    {item.label}
                  </span>
                  {item.sub && (
                    <svg width="10" height="6" viewBox="0 0 8 5" fill="none" style={{ transform: expanded === item.label ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                      <path d="M1 1l3 3 3-3" stroke="#333" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {item.sub && expanded === item.label && (
                  <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
                    {item.sub.map((sub) => (
                      <div key={sub.label}
                        style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, letterSpacing: "0.08em", color: "#1e4b96", cursor: "pointer" }}
                        onClick={() => { if (sub.label === "Reviews A-Z") onNavigate("reviews"); else if (sub.label === "The Definitives") onNavigate("definitives"); setMenuOpen(false); }}
                      >{sub.label}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Footer links in overlay */}
            <div style={{ marginTop: 40, display: "flex", gap: 16, alignItems: "center" }}>
              <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "#999", display: "flex" }}>
                <svg width="22" height="14" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "#999", display: "flex" }}>
                <svg width="16" height="14" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "#999", display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

export function MobileSectionHeader({ label, topMargin = 32 }: { label: string; topMargin?: number }) {
  return (
    <div style={{ borderTop: "2px solid #111111", paddingTop: 12, marginTop: topMargin, marginBottom: 16 }}>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>{label}</div>
    </div>
  );
}

// ── Newsletter ────────────────────────────────────────────────────────────────

export function MobileNewsletter() {
  return (
    <div className="dfr-dark" style={{ background: "#111111", color: "#f8f7f3", padding: "24px 16px", marginTop: 32 }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, fontStyle: "italic", marginBottom: 6 }}>The Weekly Reel</div>
      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "rgba(248,247,243,0.7)", marginBottom: 16 }}>
        New reviews, essays, and interviews delivered every Friday.
      </p>
      <input placeholder="your@email.com" style={{ width: "100%", padding: "9px 10px", background: "transparent", border: "1px solid rgba(248,247,243,0.3)", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
      <button style={{ width: "100%", padding: "10px", background: "#1e4b96", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600 }}>SUBSCRIBE</button>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_LINKS = [
  { label: "Reviews A–Z", page: "reviews" },
  { label: "The Definitives", page: "definitives" },
  { label: "About DFR", page: "home" },
  { label: "Support DFR", page: "home" },
  { label: "Contact", page: "home" },
  { label: "Patreon", page: "home" },
];

export function MobileFooter({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <footer className="dfr-dark" style={{ background: "#111111", color: "#f8f7f3", padding: "32px 16px 24px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ height: 3, background: "#1e4b96", marginBottom: 24, marginLeft: -16, marginRight: -16 }} />

      {/* Logo + tagline */}
      <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "block", marginBottom: 8, marginLeft: -6 }}>
        <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo.png" alt="Deep Focus Review" style={{ width: 160, height: "auto", display: "block" }} />
      </button>
      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, lineHeight: 1.6, color: "rgba(248,247,243,0.5)", fontStyle: "italic", marginBottom: 4 }}>
        Independent film criticism since 2004.
      </p>
      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, lineHeight: 1.6, color: "#fff", fontStyle: "italic", marginBottom: 20 }}>
        By Brian Eggert.
      </p>

      {/* Social icons */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "rgba(248,247,243,0.5)", display: "flex" }}>
          <svg width="22" height="15" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.5"/></svg>
        </a>
        <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "rgba(248,247,243,0.5)", display: "flex" }}>
          <svg width="17" height="15" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg>
        </a>
        <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "rgba(248,247,243,0.5)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </a>
      </div>

      {/* Nav links — 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 24 }}>
        {FOOTER_LINKS.map((l) => (
          <a key={l.label} href="#" onClick={(e) => { e.preventDefault(); onNavigate(l.page); }}
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, color: "rgba(248,247,243,0.6)", textDecoration: "none" }}>
            {l.label}
          </a>
        ))}
      </div>

      {/* Copyright */}
      <div style={{ borderTop: "1px solid rgba(248,247,243,0.08)", paddingTop: 16, fontSize: 10, letterSpacing: "0.06em", color: "rgba(248,247,243,0.3)" }}>
        © 2004–2026 DEEP FOCUS REVIEW. ALL RIGHTS RESERVED.
      </div>
    </footer>
  );
}

// ── Mobile Shell — wraps pages that don't yet have a dedicated mobile component ──

export function MobileShell({ onNavigate, activePage, children }: { onNavigate: (page: string) => void; activePage?: string; children: ReactNode }) {
  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>
      <MobileMasthead onNavigate={onNavigate} activePage={activePage} />
      <div style={{ overflowX: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
