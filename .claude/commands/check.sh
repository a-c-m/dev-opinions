#!/usr/bin/env bash
# Full quality gate: lint + typecheck + test + knip + security.
# Matches `pnpm check` — keep the two in sync (see ADR 0015).
# Run this before raising a PR.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "→ biome check (bs)"
pnpm lint:check

echo "→ typecheck"
pnpm typecheck

echo "→ test"
pnpm test

echo "→ knip"
pnpm knip

echo "→ security (trivy)"
pnpm security

echo "✓ all checks passed"
