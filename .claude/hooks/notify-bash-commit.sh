#!/usr/bin/env bash
# PostToolUse hook for Bash.
# After any `git commit` call, validate HEAD's subject against:
#   1. Conventional Commits (ADR 0031 → Commit conventions).
#   2. Trailing GitHub issue reference (`#NNN`).
#
# Advisory-only: emits a warning on stderr, exits 0, so the session
# continues. PreToolUse (`block-bash-git.sh`) is the hard gate for
# AI-authored commits; this is the safety net for commits that came in
# via $EDITOR (which PreToolUse can't inspect) and the conventional-
# format check.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

case "$COMMAND" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

SUBJECT="$(git log -1 --pretty=%s 2>/dev/null || true)"
[ -n "$SUBJECT" ] || exit 0

WARN=0

# 1. Conventional Commits — type(scope)!?: description  or  type!?: description
if ! printf '%s' "$SUBJECT" | rg -q '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .+'; then
  echo "commit subject does not match Conventional Commits: \"$SUBJECT\"" >&2
  echo "expected: type(scope): description — see docs/adr/0031-github-repo-conventions.md#commit-conventions" >&2
  WARN=1
fi

# 2. Trailing ticket reference — GitHub `#NNN` or Jira/Linear `PROJ-NNN`.
TICKET_RE='(#[0-9]+|[A-Z][A-Z0-9]+-[0-9]+)'
if ! printf '%s' "$SUBJECT" | rg -q "(^|\s)${TICKET_RE}(\s+${TICKET_RE})*[)\s]*$"; then
  echo "commit subject is missing a trailing ticket reference: \"$SUBJECT\"" >&2
  echo "expected: \"... #123\" or \"... PROJ-123\" suffix — see CLAUDE.md \"Every commit names its ticket\"." >&2
  WARN=1
fi

exit 0
