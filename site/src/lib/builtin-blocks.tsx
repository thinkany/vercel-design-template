// ©2026 thinkany llc. All rights reserved.
/**
 * BUILT-IN BLOCKS (CORE). Every site has these beside its promoted blocks, so a
 * designer never has to design them: the CMS lists them in the block picker and
 * the routes render them through the same registry lookup.
 *
 *   code  A snippet of HTML or script dropped into the page as written (a HubSpot
 *         form, an embed, a widget). Runs on the site; the design surface shows
 *         the markup but scripts don't execute there.
 *   form  A form defined in the Forms tab (content/forms/<id>.json), rendered
 *         with the design's tokens. Submits to /api/forms; the client script in
 *         Base.astro (site/src/lib/form-client.ts) handles the success state.
 *   video A clip with its poster still. Here so a site can carry video without a
 *         designer having to design a block for it first: the CMS's video field
 *         uploads a clip (deriving the poster) or picks one already in the library.
 *   types Entries of the content types (site/src/lib/entries.ts): a listing of one
 *         or more types (newest first, optional paging, an optional Tag/Type filter
 *         when more than one type is listed) or hand-picked entries. A type with a
 *         page links each card to it (the whole card, or a "Read more" line). The
 *         filter and pager are site/src/lib/entries-client.ts, from Base.astro.
 *   posts The newest blog posts (site/src/lib/posts.ts), with an optional tag filter
 *         (pills or a select list). How many and the filter come from Settings →
 *         Blog (content/site.json blog.posts), so every Posts block on the site
 *         behaves the same; the block itself carries a heading and an intro.
 */
import type React from "react";
import { videoEmbed, embedFrameProps } from "./embed";
import { z } from "astro/zod";
import { defineBlock, formRef, richtext, type BlockDef } from "./blocks";
import { Rich } from "./Rich";
import { formById, pageRouteOf, FORM_UI, type FormDef, type FormField } from "./forms";
import { site } from "./site";

// Spam protection (Cloudflare Turnstile) on a form that has it on. The widget renders
// into the slot below and puts its token into the form as `cf-turnstile-response`, so
// the client's JSON post and a native post both carry it; /api/forms verifies it. The
// site key is public (content/site.json, written by the app at publish or pasted by
// hand). With none yet, the dev server shows the widget with Cloudflare's always-pass
// test key, so the designer sees it in place before any account exists; a build with
// no key renders no slot. The script loads once per page and never in the design
// surface's preview (window.__taFormsPreview).
const TURNSTILE_TEST_SITEKEY = "1x00000000000000000000AA";
const TURNSTILE_LOADER = "(function(){if(window.__taFormsPreview||window.__taTurnstile)return;window.__taTurnstile=1;var s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js';s.async=true;s.defer=true;document.head.appendChild(s);})();";
function turnstileSiteKey(): string {
  const real = (site.forms && site.forms.turnstileSiteKey) || "";
  if (real) return real;
  let dev = false;
  try { dev = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV; } catch { /* not under Vite */ }
  return dev ? TURNSTILE_TEST_SITEKEY : "";
}
/** The action Turnstile stamps on the token (the endpoint checks it against the form). */
export const turnstileAction = (formId: string) => formId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
import { entriesOf, entryById, byDateDesc, types as contentTypes, ENTRIES_UI, type Entry } from "./entries";
import { posts as allPosts, postDate, POSTS_UI, blogPath, postRoute, type Post } from "./posts";

const codeProps = z.object({
  /** For you: what this snippet is (shown in the CMS, not on the page). */
  name: z.string().optional(),
  /** The snippet, as written. */
  code: z.string().describe("code").default(""),
});

function Code({ code }: z.infer<typeof codeProps>) {
  return <div data-block="code" className="w-full" dangerouslySetInnerHTML={{ __html: code || "" }} />;
}

const formProps = z.object({
  /** The form to show (Forms tab). */
  form: formRef,
  heading: z.string().optional(),
  intro: richtext.optional(),
});

const INPUT = "w-full font-ta-sans text-[15px] text-ta-ink bg-transparent border border-ta-ink/25 rounded-[3px] px-3 py-[10px] placeholder:text-ta-muted focus:outline-none focus:border-ta-primary focus:ring-1 focus:ring-ta-primary";
const LABEL = "block font-ta-sans text-[12px] font-medium tracking-[0.06em] uppercase text-ta-body mb-1.5";

