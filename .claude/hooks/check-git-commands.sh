#!/usr/bin/env bash
# PreToolUse Bash hook.
# Blocks two patterns that are always wrong in this repo:
#   1. `--no-verify` on any git command — hooks exist so new errors do not
#      land; bypassing them defeats the whole pre-commit ratchet.
#   2. Direct `gh issue create` — use ./.claude/commands/create-issue.sh so the
#      issue template, labels, and body shape stay consistent.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

case "$COMMAND" in
  *"--no-verify"*)
    cat >&2 <<'EOF'
🚫 BLOCKED: --no-verify detected.

Hooks exist to stop new lint/type/test errors landing. Do not bypass them.
Let the command fail, read the output, fix the cause, and try again.

If the user genuinely needs to bypass, they can run the command themselves.
EOF
    exit 2
    ;;
esac

case "$COMMAND" in
  *"gh issue create"*)
    cat >&2 <<'EOF'
🚫 BLOCKED: direct `gh issue create` detected.

Use the project wrapper instead so template, labels, and body structure stay
consistent across issues:

  ./.claude/commands/create-issue.sh "<title>" "<body>"
EOF
    exit 2
    ;;
esac

exit 0
