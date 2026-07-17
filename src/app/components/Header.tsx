// ©2026 thinkany llc. All rights reserved.
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { designPages } from "../pages";
import { siteConfig } from "@/config/site";

/**
 * Global site header — rendered for every WEBSITE design page by DesignSurface
 * (not per page). Edit it here once and every page + breakpoint + variation
 * updates; a variation diverges by dropping its own Header.tsx into
 * src/variations/{id}/components/.
 *
 * RESPONSIVE VIA CONTAINER QUERIES, not viewport. The device-frame preview
 * (PhoneFrame/TabletFrame) renders inside a fixed-width box in your real window,
 * so `md:`/`lg:`/`vw` would read the window, not the frame. DesignSurface marks
 * the design surface `@container`, so `@lg:` here keys off the *frame* width —
 * hamburger inside the phone, full nav on tablet/desktop — and it matches the
 * Figma export too. Nav is single-source: one `pages` array feeds both layouts.
 */
export function Header({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [open, setOpen] = useState(false);
  // Single source of nav items — auto-grows as pages are added to pages.ts.
  const pages = designPages;

  return (
    <header data-block="header" data-block-name="Header" className="relative w-full border-b border-black/10 bg-ta-cream">
      <div className="flex items-center justify-between px-6 py-4 @lg:px-10">
        {/* Logo lockup */}
        <button
          onClick={() => onNavigate("home")}
          className="font-ta-display text-lg text-ta-ink leading-none cursor-pointer"
        >
          {siteConfig.clientName}
        </button>

        {/* Desktop / tablet nav — shown once the surface is wide enough */}
        <nav className="hidden @lg:flex items-center gap-8">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => onNavigate(p.id)}
              className="font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-gray-dark hover:text-ta-ink transition-colors cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </nav>

        {/* Mobile trigger — inline (no portal, so it stays inside the frame) */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="@lg:hidden text-ta-ink cursor-pointer"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown panel — absolutely positioned within the header so it
          renders inside the device frame, not the browser window. */}
      {open && (
        <nav className="@lg:hidden absolute left-0 right-0 top-full z-20 flex flex-col border-b border-black/10 bg-ta-cream shadow-lg">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onNavigate(p.id);
                setOpen(false);
              }}
              className="font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-gray-dark hover:text-ta-ink text-left px-6 py-4 border-t border-black/5 first:border-t-0 cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