/** One control per field, in the design's tokens. Reused by promoted blocks that bind a form. */
export function FormFields({ fields }: { fields: FormField[] }) {
  return (
    <>
      {fields.map((f) => {
        const id = `f-${f.id}`;
        const req = f.required ? <span aria-hidden="true" className="text-ta-primary"> *</span> : null;
        const help = f.help ? <div id={`${id}-help`} className="font-ta-sans text-[13px] text-ta-muted mt-1.5">{f.help}</div> : null;
        const aria = f.help ? { "aria-describedby": `${id}-help` } : {};
        if (f.type === "checkbox") {
          return (
            <div key={f.id} className="mb-5">
              <label htmlFor={id} className="flex items-start gap-3 font-ta-sans text-[15px] text-ta-body cursor-pointer">
                <input id={id} name={f.id} type="checkbox" value="yes" required={f.required} className="mt-1 size-4 accent-ta-primary" {...aria} />
                <span>{f.label}{req}</span>
              </label>
              {help}
            </div>
          );
        }
        return (
          <div key={f.id} className="mb-5">
            <label htmlFor={id} className={LABEL}>{f.label}{req}</label>
            {f.type === "textarea" ? (
              <textarea id={id} name={f.id} rows={5} required={f.required} placeholder={f.placeholder || undefined} className={INPUT} {...aria} />
            ) : f.type === "select" ? (
              <select id={id} name={f.id} required={f.required} defaultValue="" className={INPUT} {...aria}>
                <option value="" disabled={f.required}>{f.placeholder || "Choose…"}</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                id={id} name={f.id} required={f.required} placeholder={f.placeholder || undefined} className={INPUT}
                type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                autoComplete={f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.id === "name" ? "name" : undefined}
                {...aria}
              />
            )}
            {help}
          </div>
        );
      })}
    </>
  );
}

/**
 * The <form> for a definition: hidden form id + timing token, the fields, the
 * honeypot, the submit button, the error line, and (beside it) the thank-you
 * message the client script reveals. `children` is the copy that belongs to the
 * form (heading, intro): on success the whole copy goes and the message takes
 * its place. Promoted blocks can render this inside their own section.
 */
