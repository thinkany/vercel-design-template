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
    <div className="min-h-full w-full bg-ta-cream flex flex-col items-center justify-center px-8 py-20 text-center">
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

export function Home({ onNavigate, view, setView, orientation, setOrientation }: Props) {
  const content = <HomeContent onNavigate={onNavigate} />;
  const toggleOrientation = () =>
    setOrientation(orientation === "portrait" ? "landscape" : "portrait");
  return (
    <div className="min-h-screen bg-ta-cream flex flex-col">
      <ViewToggle view={view} onChange={setView} orientation={orientation} onRotate={toggleOrientation} />
      {view === "mobile" ? (
        <PhoneFrame bg="var(--ta-cream)" orientation={orientation}>{content}</PhoneFrame>
      ) : view === "tablet" ? (
        <TabletFrame bg="var(--ta-cream)" orientation={orientation}>{content}</TabletFrame>
      ) : (
        <div className="flex-1 flex">{content}</div>
      )}
    </div>
  );
}
