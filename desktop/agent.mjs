// Agent SDK wrapper — the one file the Claude Agent SDK integration lives in.
//
// Contract (main.mjs depends on exactly this):
//   runPrompt({ prompt, sessionId, cwd, onEvent }) -> Promise<{ sessionId }>
//   onEvent(evt) is called for each streamed chunk, where evt is one of:
//     { type: "text",   text }            assistant text delta
//     { type: "tool",   name }            a tool-use the agent invoked
//     { type: "activity", name, target }  a completed tool-use + its file/command target
//     { type: "todo",   todos }           a TodoWrite call's list (drives the build spine)
//     { type: "result", text, usage }     end of the assistant turn (usage = the
//                                          SDK's token usage for context sizing)
//     { type: "error",  message }         something failed
//
// The SDK is imported dynamically so a missing install (or missing API key)
// surfaces as a friendly chat error instead of crashing the app at boot.

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

let _sdk = null;
async function getSdk() {
  if (_sdk) return _sdk;
  _sdk = await import("@anthropic-ai/claude-agent-sdk");
  return _sdk;
}
async function getQuery() {
  return (await getSdk()).query;
}

// The SDK spawns a SELF-CONTAINED native `claude` binary (bundled per-platform
// in @anthropic-ai/claude-agent-sdk-<platform>-<arch>) — NOT `node` on PATH. In
// dev the SDK auto-resolves it; but a PACKAGED .app launched from Finder has a
// minimal PATH and a rearranged layout, so we point the SDK at the binary
// explicitly. Two locations, checked in order:
//   • Dev: <appRoot>/desktop/agent.mjs → ../node_modules/<platform pkg>/claude
//   • Packaged: electron-builder's node_modules PRUNING drops the optional
//     platform package, so the binary is shipped via extraResources to
//     Contents/Resources/claude-bin/ — found via process.resourcesPath.
// Guarded by existsSync: if nothing resolves we return null and let the SDK fall
// back to its own auto-resolution (dev behavior unchanged).
function resolveClaudeExecutable() {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = `@anthropic-ai/claude-agent-sdk-${os.platform()}-${os.arch()}`;
    const binName = os.platform() === "win32" ? "claude.exe" : "claude";
    const candidates = [
      path.resolve(dir, "..", "node_modules", pkg, binName), // dev / bundled node_modules
      process.resourcesPath && path.join(process.resourcesPath, "claude-bin", binName), // packaged extraResources
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return null;
  } catch {
    return null;
  }
}

// A compact, non-sensitive hint about what a tool is acting on — a file path or
// the head of a shell command — so the UI can narrate setup in plain language
// ("Applying your color palette…") from the target rather than the tool name.
function toolTarget(input) {
  if (!input || typeof input !== "object") return "";
  return (
    input.file_path ||
    input.path ||
    input.notebook_path ||
    (input.command ? String(input.command).slice(0, 120) : "") ||
    input.pattern ||
    ""
  );
}

// The chat assistant's persona — how it communicates with the designer in the chat
// pane. Always appended to the system prompt (distinct from the per-project copy
// voice below, which governs the WORDS written into the design, not the assistant's
// own voice). Kept deliberately light: a communication style, not task behavior —
// the project's CLAUDE.md and the skills still own what it actually does.
const CHAT_PERSONA =
  "\n\n# Your persona\n" +
  "You are a seasoned professional designer and communicate with confident curiosity. " +
  "You're more inquisitive than judgemental, offering advice only when asked.\n";

