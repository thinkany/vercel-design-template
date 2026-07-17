// ©2026 thinkany llc. All rights reserved.
import { DesignSurface } from "../DesignSurface";
import { siteConfig } from "@/config/site";

type View = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

interface Props {
  onNavigate: (page: string) => void;
  view: View;
  setView: (v: View) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  /**
   * Isolated capture mode (set via `?capture={view}`). When present, Home
   * renders ONLY the design surface — no ViewToggle chrome, no device bezel —
   * so the export tool (scripts/export-to-figma.mjs) can snapshot the real
   * responsive design at whatever viewport width it sets per breakpoint.
   */
  capture?: View;
}

// Neutral starter page. This is where a project's real home page gets built —
// replace this content with your design, referencing the styleguide for tokens,
// type, and components. It keeps the desktop/mobile responsive preview.
function HomeContent({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div data-block="hero" data-block-name="Hero" className="min-h-full w-full bg-ta-cream flex flex-col items-center justify-center px-8 py-20 text-center">
      {siteConfig.projectName && (
        <div className="font-ta-sans text-[11px] font-semibold tracking-[0.18em] uppercase text-ta-gray-mid mb-5">
          {siteConfig.projectName}
        </div>
      )}
      <h1 className="font-ta-display text-[clamp(36px,6vw,64px)] font-normal text-ta-ink mb-5 leading-[1.05] tracking-[-0.02em]">
        {siteConfig.clientName}
      </h1>
      <p className="font-ta-serif text-[17px] text-ta-gray-dark leading-[1.6] max-w-[440px] mb-9">
        This is your starting point. Build your home page here, and reference the
        styleguide for tokens, type, and components.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => onNavigate("styleguide")}
          className="font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-white bg-ta-blue px-[22px] py-[11px] rounded-[3px] cursor-pointer"
        >
          Open styleguide
        </button>
        <button
          onClick={() => onNavigate("dashboard")}
          className="font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-gray-dark bg-transparent border border-black/20 px-[22px] py-[11px] rounded-[3px] cursor-pointer"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}

export function Home({ onNavigate, view, setView, orientation, setOrientation, capture }: Props) {
  // The responsive-preview shell + isolated capture mode live in DesignSurface,
  // so this page just supplies its content. Every design page follows this shape.
  return (
    <DesignSurface
      view={view}
      setView={setView}
      orientation={orientation}
      setOrientation={setOrientation}
      capture={capture}
      onNavigate={onNavigate}
    >
      <HomeContent onNavigate={onNavigate} />
    </DesignSurface>
  );
}
