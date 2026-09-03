// ©2026 thinkany llc. All rights reserved.
// llms.txt: a plain-text map of the site for AI crawlers (llmstxt.org), or the
// custom text from content/site.json. A dynamic route so it can be turned OFF:
// with seo.llms.enabled false no path is produced and the file doesn't exist.
import type { APIRoute } from "astro";
import { site } from "../lib/site";
import { generatedLlms } from "../lib/llms";

export function getStaticPaths() {
  return site.seo.llms.enabled ? [{ params: { llms: "llms.txt" } }] : [];
}

export const GET: APIRoute = async ({ site: siteUrl }) => {
  const custom = site.seo.llms.content;
  const body = custom && custom.trim() ? custom.replace(/\s*$/, "") + "\n" : await generatedLlms(siteUrl);
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
