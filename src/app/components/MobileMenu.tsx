// ©2026 thinkany llc. All rights reserved.
import { X } from "lucide-react";
import { designPages } from "../pages";
import { siteConfig } from "@/config/site";
import { MENU_SIDE, useMobileMenu } from "../mobileMenu";

/**
 * Default mobile menu — a slide-in drawer shown on the narrow breakpoints (below
 * `@lg`, where the Header shows its hamburger). Shipped by DEFAULT so a designer
 * never has to ask for it; it diverges per variation by dropping its own
 * MobileMenu.tsx into src/variations/{id}/components/ (resolved like Header/Footer).
 *
 * IN-FRAME OVERLAY, not a portal: rendered by DesignSurface inside the `@container`
 * design surface, so it stays inside the device-frame preview (a shadcn Sheet would
 * escape to document.body and break out of the phone). It slides from MENU_SIDE —
 * the SAME edge the Header puts the hamburger on (single source of truth).
 *
 * EXPORT: the drawer is marked `data-block="mobile-menu"` ONLY while open, so the
 * Figma exporter captures it (from a `?menu=open` capture pass) as its own "Mobile
 * Menu" component — and never picks up the closed, off-screen panel on normal passes.
 * Kept mounted (translated off-screen) so it slides both open and closed.
 */
export function MobileMenu({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { open, setOpen } = useMobileMenu();
  const pages = designPages;
  const off = MENU_SIDE === "left" ? "-translate-x-full" : "translate-x-full";

  return (
    <div className="@lg:hidden" aria-hidden={!open}>
      {/* Scrim — dims the page behind the drawer; click to dismiss. */}
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 z-30 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Drawer — full-height panel anchored to MENU_SIDE, slides in via transform.
          The data-block marker is present ONLY when open so the exporter captures
          the open drawer and ignores the closed off-screen one. */}
      <nav
        {...(open ? { "data-block": "mobile-menu", "data-block-name": "Mobile Menu" } : {})}
        className={`absolute inset-y-0 ${MENU_SIDE === "left" ? "left-0" : "right-0"} z-40 flex w-[78%] max-w-[320px] flex-col bg-ta-cream shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : `${off} pointer-events-none`
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <span className="font-ta-display text-lg leading-none text-ta-ink">
            {siteConfig.clientName}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="cursor-pointer text-ta-ink"
          >
            <X size={22} />
          </button>
        </div>
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onNavigate(p.id);
              setOpen(false);
            }}
            className="cursor-pointer border-t border-black/5 px-6 py-4 text-left font-ta-sans text-sm font-medium uppercase tracking-[0.1em] text-ta-gray-dark first:border-t-0 hover:text-ta-ink"
          >
            {p.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
