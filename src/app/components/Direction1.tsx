// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useRef } from "react";
import { Direction1Mobile } from "./Direction1Mobile";
import { PhoneFrame } from "./PhoneFrame";
import { ViewToggle } from "./ViewToggle";
import { NAV_ITEMS } from "./navData";

const reviews = [
  {
    id: 1,
    title: "Anora",
    director: "Sean Baker",
    year: 2024,
    rating: "★★★★½",
    category: "FILM REVIEW",
    summary:
      "Sean Baker's Palme d'Or winner is a whiplash comedy of class anxiety and misplaced romantic fantasy — tender and savage in equal measure.",
    image: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&h=520&fit=crop&auto=format",
    author: "Glenn Heath Jr.",
    date: "November 12, 2024",
    label: "EDITORS' PICK",
  },
  {
    id: 2,
    title: "The Brutalist",
    director: "Brady Corbet",
    year: 2024,
    rating: "★★★★★",
    category: "FILM REVIEW",
    summary:
      "A monumental, three-and-a-half-hour epic about a Hungarian-Jewish architect rebuilding his life in postwar America. Brady Corbet's masterwork.",
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&h=520&fit=crop&auto=format",
    author: "David Ehrlich",
    date: "December 20, 2024",
    label: "CRITICS' CHOICE",
  },
  {
    id: 3,
    title: "All We Imagine as Light",
    director: "Payal Kapadia",
    year: 2024,
    rating: "★★★★",
    category: "FILM REVIEW",
    summary:
      "Payal Kapadia's luminous debut feature drifts through Mumbai with a documentary-inflected eye, charting the inner lives of women displaced from their homes.",
    image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=520&fit=crop&auto=format",
    author: "Manohla Dargis",
    date: "November 1, 2024",
    label: null,
  },
];

const secondaryReviews = [
  { title: "Conclave", director: "Edward Berger", rating: "★★★★", snippet: "A sleek, beautifully mounted ecclesiastical thriller." },
  { title: "A Real Pain", director: "Jesse Eisenberg", rating: "★★★★", snippet: "Funny, melancholy, and disarmingly intimate." },
  { title: "Nickel Boys", director: "RaMell Ross", rating: "★★★★½", snippet: "A formally audacious adaptation that sees through new eyes." },
  { title: "The Substance", director: "Coralie Fargeat", rating: "★★★", snippet: "Fargeat's body-horror satire is as excessive as it intends to be." },
];

