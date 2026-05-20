#!/usr/bin/env bash
# PreToolUse Bash hook — general "how Claude uses the Bash tool" rules.
# These are *not* about a specific tool you invoke (git, biome) — they are
# about command shape itself: how Claude should write and structure Bash
# tool calls in this repo.
#
# Rules enforced (all parse the same COMMAND once, top of file):
#   1. No command chaining (&& or ||).         CLAUDE.md "One command at a time".
#   2. No inline `CI=true` / `NX_NO_CLOUD=true` prefix. The shell exports them
#      via `.envrc` + direnv; prepending them per-call papers over a broken
#      env-loading setup.
#   3. No `> /tmp/<file>` redirects. Capture to `.ai-wip/<name>.log` instead so
#      logs survive across sessions in one known location (CLAUDE.md
#      "Capture output for review").
#   4. No absolute paths into the repo root. CLAUDE.md "Work from the repo root".
#      Absolute paths bust permission-rule matching, forcing re-approval every
#      call. cwd is always the repo root — use relative paths.
#   5. Nudge: bare `grep` / `egrep` / `fgrep`. Prefer the Grep tool or `rg`
#      (ADR 0020). Advisory — exits 0 with a stderr nudge.
#   6. Nudge: lazy `echo >`, `cat <<`, `sed -i`, `awk … >` — these should be
#      Write/Edit tool calls, not shelled-out file mutations. Advisory.
#
# Blocking checks run first and short-circuit with exit 2. Nudges run last
# and never block.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ---- 1. command chaining ----------------------------------------------------
# Strip heredoc bodies and quoted strings before scanning, so legitimate uses
# of && / || inside commit messages or echoed text don't false-positive.
CHAIN_VIOLATION="$(CMD="$COMMAND" python3 - <<'PY'
import os, re

cmd = os.environ.get("CMD", "")

cmd = re.sub(
    r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?^\s*\1\s*$",
    "",
    cmd,
    flags=re.DOTALL | re.MULTILINE,
)
cmd = re.sub(r"'(?:[^'\\]|\\.)*'", "", cmd)
cmd = re.sub(r'"(?:[^"\\]|\\.)*"', "", cmd)

if re.search(r"&&|\|\|", cmd):
    print("violation")
PY
)"

if [ "$CHAIN_VIOLATION" = "violation" ]; then
  cat >&2 <<'EOF'
Bash command chaining (&& or ||) is blocked by project hook.

CLAUDE.md "One command at a time" — each command must be its own Bash
call so the user can review/approve it individually. Split this into
separate Bash tool calls.

Sanctioned compound forms (not blocked):
  - HEREDOC inside $(cat <<'EOF' ... EOF) for commit messages
  - cmd > .ai-wip/<name>.log 2>&1   (redirect, not a chain)

If you need to act on the result of one command, capture output:
  cmd > .ai-wip/<name>.log 2>&1
then read the log in a separate Bash call.
EOF
  exit 2
fi

# ---- 2. inline CI=true / NX_NO_CLOUD=true prefix ---------------------------
# Match a leading run of env assignments containing one of the blocked vars.
# Anchored at start so doc strings / heredocs don't false-positive.
if printf '%s' "$COMMAND" | rg -q '^\s*([A-Z_][A-Z0-9_]*=\S+\s+)*\b(CI=true|NX_NO_CLOUD=true)\b'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: inline `CI=true` / `NX_NO_CLOUD=true` prefix detected.

These belong in the shell environment, not prepended to each command.
If the repo ships `.envrc`, direnv loads them automatically once it's
hooked into your shell.

If the env isn't loading in this session, fix the setup once instead of
prefixing every call:

  brew install direnv
  echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc        # then restart shell
  cp .envrc.example .envrc                            # if missing
  direnv allow

For one-off scripts that genuinely need to set them (CI runner config,
new hook), set them inside the script body or via lefthook.yml `env:`,
not as a shell prefix on a Bash tool call.
EOF
  exit 2
fi

# ---- 3. /tmp/ redirect ------------------------------------------------------
if printf '%s' "$COMMAND" | rg -q '>\s*/tmp/'; then
  echo 'Use .ai-wip/<name>.log instead of /tmp/ for log captures (per CLAUDE.md).' >&2
  exit 2
fi

# ---- 4. absolute repo path --------------------------------------------------
# Strip heredocs and quoted strings before checking, so paths inside commit
# messages / HEREDOC bodies don't false-positive.
ABS_VIOLATION="$(CMD="$COMMAND" REPO_ROOT="$PWD" python3 - <<'PY'
import os, re

cmd = os.environ.get("CMD", "")
repo = os.environ.get("REPO_ROOT", "")

if not repo:
    exit()

# Strip heredoc bodies
cmd = re.sub(
    r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?^\s*\1\s*$",
    "",
    cmd,
    flags=re.DOTALL | re.MULTILINE,
)
# Strip single- and double-quoted strings
cmd = re.sub(r"'(?:[^'\\]|\\.)*'", "", cmd)
cmd = re.sub(r'"(?:[^"\\]|\\.)*"', "", cmd)

if re.search(re.escape(repo), cmd):
    print("violation")
PY
)"

if [ "$ABS_VIOLATION" = "violation" ]; then
  cat >&2 <<EOF
Absolute repo path detected in Bash command.

CLAUDE.md "Work from the repo root" — cwd is already $PWD,
so use a relative path from there instead:

  WRONG:  ls $PWD/apps
  RIGHT:  ls apps

Absolute paths bust permission-rule matching in .claude/settings.json,
forcing a re-approval prompt on every call. Use relative paths.
EOF
  exit 2
fi

# ---- 5. bare grep nudge (advisory) -----------------------------------------
# Strip `git grep` so it's not counted as bare grep — git grep operates on
# git's index/history and isn't replaceable by rg.
NORMALIZED="$(printf '%s' "$COMMAND" | sed 's/git grep/git_grep_/g')"
if printf '%s' "$NORMALIZED" | rg -q '(^|[[:space:];|&(])(grep|egrep|fgrep)([[:space:];|&)]|$)'; then
  cat >&2 <<'EOF'
nudge: bare `grep` detected. Prefer:
  - the built-in Grep tool (ripgrep-backed, structured output) for ad-hoc searches.
  - `rg` over `grep` in shell pipelines — same regex, faster, .gitignore-aware.

See docs/adr/0020-ripgrep-over-grep.md.

Quick mapping:
  grep -E pat       →  rg pat
  grep -F literal   →  rg -F literal
  grep -q pat       →  rg -q pat
  grep -r pat dir   →  rg pat dir
  printf … | grep -Eq …  →  printf … | rg -q …

`git grep` is unaffected — use it when you need git's index or history.
EOF
fi

# ---- 6. echo / cat / sed / awk file-mutation nudges (advisory) -------------
WARN=""
case "$COMMAND" in
  *"echo"*">"*)           WARN="Writing a file with 'echo >' — use the Write tool for clarity and permission-prompt consistency." ;;
  *"cat <<"*|*"cat <<<"*) WARN="Heredoc into a file via 'cat <<' — use the Write tool instead." ;;
  *"sed -i"*)             WARN="In-place sed — use the Edit tool for reviewable, single-occurrence edits." ;;
  *"awk "*">"*)           WARN="Writing a file via awk — use the Write tool." ;;
esac

if [ -n "$WARN" ]; then
  echo "nudge: $WARN" >&2
fi

exit 0
