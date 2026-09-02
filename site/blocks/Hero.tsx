// ©2026 thinkany llc. All rights reserved.
// Starter Hero block. Modelled on the scaffold's neutral Home starter so a fresh
// site renders on-brand from the tokens alone. Replace or extend once the
// approved design's sections are promoted to blocks.
import { z } from "astro/zod";
import { defineBlock } from "../src/lib/blocks";
import { link } from "./lib/schema";

/** "primary" = filled brand button; "secondary" = outlined. */
const cta = link.extend({ style: z.enum(["primary", "secondary"]).default("primary") });

const props = z.object({
  eyebrow: z.string().optional(),
  heading: z.string(),
  body: z.string().optional(),
  ctas: z.array(cta).default([]),
});

function Hero({ eyebrow, heading, body, ctas }: z.infer<typeof props>) {
  return (
    <section
      data-block="hero"
      className="w-full min-h-[70vh] bg-ta-surface flex flex-col items-center justify-center px-8 py-20 text-center"
    >
      {eyebrow && (
        <div className="font-ta-sans text-[11px] font-semibold tracking-[0.18em] uppercase text-ta-muted mb-5">
          {eyebrow}
        </div>
      )}
      <h1 className="font-ta-display text-[clamp(36px,6vw,64px)] font-normal text-ta-ink mb-5 leading-[1.05] tracking-[-0.02em]">
        {heading}
      </h1>
      {body && (
        <p className="font-ta-serif text-[17px] text-ta-body leading-[1.6] max-w-[440px] mb-9">{body}</p>
      )}
      {ctas.length > 0 && (
        <div className="flex gap-3 flex-wrap justify-center">
          {ctas.map((c) => (
            <a
              key={c.href + c.label}
              href={c.href}
              className={
                c.style === "primary"
                  ? "font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-white bg-ta-primary px-[22px] py-[11px] rounded-[3px] no-underline"
                  : "font-ta-sans text-xs font-medium tracking-[0.1em] uppercase text-ta-body bg-transparent border border-black/20 px-[22px] py-[11px] rounded-[3px] no-underline"
              }
            >
              {c.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export const hero = defineBlock({
  name: "Hero",
  description: "Full-width opening section: eyebrow, heading, short body, up to two calls to action.",
  props,
  component: Hero,
});
