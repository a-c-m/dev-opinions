#!/usr/bin/env bash
# PreToolUse Bash hook — biome / biome-suppressed (`bs`) guardrails.
#
# Rules enforced:
#   1. `bs update` is blocked. Updating the suppression baseline silently
#      hides new lint regressions; baseline changes must be a deliberate,
#      reviewed action by the human, not absorbed mid-session.
#   2. `biome … --unsafe` / `bs … --unsafe` is blocked. Auto-unsafe fixes
#      can change program semantics (e.g. unwrapping void-returning
#      expressions, dropping load-bearing parens). Apply --unsafe by hand
#      per-file, review the diff, then commit.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Strip heredoc bodies and quoted strings before pattern-matching, so
# commit messages or doc text mentioning `bs update` / `--unsafe` don't
# false-positive. Mirrors check-bash-rules.sh.
SCRUBBED="$(CMD="$COMMAND" python3 - <<'PY'
import os, re
cmd = os.environ.get("CMD", "")
cmd = re.sub(
    r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?^\s*\1\s*$",
    "",
    cmd,
    flags=re.DOTALL | re.MULTILINE,
)
cmd = re.sub(r"'(?:[^'\\]|\\.)*'", "", cmd)
cmd = re.sub(r'"(?:[^"\\]|\\.)*"', "", cmd)
print(cmd)
PY
)"

# 1. `bs update`
if printf '%s' "$SCRUBBED" | rg -q '(^|[\s;|&])(pnpm\s+exec\s+|pnpm\s+|yarn\s+|npx\s+)?bs\s+update([\s;|&]|$)'; then
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

# 2. biome / bs --unsafe
case "$SCRUBBED" in
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
