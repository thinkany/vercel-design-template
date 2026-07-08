// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { REVIEWS_BY_LETTER, LETTERS } from "./reviewsData";
import { MobileMasthead, MobileFooter } from "./MobileShared";

export function ReviewsAZ1Mobile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const navigate = onNavigate ?? (() => {});
  const [activeLetter, setActiveLetter] = useState("A");
  const films = REVIEWS_BY_LETTER[activeLetter] ?? [];

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>

      <MobileMasthead onNavigate={navigate} activePage="reviews" />

      {/* Page header */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 8 }}>INDEX</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "#111" }}>
            Reviews <em style={{ fontWeight: 300 }}>A–Z</em>
          </h1>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#111", lineHeight: 1 }}>1,400+</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginTop: 2 }}>REVIEWS</div>
          </div>
        </div>
      </div>

      {/* Letter strip — horizontal scroll */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", overflowX: "auto", scrollbarWidth: "none" }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          {LETTERS.map((letter) => {
            const hasFilms = (REVIEWS_BY_LETTER[letter]?.length ?? 0) > 0;
            const isActive = activeLetter === letter;
            return (
              <button key={letter}
                onClick={() => hasFilms && setActiveLetter(letter)}
                style={{
                  width: 32, height: 32,
                  background: isActive ? "#111" : "transparent",
                  color: isActive ? "#f8f7f3" : hasFilms ? "#333" : "#ccc",
                  border: `1px solid ${isActive ? "#111" : hasFilms ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)"}`,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 11, fontWeight: 600,
                  cursor: hasFilms ? "pointer" : "default",
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                  borderRadius: 2,
                }}>
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current letter + count */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "2px solid #111", display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 40, fontWeight: 700, lineHeight: 1, color: "#111", letterSpacing: "-0.02em" }}>
          {activeLetter}
        </div>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.1em" }}>
          {films.length} {films.length === 1 ? "REVIEW" : "REVIEWS"}
        </div>
      </div>

      {/* Film list — single column */}
      <div style={{ padding: "0 16px 40px" }}>
        {films.length === 0 ? (
          <div style={{ padding: "32px 0", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 15, color: "#888", fontStyle: "italic" }}>
            No reviews for this letter yet.
          </div>
        ) : (
          films.map((film) => (
            <div key={`${film.title}-${film.year}`}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flex: 1, marginRight: 10 }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 500, color: "#111", lineHeight: 1.3 }}>
                  {film.title}
                </span>
                {film.definitive && (
                  <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: "0.1em", color: "#1e4b96", border: "1px solid #1e4b96", padding: "1px 5px", whiteSpace: "nowrap", flexShrink: 0 }}>
                    DEFINITIVE
                  </span>
                )}
              </div>
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#999", letterSpacing: "0.04em", flexShrink: 0 }}>
                {film.year}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: "0 16px 32px", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "rgba(30,75,150,0.6)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: "0.1em", color: "#1e4b96", border: "1px solid #1e4b96", padding: "1px 5px" }}>DEFINITIVE</span>
        <span style={{ color: "#888" }}>Part of The Definitives series</span>
      </div>

      <MobileFooter onNavigate={navigate} />
    </div>
  );
}
