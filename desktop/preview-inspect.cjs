// Webview preload for the live preview: "point & comment" feedback mode.
//
// When the shell toggles feedback mode on (wv.send("feedback:toggle", true)),
// this highlights the element under the cursor and, on click, pops an input
// bubble anchored to it. Submitting sends the note + element context back to the
// shell (ipcRenderer.sendToHost("feedback:submit", …)), which formats it into a
// chat prompt for Claude. Runs as a webview preload so it survives the preview's
// hot-reloads. Uses only `electron` (ipcRenderer) + the DOM, so it's sandbox-safe.

const { ipcRenderer } = require("electron");

(function () {
  const Z = 2147483000;
  let active = false;
  let hoverEl = null;
  let overlay = null;
  let bubble = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", pointerEvents: "none", zIndex: String(Z),
      border: "2px solid #17171b", background: "rgba(23,23,27,0.06)",
      borderRadius: "3px", boxShadow: "0 0 0 2px rgba(255,255,255,0.5)",
      display: "none", margin: "0", padding: "0",
    });
    (document.body || document.documentElement).appendChild(overlay);
  }

  function positionOverlay(el) {
    if (!el) { if (overlay) overlay.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block", left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px",
    });
  }

  // A short, readable CSS-ish path (up to 4 levels) to help Claude locate the node.
  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return "";
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth++) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + "#" + node.id); break; }
      const cls = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) part += "." + cls.join(".");
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
        if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // Classify what was pointed at so the shell can route the edit: a scoped
  // "element" (a leaf/atomic node → direct Read→Edit) vs a "section" (the block
  // wrapper, a structural landmark, a node containing a block, or a large content
  // container → may warrant /design). The shell turns this into a routing hint.
  const LANDMARKS = ["SECTION", "HEADER", "FOOTER", "MAIN", "ARTICLE", "NAV", "ASIDE"];
  function scopeFor(el, block) {
    if (block && block === el) return "section"; // clicked the section wrapper itself
    const tag = el.tagName ? el.tagName.toUpperCase() : "";
    if (LANDMARKS.includes(tag)) return "section";
    if (el.querySelector && el.querySelector("[data-block]")) return "section"; // wraps a block
    const kids = el.children ? el.children.length : 0;
    try {
      const r = el.getBoundingClientRect();
      const big = r.width * r.height > 0.45 * window.innerWidth * window.innerHeight;
      if (big && kids >= 3) return "section"; // large multi-child container
    } catch { /* detached */ }
    return "element";
  }

  function contextFor(el) {
    const block = el.closest && el.closest("[data-block]");
    return {
      tag: el.tagName ? el.tagName.toLowerCase() : "",
      classes: (el.getAttribute && (el.getAttribute("class") || "")).slice(0, 120),
      text: ((el.innerText || el.textContent || "").trim().replace(/\s+/g, " ")).slice(0, 180),
      selector: selectorFor(el),
      dataBlock: block ? block.getAttribute("data-block") : null,
      dataBlockName: block ? block.getAttribute("data-block-name") : null,
      scope: scopeFor(el, block),
      variation: new URLSearchParams(location.search).get("v") || null,
      note: "",
    };
  }

  function closeBubble() {
    if (bubble) { bubble.remove(); bubble = null; }
  }

  function openBubble(el, x, y) {
    closeBubble();
    if (!el) return;
    bubble = document.createElement("div");
    Object.assign(bubble.style, {
      position: "fixed", zIndex: String(Z + 1), width: "268px",
      background: "#fff", border: "1px solid #e2e2e8", borderRadius: "12px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.22)", padding: "12px",
      font: "13px -apple-system, system-ui, sans-serif", color: "#1a1a1a",
    });
    // Clamp within the viewport.
    const bw = 268, bh = 150;
    const left = Math.max(8, Math.min(x, window.innerWidth - bw - 8));
    const top = Math.max(8, Math.min(y + 12, window.innerHeight - bh - 8));
    bubble.style.left = left + "px";
    bubble.style.top = top + "px";

    const label = document.createElement("div");
    const name = (el.closest && el.closest("[data-block-name]") && el.closest("[data-block-name]").getAttribute("data-block-name"));
    label.textContent = name ? `Note on: ${name}` : `Note on this <${el.tagName.toLowerCase()}>`;
    Object.assign(label.style, { fontWeight: "600", fontSize: "12px", marginBottom: "7px", color: "#555" });

    const ta = document.createElement("textarea");
    ta.placeholder = "What should change here?";
    Object.assign(ta.style, {
      width: "100%", height: "58px", resize: "none", boxSizing: "border-box",
      border: "1px solid #d8d8de", borderRadius: "8px", padding: "7px 9px",
      font: "13px -apple-system, system-ui, sans-serif", color: "#1a1a1a", outline: "none",
    });

    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" });
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    Object.assign(cancel.style, { border: "1px solid #d8d8de", background: "#fafafb", color: "#333", borderRadius: "7px", padding: "5px 11px", fontSize: "12px", fontWeight: "600", cursor: "pointer" });
    const send = document.createElement("button");
    send.textContent = "Send to Claude";
    Object.assign(send.style, { border: "none", background: "#17171b", color: "#fff", borderRadius: "7px", padding: "5px 11px", fontSize: "12px", fontWeight: "600", cursor: "pointer" });

    const submit = () => {
      const note = ta.value.trim();
      if (!note) { ta.focus(); return; }
      const ctx = contextFor(el);
      ctx.note = note;
      ipcRenderer.sendToHost("feedback:submit", ctx);
      setActive(false);
    };
    cancel.addEventListener("click", () => setActive(false));
    send.addEventListener("click", submit);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      else if (e.key === "Escape") { e.preventDefault(); setActive(false); }
      e.stopPropagation();
    });

    row.append(cancel, send);
    bubble.append(label, ta, row);
    (document.body || document.documentElement).appendChild(bubble);
    ta.focus();
  }

  function onMove(e) {
    if (!active || bubble) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== overlay) { hoverEl = el; positionOverlay(el); }
  }
  function onScroll() { if (active && !bubble && hoverEl) positionOverlay(hoverEl); }
  function onClick(e) {
    if (!active) return;
    if (bubble && bubble.contains(e.target)) return; // interacting with the bubble
    e.preventDefault();
    e.stopPropagation();
    const el = hoverEl || document.elementFromPoint(e.clientX, e.clientY);
    openBubble(el, e.clientX, e.clientY);
  }

  function setActive(on) {
    active = !!on;
    ensureOverlay();
    document.documentElement.style.cursor = active ? "crosshair" : "";
    if (!active) { positionOverlay(null); closeBubble(); hoverEl = null; }
    ipcRenderer.sendToHost("feedback:state", active);
  }

  ipcRenderer.on("feedback:toggle", (_e, on) => setActive(on));
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("keydown", (e) => {
    if (active && e.key === "Escape") { e.preventDefault(); setActive(false); }
  }, true);

  // Design-variety reroll bridge: the shell tells the page whether variety is licensed
  // (so the dashboard can show a "Try another direction" button), and the page's button
  // posts a reroll request back up to the shell.
  ipcRenderer.on("variety:licensed", (_e, on) => {
    window.__taVarietyLicensed = !!on;
    window.dispatchEvent(new CustomEvent("ta-variety-licensed", { detail: !!on }));
  });
  window.addEventListener("message", (e) => {
    const d = e && e.data;
    if (d && d.type === "ta-reroll" && d.variationId) ipcRenderer.sendToHost("reroll:request", d.variationId);
  });
})();
