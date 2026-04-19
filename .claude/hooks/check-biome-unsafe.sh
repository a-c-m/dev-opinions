#!/usr/bin/env bash
# PreToolUse Bash hook.
# Blocks biome/bs commands carrying --unsafe. Auto-unsafe fixes can silently
# change program semantics (e.g. unwrapping void-returning expressions, dropping
# parentheses that mattered). Always opt-in per-file by hand, never session-wide.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

case "$COMMAND" in
  *"biome "*"--unsafe"*|*"bs "*"--unsafe"*)
    cat >&2 <<EOF
🚫 BLOCKED: --unsafe detected in a biome/bs command.

Auto-unsafe fixes can change behaviour (not just formatting). Run biome's
default fixes first. If a specific --unsafe fix is needed, apply it by hand
on a specific file, review the diff, and then commit.

Blocked command:
  $COMMAND
EOF
    exit 2
    ;;
esac

exit 0
