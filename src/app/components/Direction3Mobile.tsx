// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { NAV_ITEMS } from "./navData";

const featured = {
  title: "Backrooms",
  director: "A24",
  year: 2026,
  rating: "★★★",
  genre: "HORROR · FOUND FOOTAGE",
  runtime: "110 min",
  lead: "A24's liminal-space horror film traps its characters in the collective unconscious of the internet — unnerving, patient, and genuinely strange.",
  image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png",
};

const curated = [
  { id: 1, title: "Chum", director: "Josh Mond", year: 2026, rating: "★★★", genre: "DRAMA", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Chum-movie-still-2.png", excerpt: "Mond captures something about male friendship that most films fumble." },
  { id: 2, title: "Renoir", director: "Gilles Bourdos", year: 2026, rating: "★★★½", genre: "BIOPIC · DRAMA", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-still.png", excerpt: "Ravishing and sun-drenched — a portrait of an artist's final years." },
  { id: 3, title: "Pressure", director: "John Hillcoat", year: 2026, rating: "★★★½", genre: "THRILLER", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Pressure-movie-still-2.png", excerpt: "Hillcoat returns to form with a taut submarine thriller." },
];

const gradeFilms = [
  { title: "Power Ballad", director: "Oakley", rating: "★★★" },
  { title: "Passenger", director: "Scott", rating: "★★★" },
  { title: "Corporate Retreat", director: "Various", rating: "★★½" },
  { title: "Pressure", director: "Hillcoat", rating: "★★★½" },
  { title: "Chum", director: "Mond", rating: "★★★" },
];

export function Direction3Mobile() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div style={{ background: "#0d0c0b", minHeight: "100vh", color: "#ede9e0", fontFamily: "'EB Garamond', Georgia, serif", maxWidth: 430, margin: "0 auto" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 13, letterSpacing: "0.2em", color: "#ede9e0" }}>DEEP FOCUS</div>
        <button onClick={() => { setMenuOpen(!menuOpen); setExpandedItem(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          {menuOpen
            ? <span style={{ color: "rgba(237,233,224,0.6)", fontSize: 16 }}>✕</span>
            : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[0,1,2].map((i) => <span key={i} style={{ display: "block", width: 20, height: 1, background: "rgba(237,233,224,0.6)" }} />)}
              </div>
          }
        </button>
      </nav>

      {/* Drawer */}
      {menuOpen && (
        <div style={{ background: "#141210", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "4px 16px 12px" }}>
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: item.sub ? "pointer" : "default" }}
                onClick={() => item.sub && setExpandedItem(expandedItem === item.label ? null : item.label)}
              >
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(237,233,224,0.55)" }}>
                  {item.label.toUpperCase()}
                </span>
                {item.sub && (
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ transform: expandedItem === item.label ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M1 1l3 3 3-3" stroke="rgba(201,168,76,0.7)" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              {item.sub && expandedItem === item.label && (
                <div style={{ paddingLeft: 12, paddingBottom: 4 }}>
                  {item.sub.map((sub) => (
                    <div key={sub.label} style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "rgba(237,233,224,0.45)" }}>
                      {sub.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hero */}
      {!menuOpen && (
        <>
          <div style={{ position: "relative", height: 420, overflow: "hidden" }}>
            <img src={featured.image} alt={featured.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.35)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0d0c0b 0%, rgba(13,12,11,0.2) 55%, transparent 100%)" }} />
            <div style={{ position: "absolute", bottom: 28, left: 16, right: 16 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "#c9a84c", marginBottom: 10 }}>{featured.genre} · {featured.runtime}</div>
              <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 44, fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.01em", color: "#ede9e0", marginBottom: 6 }}>{featured.title}</h1>
              <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "rgba(237,233,224,0.5)", marginBottom: 14 }}>{featured.director}, {featured.year}</div>
              <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 16, lineHeight: 1.55, color: "rgba(237,233,224,0.8)", marginBottom: 16 }}>{featured.lead}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#c9a84c", border: "1px solid #c9a84c", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{featured.rating}</div>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "#ede9e0", textDecoration: "none", borderBottom: "1px solid rgba(237,233,224,0.3)", paddingBottom: 2 }}>READ FULL REVIEW</a>
              </div>
            </div>
          </div>

          {/* Current season */}
          <div style={{ padding: "32px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(237,233,224,0.35)", whiteSpace: "nowrap" }}>CURRENT SEASON</div>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>
            {curated.map((film) => (
              <div key={film.id} style={{ display: "flex", gap: 14, marginBottom: 22, paddingBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ position: "relative", flexShrink: 0, background: "#1a1815" }}>
                  <img src={film.image} alt={film.title} style={{ width: 80, height: 64, objectFit: "cover", display: "block", filter: "brightness(0.55)" }} />
                  <div style={{ position: "absolute", top: 4, right: 4, fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 13, fontWeight: 700, color: "#c9a84c", background: "rgba(13,12,11,0.9)", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(201,168,76,0.35)" }}>{film.rating}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.16em", color: "rgba(237,233,224,0.3)", marginBottom: 4 }}>{film.genre}</div>
                  <h3 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 600, lineHeight: 1.15, marginBottom: 2, color: "#ede9e0", letterSpacing: "-0.01em" }}>{film.title}</h3>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "rgba(237,233,224,0.35)", marginBottom: 5 }}>{film.director}, {film.year}</div>
                  <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, lineHeight: 1.5, color: "rgba(237,233,224,0.6)" }}>{film.excerpt}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Grades */}
          <div style={{ padding: "24px 16px 0" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(237,233,224,0.35)", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>RECENTLY GRADED</div>
            {gradeFilms.map((film, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 15, color: "#ede9e0", marginBottom: 2 }}>{film.title}</div>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, fontStyle: "italic", color: "rgba(237,233,224,0.3)" }}>{film.director}</div>
                </div>
                <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 17, color: "#c9a84c", fontWeight: 600 }}>{film.rating}</div>
              </div>
            ))}
          </div>

          {/* Subscribe */}
          <div style={{ padding: "32px 16px 48px", borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 28 }}>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 600, fontStyle: "italic", color: "#ede9e0", marginBottom: 8 }}>The Letter</div>
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, lineHeight: 1.6, fontStyle: "italic", color: "rgba(237,233,224,0.45)", marginBottom: 16 }}>Weekly dispatches for the devoted cinephile.</p>
            <input placeholder="your@email.com" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#ede9e0", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <button style={{ width: "100%", padding: "11px", background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em" }}>SUBSCRIBE</button>
          </div>
        </>
      )}
    </div>
  );
}
