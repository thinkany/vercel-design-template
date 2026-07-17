// ©2026 thinkany llc. All rights reserved.
import { designPages } from "../pages";
import { siteConfig } from "@/config/site";

/**
 * Global site footer — rendered for every WEBSITE design page by DesignSurface,
 * same wiring as Header. Single-source: edit here once, cascades to every page,
 * breakpoint, and variation (override per variation in
 * src/variations/{id}/components/). Responsive via `@container` (see Header).
 */
export function Footer({ onNavigate }: { onNavigate: (page: string) => void }) {
  const year = new Date().getFullYear();
  const pages = designPages;

  return (
    <footer data-block="footer" data-block-name="Footer" className="w-full border-t border-black/10 bg-ta-cream px-6 py-8 @lg:px-10">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-gray-mid">
          © {year} {siteConfig.clientName}
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => onNavigate(p.id)}
              className="font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-gray-dark hover:text-ta-ink transition-colors cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
