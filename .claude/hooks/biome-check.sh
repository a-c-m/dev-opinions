#!/usr/bin/env bash
# PreToolUse hook for Edit/Write.
#
# Diagnostic-delta check — preserves ADR 0003's baseline-ratchet story:
# block only when the proposed edit introduces NEW biome diagnostics that
# were not already present in the on-disk file.
#
# Pre-existing diagnostics are allowed through. Edits that *fix* diagnostics
# are allowed through. Edits that *add* diagnostics are blocked with a list
# of the new ones.
#
# Biome's stdin mode does not emit structured diagnostics, so the hook
# works by briefly swapping the file's contents, scanning twice, and
# restoring the original from a disk backup via an EXIT trap. All content
# I/O goes through files (never bash variables) so bytes, including
# trailing newlines, are preserved exactly.

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
# Backup the file (binary-safe) and arrange for restore on any exit.
# ---------------------------------------------------------------------------
BACKUP="$(mktemp -t biome-check-hook.XXXXXX)"
if [ -f "$FILE_PATH" ]; then
  cp "$FILE_PATH" "$BACKUP"
  HAS_FILE=1
else
  HAS_FILE=0
fi

restore() {
  if [ "$HAS_FILE" -eq 1 ] && [ -f "$BACKUP" ]; then
    cp "$BACKUP" "$FILE_PATH"
  elif [ "$HAS_FILE" -eq 0 ] && [ -f "$FILE_PATH" ]; then
    rm -f "$FILE_PATH"
  fi
  rm -f "$BACKUP"
}
trap restore EXIT

# ---------------------------------------------------------------------------
# Scan OLD state (file still original, before any edit is simulated).
# ---------------------------------------------------------------------------
if [ "$HAS_FILE" -eq 1 ]; then
  OLD_JSON="$(pnpm exec biome check "$FILE_PATH" --reporter=json 2>/dev/null || true)"
else
  OLD_JSON='{"diagnostics":[]}'
fi

# ---------------------------------------------------------------------------
# Write the proposed content to FILE_PATH directly — no bash variable
# round-trip (which would strip trailing newlines and corrupt binary content).
# ---------------------------------------------------------------------------
case "$TOOL" in
  Write)
    # jq -j = raw output, no trailing newline added. Exact bytes of .content.
    printf '%s' "$INPUT" | jq -j '.tool_input.content // ""' > "$FILE_PATH"
    ;;
  Edit)
    # node reads the (still-original) file, applies the replacement, writes
    # back. All I/O binary-safe.
    printf '%s' "$INPUT" | node -e '
      let s = "";
      process.stdin.on("data", (c) => (s += c));
      process.stdin.on("end", () => {
        const fs = require("node:fs");
        const j = JSON.parse(s);
        const p = j.tool_input?.file_path || j.tool_input?.path;
        const old = j.tool_input?.old_string ?? "";
        const neu = j.tool_input?.new_string ?? "";
        const all = j.tool_input?.replace_all === true;
        let current = "";
        try { current = fs.readFileSync(p, "utf8"); } catch {}
        let out;
        if (all) {
          out = current.split(old).join(neu);
        } else {
          const i = current.indexOf(old);
          out = i === -1 ? current : current.slice(0, i) + neu + current.slice(i + old.length);
        }
        fs.writeFileSync(p, out);
      });
    '
    ;;
  *)
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Scan NEW state.
# ---------------------------------------------------------------------------
NEW_JSON="$(pnpm exec biome check "$FILE_PATH" --reporter=json 2>/dev/null || true)"

# ---------------------------------------------------------------------------
# Compare diagnostic sets. Signature = category + "||" + description, which
# captures rule + message without depending on exact line numbers (edits
# shift lines and we don't want that to masquerade as a "new" diagnostic).
# ---------------------------------------------------------------------------
extract_sigs() {
  printf '%s' "$1" \
    | jq -r '.diagnostics // [] | .[] | "\(.category // "?")||\(.description // "")"' 2>/dev/null \
    | sort -u \
    || true
}

OLD_SIGS="$(extract_sigs "$OLD_JSON")"
NEW_SIGS="$(extract_sigs "$NEW_JSON")"

DELTA="$(comm -23 <(printf '%s\n' "$NEW_SIGS") <(printf '%s\n' "$OLD_SIGS") | sed '/^$/d')"

if [ -n "$DELTA" ]; then
  echo "biome: the proposed edit introduces NEW diagnostics that were not present before:" >&2
  printf '%s\n' "$DELTA" | sed -e 's,||, — ,' -e 's,^,  - ,' >&2
  echo "" >&2
  echo "pre-existing diagnostics in $FILE_PATH are accepted by the baseline;" >&2
  echo "only newly-introduced ones block. Fix the ones above and retry." >&2
  exit 2
fi

exit 0