// The Art Director persona — a SEPARATE role from the builder above, used only for the
// read-only design-review turn (reviewMode). A critic who confers, never the designer who
// commits: it looks at a colleague's finished design and gives an honest, prioritized read,
// but never touches the work. This is why review is its own turn, not the builder grading
// itself. See docs/art-director-spec.md.
const ART_DIRECTOR_PERSONA =
  "\n\n# Your role: Art Director (read-only design review)\n" +
  "You are a seasoned art director reviewing a design a colleague built. You are NOT the " +
  "designer and you do not touch the work — never edit a file, never run a build. If you " +
  "want to 'fix' something, describe the change and let the designer decide; the person who " +
  "asked owns the call.\n\n" +
  "Judge what a lint cannot: visual hierarchy (does the eye land where it should), spacing " +
  "rhythm and balance, type pairing and scale, colour/palette harmony and how the palette " +
  "carries the mood, use of imagery, and whether the page reads as its intended design " +
  "direction. Ground every point in something concrete on the page. Lead with what's working, " +
  "then the few changes that would raise it most — specific and prioritized, not a long flat " +
  "list. Confident and direct but collegial, never harsh. Treat any lint findings you're given " +
  "as established fact you can build on, not something to re-derive. Advisory only.\n\n" +
  "Make your suggestions ACTIONABLE where you can, so the designer can act in one click. When a " +
  "recommendation is about TYPE (a font role needs its own face), give `fontOptions`: 2-4 real Google " +
  "Font families that genuinely fit the direction + brand, plus the `fontRole` they'd replace. When a " +
  "recommendation NEEDS AN IMAGE the design lacks (a hero / large-scale / stock visual the image pipeline " +
  "could source), set `assetSourceable: true` and give an `assetHint` (a short image brief). Leave it a plain " +
  "asset only when the client alone can supply it (their own product photo, logo). You still never edit or " +
  "source anything yourself — these just let the designer trigger a scoped action.\n";

// Turn the resolved copy voice into a system-prompt addendum. Empty when nothing
// is set — so a project with no voice keeps the exact default system prompt.
// Scoped to user-facing DESIGN copy so it shapes what lands in pages, not code.
function buildVoiceAppend(voice) {
  if (!voice) return "";
  const tone = (voice.tone || "").trim();
  const rules = (voice.rules || []).map((r) => String(r).trim()).filter(Boolean);
  if (!tone && !rules.length) return "";
  let s =
    "\n\n# Copy voice for this project\n" +
    "When you write ANY user-facing copy in the design — headlines, body, buttons, " +
    "labels, alt text, placeholder text — follow this voice. It governs the words " +
    "that go INTO the design, not code or file contents.\n";
  if (tone) s += `\nTone: ${tone}\n`;
  if (rules.length) s += "\nRules (follow strictly):\n" + rules.map((r) => `- ${r}`).join("\n") + "\n";
  return s;
}

// The zod shape for one intake card (mirrors desktop/intake/cards.cjs — kept in sync
// there). Describing it richly here is what teaches the model to emit good cards; the
// authoritative semantic check (unique ids, options required for choice types) runs in
// main.cjs's askIntake via cards.cjs and surfaces bad output as a clear tool error.
const CARD_SHAPE = z.object({
  id: z.string().describe("stable, unique id for this card — the answer comes back keyed by it"),
  type: z.enum(["open-text", "single-choice", "multi-choice", "chips", "reference", "color-swatch", "font-pick"])
    .describe("open-text = free text; single/multi-choice = pick from options; chips = compact multi-select; reference = a URL + why they like it; color-swatch = pick one color (options = hex values like '#2b3a67'); font-pick = pick one font (options = Google Font family names, shown in the actual typeface)"),
  label: z.string().describe("the question or prompt shown on the card"),
  field: z.string().optional().describe("the Brief field this answer maps to (e.g. 'what', 'sections', 'references'); omit if it doesn't map 1:1"),
  help: z.string().optional().describe("an optional hint shown under the label"),
  placeholder: z.string().optional().describe("input placeholder (open-text / reference)"),
  options: z.array(z.string()).optional().describe("the choice pool — REQUIRED for single-choice, multi-choice, and chips"),
  long: z.boolean().optional().describe("open-text only: render a multi-line textarea (use for the 'what are we making' lead card)"),
  maxLength: z.number().optional().describe("open-text / reference: cap length and show a live 'N / max' counter"),
  skippable: z.boolean().optional().describe("if true the designer can skip; a skip records null (= you decide)"),
  agentDecidesLabel: z.string().optional().describe("label for the skip affordance, e.g. \"I'll let you choose\""),
});

