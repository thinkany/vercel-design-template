// ©2026 thinkany llc. All rights reserved.
import { PhoneFrame } from "./PhoneFrame";
import { TabletFrame } from "./TabletFrame";
import { ViewToggle } from "./ViewToggle";
import { siteConfig } from "@/config/site";

type View = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

interface Props {
  onNavigate: (page: string) => void;
  view: View;
  setView: (v: View) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
}

// Neutral starter page. This is where a project's real home page gets built —
// replace this content with your design, referencing the styleguide for tokens,
// type, and components. It keeps the desktop/mobile responsive preview.
function HomeContent({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div style={{
      minHeight: "100%",
      width: "100%",
      background: "var(--ta-cream)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "80px 32px",
      textAlign: "center",
    }}>
      {siteConfig.projectName && (
        <div style={{ fontFamily: "var(--ta-font-sans)", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ta-gray-mid)", marginBottom: 20 }}>
          {siteConfig.projectName}
        </div>
      )}
      <h1 style={{ fontFamily: "var(--ta-font-display)", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 400, color: "var(--ta-ink)", margin: "0 0 20px", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
        {siteConfig.clientName}
      </h1>
      <p style={{ fontFamily: "var(--ta-font-serif)", fontSize: 17, color: "var(--ta-gray-dark)", lineHeight: 1.6, maxWidth: 440, margin: "0 0 36px" }}>
        This is your starting point. Build your home page here, and reference the
        styleguide for tokens, type, and components.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => onNavigate("styleguide")} style={{ fontFamily: "var(--ta-font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "var(--ta-blue)", border: "none", padding: "11px 22px", borderRadius: 3, cursor: "pointer" }}>
          Open styleguide
        </button>
        <button onClick={() => onNavigate("dashboard")} style={{ fontFamily: "var(--ta-font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ta-gray-dark)", background: "transparent", border: "1px solid rgba(0,0,0,0.2)", padding: "11px 22px", borderRadius: 3, cursor: "pointer" }}>
          Dashboard
        </button>
      </div>
    </div>
  );
}

export function Home({ onNavigate, view, setView, orientation, setOrientation }: Props) {
  const content = <HomeContent onNavigate={onNavigate} />;
  const toggleOrientation = () =>
    setOrientation(orientation === "portrait" ? "landscape" : "portrait");
  return (
    <div style={{ minHeight: "100vh", background: "var(--ta-cream)", display: "flex", flexDirection: "column" }}>
      <ViewToggle view={view} onChange={setView} orientation={orientation} onRotate={toggleOrientation} />
      {view === "mobile" ? (
        <PhoneFrame bg="var(--ta-cream)" orientation={orientation}>{content}</PhoneFrame>
      ) : view === "tablet" ? (
        <TabletFrame bg="var(--ta-cream)" orientation={orientation}>{content}</TabletFrame>
      ) : (
        <div style={{ flex: 1, display: "flex" }}>{content}</div>
      )}
    </div>
  );
}
