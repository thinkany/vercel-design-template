#!/usr/bin/env bash
# SessionStart hook — on a FRESH, UNBRANDED copy of this template, inject context
# telling Claude to kick off the /setup-project branding flow. Once the template
# is branded (VITE_CLIENT_NAME set in .env), this is a silent no-op.
#
# A hook can't literally type a slash command, so it injects an instruction via
# hookSpecificOutput.additionalContext instead.
set -euo pipefail

# Resolve project root: prefer the dir Claude Code passes, else derive from this
# script's location (.claude/hooks/ -> repo root).
root="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$root" ]; then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
env_file="$root/.env"

# Read VITE_CLIENT_NAME, stripping surrounding quotes and whitespace.
client=""
if [ -f "$env_file" ]; then
  client="$(grep -E '^[[:space:]]*VITE_CLIENT_NAME=' "$env_file" | tail -n1 \
    | sed -E 's/^[[:space:]]*VITE_CLIENT_NAME=//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' \
    | tr -d '[:space:]')"
fi

# Branded already → do nothing.
[ -n "$client" ] && exit 0

# Unbranded → nudge Claude to run setup.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This is a FRESH, UNBRANDED copy of the design template (VITE_CLIENT_NAME is empty in .env) — it has not been set up for a client yet. The designer is prompted to say hello to begin. On their FIRST message, unless it is unmistakably a DIFFERENT task, reply with just ONE short welcome line and then IMMEDIATELY invoke the setup-project skill (run the /setup-project command) to start branding. A greeting like 'hello' IS the go-ahead — do NOT ask permission, do NOT offer it as a choice, do NOT wait for confirmation; start setup right away. Only skip setup if the first message is clearly a different, specific request, in which case handle that and offer /setup-project afterward."}}
JSON
