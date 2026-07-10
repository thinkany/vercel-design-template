// ©2026 thinkany llc. All rights reserved.
import { siteConfig } from "@/config/site";

interface Props {
  onNavigate: (page: string) => void;
}

// Brand Guideline mode (VITE_PROJECT_TYPE="brand"). STUBBED / coming soon:
// there's no dedicated brand-guideline surface yet, so this is a placeholder
// shown in place of the Home design preview. When the Brand Guideline feature
// is built out, replace this content with the real thing. Unlike Home, this is
// a document-style page — no ViewToggle / device frames.
export function Brand({ onNavigate }: Props) {
  return (
    <div className="min-h-screen w-full bg-ta-cream flex flex-col items-center justify-center px-8 py-20 text-center">
      <div className="font-ta-sans text-[11px] font-semibold tracking-[0.18em] uppercase text-ta-gray-mid mb-5">
        Brand Guideline — Coming Soon
      </div>
      <h1 className="font-ta-display text-[clamp(36px,6vw,64px)] font-normal text-ta-ink mb-5 leading-[1.05] tracking-[-0.02em]">
        {siteConfig.clientName}
      </h1>
      <p className="font-ta-serif text-[17px] text-ta-gray-dark leading-[1.6] max-w-[460px] mb-9">
        This project is set up as a <strong>Brand Guideline</strong>. That surface
        is still in the works — for now, use the styleguide to define fonts,
        colors, and tokens. The dedicated brand-guideline layout will land here.
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
