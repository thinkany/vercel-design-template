// ©2026 thinkany llc. All rights reserved.
// Alt text: the pure half of "describe this image" (the Describe button in an image's
// detail view, and the describe-on-upload switch in Image Settings). Holds the prompt
// the model reads with the picture and cleans what comes back into the one string a
// block's alt attribute takes. No I/O and no SDK here; main.cjs renders the picture
// for the call and makes it (describeImageAlt).
//   node desktop/dev/alt-text.test.cjs

const MODEL = "claude-opus-5";
const ALT_MAX = 150;      // characters; screen readers read alt in one breath, ~125 is the usual guidance
const VISION_WIDTH = 1200; // the JPEG sent for the call; the API resizes past ~1568px anyway

const SYSTEM =
  "You write alt text for images on a website: what a screen reader says for the picture, " +
  "to WCAG 2.1 and Section 508. Describe what the image shows in one plain sentence of at " +
  "most 125 characters: the subject, what is happening, the setting, and any words that " +
  "appear in the image, quoted as written. Do not begin with 'image of', 'photo of', " +
  "'picture of' or 'graphic of': a screen reader already announces an image. No keyword " +
  "stuffing, no adjectives that sell, no guesses at who a person is. Set decorative to true " +
  "only when the image carries nothing a visitor would miss: a texture, a gradient, an " +
  "abstract pattern, a spacer; then leave alt empty.";

// The structured reply: the sentence, and whether the image is decorative (alt="").
const SCHEMA = {
  type: "object",
  properties: {
    alt: { type: "string", description: "The alt text, one sentence, or empty when decorative." },
    decorative: { type: "boolean", description: "True only for an image with no content of its own." },
  },
  required: ["alt", "decorative"],
  additionalProperties: false,
};

// The text sent beside the picture: the file name (often a hint at the subject) and the
// site it is for, so a logo or a product reads in context.
function userText({ fileName, siteName } = {}) {
  const lines = ["Write the alt text for this image."];
  if (fileName) lines.push(`File name: ${fileName}`);
  if (siteName) lines.push(`Website: ${siteName}`);
  return lines.join("\n");
}

// A leading "image of" and its kin, with or without an article, in any case.
const LEAD = /^(?:an?\s+|the\s+)?(?:image|photo|photograph|picture|graphic|illustration|screenshot|drawing)\s+(?:of|showing|depicting)\s+/i;

/**
 * The reply as one alt string: quotes and labels stripped, whitespace collapsed, the
 * "image of" lead removed, cut at a word before ALT_MAX. A decorative reply is "".
 * Takes the parsed JSON, or a bare string for a plain-text reply.
 */
function clean(raw) {
  const obj = raw && typeof raw === "object" ? raw : { alt: raw, decorative: false };
  if (obj.decorative === true) return "";
  let s = String(obj.alt == null ? "" : obj.alt).replace(/\s+/g, " ").trim();
  s = s.replace(/^alt(?:\s*text)?\s*:\s*/i, "");
  s = s.replace(/^["'“‘]+|["'”’]+$/g, "").trim();
  s = s.replace(LEAD, "");
  if (s) s = s[0].toUpperCase() + s.slice(1);
  if (s.length > ALT_MAX) {
    const cut = s.slice(0, ALT_MAX);
    const at = cut.lastIndexOf(" ");
    s = (at > ALT_MAX * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:]+$/, "");
  }
  return s;
}

module.exports = { MODEL, ALT_MAX, VISION_WIDTH, SYSTEM, SCHEMA, userText, clean };
