# thinkany design: marketing site brief and content pack

Written 2026-09-11 for building the product's own marketing site WITH the product.
Two parts. Part A is the brief, in the shape the app's skills already read (the same
sections the WordPress inventory writes: what the site is, pages, sections, content
types, voice, assets, watch-outs). Part B is the copy deck, one block of copy per
section per page, so the design is built against real words and promotion carries
them into the CMS as they are.

Every capability named here is BUILT and shipped as of 0.0.41. Anything spec'd but
not built (A/B testing, brand identity, site search, licensing accounts, self-update)
is left out on purpose. Items marked [verify] are facts only Rob can settle.

How to feed this to the app, in order:
1. Start a new project, Get Designing. Paste §A1 as the "what are we making" answer.
   Audience from §A1. Sections per page from §A2 (the app's own vocabulary).
   References: the sites in §A7 with the reason given. Colors and fonts: §A7.
2. Put this whole file in the project as `brief/marketing-site.md` BEFORE the build
   starts, and say in the first chat message: "The structure and copy for every page
   are in brief/marketing-site.md, Part B. Use that copy, don't write placeholder
   copy." The design agent reads project files in full; the references uploader does
   not (it keeps a 600-character excerpt for style only), so the file, not the upload,
   is the channel for copy.
3. After the design is approved, /promote-blocks carries the copy into the CMS. Edit
   from there.

---

## Part A: the brief

### A1. What the site is

thinkany design is a Mac app for designers who build websites for clients. You
describe the site in plain words (who it's for, the pages, a site or two you admire,
a colour source, fonts), and the app designs a complete, on-brand, responsive first
version in a few minutes, using your own Anthropic API key. You then work on it the
way you'd work with a designer: in conversation, pointing at the page. When the design
is approved, one command turns it into a real website with a content system behind
it, and the app publishes it to Vercel under the client's domain. The same design
exports to Figma as a styleguide and editable components. The app is the studio: the
agent, the browser preview on desktop, tablet and phone, the Art Director, the
media library, the CMS, the publish button, all in one window.

Audience: freelance web designers and small agencies (the "For my company" mode:
a company profile, the agency's fonts and logo on every project's gate page), and
solo designers and marketers building their own site ("Just for me").

Project type: website. Deliverable: a marketing site, 5 pages, one blog-style
collection for release notes.

### A2. Pages to design

- **Home** (`/`): Hero (with a product still or a short screen recording as the
  media), Features (three pillars: Design, Build, Publish), Steps (how it works, 4
  steps), Video (a 90-second walkthrough, hosted on YouTube or Vimeo), Features
  (what the agent understands: references, colours, fonts, direction), Testimonials
  (none yet, see watch-outs; design the block, leave it hidden), FAQ (5 questions),
  CTA (download).
- **Design** (`/design`): Hero, Features (the design phase in depth: intake, design
  directions, Art Director, devices, point-to-comment, images and video sourcing),
  Gallery (screenshots, 6), CTA.
- **Build & publish** (`/build`): Hero, Steps (promote, edit, publish), Features (the
  CMS: pages, posts, content types, forms, media, blocks, navigation, SEO), Table
  (what carries over from the design to the site), Features (WordPress migration),
  CTA.
- **Figma** (`/figma`): Hero, Features (what the export produces), Gallery (2 to 3
  screenshots of the Figma file), CTA.
- **Pricing** (`/pricing`): Hero, Table (plans, [verify] all figures), FAQ (3 on
  keys, licences and what runs where), CTA.
- **Release notes** (`/notes`, index of a Posts collection): Prose. Seed with one
  post from §B7.
- **Download** (`/download`): Hero, Steps (3: download, add your key, start), Prose
  (requirements), CTA.

Nav: Design · Build & publish · Figma · Pricing · Release notes · Download (as the
primary button). Footer: the same plus thinkany.co and Contact.

### A3. Sections the design needs

Hero (7), Features (6), Steps (3), CTA (7), FAQ (2), Table (2), Gallery (2), Video
(1), Testimonials (1, hidden until there are quotes), Prose (2).

### A4. Content types

- **Posts** (built in): release notes. Title, date, body, tags (one per area:
  Design, CMS, Figma, Publish, WordPress). Index page on.

No custom types for launch.

### A5. Voice, from the app itself

The app speaks in the second person, plainly, one idea per sentence, no jargon and
no exclamation marks. Its own lines:

- "Welcome to thinkany design, it's your studio."
- "Add your own Unsplash or Pexels key and a build searches the library for photos
  that match the brief, downloads them, and records the photographer credit."
- "Write the post here with the formatting toolbar. Images come from the project's
  media library, and the file is saved as markdown."
- "Format with the toolbar. Images come from the project's images, and a pasted
  YouTube or Vimeo link becomes the video."

Tone: calm, confident, specific. Say what happens, not how clever it is. No
em-dashes anywhere (the app's house rule). Verbs over adjectives. Never "AI-powered".
The word for the model is "the agent" or "your designer"; the word for the product is
"the app" or "thinkany design", never "the tool".

### A6. Assets

- App icon (desktop/build/icon.png) and the thinkany wordmark.
- Screenshots to capture in the app, at desktop width, light theme: the Get
  Designing intake, a finished v01 in the device frames, an Art Director review with
  a recommendation open, the CMS page editor with a block open, the media library,
  the Publish drawer with a custom domain, the Figma export result in Figma.
- One 60 to 90 second screen recording: brief to published site. Host on YouTube,
  paste the link into the Video block.
- No stock photography. The product is the picture.

### A7. Design references and brand

- References, why: [verify] two or three product sites whose structure is worth
  modelling. Suggested: linear.app (calm feature pages, product as the image),
  framer.com (a design tool talking to designers), pitch.com (short sections, one
  idea each). Structure only, never a pixel clone.
- Colour source: [verify] the thinkany brand (thinkany.co), else the app's own
  chrome: near-black #17171b on white, one accent.
- Fonts: [verify] the company profile's fonts if set; else Inter for everything.
- Direction: precise, quiet, generous whitespace, product stills large.

### A8. Watch-outs

- **Platform**: macOS only, Apple silicon and Intel builds, signed and notarised. No
  Windows build. Say so on Download and Pricing.
- **Keys**: the app runs on the designer's own Anthropic API key (metered by
  Anthropic). A Claude subscription does not work in a third-party app. Say this
  plainly; it is the most common support question.
- **Licences**: the design directions, the Art Director, the WordPress migration and
  the Figma export are licensed features, unlocked with a key in Keys & Licences.
  [verify] which are included in which plan, and the prices.
- **No testimonials yet**: design the Testimonials block, leave it hidden until there
  are three real quotes with names. Never invent one.
- **Domains**: publishing goes to Vercel on the designer's own Vercel account.
  [verify] whether thinkany provides hosting or only the publish path.
- **Figma**: the export needs the Figma desktop app and a Figma plan with the MCP
  server available. [verify] the exact plan requirement before printing it.
- **Claims**: every capability below is built. Don't add search, A/B testing or brand
  identity; they are on the roadmap, not in the product.

---

## Part B: the copy deck

Headings are H1 on the hero, H2 on sections. Body copy is final unless marked
[verify]. Button labels are exact.

### B1. Home

**Hero**
- Eyebrow: For designers who build websites
- Heading: Describe the site. Get the design. Ship it.
- Body: thinkany design turns a plain-language brief into a finished, on-brand
  website design in minutes, then into a live site with a content system behind it.
  One Mac app, your own API key, no hand-off.
- Primary button: Download for Mac
- Secondary button: Watch the walkthrough
- Media: the v01 result in the desktop, tablet and phone frames.

**Features: three pillars**
- Heading: One app, the whole job.
- Design: Tell it who the client is, what pages they need, a site you admire and
  where the colours come from. It designs a complete first version you react to in
  the browser, on desktop, tablet and phone.
- Build: Approve the design and promote it. Every section becomes a block with its
  own fields, the copy and images move into content, and a CMS appears around it.
- Publish: Connect Vercel once. Publishing is a button, custom domains included.
  Every edit after that is a save and a publish.

**Steps: how it works**
- Heading: From brief to live site.
- 1. Brief it. Answer a short set of cards: who it's for, the pages, references,
  colours, fonts, voice. Skip what you don't know. The brief saves as you go.
- 2. Watch it design. The agent researches the references, applies the palette and
  type, and builds the pages while you watch the preview fill in.
- 3. Direct it. Talk to it like a designer. Point at anything on the page and say
  what to change. Ask the Art Director for a review and apply its recommendations
  with one click.
- 4. Promote and publish. Turn the approved design into blocks and content, edit in
  the CMS, publish to the client's domain.

**Video**
- Heading: Ninety seconds, brief to published.
- Video: [the walkthrough link]

**Features: what the agent understands**
- Heading: It reads references the way you do.
- A site you admire: give it a URL and it takes the structure, never the pixels.
- A colour source: a site, a logo, a pasted palette. The colours become tokens the
  whole design uses.
- Fonts: names, or a site to pull them from. Self-hosted for the published site.
- A design direction: choose from named directions with real examples, or let the
  sliders steer it. Every project gets a design that doesn't look like the last one.
- Images and video: connect Unsplash, Pexels or Pixabay and a build finds photos and
  footage that fit the brief, with the photographer credited.
- Your voice: tone and copy rules per project, and global rules that follow you to
  every project.

**Testimonials** (hidden until real)

**FAQ**
- Do I need to know code? No. You brief, direct and edit. The app owns the files.
  If you do know code, the project is a normal React and Astro codebase you can open.
- What does it cost to run? The app uses your own Anthropic API key, billed by
  Anthropic per use. A first design typically costs a few dollars; edits cost cents.
  [verify] the figures against current pricing before printing.
- Can I use my Claude subscription? No. Third-party apps can't use a subscription;
  you need an API key from the Anthropic Console. The app walks you through getting
  one.
- Where does the site live? On your Vercel account, under any domain you own. The
  project files stay on your Mac and in your git remote if you add one.
- Is it Mac only? Yes, for now. Apple silicon and Intel builds, both signed and
  notarised by Apple.

**CTA**
- Heading: Your next site starts with a sentence.
- Button: Download for Mac
- Small print: macOS 13 or later. Requires an Anthropic API key. [verify] minimum OS.

### B2. Design

**Hero**
- Eyebrow: The design phase
- Heading: A designer that starts with the brief.
- Body: Everything a first design needs, in one conversation: who it's for, the
  pages, the references, the colours, the type. Then a full site you can react to.
- Button: See how it builds

**Features: the intake**
- Heading: Brief it in cards, not forms.
- Answer in your own words. Every group of questions is a card. Skip any of them and
  the agent decides.
- Pick up where you left off. The brief saves as you answer, and a project you closed
  mid-brief reopens at the same card.
- Show it what you like. Upload references, PDFs, screenshots, a brand book. It reads
  them for palette, type and feel.
- Say how it should sound. Tone and copy rules per project, and global rules that
  apply everywhere.

**Features: design directions**
- Heading: No two projects look alike.
- Named directions with real examples, so you choose a feeling, not a template.
- Sliders for warmth, precision, drama and the rest, and the direction holds when
  you move them.
- A memory across your projects, so the agent avoids repeating itself.

**Features: directing the design**
- Heading: Work on it the way you'd work with a designer.
- Point and comment. Switch on Point & Comment, click any element in the preview, say
  what to change.
- Desktop, tablet, phone. The preview renders in real device frames, and every design
  is built to work in all three.
- Ask the Art Director. A page-by-page review of balance, hierarchy, contrast and
  consistency, with recommendations you apply in one click, including font and asset
  suggestions.
- Accessibility review. An AA pass on the design with fixes, before it becomes a
  site.
- Real imagery. Photos and footage from Unsplash, Pexels and Pixabay, chosen for the
  brief, credited to the photographer. Or upload your own, from your Mac or from your
  phone with a QR code.
- Motion where it earns it. Video backgrounds and in-flow clips with poster stills,
  parallax on scroll, all built to respect reduced motion.

**Gallery** (6 screenshots, captions)
- The intake cards
- A finished first design in three frames
- A design direction with its examples
- Point & Comment on a hero
- An Art Director recommendation
- The media library

**CTA**
- Heading: See it design something of yours.
- Button: Download for Mac

### B3. Build & publish

**Hero**
- Eyebrow: From design to website
- Heading: The design becomes the site. Nothing is rebuilt.
- Body: Promote an approved design and every section becomes a block, every block
  gets fields, and a content system appears around it. The site you publish is the
  design you approved.
- Button: What the CMS does

**Steps**
- Heading: Three steps to live.
- 1. Promote. One command turns the design into blocks with content schemas, moves
  the copy and images into content, and makes the header and footer the site's
  chrome.
- 2. Edit. Pages, posts, content types, forms, media and navigation, each with its
  own tab. Change a word, swap a photo, add a page. Preview drafts before they go
  live.
- 3. Publish. Connect Vercel once. After that, publishing is a button. Custom
  domains, SEO, sitemaps and self-hosted fonts are handled.

**Features: the CMS**
- Heading: A content system built from your design.
- Pages: a tree you can drag to reorder and nest. Each page is a list of blocks with
  a live preview of the block as you edit its fields.
- Posts: a blog with tags, drafts and dates, written in a proper editor that saves
  clean markdown. Paste a YouTube or Vimeo link and it's the video.
- Content types: define a Team, a Service, a Location, with fields you name. Each
  gets its own pages and an index, rendered by blocks from the design.
- Forms: build a form, place it on a page, and submissions go to your inbox through
  Resend, Postmark or SendGrid.
- Media: images optimised on upload, a video library with poster stills taken for
  you, files for downloads, folders and tags for all of it.
- Navigation: menus, mega menus and footer links, edited in place.
- SEO: titles, descriptions, social images and structured data per page, filled by
  the agent on request, for one page or all of them.
- Blocks: design a new block in the site's own visual language when a page needs
  something the design didn't have.

**Table: what carries over**
- Columns: In the design → On the site
- Sections → Blocks with fields
- Copy → Content, editable
- Images and video → The media library
- Header and footer → The site's chrome
- Colours and fonts → Tokens and self-hosted fonts
- Device behaviour → The same responsive layout

**Features: WordPress**
- Heading: Bring the old site with you.
- Install a small plugin on the WordPress site and the app imports pages, posts,
  custom types and media, losslessly. Nothing is overwritten.
- Old sections without a home in the new design get a brief each. Design them one
  at a time in the new site's language, with the old content already in place.
- The inventory becomes the brief for the redesign, in the client's terms.

**CTA**
- Heading: Publish the site you actually designed.
- Button: Download for Mac

### B4. Figma

**Hero**
- Eyebrow: Figma export
- Heading: The design, in Figma, as components.
- Body: Export an approved design to Figma and get a styleguide, editable component
  sets and the pages built from them. Made for the client presentation and for the
  team that works in Figma.
- Button: What you get

**Features**
- Heading: Not a screenshot. A file.
- A styleguide: colours, type scale, spacing and radius as variables.
- Blocks as components: every section of the design as an editable component with
  variants where the design has them.
- Pages from blocks: the pages assembled from those components, at desktop, tablet
  and phone.
- Round trips: import a Figma file's palette and type into a new brief.

**Gallery** (Figma screenshots)

**CTA**
- Heading: Present it in Figma. Build it here.
- Button: Download for Mac

### B5. Pricing

**Hero**
- Heading: Simple to start. [verify]
- Body: The app is [verify: free / a licence]. Design directions, the Art Director,
  the WordPress migration and the Figma export are licensed features. You bring your
  own Anthropic API key and pay Anthropic for what you use.

**Table** [verify every cell]
- Columns: What's included → Just for me → For my company
- The app, the CMS, publishing → ✓ → ✓
- Design directions and the Art Director → ? → ?
- WordPress migration → ? → ?
- Figma export → ? → ?
- Company profile on every project → – → ✓
- Price → ? → ?

**FAQ**
- What does a design cost in API usage? [verify] A first design is typically a few
  dollars. Edits after that cost cents each, because the app keeps the editing
  session lean.
- What do I need? A Mac, an Anthropic API key, and a Vercel account to publish.
  Unsplash, Pexels and Pixabay keys are free and optional.
- Can my whole studio use it? [verify] Licences and seats.

**CTA**
- Heading: Start with the download.
- Button: Download for Mac

### B6. Download

**Hero**
- Heading: Download thinkany design for Mac.
- Body: Version [current]. Apple silicon and Intel. Signed and notarised by Apple.
- Buttons: Download for Apple silicon · Download for Intel

**Steps**
- 1. Open the app. It asks whether it's just for you or for your company, then for
  your Anthropic API key, with instructions for getting one.
- 2. Add your licences and optional keys in Keys & Licences: design, Unsplash,
  Pexels, Pixabay, Vercel.
- 3. New project, Get Designing. The walkthrough shows you the studio the first time.

**Prose: requirements**
macOS [verify] 13 or later. An Anthropic API key (Console account, billed per use).
Node is bundled; nothing else to install. To publish: a Vercel account. To export to
Figma: the Figma desktop app.

**CTA**
- Heading: Questions before you start?
- Button: Contact thinkany

### B7. Release notes: seed post

- Title: 0.0.41: hosted video, and a guard for unsaved edits
- Tags: CMS
- Body:
  Paste a YouTube or Vimeo link into a post or any rich text field and it's the
  video, with the player rendered on the site and a still in the editor. The same
  link works in the Video block and in any video field, always as a player the
  visitor starts, never autoplay.

  Leaving a page, post, type or form with unsaved changes now asks first.

  Double-click a block's bar in the page editor to open or close it.
