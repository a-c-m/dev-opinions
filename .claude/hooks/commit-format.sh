#!/usr/bin/env bash
# PostToolUse hook for Bash.
# After any `git commit` call, validate that HEAD's subject matches
# Conventional Commits. Advisory-only: emits a warning on stderr, exits 0,
# so the session continues. Use commitlint via lefthook for hard enforcement.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

case "$COMMAND" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

SUBJECT="$(git log -1 --pretty=%s 2>/dev/null || true)"
[ -n "$SUBJECT" ] || exit 0

# type(scope)!?: description  or  type!?: description
if ! printf '%s' "$SUBJECT" | grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .+'; then
  echo "commit subject does not match Conventional Commits: \"$SUBJECT\"" >&2
  echo "expected: type(scope): description — see docs/adr/0011-conventional-commits.md" >&2
fi

exit 0
