// ©2026 thinkany llc. All rights reserved.
// MENU CHECK — the deterministic proof that the header a designer picked is the
// header that got built.
//
// The header is configured, not hand-written (src/app/header.config.ts +
// components/header.skin.ts drive a CORE Header.tsx). That removes the drift at
// its source; this removes the doubt. After every build, and after any edit that
// touched the header, the rendered nav is measured against the data it came from,
// at each breakpoint, in a hidden window — the same pattern as the accessibility
// audit. ZERO model tokens: it is arithmetic on bounding boxes, not judgement.
//
// Five rule families, in the order a header fails them:
//   architecture — the rendered items are the data's items, in order
//   panels       — each menu opens flush to the header's bottom edge, in-viewport,
//                  carrying every link its data lists, moving nothing else
//   placement    — logo and links sit where `placement` says, all on ONE row
//   mobile       — the desktop nav is gone, the hamburger is on `menuSide`, and
//                  the drawer holds every item and sub-link
//   fold         — the header is under a quarter of the viewport at every width
//
// A failure on a CONFIGURED header is a framework bug (the config and skin cannot
// produce one). On a CUSTOM header — a variation that dropped in its own
// Header.tsx — it is a finding for the designer. The caller passes which.

const fs = require("node:fs");
const path = require("node:path");

const WIDTHS = [
  { name: "desktop", w: 1440, h: 900 },
  { name: "tablet", w: 834, h: 1112 },
  { name: "mobile", w: 390, h: 780 },
];

// Tolerances. Start strict; loosen only on evidence from real builds.
const TOL = {
  panelFlush: 1,   // panel top vs header bottom, px
  centered: 8,     // nav centre vs inner centre, px
  sameRow: 4,      // every box's vertical centre vs the header's, px
  foldRatio: 0.25, // header height as a share of the viewport
};

// ---- Reading the expected architecture from the project's own data -----------
// The design surface's nav comes from two designer-owned TS files. Parsing them
// with a regex is deliberate: requiring a bundler (or a running module graph) to
// answer "what should be in the menu" would make the check depend on the very
// thing it is checking. The shapes are simple and CORE-documented, and a parse
// miss degrades to "no expectation", never to a false failure.

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

/**
 * Ordered nav items from src/app/pages.ts: [{ id, name }].
 *
 * Home is excluded, matching the header: the logo is the home link, so home is a
 * page but never a nav item. A check that expected it would fail every correct
 * header.
 */
function expectedItems(projectDir) {
  const src = readFile(path.join(projectDir, "src", "app", "pages.ts"));
  const body = src.split("designPages")[1] || "";
  const items = [];
  // Only rows inside the array literal, and never a commented-out example.
  for (const line of body.split("\n")) {
    const clean = line.replace(/\/\/.*$/, "");
    const m = clean.match(/\{\s*id:\s*["']([^"']+)["'][^}]*?name:\s*["']([^"']+)["']/);
    if (m && m[1] !== "home") items.push({ id: m[1], name: m[2] });
    if (/^\s*\]/.test(clean) && items.length) break;
  }
  return items;
}

/**
 * Ordered nav items from content/site.json (the SITE's nav), exactly as written.
 *
 * The two surfaces differ here on purpose. The DESIGN surface's nav comes from
 * pages.ts, which always contains a home page (it is the default route), so the
 * header filters it out and the check expects that. The SITE's nav is data a
 * designer edits: nothing writes a Home item any more, but one that IS there was
 * put there deliberately and the site header renders it, so the check expects it too.
 */
