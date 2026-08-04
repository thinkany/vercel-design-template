// resolve-fonts.mjs — the font side of the "design from a brief" extractor.
//
// Second extraction piece (docs/design-from-brief.md). Turns a brief's fonts —
// named Google Fonts ("Playfair Display, Inter") or "fonts from a site" — into
// everything the setup machinery needs: a verified @import, the `--ta-font-*`
// stacks, and a suggested role mapping (display / serif / sans / mono). Pure
// fetch + regex; no API key. Runnable in isolation.
//
//   node scripts/resolve-fonts.mjs "Playfair Display" "Inter" [--summary]
//   node scripts/resolve-fonts.mjs --from stripe.com [--summary]
//
// Default output is JSON on stdout (the orchestrator consumes it); `--summary`
// prints a human breakdown on stderr. A font that can't be verified on Google
// Fonts is dropped with a note (never a hard fail).

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 8000;

async function fetchText(url, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, ...headers },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- Google Fonts metadata (category + real weights), best-effort -----------
// Undocumented but key-free: the whole family catalog, XSSI-guarded with )]}'.
let _catalog = null;
async function loadCatalog() {
  if (_catalog !== null) return _catalog;
  const raw = await fetchText("https://fonts.google.com/metadata/fonts");
  if (!raw) return (_catalog = {});
  try {
    const json = JSON.parse(raw.replace(/^\)\]\}'/, ""));
    const map = {};
    for (const f of json.familyMetadataList || []) {
      const weights = Object.keys(f.fonts || {})
        .filter((k) => /^\d+$/.test(k))
        .map(Number)
        .sort((a, b) => a - b);
      map[f.family.toLowerCase()] = { family: f.family, category: f.category, weights };
    }
    return (_catalog = map);
  } catch {
    return (_catalog = {});
  }
}

// Google's category → a CSS generic fallback for the font stack.
function genericFor(category) {
  switch ((category || "").toLowerCase()) {
    case "serif": return "serif";
    case "display": return "sans-serif"; // display faces fall back to sans by convention
    case "handwriting": return "cursive";
    case "monospace": return "monospace";
    default: return "sans-serif"; // "sans serif" + unknown
  }
}

// Tiny fallback category map for when the catalog is unreachable.
const FALLBACK_CATEGORY = {
  "playfair display": "serif", georgia: "serif", lora: "serif", merriweather: "serif",
  inter: "sans serif", roboto: "sans serif", "open sans": "sans serif", montserrat: "sans serif",
  poppins: "sans serif", "work sans": "sans serif", oswald: "display", "bebas neue": "display",
  "jetbrains mono": "monospace", "roboto mono": "monospace", "space mono": "monospace",
};

const PREFERRED_WEIGHTS = [300, 400, 500, 600, 700];

// Resolve one named font → { name, found, category, generic, weights, family, stack, param }
async function resolveFont(name) {
  const catalog = await loadCatalog();
  const key = name.trim().toLowerCase();
  const meta = catalog[key];
  const category = meta?.category || FALLBACK_CATEGORY[key] || "sans serif";
  const family = meta?.family || titleCase(name);
  const generic = genericFor(category);

  // Choose weights actually available (from catalog); else a safe default set.
  let weights = meta?.weights?.length
    ? PREFERRED_WEIGHTS.filter((w) => meta.weights.includes(w))
    : [400, 700];
  if (!weights.length) weights = meta?.weights?.slice(0, 4) || [400];
  if (!weights.includes(400)) weights.unshift(400);
  weights = [...new Set(weights)].sort((a, b) => a - b);

  const param = `${family.replace(/\s+/g, "+")}:wght@${weights.join(";")}`;
  // Verify against the CSS2 endpoint (browser UA → real @font-face CSS on 200).
  const css = await fetchText(`https://fonts.googleapis.com/css2?family=${param}&display=swap`);
  const found = !!css && /@font-face/i.test(css);
  return {
    name,
    found,
    category,
    generic,
    weights,
    family,
    stack: `'${family}', ${generic}`,
    param,
  };
}

function titleCase(s) {
  return s.trim().replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// ---- "fonts from a site" — scrape font-family declarations -------------------
const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif",
  "ui-serif", "ui-monospace", "inherit", "initial", "unset", "-apple-system", "blinkmacsystemfont",
  "helvetica", "arial", "roboto", // keep roboto? it's real — but too generic to be a brand signal alone; still report
]);

