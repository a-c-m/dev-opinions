#!/usr/bin/env bash
# scripts/setup-mac.sh — install macOS system prerequisites for this repo.
#
# Idempotent. Skips anything already installed. Assumes Homebrew is present
# (https://brew.sh).
#
# Required (the gate and Claude hooks depend on these):
#   ripgrep   — search tool; required by .claude/hooks/check-bash-rules.sh.
#   jq        — JSON parser used by .claude/hooks/* to read tool input.
#   trivy     — vulnerability scanner used by `pnpm security` (ADR 0008).
#
# Optional (re-run with INCLUDE_OPTIONAL=1):
#   opentofu  — only if you'll touch apps/*/iac/ (ADR 0022).
#   beads     — local task tracking surfaced by SessionStart hook.
#
# Does NOT install Node / pnpm. Use nvm/fnm + corepack — see docs/QUICKSTART.md.

set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Install it first: https://brew.sh" >&2
  exit 1
fi

install_if_missing() {
  local label="$1"
  local bin="$2"
  local formula="$3"
  if command -v "$bin" >/dev/null 2>&1; then
    echo "✓ $label already installed ($(command -v "$bin"))"
  else
    echo "→ installing $label ($formula)"
    brew install "$formula"
  fi
}

echo "Installing required system tools …"
install_if_missing "ripgrep" rg ripgrep
install_if_missing "jq"      jq jq
install_if_missing "trivy"   trivy aquasecurity/trivy/trivy

if [ "${INCLUDE_OPTIONAL:-0}" = "1" ]; then
  echo
  echo "Installing optional tools (INCLUDE_OPTIONAL=1) …"
  install_if_missing "opentofu" tofu  opentofu
  install_if_missing "beads"    bd    beads
else
  echo
  echo "Optional tools available — re-run with INCLUDE_OPTIONAL=1 to install:"
  echo "  - opentofu (apps/*/iac/ work)"
  echo "  - beads (local task tracking)"
fi

echo
echo "Done. Verify with:"
echo "  rg --version"
echo "  jq --version"
echo "  trivy --version"