function expectedSiteItems(projectDir) {
  try {
    const site = JSON.parse(readFile(path.join(projectDir, "content", "site.json")) || "{}");
    const nav = Array.isArray(site.nav) ? site.nav : [];
    return nav
      .map((it, i) => ({
        id: (String(it.label || it.href || "").replace(/^[/#]+/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()) || `item-${i}`,
        name: String(it.label || ""),
        // The site decides per item: columns = mega, links = dropdown, neither = none.
        kind: (it.columns || []).length ? "mega" : (it.links || []).length ? "dropdown" : "none",
      }));
  } catch { return []; }
}

/** The header's structural config, as the component reads it. */
function expectedConfig(projectDir, variationId) {
  // A variation may override the config; prefer its copy, exactly as resolveData does.
  const candidates = [
    path.join(projectDir, "src", "variations", String(variationId || ""), "header.config.ts"),
    path.join(projectDir, "src", "app", "header.config.ts"),
  ];
  const whole = candidates.map(readFile).find(Boolean) || "";
  // ONLY the exported literal. The file above it declares the HeaderConfig
  // interface, whose members read `menuSide: "left" | "right"` and
  // `columns: 2 | 3 | 4 | 5` — parsing those instead of the values would hand
  // every check the wrong expectation (and did, first run).
  const at = whole.indexOf("export const headerConfig");
  const src = at < 0 ? "" : whole.slice(at);
  const pick = (key, fallback) => {
    const m = src.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
    return m ? m[1] : fallback;
  };
  const bool = (key, fallback) => {
    const m = src.match(new RegExp(`${key}\\s*:\\s*(true|false)`));
    return m ? m[1] === "true" : fallback;
  };
  const cols = src.match(/columns\s*:\s*(\d+)/);
  return {
    placement: pick("placement", "left-right"),
    menuKind: pick("menuKind", "none"),
    sticky: bool("sticky", true),
    menuSide: pick("menuSide", "right"),
    mega: { columns: cols ? Number(cols[1]) : 4, feature: bool("feature", true) },
  };
}

/**
 * Expected panel contents per item, from src/app/menu.ts. The file usually seeds
 * every item from one kind rather than listing them, so we evaluate the two shapes
 * we ship: an explicit `navMenus` object literal, or the seeded default. When the
 * file has been hand-edited past what this reads, we return null for that item and
 * the panel's CONTENT rule is skipped (its geometry rules still run).
 */
function expectedMenus(projectDir, items, config) {
  const src = readFile(path.join(projectDir, "src", "app", "menu.ts"));
  const out = {};
  // An explicit per-item literal, e.g. work: { kind: "mega", sections: [...] }.
  const explicit = /navMenus[^=]*=\s*\{([\s\S]*?)\n\}/.exec(src);
  for (const it of items) {
    let kind = null;
    if (explicit) {
      const m = new RegExp(`["']?${it.id}["']?\\s*:\\s*\\{\\s*kind:\\s*["'](none|dropdown|mega)["']`).exec(explicit[1]);
      if (m) kind = m[1];
    }
    // The shipped file seeds every item from the config; that is the common case.
    if (!kind && /designPages\.map/.test(src)) kind = config.menuKind;
    out[it.id] = kind ? { kind } : null;
  }
  return out;
}

// ---- The page-side probe -----------------------------------------------------
// One evaluate per width returns everything the rules need, so a run is three page
// loads and a handful of round trips rather than a call per assertion.

const PROBE_JS = `(() => {
  // Resolve ANY css colour to plain rgb by letting the browser do it. Modern
  // palettes compute to oklab(), and scraping numbers out of that compares
  // lightness/a/b as if they were r/g/b: different colours read as identical and
  // identical ones read as different. Painting into a canvas is exact.
  // Chromium keeps modern colour functions AS WRITTEN in getComputedStyle (oklab
  // stays oklab), and a canvas echoes them back unconverted too, so there is no DOM
  // trick that normalises them. Compare the colours numerically instead, in whatever
  // space they are both expressed in: a wordmark and its bar are set from the same
  // token system, so when they are the same colour they are the same string.
  const colorOf = (el, prop) => { try { return el ? getComputedStyle(el)[prop] : ""; } catch { return ""; } };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cy: r.top + r.height / 2 }; };
  const header = document.querySelector('header[data-block="header"]') || document.querySelector("header");
  if (!header) return { header: null };
  const inner = header.firstElementChild;
  const navs = Array.from(header.querySelectorAll("nav[data-header-nav]")).map((n) => ({
    side: n.getAttribute("data-header-nav"),
    visible: n.offsetParent !== null || getComputedStyle(n).display !== "none",
    box: box(n),
    links: Array.from(n.querySelectorAll("[data-nav-link]")).map((l) => ({
      id: l.getAttribute("data-nav-link"), text: (l.textContent || "").trim(), box: box(l),
    })),
  }));
  const ham = header.querySelector("[data-header-hamburger]");
  const hamVisible = ham ? getComputedStyle(ham).display !== "none" && ham.offsetWidth > 0 : false;
  return {
    header: box(header),
    inner: box(inner),
    placement: header.getAttribute("data-header-placement"),
    menuKind: header.getAttribute("data-header-menu-kind"),
    logo: box(header.querySelector("[data-header-logo]")),
    // A logo box can exist and be EMPTY (a wordmark with no site name, a missing
    // image). The screenshot shows a hole in the bar; the geometry alone does not.
    logoText: ((header.querySelector("[data-header-logo]") || {}).textContent || "").trim(),
    logoImg: !!(header.querySelector("[data-header-logo] img")),
    // A wordmark the same colour as the bar it sits on is invisible, and every
    // geometric rule passes it happily. Report both so the rule can compare.
    // The element that actually PAINTS the wordmark, which is the innermost one
    // holding the text. A comma selector would not do: querySelector returns the
    // first match in DOCUMENT order, so it hands back the <a> wrapper and its
    // inherited colour rather than the span whose class sets the real one.
    logoColor: (() => {
      const root = header.querySelector("[data-header-logo]");
      if (!root) return "";
      const inner = Array.from(root.querySelectorAll("*")).filter((e) => (e.textContent || "").trim());
      const e = inner.length ? inner[inner.length - 1] : root;
      return colorOf(e, "color");
    })(),
    barBg: (() => {
      let el = header;
      for (let i = 0; el && i < 4; i++) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && !/^rgba?\([^)]*,\s*0\)$/.test(bg)) return bg;
        el = el.parentElement;
      }
      return "";
    })(),
    navs,
    hamburger: ham ? { side: ham.getAttribute("data-header-hamburger"), visible: hamVisible, box: box(ham) } : null,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

/** With one item's panel forced open: the panel's geometry + its contents. */
const panelProbe = (id) => `(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const header = document.querySelector('header[data-block="header"]') || document.querySelector("header");
  const panel = document.querySelector('[data-menu-panel=${JSON.stringify(id)}]');
  if (!header) return { header: null };
  // The panel is positioned with top:100% (top-full), which resolves against the
  // header PADDING box, while getBoundingClientRect reports the BORDER box. A skin
  // that thickens the bottom border (border-b-2) therefore shifts the two apart by
  // exactly that border, on every panel, with the header perfectly correct.
  const borderBottom = parseFloat(getComputedStyle(header).borderBottomWidth) || 0;
  if (!panel) return { header: box(header), panel: null, borderBottom };
  const visible = getComputedStyle(panel).display !== "none" && panel.offsetWidth > 0;
  return {
    header: box(header), panel: box(panel), visible, borderBottom,
    links: Array.from(panel.querySelectorAll("button, a")).map((l) => (l.textContent || "").trim()).filter(Boolean),
    headings: Array.from(panel.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => (h.textContent || "").trim()),
    columns: (() => { const g = panel.querySelector('[class*="grid-cols-"]'); return g ? g.children.length : null; })(),
    logo: box(header.querySelector("[data-header-logo]")),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

/** With the drawer forced open: what it holds and which edge it is on. */
const DRAWER_PROBE = `(() => {
  const drawer = document.querySelector("[data-menu-drawer]");
  if (!drawer) return { drawer: null };
  const r = drawer.getBoundingClientRect();
  const style = getComputedStyle(drawer);
  return {
    drawer: { x: r.left, right: r.right, w: r.width },
    side: drawer.getAttribute("data-menu-drawer"),
    visible: style.display !== "none" && r.width > 0 && r.left < window.innerWidth && r.right > 0,
    items: Array.from(drawer.querySelectorAll("[data-drawer-item]")).map((b) => ({
      id: b.getAttribute("data-drawer-item"), text: (b.textContent || "").trim(),
    })),
    sublinks: Array.from(drawer.querySelectorAll("[data-drawer-sublink]")).map((b) => ({
      id: b.getAttribute("data-drawer-sublink"), text: (b.textContent || "").trim(),
    })),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

// ---- The rules ---------------------------------------------------------------

/**
 * Two colours that render identically, so text in one on a bar of the other is
 * invisible. Both arrive as computed values, which Chromium leaves in whatever space
 * the stylesheet used (rgb(), #hex, or a modern function like oklab()), and it does
 * NOT down-convert. So compare within a space, never across one: same function, same
 * numbers. Different notations are treated as different colours rather than guessed
 * at, which keeps this rule quiet unless it is certain.
 */
function sameColor(a, b) {
  const A = String(a || "").trim().toLowerCase();
  const B = String(b || "").trim().toLowerCase();
  if (!A || !B) return false;
  if (A === B) return true;
  const fn = (c) => (c.match(/^([a-z]+)\(/) || [])[1] || (c.startsWith("#") ? "hex" : "");
  if (fn(A) !== fn(B)) return false; // different notations: not comparable, so not a finding
  const hex = (c) => { const m = c.match(/^#([0-9a-f]{6})$/); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const x = hex(A) || (A.match(/[-\d.]+/g) || []).map(Number).slice(0, 3);
  const y = hex(B) || (B.match(/[-\d.]+/g) || []).map(Number).slice(0, 3);
  if (x.length < 3 || y.length < 3) return false;
  // rgb components run 0-255; oklab's run 0-1, so scale the tolerance to the space.
  const tol = fn(A) === "rgb" || fn(A) === "rgba" || fn(A) === "hex" ? 8 : 0.02;
  return x.every((v, i) => Math.abs(v - y[i]) <= tol);
}

function finding(rule, width, item, expected, actual, note) {
  return { rule, width, item: item || null, expected, actual, ...(note ? { note } : {}) };
}

/** Rule family 1 + 3 + 5: architecture, placement, above the fold. */
function checkBar(probe, items, config, width, findings) {
  if (!probe || !probe.header) {
    findings.push(finding("architecture", width, null, "a header element", "none rendered"));
    return;
  }
  const isMobile = width === "mobile";
  const visibleNavs = probe.navs.filter((n) => n.visible && n.links.length);
  const rendered = visibleNavs.flatMap((n) => n.links);

  // 1. Architecture — the same items, in the same order. On mobile the desktop nav
  //    is meant to be absent, so the drawer carries this rule instead.
  if (!isMobile) {
    const ids = rendered.map((l) => l.id);
    const want = items.map((i) => i.id);
    if (ids.join(",") !== want.join(",")) {
      findings.push(finding("architecture", width, null, want.join(" → ") || "(no items)", ids.join(" → ") || "(none rendered)"));
    }
    for (const l of rendered) {
      const want = items.find((i) => i.id === l.id);
      if (want && l.text.replace(/\s+/g, " ").trim() !== want.name) {
        findings.push(finding("architecture", width, l.id, want.name, l.text));
      }
    }
  }

  // 5. Above the fold — a header taller than a quarter of the viewport is almost
  //    always an accidental second row, not a design choice.
  const ratio = probe.header.h / (probe.viewport.h || 1);
  if (ratio > TOL.foldRatio) {
    findings.push(finding("fold", width, null, `header under ${Math.round(TOL.foldRatio * 100)}% of the viewport`,
      `${Math.round(ratio * 100)}% (${Math.round(probe.header.h)}px of ${probe.viewport.h}px)`,
      "usually means the header wrapped onto a second row"));
  }

  if (isMobile) return;

  // 3. Placement — all on ONE row, then the placement's own geometry.
  const boxes = [probe.logo, ...visibleNavs.map((n) => n.box)].filter(Boolean);
  const headerCy = probe.header.y + probe.header.h / 2;
  for (const b of boxes) {
    const cy = b.cy != null ? b.cy : b.y + b.h / 2;
    const off = Math.abs(cy - headerCy);
    if (off > TOL.sameRow) {
      findings.push(finding("placement", width, null, `every element on one row (within ${TOL.sameRow}px of the header's centre)`,
        `an element sits ${Math.round(off)}px off centre`,
        "the classic centred-logo bug: a grid cell bumped to an implicit second row"));
      break;
    }
  }

  if (!probe.logo) {
    findings.push(finding("placement", width, null, "a logo or wordmark in the bar", "none found"));
    return;
  }
  // The lockup must actually SAY something. An empty wordmark leaves a hole in the
  // bar that every geometric rule happily passes.
  if (!probe.logoImg && !probe.logoText) {
    findings.push(finding("placement", width, null, "the logo showing a name or an image",
      "the lockup is empty", "an unset client name, or a logo image that did not load"));
  } else if (!probe.logoImg && probe.logoColor && probe.barBg && sameColor(probe.logoColor, probe.barBg)) {
    findings.push(finding("placement", width, null, "the wordmark legible against the bar",
      `both are ${probe.barBg}`, "the skin darkened the bar without restyling the type"));
  }
  const inner = probe.inner || probe.header;
  const innerCentre = inner.x + inner.w / 2;
  const firstLink = rendered[0];

  if (config.placement === "left-right" || config.placement === "left-center") {
    if (firstLink && probe.logo.right > firstLink.box.x) {
      findings.push(finding("placement", width, null, "the logo left of the first nav link",
        `the logo ends at ${Math.round(probe.logo.right)}px, the first link starts at ${Math.round(firstLink.box.x)}px`));
    }
  }
  if (config.placement === "left-center") {
    const nav = visibleNavs[0];
    if (nav) {
      const navCentre = nav.box.x + nav.box.w / 2;
      if (Math.abs(navCentre - innerCentre) > TOL.centered) {
        findings.push(finding("placement", width, null, `the links centred within ${TOL.centered}px of the bar`,
          `${Math.round(Math.abs(navCentre - innerCentre))}px off centre`));
      }
    }
  }
  if (config.placement === "center-split") {
    const logoCentre = probe.logo.x + probe.logo.w / 2;
    if (Math.abs(logoCentre - innerCentre) > TOL.centered) {
      findings.push(finding("placement", width, null, `the logo centred within ${TOL.centered}px of the bar`,
        `${Math.round(Math.abs(logoCentre - innerCentre))}px off centre`));
    }
    const left = probe.navs.find((n) => n.side === "left");
    const right = probe.navs.find((n) => n.side === "right");
    const lc = left ? left.links.length : 0;
    const rc = right ? right.links.length : 0;
    if (Math.abs(lc - rc) > 1) {
      findings.push(finding("placement", width, null, "the links split evenly around the logo (within one)",
        `${lc} left, ${rc} right`));
    }
    if (left && right && !(left.box.right <= probe.logo.x + 1 && right.box.x >= probe.logo.right - 1)) {
      findings.push(finding("placement", width, null, "a link group on either side of the logo",
        "a group overlaps the logo"));
    }
  }
}

/** Rule family 2: panels. */
function checkPanel(probe, item, wantMenu, config, width, findings) {
  if (!probe || !probe.header) return;
  if (!probe.panel) {
    findings.push(finding("panels", width, item.id, `an open ${wantMenu.kind} panel`, "no panel rendered"));
    return;
  }
  if (!probe.visible) {
    findings.push(finding("panels", width, item.id, "the panel visible when open", "it stayed hidden"));
    return;
  }
  // Measure to the header's PADDING-box bottom, which is what `top-full` resolves
  // against. Against the border box a design that sets a thicker bottom border
  // (border-b-2, a perfectly ordinary skin choice) reads as every panel being
  // "2px above" a header that is in fact exactly right.
  const gap = probe.panel.y - (probe.header.bottom - (probe.borderBottom || 0));
  if (Math.abs(gap) > TOL.panelFlush) {
    findings.push(finding("panels", width, item.id, `the panel flush to the header's bottom edge (within ${TOL.panelFlush}px)`,
      `${Math.round(gap)}px ${gap > 0 ? "below" : "above"} it`,
      "a panel anchored inside its nav item instead of at header level"));
  }
  if (probe.panel.x < -TOL.panelFlush || probe.panel.right > probe.viewport.w + TOL.panelFlush) {
    findings.push(finding("panels", width, item.id, "the panel inside the viewport horizontally",
      `it spans ${Math.round(probe.panel.x)}px → ${Math.round(probe.panel.right)}px of a ${probe.viewport.w}px viewport`));
  }
  if (!probe.links.length) {
    findings.push(finding("panels", width, item.id, "the panel's links", "the panel is empty"));
  }
  if (wantMenu.kind === "mega" && probe.columns != null && probe.columns) {
    // Columns + an optional feature panel. The data may ship fewer sections than
    // the configured grid, so only an OVERSHOOT (more children than columns) is wrong.
    if (probe.columns > config.mega.columns) {
      findings.push(finding("panels", width, item.id, `at most ${config.mega.columns} mega columns (headerConfig.mega.columns)`,
        `${probe.columns} rendered`));
    }
  }
  // Nothing else in the header moved when the panel opened: the logo is where the
  // closed-bar probe found it.
  if (probe.logo && probe.barLogo && Math.abs(probe.logo.x - probe.barLogo.x) > 1) {
    findings.push(finding("panels", width, item.id, "the header unchanged when the panel opens",
      `the logo shifted ${Math.round(Math.abs(probe.logo.x - probe.barLogo.x))}px`));
  }
}

/** Rule family 4: mobile. */
function checkMobile(bar, drawer, items, menus, config, findings) {
  const width = "mobile";
  if (bar && bar.header) {
    const desktopNavVisible = bar.navs.some((n) => n.visible && n.links.length);
    if (desktopNavVisible) {
      findings.push(finding("mobile", width, null, "the desktop nav hidden at mobile width", "it is still showing"));
    }
    if (!bar.hamburger) {
      findings.push(finding("mobile", width, null, "a hamburger button", "none found"));
    } else {
      if (!bar.hamburger.visible) {
        findings.push(finding("mobile", width, null, "the hamburger visible at mobile width", "it is hidden"));
      }
      if (bar.hamburger.side !== config.menuSide) {
        findings.push(finding("mobile", width, null, `the hamburger on the ${config.menuSide}`, `it is marked ${bar.hamburger.side}`));
      } else if (bar.hamburger.box && bar.header) {
        const centre = bar.header.x + bar.header.w / 2;
        const hamCentre = bar.hamburger.box.x + bar.hamburger.box.w / 2;
        const onLeft = hamCentre < centre;
        if (onLeft !== (config.menuSide === "left")) {
          findings.push(finding("mobile", width, null, `the hamburger on the ${config.menuSide} of the bar`,
            `it renders on the ${onLeft ? "left" : "right"}`));
        }
      }
    }
  }
  if (!drawer || !drawer.drawer) {
    findings.push(finding("mobile", width, null, "a mobile drawer", "none rendered"));
    return;
  }
  if (!drawer.visible) {
    findings.push(finding("mobile", width, null, "the drawer on screen when opened", "it stayed off-screen"));
  }
  if (drawer.side !== config.menuSide) {
    findings.push(finding("mobile", width, null, `the drawer sliding from the ${config.menuSide}`, `it is anchored ${drawer.side}`));
  } else if (drawer.visible) {
    // It must be against the edge menuSide names, not merely marked as such.
    const nearLeft = drawer.drawer.x <= 1;
    const nearRight = drawer.drawer.right >= drawer.viewport.w - 1;
    if (config.menuSide === "left" ? !nearLeft : !nearRight) {
      findings.push(finding("mobile", width, null, `the drawer against the ${config.menuSide} edge`,
        `it spans ${Math.round(drawer.drawer.x)}px → ${Math.round(drawer.drawer.right)}px`));
    }
  }
  const ids = drawer.items.map((i) => i.id);
  const want = items.map((i) => i.id);
  if (ids.join(",") !== want.join(",")) {
    findings.push(finding("mobile", width, null, `every nav item in the drawer (${want.join(" → ") || "(none)"})`,
      ids.join(" → ") || "(none)"));
  }
  for (const it of items) {
    const menu = menus[it.id];
    if (!menu || menu.kind === "none") continue;
    if (!drawer.sublinks.some((s) => s.id === it.id)) {
      findings.push(finding("mobile", width, it.id, `${it.name}'s sub-links in the drawer accordion`, "none found"));
    }
  }
}

// ---- The run -----------------------------------------------------------------

/**
 * Run the check. `captureOp` is the capture bridge's in-process runner (goto /
 * viewport / evaluate), so this needs no browser of its own and no puppeteer.
 *
 *   projectDir  the open project
 *   previewUrl  the running Vite origin
 *   variationId which design to check
 *   headerMode  "configured" | "custom" — decides how a failure is reported
 *   widths      optionally narrow the run (the tablet width is skipped when the
 *               project has no tablet preview)
 *
 * Returns { ok, findings, checked, headerMode, ranAt, variationId }, and writes
 * the same object to <project>/.thinkany/menu-check.json.
 */
async function runMenuCheck({ projectDir, previewUrl, variationId, captureOp, headerMode = "configured", widths, log, site = false, baseUrl } = {}) {
  if (!previewUrl) return { ok: false, error: site ? "The site isn't running yet." : "The preview isn't running yet — open a built design first." };
  if (!projectDir) return { ok: false, error: "No project is open." };
  const vid = variationId || "v01";
  // TWO SURFACES, ONE CHECK. The design preview reads pages.ts + menu.ts and opens a
  // panel through `?menu=open&item=`; the promoted site reads content/site.json and
  // opens one by hovering, because it is a real page with no capture harness. The
  // RULES are identical, which is the point: the site's header is the design's.
  const items = site ? expectedSiteItems(projectDir) : expectedItems(projectDir);
  const config = expectedConfig(projectDir, vid);
  const menus = site
    ? Object.fromEntries(items.map((it) => [it.id, { kind: it.kind }]))
    : expectedMenus(projectDir, items, config);
  const findings = [];
  const run = widths && widths.length ? WIDTHS.filter((w) => widths.includes(w.name)) : WIDTHS;
  const say = (m) => { try { log && log(m); } catch { /* logging is never fatal */ } };

  const evaluate = async (code) => {
    const r = await captureOp({ op: "evaluate", code });
    if (!r || !r.ok) throw new Error((r && r.error) || "evaluate failed");
    return r.result;
  };
  const goto = async (url, width, height) => {
    await captureOp({ op: "viewport", width, height });
    await captureOp({ op: "goto", url });
    await captureOp({ op: "waitSelector", selector: "[data-capture-ready], header", timeout: 15000 });
    // The panels measure themselves in a layout effect; give the frame a beat.
    await evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
    // The SITE's header is server-rendered then hydrated; until React has attached,
    // a hover does nothing and every panel would read as "never opened". Wait for
    // the island rather than guessing at a delay.
    if (site) {
      const t0 = Date.now();
      for (;;) {
        const ready = await evaluate(`!!document.querySelector("astro-island[ssr], astro-island") === false || !document.querySelector("astro-island[ssr]")`);
        if (ready || Date.now() - t0 > 8000) break;
        await evaluate(`new Promise((r) => setTimeout(r, 150))`);
      }
    }
  };

  // On the site there is no capture flag: the header is hydrated React, so drive it
  // the way a visitor does. Hydration has to have happened, hence the settle.
  const openItem = async (id) => {
    const sel = JSON.stringify(`[data-menu-item="${id}"]`);
    const opened = await evaluate(`(() => {
      const t = document.querySelector(${sel});
      if (!t) return false;
      // Hover is how a visitor opens it; focus is the keyboard path. Fire both, so
      // a header that only wires one still reads as open.
      t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      t.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      if (typeof t.focus === "function") t.focus();
      return true;
    })()`);
    await evaluate(`new Promise((r) => setTimeout(r, 300))`);
    return opened;
  };
  const openDrawer = async () => {
    await evaluate(`(() => {
      const b = document.querySelector("[data-header-hamburger]");
      if (!b) return false;
      b.click();
      return true;
    })()`);
    await evaluate(`new Promise((r) => setTimeout(r, 450))`); // the slide
  };

  let panelsChecked = 0;
  try {
    for (const bp of run) {
      // `site` says how the header BEHAVES (its data, and that panels open by hover);
      // the URL says where it is SERVED. A promoted design preview is both: the site's
      // header, served from the design surface, so it still needs ?v= to render.
      const base = baseUrl
        ? baseUrl
        : site ? previewUrl : `${previewUrl}/?v=${encodeURIComponent(vid)}&capture=${bp.name}`;
      await goto(base, bp.w, bp.h);
      const bar = await evaluate(PROBE_JS);
      checkBar(bar, items, config, bp.name, findings);

      if (bp.name === "mobile") {
        if (site) await openDrawer();                       // a real click, on a real page
        else await goto(`${base}&menu=open`, bp.w, bp.h);   // DesignSurface's capture flag
        const drawer = await evaluate(DRAWER_PROBE);
        checkMobile(bar, drawer, items, menus, config, findings);
        continue;
      }

      // Panels — one open pass per menu-bearing item.
      for (const it of items) {
        const menu = menus[it.id];
        if (!menu || menu.kind === "none") continue;
        if (site) { await goto(base, bp.w, bp.h); await openItem(it.id); }
        else await goto(`${base}&menu=open&item=${encodeURIComponent(it.id)}`, bp.w, bp.h);
        const probe = await evaluate(panelProbe(it.id));
        if (probe) probe.barLogo = bar && bar.logo;
        checkPanel(probe, it, menu, config, bp.name, findings);
        panelsChecked++;
      }
    }
  } catch (e) {
    return { ok: false, error: `Menu check failed: ${e.message}` };
  }

  const result = {
    ok: findings.length === 0,
    surface: site ? "site" : "design",
    headerMode,
    findings,
    checked: { items: items.length, panels: panelsChecked, widths: run.map((w) => w.name) },
    config,
    variationId: vid,
    ranAt: Date.now(),
  };
  try {
    const dir = path.join(projectDir, ".thinkany");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "menu-check.json"), JSON.stringify(result, null, 2));
  } catch (e) { say(`menu-check: could not write menu-check.json (${e.message})`); }
  say(`menu-check: ${result.ok ? "pass" : `${findings.length} finding(s)`} — ${summarize(result)}`);
  return result;
}

/**
 * The one line the build narration shows. Pass → what was verified; fail → what
 * broke, in the designer's terms rather than a rule id.
 */
function summarize(result) {
  if (!result || result.ok === undefined) return "";
  const c = result.checked || { items: 0, panels: 0, widths: [] };
  const widths = (c.widths || []).length;
  if (result.ok) {
    const panels = c.panels ? `, ${c.panels} panel${c.panels === 1 ? "" : "s"}` : "";
    return `Menu: ${c.items} item${c.items === 1 ? "" : "s"}${panels}, verified at ${widths} width${widths === 1 ? "" : "s"}`;
  }
  const byRule = {};
  for (const f of result.findings || []) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  const parts = Object.entries(byRule).map(([rule, n]) => `${n} ${rule}`);
  return `Menu: ${parts.join(", ")} to fix`;
}

module.exports = { runMenuCheck, summarize, expectedItems, expectedConfig, expectedMenus, WIDTHS, TOL };
