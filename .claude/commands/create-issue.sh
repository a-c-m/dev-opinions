#!/usr/bin/env bash
# Wrapper around `gh issue create` that uses the repo's issue templates.
#
# The templates live in .github/ISSUE_TEMPLATE/ (see ADR 0031). This wrapper
# picks one by name and hands off to gh, so the template's body structure is
# authoritative — the wrapper does not hand-roll a body.
#
# Usage:
#   create-issue.sh [--template <name>] "<title>"
#   create-issue.sh "<title>"                      # defaults to task
#   create-issue.sh --template bug "<title>"
#   create-issue.sh --template spike "<title>"
#   create-issue.sh --template output "<title>"    # parent — sprint-level bundle
#
# Available templates: output, task, bug, spike, release.
# Names track handbook/development.md (Work types + the Output parent concept)
# and handbook/spikes.md. Task is the catch-all — "if it needs doing, it's
# probably a task" — so no separate "Other" template.

set -euo pipefail

TEMPLATE="task"
TITLE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --template|-t)
      TEMPLATE="${2:-}"
      [ -z "$TEMPLATE" ] && { echo "--template needs a value" >&2; exit 1; }
      shift 2
      ;;
    --help|-h)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    --) shift; TITLE="${1:-$TITLE}"; shift || true ;;
    *)
      TITLE="$1"
      shift
      ;;
  esac
done

if [ -z "$TITLE" ]; then
  echo "usage: create-issue.sh [--template <name>] \"<title>\"" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TEMPLATE_FILE="$REPO_ROOT/.github/ISSUE_TEMPLATE/${TEMPLATE}.md"
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "template not found: $TEMPLATE_FILE" >&2
  echo "available:" >&2
  ls "$REPO_ROOT/.github/ISSUE_TEMPLATE/" 2>/dev/null | rg '\.md$' | sed 's|\.md$||' | sed 's/^/  /' >&2
  exit 1
fi

exec gh issue create --title "$TITLE" --template "${TEMPLATE}.md"
