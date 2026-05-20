#!/usr/bin/env bash
# PreToolUse Bash hook.
# Blocks patterns that are always wrong in this repo:
#   1. `--no-verify` on any git command — hooks exist so new errors do not
#      land; bypassing them defeats the whole pre-commit ratchet.
#   2. Direct `gh issue create` — use ./.claude/commands/create-issue.sh so the
#      issue template, labels, and body shape stay consistent.
#   3. Direct `gh pr create` — use ./.claude/commands/create-pr.sh so the
#      title suffix (#N) and `Closes #N` footer are guaranteed.
#   4. `git -C <path>` — same spirit as CLAUDE.md "Work from the repo root":
#      cd to the dir in a separate Bash call, then run plain git.
#   5. `git commit` without a trailing ticket reference in the subject line.
#      Accepts GitHub-style (`#123`) or Jira/Linear-style (`PROJ-123`).
#      CLAUDE.md "Every commit names its ticket" — for AI commits, no
#      escape hatch: if there's truly no ticket, ask the human to run the
#      commit themselves (like --no-verify).

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

# Strip heredoc bodies and quoted strings before pattern-matching so
# commit messages mentioning blocked tokens (--no-verify, gh pr create,
# git -C) don't false-positive. The trailing-ticket subject check below
# uses COMMAND directly because it deliberately parses inside -m "…".
SCRUBBED="$(CMD="$COMMAND" python3 - <<'PY'
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
print(cmd)
PY
)"

case "$SCRUBBED" in
  *"--no-verify"*)
    cat >&2 <<'EOF'
🚫 BLOCKED: --no-verify detected.

Hooks exist to stop new lint/type/test errors landing. Do not bypass them.
Let the command fail, read the output, fix the cause, and try again.

If the user genuinely needs to bypass, they can run the command themselves.
EOF
    exit 2
    ;;
esac

case "$SCRUBBED" in
  *"gh issue create"*)
    cat >&2 <<'EOF'
🚫 BLOCKED: direct `gh issue create` detected.

Use the project wrapper instead so template, labels, and body structure stay
consistent across issues:

  ./.claude/commands/create-issue.sh "<title>"
EOF
    exit 2
    ;;
esac

case "$SCRUBBED" in
  *"gh pr create"*)
    cat >&2 <<'EOF'
🚫 BLOCKED: direct `gh pr create` detected.

Use the project wrapper instead so the title gets the `#N` ticket suffix
and the body gets `Closes #N`:

  ./.claude/commands/create-pr.sh "<title>" "<summary>" <issue-number>

If the PR genuinely has no ticket, ask the human to open it themselves.
EOF
    exit 2
    ;;
esac

# Match `git -C <path>` only at the start of a command (after optional
# whitespace). Substring matching would false-positive on commit messages
# or docs that mention "git -C". Command chaining is blocked elsewhere,
# so any real invocation has to appear at the start.
if printf '%s' "$SCRUBBED" | rg -q '^\s*git -C '; then
  cat >&2 <<'EOF'
🚫 BLOCKED: `git -C <path>` detected.

CLAUDE.md "Work from the repo root" — cd to the directory in a separate
Bash call, then run plain git. Don't pass paths into git via -C; it hides
the implied working directory and bypasses the cwd-discipline rule.

Two-call replacement:
  cd <path>          (one Bash call)
  git <subcommand>   (subsequent calls reuse the cwd)
EOF
  exit 2
fi

# ---------------------------------------------------------------------------
# 5. git commit subject must end with a GitHub issue reference (#NNN).
#
# Only checks commits whose message is supplied on the command line via
# `-m "..."` or `-F <file>`. If the message comes from $EDITOR (`git commit`
# with no -m / -F), we can't inspect it pre-execution; the PostToolUse hook
# (commit-format.sh) catches it after the fact.
#
# Extracts the *first line* of the message (subject) using python — single
# parser handles -m repetition (`-m "subject" -m "body"`), -F <file>, and
# the heredoc pattern this repo prefers (`-m "$(cat <<'EOF' ... EOF)"`).
# ---------------------------------------------------------------------------
case "$COMMAND" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

