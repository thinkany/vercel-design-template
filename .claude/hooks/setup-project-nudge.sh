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
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This is a FRESH, UNBRANDED copy of the design template — VITE_CLIENT_NAME is empty in .env, so it has not been set up yet. Before other work, greet the designer and run the setup flow by invoking the setup-project skill (the /setup-project command) to brand the template. If the designer clearly opened this session for a different task, offer to run /setup-project first but respect their choice."}}
JSON
