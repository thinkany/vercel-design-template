// ©2026 thinkany llc. All rights reserved.
//
// figma-block-library.plugin.js — the Figma Plugin API builder for the
// BLOCK-LIBRARY export (the "Block Library" page). NOT run by node; its body is
// embedded into a `use_figma` MCP call with MANIFEST + PHASE prepended, exactly
// like figma-component-library.plugin.js (atoms) and figma-brand-library.plugin.js.
//
// CONTRACT — the caller MUST define these two consts ABOVE this body:
//     const MANIFEST = { ...blocks-{id}.json... };  // from export-blocks-to-figma.mjs
//     const PHASE = "blocks";
//
// DERIVE-EVERYTHING MODEL
//   Blocks are NOT hand-built here. Each block is DERIVED from the real page: the
//   capture pipeline (generate_figma_design via export-to-figma.mjs --blocks)
//   screenshots each `[data-block]` section at each active breakpoint into Figma
//   as an editable, html.to.design-converted layer tree (real auto-layout, real
//   text, literal fills). Claude records each capture's resulting node id into
//   MANIFEST.captures. THIS builder is the POST-PASS that turns those raw captures
//   into a clean, on-brand Block Library:
//     1. bind      — match each captured literal fill/stroke to the nearest Brand
//                    variable (--ta-*) and bind it (whites / off-brand colors stay
//                    literal). Editing a brand variable then cascades to every block.
//     2. normalize — remap any font family Figma lacks (e.g. a system "Georgia")
//                    to the project's real face, else a role proxy. REQUIRED before
//                    any structural edit — an unloaded font blocks reparenting.
//     3. flatten   — unwrap pure passthrough wrapper frames (single child, no fill/
//                    stroke/padding/effects) that html.to.design emits; keep padded
//                    ":margin" spacers (Figma auto-layout can't do non-uniform gaps).
//     4. componentize — convert each cleaned per-breakpoint capture into a COMPONENT
//                    and combine a block's breakpoints into a `View=…` COMPONENT_SET.
//
// MANIFEST shape:
//   { brandCollectionName, blockPageName, brandColors:[{name,token,rgb}],
//     fonts:{ display:{family,role}, serif, sans, mono },
//     captures:[{ blockId, name, view, nodeId }] }   // nodeId filled post-capture
//
// IDEMPOTENT: Brand variables are find-by-name/update (bind to the canonical
//   var(--ta-*) from the brand `variables` phase when present). Each block's set is
//   removed by name and rebuilt. Follows figma-use rules (colors 0–1, fonts loaded
//   before text/reparent, one setCurrentPageAsync per call, returns ids).

// ── shared helpers ────────────────────────────────────────────────────────────
async function getOrCreateCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === name);
  if (!col) col = figma.variables.createVariableCollection(name);
  const modeId = col.modes[0].modeId;
  col.renameMode(modeId, "Value");
  return { col, modeId };
}

// Frame a finished block component set into the tidy grid on the page.
function styleSet(node, name) {
  node.name = name;
  node.clipsContent = false;
  if (node.type === "COMPONENT_SET") {
    node.layoutMode = "HORIZONTAL";
    node.counterAxisAlignItems = "MIN";
    node.itemSpacing = 48;
    node.paddingLeft = node.paddingRight = node.paddingTop = node.paddingBottom = 48;
    node.cornerRadius = 12;
    node.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.965, b: 0.955 } }];
    node.strokes = [{ type: "SOLID", color: { r: 0.886, g: 0.878, b: 0.855 } }];
    node.strokeWeight = 1;
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
  }
  return node;
}

// Role → proxy face when the project's real family isn't installed in Figma.
const ROLE_PROXY = { display: "Playfair Display", serif: "Lora", sans: "Inter", mono: "JetBrains Mono" };

