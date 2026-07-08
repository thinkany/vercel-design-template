// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { NAV_ITEMS } from "./navData";

const entries = [
  {
    id: 1,
    title: "Backrooms",
    director: "A24",
    year: 2026,
    rating: 7,
    note: "The liminal spaces concept is genuinely unsettling — the film earns its dread through patience rather than shock. Found footage as a form of collective memory.",
    date: "May 29",
    tags: ["horror", "found footage", "A24"],
    image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png",
  },
  {
    id: 2,
    title: "Chum",
    director: "Josh Mond",
    year: 2026,
    rating: 7,
    note: "Mond captures something about male friendship that most films fumble — the way men express care by not expressing it, until suddenly everything cracks open.",
    date: "May 22",
    tags: ["drama", "friendship", "midlife"],
    image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Chum-movie-still-2.png",
  },
  {
    id: 3,
    title: "Renoir",
    director: "Gilles Bourdos",
    year: 2026,
    rating: 8,
    note: "Every frame feels painted. Bourdos understands that the best biopics find their subject in texture rather than biography.",
    date: "May 15",
    tags: ["biopic", "French cinema", "art"],
    image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-still.png",
  },
];

const marginalia = [
  "Started rewatching the Tati films again. Mon Oncle hits differently at 40.",
  "Anyone else feel like festival season peaked in October this year?",
];

export function Direction2Mobile() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", background: "#faf8f3", minHeight: "100vh", color: "#1a1612", maxWidth: 430, margin: "0 auto" }}>
      <header style={{ padding: "32px 20px 0", borderBottom: "1.5px solid #c9b99a" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#a0856a", marginBottom: 8 }}>
          since 2004 ↓
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 6 }}>
              Deep Focus Review
            </div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 15, fontStyle: "italic", color: "#7a6655", lineHeight: 1.4, marginBottom: 16 }}>
              A film journal by Brian Eggert.
            </p>
          </div>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setExpandedItem(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0 0 12px", flexShrink: 0 }}
          >
            {menuOpen
              ? <span style={{ fontFamily: "'Lora', serif", fontSize: 18, color: "#7a6655" }}>✕</span>
              : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[0,1,2].map((i) => <span key={i} style={{ display: "block", width: 20, height: 1.5, background: "#7a6655" }} />)}
                </div>
            }
          </button>
        </div>

        {/* Drawer */}
        {menuOpen && (
          <div style={{ borderTop: "1px dashed #c9b99a", paddingBottom: 8 }}>
            {NAV_ITEMS.map((item, i) => (
              <div key={item.label}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(201,185,154,0.25)", cursor: item.sub ? "pointer" : "default" }}
                  onClick={() => item.sub && setExpandedItem(expandedItem === item.label ? null : item.label)}
                >
                  <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontStyle: i % 2 === 0 ? "italic" : "normal", color: "#7a6655" }}>
                    {item.label}
                  </span>
                  {item.sub && (
                    <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ transform: expandedItem === item.label ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M1 1l3 3 3-3" stroke="#9a8070" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {item.sub && expandedItem === item.label && (
                  <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
                    {item.sub.map((sub) => (
                      <div key={sub.label} style={{ padding: "7px 0", borderBottom: "1px solid rgba(201,185,154,0.15)", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070" }}>
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Collapsed strip */}
        {!menuOpen && (
          <nav style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
            {NAV_ITEMS.map((item, i) => (
              <a key={item.label} href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: i % 2 === 0 ? "italic" : "normal", color: "#7a6655", textDecoration: "none", marginRight: 20, whiteSpace: "nowrap", borderBottom: i === 0 ? "1px solid #7a6655" : "none", flexShrink: 0 }}>
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Section label */}
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Recent notes</span>
          <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
        </div>
      </div>

      {/* Entries */}
      <div style={{ padding: "0 20px" }}>
        {entries.map((entry) => (
          <article key={entry.id} style={{ marginBottom: 36, borderBottom: "1px solid #ddd2c0", paddingBottom: 32 }}>
            <div style={{ marginBottom: 16, transform: "rotate(-0.5deg)", boxShadow: "2px 4px 14px rgba(0,0,0,0.1)", background: "#ccc", overflow: "hidden" }}>
              <img src={entry.image} alt={entry.title} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e" }}>{entry.date}, 2024</span>
              <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, color: "#b89a7e" }}>— {entry.rating}/10</span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 4, color: "#1a1612" }}>{entry.title}</h2>
            <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070", marginBottom: 12 }}>{entry.director}, {entry.year}</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, lineHeight: 1.7, color: "#2d2420", marginBottom: 14 }}>{entry.note}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {entry.tags.map((t) => (
                <span key={t} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#a0856a", background: "#f0e8da", padding: "2px 8px", borderRadius: 2 }}>{t}</span>
              ))}
            </div>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
              Read the full review →
            </a>
          </article>
        ))}
      </div>

      {/* Marginalia */}
      <div style={{ margin: "0 20px 36px", padding: "20px", background: "#f0e8da", borderTop: "1.5px solid #c9b99a" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 14, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Marginalia</div>
        {marginalia.map((note, i) => (
          <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid #ddd2c0", marginBottom: i < marginalia.length - 1 ? 16 : 0 }}>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, lineHeight: 1.6, fontStyle: "italic", color: "#6a584a" }}>{note}</p>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div style={{ margin: "0 20px 48px", padding: "18px", borderTop: "1.5px solid #c9b99a" }}>
        <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#1a1612" }}>Write to me</div>
        <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "#7a6655", fontStyle: "italic" }}>
          Film recs, recommendations, arguments warmly received at{" "}
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#7a6655" }}>hello@deepfocusreview.com</a>
        </p>
      </div>
    </div>
  );
}
