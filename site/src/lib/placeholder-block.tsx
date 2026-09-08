// ©2026 thinkany llc. All rights reserved.
/**
 * PLACEHOLDER BLOCK (CORE). The component every imported block renders through
 * until its design pass (docs/wordpress-import-lossless-spec.md). It lays any props
 * object out plainly in the design's tokens, so an imported page previews and the
 * site builds before a single section has been designed:
 *
 *   short strings → headings or lines, long strings and markdown → rich text,
 *   images at their size, links as buttons, lists as stacked items, booleans and
 *   choices as small labels, nested objects indented under their key.
 *
 * A "Needs design" ribbon names the block. Imported pages are drafts, so this
 * never reaches a published site; a designed block has its own component.
 */
import type React from "react";
import { Rich } from "./Rich";

type Props = { name: string; props: Record<string, unknown> };

const isImage = (v: unknown): v is { src: string; alt?: string } => !!v && typeof v === "object" && typeof (v as { src?: unknown }).src === "string";
const isLink = (v: unknown): v is { label?: string; href: string } => !!v && typeof v === "object" && typeof (v as { href?: unknown }).href === "string" && !("src" in (v as object));
const words = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function Value({ k, v, depth }: { k: string; v: unknown; depth: number }): React.ReactElement | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return <span className="inline-block font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted border border-ta-border rounded-[3px] px-2 py-[2px] mr-2">{words(k)}: {v ? "yes" : "no"}</span>;
  if (typeof v === "number") return <span className="inline-block font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted border border-ta-border rounded-[3px] px-2 py-[2px] mr-2">{words(k)}: {v}</span>;
  if (typeof v === "string") {
    const short = v.length <= 90 && !/\n/.test(v);
    const choice = /^[a-z0-9-]+$/.test(v) && v.length <= 24 && depth === 0 && !/^(https?:|\/)/.test(v);
    if (choice) return <span className="inline-block font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted border border-ta-border rounded-[3px] px-2 py-[2px] mr-2">{words(k)}: {v}</span>;
    if (short && depth === 0) return <h3 className="font-ta-display text-[clamp(22px,3vw,34px)] text-ta-ink leading-[1.15] tracking-[-0.01em] mb-3">{v}</h3>;
    if (short) return <div className="font-ta-sans text-[15px] font-medium text-ta-ink mb-1">{v}</div>;
    return <Rich text={v} className="font-ta-serif text-[16px] text-ta-body leading-[1.6] mb-4 [&_p]:mb-3 [&_h2]:font-ta-display [&_h2]:text-[24px] [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-ta-sans [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline" />;
  }
  if (isImage(v)) return v.src ? <img src={v.src} alt={v.alt || ""} loading="lazy" className="block max-w-full h-auto rounded-[4px] mb-4" /> : null;
  if (isLink(v)) return v.href ? <a href={v.href} className="inline-block font-ta-sans text-[13px] font-medium tracking-[0.04em] uppercase text-ta-surface bg-ta-primary rounded-[3px] px-5 py-3 mr-3 mb-3 no-underline">{v.label || v.href}</a> : null;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    return (
      <div className="mb-5">
        <div className="font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted mb-2">{words(k)} ({v.length})</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {v.map((item, i) => (
            <div key={i} className="border border-ta-border rounded-[4px] p-4">
              {typeof item === "object" && item !== null && !isImage(item) && !isLink(item)
                ? Object.entries(item as Record<string, unknown>).map(([ik, iv]) => <Value key={ik} k={ik} v={iv} depth={depth + 1} />)
                : <Value k={k} v={item} depth={depth + 1} />}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (typeof v === "object") {
    return (
      <div className="mb-4 pl-4 border-l-2 border-ta-border">
        <div className="font-ta-sans text-[11px] tracking-[0.08em] uppercase text-ta-muted mb-2">{words(k)}</div>
        {Object.entries(v as Record<string, unknown>).map(([ik, iv]) => <Value key={ik} k={ik} v={iv} depth={depth + 1} />)}
      </div>
    );
  }
  return null;
}

export function Placeholder({ name, props }: Props) {
  const entries = Object.entries(props || {});
  return (
    <section data-block="placeholder" data-needs-design={name} className="w-full bg-ta-surface px-8 py-14 border-y border-dashed border-ta-border">
      <div className="mx-auto max-w-[960px]">
        <div className="flex items-center gap-3 mb-6">
          <span className="font-ta-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-ta-surface bg-ta-ink rounded-[3px] px-2 py-1">Needs design</span>
          <span className="font-ta-sans text-[12px] text-ta-muted">{name}</span>
        </div>
        {entries.map(([k, v]) => <Value key={k} k={k} v={v} depth={0} />)}
      </div>
    </section>
  );
}
