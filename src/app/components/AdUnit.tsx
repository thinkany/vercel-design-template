// ©2004-2026 Deep Focus Review. All rights reserved.
/**
 * Reusable ad placeholder components.
 * Replace the inner div contents with real ad tags (Google AdSense script, etc.)
 * The wrapper border and label remain as editorial chrome around the ad slot.
 */

interface AdProps {
  width: number;
  height: number;
  /** Label above the unit */
  label?: string;
  /** Border color — defaults to very light gray */
  borderColor?: string;
  /** Extra wrapper styles */
  style?: React.CSSProperties;
}

function AdShell({ width, height, label = "Advertisement", borderColor = "rgba(0,0,0,0.12)", style }: AdProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
      {/* Label */}
      <div style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 9,
        letterSpacing: "0.12em",
        color: "rgba(0,0,0,0.28)",
        marginBottom: 4,
        textTransform: "uppercase",
        userSelect: "none",
      }}>
        {label}
      </div>
      {/* Ad slot */}
      <div style={{
        width,
        height,
        border: `0.5px solid ${borderColor}`,
        background: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}>
        {/* Placeholder content — swap with real ad tag */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "repeating-linear-gradient(45deg, #f0f0f0 0px, #f0f0f0 2px, #f5f5f5 2px, #f5f5f5 14px)",
          opacity: 0.5,
        }} />
        <div style={{
          position: "relative",
          textAlign: "center",
          padding: "0 12px",
        }}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>
            {width} × {height}
          </div>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, color: "rgba(0,0,0,0.22)", letterSpacing: "0.06em" }}>
            Ad slot
          </div>
        </div>
      </div>
    </div>
  );
}

/** 160×600 skyscraper — for left/right desktop gutters */
export function SkyscraperAd({ style, borderColor }: { style?: React.CSSProperties; borderColor?: string }) {
  return <AdShell width={160} height={600} borderColor={borderColor} style={style} />;
}

/** 300×250 medium rectangle — for inline / mobile placements */
export function RectangleAd({ style, borderColor }: { style?: React.CSSProperties; borderColor?: string }) {
  return <AdShell width={300} height={250} borderColor={borderColor} style={style} />;
}

/** 728×90 leaderboard — for wide horizontal placements */
export function LeaderboardAd({ style, borderColor }: { style?: React.CSSProperties; borderColor?: string }) {
  return <AdShell width={728} height={90} borderColor={borderColor} style={style} />;
}

/** 320×50 mobile banner */
export function MobileBannerAd({ style, borderColor }: { style?: React.CSSProperties; borderColor?: string }) {
  return <AdShell width={320} height={50} borderColor={borderColor} style={style} />;
}
