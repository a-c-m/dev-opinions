---
name: pr-creation
description: Auto-triggers when the user asks to open a PR. Drives the PR title, summary, and test plan to the repo's conventions.
---

Use `./.claude/commands/create-pr.sh` or `gh pr create` directly. The PR title must match the Conventional Commits subject pattern (ADR 0011).

Before opening:

1. Rebase onto the default branch (`main`). Resolve conflicts, do not skip them.
2. Run `pnpm check` locally. Do not rely on CI to catch a lint or typecheck failure that is local-visible.
3. If the diff changes a stack choice (package manager, framework, testing, etc.), add a new ADR or supersede the relevant one in `docs/adr/`. Reference it in the PR body.

Body shape:

- **Summary** — 1–3 bullets. What changed and why. Not a diff restatement.
- **Test plan** — what was tested and how. Include commands and results.
- **ADR alignment** — confirm no drift, or link the ADR.

Avoid screenshots unless the change is visual. Keep PRs small; split if more than ~300 lines of substantive code change.
