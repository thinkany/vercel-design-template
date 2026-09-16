// ©2026 thinkany llc. All rights reserved.
import { useEffect, useRef, useState } from "react";
import { copy } from "@/copy";
import type { Device, DeviceKind } from "@/config/site";

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

const CaretIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
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
  /**
   * The devices a framed view (mobile / tablet) can simulate, and the chosen one's id
   * per kind. With a list of two or more, clicking the ACTIVE Mobile or Tablet button
   * opens it (an inactive button still just switches the view).
   */
  devices?: Partial<Record<DeviceKind, readonly Device[]>>;
  device?: Partial<Record<DeviceKind, string>>;
  onDevice?: (kind: DeviceKind, id: string) => void;
  /** Inline style overrides for the bar wrapper */
  barStyle?: React.CSSProperties;
  /** When set, an "Edit …" button with a pencil sits at the bar's left (the app's CMS opens on this item). */
  onEdit?: () => void;
  editLabel?: string;
}

const buttonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "var(--admin-accent)" : "transparent",
  border: `1px solid ${active ? "var(--admin-accent)" : "rgba(0,0,0,0.2)"}`,
  color: active ? "#fff" : "var(--admin-gray-dark)",
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
});

/** The device list under an active Mobile / Tablet button. Closes on outside click or Escape. */
function DeviceMenu({ list, chosen, onPick, onClose }: { list: readonly Device[]; chosen?: string; onPick: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={copy.viewToggle.deviceMenu}
      style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, minWidth: 220,
        background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 4, padding: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontFamily: "var(--admin-font-body)",
      }}
    >
      {list.map((d) => {
        const on = d.id === chosen;
        return (
          <button
            key={d.id}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            onClick={() => { onPick(d.id); onClose(); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%",
              background: on ? "rgba(0,0,0,0.05)" : "transparent", border: 0, borderRadius: 3, cursor: "pointer",
              padding: "6px 10px", fontFamily: "inherit", fontSize: 12, fontWeight: on ? 600 : 500, color: "var(--admin-gray-dark)", textAlign: "left",
            }}
          >
            <span>{d.name}</span>
            <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: "var(--admin-gray-mid)" }}>{copy.viewToggle.deviceDims(d.width, d.height)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ViewToggle({ view, onChange, views = ["desktop", "tablet", "mobile"], orientation = "portrait", onRotate, devices, device, onDevice, barStyle, onEdit, editLabel }: ViewToggleProps) {
  const canRotate = view !== "desktop" && !!onRotate;
  const [menuFor, setMenuFor] = useState<DeviceKind | null>(null);
  const closeMenu = () => setMenuFor(null);
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
        // A framed view with a device list: the active button opens it.
        const list = v === "desktop" ? undefined : devices?.[v];
        const listed = !!list && list.length > 1 && !!onDevice;
        const chosen = listed ? list.find((d) => d.id === device?.[v as DeviceKind]) ?? list[0] : undefined;
        const open = listed && view === v && menuFor === v;
        const button = (
          <button
            key={listed ? undefined : v}
            type="button"
            onClick={() => { if (view !== v) { onChange(v); closeMenu(); } else if (listed) setMenuFor(open ? null : (v as DeviceKind)); }}
            title={chosen && view === v ? copy.viewToggle.deviceTitle(chosen.name) : undefined}
            aria-haspopup={listed && view === v ? "menu" : undefined}
            aria-expanded={listed && view === v ? open : undefined}
            style={buttonStyle(view === v)}
          >
            <Icon />
            {copy.viewToggle.devices[v]}
            {listed && view === v && <CaretIcon />}
          </button>
        );
        if (!listed) return button;
        return (
          <div key={v} style={{ position: "relative", display: "flex" }}>
            {button}
            {open && <DeviceMenu list={list} chosen={chosen?.id} onPick={(id) => onDevice(v as DeviceKind, id)} onClose={closeMenu} />}
          </div>
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
