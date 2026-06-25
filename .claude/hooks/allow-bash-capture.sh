#!/usr/bin/env bash
# PreToolUse Bash hook — auto-approve `<X> > .ai-wip/<name>` when <X> is ALREADY
# allowlisted in settings.json. The permission engine gates a redirect (a
# file-write) separately from the command, so no `Bash(...)` rule can grant it —
# which made CLAUDE.md's "capture output to .ai-wip/" convention prompt every time.
#
# Adds no new run-trust: only "redirect an already-allowed command's stdout to a
# scratch file". The command still runs sandboxed (sandbox.enabled stays true),
# deny rules / block-bash-*.sh still win (deny-first precedence), and the flat
# .ai-wip/<name> target (no `/`) can't escape the scratch dir.
#
# Fails CLOSED: any missing tool, error, or unmet check yields exit 0 with NO
# decision (defer to the normal prompt) — never a spurious `allow`.

set -euo pipefail
trap 'exit 0' ERR # any unexpected failure → defer, never allow
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

pass() { exit 0; } # defer to the normal permission flow
command -v jq >/dev/null 2>&1 || pass

DIR="$(dirname "$0")"
COMMAND="$(jq -r '.tool_input.command // empty' 2>/dev/null)" # reads stdin
[ -z "$COMMAND" ] && pass

# Optional sanctioned sub-repo prefix: peel a single `cd repos/<clean> && ` so the
# capture convention works INSIDE repos/* too. The chained `cd && cmd` is the only
# sub-repo path in agent threads (they reset cwd between calls), and the harness
# auto-allows the command but still prompts on the .ai-wip redirect there — this
# closes that gap. Mirror block-bash-rules' carve-out exactly: one cd into a clean
# repos/ subpath (no `..`), REST adds no further chaining. After peeling, the rest
# of this hook validates the post-cd command + redirect as usual.
sub_re='^[[:space:]]*cd[[:space:]]+((\./)?repos/[A-Za-z0-9._/-]+)[[:space:]]+&&[[:space:]]+(.+)$'
if [[ "$COMMAND" =~ $sub_re ]]; then
  case "${BASH_REMATCH[1]}" in *..*) pass ;; esac              # `..` escape → defer
  case "${BASH_REMATCH[3]}" in *'&&'* | *'||'* | *';'*) pass ;; esac # extra chain → defer
  COMMAND="${BASH_REMATCH[3]}"                                 # validate the post-cd command
fi

# Require a single trailing redirect to a FLAT .ai-wip/ name (no `/` ⇒ no traversal).
redir='>>?[[:space:]]*\.ai-wip/[A-Za-z0-9._-]+([[:space:]]+2>&1)?[[:space:]]*$'
[[ "$COMMAND" =~ $redir ]] || pass

# Reject substitution (runs even inside quotes — scan RAW) and pipes/chaining
# (literal inside quotes — scan the quote-scrubbed form).
case "$COMMAND" in *'$('* | *'`'* | *'<('* | *'>('*) pass ;; esac
case "$(printf '%s' "$COMMAND" | bash "$DIR/lib/scrub-command.sh")" in
  *'&&'* | *'||'* | *';'* | *'|'*) pass ;;
esac

# Isolate the base command; it must carry no other redirect.
BASE="${COMMAND%"${BASH_REMATCH[0]}"}"
BASE="${BASE#"${BASE%%[![:space:]]*}"}"
BASE="${BASE%"${BASE##*[![:space:]]}"}"
[ -z "$BASE" ] && pass
case "$BASE" in *'>'* | *'<'*) pass ;; esac

# Inside of every Bash(...) rule of kind $1, from project + local settings.
rules() {
  local f
  for f in "$DIR/../settings.json" "$DIR/../settings.local.json"; do
    [ -f "$f" ] && jq -r --arg k "$1" \
      '(.permissions[$k]//[])[]|select(type=="string" and startswith("Bash("))|sub("^Bash\\(";"")|sub("\\)$";"")' \
      "$f" 2>/dev/null
  done
}

# Conservative match (bias to non-match ⇒ an extra prompt, never a wrong allow).
matches() {
  case "$2" in
    *':*') [ "$1" = "${2%:\*}" ] && return 0; case "$1" in "${2%:\*} "*) return 0 ;; esac; return 1 ;;
    *'*'*) case "$1" in $2) return 0 ;; esac; return 1 ;;
    *) [ "$1" = "$2" ] ;;
  esac
}

# Deny wins: a base matching any deny rule defers (the deny path then handles it).
while IFS= read -r r; do [ -n "$r" ] && matches "$BASE" "$r" && pass; done < <(rules deny)
# Allow only an already-allowlisted base.
while IFS= read -r r; do
  [ -n "$r" ] && matches "$BASE" "$r" && {
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"already-allowlisted command captured to .ai-wip/"}}'
    exit 0
  }
done < <(rules allow)
pass