// Build the in-process `intake` MCP server for ONE runPrompt call. The tool handler
// runs in this (main) process and awaits `askIntake(cards)`, which routes the cards to
// the renderer's pane and resolves when the designer submits — the whole round-trip is
// synchronous to the agent's turn (the MCP tool-call timeout is effectively unbounded,
// so the designer can take their time). A fresh server per call binds this call's
// askIntake bridge. See ticket T2.
function buildIntakeServer(sdk, askIntake) {
  const intakeTool = sdk.tool(
    "intake",
    "Ask the designer one or more rich intake cards IN THE PANE (not the chat) and wait for their answers. " +
      "Use this to drive the onboarding conversation: lead with an open-text 'what are we making', then " +
      "sprinkle adaptive follow-ups (chips for sections, a reference card for sites they like + why, choices " +
      "for tone/devices). Prefer this over AskUserQuestion for anything that isn't a plain multiple-choice. " +
      "Returns { answers: { [cardId]: value } }; a skipped card's value is null (you decide that field).",
    { cards: z.array(CARD_SHAPE).min(1).describe("one or more cards to show the designer, in order") },
    async (args) => {
      try {
        const answers = await askIntake(args.cards);
        return { content: [{ type: "text", text: JSON.stringify({ answers }) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `intake rejected: ${err?.message ?? String(err)}` }],
        };
      }
    },
  );
  return sdk.createSdkMcpServer({ name: "intake", version: "1.0.0", tools: [intakeTool] });
}

// A single Art Director suggestion (Phase 3). Emitted by the read-only review turn via the
// `suggest` tool so the renderer can render actionable cards. `apply` (a precise edit
// instruction) is present only for kind "code" — the one kind the builder can execute.
const SUGGESTION_SHAPE = z.object({
  id: z.string().describe("stable id within this review, e.g. 'tonal-arc'"),
  title: z.string().describe("short imperative title, e.g. 'Band the Making section in bg-ta-primary'"),
  why: z.string().describe("one-line rationale, grounded in the design"),
  kind: z.enum(["code", "asset", "decision"]).describe("code = the builder can edit it now; asset = needs a new/replacement file the builder can't source; decision = a human/client call"),
  targets: z.array(z.string()).optional().describe("file:line references, e.g. ['Home.tsx:250']"),
  apply: z.string().optional().describe("REQUIRED for kind 'code': a precise, self-contained edit instruction the builder can execute verbatim without re-analyzing"),
  // Make a 'decision'/'asset' actionable — the designer picks/triggers, then a scoped builder turn runs.
  fontOptions: z.array(z.string()).optional().describe("for a type/font 'decision': 2-4 candidate Google Font families that fit the design direction + brand, so the designer can pick one and apply it in one click"),
  fontRole: z.enum(["display", "serif", "sans", "mono"]).optional().describe("for a font 'decision': which --ta-font-* role the fontOptions would replace"),
  assetSourceable: z.boolean().optional().describe("for kind 'asset': true when it's imagery the image pipeline can source (a hero / large-scale / stock shot) so the designer can have it sourced automatically; omit for a specific asset only the client can supply (their own photo/logo)"),
  assetHint: z.string().optional().describe("for a sourceable 'asset': a short image brief / search phrase to steer the sourcing, e.g. 'a wide cinematic shot of an empty coastal road at dusk'"),
  effort: z.enum(["small", "medium"]).optional().describe("rough effort"),
});

// The read-only `suggest` MCP server for the review turn: the Art Director calls it ONCE with
// its actionable suggestions; the handler forwards them to the renderer (non-blocking) so they
// render as Apply-able cards in chat. It NEVER edits — applying is a separate builder turn the
// designer triggers, which is what keeps the reviewer read-only and advisory.
function buildSuggestServer(sdk, onSuggest) {
  const suggestTool = sdk.tool(
    "suggest",
    "Emit the actionable items from your review as structured suggestion cards the designer can act on. " +
      "Call this ONCE, after your prose read. Order most-impactful first. For every kind 'code' item include a " +
      "precise `apply` instruction the builder can execute verbatim. Make the other kinds actionable too: for a " +
      "type/font 'decision' add `fontOptions` (2-4 real Google Fonts fitting the direction) + `fontRole`; for an " +
      "imagery 'asset' the pipeline can source (a hero/large-scale/stock shot) set `assetSourceable: true` + an `assetHint`.",
    { suggestions: z.array(SUGGESTION_SHAPE).describe("the actionable suggestions, most impactful first") },
    async (args) => {
      try { onSuggest(args.suggestions || []); } catch { /* non-fatal */ }
      return { content: [{ type: "text", text: `Recorded ${(args.suggestions || []).length} suggestion(s) for the designer.` }] };
    },
  );
  return sdk.createSdkMcpServer({ name: "artdirector", version: "1.0.0", tools: [suggestTool] });
}

