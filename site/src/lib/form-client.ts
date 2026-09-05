// ©2026 thinkany llc. All rights reserved.
// FORM CLIENT (CORE). Progressive enhancement for every `form[data-ta-form]` on a
// page: native validation, a timing token for the endpoint's spam check, then a
// JSON POST to the form's action. On success the thank-you message replaces the
// form and its copy (everything under data-ta-form-copy), or the page navigates
// (data-ta-after="page"). Without JS the form still
// posts natively and the endpoint redirects.
//
// Preview mode (window.__taFormsPreview, set by the design surface) never sends:
// it shows the success state with the preview note. The Astro dev server answers
// /api/forms with { ok: true, preview: true } for the same effect in the Site tab.
type Result = { ok?: boolean; preview?: boolean; error?: string; redirect?: string };

function isPreview(opts?: { preview?: boolean }) {
  return !!(opts && opts.preview) || (window as unknown as { __taFormsPreview?: boolean }).__taFormsPreview === true;
}

function finish(form: HTMLFormElement, preview: boolean) {
  const after = form.dataset.taAfter || "message";
  const page = form.dataset.taPage || "";
  if (after === "page" && page && !preview) { window.location.assign(page); return; }
  const wrap = (form.closest("[data-ta-form-wrap]") as HTMLElement | null) || form.parentElement || form;
  const done = wrap.querySelector<HTMLElement>("[data-ta-form-done]");
  // The block's copy (heading, intro) goes with the form; the message takes its place.
  const copy = (form.closest("[data-ta-form-copy]") as HTMLElement | null) || form;
  copy.hidden = true;
  if (!done) return;
  done.hidden = false;
  const note = done.querySelector<HTMLElement>("[data-ta-form-preview]");
  if (note) { note.hidden = !preview; if (preview && after === "page" && page) note.textContent = (form.dataset.taPreviewPage || "").replace("{route}", page) || note.textContent; }
  done.setAttribute("tabindex", "-1"); done.focus();
}

/** Enhance every un-enhanced form under `root`. Safe to call again after a re-render. */
export function enhanceForms(root: ParentNode = document, opts: { preview?: boolean } = {}) {
  root.querySelectorAll<HTMLFormElement>("form[data-ta-form]").forEach((form) => {
    if (form.dataset.taEnhanced) return;
    form.dataset.taEnhanced = "1";
    const t = form.querySelector<HTMLInputElement>('input[name="_t"]');
    if (t) t.value = String(Date.now());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const err = form.querySelector<HTMLElement>("[data-ta-form-error]");
      if (err) err.hidden = true;
      const label = btn ? btn.textContent || "" : "";
      if (btn) { btn.disabled = true; btn.textContent = form.dataset.taSending || label; }
      const preview = isPreview(opts);
      let res: Result = { ok: true, preview: true };
      if (!preview) {
        try {
          const body: Record<string, string> = {};
          new FormData(form).forEach((v, k) => { body[k] = typeof v === "string" ? v : ""; });
          const r = await fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
          res = await r.json().catch(() => ({ ok: r.ok }));
          if (!r.ok) res = { ...res, ok: false };
        } catch { res = { ok: false }; }
      }
      if (btn) { btn.disabled = false; btn.textContent = label; }
      if (!res.ok) {
        if (err) { err.textContent = res.error || form.dataset.taError || err.textContent; err.hidden = false; }
        return;
      }
      if (res.redirect && !res.preview) { window.location.assign(res.redirect); return; }
      finish(form, !!res.preview);
    });
  });
}
