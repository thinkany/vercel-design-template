// ©2004-2026 Deep Focus Review. All rights reserved.
import { SITE_REVIEWS, SITE_SECONDARY_REVIEWS } from "./siteData";
import { MobileMasthead, MobileSectionHeader, MobileNewsletter, MobileFooter } from "./MobileShared";

const ARTICLES = [
  { category: "FESTIVAL COVERAGE", title: "Cannes 2026: Dispatches from the Croisette", byline: "Brian Eggert · May 20, 2026", excerpt: "On competition titles, surprise premieres, and why this may be the strongest Cannes lineup in a decade.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png" },
  { category: "ESSAY", title: "The Slow Cinema of Patient Dread", byline: "Brian Eggert · May 14, 2026", excerpt: "From Béla Tarr to Skinamarink, a tradition of films that weaponize duration.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Pressure-movie-still-2.png" },
  { category: "LIST", title: "The 25 Best Films of the Decade So Far", byline: "Brian Eggert · May 7, 2026", excerpt: "From Aftersun to The Zone of Interest, and everything in between.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-still.png" },
  { category: "INTERVIEW", title: "Kane Parsons on Building the Backrooms", byline: "Brian Eggert · April 30, 2026", excerpt: "The twenty-year-old director talks YouTube, practical effects, and shooting on film.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-1-1024x576.png" },
];

const MORE_REVIEWS = [
  { title: "Power Ballad", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Power-Ballad-Movie-Poster.png" },
  { title: "Passenger", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Passenger-movie-poster.png" },
  { title: "Corporate Retreat", year: 2026, rating: "★★½", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Corporate-Retreat-movie-poster.png" },
  { title: "Wet Paper Bag", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Wet-Paper-Bag-movie-poster.png" },
  { title: "Tuner", year: 2026, rating: "★★★½", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Tuner-movie-poster.png" },
  { title: "In the Grey", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/In-the-Grey-movie-poster.png" },
  { title: "Witness for the Prosecution", year: 2026, rating: "★★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Witness-for-the-Prosecution-movie-poster.png" },
  { title: "The Wizard of the Kremlin", year: 2026, rating: "★★★½", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Wizard-of-the-Kremlin-movie-poster.png" },
];

export function Direction1Mobile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const navigate = onNavigate ?? (() => {});
  const hero = SITE_REVIEWS[0];
  const newReviews = SITE_REVIEWS.slice(1, 4);

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>

      <MobileMasthead onNavigate={navigate} activePage="home" />

      <div style={{ padding: "0 16px" }}>

        {/* Hero */}
        <div style={{ marginTop: 24, cursor: "pointer" }} onClick={() => navigate("review")}>
          {/* Image — unobscured, full width, 16:9 */}
          <img src={hero.image} alt={hero.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", borderRadius: "2px 2px 0 0" }} />
          {/* Black text box below image */}
          <div style={{
            background: "rgba(8, 8, 8, 0.97)",
            borderRadius: "0 0 2px 2px",
            padding: "18px 16px 20px",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(255,255,255,0.18)",
          }}>
            {hero.label && <div style={{ display: "inline-block", marginBottom: 10, background: "#1e4b96", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.16em", fontWeight: 600, padding: "2px 7px" }}>{hero.label}</div>}
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 7 }}>{hero.category}</div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.01em", marginBottom: 6, color: "#fff" }}>{hero.title}</h1>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", marginBottom: 10 }}>{hero.director.toUpperCase()} · {hero.year}</div>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", marginBottom: 14, fontStyle: "italic" }}>{hero.summary}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: "#fff" }}>{hero.rating}</span>
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "rgba(255,255,255,0.75)", borderBottom: "1px solid rgba(255,255,255,0.35)", paddingBottom: 1 }}>READ FULL REVIEW →</span>
            </div>
          </div>
        </div>

        {/* New Reviews — single column */}
        <MobileSectionHeader label="NEW REVIEWS" />
        {newReviews.map((r) => (
          <div key={r.id} style={{ marginBottom: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative", overflow: "hidden", background: "#ccc" }}>
              <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", bottom: 8, left: 8, background: "#C41230", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700, padding: "2px 7px" }}>NEW</div>
            </div>
            <div style={{ background: "#efefef", paddingTop: 10, paddingBottom: 18, paddingLeft: 14, paddingRight: 14, flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#1e4b96", marginBottom: 4 }}>{r.category}</div>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, lineHeight: 1.1, marginBottom: 3, letterSpacing: "-0.01em" }}>{r.title}</h3>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#777", letterSpacing: "0.06em", marginBottom: 8 }}>{r.director.toUpperCase()} · {r.year}</div>
              <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "#333" }}>{r.summary}</p>
              <div style={{ marginTop: "auto", paddingTop: 8, fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, color: "#1e4b96" }}>{r.rating}</div>
            </div>
          </div>
        ))}

        {/* Recent Definitives Essay */}
        <MobileSectionHeader label="RECENT DEFINITIVES ESSAY" />
        <div style={{ cursor: "pointer", marginBottom: 4 }} onClick={() => navigate("essay")}>
          <div style={{ overflow: "hidden", background: "#e0e0e0" }}>
            <img src="https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelphia-Story-movie-poster.png" alt="The Philadelphia Story" style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ background: "#efefef", padding: "12px 14px 18px" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#1e4b96", marginBottom: 5, fontWeight: 600 }}>THE DEFINITIVES</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em" }}>The Philadelphia Story</h4>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, color: "#1e4b96", flexShrink: 0, marginLeft: 10 }}>★★★★</span>
            </div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.08em", marginBottom: 6 }}>GEORGE CUKOR · 1940</div>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "#444" }}>Hepburn's self-financed comeback — one of Hollywood's most dazzling screwball comedies.</p>
          </div>
        </div>

        {/* Recent Articles */}
        <MobileSectionHeader label="RECENT ARTICLES" />
        {ARTICLES.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.08)", cursor: "pointer" }}>
            <div style={{ width: 80, flexShrink: 0, overflow: "hidden", background: "#ddd" }}>
              <img src={a.image} alt={a.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#1e4b96", fontWeight: 600, marginBottom: 4 }}>{a.category}</div>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: 3, color: "#111" }}>{a.title}</h3>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, color: "#888", letterSpacing: "0.04em", fontStyle: "italic" }}>{a.byline}</div>
            </div>
          </div>
        ))}

        {/* More Reviews — 2-column poster grid */}
        <MobileSectionHeader label="MORE REVIEWS" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {MORE_REVIEWS.map((f) => (
            <div key={f.title} style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}>
              <div style={{ overflow: "hidden", background: "#ccc" }}>
                <img src={f.image} alt={f.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ background: "#efefef", padding: "7px 8px 16px", flex: 1 }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, fontWeight: 600, lineHeight: 1.25, color: "#111", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 11, color: "#1e4b96" }}>{f.rating}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recently Reviewed */}
        <MobileSectionHeader label="RECENTLY REVIEWED" />
        {SITE_SECONDARY_REVIEWS.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 2 }}>{r.title}</div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em" }}>{r.director.toUpperCase()}</div>
            </div>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, color: "#1e4b96", marginLeft: 12, flexShrink: 0 }}>{r.rating}</span>
          </div>
        ))}

      </div>

      <MobileNewsletter />
      <MobileFooter onNavigate={navigate} />

    </div>
  );
}