export async function runPrompt({ prompt, sessionId, cwd, onEvent, askQuestion, askIntake, onSuggest, model, copyVoice, onQuery, reviewMode }) {
  let resolvedSession = sessionId;

  if (!process.env.ANTHROPIC_API_KEY) {
    onEvent({
      type: "error",
      message:
        "No ANTHROPIC_API_KEY set. Add it to desktop/.env.local " +
        "(get a key at platform.claude.com), then restart.",
    });
    return { sessionId: resolvedSession };
  }

  let query;
  try {
    query = await getQuery();
  } catch (err) {
    onEvent({
      type: "error",
      message:
        "Claude Agent SDK not installed. Run `npm install @anthropic-ai/claude-agent-sdk`. " +
        `(${err?.message ?? err})`,
    });
    return { sessionId: resolvedSession };
  }

  try {
    const claudeExe = resolveClaudeExecutable();
    // System-prompt append: the Art Director persona for a review turn, otherwise the
    // always-on chat (builder) persona + (when set) the project's design copy voice. A
    // review turn writes prose, not design copy, so it carries no copy voice.
    const systemAppend = reviewMode ? ART_DIRECTOR_PERSONA : (CHAT_PERSONA + buildVoiceAppend(copyVoice));
    // Review mode is READ-ONLY: no Write/Edit/Bash and none of the MCP tools, so the Art
    // Director can look at the design (Read/Grep/Glob) but physically cannot change it.
    const REVIEW_TOOLS = ["Read", "Grep", "Glob", "WebFetch", "WebSearch"];
    const BUILD_TOOLS = [
      "Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch",
      // Pre-approve the Figma MCP tools (used by the export-to-Figma flow) so they clear
      // the allow-rules stage and never hit an interactive permission handshake this
      // non-interactive session can't answer. Wildcard MUST be mcp__<server>__* (a bare
      // "mcp__figma" is ignored). Absent from REVIEW_TOOLS — a review never exports. If
      // the Figma OAuth token isn't available the server reports needs-auth and its tools
      // are simply skipped — a clean degrade, not an abort.
      "mcp__figma__*",
      // The in-process intake tool (the "intake" SDK MCP server when an askIntake bridge
      // is present), pre-approved so it clears the allow-rules stage.
      "mcp__intake__*",
    ];
    // Read-only review still gets the "suggest" MCP tool — it only emits data, never edits.
    const REVIEW_TOOLS_ALL = [...REVIEW_TOOLS, "mcp__artdirector__*"];
    // The intake tool only on a build turn with a bridge; the suggest tool only on a review
    // turn with a bridge (Phase 3). Both are in-process SDK MCP servers — load the SDK only
    // when one is actually needed (unchanged behaviour for a plain chat/build turn).
    const wantIntake = askIntake && !reviewMode;
    const wantSuggest = onSuggest && reviewMode;
    const sdk = (wantIntake || wantSuggest) ? await getSdk() : null;
    const intakeServer = wantIntake ? buildIntakeServer(sdk, askIntake) : null;
    const suggestServer = wantSuggest ? buildSuggestServer(sdk, onSuggest) : null;
    const mcpServers = {
      ...(intakeServer ? { intake: intakeServer } : {}),
      ...(suggestServer ? { artdirector: suggestServer } : {}),
    };
    const iterator = query({
      prompt,
      options: {
        cwd,
        includePartialMessages: true,
        permissionMode: "default",
        ...(claudeExe ? { pathToClaudeCodeExecutable: claudeExe } : {}),
        ...(model ? { model } : {}),
        ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
        // Art Director persona on a review turn, else the builder persona + copy voice.
        systemPrompt: { type: "preset", preset: "claude_code", append: systemAppend },
        // Read-only in review mode (+ the suggest tool); full build toolset otherwise.
        allowedTools: reviewMode ? REVIEW_TOOLS_ALL : BUILD_TOOLS,
        ...(sessionId ? { resume: sessionId } : {}),

        // AskUserQuestion surfaces through canUseTool with the full structured
        // input (questions + options). We render it as clickable buttons in the
        // renderer and return the choices via updatedInput.answers so the tool
        // resolves with the user's selection instead of falling back to text.
        canUseTool: async (toolName, input) => {
          if (toolName === "AskUserQuestion" && askQuestion) {
            try {
              const answers = await askQuestion(input.questions);
              return { behavior: "allow", updatedInput: { ...input, answers } };
            } catch {
              return { behavior: "deny", message: "The user dismissed the question." };
            }
          }
          return { behavior: "allow", updatedInput: input };
        },
      },
    });
    // Hand the live query up so the app can interrupt this turn (e.g. the designer
    // hit Back mid-intake). Cleared in the finally below when the turn ends.
    if (onQuery) { try { onQuery(iterator); } catch { /* non-fatal */ } }

    // Track the usage of the LAST single model call in this turn. Its input side
    // (fresh input + both cache tiers) ≈ the current context-window occupancy —
    // unlike the result message's `usage`, which is CUMULATIVE across every
    // internal call of an agentic turn and hugely overstates how full context is.
    let lastCallUsage = null;

    for await (const message of iterator) {
      switch (message.type) {
        case "system":
          if (message.subtype === "init" && message.session_id) {
            resolvedSession = message.session_id;
          }
          break;

        case "stream_event": {
          const ev = message.event;
          if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            onEvent({ type: "text", text: ev.delta.text });
          } else if (
            ev?.type === "content_block_start" &&
            ev.content_block?.type === "tool_use"
          ) {
            onEvent({ type: "tool", name: ev.content_block.name });
          }
          break;
        }

        // The complete assistant message carries full tool inputs — emit a
        // plain-language "activity" hint (from the target file/command) for the
        // setup placeholder. Separate from the "tool" event above so chat and the
        // preview-timing polling are unaffected if this stream ever changes.
        case "assistant": {
          // Each assistant message = one completed model call; its usage is that
          // single request's real token breakdown. Keep the latest (= peak, since
          // context grows within a turn) for the renderer's context gauge.
          if (message.message?.usage) lastCallUsage = message.message.usage;
          const content = message.message?.content || message.content || [];
          for (const block of content) {
            if (block?.type === "tool_use") {
              onEvent({ type: "activity", name: block.name, target: toolTarget(block.input) });
              // The /design build is TodoWrite-driven; forward the list so the renderer's
              // quiet-build spine can advance to the phase the agent is actually on.
              if (block.name === "TodoWrite" && Array.isArray(block.input?.todos)) {
                onEvent({ type: "todo", todos: block.input.todos });
              }
            }
          }
          break;
        }

        case "result":
          if (message.session_id) resolvedSession = message.session_id;
          if (message.subtype === "success") {
            // Forward token usage so the renderer can size the context gauge and
            // nudge on long sessions. Prefer the LAST single call's usage (≈ real
            // context occupancy) over the result message's cumulative-per-turn
            // total. modelUsage (when present) carries the exact contextWindow.
            onEvent({
              type: "result",
              text: message.result ?? "",
              usage: lastCallUsage ?? message.usage ?? null,
              modelUsage: message.modelUsage ?? null,
            });
          } else {
            onEvent({ type: "error", message: `Agent turn ended: ${message.subtype}` });
          }
          break;
      }
    }
  } catch (err) {
    onEvent({ type: "error", message: err?.message ?? String(err) });
  } finally {
    if (onQuery) { try { onQuery(null); } catch { /* non-fatal */ } }
  }

  return { sessionId: resolvedSession };
}
