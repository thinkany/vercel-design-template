// ©2026 thinkany llc. All rights reserved.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { designPages } from "@/app/pages";
import { siteConfig } from "@/config/site";
import { useMenuState } from "@/app/menuState";
import { menuFor, type DropdownMenu, type MegaMenu } from "@/app/menu";
import { headerConfig as baseHeaderConfig, type HeaderConfig } from "@/app/header.config";
// ABSOLUTE (`@/`), never relative. `apply-brand.mjs` creates a variation by copying
// all of src/app/components into src/variations/{id}/components, so a relative
// import resolves against the VARIATION folder in the copy and breaks the build
// when the sibling isn't there (header.skin.ts is seeded separately, so it can be
// absent at copy time). Every other import in this file is already absolute.
import { headerSkin as baseHeaderSkin, type HeaderSkin } from "@/app/components/header.skin";
import { getVariationId, resolveData } from "@/app/variationRegistry";
import { useDrawerLock } from "@/app/components/useDrawerLock";

/**
 * GLOBAL SITE HEADER — CONFIGURED, NOT HAND-BUILT (CORE tier: upgrades overwrite
 * this file, and the design agent must not edit or copy it).
 *
 * Rendered for every WEBSITE design page by DesignSurface (not per page). It
 * implements ALL THREE placements and ALL THREE menu kinds once, correctly, and
 * reads which to render from data:
 *
 *   STRUCTURE → `src/app/header.config.ts`   (placement, menuKind, sticky, menuSide, mega)
 *   ARCHITECTURE → `src/app/pages.ts` + `src/app/menu.ts`  (which items, what they open)
 *   SKIN → `src/app/components/header.skin.ts`  (every class string below)
 *
 * That split is the point: the header is the most mechanical component in a
 * build, and re-deriving its grid per design is where menus drift (a centered
 * logo landing on a second row, a panel anchored mid-header, a drawer on the
 * wrong edge). Structure is written once and tested; the design agent styles
 * through the skin and moves things through the config. A variation that truly
 * needs a different header drops its own Header.tsx into
 * src/variations/{id}/components/ — the "custom header" path, which opts out of
 * these guarantees and is flagged as unverified by the menu check.
 *
 * RESPONSIVE VIA CONTAINER QUERIES, not viewport. Below `@lg` the surface shows
 * the hamburger + the slide-in drawer; at `@lg` it shows the desktop nav, whose
 * items reveal a dropdown/mega on hover or focus per menu.ts. Nav is
 * single-source: one `pages` array feeds both layouts.
 *
 * EXPORT: an open desktop panel carries `data-block="menu-{id}"` ONLY while open,
 * so the exporter captures each menu-bearing item's open state as its own
 * "Menu — {Item}" block (from a `?menu=open&item={id}` pass); the open drawer
 * carries `data-block="mobile-menu"`. Items carry `data-menu-item` so the export
 * tool and the menu check find the same things.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Mega grid column count → a static class (Tailwind can't see a computed name). */
const MEGA_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

// ---- Panels -----------------------------------------------------------------
// Both kinds render at HEADER level (siblings of the nav), absolutely positioned
// at `top-full`, so they anchor flush to the header's BOTTOM edge whatever the
// placement. Never anchor a panel inside its `relative` nav item: `top-full` then
// lands mid-header, floating under the item.

