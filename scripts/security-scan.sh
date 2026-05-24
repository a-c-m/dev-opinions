#!/usr/bin/env bash
# security-scan.sh — run Trivy across the repo.
#
# Fails on HIGH or CRITICAL findings. MEDIUM/LOW are reported but do not gate.
# Full report is written to /tmp/base-app-trivy.log for later inspection.
#
# Usage:
#   ./scripts/security-scan.sh             # fs scan (deps + secrets + config)
#   ./scripts/security-scan.sh --json      # emit JSON at /tmp/base-app-trivy.json
#   ./scripts/security-scan.sh --ignore X  # pass --skip-files or similar to trivy

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"

if ! command -v trivy >/dev/null 2>&1; then
  cat >&2 <<EOF
trivy is not installed.

install with:
  macOS:           brew install aquasecurity/trivy/trivy
  debian/ubuntu:   see https://aquasecurity.github.io/trivy/
  CI:              use aquasecurity/trivy-action

security is part of the default quality gate (ADR 0008). Fix this rather than
skipping it.
EOF
  exit 127
fi

OUTPUT="/tmp/base-app-trivy.log"
JSON_OUT="/tmp/base-app-trivy.json"

echo "→ trivy fs scan (deps + secrets + config)"
trivy fs \
  --scanners vuln,secret,misconfig \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --ignorefile .trivyignore \
  --cache-dir "${TRIVY_CACHE_DIR:-$HOME/.cache/trivy}" \
  . 2>&1 | tee "$OUTPUT"

STATUS=${PIPESTATUS[0]}

# Emit JSON for CI upload / later analysis (non-blocking).
trivy fs \
  --scanners vuln,secret,misconfig \
  --format json \
  --output "$JSON_OUT" \
  . >/dev/null 2>&1 || true

if [ "$STATUS" -ne 0 ]; then
  echo >&2
  echo "✗ trivy found HIGH or CRITICAL issues. See $OUTPUT or $JSON_OUT" >&2
  exit "$STATUS"
fi

echo "✓ trivy: no HIGH or CRITICAL findings (report: $OUTPUT)"
