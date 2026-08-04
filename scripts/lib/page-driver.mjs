// ©2026 thinkany llc. All rights reserved.
/**
 * page-driver.mjs — a pluggable "page" for the export capture scripts. ONE small
 * API (a subset of puppeteer's Page: goto / setViewport / waitForSelector /
 * evaluate / close), TWO backends chosen from the environment:
 *
 *   • RemotePageDriver — used when TA_CAPTURE_ENDPOINT is set (the Electron app
 *     injects it). Drives a HIDDEN BrowserWindow living in the app's main process
 *     over a loopback HTTP bridge (desktop/capture-bridge.cjs). This is what makes
 *     capture work in a PACKAGED .dmg, where puppeteer can't be installed
 *     (read-only Resources, no npm) — the app IS a browser, so it captures with
 *     its own Chromium instead of shipping a second one.
 *
 *   • PuppeteerPageDriver — the standalone fallback (running `node scripts/…`
 *     from a terminal, dev, conformance tests). Behavior is UNCHANGED from the
 *     old inline path: puppeteer auto-installs on first run and never becomes a
 *     project/Vercel dependency.
 *
 * The capture scripts call createPage() and use the returned object exactly like
 * a puppeteer Page, so they don't know or care which backend is live. `evaluate`
 * takes a function + JSON-serializable args just like puppeteer; the remote
 * backend ships `fn.toString()` to the window's webContents.executeJavaScript.
 * Every current capture callback is closure-free (it reads only page globals and
 * its own args), so string-serializing the function is faithful.
 */

import { fileURLToPath } from "node:url";

// ── Remote backend (Electron capture bridge) ─────────────────────────────────
function remoteConfig() {
  const endpoint = process.env.TA_CAPTURE_ENDPOINT;
  if (!endpoint) return null;
  return { endpoint, token: process.env.TA_CAPTURE_TOKEN || "" };
}

class RemotePageDriver {
  constructor({ endpoint, token }) {
    this.endpoint = endpoint;
    this.token = token;
  }

  async _rpc(op) {
    let res;
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-capture-token": this.token },
        body: JSON.stringify(op),
      });
    } catch (e) {
      throw new Error(`capture bridge unreachable at ${this.endpoint}: ${e.message}`);
    }
    if (!res.ok) throw new Error(`capture bridge HTTP ${res.status}`);
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || `capture bridge op '${op.op}' failed`);
    return out;
  }

  async goto(url /*, opts */) {
    await this._rpc({ op: "goto", url });
  }

  async setViewport({ width, height }) {
    await this._rpc({ op: "viewport", width, height });
  }

  // Mirrors puppeteer: rejects on timeout (the bridge returns ok:false, which
  // _rpc turns into a throw), so callers that don't try/catch fail loud, same
  // as before.
  async waitForSelector(selector, { timeout = 15000 } = {}) {
    return this._rpc({ op: "waitSelector", selector, timeout });
  }

  async evaluate(fn, ...args) {
    const code = typeof fn === "function"
      ? `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`
      : String(fn);
    const out = await this._rpc({ op: "evaluate", code });
    return out.result;
  }

  async close() {
    try { await this._rpc({ op: "close" }); } catch { /* window teardown is best-effort */ }
  }
}

// ── Puppeteer backend (standalone / dev fallback) ────────────────────────────
async function loadPuppeteer() {
  try {
    return (await import("puppeteer")).default;
  } catch {
    // Not installed yet — provision it locally on FIRST run (one-time). Only
    // reached when actually capturing, so puppeteer never enters package.json or
    // the Vercel deploy. Install into the app's OWN package root (where this
    // resolves puppeteer from), NOT the project cwd — the app-owned tooling runs
    // against a separate project folder, so a cwd install lands where import()
    // can't find it. This module is at <appRoot>/scripts/lib/, so ../.. = appRoot.
    console.log("→ First run: installing puppeteer locally (one-time; downloads a headless Chromium)…\n");
    const { execSync } = await import("node:child_process");
    const appRoot = fileURLToPath(new URL("../..", import.meta.url));
    execSync(`npm install puppeteer@25.3.0 --no-save --prefix "${appRoot}"`, { stdio: "inherit" });
    return (await import("puppeteer")).default;
  }
}

class PuppeteerPageDriver {
  constructor(browser, page) {
    this.browser = browser;
    this.page = page;
  }
  goto(url) { return this.page.goto(url, { waitUntil: "networkidle0" }); }
  setViewport(v) { return this.page.setViewport({ deviceScaleFactor: 2, ...v }); }
  waitForSelector(sel, opts) { return this.page.waitForSelector(sel, opts); }
  evaluate(fn, ...args) { return this.page.evaluate(fn, ...args); }
  async close() { try { await this.browser.close(); } catch { /* ignore teardown noise */ } }
}

/**
 * Open a capture page. Returns a puppeteer-Page-like driver; call close() when
 * done. Picks the native Electron bridge when TA_CAPTURE_ENDPOINT is present,
 * else launches puppeteer.
 */
export async function createPage() {
  const remote = remoteConfig();
  if (remote) return new RemotePageDriver(remote);
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 600000 });
  const page = await browser.newPage();
  return new PuppeteerPageDriver(browser, page);
}
