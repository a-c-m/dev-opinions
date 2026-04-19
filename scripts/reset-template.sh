#!/usr/bin/env bash
# reset-template.sh — strip sample apps when adopting this template for a real project.
#
# Removes:
#   apps/sample-api, apps/sample-web
#   zod / NestJS / React /Playwright deps that only the samples needed
#   the sample section of README.md
#
# Keeps everything else (root config, docs/adr, .claude, scripts).
#
# Usage:
#   ./scripts/reset-template.sh            # confirms, then removes
#   ./scripts/reset-template.sh --yes      # non-interactive
#   ./scripts/reset-template.sh --dry-run  # show what would happen

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y)  ASSUME_YES=1 ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "unknown flag: $arg" >&2
      exit 1
      ;;
  esac
done

SAMPLE_DIRS=(apps/sample-api apps/sample-web)

EXISTING=()
for d in "${SAMPLE_DIRS[@]}"; do
  [ -d "$d" ] && EXISTING+=("$d")
done

if [ "${#EXISTING[@]}" -eq 0 ]; then
  echo "no sample apps found — nothing to remove."
  exit 0
fi

echo "this will remove:"
for d in "${EXISTING[@]}"; do echo "  - $d"; done
echo "and rewrite README.md to drop the sample-apps section."

if [ "$DRY_RUN" -eq 1 ]; then
  echo "(dry run — no changes made)"
  exit 0
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'proceed? [y/N] '
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "aborted."; exit 1 ;;
  esac
fi

for d in "${EXISTING[@]}"; do
  rm -rf "$d"
  echo "removed $d"
done

# Strip the "Sample apps" section from README.md.
if [ -f README.md ]; then
  node -e '
    const fs = require("fs");
    const p = "README.md";
    const src = fs.readFileSync(p, "utf8");
    const marker = /\n## Sample apps[\s\S]*$/m;
    if (marker.test(src)) {
      fs.writeFileSync(p, src.replace(marker, "\n"));
      console.log("trimmed README.md sample-apps section");
    }
  '
fi

# Reinstall to prune lockfile entries the samples pulled in.
if command -v pnpm >/dev/null 2>&1; then
  echo "running pnpm install to refresh the lockfile..."
  pnpm install
fi

echo
echo "✓ template reset. Generate your first app with:"
echo "    pnpm nx g @nx/nest:app <name>"
echo "    pnpm nx g @nx/react:app <name>"
