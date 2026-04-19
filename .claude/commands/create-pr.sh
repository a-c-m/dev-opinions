#!/usr/bin/env bash
# Create a PR against the default branch with a summary + test plan.
# Usage: create-pr.sh "<title>" "<summary>"

set -euo pipefail

TITLE="${1:-}"
SUMMARY="${2:-}"

if [ -z "$TITLE" ]; then
  echo "usage: create-pr.sh \"<title>\" \"<summary>\"" >&2
  exit 1
fi

gh pr create --title "$TITLE" --body "$(cat <<EOF
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
