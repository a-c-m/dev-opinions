# /start

Prime a fresh Claude Code session with the state of this repo.

Run these, then summarise to the user in four bullets (branch, uncommitted files, open PRs, recent commits):

```bash
git status --short
git log --oneline -n 10
git branch --show-current
gh pr list --limit 5 2>/dev/null || true
```

Then:

1. Read root `AGENTS.md` and any `AGENTS.md` in the current working subdirectory (`CLAUDE.md` is a symlink — either path works).
2. Read `docs/adr/README.md` to recall the active decisions.
3. Ask the user what they want to work on unless they have already said.

Keep the session summary under 10 lines.
