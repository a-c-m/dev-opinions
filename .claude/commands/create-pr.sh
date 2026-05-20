#!/usr/bin/env bash
# Create a PR against the default branch with a summary + test plan.
#
# Every PR must reference the ticket it relates to. Accepts:
#   - GitHub issue:      `123` or `#123` → title suffix `#123`, body `Closes #123`
#   - Jira/Linear:       `PROJ-123`       → title suffix `PROJ-123`, body `Refs PROJ-123`
#
# `Closes` triggers GitHub's auto-close behaviour on merge for GH issues.
# Jira/Linear get `Refs` because GitHub can't close them; the tracker
# integration picks the ID up from the body.
#
# Usage:
#   create-pr.sh "<title>" "<summary>" <ticket>
#
# Examples:
#   create-pr.sh "feat(api): add search endpoint" "Adds /search with pagination." 123
#   create-pr.sh "feat(api): add search endpoint" "Adds /search with pagination." PROJ-456
#
# If the PR genuinely has no ticket, ask the human to run `gh pr create`
# themselves — there is no AI-side escape hatch.

set -euo pipefail

TITLE="${1:-}"
SUMMARY="${2:-}"
TICKET="${3:-}"

if [ -z "$TITLE" ] || [ -z "$TICKET" ]; then
  echo "usage: create-pr.sh \"<title>\" \"<summary>\" <ticket>" >&2
  echo "  <ticket> is either 123 / #123 (GitHub) or PROJ-123 (Jira/Linear)" >&2
  exit 1
fi

# Normalise the ticket into:
#   REF  — what goes in the title suffix (`#123` or `PROJ-123`)
#   VERB — what precedes the ref in the body (`Closes` for GH, `Refs` for everything else)
#
# Rules:
#   bare digits  → GitHub issue → REF=`#$TICKET`, VERB=Closes
#   `#NNN`       → GitHub issue → REF=$TICKET,    VERB=Closes
#   `PROJ-NNN`   → Jira/Linear  → REF=$TICKET,    VERB=Refs
case "$TICKET" in
  \#[0-9]*)
    REF="$TICKET"
    VERB="Closes"
    ;;
  [0-9]*)
    if ! printf '%s' "$TICKET" | rg -q '^[0-9]+$'; then
      echo "ticket starting with a digit must be all digits, got: $TICKET" >&2
      exit 1
    fi
    REF="#$TICKET"
    VERB="Closes"
    ;;
  [A-Z]*)
    if ! printf '%s' "$TICKET" | rg -q '^[A-Z][A-Z0-9]+-[0-9]+$'; then
      echo "expected PROJ-NNN format for non-GitHub ticket, got: $TICKET" >&2
      exit 1
    fi
    REF="$TICKET"
    VERB="Refs"
    ;;
  *)
    echo "unrecognised ticket format: $TICKET (expected 123, #123, or PROJ-123)" >&2
    exit 1
    ;;
esac

# Append REF to the title if it isn't already there.
case "$TITLE" in
  *"$REF"*) FINAL_TITLE="$TITLE" ;;
  *)        FINAL_TITLE="$TITLE $REF" ;;
esac

gh pr create --title "$FINAL_TITLE" --body "$(cat <<EOF
$VERB $REF

## Summary

$SUMMARY

## Test plan

- [ ] \`pnpm check\` passes locally
- [ ] Affected E2E suites pass (\`pnpm test:e2e\`)
- [ ] Manual verification if UI changed

## ADR alignment

- [ ] No new stack divergence, or: new/updated ADR attached under \`docs/adr/\`
EOF
)"
