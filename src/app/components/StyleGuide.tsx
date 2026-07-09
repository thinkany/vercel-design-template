// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useEffect } from "react";
import { siteConfig } from "@/config/site";
import { resolveBrand } from "@/app/brandRegistry";
import type { BrandFont, PaletteGroup } from "@/styles/brand";

interface Props {
  onNavigate: (page: string) => void;
  // The active scope, so the styleguide renders THIS scope's brand manifest.
  // Defaults to the base (v00) when omitted.
  variationId?: string;
  // Whether this styleguide still needs setup (drives the banner). For the base
  // (v00) App derives this from VITE_STYLEGUIDE_READY; for a variation, from its
  // styleguideStatus.
  needsSetup?: boolean;
  // Present only for variations: marks this variation's styleguide "updated"
  // (clears the banner). Absent for the base, which uses /setup-styleguide.
  onMarkUpdated?: () => void;
  // Whether this scope's brand palette is still the template default (drives the
  // Colors notice). Base derives it from VITE_BRAND_READY; variation from brandStatus.
  brandNeedsSetup?: boolean;
  // Present only for variations: marks this variation's brand palette established
  // (clears the Colors notice). Absent for the base, which uses VITE_BRAND_READY.
  onMarkBrandEstablished?: () => void;
}

// ─── STYLE CONSTANTS ──────────────────────────────────────────────────────────

// Fonts & colors are read from the design tokens (src/styles/tokens.css) so the
// styleguide always reflects the project's single source of truth. Edit values
// in tokens.css, not here.
// PROJECT design fonts — what the styleguide DOCUMENTS and what the demo design
// components render in. Neutral placeholders until a project selects its fonts;
// edit the values in tokens.css (--ta-font-*), never here.
const F = {
  display: "var(--ta-font-display)",  // project display / headings
  serif: "var(--ta-font-serif)",      // project serif / long-form
  sans: "var(--ta-font-sans)",        // project sans / body & UI
  mono: "var(--ta-font-mono)",        // project mono / code
};

// ADMIN UI fonts — the styleguide's OWN chrome (titles, nav, labels, controls).
// Shared with the gated page and dashboard, kept SEPARATE from the project fonts
// above so the tooling stays consistent no matter which fonts a project picks.
const A = {
  heading: "var(--admin-font-heading)",  // DM Sans (700)
  body: "var(--admin-font-body)",        // Inter (300)
  mono: "var(--admin-font-mono)",        // DM Mono
};

const C = {
  blue: "var(--ta-blue)",
  red: "var(--ta-red)",
  cream: "var(--ta-cream)",
  ink: "var(--ta-ink)",
  dark: "var(--ta-gray-dark)",
  mid: "var(--ta-gray-mid)",
  light: "var(--ta-gray-light)",
  card: "#efefef",  // project-specific surface, no brand token
  white: "#ffffff",
};

// ADMIN UI colors — the styleguide's structural chrome (dividers, rules, nav,
// header, labels). Separate from the project palette above so the tooling keeps
// its colors even if a project renames or removes its --ta-* brand tokens; a
// designer retints the admin UI by editing --admin-* in tokens.css.
const CA = {
  blue: "var(--admin-blue)",
  red: "var(--admin-red)",
  cream: "var(--admin-cream)",
  ink: "var(--admin-ink)",
  dark: "var(--admin-gray-dark)",
  mid: "var(--admin-gray-mid)",
  light: "var(--admin-gray-light)",
  white: "#ffffff",
};

