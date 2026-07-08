// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useRef } from "react";
import { Direction2Mobile } from "./Direction2Mobile";
import { PhoneFrame } from "./PhoneFrame";
import { ViewToggle } from "./ViewToggle";
import { NAV_ITEMS } from "./navData";

const entries = [
  {
    id: 1,
    title: "Anora",
    director: "Sean Baker",
    year: 2024,
    rating: 9,
    note: "I keep thinking about the last ten minutes. The way she finally cries — not because she's lost something she wanted, but because the fantasy dissolved before she could mourn it properly.",
    date: "Nov 14",
    tags: ["American cinema", "class", "romance"],
    image: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=700&h=460&fit=crop&auto=format",
    longform: true,
  },
  {
    id: 2,
    title: "The Brutalist",
    director: "Brady Corbet",
    year: 2024,
    rating: 10,
    note: "Three and a half hours and I didn't want it to end. Corbet does something I didn't expect — the architecture and the man become the same argument, and the film asks whether either can survive America.",
    date: "Dec 22",
    tags: ["epic", "immigrant story", "postwar"],
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=700&h=460&fit=crop&auto=format",
    longform: true,
  },
  {
    id: 3,
    title: "All We Imagine as Light",
    director: "Payal Kapadia",
    year: 2024,
    rating: 8,
    note: "Every frame feels like a letter written to someone far away. Kapadia is unhurried in the best sense — you don't feel time passing, you feel it accumulating.",
    date: "Nov 3",
    tags: ["Indian cinema", "women", "urban"],
    image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=700&h=460&fit=crop&auto=format",
    longform: false,
  },
];

const asideNotes = [
  "Started rewatching the Tati films again. Mon Oncle hits differently at 40.",
  "Anyone else feel like festival season peaked in October this year?",
  "Working through the Chantal Akerman boxset. Three hours into Jeanne Dielman and I'm not coming back the same person.",
  "Best cinema towns I visited this year: Bologna, Taipei, Buenos Aires.",
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
    <nav style={{ paddingTop: 16, paddingBottom: 4, display: "flex", gap: 0, position: "relative" }}>
      {NAV_ITEMS.map((item, i) => (
        <div
          key={item.label}
          style={{ position: "relative" }}
          onMouseEnter={() => item.sub ? open(item.label) : setOpenMenu(null)}
          onMouseLeave={close}
        >
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); if (item.label === "The Definitives") onNavigate("definitives"); }}
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: 14,
              fontStyle: i % 2 === 0 ? "italic" : "normal",
              color: "#7a6655",
              textDecoration: "none",
              marginRight: 24,
              borderBottom: i === 0 ? "1px solid #7a6655" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              paddingBottom: 2,
            }}
          >
            {item.label}
            {item.sub && (
              <svg width="7" height="4" viewBox="0 0 8 5" fill="none">
                <path d="M1 1l3 3 3-3" stroke="#9a8070" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </a>

          {item.sub && openMenu === item.label && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "#faf8f3",
                border: "1px solid #c9b99a",
                borderTop: "2px solid #7a6655",
                minWidth: 200,
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
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
                    padding: "8px 14px",
                    fontFamily: "'Crimson Pro', Georgia, serif",
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "#7a6655",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(201,185,154,0.3)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8da")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {sub.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

export function Direction2({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [open, setOpen] = useState<number | null>(1);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const navigate = onNavigate ?? (() => {});

  return (
    <div style={{ background: "#faf8f3", minHeight: "100vh" }}>
      <ViewToggle view={view} onChange={setView} />

      {view === "mobile" && (
        <div style={{ background: "#f0e8da" }}>
          <PhoneFrame bg="#faf8f3">
            <Direction2Mobile />
          </PhoneFrame>
        </div>
      )}

      {view === "desktop" && (
        <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", color: "#1a1612" }}>
          <header style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 0", position: "relative" }}>
            <div style={{ position: "absolute", left: -20, top: 56, fontFamily: "'Caveat', cursive", fontSize: 14, color: "#a0856a", transform: "rotate(-2deg)", whiteSpace: "nowrap" }}>
              since 2004 ↓
            </div>
            <div style={{ borderBottom: "1.5px solid #c9b99a", paddingBottom: 24 }}>
              <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(36px, 6vw, 62px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 6 }}>
                Deep Focus Review
              </div>
              <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "#7a6655", lineHeight: 1.4 }}>
                A film journal by Brian Eggert — notes from the dark.
              </p>
            </div>
            <DesktopNav onNavigate={navigate} />
          </header>

          <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 220px", gap: 48, alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: "#a0856a", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
                <span>Recent notes</span>
                <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
              </div>

              {entries.map((entry) => (
                <article key={entry.id} style={{ marginBottom: 44, borderBottom: "1px solid #ddd2c0", paddingBottom: 40 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#b89a7e" }}>{entry.date}, 2024</span>
                    <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, color: "#b89a7e", letterSpacing: "0.05em" }}>— {entry.rating}/10</span>
                  </div>
                  <div style={{ cursor: "pointer" }} onClick={() => setOpen(open === entry.id ? null : entry.id)}>
                    <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 4, color: "#1a1612" }}>{entry.title}</h2>
                    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#9a8070", marginBottom: 14 }}>{entry.director}, {entry.year}</div>
                  </div>
                  {open === entry.id && (
                    <div style={{ marginBottom: 18, transform: "rotate(-0.4deg)", boxShadow: "3px 4px 16px rgba(0,0,0,0.12)", background: "#ccc" }}>
                      <img src={entry.image} alt={entry.title} style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
                    </div>
                  )}
                  <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 18, lineHeight: 1.7, color: "#2d2420", marginBottom: 14 }}>{entry.note}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {entry.tags.map((t) => (
                      <span key={t} style={{ fontFamily: "'Caveat', cursive", fontSize: 12, color: "#a0856a", background: "#f0e8da", padding: "2px 8px", borderRadius: 2 }}>{t}</span>
                    ))}
                  </div>
                  {entry.longform && (
                    <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-block", marginTop: 14, fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
                      Read the full review →
                    </a>
                  )}
                </article>
              ))}
            </div>

            <aside style={{ paddingTop: 8 }}>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: "#a0856a", marginBottom: 18, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Marginalia</div>
              {asideNotes.map((note, i) => (
                <div key={i} style={{ marginBottom: 20, paddingLeft: 12, borderLeft: "2px solid #ddd2c0" }}>
                  <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, lineHeight: 1.6, fontStyle: "italic", color: "#6a584a" }}>{note}</p>
                </div>
              ))}
              <div style={{ marginTop: 32, padding: "18px", background: "#f0e8da", borderTop: "1.5px solid #c9b99a" }}>
                <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#1a1612" }}>Write to me</div>
                <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "#7a6655", fontStyle: "italic" }}>
                  Film recs, recommendations, arguments warmly received at{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#7a6655" }}>hello@deepfocusreview.com</a>
                </p>
              </div>
            </aside>
          </main>
        </div>
      )}
    </div>
  );
}
