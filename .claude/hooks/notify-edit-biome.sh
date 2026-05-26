#!/usr/bin/env bash
# PostToolUse hook for Edit/Write.
# Advisory: after an edit lands on a TS/JS file, run biome on that single file
# and surface any new diagnostics. Non-blocking — commit-time hooks (lefthook)
# are the real gate. The goal here is to give Claude immediate feedback so it
# can self-correct in the same turn rather than waiting for commit.

set -euo pipefail

INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')"

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
case "$FILE_PATH" in
  "$REPO_ROOT"/*) ;;
  *) exit 0 ;;
esac

# If biome is not installed yet, the advisory cannot run. Silent — the pre-edit
# hook is the one that enforces; this is just a nudge.
if [ ! -x "$REPO_ROOT/node_modules/.bin/biome" ]; then
  exit 0
fi

# Run biome on the single file. Capture output for review in /tmp.
LOG="/tmp/base-app-post-edit-$$.log"
if ! pnpm exec biome check "$FILE_PATH" > "$LOG" 2>&1; then
  echo "post-edit: biome diagnostics on $FILE_PATH — see $LOG" >&2
  tail -n 20 "$LOG" >&2
fi

exit 0
