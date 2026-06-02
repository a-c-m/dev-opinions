#!/usr/bin/env bash
# PreToolUse Bash hook — general "how Claude uses the Bash tool" rules.
# These are *not* about a specific tool you invoke (git, biome) — they are
# about command shape itself: how Claude should write and structure Bash
# tool calls in this repo.
#
# Rules enforced (all parse the same COMMAND once, top of file):
#   1. No command chaining (&&, ||, or ;).     CLAUDE.md "One command at a time".
#   2. No inline `CI=true` / `NX_NO_CLOUD=true` prefix. The shell exports them
#      via `.envrc` + direnv; prepending them per-call papers over a broken
#      env-loading setup.
#   3. No `> /tmp/<file>`, `> $TMPDIR/…`, `> /private/tmp/…`, or `> /var/folders/…`
#      redirects. Capture to `.ai-wip/<name>.log` (local repo root) instead so logs
#      survive across sessions in one known location (CLAUDE.md "Capture output for
#      review"). `$TMPDIR` is called out by name because the harness's own Bash-tool
#      guidance tells agents to use it — this rule overrides that for this repo; on
#      macOS `$TMPDIR` resolves under `/var/folders/…` (and `/private/tmp`), so both
#      the literal `$TMPDIR` token and the resolved paths are blocked. No `> ../…`
#      parent-escape redirects.
#   4. No absolute paths into the repo root. CLAUDE.md "Work from the repo root".
#      Absolute paths bust permission-rule matching, forcing re-approval every
#      call. cwd is always the repo root — use relative paths.
#   5. Block: bare `grep` / `egrep` / `fgrep` (CLAUDE.md "Search with ripgrep"). Carve-outs for
#      `git grep`, `man grep`, `which grep`, `type grep`, `command -v grep`,
#      `apropos grep`, `whatis grep`, `info grep` — these are *about* grep,
#      not invocations of it.
#   6. Block: `coverage-baseline … --allow-decrease` (or `pnpm cov:promote …
#      --allow-decrease`). Lowering the committed coverage floor is a human
#      call; AI may ratchet up but not accept regressions.
#   7. Nudge: lazy `echo >`, `cat <<`, `sed -i`, `awk … >` — these should be
#      Write/Edit tool calls, not shelled-out file mutations. Advisory.
#   8. Nudge: piping into a pager (`| head`, `| tail`, `| less`, `| more`) —
#      Capture to `.ai-wip/<name>.log` instead so it survives for re-reading.
#      (CLAUDE.md "Capture output for review"). Advisory. Real filters (`| rg -q`,
#      `| jq …`) are deliberately NOT flagged.
#
# Blocking checks run first and short-circuit with exit 2. Nudges run last
# and never block.

set -euo pipefail

# Hooks get a minimal PATH without Homebrew's bin; add it so rg-based checks fire.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Fail closed, not open (CLAUDE.md "Fail, don't skip"): if a tool these checks
# depend on is missing from the hook PATH, BLOCK rather than silently passing
# commands through with the checks dead.
for _t in rg jq; do
  command -v "$_t" >/dev/null 2>&1 || {
    echo "🚫 block-bash-rules: required tool '$_t' not on hook PATH — safety checks can't run. Install it or fix the hook PATH." >&2
    exit 2
  }
done

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Heredoc/quote-scrubbed form, computed ONCE via the shared bash scrubber, for
# every check below that must not false-positive on tokens inside quotes/heredocs.
SCRUBBED="$(printf '%s' "$COMMAND" | bash "$(dirname "$0")/lib/scrub-command.sh")"

# ---- 1. command chaining ----------------------------------------------------
# Strip heredoc bodies and quoted strings before scanning, so legitimate uses
# of && / || / ; inside commit messages or echoed text don't false-positive.
# `;` is part of the same rule per CLAUDE.md "One command at a time".
CHAIN_VIOLATION=""
case "$SCRUBBED" in
  *'&&'* | *'||'* | *';'*) CHAIN_VIOLATION="violation" ;;
esac

