#!/usr/bin/env bash
# PreToolUse hook for Edit/Write on test files.
# Blocks introduction of `page.waitForTimeout` — a fixed-duration sleep is a
# flaky test in waiting. Use a condition-based wait instead.

set -euo pipefail

INPUT="$(cat)"

TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

# Only applies to test/e2e files.
case "$FILE_PATH" in
  *.spec.ts|*.test.ts|*.spec.tsx|*.test.tsx|*/e2e/*) ;;
  *) exit 0 ;;
esac

# Extract the content that will be written.
NEW_TEXT=""
case "$TOOL" in
  Write) NEW_TEXT="$(printf '%s' "$INPUT" | jq -r '.tool_input.content // empty')" ;;
  Edit)  NEW_TEXT="$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // empty')" ;;
  *)     exit 0 ;;
esac

if printf '%s' "$NEW_TEXT" | rg -qF 'waitForTimeout'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: page.waitForTimeout in a test file.

Fixed-duration sleeps cause flaky tests. Replace with a condition-based wait:

  await expect(locator).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector(selector)
  await page.waitForFunction(() => condition)
EOF
  exit 2
fi

exit 0
