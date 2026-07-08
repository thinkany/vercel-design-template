// ©2004-2026 Deep Focus Review. All rights reserved.
interface Props {
  onNavigate: (page: string) => void;
}

const COLS = [
  {
    heading: "Reviews",
    links: ["Reviews A–Z", "Reader's Choice", "Short Takes", "Patreon Exclusive"],
  },
  {
    heading: "Features",
    links: ["The Definitives", "Lists", "Festival Coverage", "Film Editorials", "The CineFiles"],
  },
  {
    heading: "About",
    links: ["About DFR", "Contact", "Support DFR", "Bibliography", "Friends & Critics"],
  },
];

export function Footer1({ onNavigate }: Props) {
  return (
    <footer className="dfr-dark" style={{ background: "#111111", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", marginTop: 80 }}>
      {/* Top rule */}
      <div style={{ height: 3, background: "#1e4b96" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 48px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>

          {/* Brand column */}
          <div>
            <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo.png" alt="Deep Focus Review" style={{ width: 160, height: "auto", display: "block" }} />
            </button>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "rgba(248,247,243,0.5)", marginTop: 16, fontStyle: "italic" }}>
              Independent film criticism since 2004.<br />
              <span style={{ color: "#ffffff" }}>By Brian Eggert.</span>
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 20, alignItems: "center" }}>
              <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "rgba(248,247,243,0.4)", display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f8f7f3")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(248,247,243,0.4)")}
              >
                <svg width="22" height="15" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "rgba(248,247,243,0.4)", display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f8f7f3")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(248,247,243,0.4)")}
              >
                <svg width="18" height="16" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg>
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "rgba(248,247,243,0.4)", display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f8f7f3")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(248,247,243,0.4)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <div key={col.heading}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", fontWeight: 600, color: "#f8f7f3", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid rgba(248,247,243,0.08)" }}>{col.heading.toUpperCase()}</div>
              {col.links.map((link) => (
                <a key={link} href="#" onClick={(e) => { e.preventDefault(); if (link === "Reviews A–Z") onNavigate("reviews"); else if (link === "The Definitives") onNavigate("definitives"); }}
                  style={{ display: "block", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, color: "rgba(248,247,243,0.55)", textDecoration: "none", marginBottom: 10, lineHeight: 1.3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f8f7f3")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(248,247,243,0.55)")}
                >{link}</a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(248,247,243,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(248,247,243,0.3)", letterSpacing: "0.06em" }}>
            © 2004–2026 Deep Focus Review. All rights reserved.
          </div>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#f8f7f3", textDecoration: "none", border: "1px solid rgba(248,247,243,0.35)", padding: "6px 14px" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#f8f7f3"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,247,243,0.35)"; }}
          >SUPPORT ON PATREON →</a>
        </div>
      </div>
    </footer>
  );
}