async function scrapeSiteFonts(url) {
  const base = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const html = await fetchText(base, { accept: "text/html,*/*" });
  if (!html) return { families: [], notes: ["could not fetch the site"] };
  let css = html;
  // Pull a few linked stylesheets too.
  const links = [];
  const linkRe = /<link\b[^>]*rel\s*=\s*["']?[^"'>]*stylesheet[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html)) && links.length < 6) {
    const href = m[0].match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) try { links.push(new URL(href[1], base).href); } catch {}
  }
  const sheets = await Promise.all(links.map((u) => fetchText(u)));
  for (const s of sheets) if (s) css += "\n" + s;

  // Tally the first (primary) family in each font-family declaration.
  const counts = new Map();
  const ffRe = /font-family\s*:\s*([^;}{]+)/gi;
  while ((m = ffRe.exec(css))) {
    const first = m[1].split(",")[0].trim().replace(/["']/g, "").toLowerCase();
    if (!first || GENERIC_FAMILIES.has(first) || first.startsWith("var(")) continue;
    counts.set(first, (counts.get(first) || 0) + 1);
  }
  const families = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([family, count]) => ({ family: titleCase(family), count }));
  return { families, notes: families.length ? [] : ["no non-generic font families found"] };
}

// ---- role mapping ------------------------------------------------------------
// The template's four type roles: display (headings), serif (long-form), sans
// (UI), mono (code/numeric). Map resolved fonts by category; the first-named
// font anchors `display` since briefs usually lead with the headline face.
function assignRoles(fonts) {
  const ok = fonts.filter((f) => f.found);
  const byGeneric = (g) => ok.find((f) => f.generic === g);
  const roles = {};
  const put = (role, f) => {
    if (f) roles[role] = { token: `--ta-font-${role}`, name: f.family, stack: f.stack };
  };
  put("display", ok[0]); // headline face = first named
  put("serif", byGeneric("serif"));
  put("sans", byGeneric("sans-serif"));
  put("mono", byGeneric("monospace"));
  // If the display font is itself serif/sans, mirror it into that role too.
  if (ok[0] && !roles[ok[0].generic === "serif" ? "serif" : ok[0].generic === "monospace" ? "mono" : "sans"]) {
    const r = ok[0].generic === "serif" ? "serif" : ok[0].generic === "monospace" ? "mono" : "sans";
    put(r, ok[0]);
  }
  return roles;
}

function buildImport(fonts) {
  const ok = fonts.filter((f) => f.found);
  if (!ok.length) return { url: null, css: null };
  const url = `https://fonts.googleapis.com/css2?${ok.map((f) => "family=" + f.param).join("&")}&display=swap`;
  return { url, css: `@import url('${url}');` };
}

// ---- orchestration ----------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const summary = args.includes("--summary");
  const fromIdx = args.indexOf("--from");
  const fromUrl = fromIdx !== -1 ? args[fromIdx + 1] : null;
  const names = args.filter((a, i) => !a.startsWith("--") && !(fromIdx !== -1 && i === fromIdx + 1));

  const notes = [];
  let fromSite = null;
  let toResolve = names;

  if (fromUrl) {
    const scraped = await scrapeSiteFonts(fromUrl);
    fromSite = scraped.families;
    notes.push(...scraped.notes);
    // If no explicit names given, resolve the top scraped families as candidates.
    if (!names.length) toResolve = scraped.families.slice(0, 3).map((f) => f.family);
  }

  if (!toResolve.length && !fromUrl) {
    console.error('Usage: node scripts/resolve-fonts.mjs "Font Name" ["Second"] [--from url] [--summary]');
    process.exit(2);
  }
  if (!toResolve.length) notes.push("no Google-Fonts families found to resolve (the site may use system fonts)");

  const fonts = [];
  for (const n of toResolve) fonts.push(await resolveFont(n));
  for (const f of fonts) if (!f.found) notes.push(`"${f.name}" not verified on Google Fonts — dropped from @import`);

  const result = {
    input: { names, fromUrl },
    fonts,
    fromSite,
    import: buildImport(fonts),
    roles: assignRoles(fonts),
    notes,
  };

  if (summary) printSummary(result);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function printSummary(r) {
  const e = console.error;
  e("\nFonts resolved:");
  for (const f of r.fonts) {
    e(`  ${f.found ? "✓" : "✗"} ${f.family}  [${f.category}]  weights ${f.weights.join(",")}  → ${f.stack}`);
  }
  if (r.fromSite) {
    e("\n  Scraped from site:");
    for (const s of r.fromSite) e(`    ${s.family}  ×${s.count}`);
  }
  e("\n  Role mapping (--ta-font-*):");
  for (const [role, v] of Object.entries(r.roles)) e(`    ${(role + ":").padEnd(9)} ${v.name}  → ${v.stack}`);
  if (r.import.css) e("\n  @import:\n    " + r.import.css);
  if (r.notes.length) e("\n  notes: " + r.notes.join("; "));
  e("");
}

main();