function DesktopNav({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenMenu(label);
  };
  const close = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 120);
  };

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", marginTop: 20, paddingTop: 12, display: "flex", gap: 0, position: "relative" }}>
      {NAV_ITEMS.map((item) => (
        <div
          key={item.label}
          style={{ position: "relative" }}
          onMouseEnter={() => item.sub ? open(item.label) : setOpenMenu(null)}
          onMouseLeave={close}
        >
          <button
            style={{
              background: "none",
              border: "none",
              padding: "0 16px 10px 0",
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "#333",
              borderBottom: "2px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "color 0.15s",
            }}
            onClick={() => { if (item.label === "The Definitives") onNavigate("definitives"); }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1e4b96")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
          >
            {item.label.toUpperCase()}
            {item.sub && (
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {item.sub && openMenu === item.label && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                background: "#f8f7f3",
                border: "1px solid rgba(0,0,0,0.1)",
                borderTop: "2px solid #1e4b96",
                minWidth: 200,
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={() => open(item.label)}
              onMouseLeave={close}
            >
              {item.sub.map((sub) => (
                <a
                  key={sub.label}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                    padding: "9px 16px",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    color: "#333",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    transition: "background 0.1s, color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1e4b96";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#333";
                  }}
                >
                  {sub.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Direction1({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const navigate = onNavigate ?? (() => {});

  return (
    <div style={{ background: view === "mobile" ? "#e8e4de" : "#f8f7f3", minHeight: "100vh" }}>
      <ViewToggle view={view} onChange={setView} barStyle={{ background: "#e8e4de", borderColor: "#c8bfb0" }} activeColor="#333" activeBg="#111" />

      {view === "mobile" && (
        <PhoneFrame bg="#f8f7f3">
          <Direction1Mobile />
        </PhoneFrame>
      )}

      {view === "desktop" && (
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#111111" }}>
          {/* Utility bar */}
          <div style={{ background: "#111111", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 0" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ opacity: 0.6 }}>TUESDAY, JUNE 3, 2025</span>
              <span style={{ opacity: 0.6 }}>INDEPENDENT FILM CRITICISM SINCE 2004</span>
            </div>
          </div>

          {/* Masthead + nav */}
          <div style={{ borderBottom: "3px solid #111111", padding: "28px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: "#111111" }}>Deep Focus</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 300, fontStyle: "italic", letterSpacing: "-0.02em", lineHeight: 1, color: "#111111" }}>Review</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "#555" }}>
                <div style={{ marginBottom: 6 }}>SUBSCRIBE</div>
                <div>SIGN IN</div>
              </div>
            </div>
            <DesktopNav onNavigate={navigate} />
          </div>

          {/* Content */}
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 48 }}>
            <div>
              <div style={{ borderBottom: "1px solid rgba(0,0,0,0.12)", paddingBottom: 36, marginBottom: 36 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", color: "#1e4b96", fontWeight: 600, marginBottom: 10 }}>{reviews[0].category}</div>
                    <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 4, color: "#111" }}>{reviews[0].title}</h1>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#777", letterSpacing: "0.06em", marginBottom: 16 }}>{reviews[0].director.toUpperCase()} &nbsp;·&nbsp; {reviews[0].year}</div>
                    <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, lineHeight: 1.65, color: "#222", marginBottom: 20, fontStyle: "italic" }}>{reviews[0].summary}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: "#1e4b96", letterSpacing: "0.05em" }}>{reviews[0].rating}</span>
                      <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em" }}>By {reviews[0].author} &nbsp;·&nbsp; {reviews[0].date}</span>
                    </div>
                    {reviews[0].label && (
                      <div style={{ display: "inline-block", marginTop: 14, background: "#111111", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.16em", fontWeight: 600, padding: "3px 8px" }}>{reviews[0].label}</div>
                    )}
                  </div>
                  <div style={{ overflow: "hidden", background: "#ddd" }}>
                    <img src={reviews[0].image} alt={reviews[0].title} style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                {reviews.slice(1).map((r) => (
                  <div key={r.id} style={{ borderTop: "2px solid #111111", paddingTop: 16 }}>
                    {r.label && <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>}
                    <div style={{ marginBottom: 8, overflow: "hidden", background: "#ccc" }}>
                      <img src={r.image} alt={r.title} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                    </div>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#1e4b96", marginBottom: 6 }}>{r.category}</div>
                    <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginBottom: 4, letterSpacing: "-0.01em" }}>{r.title}</h3>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 10 }}>{r.director.toUpperCase()} · {r.year}</div>
                    <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "#333" }}>{r.summary}</p>
                    <div style={{ marginTop: 10, fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, color: "#1e4b96" }}>{r.rating}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", fontWeight: 600, color: "#111" }}>RECENTLY REVIEWED</div>
              </div>
              {secondaryReviews.map((r, i) => (
                <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 18, marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{r.title}</h4>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, color: "#1e4b96", flexShrink: 0, marginLeft: 8 }}>{r.rating}</span>
                  </div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.08em", marginBottom: 6 }}>{r.director.toUpperCase()}</div>
                  <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "#444" }}>{r.snippet}</p>
                </div>
              ))}
              <div style={{ background: "#111111", color: "#f8f7f3", padding: "24px 20px", marginTop: 8 }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 8, fontStyle: "italic" }}>The Weekly Reel</div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "rgba(248,247,243,0.75)", marginBottom: 16 }}>New reviews, essays, and interviews delivered every Friday.</p>
                <input placeholder="your@email.com" style={{ width: "100%", padding: "8px 10px", background: "transparent", border: "1px solid rgba(248,247,243,0.3)", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
                <button style={{ width: "100%", padding: "9px", background: "#1e4b96", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600 }}>SUBSCRIBE</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