// Reads the computed values of CSS design tokens so the styleguide displays
// whatever tokens.css currently defines. Re-reads once shortly after mount to
// pick up any per-variation token stylesheet that loads asynchronously.
function useResolvedTokens(tokens: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const t of tokens) next[t] = cs.getPropertyValue(t).trim();
      setValues(next);
    };
    read();
    const id = window.setTimeout(read, 200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return values;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

// The brand palette (BRAND_COLORS) and type roles (FONT_FAMILIES) now come from
// the per-scope brand manifest (src/styles/brand.ts, resolved via resolveBrand)
// so each variation renders its own siloed palette. See the StyleGuide component.

// token: a CSS variable name (resolved live) or null for a hardcoded surface.
const SYSTEM_COLORS: { name: string; token: string | null; fallback: string; text: string }[] = [
  { name: "White",           token: "--background",       fallback: "#ffffff", text: C.ink },
  { name: "Muted",           token: "--muted",            fallback: "#ececf0", text: C.ink },
  { name: "Card Surface",    token: null,                 fallback: "#efefef", text: C.ink },
  { name: "Input BG",        token: "--input-background", fallback: "#f3f3f5", text: C.ink },
  { name: "Dark BG",         token: null,                 fallback: "#111111", text: "#fff" },
  { name: "Nav Dropdown BG", token: "--ta-cream",        fallback: "#f8f7f3", text: C.ink },
];

const TYPE_SCALE = [9, 10, 11, 12, 13, 14, 15, 16, 18, 21, 24, 28, 34];

const LINE_HEIGHTS = [
  { value: 1.1, label: "1.1", use: "Display headlines, tight hero titles" },
  { value: 1.2, label: "1.2", use: "Section headings, card titles" },
  { value: 1.3, label: "1.3", use: "Subheadings, sidebar titles" },
  { value: 1.4, label: "1.4", use: "Compact body text, excerpts" },
  { value: 1.5, label: "1.5 (base)", use: "Default body text — Source Serif 4" },
  { value: 1.8, label: "1.8", use: "Long-form prose, essay content" },
];

const SPACING_SCALE = [
  { scale: "0.5", px: 2,  tw: "p-0.5 / gap-0.5", use: "Micro gap — tight metadata stacks, star gaps" },
  { scale: "1",   px: 4,  tw: "p-1 / gap-1",     use: "Icon/text pairs, atom spacing" },
  { scale: "1.5", px: 6,  tw: "p-1.5 / gap-1.5", use: "Label rows, badge groups" },
  { scale: "2",   px: 8,  tw: "p-2 / gap-2",     use: "Compact item spacing" },
  { scale: "3",   px: 12, tw: "p-3 / gap-3",     use: "Card internal padding" },
  { scale: "3.5", px: 14, tw: "p-3.5",           use: "Compact card padding" },
  { scale: "4",   px: 16, tw: "p-4 / gap-4",     use: "Base unit — standard padding" },
  { scale: "5",   px: 20, tw: "p-5 / gap-5",     use: "Section gap" },
  { scale: "6",   px: 24, tw: "p-6 / gap-6",     use: "Column padding" },
  { scale: "7",   px: 28, tw: "p-7",             use: "Section top padding" },
  { scale: "8",   px: 32, tw: "p-8 / gap-8",     use: "Column gutter" },
  { scale: "10",  px: 40, tw: "p-10",            use: "Section vertical spacing" },
];

const STAR_RATINGS = [
  "★★★★★", "★★★★½", "★★★★", "★★★½", "★★★", "★★½", "★★", "★½", "★", "½",
];

const NAV_SECTIONS = [
  { id: "intro", label: "Introduction", group: null, isHeader: false },

  { id: null, label: "PRIMITIVES", group: null, isHeader: true },
  { id: "primitives-colors", label: "Colors", group: "prims", isHeader: false },
  { id: "primitives-spacing", label: "Spacing", group: "prims", isHeader: false },
  { id: "primitives-typography", label: "Typography", group: "prims", isHeader: false },
  { id: "primitives-semantic", label: "Semantic Types", group: "prims", isHeader: false },
  { id: "primitives-lineheight", label: "Line Height", group: "prims", isHeader: false },
  { id: "primitives-typescale", label: "Type Scale", group: "prims", isHeader: false },

  { id: null, label: "ATOMS", group: null, isHeader: true },
  { id: "atoms-buttons", label: "Buttons", group: "atoms", isHeader: false },
  { id: "atoms-badges", label: "Badges & Tags", group: "atoms", isHeader: false },
  { id: "atoms-forms", label: "Form Controls", group: "atoms", isHeader: false },
  { id: "atoms-icons", label: "Iconography", group: "atoms", isHeader: false },

  { id: null, label: "MOLECULES", group: null, isHeader: true },
  { id: "molecules-card", label: "Card", group: "mols", isHeader: false },

  { id: null, label: "ORGANISMS", group: null, isHeader: true },
  { id: "organisms-header", label: "Site Header", group: "orgs", isHeader: false },

  { id: null, label: "TEMPLATES", group: null, isHeader: true },
  { id: "templates-layout", label: "Page Layout", group: "templates", isHeader: false },

  { id: null, label: "PAGES", group: null, isHeader: true },
  { id: "pages", label: "Example Page", group: "pages", isHeader: false },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ borderTop: `3px solid ${CA.blue}`, margin: "64px 0 0" }} />;
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontFamily: A.body, fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: CA.blue, textTransform: "uppercase", marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h2 style={{ fontFamily: A.heading, fontSize: 28, fontWeight: 700, color: CA.ink, margin: "0 0 12px", lineHeight: 1.2 }}>
        {title}
      </h2>
      <p style={{ fontFamily: A.body, fontSize: 16, color: CA.dark, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
        {desc}
      </p>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: A.body, fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", color: CA.mid, textTransform: "uppercase", borderTop: `1px solid ${CA.light}`, paddingTop: 12, marginBottom: 20, marginTop: 40 }}>
      {children}
    </div>
  );
}

