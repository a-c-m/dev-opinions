#!/usr/bin/env bash
# PreToolUse Bash hook.
# Blocks `bs update` — mutating the suppression baseline silently hides new
# lint regressions. Baseline changes must be a deliberate, reviewed action,
# not something absorbed mid-session.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

# Match `bs update` as a whole command (with optional pnpm/yarn/npx prefix).
if printf '%s' "$COMMAND" | grep -Eq '(^|[[:space:];|&])(pnpm[[:space:]]+exec[[:space:]]+|pnpm[[:space:]]+|yarn[[:space:]]+|npx[[:space:]]+)?bs[[:space:]]+update([[:space:];|&]|$)'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: 'bs update' detected.

Updating the suppression baseline hides new lint errors. Do not run this
automatically. Instead:

  1. Fix the lint errors if possible.
  2. Add a file-level `biome-ignore` comment for unavoidable cases.
  3. Only the user should run `bs update`, after reviewing what it suppresses.

If you are facing new lint errors, ask the user:
  "I found N new lint errors. Should I fix them or do you want to baseline them?"
EOF
  exit 2
fi
