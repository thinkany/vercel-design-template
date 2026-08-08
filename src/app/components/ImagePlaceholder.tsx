// ©2026 thinkany llc. All rights reserved.

interface ImagePlaceholderProps {
  /** Layout classes for the spot: aspect ratio, width, rounding, etc.
   *  e.g. "aspect-video w-full rounded-xl". */
  className?: string;
  /** What the image will be, shown on the placeholder (e.g. "Hero image"). */
  label?: string;
  /** Aspect ratio fallback when `className` sets no height/aspect (e.g. "16 / 9"). */
  ratio?: string;
}

/**
 * FPO ("for placement only") image placeholder. Used when the designer turns on
 * "No images, placeholders only" (Claude Settings) — the design holds every image
 * spot with this instead of sourcing a photo, so they can drop in their own.
 *
 * Deliberately black-and-white and clearly a placeholder (dashed frame + diagonal
 * cross + an image glyph + optional label), so it reads as "image goes here",
 * never as a finished design element. It IS part of the design content (unlike the
 * ImageCredits alert), so it shows in the preview and the Figma export alike.
 */
export function ImagePlaceholder({ className = "", label, ratio }: ImagePlaceholderProps) {
  const hasBox = /aspect-|\bh-\d|\bmin-h-/.test(className);
  return (
    <div
      role="img"
      aria-label={label ? `${label} (placeholder)` : "Image placeholder"}
      data-fpo=""
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: "#f4f4f5",
        border: "1.5px dashed #d4d4d8",
        color: "#a1a1aa",
        ...(ratio && !hasBox ? { aspectRatio: ratio } : {}),
        ...(hasBox ? {} : { minHeight: 120 }),
      }}
    >
      {/* Faint diagonal cross — the classic placeholder mark. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke="#e4e4e7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#e4e4e7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 12, textAlign: "center" }}>
        {/* Image glyph (frame + sun + mountain). */}
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.6" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        {label && <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>}
      </div>
    </div>
  );
}
