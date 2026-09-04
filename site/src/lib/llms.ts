// ©2026 thinkany llc. All rights reserved.
// The generated llms.txt (llmstxt.org): a plain-text map of the site's public
// pages and posts, used when content/site.json carries no custom text.
import { getCollection } from "astro:content";
import { pageRoute } from "./pages";
import { blogPath } from "./site";
import { siteConfig } from "@/config/site";

export async function generatedLlms(siteUrl: URL | undefined) {
  const abs = (p: string) => new URL(p, siteUrl).href;
  const pages = (await getCollection("pages")).filter((p) => !p.data.seo.noindex)
    .sort((a, b) => (a.id === "home" ? -1 : b.id === "home" ? 1 : (a.data.order ?? 1e9) - (b.data.order ?? 1e9) || a.data.title.localeCompare(b.data.title)));
  const posts = (await getCollection("posts", ({ data }) => !data.draft && !data.seo.noindex)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  const line = (title: string, url: string, desc?: string) => `- [${title}](${url})${desc ? `: ${desc}` : ""}`;
  const out = [
    `# ${siteConfig.clientName}`,
    "",
    "## Pages",
    ...pages.map((p) => {
      const slug = pageRoute(p, pages);
      return line(p.data.title, abs(`/${slug}`), p.data.seo.description);
    }),
  ];
  if (posts.length) {
    out.push("", "## Posts", ...posts.map((p) => line(p.data.title, abs(`/${blogPath}/${p.id}`), p.data.description)));
  }
  return out.join("\n") + "\n";
}

