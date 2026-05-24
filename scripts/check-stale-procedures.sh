#!/usr/bin/env bash
# check-stale-procedures.sh — flag runbook and SOP files that haven't been
# touched in a while (per ADR 0026).
#
# Walks all committed *.md files under any runbooks/ or sops/ directory,
# checks each file's last commit date via `git log --follow`, and lists
# anything past the staleness threshold (default 90 days).
#
# Advisory by design: exit code is 0 even when stale files are found.
# CI surfaces the list as a warning, not a failure — forcing touches
# recreates the "touch the date" no-op pattern this design avoids.
#
# Usage:
#   ./scripts/check-stale-procedures.sh              # default 90 days
#   ./scripts/check-stale-procedures.sh --days 180   # custom threshold
#   STALE_DAYS=30 ./scripts/check-stale-procedures.sh

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"

THRESHOLD_DAYS="${STALE_DAYS:-90}"
if [ "${1:-}" = "--days" ] && [ -n "${2:-}" ]; then
  THRESHOLD_DAYS="$2"
fi

NOW_EPOCH="$(date +%s)"
CUTOFF_EPOCH=$(( NOW_EPOCH - THRESHOLD_DAYS * 86400 ))

# Collect committed *.md files under any runbooks/ or sops/ directory.
# `git ls-files` honours .gitignore and skips uncommitted files —
# the staleness signal only makes sense for tracked files.
# Using a while-read loop instead of `mapfile` for bash 3.2 portability (macOS).
FILES=()
while IFS= read -r line; do
  [ -n "$line" ] && FILES+=("$line")
done < <(git ls-files -- '*runbooks/*.md' '*sops/*.md' | sort -u)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "✓ no runbook or SOP files found"
  exit 0
fi

STALE_COUNT=0
for file in "${FILES[@]}"; do
  # %ct = committer date, Unix timestamp. --follow handles renames.
  LAST_EPOCH="$(git log -1 --follow --format=%ct -- "$file" 2>/dev/null || echo 0)"
  if [ "$LAST_EPOCH" = "0" ]; then
    continue
  fi
  if [ "$LAST_EPOCH" -lt "$CUTOFF_EPOCH" ]; then
    AGE_DAYS=$(( (NOW_EPOCH - LAST_EPOCH) / 86400 ))
    printf "  %s  (%d days)\n" "$file" "$AGE_DAYS"
    STALE_COUNT=$(( STALE_COUNT + 1 ))
  fi
done

echo
if [ "$STALE_COUNT" -eq 0 ]; then
  echo "✓ all ${#FILES[@]} procedure files touched within ${THRESHOLD_DAYS} days"
else
  echo "⚠ ${STALE_COUNT} of ${#FILES[@]} procedure files not touched in ${THRESHOLD_DAYS}+ days"
  echo "  Review and update during the next post-mortem or process touch."
  echo "  This is advisory; CI does not block on this."
fi
