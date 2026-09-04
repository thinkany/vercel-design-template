// ©2026 thinkany llc. All rights reserved.
/**
 * BUILT-IN BLOCKS (CORE). Every site has these beside its promoted blocks, so a
 * designer never has to design them: the CMS lists them in the block picker and
 * the routes render them through the same registry lookup.
 *
 *   code  A snippet of HTML or script dropped into the page as written (a HubSpot
 *         form, an embed, a widget). Runs on the site; the design surface shows
 *         the markup but scripts don't execute there.
 */
import { z } from "astro/zod";
import { defineBlock, type BlockDef } from "./blocks";

const codeProps = z.object({
  /** For you: what this snippet is (shown in the CMS, not on the page). */
  name: z.string().optional(),
  /** The snippet, as written. */
  code: z.string().describe("code").default(""),
});

function Code({ code }: z.infer<typeof codeProps>) {
  return <div data-block="code" className="w-full" dangerouslySetInnerHTML={{ __html: code || "" }} />;
}

export const builtinBlocks: Record<string, BlockDef> = {
  code: defineBlock({
    name: "Code snippet",
    description: "Paste HTML or a script (a form embed, a widget). Placed on the page as written.",
    props: codeProps,
    component: Code,
  }),
};

/** The site's registry with the built-ins beneath it (a promoted block of the same key wins). */
export function withBuiltins(registry: Record<string, BlockDef>): Record<string, BlockDef> {
  return { ...builtinBlocks, ...registry };
}
