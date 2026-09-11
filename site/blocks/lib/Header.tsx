// ©2026 thinkany llc. All rights reserved.
// THE SITE'S HEADER — the same configured header the design surface renders,
// reading the site's own data (CORE tier: upgrades overwrite this file).
//
// Promote used to ask the model to re-author the header a SECOND time: fold the
// mobile menu in, swap menu.ts for the navItem schema, keep the logo-vs-wordmark
// branch, redo the placement grid. A second generative rewrite of the most
// mechanical component in the build, with a second chance to get it wrong. This
// removes that step: placement, panel anchoring, the drawer and hydration are code
// now, and promote only moves DATA (nav columns into content/site.json).
//
//   STRUCTURE → `@design-header-config`  (the pinned design's header.config.ts)
//   SKIN      → `@design-header-skin`    (the pinned design's header.skin.ts)
//   DATA      → the `nav` prop, from content/site.json, edited in the CMS
//
// Both aliases resolve in site/astro.config.mjs against the variation the site is
// pinned to, so the site's header IS the design's header: restyle the design and
// the next site build follows, with no promote step in between.
//
// WHAT DIFFERS FROM THE DESIGN SURFACE, and why:
//   • Data is the site's `navItem` schema (`links` = dropdown, `columns` = mega),
//     not menu.ts. Which panel an item opens is decided per item BY THE DATA, the
//     way the Navigation tab already models it, rather than by one global kind.
//   • Menu state is local `useState`, not a shared context: this block hydrates
//     alone (`hydrate: "load"`), nothing else on the page shares its state.
//   • The drawer is `fixed`, not pinned to a device frame: on the real site the
//     viewport IS the frame, so there is no useDrawerLock and no box math.
//   • `useIsoLayoutEffect`: the header is server-rendered first, and React warns
//     on useLayoutEffect there.
//   • Container queries become viewport breakpoints (`lg:`): the site has no
//     `@container` design surface wrapping it.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { z } from "astro/zod";
import { defineBlock, navItem, logosProp } from "../../src/lib/blocks";
import { headerConfig } from "@design-header-config";
import { headerSkin } from "@design-header-skin";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** The header renders on the server first; a layout effect there warns. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const MEGA_COLS: Record<number, string> = {
  2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5",
};

const props = z.object({
  siteName: z.string().default(""),
  logos: logosProp,
  nav: z.array(navItem).default([]),
});
type Props = z.infer<typeof props>;
type Item = Props["nav"][number];