# Carve-out: a single `cd repos/<clean> && <one command>` is the SANCTIONED way
# into a sub-repo and the ONLY form that works for agent threads — they reset
# cwd between Bash calls (so a `cd` in a prior call is lost; verified 2026-06),
# while `git -C` / `gh -R` are blocked by block-bash-git. A chained cd keeps the
# navigation + command in one reviewable call, so the "one command at a time"
# intent still holds: ONE real command, just prefixed by a cd. Exempt it IFF the
# cd targets a clean repos/ subpath (no `..`) and the REST adds no further
# chaining operator. Every OTHER rule below still scans the whole command, so a
# bad post-cd command is still caught. The harness auto-allows the post-cd
# command when it matches permissions.allow (verified 2026-06 — no longer prompts
# on `cd && cmd`, so no companion approve-hook is needed). See docs/conventions/sandbox.md.
subrepo_re='^[[:space:]]*cd[[:space:]]+((\./)?repos/[A-Za-z0-9._/-]+)[[:space:]]+&&[[:space:]]+(.+)$'
if [ "$CHAIN_VIOLATION" = "violation" ] && [[ "$SCRUBBED" =~ $subrepo_re ]]; then
  _sub_target="${BASH_REMATCH[1]}"
  _sub_rest="${BASH_REMATCH[3]}"
  case "$_sub_target" in
    *..*) ;;                                    # `..` escape → not exempt
    *)
      case "$_sub_rest" in
        *'&&'* | *'||'* | *';'*) ;;             # further chaining → not exempt
        *) CHAIN_VIOLATION="" ;;                # sanctioned single cd + command
      esac ;;
  esac
fi

if [ "$CHAIN_VIOLATION" = "violation" ]; then
  cat >&2 <<'EOF'
Bash command chaining (&&, ||, or ;) is blocked by project hook.

CLAUDE.md "One command at a time" — each command must be its own Bash
call so the user can review/approve it individually. Split this into
separate Bash tool calls.

Write a script to .ai-wip/ as a
.mjs/.sh and run it with one Bash call if needed.

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

# ---- 3. /tmp/, $TMPDIR, and ../ parent-escape redirects ---------------------
# Block a redirect whose TARGET is the system temp dir (literal /tmp/, the
# $TMPDIR token — harness Bash-tool guidance pushes agents toward it, overridden
# here — or its macOS resolutions /private/tmp/ and /var/folders/…) or a ../
# parent escape. The catch: a real redirect's target is often QUOTED
# (`> "$TMPDIR/x"`), so a plain quote-strip deletes the target and misses it —
# but keeping quotes everywhere would false-positive on a commit message that
# merely mentions `> /tmp` (common in THIS repo). The true discriminator is
# whether the `>` OPERATOR is unquoted, not whether the target is. So: strip
# heredoc bodies (keep quotes), then walk char-by-char tracking quote state,
# collect each target that follows an UNQUOTED `>` (dropping surrounding quote
# chars), and test only those. A `>` inside quotes (prose) yields no target.
REDIR_SCRUBBED="$(printf '%s' "$COMMAND" | bash "$(dirname "$0")/lib/scrub-command.sh" keep-quotes)"
redir_targets() {
  local s="$1"
  local n=${#s} i=0 c q="" pend=0 t=""
  while ((i < n)); do
    c="${s:i:1}"
    if [ -n "$q" ]; then                                  # inside a quoted span
      if [ "$c" = '\' ] && [ "$q" = '"' ] && ((i + 1 < n)); then
        ((pend)) && t+="${s:i+1:1}"; ((i += 2)); continue # \-escape in "…"
      fi
      if [ "$c" = "$q" ]; then q=""; elif ((pend)); then t+="$c"; fi
      ((i++)); continue
    fi
    case "$c" in
      \' | \") q="$c" ;;                                  # open a quoted span
      '>') pend=1 ;;                                      # (re)start a target
      [[:space:]]) if ((pend)) && [ -n "$t" ]; then printf '%s\n' "$t"; t=""; pend=0; fi ;;
      *) ((pend)) && t+="$c" ;;
    esac
    ((i++))
  done
  ((pend)) && [ -n "$t" ] && printf '%s\n' "$t"
}
if redir_targets "$REDIR_SCRUBBED" | rg -q '^(/tmp/|\$TMPDIR\b|\$\{TMPDIR\b|/private/tmp/|/var/folders/|\.\./)'; then
  echo 'Capture to .ai-wip/<name>.log at the repo root (per CLAUDE.md) — not /tmp/, not $TMPDIR (resolves under /var/folders on macOS), and not a ../ path that escapes the cwd / a repos/* symlink.' >&2
  exit 2
fi

# ---- 4. absolute repo path --------------------------------------------------
# Strip heredocs and quoted strings before checking, so paths inside commit
# messages / HEREDOC bodies don't false-positive.
# Repo-root absolute path inside the scrubbed command (substring; ignores quotes).
ABS_VIOLATION=""
case "$SCRUBBED" in
  *"$PWD"*) ABS_VIOLATION="violation" ;;
esac

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

