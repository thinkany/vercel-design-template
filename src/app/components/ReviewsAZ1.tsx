// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { REVIEWS_BY_LETTER, LETTERS } from "./reviewsData";
import { Nav1 } from "./Nav1";
import { Footer1 } from "./Footer1";

interface Props {
  onNavigate: (page: string) => void;
}

export function ReviewsAZ1({ onNavigate }: Props) {
  const [activeLetter, setActiveLetter] = useState("A");
  const films = REVIEWS_BY_LETTER[activeLetter] ?? [];

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111" }}>

      {/* Masthead */}
      <div style={{ padding: "28px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, marginLeft: -6 }}>
            <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo-header.png" alt="Deep Focus Review" style={{ width: "clamp(240px, 26.4vw, 360px)", height: "auto", display: "block" }} />
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#333", letterSpacing: "0.06em", marginTop: 5, paddingLeft: 8 }}>Independent Film Criticism Since 2004</div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "#555" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="20" height="13" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="16" height="14" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
              </div>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #555", padding: "5px 10px", gap: 6, background: "transparent" }}>
                <input
                  placeholder="Search..."
                  style={{ border: "none", outline: "none", background: "transparent", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#111", width: 140, letterSpacing: "0.04em" }}
                />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
        </div>
          </div>
        <Nav1 onNavigate={onNavigate} activePage="reviews" />
        <div style={{ borderBottom: "3px solid #111111" }} />
      </div>

      {/* Page header */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 10 }}>INDEX</div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#111" }}>
              Reviews <em style={{ fontWeight: 300 }}>A–Z</em>
            </h1>
          </div>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", textAlign: "right" }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 700, color: "#111", lineHeight: 1 }}>1,400+</div>
            <div style={{ marginTop: 4 }}>REVIEWS</div>
          </div>
        </div>

        {/* Letter filter */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 36 }}>
          {LETTERS.map((letter) => {
            const hasFilms = (REVIEWS_BY_LETTER[letter]?.length ?? 0) > 0;
            return (
              <button key={letter} onClick={() => hasFilms && setActiveLetter(letter)}
                style={{
                  width: 36,
                  height: 36,
                  background: activeLetter === letter ? "#111" : "transparent",
                  color: activeLetter === letter ? "#f8f7f3" : hasFilms ? "#333" : "#ccc",
                  border: "1px solid",
                  borderColor: activeLetter === letter ? "#111" : hasFilms ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.07)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: hasFilms ? "pointer" : "default",
                  letterSpacing: "0.04em",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => { if (hasFilms && activeLetter !== letter) { e.currentTarget.style.background = "#eee"; } }}
                onMouseLeave={(e) => { if (activeLetter !== letter) e.currentTarget.style.background = "transparent"; }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Current letter heading + count */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 24, paddingBottom: 12, borderBottom: "2px solid #111" }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 48, fontWeight: 700, lineHeight: 1, color: "#111", letterSpacing: "-0.02em" }}>{activeLetter}</div>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.12em" }}>
            {films.length} {films.length === 1 ? "REVIEW" : "REVIEWS"}
          </div>
        </div>

        {/* Film list — two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 48px", marginBottom: 80 }}>
          {films.map((film) => (
            <div key={`${film.title}-${film.year}`}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(0,0,0,0.07)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 500, color: "#111", lineHeight: 1.3 }}>
                  {film.title}
                </span>
                {film.definitive && (
                  <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: "0.1em", color: "#1e4b96", border: "1px solid #1e4b96", padding: "1px 5px", whiteSpace: "nowrap", flexShrink: 0 }}>DEFINITIVE</span>
                )}
              </div>
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#999", letterSpacing: "0.04em", flexShrink: 0, marginLeft: 12 }}>{film.year}</span>
            </div>
          ))}
        </div>
      </div>
      <Footer1 onNavigate={onNavigate} />
    </div>
  );
}