function DemoBox({ children, bg = CA.cream, pad = 32 }: { children: React.ReactNode; bg?: string; pad?: number }) {
  return (
    <div style={{ background: bg, padding: pad, borderRadius: 2, border: `1px solid rgba(0,0,0,0.06)`, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Token({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: A.mono, fontSize: 11, background: "#f0f0f0", color: CA.blue, padding: "2px 6px", borderRadius: 2 }}>
      {children}
    </code>
  );
}

function LevelBadge({ level }: { level: "primitive" | "atom" | "molecule" | "organism" | "template" | "page" }) {
  const map: Record<string, { bg: string; text: string }> = {
    primitive: { bg: "#6b46c1", text: "#fff" },
    atom:      { bg: CA.blue,   text: "#fff" },
    molecule:  { bg: "#0d7a55", text: "#fff" },
    organism:  { bg: CA.ink,    text: "#fff" },
    template:  { bg: "#a16207", text: "#fff" },
    page:      { bg: CA.red,    text: "#fff" },
  };
  const s = map[level];
  return (
    <span style={{ display: "inline-block", fontFamily: A.body, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", background: s.bg, color: s.text, padding: "3px 7px", borderRadius: 2, verticalAlign: "middle", marginLeft: 8 }}>
      {level}
    </span>
  );
}

// ─── ICONS ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
      <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="1" y="1" width="22" height="14" rx="2" /><line x1="8" y1="19" x2="16" y2="19" /><line x1="12" y1="15" x2="12" y2="19" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="12" height="20" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="1" y="1" width="12" height="20" rx="2" /><circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LetterboxdIcon() {
  return (
    <svg width="36" height="24" viewBox="0 0 54 36" fill="none">
      <circle cx="18" cy="18" r="17" fill={C.ink} />
      <circle cx="27" cy="18" r="17" fill={C.ink} fillOpacity="0.6" />
      <circle cx="36" cy="18" r="17" fill={C.ink} fillOpacity="0.3" />
    </svg>
  );
}

function BlueSkyIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 64 57" fill={C.ink}>
      <path d="M13.873 3.782C19.498 8.034 25.56 16.638 28 21.5c2.44-4.862 8.502-13.466 14.127-17.718C46.651 0.436 54 -1.09 54 6.5c0 1.5-.859 12.614-1.363 14.429-1.751 6.264-8.128 7.862-13.783 6.899 9.896 1.683 12.415 7.256 6.974 12.828C37.08 49.51 33.514 51 32 51s-5.08-1.49-13.828-10.344c-5.44-5.572-2.922-11.145 6.974-12.828-5.655.963-12.032-.635-13.783-6.899C10.859 19.114 10 8 10 6.5c0-7.59 7.348-6.064 3.873-2.718z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={C.ink}>
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

// A light swatch (dark overlay text) gets a hairline border so it reads against
// the page. Derived from the manifest `text` field — works for any light color,
// not just cream.
function isLightSwatch(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t !== "#ffffff" && t !== "#fff";
}

function ColorsSection({ groups, brandNeedsSetup, onMarkBrandEstablished }: {
  groups: PaletteGroup[];
  brandNeedsSetup?: boolean;
  onMarkBrandEstablished?: () => void;
}) {
  const brandColors = groups.flatMap((g) => g.colors);
  const brandCount = brandColors.length;
  const resolved = useResolvedTokens([
    ...brandColors.map((c) => c.token),
    ...SYSTEM_COLORS.map((c) => c.token).filter((t): t is string => Boolean(t)),
  ]);
  return (
    <section id="primitives-colors" data-sg-section="primitives-colors">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Colors"
          desc={`The ${siteConfig.clientName} palette consists of ${brandCount} brand token${brandCount === 1 ? "" : "s"}${groups.length > 1 ? ` across ${groups.length} groups` : ""} and ${SYSTEM_COLORS.length} system tokens. All colors should be referenced by CSS variable — never hardcoded hex values in component files.`}
        />

        {brandNeedsSetup && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", border: `1px solid ${CA.light}`, background: CA.cream, borderRadius: 3, padding: "12px 16px", marginBottom: 24 }}>
            <div style={{ fontFamily: A.body, fontSize: 13, color: CA.dark, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600 }}>Template default palette.</strong> This scope's brand hasn't been established yet — run <Token>/setup-styleguide</Token> to set its <Token>--ta-*</Token> colors.
            </div>
            {onMarkBrandEstablished && (
              <button
                onClick={onMarkBrandEstablished}
                style={{ flexShrink: 0, background: CA.blue, color: "#fff", border: "none", borderRadius: 3, padding: "7px 14px", fontFamily: A.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Mark brand established
              </button>
            )}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.title}>
            <SubHead>{group.title}</SubHead>
            {group.description && (
              <div style={{ fontFamily: A.body, fontSize: 13, color: CA.mid, lineHeight: 1.5, margin: "-4px 0 16px" }}>{group.description}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
              {group.colors.map((c) => (
                <div key={c.token}>
                  <div style={{ background: `var(${c.token})`, height: 80, borderRadius: 2, marginBottom: 10, border: isLightSwatch(c.text) ? "1px solid #ddd" : "none" }} />
                  <div style={{ fontFamily: A.body, fontSize: 13, fontWeight: 500, color: CA.ink, marginBottom: 2 }}>{c.name}</div>
                  <Token>{c.token}</Token>
                  <div style={{ fontFamily: A.mono, fontSize: 11, color: CA.mid, marginTop: 4 }}>{resolved[c.token] || c.value}</div>
                  <div style={{ fontFamily: A.body, fontSize: 12, color: CA.mid, marginTop: 3, lineHeight: 1.4 }}>{c.role}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <SubHead>System Palette</SubHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {SYSTEM_COLORS.map((c) => {
            const bg = c.token ? `var(${c.token})` : c.fallback;
            const shown = c.token ? (resolved[c.token] || c.fallback) : c.fallback;
            return (
              <div key={c.name}>
                <div style={{ background: bg, height: 56, borderRadius: 2, marginBottom: 8, border: "1px solid rgba(0,0,0,0.08)" }} />
                <div style={{ fontFamily: A.body, fontSize: 12, fontWeight: 500, color: CA.ink, marginBottom: 2 }}>{c.name}</div>
                <Token>{c.token ?? "(hardcoded)"}</Token>
                <div style={{ fontFamily: A.mono, fontSize: 11, color: CA.mid, marginTop: 4 }}>{shown}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SpacingSection() {
  return (
    <section id="primitives-spacing" data-sg-section="primitives-spacing">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Spacing Scale"
          desc="Based on Tailwind 4's 4px grid. All padding, margin, and gap values in new code should use these Tailwind utilities. Arbitrary pixel values should only appear in legacy inline styles pending Phase 4 cleanup."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SPACING_SCALE.map((s) => (
            <div key={s.px} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontFamily: A.mono, fontSize: 11, color: CA.mid, width: 28, textAlign: "right", flexShrink: 0 }}>{s.px}px</div>
              <div style={{ background: CA.blue, height: 20, width: s.px * 4, minWidth: 2, borderRadius: 1, flexShrink: 0 }} />
              <div style={{ fontFamily: A.mono, fontSize: 11, color: CA.blue, width: 120, flexShrink: 0 }}>{s.tw}</div>
              <div style={{ fontFamily: A.body, fontSize: 13, color: CA.mid }}>{s.use}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Extracts the primary family name from a font-family stack, e.g.
// "'Inter', system-ui, sans-serif" → "Inter".
function fontName(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

// The project's selected typefaces, shown as named specimens. This is the one
// primitives section (alongside Type Scale, Line Height, Semantic Types) that
// intentionally renders each family in its own voice — name, pangram, and
// ligatures — so the chosen type is visible "in action." Everything else on the
// styleguide sticks to the gated-screen pairing: Display headings + Sans body.
// Empty until the styleguide has been configured for this project.
function TypographySection({ fonts, needsSetup }: { fonts: BrandFont[]; needsSetup?: boolean }) {
  const resolvedFonts = useResolvedTokens(fonts.map((f) => f.token));
  const selected = !needsSetup;
  return (
    <section id="primitives-typography" data-sg-section="primitives-typography">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Typography"
          desc={
            selected
              ? `The typefaces selected for ${siteConfig.clientName}. Each role maps to a CSS variable — reference it by token, never by font name. Headings use Display; body copy uses Sans.`
              : "The project's typefaces appear here once they've been selected. Set them in tokens.css (or run /setup-styleguide) and their specimens will populate this section."
          }
        />
        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {fonts.map((ff) => {
              const stack = resolvedFonts[ff.token] || ff.stack;
              return (
                <DemoBox key={ff.name} bg={C.white} pad={28}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                    <div>
                      <div style={{ fontFamily: A.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: CA.blue, textTransform: "uppercase", marginBottom: 6 }}>{ff.name} · {ff.role}</div>
                      <Token>{ff.token}</Token>
                    </div>
                    <div style={{ fontFamily: ff.stack, fontSize: 34, color: C.ink, lineHeight: 1 }}>{fontName(stack)}</div>
                  </div>
                  <div style={{ fontFamily: ff.stack, fontSize: 22, color: C.ink, lineHeight: 1.3, marginBottom: 14 }}>
                    The quick brown fox jumps over the lazy dog
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 28px" }}>
                    <span style={{ fontFamily: ff.stack, fontSize: 18, color: C.dark }}>ABCDEFGHIJKLM · abcdefghijklm · 0123456789</span>
                    <span style={{ fontFamily: ff.stack, fontSize: 18, color: C.mid }}>fi fl ffi ffl — Waffle office affluent</span>
                  </div>
                </DemoBox>
              );
            })}
          </div>
        ) : (
          <div style={{ border: `1px dashed ${CA.light}`, borderRadius: 2, padding: "56px 32px", textAlign: "center", background: CA.cream }}>
            <div style={{ fontFamily: A.heading, fontSize: 24, fontWeight: 700, color: CA.mid, marginBottom: 10 }}>No typeface selected yet</div>
            <div style={{ fontFamily: A.body, fontSize: 14, color: CA.mid, lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
              Choose the project's fonts in <Token>tokens.css</Token> — or run <Token>/setup-styleguide</Token> — and their specimens will appear here.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TypeScaleSection({ fonts }: { fonts: BrandFont[] }) {
  const resolvedFonts = useResolvedTokens(fonts.map((f) => f.token));
  return (
    <section id="primitives-typescale" data-sg-section="primitives-typescale">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Type Scale"
          desc={`${TYPE_SCALE.length} type sizes form the visual scale. Each is shown across all ${fonts.length} ${siteConfig.clientName} font families to illustrate how the same size reads differently at each voice.`}
        />

        {fonts.map((ff) => (
          <div key={ff.name} style={{ marginBottom: 48 }}>
            <SubHead>{ff.name} — {ff.role}</SubHead>
            <div style={{ fontFamily: A.mono, fontSize: 11, color: CA.mid, marginBottom: 10 }}>{ff.token} → {fontName(resolvedFonts[ff.token] || ff.stack)}</div>
            <DemoBox bg={C.white} pad={24}>
              {TYPE_SCALE.map((size) => (
                <div key={size} style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
                  <span style={{ fontFamily: A.mono, fontSize: 10, color: CA.mid, width: 28, flexShrink: 0, textAlign: "right" }}>{size}</span>
                  <span style={{ fontFamily: ff.stack, fontSize: size, color: C.ink, lineHeight: 1.2 }}>{ff.sample}</span>
                </div>
              ))}
            </DemoBox>
          </div>
        ))}
      </div>
    </section>
  );
}

function LineHeightSection() {
  return (
    <section id="primitives-lineheight" data-sg-section="primitives-lineheight">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Line Height"
          desc="Line height controls reading comfort. Tight values suit headlines; looser values support long-form prose. The base body line-height is 1.5."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {LINE_HEIGHTS.map((lh) => (
            <div key={lh.value} style={{ display: "grid", gridTemplateColumns: "80px 1fr 220px", gap: 24, padding: "20px 0", borderBottom: "1px solid rgba(0,0,0,0.06)", alignItems: "start" }}>
              <div style={{ fontFamily: A.mono, fontSize: 13, color: CA.blue, fontWeight: 500 }}>{lh.label}</div>
              <div style={{ fontFamily: F.serif, fontSize: 15, color: C.ink, lineHeight: lh.value }}>
                Line height sets the vertical rhythm of running text. Tighter values suit large headings; looser values give long-form body copy room to breathe and stay comfortable to read across a full measure.
              </div>
              <div style={{ fontFamily: A.body, fontSize: 12, color: CA.mid, paddingTop: 2, lineHeight: 1.5 }}>{lh.use}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SemanticTypesSection() {
  return (
    <section id="primitives-semantic" data-sg-section="primitives-semantic">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Primitives · Sub-Atomic Tokens"
          title="Semantic Types"
          desc={`Semantic typographic roles assign specific font, size, weight, and color to HTML elements. These rules should be consistent across all ${siteConfig.clientName} pages.`}
        />
        <DemoBox bg={C.white} pad={40}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { tag: "h1", size: 34, family: F.display, weight: 700, color: C.ink,  lh: 1.1, text: "Primary page heading" },
              { tag: "h2", size: 24, family: F.display, weight: 700, color: C.ink,  lh: 1.2, text: "Section heading" },
              { tag: "h3", size: 21, family: F.display, weight: 700, color: C.ink,  lh: 1.2, text: "Subsection heading" },
              { tag: "h4", size: 18, family: F.display, weight: 600, color: C.ink,  lh: 1.3, text: "Group label" },
              { tag: "h5", size: 15, family: F.display, weight: 600, color: C.ink,  lh: 1.3, text: "Minor heading" },
              { tag: "h6", size: 13, family: F.sans,     weight: 500, color: C.dark, lh: 1.4, text: "OVERLINE · JUNE 2026" },
              { tag: "p",  size: 15, family: F.serif,    weight: 400, color: C.dark, lh: 1.6, text: "Body copy sets the reading rhythm for long-form content — comfortable measure, generous line height, and a serif voice tuned for sustained reading." },
              { tag: "caption", size: 12, family: F.sans, weight: 400, color: C.mid, lh: 1.4, text: "Byline · June 24, 2026" },
            ].map(({ tag, size, family, weight, color, lh, text }) => (
              <div key={tag} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 20, padding: "14px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "baseline" }}>
                <Token>&lt;{tag}&gt;</Token>
                <div style={{ fontFamily: family, fontSize: size, fontWeight: weight, color, lineHeight: lh }}>{text}</div>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 20, padding: "14px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", alignItems: "baseline" }}>
              <Token>&lt;a&gt;</Token>
              <a href="#" style={{ fontFamily: F.serif, fontSize: 14, color: C.blue, textDecoration: "none" }} onClick={(e) => e.preventDefault()}>
                READ MORE →
              </a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 20, padding: "14px 0", alignItems: "baseline" }}>
              <Token>&lt;code&gt;</Token>
              <code style={{ fontFamily: F.mono, fontSize: 13, color: C.blue, background: "#f0f0f0", padding: "2px 6px", borderRadius: 2 }}>--ta-blue</code>
            </div>
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────

function ButtonsSection() {
  return (
    <section id="atoms-buttons" data-sg-section="atoms-buttons">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Atoms"
          title={<>Buttons <LevelBadge level="atom" /></>  as any}
          desc="Buttons appear in three variants: filled (primary action), outlined (secondary), and ghost (tertiary / navigation). DM Sans uppercase with 0.1em letter-spacing."
        />

        <SubHead>Primary — Filled</SubHead>
        <DemoBox>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <button style={{ background: C.blue, color: "#fff", border: "none", padding: "10px 24px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>PRIMARY ACTION</button>
            <button style={{ background: C.red, color: "#fff", border: "none", padding: "10px 24px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>SECONDARY ACTION</button>
            <button style={{ background: C.ink, color: "#fff", border: "none", padding: "10px 24px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>TERTIARY ACTION →</button>
            <button disabled style={{ background: C.light, color: C.mid, border: "none", padding: "10px 24px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "not-allowed", borderRadius: 2 }}>DISABLED</button>
          </div>
        </DemoBox>

        <SubHead>Secondary — Outlined</SubHead>
        <DemoBox>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <button style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, padding: "9px 22px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>OUTLINED BUTTON</button>
            <button style={{ background: "transparent", color: C.ink, border: `1px solid ${C.ink}`, padding: "9px 22px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>SECONDARY ACTION</button>
            <button style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", padding: "9px 22px", fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>ON DARK →</button>
          </div>
        </DemoBox>

        <SubHead>Ghost / Nav — Text Only</SubHead>
        <DemoBox bg={C.white}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
            <button style={{ background: "none", border: "none", padding: "0 0 4px", fontFamily: F.sans, fontSize: 15, fontWeight: 500, letterSpacing: "0.12em", color: C.dark, borderBottom: "2px solid transparent", cursor: "pointer" }}>NAV LINK</button>
            <button style={{ background: "none", border: "none", padding: "0 0 4px", fontFamily: F.sans, fontSize: 15, fontWeight: 500, letterSpacing: "0.12em", color: C.blue, borderBottom: `2px solid ${C.blue}`, cursor: "pointer" }}>ACTIVE LINK</button>
            <button style={{ background: "none", border: "none", padding: 0, fontFamily: F.sans, fontSize: 13, fontWeight: 400, color: C.blue, cursor: "pointer", textDecoration: "none", letterSpacing: "0.04em" }}>TEXT LINK →</button>
            <button style={{ background: "none", border: "none", padding: 0, fontFamily: F.sans, fontSize: 13, fontWeight: 400, color: C.mid, cursor: "pointer", letterSpacing: "0.04em", textDecoration: "underline" }}>UNDERLINED LINK →</button>
          </div>
        </DemoBox>

        <SubHead>Pagination</SubHead>
        <DemoBox bg={C.white}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[1, 2, 3, "...", 12].map((n, i) => (
              <button key={i} style={{ background: n === 1 ? C.blue : "transparent", color: n === 1 ? "#fff" : C.dark, border: `1px solid ${n === 1 ? C.blue : C.light}`, width: 36, height: 36, fontFamily: F.sans, fontSize: 13, cursor: "pointer", borderRadius: 2 }}>
                {n}
              </button>
            ))}
            <button style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, padding: "0 14px", height: 36, fontFamily: F.sans, fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>NEXT →</button>
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

function BadgesSection() {
  return (
    <section id="atoms-badges" data-sg-section="atoms-badges">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Atoms"
          title={<>Badges & Tags <LevelBadge level="atom" /></> as any}
          desc="Small labeled elements that categorize, flag, or label content. Category tags use brand blue; NEW badges use accent red. All use DM Sans uppercase."
        />

        <SubHead>Category Tags</SubHead>
        <DemoBox>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["CATEGORY", "FEATURE", "GUIDE", "UPDATE", "RESOURCE", "NOTE"].map((cat) => (
              <span key={cat} style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#fff", background: C.blue, padding: "3px 8px", borderRadius: 2 }}>{cat}</span>
            ))}
          </div>
        </DemoBox>

        <SubHead>Alert / Status Badges</SubHead>
        <DemoBox>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#fff", background: C.red, padding: "3px 8px", borderRadius: 2 }}>NEW</span>
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#fff", background: C.blue, padding: "3px 8px", borderRadius: 2 }}>FEATURED</span>
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: C.blue, background: "transparent", border: `1px solid ${C.blue}`, padding: "2px 7px", borderRadius: 2 }}>TAG</span>
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: C.mid, background: "transparent", border: `1px solid ${C.light}`, padding: "2px 7px", borderRadius: 2 }}>MUTED TAG</span>
          </div>
        </DemoBox>

        <SubHead>Section Labels (Border-top style)</SubHead>
        <DemoBox bg={C.white}>
          {["LATEST", "FEATURED", "MOST RECENT", "POPULAR", "BROWSE ALL"].map((label) => (
            <div key={label} style={{ borderTop: `3px solid ${C.blue}`, paddingTop: 10, marginBottom: 24, fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: C.dark, textTransform: "uppercase" as const }}>
              {label}
            </div>
          ))}
        </DemoBox>
      </div>
    </section>
  );
}

function FormControlsSection() {
  return (
    <section id="atoms-forms" data-sg-section="atoms-forms">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Atoms"
          title={<>Form Controls <LevelBadge level="atom" /></> as any}
          desc="Inputs use transparent backgrounds with visible borders. The search control pairs an input with an inline icon. Newsletter inputs appear on dark backgrounds."
        />

        <SubHead>Standard Text Input</SubHead>
        <DemoBox bg={C.white}>
          <input type="text" placeholder="Enter email address" style={{ width: 280, padding: "8px 12px", fontFamily: F.sans, fontSize: 14, color: C.ink, background: "transparent", border: `1px solid ${C.light}`, borderRadius: 2, outline: "none" }} />
        </DemoBox>

        <SubHead>Search Input</SubHead>
        <DemoBox bg={C.white}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.light}`, padding: "6px 12px", borderRadius: 2, width: 240, background: "transparent" }}>
            <SearchIcon />
            <input type="search" placeholder="Search…" style={{ border: "none", outline: "none", fontFamily: F.sans, fontSize: 13, color: C.ink, background: "transparent", width: "100%" }} />
          </div>
        </DemoBox>

        <SubHead>Newsletter Input (Dark Background)</SubHead>
        <DemoBox bg={C.ink} pad={32}>
          <div style={{ display: "flex", gap: 10 }}>
            <input type="email" placeholder="your@email.com" style={{ flex: 1, padding: "9px 14px", fontFamily: F.sans, fontSize: 14, color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, outline: "none" }} />
            <button style={{ background: C.blue, color: "#fff", border: "none", padding: "9px 20px", fontFamily: F.sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 2 }}>SUBSCRIBE</button>
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

function IconographySection() {
  const icons = [
    { name: "Search",     el: <SearchIcon /> },
    { name: "Chevron",    el: <ChevronIcon /> },
    { name: "Desktop",    el: <DesktopIcon /> },
    { name: "Mobile",     el: <MobileIcon /> },
    { name: "Bluesky",    el: <BlueSkyIcon /> },
    { name: "LinkedIn",   el: <LinkedInIcon /> },
  ];

  return (
    <section id="atoms-icons" data-sg-section="atoms-icons">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Atoms"
          title={<>Iconography <LevelBadge level="atom" /></> as any}
          desc="All icons are inline SVG — no external icon library. UI icons (search, chevron, view-toggle) use clean strokes at 1.6–1.8px stroke width; swap in your project's own icon set."
        />
        <DemoBox bg={C.white}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {icons.map(({ name, el }) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 32px", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ color: C.ink }}>{el}</div>
                <div style={{ fontFamily: A.body, fontSize: 10, color: CA.mid, letterSpacing: "0.08em" }}>{name.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

// ─── MOLECULES ────────────────────────────────────────────────

function CardSection() {
  return (
    <section id="molecules-card" data-sg-section="molecules-card">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Molecules"
          title={<>Card <LevelBadge level="molecule" /></> as any}
          desc="A generic content card — a starting-point molecule combining atoms (media, heading, meta, body, action). Duplicate or replace it with your project's real components."
        />
        <DemoBox bg={C.white} pad={32}>
          <div style={{ maxWidth: 320, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 3, overflow: "hidden", background: C.white }}>
            <div style={{ height: 150, background: C.card }} />
            <div style={{ padding: "16px 18px 18px" }}>
              <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: C.blue, textTransform: "uppercase", marginBottom: 8 }}>Category</div>
              <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.2, marginBottom: 8 }}>Card heading goes here</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.dark, lineHeight: 1.6, marginBottom: 14 }}>A short supporting description showing how body copy sits within the card at the chosen type scale.</div>
              <button style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.blue, background: "transparent", border: `1px solid ${C.blue}`, padding: "6px 14px", borderRadius: 2, cursor: "pointer" }}>READ MORE →</button>
            </div>
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

// ─── ORGANISMS ───────────────────────────────────────────────

function HeaderSection() {
  return (
    <section id="organisms-header" data-sg-section="organisms-header">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Organisms"
          title={<>Site Header <LevelBadge level="organism" /></> as any}
          desc="A generic site header — a starting-point organism assembled from atoms (wordmark, nav, action). Replace it with your project's real page sections (header, hero, footer, grids)."
        />
        <DemoBox bg={C.white} pad={0}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${C.light}` }}>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{siteConfig.clientName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {["Home", "About", "Work", "Contact"].map((l) => (
                <span key={l} style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", color: C.dark }}>{l}</span>
              ))}
              <button style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: C.blue, border: "none", padding: "8px 16px", borderRadius: 2, cursor: "pointer" }}>Get in touch</button>
            </div>
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

// ─── TEMPLATES ───────────────────────────────────────────────

function PageLayoutSection() {
  const block = (label: string, h: number) => (
    <div style={{ background: C.cream, border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 2, height: h, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: C.mid, textTransform: "uppercase" }}>{label}</div>
  );
  return (
    <section id="templates-layout" data-sg-section="templates-layout">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Templates"
          title={<>Page Layout <LevelBadge level="template" /></> as any}
          desc="A generic page-layout wireframe — organisms sequenced into a structure with no real content. Replace it with your project's real templates."
        />
        <DemoBox bg={C.white} pad={24}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
            {block("Header", 48)}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 2 }}>{block("Main content", 200)}</div>
              <div style={{ flex: 1 }}>{block("Sidebar", 200)}</div>
            </div>
            {block("Footer", 64)}
          </div>
        </DemoBox>
      </div>
    </section>
  );
}

// ─── PAGES ───────────────────────────────────────────────────

function ExamplePageSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section id="pages" data-sg-section="pages">
      <Divider />
      <div style={{ paddingTop: 48 }}>
        <SectionTitle
          eyebrow="Pages"
          title={<>Pages <LevelBadge level="page" /></> as any}
          desc="Pages are templates populated with real content. This generic example stands in for your project's pages — replace it, and wire real routes into the app."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden", background: C.white }}>
            <div style={{ background: C.blue, padding: "10px 16px" }}>
              <div style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>Example</div>
              <div style={{ fontFamily: F.display, fontSize: 16, color: "#fff", fontWeight: 700 }}>Home</div>
            </div>
            <div style={{ padding: "16px 16px 14px" }}>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 14 }}>A generic landing page assembled from the template above. Replace it with your project's real page.</div>
              <button onClick={() => onNavigate("home")} style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: C.blue, background: "transparent", border: `1px solid ${C.blue}`, padding: "5px 14px", borderRadius: 2, cursor: "pointer" }}>
                VIEW PAGE →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function StyleGuide({ onNavigate, variationId, needsSetup, onMarkUpdated, brandNeedsSetup, onMarkBrandEstablished }: Props) {
  const [activeId, setActiveId] = useState("intro");
  // This scope's siloed brand palette & type roles (falls back to the base).
  const brand = resolveBrand(variationId ?? "v00");

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-sg-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute("data-sg-section") || "");
          }
        });
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string | null) => {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: "100vh", background: CA.white, fontFamily: A.body, fontWeight: 300 }}>

      {/* STYLEGUIDE SETUP BANNER — base uses VITE_STYLEGUIDE_READY; a variation
          uses its own styleguideStatus and offers a "Mark as updated" action. */}
      {needsSetup && (
        <div style={{ background: "#fef3c7", borderBottom: "1px solid #f0d488", padding: "12px 48px", display: "flex", alignItems: "flex-start", gap: 12, fontFamily: A.body, fontSize: 13, color: "#663d00", lineHeight: 1.55 }}>
          <span style={{ fontSize: 15, lineHeight: 1.2 }}>⚙</span>
          <span style={{ flex: 1 }}>
            {onMarkUpdated ? (
              <>
                <strong>This variation inherited the base styleguide.</strong> Update its tokens and sections for this variation as needed, then mark it done to clear this notice.
              </>
            ) : (
              <>
                <strong>This styleguide isn't configured yet.</strong> Set your fonts &amp; colors and adapt the example sections for this project <em>before</em> designing — run{" "}
                <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 3, fontFamily: A.mono, fontSize: 12 }}>/setup-styleguide</code>.
                {" "}Clear this notice by setting{" "}
                <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 3, fontFamily: A.mono, fontSize: 12 }}>VITE_STYLEGUIDE_READY=true</code>{" "}in <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 3, fontFamily: A.mono, fontSize: 12 }}>.env</code>.
              </>
            )}
          </span>
          {onMarkUpdated && (
            <button
              onClick={onMarkUpdated}
              style={{ flexShrink: 0, background: "#663d00", color: "#fff", border: "none", borderRadius: 3, padding: "6px 12px", fontFamily: A.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Mark as updated
            </button>
          )}
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{ background: CA.ink, borderBottom: `3px solid ${CA.blue}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: A.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: "#fff", marginBottom: 6, textTransform: "uppercase" }}>{siteConfig.clientName}</div>
            <h1 style={{ fontFamily: A.heading, fontSize: 28, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.1 }}>{siteConfig.isBranded && siteConfig.projectName ? siteConfig.projectName : "Design System"}</h1>
            <div style={{ fontFamily: A.body, fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6, fontStyle: "italic" }}>
              Atomic Design System
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => onNavigate("dashboard")}
              style={{ fontFamily: A.body, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 18px", borderRadius: 2, cursor: "pointer" }}
            >
              ← DASHBOARD
            </button>
            <button
              onClick={() => onNavigate("home")}
              style={{ fontFamily: A.body, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 18px", borderRadius: 2, cursor: "pointer" }}
            >
              ← BACK TO SITE
            </button>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div style={{ display: "flex", maxWidth: 1280, margin: "0 auto" }}>

        {/* LEFT NAV */}
        <nav style={{ width: 220, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", background: CA.cream, borderRight: "1px solid rgba(0,0,0,0.06)", padding: "32px 0 80px" }}>
          {NAV_SECTIONS.map((item, i) => {
            if (item.isHeader) {
              return (
                <div key={i} style={{ fontFamily: A.body, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: CA.mid, padding: "20px 24px 6px", borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none", marginTop: i > 0 ? 8 : 0 }}>
                  {item.label}
                </div>
              );
            }
            const isActive = item.id === activeId;
            return (
              <button
                key={i}
                onClick={() => scrollTo(item.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "7px 24px 7px 28px",
                  fontFamily: A.body, fontSize: 13, fontWeight: isActive ? 500 : 400,
                  color: isActive ? CA.blue : CA.dark,
                  background: isActive ? "rgba(30,75,150,0.06)" : "transparent",
                  border: "none", borderLeft: `2px solid ${isActive ? CA.blue : "transparent"}`,
                  cursor: "pointer", letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* CONTENT */}
        <main style={{ flex: 1, minWidth: 0, padding: "48px 64px 120px" }}>

          {/* INTRO */}
          <section id="intro" data-sg-section="intro">
            <div style={{ maxWidth: 680 }}>
              <div style={{ fontFamily: A.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: CA.blue, marginBottom: 12 }}>INTRODUCTION</div>
              <h1 style={{ fontFamily: A.heading, fontSize: 40, fontWeight: 700, color: CA.ink, lineHeight: 1.1, margin: "0 0 20px" }}>
                The {siteConfig.clientName} Design System
              </h1>
              <p style={{ fontFamily: A.body, fontSize: 16, color: CA.dark, lineHeight: 1.7, marginBottom: 16 }}>
                This system follows <strong>Brad Frost's Atomic Design</strong> methodology, extended downward with a <em>Primitives</em> (sub-atomic) layer that defines the raw tokens all atoms are built from.
              </p>
              <p style={{ fontFamily: A.body, fontSize: 16, color: CA.dark, lineHeight: 1.7, marginBottom: 24 }}>
                The hierarchy flows: <strong>Primitives → Atoms → Molecules → Organisms → Templates → Pages.</strong> Each level builds exclusively from the level below it. No organism should contain a hard-coded color value that isn't a CSS variable from the Primitives layer.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { level: "Primitives", badge: "#6b46c1", desc: "Raw design tokens: colors, spacing, type scale, line heights. The sub-atomic layer." },
                  { level: "Atoms",      badge: CA.blue,    desc: "Single-purpose UI units: buttons, badges, form inputs, icons." },
                  { level: "Molecules",  badge: "#0d7a55", desc: "Purposeful combinations of atoms, e.g. a content card." },
                  { level: "Organisms",  badge: CA.ink,     desc: "Standalone page sections, e.g. a site header, hero, or footer." },
                  { level: "Templates",  badge: "#a16207", desc: "Page layout wireframes: column structure and organism sequencing, no real content." },
                  { level: "Pages",      badge: CA.red,     desc: "Specific instances of templates populated with real content." },
                ].map(({ level, badge, desc }) => (
                  <div key={level} style={{ background: CA.cream, padding: "16px", borderRadius: 2, borderTop: `3px solid ${badge}` }}>
                    <div style={{ fontFamily: A.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: badge, marginBottom: 6 }}>{level.toUpperCase()}</div>
                    <div style={{ fontFamily: A.body, fontSize: 13, color: CA.dark, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTIONS */}
          <ColorsSection groups={brand.paletteGroups} brandNeedsSetup={brandNeedsSetup} onMarkBrandEstablished={onMarkBrandEstablished} />
          <SpacingSection />
          <TypographySection fonts={brand.fonts} needsSetup={needsSetup} />
          <SemanticTypesSection />
          <LineHeightSection />
          <TypeScaleSection fonts={brand.fonts} />

          <ButtonsSection />
          <BadgesSection />
          <FormControlsSection />
          <IconographySection />

          <CardSection />
          <HeaderSection />
          <PageLayoutSection />
          <ExamplePageSection onNavigate={onNavigate} />

        </main>
      </div>
    </div>
  );
}
