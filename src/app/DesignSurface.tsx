// ©2026 thinkany llc. All rights reserved.
import type { ReactNode } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { TabletFrame } from "./components/TabletFrame";
import { ViewToggle } from "./components/ViewToggle";
import { previewConfig } from "@/config/site";

type View = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

interface Props {
  view: View;
  setView: (v: View) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  /**
   * Isolated capture mode (set via `?capture={view}`). When present, the shell
   * renders ONLY the design surface — no ViewToggle chrome, no device bezel —
   * so scripts/export-to-figma.mjs can snapshot the true responsive design at
   * the viewport width it sets per breakpoint.
   */
  capture?: View;
  /** Page background behind the device frame. Defaults to the project cream. */
  bg?: string;
  children: ReactNode;
}

/**
 * Shared responsive-preview shell for every DESIGN page (Home + any page you
 * add). It wraps page content in the ViewToggle + device-frame preview, and —
 * critically — handles isolated capture mode in ONE place. That means any page
 * built with <DesignSurface> is exportable to Figma per breakpoint BY DEFAULT;
 * there is no per-page capture branch to remember. See pages.ts for the page
 * manifest the export tool enumerates.
 */
export function DesignSurface({
  view,
  setView,
  orientation,
  setOrientation,
  capture,
  bg = "var(--ta-cream)",
  children,
}: Props) {
  // Capture mode: bare design surface. The export tool sets the viewport width,
  // so the real responsive CSS (clamp/vw/media queries) reflows against the
  // true viewport. data-capture-ready lets the headless driver await render.
  if (capture) {
    return (
      <div data-capture-ready className="min-h-screen flex flex-col" style={{ background: bg }}>
        <div className="flex-1 flex">{children}</div>
      </div>
    );
  }

  const toggleOrientation = () =>
    setOrientation(orientation === "portrait" ? "landscape" : "portrait");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      <ViewToggle
        view={view}
        onChange={setView}
        views={previewConfig.views}
        orientation={orientation}
        onRotate={toggleOrientation}
      />
      {view === "mobile" ? (
        <PhoneFrame bg={bg} orientation={orientation}>
          {children}
        </PhoneFrame>
      ) : view === "tablet" ? (
        <TabletFrame bg={bg} orientation={orientation}>
          {children}
        </TabletFrame>
      ) : (
        <div className="flex-1 flex">{children}</div>
      )}
    </div>
  );
}
