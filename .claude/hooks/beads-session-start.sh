#!/usr/bin/env bash
# SessionStart hook — surface open local tasks from beads (`bd`) so Claude
# starts the session aware of what's already in flight.
#
# Beads is optional per-repo. The hook's behaviour:
#   - No `.beads/` in the repo   → silent exit 0 (beads not used here).
#   - `.beads/` exists, `bd` missing → loud stderr, exit 0 (non-blocking but
#     surfaces the setup gap).
#   - `.beads/` exists and `bd` works → run `bd status` and `bd list --ready`,
#     emit to stdout as session context.
#
# Output on stdout is injected into Claude's initial context at session start.
# Keep it short — stdout is context, not logs.

set -eu

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ ! -d "$REPO_ROOT/.beads" ]; then
  exit 0
fi

if ! command -v bd >/dev/null 2>&1; then
  echo "beads is configured for this repo (.beads/ exists) but the 'bd' CLI is not on PATH." >&2
  echo "install: brew install beads — see https://github.com/steveyegge/beads" >&2
  exit 0
fi

cd "$REPO_ROOT"

echo "## Local tasks (beads)"
echo
echo "_Local tasks only. Team / long-running work lives in GitHub Issues (gh issue create)._"
echo
echo "### Status"
echo '```'
bd --quiet status 2>/dev/null || echo "(no beads database yet)"
echo '```'
echo
echo "### Ready to pick up"
echo '```'
bd --quiet list --ready --limit 10 2>/dev/null || echo "(nothing ready)"
echo '```'
exit 0
