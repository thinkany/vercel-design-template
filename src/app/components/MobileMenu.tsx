// ©2026 thinkany llc. All rights reserved.
import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { designPages } from "@/app/pages";
import { siteConfig } from "@/config/site";
import { MENU_SIDE, useMenuState } from "@/app/menuState";
import { menuFor } from "@/app/menu";
import { useDrawerLock } from "./useDrawerLock";

/**
 * Default mobile menu — a slide-in drawer shown on the narrow breakpoints (below
 * `@lg`, where the Header shows its hamburger). Shipped by DEFAULT so a designer
 * never has to ask for it; it diverges per variation by dropping its own
 * MobileMenu.tsx into src/variations/{id}/components/ (resolved like Header/Footer).
 *
 * IN SYNC WITH THE DESKTOP NAV. The exact same nav data feeds both: the `pages`
 * array AND each item's `menu.ts` menu. Desktop reveals an item's dropdown/mega on
 * hover; mobile can't hover, so a menu-bearing item gets a chevron that expands the
 * SAME sub-links inline (an accordion). Add/edit a menu in menu.ts and both layouts
 * update together — the mobile drawer never falls out of step with the desktop nav.
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
  const { open, setOpen } = useMenuState();
  const pages = designPages;
  const off = MENU_SIDE === "left" ? "-translate-x-full" : "translate-x-full";

  // Which menu-bearing items are expanded (independent toggles). Sub-links navigate to
  // the parent page just like the desktop dropdown/mega links do.
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const go = (page: string) => {
    onNavigate(page);
    setOpen(false);
  };

  // Pin the drawer to the visible frame + lock background scroll while open, so it can't
  // scroll away and only its own list scrolls when the items overflow (box = that viewport).
  const { ref, box } = useDrawerLock<HTMLDivElement>(open);

  return (
    <div ref={ref} className="@lg:hidden" aria-hidden={!open}>
      {/* Scrim — dims the page behind the drawer; click to dismiss. Above the
          sticky header (z-[60]) so the drawer covers the visible surface. */}
      <div
        onClick={() => setOpen(false)}
        style={box ? { top: box.top, height: box.height } : undefined}
        className={`absolute left-0 right-0 z-[70] bg-black/40 transition-opacity duration-300 ${
          box ? "" : "inset-y-0"
        } ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      {/* Drawer — pinned to the visible frame (box) and anchored to MENU_SIDE, slides in via
          transform. The data-block marker is present ONLY when open so the exporter captures
          the open drawer and ignores the closed off-screen one. */}
      <nav
        {...(open ? { "data-block": "mobile-menu", "data-block-name": "Mobile Menu" } : {})}
        style={box ? { top: box.top, height: box.height } : undefined}
        className={`absolute ${box ? "" : "inset-y-0"} ${MENU_SIDE === "left" ? "left-0" : "right-0"} z-[80] flex w-[78%] max-w-[320px] flex-col bg-ta-surface shadow-2xl transition-transform duration-300 ${
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

        {/* Nav items — same source as desktop. A menu-bearing item adds a chevron that
            expands its menu.ts sub-links inline; a plain item is just a link. */}
        <div className="flex-1 overflow-y-auto">
          {pages.map((p) => {
            const menu = menuFor(p.id);
            const hasSub = menu.kind !== "none";
            const isOpen = expanded.includes(p.id);
            return (
              <div key={p.id} className="border-t border-black/5 first:border-t-0">
                <div className="flex items-stretch">
                  <button
                    onClick={() => go(p.id)}
                    className="flex-1 cursor-pointer px-6 py-4 text-left font-ta-sans text-sm font-medium uppercase tracking-[0.1em] text-ta-body hover:text-ta-ink"
                  >
                    {p.name}
                  </button>
                  {hasSub && (
                    <button
                      onClick={() => toggle(p.id)}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${p.name} menu`}
                      aria-expanded={isOpen}
                      className="flex cursor-pointer items-center px-5 text-ta-ink"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>

                {/* Sub-links — the SAME links the desktop dropdown/mega shows for this item.
                    Kept mounted and animated open/closed (grid-rows 0fr→1fr eases to the exact
                    content height), matching the drawer's own duration-300 slide. */}
                {hasSub && (
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-2">
                        {menu.kind === "dropdown" &&
                          menu.links.map((l) => (
                            <button
                              key={l.label}
                              onClick={() => go(p.id)}
                              className="block w-full cursor-pointer px-8 py-2.5 text-left font-ta-sans text-xs uppercase tracking-[0.08em] text-ta-body hover:text-ta-ink"
                            >
                              {l.label}
                            </button>
                          ))}

                        {menu.kind === "mega" &&
                          menu.sections.map((s) => (
                            <div key={s.title} className="px-8 pt-2 pb-1">
                              <div className="mb-1 font-ta-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ta-ink">
                                {s.title}
                              </div>
                              {s.links.map((l) => (
                                <button
                                  key={l.label}
                                  onClick={() => go(p.id)}
                                  className="block w-full cursor-pointer py-2 text-left font-ta-sans text-sm text-ta-body hover:text-ta-ink"
                                >
                                  {l.label}
                                </button>
                              ))}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
