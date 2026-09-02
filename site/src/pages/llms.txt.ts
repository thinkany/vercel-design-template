// ©2026 thinkany llc. All rights reserved.
// llms.txt: a plain-text map of the site for AI crawlers (llmstxt.org). Built
// from the same collections as the sitemap, so it never drifts from the pages.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { siteConfig } from "@/config/site";

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const pages = (await getCollection("pages")).filter((p) => !p.data.seo.noindex);
  const posts = (await getCollection("posts", ({ data }) => !data.draft && !data.seo.noindex)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  const line = (title: string, url: string, desc?: string) => `- [${title}](${url})${desc ? `: ${desc}` : ""}`;
  const out = [
    `# ${siteConfig.clientName}`,
    "",
    "## Pages",
    ...pages.map((p) => {
      const slug = p.data.slug ?? (p.id === "home" ? "" : p.id);
      return line(p.data.title, abs(`/${slug}`), p.data.seo.description);
    }),
  ];
  if (posts.length) {
    out.push("", "## Posts", ...posts.map((p) => line(p.data.title, abs(`/blog/${p.id}`), p.data.description)));
  }
  return new Response(out.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