SUBJECT="$(CMD="$COMMAND" python3 - <<'PY'
import os, re, shlex, sys

cmd = os.environ.get("CMD", "")

# Trim everything up to and including the literal `git commit` token so we
# only parse the commit's own args, not pre-pended shell scaffolding.
m = re.search(r"\bgit\s+commit\b", cmd)
if not m:
    sys.exit(0)
tail = cmd[m.end():]

try:
    tokens = shlex.split(tail, posix=True)
except ValueError:
    # Unbalanced quotes — let the command run, PostToolUse will catch.
    sys.exit(0)

messages = []
file_path = None
i = 0
while i < len(tokens):
    t = tokens[i]
    if t in ("-m", "--message"):
        if i + 1 < len(tokens):
            messages.append(tokens[i + 1])
            i += 2
            continue
    elif t.startswith("--message="):
        messages.append(t[len("--message="):])
        i += 1
        continue
    elif t.startswith("-m") and len(t) > 2:
        messages.append(t[2:])
        i += 1
        continue
    elif t in ("-F", "--file"):
        if i + 1 < len(tokens):
            file_path = tokens[i + 1]
            i += 2
            continue
    elif t.startswith("--file="):
        file_path = t[len("--file="):]
        i += 1
        continue
    i += 1

# Per `git commit -m` semantics, the first -m becomes the subject and the
# rest become body paragraphs. So we only care about messages[0].
subject = None
if messages:
    subject = messages[0].splitlines()[0] if messages[0] else ""
elif file_path:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            first = f.readline()
        subject = first.rstrip("\n")
    except OSError:
        sys.exit(0)
else:
    # No -m / -F — message will come from $EDITOR, can't pre-validate.
    sys.exit(0)

print(subject)
PY
)"

# Empty subject (or unparseable) — let it through; downstream will fail loudly.
[ -n "$SUBJECT" ] || exit 0

# If the "subject" looks like shell metacharacters (heredoc opener, command
# substitution, backticks) rather than a real commit subject, shlex saw
# inside a construct it couldn't parse. Fall through to commit-format.sh
# (PostToolUse), which inspects HEAD after the commit lands.
case "$SUBJECT" in
  '$('*|'`'*|*'<<'*) exit 0 ;;
esac

# Subject must end with a ticket reference:
#   GitHub-style:      `#123`
#   Jira/Linear-style: `PROJ-123` (one or more uppercase letters/digits,
#                                  starting with a letter, then `-NNN`)
# Multiple refs allowed: `... #12 ACME-3`. Optional close-paren/whitespace
# after the ref. Reject bare digits — require a `#` prefix or a `PROJ-` prefix
# so version numbers like `v2.0` don't satisfy the rule.
TICKET_RE='(#[0-9]+|[A-Z][A-Z0-9]+-[0-9]+)'
if ! printf '%s' "$SUBJECT" | rg -q "(^|\s)${TICKET_RE}(\s+${TICKET_RE})*[)\s]*$"; then
  cat >&2 <<EOF
🚫 BLOCKED: git commit subject is missing a trailing ticket reference.

Subject: "$SUBJECT"
Expected suffix: \`#NNN\` (GitHub) or \`PROJ-NNN\` (Jira/Linear).
  feat(api): add search endpoint #123
  feat(api): add search endpoint ACME-456
Multiple refs allowed: \`... #12 ACME-3\`.

CLAUDE.md "Every commit names its ticket" — every AI-authored commit must
reference the ticket it relates to. Trailing reference keeps the link
visible in \`git log\` and lets GitHub/Jira render it automatically.

If the commit genuinely has no ticket (scaffolding, dependency bump,
hotfix-without-issue), ask the human to run the commit themselves — there
is no AI-side escape hatch. This mirrors the --no-verify rule above.

If you need to create a GitHub issue first:
  ./.claude/commands/create-issue.sh "<title>"

\`bd\` (beads) IDs are local-only and must not appear in commits — see
CLAUDE.md "Task tracking — local vs team".
EOF
  exit 2
fi

exit 0
