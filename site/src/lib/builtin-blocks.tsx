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
 */
import type React from "react";
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
};

/** The site's registry with the built-ins beneath it (a promoted block of the same key wins). */
export function withBuiltins(registry: Record<string, BlockDef>): Record<string, BlockDef> {
  return { ...builtinBlocks, ...registry };
}
