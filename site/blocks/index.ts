// ©2026 thinkany llc. All rights reserved.
// BLOCKS — the designer-owned list (KEEP tier: a template upgrade NEVER overwrites
// this file). Every block a page can use is registered here by the name content
// refers to it by ({ "type": "hero" }). The contract (defineBlock, validation)
// lives in site/src/lib/blocks.ts (CORE tier).
//
// Blocks are promoted from an approved design: each section becomes a component
// in this folder with a props schema, and a row here. Add one per block.
//
// The header/footer chrome is registered separately in ./chrome.ts.
import type { BlockDef } from "../src/lib/blocks";
import { hero } from "./Hero";

export const blocks: Record<string, BlockDef> = {
  hero,
};
