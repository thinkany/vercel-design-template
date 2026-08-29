// ©2026 thinkany llc. All rights reserved.
import { useLayoutEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { designPages } from "@/app/pages";
import { siteConfig } from "@/config/site";
import { MENU_SIDE, useMenuState } from "@/app/menuState";
import { menuFor, type DropdownMenu, type MegaMenu } from "@/app/menu";

/**
 * Global site header — rendered for every WEBSITE design page by DesignSurface
 * (not per page). Edit it here once and every page + breakpoint + variation
 * updates; a variation diverges by dropping its own Header.tsx into
 * src/variations/{id}/components/.
 *
 * RESPONSIVE VIA CONTAINER QUERIES, not viewport. Below `@lg` the surface shows
 * the hamburger (+ the MobileMenu drawer); at `@lg` it shows the desktop nav,
 * whose items reveal a dropdown/mega on hover per menu.ts. Nav is single-source:
 * one `pages` array feeds both layouts, and each item's menu comes from menu.ts.
 *
 * EXPORT: an open desktop menu panel carries `data-block="menu-{id}"` ONLY while
 * open, so the exporter captures each menu-bearing item's open state as its own
 * "Menu — {Item}" block (from a `?menu=open&item={id}` pass). Menu items also carry
 * `data-menu-item` so the export tool can discover which items to open.
 */

function DropdownPanel({
  id, name, menu, open, onNavigate,
}: { id: string; name: string; menu: DropdownMenu; open: boolean; onNavigate: (p: string) => void }) {
  // Rendered at HEADER level (sibling of the mega panels), so `top-full` sits flush to the
  // header's BOTTOM edge, matching the mega, rather than the nav item's bottom mid-header.
  // Its horizontal position is measured from its trigger button (`[data-menu-item]`) so the
  // panel opens directly under its item; if it would spill past the right edge we right-align
  // it to the trigger instead. Measured against the HEADER (which spans the frame), not
  // `window`, so it's correct in the device-frame preview and the Figma export alike.
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number } | { right: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const panel = ref.current;
    const header = panel?.closest("header");
    const trigger = header?.querySelector<HTMLElement>(`[data-menu-item="${id}"]`);
    if (!panel || !header || !trigger) return;
    const h = header.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    // Left edge under the trigger; flip to right-aligned-to-trigger if it would overflow.
    if (t.left - h.left + panel.offsetWidth > h.width - 16) setPos({ right: h.right - t.right });
    else setPos({ left: t.left - h.left });
  }, [open, id]);
  return (
    <div
      ref={ref}
      {...(open ? { "data-block": `menu-${id}`, "data-block-name": `Menu — ${name}` } : {})}
      style={pos ?? undefined}
      className={`absolute top-full z-40 min-w-[220px] flex-col border border-black/10 bg-ta-surface p-2 shadow-xl ${open ? "flex" : "hidden"}`}
    >
      {menu.links.map((l) => (
        <button
          key={l.label}
          onClick={() => onNavigate(id)}
          className="cursor-pointer px-4 py-2.5 text-left font-ta-sans text-xs font-medium uppercase tracking-[0.08em] text-ta-body hover:text-ta-ink"
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function MegaPanel({
  id, name, menu, open, onNavigate,
}: { id: string; name: string; menu: MegaMenu; open: boolean; onNavigate: (p: string) => void }) {
  // Full CONTENT-COLUMN-width panel below the header (centered max-width), flush to
  // the header bottom so hover carries into it. Marked as a block only when open.
  return (
    <div
      {...(open ? { "data-block": `menu-${id}`, "data-block-name": `Menu — ${name}` } : {})}
      className={`absolute inset-x-0 top-full z-40 mx-auto max-w-[1200px] border border-black/10 bg-ta-surface px-8 py-8 shadow-xl ${open ? "block" : "hidden"}`}
    >
      <div className="grid grid-cols-4 gap-8">
        {menu.sections.map((s) => (
          <div key={s.title}>
            <h4 className="mb-3 font-ta-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ta-ink">
              {s.title}
            </h4>
            <ul className="flex flex-col gap-2">
              {s.links.map((l) => (
                <li key={l.label}>
                  <button
                    onClick={() => onNavigate(id)}
                    className="cursor-pointer font-ta-sans text-sm text-ta-body hover:text-ta-ink"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {menu.featured && (
          <div className="rounded bg-black/[0.04] p-5">
            <div className="mb-2 font-ta-sans text-[11px] uppercase tracking-[0.12em] text-ta-ink/60">
              Featured
            </div>
            <div className="font-ta-display text-lg text-ta-ink">{menu.featured.label}</div>
            <p className="mt-1 font-ta-sans text-sm text-ta-body">{menu.featured.blurb}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Header({ onNavigate }: { onNavigate: (page: string) => void }) {
  // Shared menu state (provided by DesignSurface): mobile drawer + desktop active item.
  const { open, setOpen, activeItem, setActiveItem } = useMenuState();
  // Single source of nav items — auto-grows as pages are added to pages.ts.
  const pages = designPages;

  return (
    <header
      data-block="header"
      data-block-name="Header"
      onMouseLeave={() => setActiveItem(null)}
      // Sticky by DEFAULT so the nav never scrolls away (ask Claude to unstick —
      // swap `sticky top-0` for `relative` — if a design wants it to scroll off).
      // `sticky` + a high z establishes a stacking context ABOVE the page content,
      // so the dropdown/mega panels that overflow below the header are never hidden
      // behind a later content section (the classic "menu isn't showing" bug). The
      // MobileMenu drawer sits ABOVE this (z-[70]/z-[80]) so it still covers the bar.
      className="sticky top-0 z-[60] w-full border-b border-black/10 bg-ta-surface"
    >
      <div className="flex items-center justify-between px-6 py-4 @lg:px-10">
        {/* Logo lockup — an uploaded brand logo (from the brief) when present,
            otherwise the client name as a text wordmark. */}
        <button
          onClick={() => onNavigate("home")}
          aria-label={siteConfig.clientName}
          className="flex items-center leading-none cursor-pointer font-ta-display text-lg text-ta-ink"
        >
          {siteConfig.logo ? (
            <img
              src={siteConfig.logo}
              alt={siteConfig.clientName}
              className="h-8 w-auto max-w-[200px] object-contain"
            />
          ) : (
            siteConfig.clientName
          )}
        </button>

        {/* Desktop / tablet nav — each item reveals its menu.ts menu on hover. */}
        <nav className="hidden @lg:flex items-center gap-8">
          {pages.map((p) => {
            const menu = menuFor(p.id);
            const hasMenu = menu.kind !== "none";
            return (
              <div key={p.id} className="relative" onMouseEnter={() => hasMenu && setActiveItem(p.id)}>
                <button
                  {...(hasMenu ? { "data-menu-item": p.id } : {})}
                  onClick={() => onNavigate(p.id)}
                  className="flex items-center gap-1 font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-body hover:text-ta-ink transition-colors cursor-pointer"
                >
                  {p.name}
                  {hasMenu && (
                    <ChevronDown size={13} className={`transition-transform ${activeItem === p.id ? "rotate-180" : ""}`} />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Mobile trigger — placed on MENU_SIDE; opens the MobileMenu drawer. */}
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          className={`@lg:hidden text-ta-ink cursor-pointer ${MENU_SIDE === "left" ? "order-first" : ""}`}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Dropdown + mega panels both live at header level so they anchor flush to the
          header's BOTTOM edge (a dropdown positions itself under its trigger; a mega spans
          the content column). Only the active one renders open (each is its own block). */}
      {pages.map((p) => {
        const menu = menuFor(p.id);
        if (menu.kind === "mega")
          return <MegaPanel key={p.id} id={p.id} name={p.name} menu={menu} open={activeItem === p.id} onNavigate={onNavigate} />;
        if (menu.kind === "dropdown")
          return <DropdownPanel key={p.id} id={p.id} name={p.name} menu={menu} open={activeItem === p.id} onNavigate={onNavigate} />;
        return null;
      })}
    </header>
  );
}
