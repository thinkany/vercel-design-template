// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { Direction2Mobile } from "./Direction2Mobile";
import { PhoneFrame } from "./PhoneFrame";
import { ViewToggle } from "./ViewToggle";
import { SITE_REVIEWS, SITE_SECONDARY_REVIEWS, SITE_SIDEBAR_REVIEWS } from "./siteData";
import { Nav2 } from "./Nav2";
import { Footer2 } from "./Footer2";

const asideNotes = [
  "Started rewatching the Tati films again. Mon Oncle hits differently at 40.",
  "Anyone else feel like festival season peaked in October this year?",
  "Working through the Chantal Akerman boxset. Three hours into Jeanne Dielman and I'm not coming back the same person.",
  "Best cinema towns I visited this year: Bologna, Taipei, Buenos Aires.",
];

export function Direction2V8({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [openEntry, setOpenEntry] = useState<number | null>(1);
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
          <header style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 0" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#a0856a", marginBottom: 8, whiteSpace: "nowrap" }}>
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
            <Nav2 onNavigate={navigate} activePage="home" />
          </header>

          <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 220px", gap: 48, alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, color: "#a0856a", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
                <span>Recent notes</span>
                <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
              </div>

              {SITE_REVIEWS.map((entry) => (
                <article key={entry.id} style={{ marginBottom: 44, borderBottom: "1px solid #ddd2c0", paddingBottom: 40 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e" }}>{entry.date}</span>
                    <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, color: "#b89a7e", letterSpacing: "0.05em" }}>— {entry.rating}</span>
                  </div>
                  <div style={{ cursor: "pointer" }} onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}>
                    <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 4, color: "#1a1612" }}>{entry.title}</h2>
                    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#9a8070", marginBottom: 14 }}>{entry.director}, {entry.year}</div>
                  </div>
                  {openEntry === entry.id && (
                    <div style={{ marginBottom: 18, transform: "rotate(-0.4deg)", boxShadow: "3px 4px 16px rgba(0,0,0,0.12)", background: "#ccc" }}>
                      <img src={entry.image} alt={entry.title} style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />
                    </div>
                  )}
                  <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 18, lineHeight: 1.7, color: "#2d2420", marginBottom: 14 }}>{entry.summary}</p>
                  <a href="#" onClick={(e) => { e.preventDefault(); onNavigate("review"); }} style={{ display: "inline-block", marginTop: 14, fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
                    Read the full review →
                  </a>
                </article>
              ))}
            </div>

            <aside style={{ paddingTop: 8 }}>
              {/* Recent posters */}
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Latest on the site</div>
              {SITE_SIDEBAR_REVIEWS.map((r, i) => (
                <div key={i} style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "56px 1fr", gap: 12, alignItems: "start" }}>
                  <div style={{ overflow: "hidden", background: "#ddd", boxShadow: "2px 3px 8px rgba(0,0,0,0.15)" }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontWeight: 600, color: "#1a1612", marginBottom: 2 }}>{r.title}</div>
                    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "#9a8070" }}>{r.year} · {r.rating}</div>
                  </div>
                </div>
              ))}

              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, marginTop: 24, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Marginalia</div>
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

              {/* Also recently reviewed */}
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, marginTop: 28, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Also recently reviewed</div>
              {SITE_SECONDARY_REVIEWS.map((r, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(201,185,154,0.3)" }}>
                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontWeight: 600, color: "#1a1612" }}>{r.title}</div>
                  <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "#9a8070" }}>{r.director} · {r.rating}</div>
                </div>
              ))}
            </aside>
          </main>
        </div>
      )}
      <Footer2 onNavigate={onNavigate} />
    </div>
  );
}
