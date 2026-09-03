// ©2026 thinkany llc. All rights reserved.
/**
 * Render a `richtext` prop (CORE). A block passes the classes it would have put
 * on its <p>; the paragraphs, lists and emphasis inside inherit them, with just
 * enough structure (spacing, underlined links, list bullets) to read as prose.
 * Renders identically on the site (Astro) and in the design surface (Vite).
 */
import { renderMarkdown } from "./richtext";

type Props = { text?: string | null; className?: string; as?: "div" | "section" | "blockquote" };

const RICH = "ta-rich [&>*+*]:mt-[1em] [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_s]:line-through [&_ul]:list-disc [&_ul]:pl-[1.4em] [&_ol]:list-decimal [&_ol]:pl-[1.4em] [&_li+li]:mt-[.3em] [&_h2]:font-semibold [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-[1em] [&_hr]:my-[1.5em] [&_hr]:border-current/20 [&_img]:max-w-full [&_code]:font-mono [&_code]:text-[.9em]";

export function Rich({ text, className, as: Tag = "div" }: Props) {
  if (!text) return null;
  return <Tag className={className ? `${RICH} ${className}` : RICH} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
