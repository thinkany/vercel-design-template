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
 */
import type React from "react";
import { videoEmbed, embedFrameProps } from "./embed";
import { z } from "astro/zod";
import { defineBlock, formRef, richtext, type BlockDef } from "./blocks";
import { Rich } from "./Rich";
import { formById, pageRouteOf, FORM_UI, type FormDef, type FormField } from "./forms";

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
};

/** The site's registry with the built-ins beneath it (a promoted block of the same key wins). */
export function withBuiltins(registry: Record<string, BlockDef>): Record<string, BlockDef> {
  return { ...builtinBlocks, ...registry };
}
