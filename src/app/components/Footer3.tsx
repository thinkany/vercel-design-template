// ©2004-2026 Deep Focus Review. All rights reserved.
import { useC3Theme } from "./c3Theme";

interface Props {
  onNavigate: (page: string) => void;
}

const COLS = [
  {
    heading: "Reviews",
    links: [["Reviews A–Z", "reviews"], ["Reader's Choice", "home"], ["Short Takes", "home"], ["Patreon Exclusive", "home"]],
  },
  {
    heading: "Features",
    links: [["The Definitives", "definitives"], ["Lists", "home"], ["Festival Coverage", "home"], ["Film Editorials", "home"], ["The CineFiles", "home"]],
  },
  {
    heading: "About",
    links: [["About DFR", "home"], ["Contact", "home"], ["Support DFR", "home"], ["Bibliography", "home"], ["Friends & Critics", "home"]],
  },
];

export function Footer3({ onNavigate }: Props) {
  const { c } = useC3Theme();
  return (
    <footer style={{ background: c.pageBg, borderTop: `1px solid ${c.border}`, marginTop: 80, fontFamily: "'EB Garamond', Georgia, serif", transition: "background 0.2s" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 48px 40px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>

          {/* Brand */}
          <div>
            <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 12, fontWeight: 700, color: "#0d0c0b" }}>DF</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: c.textPrimary, lineHeight: 1.1 }}>Deep Focus</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: c.gold }}>REVIEW</div>
              </div>
            </button>
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", color: c.textFaint, marginBottom: 20 }}>
              Independent film criticism since 2004.<br />By Brian Eggert.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              {["Patreon", "Letterboxd", "Twitter"].map((s) => (
                <a key={s} href="#" onClick={(e) => e.preventDefault()}
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: c.goldMuted, textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = c.gold)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = c.goldMuted)}
                >{s.toUpperCase()}</a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <div key={col.heading}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: c.gold, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${c.goldFainter}` }}>{col.heading.toUpperCase()}</div>
              {col.links.map(([label, page]) => (
                <a key={label} href="#" onClick={(e) => { e.preventDefault(); onNavigate(page); }}
                  style={{ display: "block", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 15, color: c.textFaint, textDecoration: "none", marginBottom: 10 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = c.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = c.textFaint)}
                >{label}</a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: `1px solid ${c.borderFaint}`, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: c.textDimmer }}>
            © 2004–2026 DEEP FOCUS REVIEW — ALL RIGHTS RESERVED
          </div>
          <a href="#" onClick={(e) => e.preventDefault()}
            style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: c.gold, textDecoration: "none", border: `1px solid ${c.goldFainter}`, padding: "7px 16px", transition: "border-color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.gold; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.goldFainter; }}
          >JOIN ON PATREON →</a>
        </div>
      </div>
    </footer>
  );
}
