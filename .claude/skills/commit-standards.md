---
name: commit-standards
description: Auto-triggers when the user asks to commit, when a git commit is about to run, or when reviewing a commit message. Enforces Conventional Commits format and the repo's scope conventions.
---

The commit format for this repo (ADR 0011):

```
type(scope): description #NNN          ← GitHub issue
type(scope): description PROJ-NNN      ← Jira/Linear
```

- **type**: `feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert`.
- **scope**: an NX project name (`api`, `web`, `logger`, `env-config`, …). Lowercase.
- **description**: imperative mood, lowercase start, no trailing period.
- **Trailing ticket**: `#NNN` (GitHub) or `PROJ-NNN` (Jira/Linear). **Required for every AI-authored commit.** Multiple refs allowed: `... #12 ACME-3`. The PreToolUse hook (`check-bash-git.sh`) blocks `git commit` without one — there is no AI-side escape hatch.
- Subject ≤ 72 chars (including the ticket).
- Optional: body after blank line.

`bd` (beads) IDs are local-only and must **not** appear in commit messages — see CLAUDE.md "Task tracking — local vs team". Only tracker-tier IDs (GitHub / Jira / Linear) go in commits.

If a commit genuinely has no ticket (scaffolding, dep bump, hotfix-without-issue), ask the human to run the commit themselves. This mirrors the `--no-verify` policy.

Before committing:

1. Run `pnpm check:affected` (or `pnpm check`).
2. Stage files explicitly — never `git add .` or `git add -A`.
3. Prefer `pnpm commit` (cz) for an interactive prompt. If writing by hand, validate the subject against the pattern above.

Never:
- Amend a pushed commit.
- Use `--no-verify` to skip hooks.
- Commit secrets or `.env`.
