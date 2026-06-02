#!/usr/bin/env bash
# Scrub a shell command for safe pattern-matching: remove heredoc BODIES and
# quoted-string CONTENTS so tokens inside commit messages / quoted text don't
# false-positive when the block-bash-* hooks scan for violations (e.g. a commit
# message that mentions `--no-verify` must not trip the --no-verify block).
#
# Reads the command on stdin, writes the scrubbed form to stdout.
#
# Pure bash on purpose: bash is the only interpreter guaranteed on the (minimal)
# hook PATH — `node` is version-manager-installed (path varies per machine) and
# system `python3` is being retired from these hooks. Shared by block-bash-*.sh
# so the scrub logic lives in ONE place instead of being copy-pasted.
#
# Parity target (the inline Python it replaces):
#   strip `<<[-]['"]?WORD['"]? … \n BODY \n ^\s*WORD\s*$`   (heredoc opener+body+close)
#   strip `'(?:[^'\\]|\\.)*'`  and  `"(?:[^"\\]|\\.)*"`     (quoted spans)
# Byte-for-byte identity isn't required — what matters is that a blocked token
# inside a quote/heredoc is GONE and a blocked token outside one SURVIVES.
#
# Mode (optional $1):
#   default       strip heredoc bodies AND quoted-string contents.
#   keep-quotes   strip heredoc bodies ONLY; leave quoted spans intact. Used by
#                 the redirect-target checks, where the *target* of a real `>`
#                 is often quoted (`> "$TMPDIR/x"`) — stripping the quotes would
#                 delete the target and let the redirect slip past the guard.
#                 Heredoc openers are still detected via a quote-stripped view of
#                 the line, so a `<<` inside quotes is never mistaken for one.
set -u

keep_quotes=0
[ "${1:-}" = "keep-quotes" ] && keep_quotes=1

input="$(cat)"

# Remove '...' and "..." spans from a single line. Single quotes take no escapes;
# double quotes honour a backslash escape (matching the Python char classes).
strip_quotes_line() {
  local s="$1" out="" i=0 c q=""
  local n=${#s}
  while ((i < n)); do
    c="${s:i:1}"
    if [ -z "$q" ]; then
      case "$c" in
        \' | \") q="$c" ;;
        *) out+="$c" ;;
      esac
    else
      if [ "$c" = '\' ] && [ "$q" = '"' ] && ((i + 1 < n)); then
        ((i++)) # skip the escaped char inside double quotes
      elif [ "$c" = "$q" ]; then
        q=""
      fi
    fi
    ((i++))
  done
  printf '%s' "$out"
}

opener_re='<<-?[[:space:]]*['\''"]?([A-Za-z_][A-Za-z0-9_]*)'

out=""
in_heredoc=0
delim=""
while IFS= read -r line || [ -n "$line" ]; do
  if ((in_heredoc)); then
    t="${line#"${line%%[![:space:]]*}"}" # ltrim
    t="${t%"${t##*[![:space:]]}"}"       # rtrim
    [ "$t" = "$delim" ] && {
      in_heredoc=0
      delim=""
    }
    continue # drop heredoc body + closing-delimiter line
  fi
  stripped="$(strip_quotes_line "$line")"
  # `emit` is what we APPEND for this line: the quote-stripped form by default,
  # or the original (quotes intact) in keep-quotes mode. Heredoc detection always
  # works off `stripped` so a quoted `<<`/delimiter can't fool it either way.
  emit="$stripped"
  ((keep_quotes)) && emit="$line"
  # Treat as a heredoc opener ONLY if `<<` survives quote-stripping — i.e. it's
  # real shell redirection, not a `<<` sitting inside a quoted string. Without
  # this guard a quoted `<<` is mis-read as an opener and every following line
  # is silently swallowed up to a delimiter that never comes (an under-block).
  # The delimiter is still parsed from the ORIGINAL line, so a quoted delimiter
  # (`<<'EOF'`) reads correctly — the `<<` operator itself is never in quotes.
  if [[ "$stripped" == *'<<'* ]] && [[ "$line" =~ $opener_re ]]; then
    delim="${BASH_REMATCH[1]}"
    in_heredoc=1
    out+="${emit%%<<*}"$'\n' # keep text before << (quotes per mode)
    continue
  fi
  out+="$emit"$'\n'
done <<<"$input"

printf '%s' "$out"
