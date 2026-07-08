// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { REVIEWS_BY_LETTER, LETTERS } from "./reviewsData";
import { Nav2 } from "./Nav2";
import { Footer2 } from "./Footer2";

interface Props {
  onNavigate: (page: string) => void;
}

export function ReviewsAZ2({ onNavigate }: Props) {
  const [activeLetter, setActiveLetter] = useState("A");
  const films = REVIEWS_BY_LETTER[activeLetter] ?? [];

  return (
    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", background: "#faf8f3", minHeight: "100vh", color: "#1a1612" }}>

      {/* Header */}
      <header style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#a0856a", marginBottom: 8, whiteSpace: "nowrap" }}>since 2004 ↓</div>
        <div style={{ borderBottom: "1.5px solid #c9b99a", paddingBottom: 24 }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(36px, 6vw, 62px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 6 }}>Deep Focus Review</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "#7a6655", lineHeight: 1.4 }}>A film journal by Brian Eggert — notes from the dark.</p>
          </button>
        </div>
        <Nav2 onNavigate={onNavigate} activePage="reviews" />
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: "#a0856a", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span>the full archive</span>
            <span style={{ flex: 1, maxWidth: 80, borderBottom: "1px dashed #c9b99a" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h1 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "#1a1612" }}>
              Reviews <em>A–Z</em>
            </h1>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 36, fontWeight: 700, color: "#1a1612", lineHeight: 1 }}>1,400+</div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e" }}>reviews, and counting</div>
            </div>
          </div>
        </div>

        {/* Letter strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 40, paddingBottom: 32, borderBottom: "1px dashed #c9b99a" }}>
          {LETTERS.map((letter) => {
            const hasFilms = (REVIEWS_BY_LETTER[letter]?.length ?? 0) > 0;
            const isActive = activeLetter === letter;
            return (
              <button key={letter} onClick={() => hasFilms && setActiveLetter(letter)}
                style={{
                  minWidth: 34,
                  height: 34,
                  padding: "0 6px",
                  background: isActive ? "#7a6655" : "transparent",
                  color: isActive ? "#faf8f3" : hasFilms ? "#7a6655" : "#d0c4b4",
                  border: `1px solid ${isActive ? "#7a6655" : hasFilms ? "#c9b99a" : "rgba(201,185,154,0.3)"}`,
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: 15,
                  fontStyle: "italic",
                  cursor: hasFilms ? "pointer" : "default",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { if (hasFilms && !isActive) { e.currentTarget.style.background = "#f0e8da"; } }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Letter heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 56, fontWeight: 700, fontStyle: "italic", color: "#1a1612", lineHeight: 1, letterSpacing: "-0.02em" }}>{activeLetter}</div>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e" }}>{films.length} {films.length === 1 ? "entry" : "entries"}</div>
          </div>
          <div style={{ flex: 1, borderBottom: "1px dashed #c9b99a" }} />
        </div>

        {/* Two-column film list */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
          {films.map((film) => (
            <div key={`${film.title}-${film.year}`}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(201,185,154,0.25)", cursor: "pointer", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,185,154,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 16, color: "#2d2420", lineHeight: 1.3, fontStyle: film.definitive ? "italic" : "normal" }}>
                  {film.title}
                </span>
                {film.definitive && (
                  <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#a0856a", whiteSpace: "nowrap", flexShrink: 0 }}>✦</span>
                )}
              </div>
              <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070", flexShrink: 0 }}>{film.year}</span>
            </div>
          ))}
        </div>

        {/* Definitives key */}
        <div style={{ marginTop: 36, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✦</span>
          <span>part of The Definitives series</span>
        </div>
      </div>
      <Footer2 onNavigate={onNavigate} />
    </div>
  );
}