if (PHASE === "blocks") {
  // ── 1. Brand variable collection + variables (bind canonical when present) ───
  const { col, modeId } = await getOrCreateCollection(MANIFEST.brandCollectionName);
  const existing = (await figma.variables.getLocalVariablesAsync("COLOR")).filter((v) => v.variableCollectionId === col.id);
  const codeMatch = (x, token) => { try { return x.codeSyntax && x.codeSyntax.WEB === `var(${token})`; } catch { return false; } };
  const brandVars = []; // { name, token, rgb, variable }
  const varResult = [];
  for (const c of MANIFEST.brandColors) {
    const canonical = existing.find((x) => codeMatch(x, c.token) && x.name !== c.name);
    let v = canonical || existing.find((x) => x.name === c.name);
    const created = !v;
    if (!canonical) {
      if (!v) v = figma.variables.createVariable(c.name, col, "COLOR");
      v.setValueForMode(modeId, { r: c.rgb.r, g: c.rgb.g, b: c.rgb.b });
      v.scopes = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"];
      v.setVariableCodeSyntax("WEB", `var(${c.token})`);
    }
    brandVars.push({ name: c.name, token: c.token, rgb: c.rgb, variable: v });
    varResult.push({ name: v.name, id: v.id, created, boundCanonical: !!canonical });
  }
  // Nearest brand variable within a per-channel tolerance (else null → stay literal).
  const TOL = 0.02; // ≈ sum of |Δ| over r,g,b; ~1.7/255 avg per channel
  const nearestVar = (color) => {
    let best = null, bd = 1e9;
    for (const b of brandVars) { const d = Math.abs(color.r - b.rgb.r) + Math.abs(color.g - b.rgb.g) + Math.abs(color.b - b.rgb.b); if (d < bd) { bd = d; best = b; } }
    return bd < TOL ? best : null;
  };
  const bindPaints = (node, key, log) => {
    const arr = node[key];
    if (!Array.isArray(arr) || !arr.length) return;
    let changed = false;
    const next = arr.map((p) => {
      if (p.type !== "SOLID") return p;
      const m = nearestVar(p.color);
      if (!m) return p;
      changed = true; log.bound++;
      return figma.variables.setBoundVariableForPaint(p, "color", m.variable);
    });
    if (changed) node[key] = next;
  };

  // ── 2. Block Library page (find-by-name/create) ─────────────────────────────
  let page = figma.root.children.find((p) => p.name === MANIFEST.blockPageName);
  if (!page) { page = figma.createPage(); page.name = MANIFEST.blockPageName; }
  await figma.setCurrentPageAsync(page);
  for (const n of [...page.children]) if (n.name === "Cover") n.remove();

  // ── 3. Fonts: available set + a role-aware resolver (project family → proxy) ──
  const avail = await figma.listAvailableFontsAsync();
  const famSet = new Set(avail.map((a) => a.fontName.family));
  const stylesOf = (fam) => avail.filter((a) => a.fontName.family === fam).map((a) => a.fontName.style);
  const F = MANIFEST.fonts || {};
  // Map a real family (as captured) → its declared role, so we proxy by role.
  const familyRole = {};
  for (const role of ["display", "serif", "sans", "mono"]) if (F[role] && F[role].family) familyRole[F[role].family] = role;
  const roleFromFamily = (fam) => {
    if (familyRole[fam]) return familyRole[fam];
    const f = (fam || "").toLowerCase();
    if (/mono|courier|consol/.test(f)) return "mono";
    if (/times|georgia|serif|garamond|playfair|lora|merri|book/.test(f)) return "serif";
    return "sans";
  };
  const pickStyle = (fam, want) => {
    const styles = stylesOf(fam);
    if (styles.includes(want)) return want;
    const alt = { "Semi Bold": "SemiBold", "SemiBold": "Semi Bold" }[want];
    if (alt && styles.includes(alt)) return alt;
    return styles.includes("Regular") ? "Regular" : styles[0];
  };
  const resolveFont = (fam, style) => {
    if (famSet.has(fam) && stylesOf(fam).includes(style)) return { family: fam, style };
    const role = roleFromFamily(fam);
    const proxy = ROLE_PROXY[role];
    const useFam = famSet.has(proxy) ? proxy : (famSet.has("Inter") ? "Inter" : (avail[0] && avail[0].fontName.family));
    return { family: useFam, style: pickStyle(useFam, style) };
  };
  const normalizeFonts = async (root, log) => {
    for (const t of root.findAll((n) => n.type === "TEXT")) {
      if (t.fontName !== figma.mixed) {
        const tf = resolveFont(t.fontName.family, t.fontName.style);
        await figma.loadFontAsync(tf);
        if (tf.family !== t.fontName.family || tf.style !== t.fontName.style) { t.fontName = tf; log.remapped++; }
      } else {
        for (const s of t.getStyledTextSegments(["fontName"])) {
          const tf = resolveFont(s.fontName.family, s.fontName.style);
          await figma.loadFontAsync(tf);
          t.setRangeFontName(s.start, s.end, tf); log.remapped++;
        }
      }
    }
  };

  // ── flatten: unwrap pure passthrough wrappers (keep padded spacers) ─────────
  const hasFill = (n) => Array.isArray(n.fills) && n.fills.some((f) => f.visible !== false);
  const hasStroke = (n) => Array.isArray(n.strokes) && n.strokes.length > 0;
  const hasPad = (n) => (n.paddingTop || 0) || (n.paddingRight || 0) || (n.paddingBottom || 0) || (n.paddingLeft || 0);
  const hasEffects = (n) => Array.isArray(n.effects) && n.effects.length > 0;
  // No fill AND no stroke → any cornerRadius is invisible, so it's ignored here
  // (this is what unwraps the single-text Button wrappers html.to.design emits).
  const isPassthrough = (n, root) => n.type === "FRAME" && n !== root && "children" in n && n.children.length === 1 &&
    !hasFill(n) && !hasStroke(n) && !hasEffects(n) && !hasPad(n);
  const flatten = (root, log) => {
    const unwrap = (n) => {
      const parent = n.parent, child = n.children[0], idx = parent.children.indexOf(n);
      const hS = n.layoutSizingHorizontal, vS = n.layoutSizingVertical;
      parent.insertChild(idx, child);
      try { child.layoutSizingHorizontal = hS; } catch (e) { /* structural context may reject */ }
      try { child.layoutSizingVertical = vS; } catch (e) { /* structural context may reject */ }
      n.remove(); log.unwrapped++;
    };
    for (let pass = 0; pass < 8; pass++) {
      const targets = root.findAll((n) => isPassthrough(n, root));
      if (!targets.length) break;
      for (const n of targets) if (n.parent) unwrap(n);
    }
    for (const n of root.findAll((n) => n.name.includes(":margin"))) n.name = n.name.replace(/:margin$/, "").trim();
  };

  // ── repairLayout: undo html.to.design's two conversion losses using the DOM ──
  // hints carried from the discover step (see export-to-figma.mjs extractLayoutHints):
  //   • hugHeight — the section is content-sized, but h2d bakes its rendered pixel
  //     height as a FIXED frame height → content pins to the top with a void below
  //     (and self-stretch columns collapse). Hug the root so it sizes to content.
  //   • textAlign — centered/right header text (mx-auto/text-center) came across
  //     left. Matched back to TEXT nodes by their own characters (case-insensitive),
  //     then the centering is restored WITHOUT disturbing left-aligned siblings
  //     (e.g. card captions): the text is set to fill+center, wrappers whose every
  //     text is centered get counter-axis center, and any constrained (max-width)
  //     ancestor on the centered path is re-centered within its parent (mx-auto).
  const normTxt = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const repairLayout = (root, hint, log) => {
    if (!hint) return;
    if (hint.hugHeight && root.layoutMode && root.layoutMode !== "NONE") {
      try {
        if (root.layoutMode === "VERTICAL") root.primaryAxisSizingMode = "AUTO";
        else root.counterAxisSizingMode = "AUTO";
        log.hugged++;
      } catch (e) { /* not resizable in this context */ }
    }
    const wants = new Map(); // normalized text → "CENTER" | "RIGHT"
    for (const t of hint.textAlign || []) wants.set(normTxt(t.text), t.align === "right" ? "RIGHT" : "CENTER");
    if (!wants.size) return;
    const matched = new Map(); // TEXT node → alignment
    for (const tn of root.findAll((n) => n.type === "TEXT")) {
      const chars = normTxt(tn.characters);
      if (!chars) continue;
      let hit = null;
      for (const [k, v] of wants) { const a = chars.slice(0, 40), b = k.slice(0, 40); if (a === b || chars.startsWith(b) || k.startsWith(a)) { hit = v; break; } }
      if (!hit) continue;
      try { tn.textAlignHorizontal = hit; } catch (e) {}
      try { if (tn.parent && tn.parent.layoutMode && tn.parent.layoutMode !== "NONE") tn.layoutSizingHorizontal = "FILL"; } catch (e) {}
      matched.set(tn, hit);
      log.aligned++;
    }
    if (!matched.size) return;
    for (const f of root.findAll((n) => n.type === "FRAME" && n.layoutMode && n.layoutMode !== "NONE")) {
      const texts = f.findAll((n) => n.type === "TEXT");
      const hasCentered = texts.some((t) => matched.get(t) === "CENTER");
      if (!hasCentered) continue;
      // Set counter-axis CENTER when EITHER: the frame holds nothing but centered
      // text (a pure header wrapper → centers the lines), OR every direct child is
      // FILL-width. The latter recovers a dropped mx-auto: a FILL+maxWidth child (the
      // header box, the max-width container) centers within its parent, while true
      // full-width siblings (the card grid) are unaffected — and a non-FILL left
      // sibling makes allChildrenFill false, so it's never wrongly centered. NOTE:
      // layoutAlign=CENTER does NOT work here — Figma ignores it on FILL children,
      // which these wrappers are; counter-axis alignment on the PARENT is the lever.
      const pureCentered = texts.length && texts.every((t) => matched.get(t) === "CENTER");
      const allChildrenFill = f.children.length && f.children.every((k) => k.layoutSizingHorizontal === "FILL");
      if (pureCentered || allChildrenFill) { try { f.counterAxisAlignItems = "CENTER"; } catch (e) {} }
    }
  };

  // ── 4. Post-process each capture, then componentize per block ───────────────
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  // group captures by block, preserving first-seen order
  const order = [];
  const byBlock = new Map();
  for (const c of MANIFEST.captures || []) {
    if (!byBlock.has(c.blockId)) { byBlock.set(c.blockId, { name: c.name, views: [] }); order.push(c.blockId); }
    byBlock.get(c.blockId).views.push(c);
  }

  const built = [];
  const skipped = [];
  const log = { bound: 0, remapped: 0, unwrapped: 0, hugged: 0, aligned: 0 };
  for (const blockId of order) {
    const blk = byBlock.get(blockId);
    // Idempotent: drop a prior set/component with this block name.
    for (const n of [...page.children]) if (n.name === blk.name && (n.type === "COMPONENT_SET" || n.type === "COMPONENT")) n.remove();

    const variants = [];
    for (const entry of blk.views) {
      const node = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
      if (!node) { skipped.push(`${blk.name}/${entry.view} (no node)`); continue; }
      // Move the capture onto this page if it isn't already.
      if (node.parent && node.parent.id !== page.id) page.appendChild(node);
      await normalizeFonts(node, log); // BEFORE any structural edit (font-load gate)
      const all = [node, ...node.findAll(() => true)];
      for (const n of all) { if ("fills" in n) bindPaints(n, "fills", log); if ("strokes" in n) bindPaints(n, "strokes", log); }
      flatten(node, log);
      repairLayout(node, entry.layout || (MANIFEST.layout && MANIFEST.layout[blockId]), log);
      node.name = `View=${cap(entry.view)}`;
      variants.push(figma.createComponentFromNode(node));
    }
    if (!variants.length) { skipped.push(`${blk.name} (0 variants)`); continue; }
    let result;
    if (variants.length === 1) { result = variants[0]; result.name = blk.name; }
    else { result = styleSet(figma.combineAsVariants(variants, page), blk.name); }
    // blockId + componentId are what the "compose" phase needs to instance this
    // block onto each design page (variables → components → blocks → PAGES).
    built.push({ blockId, block: blk.name, componentId: result.id, type: result.type, views: blk.views.map((v) => v.view) });
  }

  // Lay the blocks out down the page.
  let y = 80;
  for (const p of page.children.filter((n) => n.type === "COMPONENT_SET" || n.type === "COMPONENT")) { p.x = 80; p.y = y; y += p.height + 64; }

  return { phase: "blocks", page: MANIFEST.blockPageName, brandCollection: MANIFEST.brandCollectionName, variables: varResult, built, skipped, stats: log };
}