# ---- 5. bare grep (blocking) -----------------------------------------------
# Neutralise non-invocation references (carve-outs) before scanning for
# bare grep. These are *about* grep, not invocations of it:
#   - `git grep`         — operates on git's index/history; rg can't replace it.
#   - `command -v grep`  — capability check.
#   - `man|which|type|apropos|whatis|info grep` — docs/lookup.
GREP_NORMALIZED="$(printf '%s' "$COMMAND" \
  | sed -E 's/command[[:space:]]+-v[[:space:]]+(e|f)?grep/_grep_about_/g' \
  | sed -E 's/(git|man|which|type|apropos|whatis|info)[[:space:]]+(e|f)?grep/_grep_about_/g')"

if printf '%s' "$GREP_NORMALIZED" | rg -q '(^|[[:space:];|&(])(grep|egrep|fgrep)([[:space:];|&)]|$)'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: bare `grep` / `egrep` / `fgrep` in a Bash tool call.

Use ripgrep instead:
  - the built-in Grep tool (ripgrep-backed, structured output) for ad-hoc searches.
  - `rg` in shell pipelines — same regex, faster, .gitignore-aware.

Quick mapping:
  grep -E pat       →  rg pat
  grep -F literal   →  rg -F literal
  grep -q pat       →  rg -q pat
  grep -r pat dir   →  rg pat dir
  printf … | grep -Eq …  →  printf … | rg -q …

Carve-outs (not blocked): `git grep`, `man grep`, `which grep`,
`type grep`, `command -v grep`, `apropos grep`, `whatis grep`,
`info grep` — these are about grep, not invocations of it.

See CLAUDE.md → "Search with ripgrep, never grep".
EOF
  exit 2
fi

# ---- 6. coverage-baseline --allow-decrease is human-only --------------------
# Lowering the committed coverage floor is a deliberate human call. AI may
# ratchet up (pnpm cov:promote, when nothing regresses) but must not pass
# --allow-decrease, which writes a baseline accepting a regression.
#
# Strip heredoc bodies and quoted strings first so the flag appearing in
# documentation/commit-message text doesn't false-positive.
if printf '%s' "$SCRUBBED" | rg -q '(^|[[:space:];|&(])(coverage-baseline|cov:promote)\b.*--allow-decrease'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: `coverage-baseline … --allow-decrease` is human-only.

The flag overrides the safe `promote` mode and writes a baseline that lowers a file's
coverage. Intentional regressions are a human decision — they shouldn't slip in via an
agent. Run `pnpm cov:promote` (without the flag) to ratchet up safely, or ask the
human to run `pnpm cov:promote -- --allow-decrease` themselves.
EOF
  exit 2
fi

# ---- 7. nx affected --target=typecheck|lint -------------------------------
# tsgo (and biome under NX) have been observed deadlocking when invoked via
# `nx affected` against local long-running NX daemon states. Force run-many
# for these two targets. `nx affected --target=test` is fine.
# Matches both long and short flag forms and comma-separated target lists.
# Strip heredoc bodies and quoted strings before matching so the pattern
# inside a commit message / doc string doesn't false-positive.
# See docs/conventions/nx-targets.md for the full story.
if printf '%s' "$SCRUBBED" | rg -q 'nx\s+affected\s+(--target=|-t\s+)[^[:space:]]*\b(typecheck|lint)\b'; then
  cat >&2 <<'EOF'
🚫 BLOCKED: `nx affected --target=typecheck` / `nx affected --target=lint`.

Use `nx run-many --target=<target> --all` for typecheck and lint. NX cache
makes warm runs cheap; the affected-shape deadlocks under tsgo/biome when
other NX daemons are alive on this machine. `nx affected --target=test`
is still fine.

See docs/conventions/nx-targets.md.
EOF
  exit 2
fi

# ---- 8. echo / cat / sed / awk file-mutation nudges (advisory) -------------
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

# ---- 9. pipe-into-pager nudge (advisory) -----------------------------------
# Piping a command's output into head/tail/less/more discards the raw output
# the moment the pager exits. CLAUDE.md "Capture output for review" prefers
# `cmd > .ai-wip/<name>.log 2>&1`, so the full output survives in one known
# place for re-reading. Advisory only — `| rg -q …` / `| jq …` (genuine
# filters, the latter even shown as the RIGHT form under the grep rule above)
# are deliberately NOT flagged. Scans SCRUBBED (like the other checks) so a
# `| head` inside a quoted commit message doesn't false-nudge; the `(^|[^|])`
# guard then just avoids matching the right half of a literal `||`.
if printf '%s' "$SCRUBBED" | rg -q '(^|[^|])\|[[:space:]]*(head|tail|less|more)([[:space:]]|$)'; then
  echo 'nudge: piping into head/tail/less/more discards raw output — prefer `cmd > .ai-wip/<name>.log 2>&1`, then head/rg the file (CLAUDE.md "Capture output for review").' >&2
fi

exit 0
