// ©2026 thinkany llc. All rights reserved.
import { copy } from "@/copy";

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

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
  /**
   * Which device buttons to show, in order. Driven by project type (see
   * previewConfig in config/site). Defaults to all three when omitted.
   */
  views?: readonly ViewOption[];
  /** Current device orientation; the rotate control toggles it. */
  orientation?: Orientation;
  onRotate?: () => void;
  /** Inline style overrides for the bar wrapper */
  barStyle?: React.CSSProperties;
  /** When set, an "Edit …" button with a pencil sits at the bar's left (the app's CMS opens on this item). */
  onEdit?: () => void;
  editLabel?: string;
}

export function ViewToggle({ view, onChange, views = ["desktop", "tablet", "mobile"], orientation = "portrait", onRotate, barStyle, onEdit, editLabel }: ViewToggleProps) {
  const canRotate = view !== "desktop" && !!onRotate;
  return (
    <div
      data-view-toggle // the app's design-editing tips anchor on this bar from outside the page
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
      {onEdit && (
        <button
          onClick={onEdit}
          data-edit-item // the app's tips can anchor on it
          style={{
            marginRight: "auto",
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
          <PencilIcon />
          {editLabel}
        </button>
      )}
      <span style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginRight: 6 }}>
        {copy.viewToggle.view}
      </span>
      {views.map((v) => {
        const Icon = ICONS[v];
        return (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            background: view === v ? "var(--admin-accent)" : "transparent",
            border: `1px solid ${view === v ? "var(--admin-accent)" : "rgba(0,0,0,0.2)"}`,
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
          {copy.viewToggle.devices[v]}
        </button>
        );
      })}
      {canRotate && (
        <button
          onClick={onRotate}
          title={copy.viewToggle.rotateTitle(orientation === "portrait" ? copy.viewToggle.orientation.landscape : copy.viewToggle.orientation.portrait)}
          aria-label={copy.viewToggle.rotateAria}
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
          {copy.viewToggle.rotate}
        </button>
      )}
    </div>
  );
}