function DropdownPanel({
  id, name, menu, open, skin, onNavigate,
}: {
  id: string; name: string; menu: DropdownMenu; open: boolean; skin: HeaderSkin;
  onNavigate: (p: string) => void;
}) {
  // Horizontal position is measured from the trigger button (`[data-menu-item]`)
  // so the panel opens directly under its item; if it would spill past the right
  // edge we right-align it to the trigger instead. Measured against the HEADER
  // (which spans the frame), not `window`, so it is correct in the device-frame
  // preview and the Figma export alike — and under every placement, including a
  // centered or split nav.
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
    if (t.left - h.left + panel.offsetWidth > h.width - 16) setPos({ right: h.right - t.right });
    else setPos({ left: t.left - h.left });
  }, [open, id]);
  return (
    <div
      ref={ref}
      {...(open ? { "data-block": `menu-${id}`, "data-block-name": `Menu — ${name}`, "data-menu-panel": id } : {})}
      style={pos ?? undefined}
      className={cx("absolute top-full z-40 min-w-[220px] flex-col", skin.panel, open ? "flex" : "hidden")}
    >
      {menu.links.map((l) => (
        <button
          key={l.label}
          onClick={() => onNavigate(id)}
          className={cx("cursor-pointer text-left", skin.dropdownLink)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function MegaPanel({
  id, name, menu, open, skin, mega, onNavigate,
}: {
  id: string; name: string; menu: MegaMenu; open: boolean; skin: HeaderSkin;
  mega: HeaderConfig["mega"]; onNavigate: (p: string) => void;
}) {
  // Full CONTENT-COLUMN-width panel below the header (centered max-width), flush
  // to the header bottom so hover carries into it. Column count is CONFIGURATION
  // (headerConfig.mega.columns), not a class the agent types.
  const showFeature = mega.feature && Boolean(menu.featured);
  return (
    <div
      {...(open ? { "data-block": `menu-${id}`, "data-block-name": `Menu — ${name}`, "data-menu-panel": id } : {})}
      className={cx(
        "absolute inset-x-0 top-full z-40 mx-auto max-w-[1200px]",
        skin.panel, skin.panelInner, open ? "block" : "hidden",
      )}
    >
      <div className={cx("grid gap-8", MEGA_COLS[mega.columns] ?? MEGA_COLS[4])}>
        {menu.sections.map((s) => (
          <div key={s.title}>
            <h4 className={cx("mb-3", skin.columnHeading)}>{s.title}</h4>
            <ul className="flex flex-col gap-2">
              {s.links.map((l) => (
                <li key={l.label}>
                  <button onClick={() => onNavigate(id)} className={cx("cursor-pointer", skin.columnLink)}>
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {showFeature && menu.featured && (
          <div className={skin.feature}>
            <div className={cx("mb-2 opacity-60", skin.columnHeading)}>Featured</div>
            <div className="font-ta-display text-lg text-ta-ink">{menu.featured.label}</div>
            <p className="mt-1 font-ta-sans text-sm text-ta-body">{menu.featured.blurb}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Mobile drawer (folded in) ----------------------------------------------
// Formerly MobileMenu.tsx. It lives here now because the hamburger and the drawer
// must always agree on `menuSide`, and because promote then has one chrome
// component to move rather than two. MobileMenu.tsx still ships as a thin
// re-export so existing variations and DesignSurface keep resolving.

function MobileDrawer({
  skin, config, onNavigate,
}: { skin: HeaderSkin; config: HeaderConfig; onNavigate: (page: string) => void }) {
  const { open, setOpen } = useMenuState();
  const pages = navPages(designPages);
  const left = config.menuSide === "left";
  const off = left ? "-translate-x-full" : "translate-x-full";

  // Which menu-bearing items are expanded (independent toggles). Mobile can't
  // hover, so a menu-bearing item gets a chevron that expands the SAME sub-links
  // inline — the drawer can never fall out of step with the desktop nav.
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const go = (page: string) => { onNavigate(page); setOpen(false); };

  // Pin the drawer to the visible frame + lock background scroll while open.
  const { ref, box } = useDrawerLock<HTMLDivElement>(open);

  return (
    <div ref={ref} className="@lg:hidden" aria-hidden={!open}>
      {/* Scrim — above the sticky header (z-[60]) so the drawer covers the surface. */}
      <div
        onClick={() => setOpen(false)}
        style={box ? { top: box.top, height: box.height } : undefined}
        className={cx(
          "absolute left-0 right-0 z-[70] bg-black/40 transition-opacity duration-300",
          box ? "" : "inset-y-0",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <nav
        {...(open ? { "data-block": "mobile-menu", "data-block-name": "Mobile Menu" } : {})}
        data-menu-drawer={config.menuSide}
        style={box ? { top: box.top, height: box.height } : undefined}
        className={cx(
          "absolute z-[80] flex w-[78%] max-w-[320px] flex-col transition-transform duration-300",
          box ? "" : "inset-y-0",
          left ? "left-0" : "right-0",
          skin.drawer,
          open ? "translate-x-0" : `${off} pointer-events-none`,
        )}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <span className={skin.wordmark}>{siteConfig.clientName}</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className={cx("cursor-pointer", skin.hamburger)}
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pages.map((p) => {
            const menu = menuFor(p.id);
            const hasSub = menu.kind !== "none";
            const isOpen = expanded.includes(p.id);
            return (
              <div key={p.id} className="border-t border-black/5 first:border-t-0">
                <div className="flex items-stretch">
                  <button
                    data-drawer-item={p.id}
                    onClick={() => go(p.id)}
                    className={cx("flex-1 cursor-pointer px-6 py-4 text-left", skin.drawerLink)}
                  >
                    {p.name}
                  </button>
                  {hasSub && (
                    <button
                      onClick={() => toggle(p.id)}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${p.name} menu`}
                      aria-expanded={isOpen}
                      className={cx("flex cursor-pointer items-center px-5", skin.hamburger)}
                    >
                      <ChevronDown size={16} className={cx("transition-transform", isOpen && "rotate-180")} />
                    </button>
                  )}
                </div>

                {/* Sub-links — the SAME links the desktop panel shows. Kept mounted and
                    animated open/closed (grid-rows 0fr→1fr), matching the slide. */}
                {hasSub && (
                  <div
                    className={cx(
                      "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-2">
                        {menu.kind === "dropdown" &&
                          menu.links.map((l) => (
                            <button
                              key={l.label}
                              data-drawer-sublink={p.id}
                              onClick={() => go(p.id)}
                              className={cx("block w-full cursor-pointer px-8 py-2.5 text-left", skin.drawerSubLink)}
                            >
                              {l.label}
                            </button>
                          ))}

                        {menu.kind === "mega" &&
                          menu.sections.map((s) => (
                            <div key={s.title} className="px-8 pt-2 pb-1">
                              <div className={cx("mb-1", skin.columnHeading)}>{s.title}</div>
                              {s.links.map((l) => (
                                <button
                                  key={l.label}
                                  data-drawer-sublink={p.id}
                                  onClick={() => go(p.id)}
                                  className={cx("block w-full cursor-pointer py-2 text-left", skin.columnLink)}
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

// ---- Bar pieces --------------------------------------------------------------

function Logo({ skin, onNavigate }: { skin: HeaderSkin; onNavigate: (p: string) => void }) {
  return (
    <button
      data-header-logo
      onClick={() => onNavigate("home")}
      aria-label={siteConfig.clientName}
      className="flex cursor-pointer items-center leading-none"
    >
      {siteConfig.logo ? (
        <img src={siteConfig.logo} alt={siteConfig.clientName} className={skin.logo} />
      ) : (
        <span className={skin.wordmark}>{siteConfig.clientName}</span>
      )}
    </button>
  );
}

function NavLinks({
  pages, skin, activeItem, setActiveItem, onNavigate,
}: {
  pages: typeof designPages; skin: HeaderSkin; activeItem: string | null;
  setActiveItem: (id: string | null) => void; onNavigate: (p: string) => void;
}) {
  // Arrow keys move between top-level items; Enter/Space navigates; a menu-bearing
  // item opens on hover AND on focus, so the nav is reachable without a mouse.
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const nav = e.currentTarget.closest("nav");
    const items = Array.from(nav?.querySelectorAll<HTMLElement>("[data-nav-link]") ?? []);
    const i = items.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length]?.focus();
  };
  return (
    <>
      {pages.map((p) => {
        const menu = menuFor(p.id);
        const hasMenu = menu.kind !== "none";
        const isOpen = activeItem === p.id;
        return (
          <button
            key={p.id}
            data-nav-link={p.id}
            {...(hasMenu ? { "data-menu-item": p.id, "aria-expanded": isOpen, "aria-haspopup": "true" } : {})}
            onMouseEnter={() => hasMenu && setActiveItem(p.id)}
            onFocus={() => setActiveItem(hasMenu ? p.id : null)}
            onKeyDown={onKeyDown}
            onClick={() => onNavigate(p.id)}
            className={cx("flex cursor-pointer items-center gap-1", skin.link, isOpen && skin.linkActive)}
          >
            {p.name}
            {hasMenu && (
              <ChevronDown size={13} className={cx("transition-transform", isOpen && "rotate-180")} />
            )}
          </button>
        );
      })}
    </>
  );
}

/**
 * The pages the NAV shows. Home is deliberately excluded: the logo is the home
 * link, and a separate "Home" item reads dated (the same rule /design states). It
 * still exists in pages.ts as a page, it just isn't a nav item.
 */
const navPages = (pages: typeof designPages) => pages.filter((p) => p.id !== "home");

/** Split n links evenly around a centered logo; an odd count puts the extra on the right. */
function splitLinks<T>(items: T[]): [T[], T[]] {
  const left = Math.floor(items.length / 2);
  return [items.slice(0, left), items.slice(left)];
}

// ---- The header --------------------------------------------------------------

export function Header({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { open, setOpen, activeItem, setActiveItem } = useMenuState();
  const pages = navPages(designPages);
  const vid = getVariationId();
  const config = resolveData<HeaderConfig>(vid, "headerConfig", baseHeaderConfig);
  const skin = resolveData<HeaderSkin>(vid, "headerSkin", baseHeaderSkin);

  // Escape closes whichever menu is open, from anywhere in the header.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setActiveItem(null);
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveItem, setOpen]);

  const navProps = {
    pages, skin, activeItem, setActiveItem, onNavigate,
  };
  const hamburger = (
    <button
      data-header-hamburger={config.menuSide}
      onClick={() => setOpen(!open)}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className={cx("cursor-pointer @lg:hidden", skin.hamburger)}
    >
      {open ? <X size={22} /> : <Menu size={22} />}
    </button>
  );
  const cta = skin.cta ? (
    <button data-header-cta onClick={() => onNavigate("contact")} className={cx("cursor-pointer", skin.cta)}>
      Get in touch
    </button>
  ) : null;

  // THE PLACEMENT GRID. `left-right` and `left-center` are flex rows; `center-split`
  // is a three-column grid with `row-start-1` on EVERY cell — without it a
  // `col-start-2` logo declared after the `col-start-3` nav gets bumped to an
  // implicit second row (links on top, wordmark below), the classic centered-logo
  // bug. Written once here so no design can reintroduce it.
  let bar: React.ReactNode;
  if (config.placement === "center-split") {
    const [leftLinks, rightLinks] = splitLinks(pages);
    bar = (
      <div className={cx("grid grid-cols-[1fr_auto_1fr] items-center gap-6", skin.inner)}>
        <nav data-header-nav="left" className="col-start-1 row-start-1 hidden items-center justify-end gap-8 @lg:flex">
          <NavLinks {...navProps} pages={leftLinks} />
        </nav>
        <div className="col-start-2 row-start-1 flex items-center justify-center">
          <Logo skin={skin} onNavigate={onNavigate} />
        </div>
        <nav data-header-nav="right" className="col-start-3 row-start-1 hidden items-center justify-start gap-8 @lg:flex">
          <NavLinks {...navProps} pages={rightLinks} />
          {cta}
        </nav>
        {/* Below @lg the two navs are hidden, so the hamburger takes the side column
            its menuSide names and the logo stays centered. */}
        <div className={cx("row-start-1 flex items-center @lg:hidden", config.menuSide === "left" ? "col-start-1 justify-start" : "col-start-3 justify-end")}>
          {hamburger}
        </div>
      </div>
    );
  } else if (config.placement === "left-center") {
    bar = (
      <div className={cx("flex items-center justify-between gap-6", skin.inner)}>
        {config.menuSide === "left" && <div className="flex items-center @lg:hidden">{hamburger}</div>}
        <div className="flex items-center">
          <Logo skin={skin} onNavigate={onNavigate} />
        </div>
        {/* The nav is absolutely centered on the BAR, so it stays centered whatever
            the logo's width — `justify-center` on a flex sibling would only centre it
            in the space left over. */}
        <nav
          data-header-nav="center"
          className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-8 @lg:flex"
        >
          <span className="pointer-events-auto flex items-center gap-8">
            <NavLinks {...navProps} />
          </span>
        </nav>
        <div className="flex items-center gap-6">
          {cta}
          {config.menuSide === "right" && hamburger}
        </div>
      </div>
    );
  } else {
    bar = (
      <div className={cx("flex items-center justify-between gap-6", skin.inner)}>
        {config.menuSide === "left" && <div className="flex items-center @lg:hidden">{hamburger}</div>}
        <div className="flex items-center">
          <Logo skin={skin} onNavigate={onNavigate} />
        </div>
        <nav data-header-nav="right" className="hidden items-center gap-8 @lg:flex">
          <NavLinks {...navProps} />
          {cta}
        </nav>
        {config.menuSide === "right" && hamburger}
      </div>
    );
  }

  return (
    <header
      data-block="header"
      data-block-name="Header"
      data-header-placement={config.placement}
      data-header-menu-kind={config.menuKind}
      onMouseLeave={() => setActiveItem(null)}
      // Sticky by default (headerConfig.sticky) so the nav never scrolls away.
      // `sticky` + a high z establishes a stacking context ABOVE the page content,
      // so panels that overflow below the header are never hidden behind a later
      // section (the classic "menu isn't showing" bug). The drawer sits above this
      // (z-[70]/z-[80]) so it still covers the bar.
      className={cx(
        "relative z-[60] w-full",
        config.sticky && "sticky top-0",
        skin.bar,
      )}
    >
      {bar}

      {/* Dropdown + mega panels live at HEADER level so they anchor flush to the
          header's bottom edge under every placement. Only the active one opens
          (each is its own export block). */}
      {pages.map((p) => {
        const menu = menuFor(p.id);
        if (menu.kind === "mega")
          return <MegaPanel key={p.id} id={p.id} name={p.name} menu={menu} open={activeItem === p.id} skin={skin} mega={config.mega} onNavigate={onNavigate} />;
        if (menu.kind === "dropdown")
          return <DropdownPanel key={p.id} id={p.id} name={p.name} menu={menu} open={activeItem === p.id} skin={skin} onNavigate={onNavigate} />;
        return null;
      })}
    </header>
  );
}

/**
 * The mobile drawer, rendered by DesignSurface as a sibling of the Header (it is
 * an in-frame overlay that must sit above the bar). It is defined in THIS file so
 * the hamburger and the drawer can never disagree on `menuSide`; MobileMenu.tsx
 * re-exports it under its historical name so DesignSurface and any variation that
 * overrides only the Header keep resolving.
 */
export function HeaderDrawer({ onNavigate }: { onNavigate: (page: string) => void }) {
  const vid = getVariationId();
  return (
    <MobileDrawer
      skin={resolveData<HeaderSkin>(vid, "headerSkin", baseHeaderSkin)}
      config={resolveData<HeaderConfig>(vid, "headerConfig", baseHeaderConfig)}
      onNavigate={onNavigate}
    />
  );
}
