// ©2026 thinkany llc. All rights reserved.
// robots.txt, generated at build from content/site.json's seo settings:
// discourage → Disallow everything (no sitemap line); otherwise Allow, with the
// sitemap URL when the sitemap is enabled.
import type { APIRoute } from "astro";
import { site } from "../lib/site";

export const GET: APIRoute = ({ site: siteUrl }) => {
  const lines = ["User-agent: *"];
  if (site.seo.discourage) lines.push("Disallow: /");
  else {
    lines.push("Allow: /");
    if (site.seo.sitemap) lines.push("", `Sitemap: ${new URL("/sitemap-index.xml", siteUrl).href}`);
  }
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