export function FormBody({ def, children }: { def: FormDef; children?: React.ReactNode }) {
  const route = def.after.mode === "page" ? pageRouteOf(def.after.page) : null;
  return (
    <div data-ta-form-wrap="">
      <div data-ta-form-copy="">
      {children}
      <form
        data-ta-form={def.id} method="post" action="/api/forms" noValidate={false}
        data-ta-after={def.after.mode === "page" && route ? "page" : "message"} data-ta-page={route || undefined}
        data-ta-sending={FORM_UI.sending} data-ta-error={FORM_UI.error} data-ta-preview-page={FORM_UI.previewPage("{route}")}
      >
        <input type="hidden" name="form" value={def.id} />
        <input type="hidden" name="_t" value="" />
        {route && <input type="hidden" name="_next" value={route} />}
        <FormFields fields={def.fields} />
        {/* Honeypot: hidden from people, filled by bots; the endpoint rejects a filled one. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        {def.turnstile && turnstileSiteKey() && (
          <>
            <div className="cf-turnstile mb-4" data-sitekey={turnstileSiteKey()} data-action={turnstileAction(def.id)} data-theme="auto" />
            <script dangerouslySetInnerHTML={{ __html: TURNSTILE_LOADER }} />
          </>
        )}
        <div data-ta-form-error="" hidden role="alert" className="font-ta-sans text-[14px] text-red-700 mb-4">{FORM_UI.error}</div>
        <button type="submit" className="font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-white bg-ta-primary px-[22px] py-[12px] rounded-[3px] cursor-pointer disabled:opacity-60">
          {def.submit.label || "Submit"}
        </button>
      </form>
      </div>
      <div data-ta-form-done="" hidden>
        {!(def.after.mode === "page" && route) && <Rich text={def.after.message} className="font-ta-serif text-[17px] text-ta-body leading-[1.6]" />}
        <p data-ta-form-preview="" hidden className="font-ta-sans text-[13px] text-ta-muted mt-3">{FORM_UI.preview}</p>
      </div>
    </div>
  );
}

function Form({ form, heading, intro }: z.infer<typeof formProps>) {
  const def = formById(form);
  return (
    <section data-block="form" className="w-full bg-ta-surface px-8 py-20">
      <div className="mx-auto w-full max-w-[560px]">
        {def ? (
          <FormBody def={def}>
            {heading && <h2 className="font-ta-display text-[clamp(28px,4vw,40px)] font-normal text-ta-ink mb-4 leading-[1.1] tracking-[-0.02em]">{heading}</h2>}
            {intro && <Rich text={intro} className="font-ta-serif text-[17px] text-ta-body leading-[1.6] mb-8" />}
          </FormBody>
        ) : (
          <div className="font-ta-sans text-[14px] text-ta-muted border border-dashed border-ta-ink/25 rounded-[3px] px-4 py-3">{form ? FORM_UI.missing(form) : FORM_UI.none}</div>
        )}
      </div>
    </section>
  );
}

// Table: rows of cells, an optional header row and caption. Prose (richtext) has no
// table syntax by design; tabular content is a block, styled once in the design's
// tokens. The WordPress importer promotes tables found in old content to this block.
const tableProps = z.object({
  caption: z.string().optional(),
  /** The first row is a header row. */
  header: z.boolean().default(true),
  rows: z.array(z.object({ cells: z.array(z.string()).default([]) })).default([]),
});

function Table({ caption, header, rows }: z.infer<typeof tableProps>) {
  const width = rows.reduce((n, r) => Math.max(n, r.cells.length), 0);
  const body = header ? rows.slice(1) : rows;
  const head = header ? rows[0] : null;
  const cell = "px-4 py-3 align-top border-b border-ta-border";
  return (
    <section data-block="table" className="w-full px-8 py-12 bg-ta-surface">
      <div className="mx-auto max-w-[960px] overflow-x-auto">
        <table className="w-full border-collapse font-ta-sans text-[15px] text-ta-body leading-[1.5]">
          {caption && <caption className="text-left font-ta-sans text-[13px] tracking-[0.06em] uppercase text-ta-muted pb-3">{caption}</caption>}
          {head && (
            <thead>
              <tr>{Array.from({ length: width }, (_, i) => <th key={i} scope="col" className={`${cell} text-left font-semibold text-ta-ink border-b-2`}>{head.cells[i] ?? ""}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>{Array.from({ length: width }, (_, i) => <td key={i} className={cell}>{r.cells[i] ?? ""}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// A clip and the poster still that stands in for it. The poster is not optional: it is
// what a visitor who asked for less motion sees, what the Figma export draws, and what
// shows before the first frame paints. Same markup as the design surface's <VideoFigure>,
// written out here because a built-in may not reach into the designer-owned site/blocks.
const videoProps = z.object({
  /** Section anchor; nav links point at "#<id>". */
  id: z.string().default("video"),
  /** Above the clip, optional. */
  heading: z.string().optional(),
  /** The clip and its still. */
  video: z.object({
    src: z.string().default(""),
    poster: z.string().default(""),
    alt: z.string().default(""),
  }).default({ src: "", poster: "", alt: "" }),
  /** Wide and cinematic, or the page's usual measure. */
  width: z.enum(["contained", "full"]).default("contained"),
  /** The shape it is cropped to. */
  ratio: z.enum(["16/9", "4/3", "1/1", "21/9"]).default("16/9"),
  /** A clip that MEANS something gets a play control and a name; texture does not. */
  controls: z.boolean().default(false),
});

function Video({ id, heading, video, width, ratio, controls }: z.infer<typeof videoProps>) {
  const src = (video && video.src) || "";
  const label = (video && video.alt) || heading || "";
  // A YouTube / Vimeo address is the same block with the host's player in the clip's
  // place (see VideoFigure). A hosted video is always content: the visitor starts it,
  // with the host's controls, whatever `controls` says. YouTube's own thumbnail stands
  // in for a missing poster.
  const embed = videoEmbed(src);
  const poster = (video && video.poster) || (embed && embed.thumb) || "";
  const content = controls || !!embed;
  if (!src && !poster) return null; // nothing chosen yet: draw nothing rather than a black box
  return (
    <section id={id} data-block="video" className={width === "full" ? "w-full" : "w-full max-w-5xl mx-auto px-6"}>
      {heading ? <h2 className="mb-4 text-2xl font-semibold text-ta-ink">{heading}</h2> : null}
      <div data-video-figure className="relative overflow-clip w-full rounded-lg" style={{ aspectRatio: ratio }}>
        {poster ? (
          <img
            src={poster}
            alt={content && label ? label : ""}
            className="ta-video-still absolute inset-0 h-full w-full object-cover"
            aria-hidden={content ? undefined : "true"}
          />
        ) : null}
        {embed ? (
          <iframe
            {...embedFrameProps(embed, { title: label })}
            className="ta-video-embed absolute inset-0 h-full w-full border-0"
          />
        ) : src ? (
          <video
            className="ta-video-clip absolute inset-0 h-full w-full object-cover"
            src={src}
            poster={poster || undefined}
            autoPlay={!controls}
            muted
            loop
            playsInline
            preload="metadata"
            controls={controls}
            tabIndex={controls ? undefined : -1}
            aria-hidden={controls ? undefined : "true"}
            aria-label={controls ? label || undefined : undefined}
          />
        ) : null}
      </div>
    </section>
  );
}

// Types: the content types' entries on a page. Listing mode takes one or more types
// (ordered newest first, so several types interleave by date), a cap, an optional
// pager, and, when more than one type is listed, an optional Tag/Type filter. Picker
// mode is specific entries in the order picked. An entry of a type with a page links
// to it: the whole card, or a "Read more" line whose words the editor sets. A
// data-only entry links nowhere. The CMS edits this block with its own form
// (desktop/shell.js siteEntriesBlockEditor).
const entriesProps = z.object({
  heading: z.string().default(""),
  /** listing = from the chosen types; picker = the chosen entries. */
  mode: z.enum(["listing", "picker"]).default("listing"),
  /** Listing: the type keys to draw from. */
  types: z.array(z.string()).default([]),
  /** Listing, without paging: how many at most (0 = all). Ignored when paginate is on. */
  limit: z.number().int().min(0).default(12),
  paginate: z.boolean().default(false),
  perPage: z.number().int().min(1).default(6),
  /** Listing, more than one type: let visitors filter by type or tag. */
  filter: z.boolean().default(false),
  /** Picker: the entries, in order. */
  picks: z.array(z.object({ type: z.string().default(""), entry: z.string().default("") })).default([]),
  /** For entries that have a page: the whole card is the link, or a line under it. */
  linkStyle: z.enum(["card", "more"]).default("card"),
  linkLabel: z.string().default(""),
});

const PILL = "font-ta-sans text-[12px] tracking-[0.04em] text-ta-body border border-ta-ink/25 rounded-full px-3 py-[6px] bg-transparent cursor-pointer hover:border-ta-ink aria-pressed:bg-ta-ink aria-pressed:text-ta-surface aria-pressed:border-ta-ink";
const PAGER_BTN = "font-ta-sans text-[12px] tracking-[0.08em] uppercase text-ta-ink border border-ta-ink/25 rounded-[3px] px-4 py-2 bg-transparent cursor-pointer hover:border-ta-ink";
const PAGER_NUM = "font-ta-sans text-[13px] text-ta-ink min-w-[36px] h-[36px] rounded-[3px] border border-transparent bg-transparent cursor-pointer hover:border-ta-ink/25";
const PAGER_NUM_ON = "font-ta-sans text-[13px] text-ta-surface min-w-[36px] h-[36px] rounded-[3px] border border-ta-ink bg-ta-ink cursor-default";

function entryDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
/** The tags an entry carries, as filter keys ("<type>:<value>", so two types' tags never merge) with their labels. */
function entryTags(e: Entry): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (const f of e.type.fields) if (f.kind === "tags") for (const v of (Array.isArray(e.data[f.key]) ? (e.data[f.key] as string[]) : [])) out.push({ key: `${e.type.key}:${v}`, label: v });
  return out;
}

/** One entry as a card: image, type and date, title, summary, tags, and, for a type with a
 *  page, the link to it (the card itself, or a "Read more" line). Reused by promoted blocks. */
export function EntryCard({ entry, showType, linkStyle = "card", linkLabel = "" }: { entry: Entry; showType?: boolean; linkStyle?: "card" | "more"; linkLabel?: string }) {
  const t = entry.type;
  const href = t.dataOnly ? null : `${t.path}/${(entry.data.slug as string | undefined) || entry.id}`;
  const imageField = t.fields.find((f) => f.kind === "image");
  const summaryField = t.fields.find((f) => f.kind === "textarea" || f.kind === "text");
  const img = imageField ? (entry.data[imageField.key] as { src: string; alt?: string } | undefined) : undefined;
  const summary = summaryField ? (entry.data[summaryField.key] as string | undefined) : undefined;
  const tags = entryTags(entry);
  const date = entryDate(entry.date);
  const body = (
    <>
      {img?.src && <img src={img.src} alt={img.alt || ""} className="w-full aspect-[4/3] object-cover rounded-[3px] mb-4" />}
      {(showType || date) && (
        <div className="font-ta-sans text-[11px] tracking-[0.14em] uppercase text-ta-muted mb-2">
          {showType ? (t.singular || t.label) : ""}{showType && date ? " · " : ""}{date}
          {entry.data.draft && <span className="ml-3 align-middle rounded-full bg-ta-ink px-2 py-[2px] text-[10px] text-ta-surface">Draft</span>}
        </div>
      )}
      <h3 className="font-ta-display text-[22px] font-normal text-ta-ink leading-[1.15] mb-2">{entry.data.title}</h3>
      {summary && <p className="font-ta-sans text-[15px] text-ta-body leading-[1.6] m-0">{summary}</p>}
      {tags.length > 0 && (
        <ul className="list-none p-0 m-0 mt-3 flex flex-wrap gap-2">
          {tags.map((x) => <li key={x.key} className="font-ta-sans text-[11px] text-ta-body border border-ta-ink/20 rounded-full px-2.5 py-[3px]">{x.label}</li>)}
        </ul>
      )}
    </>
  );
  return (
    <li data-ta-entry="" data-ta-type={t.key} data-ta-tags={tags.map((x) => x.key).join("|") || undefined}>
      {href && linkStyle === "card" ? (
        <a href={href} className="no-underline block">{body}</a>
      ) : (
        <>
          {body}
          {href && <a href={href} className="inline-block mt-3 font-ta-sans text-[12px] font-medium tracking-[0.1em] uppercase text-ta-primary no-underline hover:underline">{linkLabel || ENTRIES_UI.readMore}</a>}
        </>
      )}
    </li>
  );
}

function Entries(p: z.infer<typeof entriesProps>) {
  const listing = p.mode !== "picker";
  const multi = listing && p.types.length > 1;
  let items: Entry[];
  if (listing) {
    items = p.types.flatMap((k) => entriesOf(k));
    if (multi) items.sort(byDateDesc);
    // Paging shows everything, a page at a time; the cap applies only to a single run.
    if (p.limit > 0 && !p.paginate) items = items.slice(0, p.limit);
  } else {
    items = p.picks.map((x) => entryById(x.type, x.entry)).filter((e): e is Entry => !!e);
  }
  const filter = multi && p.filter;
  const perPage = listing && p.paginate ? p.perPage : 0;
  // The filter's pills: every type shown, then every tag value carried, scoped to its
  // type. A value two types both use is told apart by its type in the label.
  const typesShown = [...new Map(items.map((e) => [e.type.key, e.type])).values()];
  const tagPills = new Map<string, { label: string; type: string }>();
  for (const e of items) for (const x of entryTags(e)) if (!tagPills.has(x.key)) tagPills.set(x.key, { label: x.label, type: e.type.singular || e.type.label });
  const labelCounts: Record<string, number> = {};
  for (const v of tagPills.values()) labelCounts[v.label.toLowerCase()] = (labelCounts[v.label.toLowerCase()] || 0) + 1;
  const showType = listing ? p.types.length > 1 : typesShown.length > 1;
  return (
    <section data-block="types" data-ta-entries="" data-ta-per-page={perPage || undefined} className="w-full bg-ta-surface px-8 py-20">
      <div className="mx-auto w-full max-w-[1160px]">
        {p.heading && <h2 className="font-ta-display text-[clamp(28px,4vw,40px)] font-normal text-ta-ink mb-8 leading-[1.1] tracking-[-0.02em]">{p.heading}</h2>}
        {items.length === 0 ? (
          <div className="font-ta-sans text-[14px] text-ta-muted border border-dashed border-ta-ink/25 rounded-[3px] px-4 py-3">{contentTypes.length ? ENTRIES_UI.none : ENTRIES_UI.noTypes}</div>
        ) : (
          <>
            {filter && (
              <div data-ta-entries-filter="" className="flex flex-wrap gap-2 mb-8">
                <button type="button" data-ta-filter="" aria-pressed="true" className={PILL}>{ENTRIES_UI.all}</button>
                {typesShown.map((t) => <button key={t.key} type="button" data-ta-filter={`type:${t.key}`} aria-pressed="false" className={PILL}>{t.label}</button>)}
                {[...tagPills.entries()].map(([key, v]) => <button key={key} type="button" data-ta-filter={`tag:${key}`} aria-pressed="false" className={PILL}>{labelCounts[v.label.toLowerCase()] > 1 ? `${v.label} · ${v.type}` : v.label}</button>)}
              </div>
            )}
            <ul className="list-none p-0 m-0 grid gap-8 @lg:grid-cols-3">
              {items.map((e) => <EntryCard key={`${e.type.key}/${e.id}`} entry={e} showType={showType} linkStyle={p.linkStyle} linkLabel={p.linkLabel} />)}
            </ul>
            {filter && <p data-ta-entries-empty="" hidden className="font-ta-sans text-[14px] text-ta-muted mt-4">{ENTRIES_UI.empty}</p>}
            {perPage > 0 && (
              <nav data-ta-entries-pager="" hidden aria-label="Pages" className="flex items-center justify-center gap-2 mt-10">
                {/* Previous · 1 2 3 · Next; the numbers are filled in by the client script (entries-client.ts). */}
                <button type="button" data-ta-pager-prev="" hidden className={PAGER_BTN}>{ENTRIES_UI.prev}</button>
                <span data-ta-pager-pages="" data-ta-pager-class={PAGER_NUM} data-ta-pager-current-class={PAGER_NUM_ON} className="inline-flex items-center gap-1" />
                <button type="button" data-ta-pager-next="" hidden className={PAGER_BTN}>{ENTRIES_UI.next}</button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Posts: the newest blog posts as cards, the count and the tag filter from Settings →
// Blog. The filter reuses the Types block's client script (data-ta-entries): pills
// are the same buttons; the select list is its own control the script also reads.
const postsProps = z.object({
  heading: z.string().default(""),
  intro: richtext.default(""),
  /** The link to the blog index under the cards, when more posts exist than are shown. Empty = no link. */
  moreLabel: z.string().default(POSTS_UI.more),
});

function PostCard({ post }: { post: Post }) {
  const href = "/" + postRoute(post);
  const date = postDate(post.date);
  return (
    <li data-ta-entry="" data-ta-tags={post.tags.join("|") || undefined}>
      <a href={href} className="no-underline block">
        {post.image && <img src={post.image} alt="" className="w-full aspect-[4/3] object-cover rounded-[3px] mb-4" />}
        {(date || post.draft) && (
          <div className="font-ta-sans text-[11px] tracking-[0.14em] uppercase text-ta-muted mb-2">
            {date}
            {post.draft && <span className="ml-3 align-middle rounded-full bg-ta-ink px-2 py-[2px] text-[10px] text-ta-surface">Draft</span>}
          </div>
        )}
        <h3 className="font-ta-display text-[22px] font-normal text-ta-ink leading-[1.15] mb-2">{post.title}</h3>
        {post.description && <p className="font-ta-sans text-[15px] text-ta-body leading-[1.6] m-0">{post.description}</p>}
        {post.tags.length > 0 && (
          <ul className="list-none p-0 m-0 mt-3 flex flex-wrap gap-2">
            {post.tags.map((t) => <li key={t} className="font-ta-sans text-[11px] text-ta-body border border-ta-ink/20 rounded-full px-2.5 py-[3px]">{t}</li>)}
          </ul>
        )}
      </a>
    </li>
  );
}

function Posts(p: z.infer<typeof postsProps>) {
  const cfg = site.blog.posts;
  const items = cfg.count > 0 ? allPosts.slice(0, cfg.count) : allPosts;
  const more = p.moreLabel && allPosts.length > items.length;
  // The tags carried by the posts shown, in first-seen order, one filter each.
  const tags = [...new Set(items.flatMap((x) => x.tags))];
  const filter = cfg.filter && tags.length > 0;
  return (
    <section data-block="posts" data-ta-entries="" className="w-full bg-ta-surface px-8 py-20">
      <div className="mx-auto w-full max-w-[1160px]">
        {p.heading && <h2 className="font-ta-display text-[clamp(28px,4vw,40px)] font-normal text-ta-ink mb-4 leading-[1.1] tracking-[-0.02em]">{p.heading}</h2>}
        <Rich text={p.intro} className="font-ta-sans text-[16px] text-ta-body leading-[1.6] max-w-[60ch] mb-8" />
        {items.length === 0 ? (
          <div className="font-ta-sans text-[14px] text-ta-muted border border-dashed border-ta-ink/25 rounded-[3px] px-4 py-3">{POSTS_UI.none}</div>
        ) : (
          <>
            {filter && cfg.filterKind === "select" && (
              <label data-ta-entries-filter="" className="flex items-center gap-3 mb-8 font-ta-sans text-[13px] text-ta-body">
                <span>{POSTS_UI.filterLabel}</span>
                <select data-ta-filter-select="" className="font-ta-sans text-[13px] text-ta-ink border border-ta-ink/25 rounded-[3px] bg-transparent px-3 py-[6px]">
                  <option value="">{POSTS_UI.all}</option>
                  {tags.map((t) => <option key={t} value={`tag:${t}`}>{t}</option>)}
                </select>
              </label>
            )}
            {filter && cfg.filterKind !== "select" && (
              <div data-ta-entries-filter="" className="flex flex-wrap gap-2 mb-8">
                <button type="button" data-ta-filter="" aria-pressed="true" className={PILL}>{POSTS_UI.all}</button>
                {tags.map((t) => <button key={t} type="button" data-ta-filter={`tag:${t}`} aria-pressed="false" className={PILL}>{t}</button>)}
              </div>
            )}
            <ul className="list-none p-0 m-0 grid gap-8 @lg:grid-cols-3">
              {items.map((x) => <PostCard key={x.id} post={x} />)}
            </ul>
            {filter && <p data-ta-entries-empty="" hidden className="font-ta-sans text-[14px] text-ta-muted mt-4">{POSTS_UI.empty}</p>}
            {more && <a href={"/" + blogPath} className="inline-block mt-10 font-ta-sans text-[12px] font-medium tracking-[0.1em] uppercase text-ta-primary no-underline hover:underline">{p.moreLabel}</a>}
          </>
        )}
      </div>
    </section>
  );
}

export const builtinBlocks: Record<string, BlockDef> = {
  table: defineBlock({
    name: "Table",
    description: "Rows and columns (hours, prices, specs), with an optional header row and caption.",
    props: tableProps,
    component: Table,
  }),
  code: defineBlock({
    name: "Code snippet",
    description: "Paste HTML or a script (a form embed, a widget). Placed on the page as written.",
    props: codeProps,
    component: Code,
  }),
  form: defineBlock({
    name: "Form",
    description: "A form from the Forms tab, with an optional heading and intro. Submissions go to the form's recipients.",
    props: formProps,
    component: Form,
  }),
  video: defineBlock({
    name: "Video",
    description: "A video with its poster still. Upload a clip and the still is taken for you, or pick one already in the library.",
    props: videoProps,
    component: Video,
  }),
  posts: defineBlock({
    name: "Posts",
    description: "The newest blog posts, with an optional tag filter. How many, and the filter's style, are set in Settings → Blog.",
    props: postsProps,
    component: Posts,
  }),
  types: defineBlock({
    name: "Types",
    description: "Entries from your content types: a listing (newest first, with optional paging and a Tag/Type filter) or hand-picked entries. Types with a page link each card to it.",
    props: entriesProps,
    component: Entries,
  }),
};

/** The site's registry with the built-ins beneath it (a promoted block of the same key wins). */
export function withBuiltins(registry: Record<string, BlockDef>): Record<string, BlockDef> {
  return { ...builtinBlocks, ...registry };
}
