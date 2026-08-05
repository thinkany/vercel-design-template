// extract-layout.mjs — the section-outline (layout) extractor.
//
// The third leg of the "design from a brief" extract tripod (colors + fonts +
// STRUCTURE — see docs/design-brief-research.md). Give it a reference URL and it
// returns that page's section skeleton: an ordered list of sections with a type
// (hero / features / pricing / testimonial / logos / faq / cta / footer), a
// heading, layout hints (stack / columns / grid, column & item counts), and the
// nav pattern. So a brief like "a site like stripe.com" models the real structure
// instead of the agent eyeballing it. Pure fetch + a zero-dep HTML parse + rules;
// no browser, screenshots, or API keys. Runnable in isolation.
//
//   node scripts/extract-layout.mjs <url> [--summary]
//
// Default output is JSON on stdout (the orchestrator parses it). `--summary` adds
// a human-readable outline on stderr. Exit non-zero only on a usage error or a
// total fetch failure — a thin page still yields a best-effort outline.
//
// The output schema is deliberately wireframe-friendly: each section is a labeled
// box with a layout + counts, so the same JSON can drive a future low-fi wireframe
// view, not just the design step.

// ---- fetch layer (mirrors extract-palette.mjs) ------------------------------
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2_500_000;

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,*/*" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf.slice(0, MAX_BYTES)).toString("utf8");
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- zero-dep HTML parse ----------------------------------------------------
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"]);
// Elements whose contents carry no structural signal — dropped before parsing.
const DROP = /<!--[\s\S]*?-->|<(script|style|svg|noscript|template|head)\b[\s\S]*?<\/\1>/gi;

// Build a minimal DOM: nodes are { tag, attrs, children:[], text }. Lenient about
// messy markup — void elements never nest, and a stray close tag pops to its match.
function parseHtml(html) {
  const clean = html.replace(DROP, " ");
  const root = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>|([^<]+)/g;
  let m;
  while ((m = tokenRe.exec(clean))) {
    const top = stack[stack.length - 1];
    if (m[3] !== undefined) { // text run
      const t = m[3].replace(/\s+/g, " ");
      if (t.trim()) top.text += t;
      continue;
    }
    const tag = m[1].toLowerCase();
    const isClose = m[0][1] === "/";
    if (isClose) {
      // pop to the matching open tag (tolerate mismatches)
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const node = { tag, attrs: parseAttrs(m[2]), children: [], text: "" };
    top.children.push(node);
    const selfClose = m[0].endsWith("/>") || VOID.has(tag);
    if (!selfClose) stack.push(node);
  }
  return root;
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let m;
  while ((m = re.exec(s || ""))) {
    const v = m[2] ? m[2].replace(/^["']|["']$/g, "") : "";
    attrs[m[1].toLowerCase()] = v;
  }
  return attrs;
}

// ---- tree helpers -----------------------------------------------------------
const els = (n) => n.children.filter((c) => c.tag[0] !== "#");
function find(node, pred, out = []) {
  for (const c of els(node)) { if (pred(c)) out.push(c); find(c, pred, out); }
  return out;
}
function firstOf(node, tags) {
  const set = new Set(tags);
  return find(node, (n) => set.has(n.tag))[0] || null;
}
// All text under a node (bounded), lowercased for signal matching.
function deepText(node, cap = 4000) {
  let out = node.text || "";
  for (const c of els(node)) {
    if (out.length > cap) break;
    out += " " + deepText(c, cap);
  }
  return out.slice(0, cap);
}
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
function textOf(node) { return decode(deepText(node, 200)).replace(/\s+/g, " ").trim(); }
const cls = (n) => (n.attrs.class || "") + " " + (n.attrs.id || "");

// Collapse pure wrapper divs (single element child, no own text) to their content.
function unwrap(node) {
  let n = node, guard = 0;
  while (guard++ < 12) {
    const kids = els(n);
    if (kids.length === 1 && !(n.text || "").trim() && /^(div|span|a)$/.test(n.tag)) n = kids[0];
    else break;
  }
  return n;
}

// The repeated-block count of a section: the largest group of same-tag siblings
// among its immediate structural children (→ grid/columns item count).
function repeatCount(node) {
  let best = 0;
  const scan = (n, depth) => {
    if (depth > 4) return;
    const kids = els(n);
    const byTag = {};
    for (const k of kids) byTag[k.tag] = (byTag[k.tag] || 0) + 1;
    for (const t in byTag) if (byTag[t] > best && kids.length >= 2) best = byTag[t];
    for (const k of kids) scan(k, depth + 1);
  };
  scan(node, 0);
  return best;
}

// ---- classification ---------------------------------------------------------
const CTA_RE = /\b(get started|sign up|start free|try (it|for)|book a|contact sales|request a demo|buy now|subscribe|join)\b/i;

function classify(node, index, total) {
  const text = deepText(node).toLowerCase();
  const heading = (firstOf(node, ["h1", "h2", "h3"]) && textOf(firstOf(node, ["h1", "h2", "h3"]))) || "";
  const imgs = find(node, (n) => n.tag === "img").length;
  const links = find(node, (n) => n.tag === "a").length;
  const hasH1 = !!firstOf(node, ["h1"]);
  const hasCta = CTA_RE.test(text) || find(node, (n) => n.tag === "button").length > 0;
  const items = repeatCount(node);
  const c = cls(node).toLowerCase();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Pricing needs an explicit billing-period phrase — bare "$" figures and the
  // words "pricing"/"plan" litter marketing copy and cause false positives.
  const strongPrice = /\bper (month|year)\b|\/mo\b|\/yr\b|billed (annually|monthly)/.test(text);
  const c2 = c + " " + heading.toLowerCase();
  const quoteBlocks = (deepText(node).match(/[""][^""]{15,}[""]/g) || []).length;

  let type = "section", confidence = 0.4;
  if (node.tag === "footer" || (isLast && links > 8 && imgs <= 3)) { type = "footer"; confidence = 0.9; }
  else if (isFirst && heading) { type = "hero"; confidence = 0.85; }               // the first headed section is the hero
  else if (strongPrice && items >= 2) { type = "pricing"; confidence = 0.8; }
  else if (/\bfaq\b|frequently asked/.test(c2) || find(node, (n) => n.tag === "details").length >= 2) { type = "faq"; confidence = 0.8; }
  else if (/\btestimonials?\b|loved by|customers? say|in their words/.test(c2) || quoteBlocks >= 2) { type = "testimonial"; confidence = 0.7; }
  else if (imgs >= 3 && (/\b(trusted by|as seen|our (customers|partners)|companies|logos|backed by)\b/.test(c2) || textOf(node).length < 40)) { type = "logos"; confidence = 0.75; }
  else if (items >= 3) { type = "features"; confidence = 0.7; }
  else if (hasCta && textOf(node).length < 140 && imgs <= 1) { type = "cta"; confidence = 0.65; }

  // layout hint
  let layout = "stack", columns = 1;
  if (type === "hero" && imgs >= 1 && els(unwrap(node)).length >= 2) { layout = "columns"; columns = 2; }
  else if (items >= 3) { layout = "grid"; columns = Math.min(items, 4); }
  else if (els(unwrap(node)).length === 2) { layout = "columns"; columns = 2; }

  return {
    type,
    heading: heading.slice(0, 80),
    layout,
    columns,
    items: type === "features" || type === "pricing" ? items : 0,
    hasImage: imgs > 0,
    hasCta,
    confidence,
  };
}

// ---- nav --------------------------------------------------------------------
function extractNav(root) {
  const nav = firstOf(root, ["nav"]) || firstOf(root, ["header"]);
  if (!nav) return { pattern: "none", items: [] };
  const linkNodes = find(nav, (n) => n.tag === "a");
  const items = [];
  for (const a of linkNodes) {
    const t = textOf(a);
    if (t && t.length <= 24 && !/^https?:/.test(t) && !items.includes(t)) items.push(t);
    if (items.length >= 8) break;
  }
  // Nested lists/panels under nav items → dropdown/mega.
  const lists = find(nav, (n) => n.tag === "ul").length;
  const panels = find(nav, (n) => /mega|dropdown|submenu|flyout/.test(cls(n))).length;
  let pattern = "simple";
  if (panels > 0) pattern = "mega";
  else if (lists > 1) pattern = "dropdown";
  return { pattern, items };
}

// ---- section identification -------------------------------------------------
function extractSections(root) {
  const body = firstOf(root, ["body"]) || root;
  const main = firstOf(body, ["main"]) || body;
  // Candidate sections = semantic containers + significant top-level children.
  const SECTION_TAGS = new Set(["section", "header", "footer", "article", "aside"]);
  const raw = [];
  const walk = (node, depth) => {
    for (const child of els(node)) {
      if (child.tag === "nav" || child.tag === "script" || child.tag === "style") continue;
      const u = unwrap(child);
      const isSemantic = SECTION_TAGS.has(u.tag);
      const hasHeading = !!firstOf(u, ["h1", "h2", "h3"]);
      const heavy = els(u).length >= 2 || deepText(u, 300).trim().length > 80;
      if (isSemantic || (hasHeading && heavy)) {
        raw.push(u);
      } else if (depth < 3 && els(u).length) {
        walk(u, depth + 1); // descend through layout wrappers
      }
    }
  };
  walk(main, 0);
  // De-dupe nested captures (keep the outer of any ancestor/descendant pair).
  const kept = raw.filter((n, i) => !raw.some((o, j) => j !== i && contains(o, n)));
  return kept;
}
function contains(a, b) {
  if (a === b) return false;
  let found = false;
  find(a, (n) => { if (n === b) found = true; return false; });
  return found;
}

// ---- main -------------------------------------------------------------------
function titleOf(root) {
  const h1 = firstOf(root, ["h1"]);
  return (h1 && textOf(h1)) || "";
}

async function main() {
  const args = process.argv.slice(2);
  const summary = args.includes("--summary");
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    process.stderr.write("usage: node scripts/extract-layout.mjs <url> [--summary]\n");
    process.exit(2);
  }
  const full = /^https?:\/\//.test(url) ? url : "https://" + url;
  const html = await fetchText(full);
  const notes = [];
  if (!html) {
    process.stderr.write(`Could not fetch ${full}\n`);
    process.exit(1);
  }
  const root = parseHtml(html);
  const nav = extractNav(root);
  const sectionNodes = extractSections(root);
  const sections = sectionNodes.map((n, i) => classify(n, i, sectionNodes.length));
  if (sections.length < 2) notes.push("Thin server HTML (likely an SPA) — structure may be partial; treat as a rough outline.");

  const out = { url: full, title: titleOf(root), nav, sections, notes };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");

  if (summary) {
    const lines = [];
    lines.push(`\nSection outline — ${full}`);
    lines.push(`nav: ${nav.pattern}${nav.items.length ? " [" + nav.items.join(", ") + "]" : ""}`);
    sections.forEach((s, i) => {
      const meta = [s.layout + (s.columns > 1 ? `×${s.columns}` : ""), s.items ? `${s.items} items` : "", s.hasImage ? "img" : "", s.hasCta ? "cta" : ""].filter(Boolean).join(", ");
      lines.push(`  ${i + 1}. ${s.type.padEnd(12)} ${s.heading ? "“" + s.heading + "” " : ""}(${meta})`);
    });
    if (notes.length) lines.push("notes: " + notes.join(" "));
    process.stderr.write(lines.join("\n") + "\n");
  }
}

main();
