// Agent SDK wrapper — the one file the Claude Agent SDK integration lives in.
//
// Contract (main.mjs depends on exactly this):
//   runPrompt({ prompt, sessionId, cwd, onEvent }) -> Promise<{ sessionId }>
//   onEvent(evt) is called for each streamed chunk, where evt is one of:
//     { type: "text",   text }            assistant text delta
//     { type: "tool",   name }            a tool-use the agent invoked
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

let _query = null;
async function getQuery() {
  if (_query) return _query;
  const mod = await import("@anthropic-ai/claude-agent-sdk");
  _query = mod.query;
  return _query;
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

export async function runPrompt({ prompt, sessionId, cwd, onEvent, askQuestion, model, copyVoice }) {
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
    const voiceAppend = buildVoiceAppend(copyVoice);
    const iterator = query({
      prompt,
      options: {
        cwd,
        includePartialMessages: true,
        permissionMode: "default",
        ...(claudeExe ? { pathToClaudeCodeExecutable: claudeExe } : {}),
        ...(model ? { model } : {}),
        // Copy voice → append to Claude Code's default system prompt (only when a
        // voice is set, so the no-voice path is byte-for-byte the current default).
        ...(voiceAppend ? { systemPrompt: { type: "preset", preset: "claude_code", append: voiceAppend } } : {}),
        // Spike: auto-allow the core toolset so we can drive /setup-project
        // end-to-end. The canUseTool approval UI is a deliberate later step.
        allowedTools: [
          "Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch",
          // Pre-approve the Figma MCP tools (used by the export-to-Figma flow) so
          // they clear at the allow-rules stage and never hit an interactive
          // permission handshake this non-interactive session can't answer — that
          // was surfacing as "Tool permission request failed: AbortError: Stream
          // closed". Wildcard MUST be mcp__<server>__* (a bare "mcp__figma" is
          // ignored with a warning). This keeps canUseTool intact for
          // AskUserQuestion (unlike permissionMode:"bypassPermissions", which
          // would skip it and break the clickable prompts). If the Figma OAuth
          // token isn't available to the bundled CLI, the server reports
          // needs-auth and its tools are simply skipped — a clean degrade, not an
          // abort — which also tells us OAuth is the remaining piece.
          "mcp__figma__*",
        ],
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
  }

  return { sessionId: resolvedSession };
}
