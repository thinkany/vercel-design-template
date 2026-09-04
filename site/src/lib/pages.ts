// ©2026 thinkany llc. All rights reserved.
// Page routes (CORE). A page's route is its parent chain's slugs joined:
// home → "", about → "about", island-guide under about → "about/island-guide".
// One function for the router, the llms index, the sitemap and the design surface.
type PageLike = { id: string; data: { slug?: string; parent?: string } };

export function pageRoute(page: PageLike, all: PageLike[]): string {
  const byId = new Map(all.map((p) => [p.id, p]));
  const parts: string[] = [];
  let cur: PageLike | undefined = page;
  let guard = 0;
  while (cur && guard++ < 16) {
    if (cur.id === "home") break; // home is the root; nothing nests visibly under it
    parts.unshift(cur.data.slug ?? cur.id);
    cur = cur.data.parent ? byId.get(cur.data.parent) : undefined;
  }
  return parts.join("/");
}
