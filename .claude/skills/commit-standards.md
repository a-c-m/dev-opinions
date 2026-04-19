---
name: commit-standards
description: Auto-triggers when the user asks to commit, when a git commit is about to run, or when reviewing a commit message. Enforces Conventional Commits format and the repo's scope conventions.
---

The commit format for this repo (ADR 0011):

```
type(scope): description
```

- **type**: `feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert`.
- **scope**: an NX project name (`api`, `web`, `logger`, `env-config`, …). Lowercase.
- **description**: imperative mood, lowercase start, no trailing period. ≤ 72 chars.
- Optional: body after blank line. Optional: `Closes #n` in footer.

Before committing:

1. Run `pnpm check:affected` (or `pnpm check`).
2. Stage files explicitly — never `git add .` or `git add -A`.
3. Prefer `pnpm commit` (cz) for an interactive prompt. If writing by hand, validate the subject against the pattern above.

Never:
- Amend a pushed commit.
- Use `--no-verify` to skip hooks.
- Commit secrets or `.env`.
