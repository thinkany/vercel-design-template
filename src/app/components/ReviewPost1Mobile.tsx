// ©2004-2026 Deep Focus Review. All rights reserved.
import { MobileMasthead, MobileFooter } from "./MobileShared";

const FILM = {
  title: "Backrooms",
  year: 2026,
  director: "Kane Parsons",
  rating: "★★★",
  mpaa: "R",
  runtime: "110 min.",
  release: "May 29, 2026",
  distributor: "A24",
  cast: [
    { actor: "Chiwetel Ejiofor", role: "Clark" },
    { actor: "Renate Reinsve", role: "Dr. Mary Kline" },
    { actor: "Mark Duplass", role: "Async scientist" },
    { actor: "Finn Bennett", role: "videographer boyfriend" },
    { actor: "Lukita Maxwell", role: "Clark's employee" },
  ],
  author: "Brian Eggert",
  date: "May 29, 2026",
  still1: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png",
  still2: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-1-1024x576.png",
};

const BODY = [
  `Kane Parsons began making YouTube shorts at sixteen. He was twenty when he shot Backrooms, a remarkably assured debut feature set largely inside an abandoned, decades-old waiting room that keeps going — and going — until the geometry of the place stops obeying the rules of the world outside.`,
  `The backrooms concept traces to a 2019 anonymous post on 4chan: a single image of a yellowed office space, captioned with lore. Parsons ran with it. His 24-episode web series accumulated millions of views and secured a $10 million feature deal. The premise was already a phenomenon. The question was whether a feature could justify it.`,
  `Set in 1990 — the aesthetic commitment is total — the film opens with Clark (Chiwetel Ejiofor), a furniture store owner sleeping in his own showroom after a separation. He discovers the place by accident, enters it, and cannot immediately leave. His therapist, Dr. Mary Kline (Renate Reinsve), carries her own unresolved grief into their sessions.`,
  `Something lurks inside — tall, angular creatures built from Blender composites and real sets that cinematographer Jeremy Cox shoots on unsettling wide-angle lenses. Production designer Danny Vermette supplies yellow carpeted rooms, white-tiled chambers flooding with water, and a central hub that mirrors Escher's Relativity.`,
  `Reinsve is especially good. Her performance is the film's emotional anchor: precise, economical, alert to the way Mary's composed professional manner keeps failing at the edges. Ejiofor does strong work with a more reactive role. Together they make a strange, convincing pair.`,
  `Backrooms is not without wobble. The third act reaches for revelation and finds something a little shy of it. But Parsons holds his nerve through the slow stretches, trusts his images, and delivers a well-crafted, horrifying, experiential funhouse ride.`,
];

const RECOMMENDED = [
  { title: "The Wailing", year: 2016, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/The-Wailing-2016.jpg" },
  { title: "Heretic", year: 2024, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/11/Heretic-Movie-Poster.png" },
  { title: "The Fearless Vampire Killers", year: 1967, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/The-Fearless-Vampire-Killers-or-Pardon-Me-But-Your-Teeth-Are-in-My-Neck-1967.jpg" },
];

export function ReviewPost1Mobile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const navigate = onNavigate ?? (() => {});

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>

      <MobileMasthead onNavigate={navigate} activePage="reviews" />

      {/* Hero still — full width 16:9 */}
      <img src={FILM.still1} alt="Backrooms"
        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />

      {/* Title block */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 10 }}>
          FILM REVIEW · A24 · {FILM.year}
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#111", marginBottom: 6 }}>
          {FILM.title}
        </h1>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 14 }}>
          {FILM.director.toUpperCase()} · {FILM.year}
        </div>
        <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.1)", marginBottom: 24, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.04em", fontStyle: "italic" }}>
          By {FILM.author} · {FILM.date}
        </div>

        {/* Body */}
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, lineHeight: 1.8, color: "#222" }}>
          {BODY.map((p, i) => (
            <p key={i} style={{ marginBottom: 20 }}>{p}</p>
          ))}
        </div>

        {/* Pull quote */}
        <blockquote style={{ borderLeft: "3px solid #1e4b96", paddingLeft: 16, margin: "28px 0", fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontStyle: "italic", lineHeight: 1.5, color: "#222" }}>
          "A well-crafted, horrifying, experiential funhouse ride from a talented first-time filmmaker."
        </blockquote>

        {/* Inline image — same position as desktop, after the copy, before the rating/details */}
        <div style={{ margin: "28px 0", overflow: "hidden" }}>
          <img src={FILM.still2} alt="Backrooms still" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
        </div>

        {/* Star rating + movie information — after the copy, preceded by the subtle line */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 20, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, color: "#1e4b96" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em" }}>
              {FILM.title.toUpperCase()} · {FILM.year} · {FILM.director.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {[
              { label: "DIRECTOR", value: FILM.director },
              { label: "RATED", value: FILM.mpaa },
              { label: "RUNTIME", value: FILM.runtime },
              { label: "DISTRIBUTOR", value: FILM.distributor },
              { label: "RELEASE", value: FILM.release },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#999", marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, color: "#222", lineHeight: 1.3 }}>{value}</div>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#999", marginBottom: 2 }}>CAST</div>
              <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, color: "#222", lineHeight: 1.5 }}>
                {FILM.cast.map((c, i) => <span key={c.actor}>{i > 0 && ", "}<span style={{ color: "#1e4b96" }}>{c.actor}</span>{` as ${c.role}`}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Support CTA */}
        <div style={{ margin: "0 0 28px", padding: "20px", background: "#eeeae4", borderLeft: "3px solid #1e4b96" }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111" }}>
            Thank You for Supporting Independent Film Criticism
          </div>
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.65, color: "#333", marginBottom: 10 }}>
            If DFR has added something meaningful to your love of movies, consider{" "}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>supporting it</a> via{" "}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>Patreon</a> or a{" "}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>one-time donation</a>.
          </p>
          <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#555", fontStyle: "italic" }}>
            Brian Eggert · Critic, Founder · Deep Focus Review
          </p>
        </div>

        {/* Recommended */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.14em", fontWeight: 700, color: "#111", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span>RECOMMENDED</span>
            <span style={{ flex: 1, borderTop: "1px solid rgba(0,0,0,0.1)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {RECOMMENDED.map((r) => (
              <div key={r.title} style={{ cursor: "pointer" }}>
                <div style={{ overflow: "hidden", background: "#ddd", marginBottom: 6 }}>
                  <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: "#111", marginBottom: 1 }}>{r.title}</div>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, color: "#888" }}>{r.year}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Back to Reviews */}
        <button onClick={() => navigate("reviews")}
          style={{ width: "100%", margin: "24px 0 8px", background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "12px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#333", cursor: "pointer", textAlign: "left" }}>
          ← BACK TO REVIEWS A–Z
        </button>

      </div>

      <MobileFooter onNavigate={navigate} />
    </div>
  );
}
