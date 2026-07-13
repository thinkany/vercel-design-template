// ©2026 thinkany llc. All rights reserved.
import type { ReactNode } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { TabletFrame } from "./components/TabletFrame";
import { ViewToggle } from "./components/ViewToggle";
import { resolveComponent } from "./variationRegistry";
import { previewConfig, projectType } from "@/config/site";

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
  /**
   * Page navigation (App's setPage) — wired to the global Header/Footer links.
   * Every design page already receives this; forward it here.
   */
  onNavigate: (page: string) => void;
  /**
   * Global site chrome (Header + Footer) is rendered by DEFAULT for `website`
   * projects. Set `chrome={false}` for a bare page (e.g. a full-bleed landing).
   * `app`/`brand` projects never get the website chrome regardless.
   */
  chrome?: boolean;
  children: ReactNode;
}

/** Active variation id (from `?v=`), so Header/Footer resolve per variation. */
function getVariationId(): string {
  return new URLSearchParams(window.location.search).get("v") ?? "v00";
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
  onNavigate,
  chrome,
  children,
}: Props) {
  // Global site chrome: website projects only, unless the page opts out.
  const showChrome = chrome !== false && projectType === "website";
  const Header = showChrome ? resolveComponent(getVariationId(), "Header") : null;
  const Footer = showChrome ? resolveComponent(getVariationId(), "Footer") : null;

  // The design surface itself. `@container` makes it the responsive reference,
  // so page + Header/Footer `@sm:`/`@lg:` variants key off the DEVICE-FRAME
  // width (or, in capture mode, the viewport width the export tool sets) — the
  // live preview and the Figma export agree. Header/Footer stack above/below the
  // page content and are captured as part of the design.
  const surface = (
    <div className="@container relative flex-1 flex flex-col min-h-full w-full">
      {Header && <Header onNavigate={onNavigate} />}
      <div className="flex-1 flex flex-col">{children}</div>
      {Footer && <Footer onNavigate={onNavigate} />}
    </div>
  );

  // Capture mode: bare design surface. The export tool sets the viewport width,
  // so the real responsive CSS (container queries) reflows against the true
  // viewport. data-capture-ready lets the headless driver await render.
  if (capture) {
    return (
      <div data-capture-ready className="min-h-screen flex flex-col" style={{ background: bg }}>
        {surface}
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
          {surface}
        </PhoneFrame>
      ) : view === "tablet" ? (
        <TabletFrame bg={bg} orientation={orientation}>
          {surface}
        </TabletFrame>
      ) : (
        surface
      )}
    </div>
  );
}
