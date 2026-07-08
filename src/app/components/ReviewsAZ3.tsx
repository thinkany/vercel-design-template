// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { REVIEWS_BY_LETTER, LETTERS } from "./reviewsData";
import { Nav3 } from "./Nav3";
import { Footer3 } from "./Footer3";
import { useC3Theme } from "./c3Theme";

interface Props {
  onNavigate: (page: string) => void;
}

export function ReviewsAZ3({ onNavigate }: Props) {
  const { c } = useC3Theme();
  const [activeLetter, setActiveLetter] = useState("A");
  const films = REVIEWS_BY_LETTER[activeLetter] ?? [];

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", color: c.textPrimary, transition: "background 0.2s" }}>

      <Nav3 onNavigate={onNavigate} activePage="reviews" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 48px 80px" }}>

        {/* Page title row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, paddingBottom: 32, borderBottom: `1px solid ${c.border}` }}>
          <div>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, letterSpacing: "0.2em", color: c.goldMuted, marginBottom: 12 }}>THE ARCHIVE</div>
            <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: "clamp(25px, 3.5vw, 45px)", fontWeight: 700, lineHeight: 1, letterSpacing: "0.02em", color: c.textPrimary }}>
              Reviews A–Z
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 48, fontWeight: 700, color: c.gold, lineHeight: 1 }}>1,400+</div>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, letterSpacing: "0.12em", color: c.goldMuted, marginTop: 4 }}>REVIEWS IN THE ARCHIVE</div>
          </div>
        </div>

        {/* Letter strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 52 }}>
          {LETTERS.map((letter) => {
            const hasFilms = (REVIEWS_BY_LETTER[letter]?.length ?? 0) > 0;
            const isActive = activeLetter === letter;
            return (
              <button key={letter} onClick={() => hasFilms && setActiveLetter(letter)}
                style={{
                  minWidth: 38,
                  height: 38,
                  padding: "0 8px",
                  background: isActive ? c.gold : "transparent",
                  color: isActive ? "#0d0c0b" : hasFilms ? c.goldMuted : c.goldFainter,
                  border: `1px solid ${isActive ? c.gold : hasFilms ? c.goldFainter : c.goldFaintest}`,
                  fontFamily: "'Bodoni Moda', Georgia, serif",
                  fontSize: 15,
                  cursor: hasFilms ? "pointer" : "default",
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => { if (hasFilms && !isActive) { e.currentTarget.style.background = c.surfaceTint; e.currentTarget.style.borderColor = c.goldFaint; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = hasFilms ? c.goldFainter : c.goldFaintest; } }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Active letter heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 72, fontWeight: 700, color: c.gold, lineHeight: 1, letterSpacing: "0.04em", opacity: 0.9 }}>{activeLetter}</div>
          <div style={{ flex: 1, borderTop: `1px solid ${c.border}` }} />
          <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, letterSpacing: "0.14em", color: c.goldMuted }}>
            {films.length} {films.length === 1 ? "ENTRY" : "ENTRIES"}
          </div>
        </div>

        {/* Film list — three columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 40px" }}>
          {films.map((film) => (
            <div key={`${film.title}-${film.year}`}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderFaint}`, cursor: "pointer", gap: 8, transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = c.surfaceTint)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 15, color: film.definitive ? c.gold : c.textSub, lineHeight: 1.35, fontStyle: film.definitive ? "italic" : "normal" }}>
                  {film.title}
                </span>
                {film.definitive && (
                  <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 10, color: c.goldMuted, flexShrink: 0 }}>✦</span>
                )}
              </div>
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, color: c.goldFaint, letterSpacing: "0.04em", flexShrink: 0 }}>{film.year}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 40, fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, fontStyle: "italic", color: c.goldMuted, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✦</span>
          <span>Part of The Definitives series</span>
        </div>
      </div>
      <Footer3 onNavigate={onNavigate} />
    </div>
  );
}
