// ©2026 thinkany llc. All rights reserved.
const DesktopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="20" height="14" rx="1" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const TabletIcon = () => (
  <svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <circle cx="12" cy="18.5" r="0.8" fill="currentColor" />
  </svg>
);

const MobileIcon = () => (
  <svg width="11" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <circle cx="12" cy="18" r="0.8" fill="currentColor" />
  </svg>
);

const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v5h-5" />
  </svg>
);

type ViewOption = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

const ICONS = {
  desktop: DesktopIcon,
  tablet: TabletIcon,
  mobile: MobileIcon,
} as const;

interface ViewToggleProps {
  view: ViewOption;
  onChange: (v: ViewOption) => void;
  /** Current device orientation; the rotate control toggles it. */
  orientation?: Orientation;
  onRotate?: () => void;
  /** Inline style overrides for the bar wrapper */
  barStyle?: React.CSSProperties;
}

export function ViewToggle({ view, onChange, orientation = "portrait", onRotate, barStyle }: ViewToggleProps) {
  const canRotate = view !== "desktop" && !!onRotate;
  return (
    <div
      style={{
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "10px 32px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
        ...barStyle,
      }}
    >
      <span style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginRight: 6 }}>
        View
      </span>
      {(["desktop", "tablet", "mobile"] as const).map((v) => {
        const Icon = ICONS[v];
        return (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            background: view === v ? "var(--admin-blue)" : "transparent",
            border: `1px solid ${view === v ? "var(--admin-blue)" : "rgba(0,0,0,0.2)"}`,
            color: view === v ? "#fff" : "var(--admin-gray-dark)",
            fontFamily: "var(--admin-font-body)",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 12px",
            cursor: "pointer",
            borderRadius: 3,
            transition: "background 0.15s, color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon />
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
        );
      })}
      {canRotate && (
        <button
          onClick={onRotate}
          title={`Rotate to ${orientation === "portrait" ? "landscape" : "portrait"}`}
          aria-label="Rotate device"
          style={{
            background: "transparent",
            border: "1px solid rgba(0,0,0,0.2)",
            color: "var(--admin-gray-dark)",
            fontFamily: "var(--admin-font-body)",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 12px",
            cursor: "pointer",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              display: "flex",
              transition: "transform 0.15s",
              transform: orientation === "landscape" ? "rotate(-90deg)" : "none",
            }}
          >
            <RotateIcon />
          </span>
          Rotate
        </button>
      )}
    </div>
  );
}