/** Chevron, inline so the block pulls no icon runtime onto the site. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={cx("transition-transform", open && "rotate-180")}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function Burger({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></>}
    </svg>
  );
}

const isDropdown = (it: Item) => (it.links || []).length > 0 && !(it.columns || []).length;
const isMega = (it: Item) => (it.columns || []).length > 0;
const hasMenu = (it: Item) => isDropdown(it) || isMega(it);
/** A stable id per item, for the trigger/panel pairing and the capture markers. */
const itemId = (it: Item, i: number) =>
  (it.label || it.href || "").replace(/^[/#]+/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || `item-${i}`;

/**
 * The nav's own items, with HOME dropped: the logo is the home link, and a
 * separate "Home" item reads dated. The design surface filters it the same way
 * (navPages in src/app/components/Header.tsx), so the two agree; without this the
 * promoted site would grow a nav item the design never showed. A designer who
 * genuinely wants one gives it a different label.
 */
const navItems = (items: Item[]) =>
  items.filter((it) => !(/^home$/i.test((it.label || "").trim()) && (it.href === "/" || it.href === "" || /^#?$/.test(it.href))));

function DropdownPanel({ id, item, open, onClose }: { id: string; item: Item; open: boolean; onClose: () => void }) {
  // Positioned from its trigger, measured against the HEADER, exactly as the design
  // surface does it, so the panel opens under its item under every placement and
  // flips to right-aligned rather than spilling off the edge.
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number } | { right: number } | null>(null);
  useIsoLayoutEffect(() => {
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
      id={`menu-panel-${id}`}
      role="group"
      aria-label={`${item.label} menu`}
      {...(open ? { "data-menu-panel": id } : {})}
      style={pos ?? undefined}
      // `hidden`, not just a hidden class: out of the tab order and out of the
      // accessibility tree together, so nobody tabs into an off-screen menu.
      hidden={!open}
      className={cx("absolute top-full z-40 min-w-[220px] flex-col", headerSkin.panel, open ? "flex" : "hidden")}
    >
      {(item.links || []).map((l) => (
        <a key={`${l.href}${l.label}`} href={l.href} onClick={onClose}
          className={cx("no-underline", headerSkin.dropdownLink)}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

function MegaPanel({ id, item, open, onClose }: { id: string; item: Item; open: boolean; onClose: () => void }) {
  const columns = item.columns || [];
  // A column carrying `feature` renders as the featured panel (the site schema puts
  // it on the column; the design surface keeps it on the menu). Either way the
  // configured `mega.feature` decides whether it shows at all.
  const feature = headerConfig.mega.feature ? columns.find((c) => c.feature)?.feature : undefined;
  const plain = columns.filter((c) => !c.feature);
  return (
    <div
      id={`menu-panel-${id}`}
      role="group"
      aria-label={`${item.label} menu`}
      {...(open ? { "data-menu-panel": id } : {})}
      hidden={!open}
      className={cx("absolute inset-x-0 top-full z-40 mx-auto max-w-[1200px]",
        headerSkin.panel, headerSkin.panelInner, open ? "block" : "hidden")}
    >
      <div className={cx("grid grid-cols-1 gap-8", MEGA_COLS[headerConfig.mega.columns] ?? MEGA_COLS[4])}>
        {plain.map((c, i) => (
          <div key={c.heading || i}>
            {c.heading && <h4 className={cx("mb-3", headerSkin.columnHeading)}>{c.heading}</h4>}
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {(c.links || []).map((l) => (
                <li key={`${l.href}${l.label}`}>
                  <a href={l.href} onClick={onClose} className={cx("no-underline", headerSkin.columnLink)}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {feature && (
          <div className={headerSkin.feature}>
            {feature.image?.src && (
              <img src={feature.image.src} alt={feature.image.alt || ""} className="mb-3 w-full rounded object-cover" />
            )}
            <div className={cx("mb-2 opacity-60", headerSkin.columnHeading)}>Featured</div>
            {feature.title && <div className="font-ta-display text-lg text-ta-ink">{feature.title}</div>}
            {feature.text && <p className="mt-1 font-ta-sans text-sm text-ta-body">{feature.text}</p>}
            {feature.link && (
              <a href={feature.link.href} onClick={onClose} className={cx("mt-2 inline-block no-underline", headerSkin.columnLink)}>
                {feature.link.label}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Logo({ siteName, logos }: { siteName: string; logos: Props["logos"] }) {
  const src = logos?.header;
  const mobile = logos?.headerMobile;
  return (
    <a href="/" data-header-logo aria-label={siteName} className="flex items-center leading-none no-underline">
      {src ? (
        <>
          <img src={src} alt={siteName} className={cx(headerSkin.logo, mobile && "hidden sm:block")} />
          {mobile && <img src={mobile} alt={siteName} className={cx(headerSkin.logo, "sm:hidden")} />}
        </>
      ) : (
        <span className={headerSkin.wordmark}>{logos?.wordmark || siteName}</span>
      )}
    </a>
  );
}

function NavLinks({
  items, offset, active, setActive,
}: { items: Item[]; offset: number; active: string | null; setActive: (id: string | null) => void }) {
  // WCAG 2.1.1: a panel that opens on hover is never open for a keyboard user, so
  // ArrowDown opens it and moves in. Escape (on the header) closes and comes back.
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const trigger = e.currentTarget as HTMLElement;
    const tid = trigger.getAttribute("data-nav-link");
    if (e.key === "ArrowDown" && tid && trigger.getAttribute("aria-haspopup")) {
      e.preventDefault();
      setActive(tid);
      requestAnimationFrame(() => {
        document.getElementById(`menu-panel-${tid}`)?.querySelector<HTMLElement>("a, button")?.focus();
      });
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const nav = trigger.closest("header");
    const all = Array.from(nav?.querySelectorAll<HTMLElement>("[data-nav-link]") ?? []);
    const i = all.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length]?.focus();
  };
  return (
    <>
      {items.map((it, i) => {
        const id = itemId(it, i + offset);
        const menu = hasMenu(it);
        const open = active === id;
        return (
          <a
            key={id}
            href={it.href}
            data-nav-link={id}
            {...(menu ? {
              "data-menu-item": id, "aria-expanded": open, "aria-haspopup": "true",
              "aria-controls": `menu-panel-${id}`,
            } : {})}
            onMouseEnter={() => menu && setActive(id)}
            onFocus={() => setActive(menu ? id : null)}
            onKeyDown={onKeyDown}
            className={cx("flex items-center gap-1 no-underline", headerSkin.link, open && headerSkin.linkActive)}
          >
            {it.label}
            {menu && <Chevron open={open} />}
          </a>
        );
      })}
    </>
  );
}

/** Split evenly around a centred logo; an odd count puts the extra on the right. */
function splitItems(items: Item[]): [Item[], Item[]] {
  const left = Math.floor(items.length / 2);
  return [items.slice(0, left), items.slice(left)];
}

export function Header({ siteName, logos, nav }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const items = navItems(nav || []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const openId = active;
      setActive(null); setOpen(false);
      // Return focus to the trigger, so Escape is a way OUT rather than a way to
      // lose your place (WCAG 2.1.2).
      if (openId) document.querySelector<HTMLElement>(`[data-menu-item="${openId}"]`)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Lock the page behind the drawer (the site's viewport is the frame, so this is
  // the document, not a scroll container).
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  const left = headerConfig.menuSide === "left";
  const burger = (
    <button
      type="button"
      data-header-hamburger={headerConfig.menuSide}
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className={cx("cursor-pointer lg:hidden", headerSkin.hamburger)}
    >
      <Burger open={open} />
    </button>
  );

  const navProps = { active, setActive };
  let bar: React.ReactNode;
  if (headerConfig.placement === "center-split") {
    const [l, r] = splitItems(items);
    bar = (
      <div className={cx("grid grid-cols-[1fr_auto_1fr] items-center gap-6", headerSkin.inner)}>
        {/* row-start-1 on EVERY cell: without it a col-start-2 logo declared after the
            col-start-3 nav drops to an implicit second row. Written once, here. */}
        <nav data-header-nav="left" className="col-start-1 row-start-1 hidden items-center justify-end gap-8 lg:flex">
          <NavLinks items={l} offset={0} {...navProps} />
        </nav>
        <div className="col-start-2 row-start-1 flex items-center justify-center">
          <Logo siteName={siteName} logos={logos} />
        </div>
        <nav data-header-nav="right" className="col-start-3 row-start-1 hidden items-center justify-start gap-8 lg:flex">
          <NavLinks items={r} offset={l.length} {...navProps} />
        </nav>
        <div className={cx("row-start-1 flex items-center lg:hidden", left ? "col-start-1 justify-start" : "col-start-3 justify-end")}>
          {burger}
        </div>
      </div>
    );
  } else if (headerConfig.placement === "left-center") {
    bar = (
      <div className={cx("flex items-center justify-between gap-6", headerSkin.inner)}>
        {left && <div className="flex items-center lg:hidden">{burger}</div>}
        <div className="flex items-center"><Logo siteName={siteName} logos={logos} /></div>
        <nav data-header-nav="center" className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-8 lg:flex">
          <span className="pointer-events-auto flex items-center gap-8"><NavLinks items={items} offset={0} {...navProps} /></span>
        </nav>
        <div className="flex items-center gap-6">{!left && burger}</div>
      </div>
    );
  } else {
    bar = (
      <div className={cx("flex items-center justify-between gap-6", headerSkin.inner)}>
        {left && <div className="flex items-center lg:hidden">{burger}</div>}
        <div className="flex items-center"><Logo siteName={siteName} logos={logos} /></div>
        <nav data-header-nav="right" className="hidden items-center gap-8 lg:flex">
          <NavLinks items={items} offset={0} {...navProps} />
        </nav>
        {!left && burger}
      </div>
    );
  }

  return (
    <header
      data-block="header"
      data-header-placement={headerConfig.placement}
      onMouseLeave={() => setActive(null)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(null); }}
      className={cx("relative z-[60] w-full", headerConfig.sticky && "sticky top-0", headerSkin.bar)}
    >
      {bar}

      {/* Panels at HEADER level, so they anchor flush to its bottom edge whatever
          the placement. Which kind an item opens is decided by its DATA. */}
      {items.map((it, i) => {
        const id = itemId(it, i);
        if (isMega(it)) return <MegaPanel key={id} id={id} item={it} open={active === id} onClose={() => setActive(null)} />;
        if (isDropdown(it)) return <DropdownPanel key={id} id={id} item={it} open={active === id} onClose={() => setActive(null)} />;
        return null;
      })}

      {/* Mobile drawer — fixed to the viewport (the site has no device frame). */}
      <div className="lg:hidden" aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={cx("fixed inset-0 z-[70] bg-black/40 transition-opacity duration-300",
            open ? "opacity-100" : "pointer-events-none opacity-0")}
        />
        <nav
          data-menu-drawer={headerConfig.menuSide}
          className={cx("fixed inset-y-0 z-[80] flex w-[78%] max-w-[320px] flex-col transition-transform duration-300",
            left ? "left-0" : "right-0", headerSkin.drawer,
            open ? "translate-x-0" : `${left ? "-translate-x-full" : "translate-x-full"} pointer-events-none`)}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <span className={headerSkin.wordmark}>{logos?.wordmark || siteName}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
              className={cx("cursor-pointer", headerSkin.hamburger)}>
              <Burger open />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.map((it, i) => {
              const id = itemId(it, i);
              const sub = hasMenu(it);
              const isOpen = expanded.includes(id);
              const subLinks = isMega(it)
                ? (it.columns || []).flatMap((c) => c.links || [])
                : (it.links || []);
              return (
                <div key={id} className="border-t border-black/5 first:border-t-0">
                  <div className="flex items-stretch">
                    <a href={it.href} data-drawer-item={id} onClick={() => setOpen(false)}
                      className={cx("flex-1 px-6 py-4 no-underline", headerSkin.drawerLink)}>
                      {it.label}
                    </a>
                    {sub && (
                      <button type="button"
                        onClick={() => setExpanded((e) => e.includes(id) ? e.filter((x) => x !== id) : [...e, id])}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${it.label} menu`}
                        aria-expanded={isOpen}
                        className={cx("flex cursor-pointer items-center px-5", headerSkin.hamburger)}>
                        <Chevron open={isOpen} />
                      </button>
                    )}
                  </div>
                  {sub && (
                    <div className={cx("grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                      <div className="overflow-hidden">
                        <div className="pb-2">
                          {subLinks.map((l) => (
                            <a key={`${l.href}${l.label}`} href={l.href} data-drawer-sublink={id}
                              onClick={() => setOpen(false)}
                              className={cx("block px-8 py-2.5 no-underline", headerSkin.drawerSubLink)}>
                              {l.label}
                            </a>
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
    </header>
  );
}

/**
 * The chrome definition for the header above. `site/blocks/chrome.ts` (KEEP) wires
 * both: `export { Header, headerChrome } from "./lib/Header"` and
 * `export const chrome = { header: headerChrome }`. The layout imports Header BY
 * NAME so Astro can resolve its `client:load` directive.
 */
export const headerChrome = defineBlock({
  name: "Header",
  description: "The site header: logo, navigation, dropdown and mega panels, mobile drawer. Configured by the design's header.config.ts and styled by its header.skin.ts.",
  props,
  component: Header,
  hydrate: "load", // the one block that runs in the browser: menus + drawer
});