// ── PHASE "compose" — build ONE design Page from block INSTANCES ───────────────
//
// The top of the cascade: variables → components → blocks → PAGES. A design page
// is just its blocks stacked, so this composes each Figma design Page from
// INSTANCES of the Block Library component sets (right `View=` variant per
// breakpoint) — variable-bound (inherited from the blocks) and edit-cascading
// (edit a block master → every page updates). A designer never edits a Page except
// the copy inside a block. This REPLACES the old raw page-capture for design pages.
//
// ONE PAGE PER CALL: use_figma allows a single setCurrentPageAsync per call, so
// blocks are referenced by componentId (getNodeByIdAsync, no page switch) and the
// caller fans pages out in parallel — one compose call per design page.
//
// CONTRACT (prepend ABOVE this body):
//   const MANIFEST = { blockPageName, page: { id, name, route, blocks: [{ blockId,
//     name, componentId }] }, views: ["desktop","mobile"], widths: { desktop:1440,
//     mobile:390 } };
//   const PHASE = "compose";
// The block componentIds come from the PHASE "blocks" result (built[].componentId).
if (PHASE === "compose") {
  const pg = MANIFEST.page;
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const views = MANIFEST.views && MANIFEST.views.length ? MANIFEST.views : ["desktop"];
  const widths = MANIFEST.widths || {};
  const fallbackW = { desktop: 1440, tablet: 664, mobile: 390 };

  // Preload block master components by id (cross-page, no setCurrentPageAsync).
  const comps = {};
  for (const b of pg.blocks) comps[b.blockId] = b.componentId ? await figma.getNodeByIdAsync(b.componentId) : null;

  // Pick the component to instance for a given breakpoint (a set → its View variant;
  // a lone COMPONENT → itself).
  const pickVariant = (comp, view) => {
    if (!comp) return null;
    if (comp.type === "COMPONENT") return comp;
    if (comp.type === "COMPONENT_SET") return comp.children.find((c) => c.name === `View=${cap(view)}`) || comp.defaultVariant || comp.children[0];
    return null;
  };

  // Find-or-create this design Page, then switch to it (the one allowed switch).
  let dpage = figma.root.children.find((p) => p.name === pg.name);
  if (!dpage) { dpage = figma.createPage(); dpage.name = pg.name; }
  await figma.setCurrentPageAsync(dpage);
  // Idempotent: drop previously-composed frames for this page.
  for (const n of [...dpage.children]) if (n.name.startsWith(`${pg.name} — `)) n.remove();

  const frames = [];
  const missing = [];
  let x = 80;
  for (const view of views) {
    const w = widths[view] || fallbackW[view] || 1440;
    const frame = figma.createAutoLayout("VERTICAL");
    frame.name = `${pg.name} — ${cap(view)}`;
    frame.itemSpacing = 0; // sections stack flush; internal spacing lives in blocks
    frame.fills = [];
    frame.resize(w, 10);
    frame.layoutSizingHorizontal = "FIXED";
    frame.x = x; frame.y = 80;
    for (const b of pg.blocks) {
      const variant = pickVariant(comps[b.blockId], view);
      if (!variant) { missing.push(`${b.name || b.blockId}/${view}`); continue; }
      const inst = variant.createInstance();
      frame.appendChild(inst);
      inst.layoutSizingHorizontal = "FILL"; // full-width sections
    }
    frame.primaryAxisSizingMode = "AUTO"; // hug height
    frames.push({ view, id: frame.id, blocks: frame.children.length });
    x += w + 120;
  }
  return { phase: "compose", page: pg.name, frames, missing };
}
