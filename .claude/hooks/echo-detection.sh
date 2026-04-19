#!/usr/bin/env bash
# PreToolUse hook for Bash.
# Flags lazy uses of echo/cat/sed that should be Write/Edit/Read tool calls.
# Advisory-only: exits 0 with a stderr nudge. Claude sees the nudge and can
# adjust without the tool call being blocked.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

WARN=""

case "$COMMAND" in
  *"echo"*">"*)           WARN="Writing a file with 'echo >' — use the Write tool for clarity and permission-prompt consistency." ;;
  *"cat <<"*|*"cat <<<"*) WARN="Heredoc into a file via 'cat <<' — use the Write tool instead." ;;
  *"sed -i"*)             WARN="In-place sed — use the Edit tool for reviewable, single-occurrence edits." ;;
  *"awk "*">"*)           WARN="Writing a file via awk — use the Write tool." ;;
esac

if [ -n "$WARN" ]; then
  echo "nudge: $WARN" >&2
fi

exit 0
