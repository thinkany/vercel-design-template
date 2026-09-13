// ©2026 thinkany llc. All rights reserved.
// TYPES BLOCK, on the page: the Tag/Type filter pills and the pager for every
// [data-ta-entries] section. Everything is already in the HTML (the block renders
// every entry it lists); this only shows and hides. Without JS every entry shows and
// the pager stays hidden. Bound once per section (a re-render in the design surface
// calls this again: the listeners stay, the paint runs again over the new rows).
//
// The page and filter live in the address (?page=2&filter=type:staff; a second block
// on the page uses page2 / filter2), pushed as history entries, so Back returns to
// the previous page of the listing and a link to page 2 opens on page 2.
const paramFor = (sec: HTMLElement, name: string) => { const n = Number(sec.dataset.taEntriesIndex || 1); return n > 1 ? `${name}${n}` : name; };
const readAddress = (sec: HTMLElement) => {
  try {
    const q = new URLSearchParams(window.location.search);
    const page = Math.max(0, (Number(q.get(paramFor(sec, "page"))) || 1) - 1);
    sec.dataset.taPage = String(page);
    sec.dataset.taFilterOn = q.get(paramFor(sec, "filter")) || "";
  } catch { /* no window (a server render) */ }
};
const writeAddress = (sec: HTMLElement) => {
  try {
    const q = new URLSearchParams(window.location.search);
    const page = Number(sec.dataset.taPage || 0) || 0; const filter = sec.dataset.taFilterOn || "";
    if (page > 0) q.set(paramFor(sec, "page"), String(page + 1)); else q.delete(paramFor(sec, "page"));
    if (filter) q.set(paramFor(sec, "filter"), filter); else q.delete(paramFor(sec, "filter"));
    const search = q.toString();
    const url = window.location.pathname + (search ? "?" + search : "") + window.location.hash;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState({ taEntries: true }, "", url);
  } catch { /* history unavailable */ }
};
const painters = new Map<HTMLElement, () => void>();

export function enhanceEntries(root: ParentNode = document) {
  const all = Array.from(document.querySelectorAll<HTMLElement>("[data-ta-entries]"));
  root.querySelectorAll<HTMLElement>("[data-ta-entries]").forEach((sec) => {
    sec.dataset.taEntriesIndex = String(all.indexOf(sec) + 1);
    const paint = () => {
      const perPage = Number(sec.dataset.taPerPage || 0) || 0;
      const filter = sec.dataset.taFilterOn || "";
      let page = Number(sec.dataset.taPage || 0) || 0;
      const items = Array.from(sec.querySelectorAll<HTMLElement>("[data-ta-entry]"));
      const matches = (it: HTMLElement) => {
        if (!filter) return true;
        const i = filter.indexOf(":"); const kind = filter.slice(0, i); const val = filter.slice(i + 1);
        if (kind === "type") return it.dataset.taType === val;
        if (kind === "tag") return (it.dataset.taTags || "").split("|").includes(val);
        return true;
      };
      const vis = items.filter(matches);
      const pages = perPage ? Math.max(1, Math.ceil(vis.length / perPage)) : 1;
      if (page >= pages) page = pages - 1;
      if (page < 0) page = 0;
      sec.dataset.taPage = String(page);
      const shown = new Set(perPage ? vis.slice(page * perPage, (page + 1) * perPage) : vis);
      items.forEach((it) => { it.hidden = !shown.has(it); });
      const empty = sec.querySelector<HTMLElement>("[data-ta-entries-empty]");
      if (empty) empty.hidden = vis.length > 0;
      sec.querySelectorAll<HTMLButtonElement>("[data-ta-filter]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.taFilter || "") === filter)));
      const pager = sec.querySelector<HTMLElement>("[data-ta-entries-pager]");
      if (pager) {
        pager.hidden = pages <= 1;
        // "Previous · 1 2 3 · Next": the edges show only when there is somewhere to go.
        const prev = pager.querySelector<HTMLButtonElement>("[data-ta-pager-prev]"); if (prev) prev.hidden = page === 0;
        const next = pager.querySelector<HTMLButtonElement>("[data-ta-pager-next]"); if (next) next.hidden = page >= pages - 1;
        const nums = pager.querySelector<HTMLElement>("[data-ta-pager-pages]");
        if (nums) {
          nums.innerHTML = "";
          for (let i = 0; i < pages; i++) {
            const b = document.createElement("button"); b.type = "button"; b.textContent = String(i + 1); b.dataset.taPagerGo = String(i);
            b.className = (i === page ? nums.dataset.taPagerCurrentClass : nums.dataset.taPagerClass) || "";
            if (i === page) b.setAttribute("aria-current", "page");
            nums.appendChild(b);
          }
        }
      }
    };
    painters.set(sec, paint);
    if (!sec.dataset.taEnhanced) {
      sec.dataset.taEnhanced = "1";
      readAddress(sec); // a link to page 2 (or a Back to it) opens there
      // After a pager click the top of the listing may be off screen; bring it back.
      const settle = (pager: boolean) => { paint(); writeAddress(sec); if (pager && sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ block: "start" }); };
      // One listener on the section: the pills and pager buttons may be re-created by a
      // re-render, the section itself stays.
      sec.addEventListener("click", (e) => {
        const t = e.target as HTMLElement | null;
        const pill = t && t.closest<HTMLElement>("[data-ta-filter]");
        if (pill && sec.contains(pill)) { sec.dataset.taFilterOn = pill.dataset.taFilter || ""; sec.dataset.taPage = "0"; settle(false); return; }
        const prev = t && t.closest("[data-ta-pager-prev]");
        if (prev && sec.contains(prev)) { sec.dataset.taPage = String((Number(sec.dataset.taPage || 0) || 0) - 1); settle(true); return; }
        const next = t && t.closest("[data-ta-pager-next]");
        if (next && sec.contains(next)) { sec.dataset.taPage = String((Number(sec.dataset.taPage || 0) || 0) + 1); settle(true); return; }
        const go = t && t.closest<HTMLElement>("[data-ta-pager-go]");
        if (go && sec.contains(go)) { sec.dataset.taPage = go.dataset.taPagerGo || "0"; settle(true); }
      });
    }
    paint();
  });
  // Back and Forward: every block re-reads the address and repaints. One listener per page.
  try {
    const de = document.documentElement;
    if (!de.dataset.taEntriesHistory) {
      de.dataset.taEntriesHistory = "1";
      window.addEventListener("popstate", () => { painters.forEach((paint, sec) => { if (!sec.isConnected) { painters.delete(sec); return; } readAddress(sec); paint(); }); });
    }
  } catch { /* no window */ }
}
