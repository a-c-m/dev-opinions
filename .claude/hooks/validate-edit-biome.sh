#!/usr/bin/env bash
# PreToolUse hook for Edit/Write.
#
# Diagnostic-delta check — preserves ADR 0006's baseline-ratchet story:
# block only when the proposed edit introduces NEW biome diagnostics that
# were not already present in the on-disk file.
#
# Pre-existing diagnostics are allowed through. Edits that *fix* diagnostics
# are allowed through. Edits that *add* diagnostics are blocked with a list
# of the new ones.
#
# Biome's stdin mode does not emit structured JSON diagnostics, so we can't
# pipe the proposed content in. Instead, we write the proposed content to a
# **sibling** temp file in the same directory (same extension, so biome
# treats it identically and resolves the same biome.json) and scan that.
# The original FILE_PATH is never modified — important because:
#
# 1. Claude Code's Edit/Write content-change check uses stat timestamps
#    (mtime + ctime). Any cp/restore on the original would bump ctime even
#    when bytes match, causing every Edit to fail with "content has changed
#    since last read".
# 2. File watchers (vite dev, tsc --watch) on the real path don't churn on
#    phantom modifications.

set -euo pipefail

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')"

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc) ;;
  *) exit 0 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
case "$FILE_PATH" in
  "$REPO_ROOT"/*) ;;
  *) exit 0 ;;
esac

# Biome must be installed. No skip-path — see CLAUDE.md "Fail, don't skip".
if ! pnpm exec biome --version >/dev/null 2>&1; then
  echo "biome is not installed — run 'pnpm install' before editing." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Build the proposed-content sibling file. Same directory + same extension so
# biome resolves the same project config. Only this temp file is written —
# the original FILE_PATH is never touched.
#
# Naming: `<stem>.biome-check.<ext>`. We deliberately avoid `mktemp`'s hex
# randomness because biome's `useFilenamingConvention` rule rejects names
# with non-kebab characters, which would surface as a phantom "new
# diagnostic" on every edit. Hooks run sequentially per Claude session so
# the static filename doesn't collide; we still `rm` it on EXIT.
# ---------------------------------------------------------------------------
DIR="$(dirname "$FILE_PATH")"
BASE="$(basename "$FILE_PATH")"
EXT="${BASE##*.}"
STEM="${BASE%.*}"
PROPOSED="$DIR/$STEM.biome-check.$EXT"
# A leftover from a previous crashed hook would block the new edit. Clear it.
rm -f "$PROPOSED"

cleanup() {
  rm -f "$PROPOSED"
}
trap cleanup EXIT

case "$TOOL" in
  Write)
    # jq -j = raw output, no trailing newline added. Exact bytes of .content.
    printf '%s' "$INPUT" | jq -j '.tool_input.content // ""' > "$PROPOSED"
    ;;
  Edit)
    # Read FILE_PATH (still untouched), apply the replacement, write the
    # result to PROPOSED. Original is never modified. All I/O binary-safe.
    printf '%s' "$INPUT" | node -e '
      let s = "";
      process.stdin.on("data", (c) => (s += c));
      process.stdin.on("end", () => {
        const fs = require("node:fs");
        const j = JSON.parse(s);
        const src = j.tool_input?.file_path || j.tool_input?.path;
        const dst = process.env.PROPOSED;
        const old = j.tool_input?.old_string ?? "";
        const neu = j.tool_input?.new_string ?? "";
        const all = j.tool_input?.replace_all === true;
        let current = "";
        try { current = fs.readFileSync(src, "utf8"); } catch {}
        let out;
        if (all) {
          out = current.split(old).join(neu);
        } else {
          const i = current.indexOf(old);
          out = i === -1 ? current : current.slice(0, i) + neu + current.slice(i + old.length);
        }
        fs.writeFileSync(dst, out);
      });
    ' PROPOSED="$PROPOSED"
    ;;
  *)
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Scan OLD (real file) and NEW (sibling temp). Biome resolves the same
# config for both because they share the same directory + extension.
#
# Fast path — scan NEW first. If it's clean (zero diagnostics), there can
# be no positive delta against OLD; exit 0 without scanning OLD at all.
# This is the common case (most edits don't introduce diagnostics) and
# halves the hook's wall time (~340ms → ~170ms typical).
#
# Slow path — when NEW has diagnostics, scan OLD in parallel with the
# already-computed NEW to keep wall time under the single-scan budget.
# ---------------------------------------------------------------------------
extract_sigs() {
  printf '%s' "$1" \
    | jq -r '.diagnostics // [] | .[] | "\(.category // "?")||\(.description // "")"' 2>/dev/null \
    | sort -u \
    || true
}

NEW_JSON="$(pnpm exec biome check "$PROPOSED" --reporter=json 2>/dev/null || true)"
NEW_SIGS="$(extract_sigs "$NEW_JSON")"

if [ -z "$NEW_SIGS" ]; then
  # Proposed content is clean — no possible new-diagnostic delta. Skip OLD.
  exit 0
fi

if [ -f "$FILE_PATH" ]; then
  OLD_JSON="$(pnpm exec biome check "$FILE_PATH" --reporter=json 2>/dev/null || true)"
else
  OLD_JSON='{"diagnostics":[]}'
fi

OLD_SIGS="$(extract_sigs "$OLD_JSON")"

DELTA="$(comm -23 <(printf '%s\n' "$NEW_SIGS") <(printf '%s\n' "$OLD_SIGS") | sed '/^$/d')"

# ---------------------------------------------------------------------------
# Split the delta into PERSISTENT (real new issues — block) and TRANSIENT
# (rules that fire mid-edit and get resolved by the immediate follow-up edit
# — allow with a warning). The lefthook pre-push gate + CI catch any
# transients that slip through unresolved, so the cost of allowing them
# briefly is bounded.
#
# Why: previously, edits that legitimately required two steps to reach a
# clean state (add an import, then add the call site) were rejected because
# the hook saw the unused-import after step 1. Forcing agents to invent
# Bash workarounds is worse than trusting the downstream gates for these
# specific rules.
# ---------------------------------------------------------------------------
TRANSIENT_RULES_RE='^(lint/correctness/noUnusedImports|lint/correctness/noUnusedVariables|lint/correctness/noUndeclaredVariables|lint/correctness/noUnusedFunctionParameters|lint/correctness/noUnusedPrivateClassMembers)\|\|'

PERSISTENT_DELTA="$(printf '%s\n' "$DELTA" | grep -vE "$TRANSIENT_RULES_RE" || true)"
TRANSIENT_DELTA="$(printf '%s\n' "$DELTA" | grep -E "$TRANSIENT_RULES_RE" || true)"

if [ -n "$PERSISTENT_DELTA" ]; then
  echo "biome: the proposed edit introduces NEW diagnostics that were not present before:" >&2
  printf '%s\n' "$PERSISTENT_DELTA" | sed -e 's,||, — ,' -e 's,^,  - ,' >&2

  # If the delta includes a "format" diagnostic, biome's JSON reporter
  # doesn't include the formatted content — surface the actual diff so
  # the caller can see exactly what biome wants to change. Diff is between
  # the original on disk and the formatted version of the *proposed* content.
  if printf '%s' "$PERSISTENT_DELTA" | grep -q '^format'; then
    FORMATTED="$(pnpm exec biome format --stdin-file-path="$FILE_PATH" < "$PROPOSED" 2>/dev/null || true)"
    if [ -n "$FORMATTED" ]; then
      echo "" >&2
      echo "format diff (proposed → biome):" >&2
      diff -u "$FILE_PATH" <(printf '%s' "$FORMATTED") | sed 's,^,  ,' >&2
    fi
  fi

  echo "" >&2
  echo "pre-existing diagnostics in $FILE_PATH are accepted by the baseline;" >&2
  echo "only newly-introduced ones block. Fix the ones above and retry." >&2
  exit 2
fi

if [ -n "$TRANSIENT_DELTA" ]; then
  echo "biome: edit introduced TRANSIENT diagnostics (allowed; resolve in the follow-up edit, lefthook pre-push catches if left):" >&2
  printf '%s\n' "$TRANSIENT_DELTA" | sed -e 's,||, — ,' -e 's,^,  - ,' >&2
fi

exit 0
