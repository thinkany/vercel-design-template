// ©2026 thinkany llc. All rights reserved.
import { siteConfig } from "@/config/site";
import { footerLinks, legal, fillCopyright } from "@/app/footer";

/**
 * Global site footer — rendered for every WEBSITE design page by DesignSurface,
 * same wiring as Header. Single-source: edit here once, cascades to every page,
 * breakpoint, and variation (override per variation in
 * src/variations/{id}/components/). Responsive via `@container` (see Header).
 *
 * Its links are the footer's OWN (src/app/footer.ts), never the header menu:
 * the two are managed independently, in the design and later in the CMS. The
 * legal line (copyright + privacy / terms links) sits beneath.
 */
export function Footer({ onNavigate }: { onNavigate: (page: string) => void }) {
  const linkClass = "font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-body hover:text-ta-ink transition-colors cursor-pointer no-underline";
  const render = (l: { label: string; page?: string; href?: string }, cls: string) =>
    l.page ? (
      <button key={l.label + (l.page || "")} onClick={() => onNavigate(l.page!)} className={cls}>{l.label}</button>
    ) : (
      <a key={l.label + (l.href || "")} href={l.href || "#"} className={cls}>{l.label}</a>
    );

  return (
    <footer data-block="footer" data-block-name="Footer" className="w-full border-t border-black/10 bg-ta-surface px-6 py-8 @lg:px-10">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="flex flex-col gap-3">
          {/* Brand logo from the brief, when one was uploaded. */}
          {siteConfig.logo && (
            <img
              src={siteConfig.logo}
              alt={siteConfig.clientName}
              className="h-7 w-auto max-w-[160px] object-contain"
            />
          )}
        </div>
        {footerLinks.some((l) => l.links && l.links.length) ? (
          // Columns, in LIST ORDER: a headed item is a column; a run of plain links forms one where it sits.
          <nav className="grid gap-8 @lg:auto-cols-fr @lg:grid-flow-col">
            {footerLinks.reduce<{ heading?: typeof footerLinks[number]; links: typeof footerLinks }[]>((groups, it) => {
              if (it.links && it.links.length) groups.push({ heading: it, links: it.links });
              else { const last = groups[groups.length - 1]; if (last && !last.heading) last.links.push(it); else groups.push({ links: [it] }); }
              return groups;
            }, []).map((g, i) => (
              <div key={(g.heading ? g.heading.label : "links") + i} className="flex flex-col gap-2">
                {g.heading && (g.heading.href || g.heading.page
                  ? render(g.heading, "font-ta-sans text-[11px] tracking-[0.14em] uppercase text-ta-ink font-semibold cursor-pointer no-underline")
                  : <div className="font-ta-sans text-[11px] tracking-[0.14em] uppercase text-ta-ink font-semibold">{g.heading.label}</div>)}
                {g.links.map((l) => render(l, linkClass))}
              </div>
            ))}
          </nav>
        ) : (
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((l) => render(l, linkClass))}
          </nav>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-2 border-t border-black/5 pt-4 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted">{fillCopyright(legal.copyright)}</div>
        {legal.links.length > 0 && (
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {legal.links.map((l) => render(l, "font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted hover:text-ta-ink transition-colors cursor-pointer no-underline"))}
          </nav>
        )}
      </div>
    </footer>
  );
}
