// Agent SDK wrapper — the one file the Claude Agent SDK integration lives in.
//
// Contract (main.mjs depends on exactly this):
//   runPrompt({ prompt, sessionId, cwd, onEvent }) -> Promise<{ sessionId }>
//   onEvent(evt) is called for each streamed chunk, where evt is one of:
//     { type: "text",   text }            assistant text delta
//     { type: "tool",   name }            a tool-use the agent invoked
//     { type: "result", text }            end of the assistant turn
//     { type: "error",  message }         something failed
//
// The SDK is imported dynamically so a missing install (or missing API key)
// surfaces as a friendly chat error instead of crashing the app at boot.

let _query = null;
async function getQuery() {
  if (_query) return _query;
  const mod = await import("@anthropic-ai/claude-agent-sdk");
  _query = mod.query;
  return _query;
}

export async function runPrompt({ prompt, sessionId, cwd, onEvent }) {
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
    const iterator = query({
      prompt,
      options: {
        cwd,
        includePartialMessages: true,
        permissionMode: "default",
        // Spike: auto-allow the core toolset so we can drive /setup-project
        // end-to-end. The canUseTool approval UI is a deliberate later step.
        allowedTools: [
          "Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch",
        ],
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

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

        case "result":
          if (message.session_id) resolvedSession = message.session_id;
          if (message.subtype === "success") {
            onEvent({ type: "result", text: message.result ?? "" });
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
