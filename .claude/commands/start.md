# /start

Prime a fresh Claude Code session with the state of this repo.

Run each Bash step below as its own call (no chaining), then summarise to the user in four bullets (branch, uncommitted files, open PRs, recent commits):

1. `git status --short`
2. `git branch --show-current`
3. `git log --oneline -n 10`
4. `gh pr list --limit 5 > .ai-wip/start-prs.log 2>&1` — capture so auth/network errors stay diagnosable instead of being swallowed.
5. `cat .ai-wip/start-prs.log` — if the log shows an error, note "PR list unavailable" in the summary; do not silently drop it.

Then:

6. Read root `AGENTS.md` and any `AGENTS.md` in the current working subdirectory (`CLAUDE.md` is a symlink — either path works).
7. Read `docs/adr/README.md` to recall the active decisions.
8. Ask the user what they want to work on unless they have already said.

Keep the session summary under 10 lines.
