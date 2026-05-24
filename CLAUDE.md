# Claude Code context

This repo is a monorepo starter (pnpm + NX). See [docs/adr/](docs/adr/README.md) for the decisions behind every tool and framework here — read them before proposing a change to stack choices.

## Core conventions

- **Package manager**: pnpm 9. Never run `npm` or `yarn` against this repo.
- **Typecheck**: `pnpm typecheck` (uses tsgo, not plain `tsc`).
- **Lint + format**: `pnpm lint` writes; `pnpm lint:check` verifies. Biome 2 extending Ultracite.
- **Test**: `pnpm test` runs Vitest across all projects. E2E lives under `apps/<product>/<service>-e2e/` and runs via `pnpm test:e2e`.
- **Dead code**: `pnpm knip` — CI blocks on new issues.
- **Security**: `pnpm security` — Trivy scans deps, secrets, and IaC. Fails on HIGH/CRITICAL (ADR 0015).
- **Full gate**: `pnpm check` = lint + typecheck + test + knip + security.
- **Commits**: Conventional Commits + **trailing ticket reference**. Use `pnpm commit` for the interactive prompt, or write messages like `feat(api): add search endpoint #123` / `feat(api): add search endpoint PROJ-456`. See [Every commit names its ticket](#every-commit-names-its-ticket).
- **PRs**: Use `./.claude/commands/create-pr.sh "<title>" "<summary>" <ticket>`. Title gets the ticket suffix; body opens with `Closes #N` (GitHub) or `Refs PROJ-N` (Jira/Linear). Direct `gh pr create` is blocked.

## Repo layout

- `apps/<product>/<service>/` — deployable units, two-tier. Second tier is the product (e.g. `tool1`, `funnels`, `marketing`); third tier is the service within it (e.g. `web`, `api`, `worker`). Each leaf has a `project.json`, `src/main.ts`(x), and a scoped `package.json`.
- `shared/*` — reusable libraries, imported as `@shared/<name>`.
- `tools/*` — workspace-internal tooling (custom reporters, generators).
- `docs/adr/` — architecture decision records. New significant decisions get a new ADR.
- `scripts/` — repo scripts. `reset-template.sh` deletes sample apps when starting a new project.
- `.claude/` — Claude Code configuration (agents, hooks, commands, skills, settings).

## Preferred workflow

1. Read any `CLAUDE.md` in the app you are working on before editing.
2. Use NX generators for new apps/libs — do not hand-roll project structure.
3. Run `pnpm check:affected` before committing.
4. Run `pnpm knip` to confirm no dead code was added.
5. For any decision that changes the stack, add or supersede an ADR under `docs/adr/`.

## Env variables

Backend services follow ADR 0021: typed schema + layered YAML files in `config/`, with secrets-only living in env vars and injected via `@shared/config`. Web apps follow ADR 0019: a zod schema in `src/env.ts` validating values injected at deploy time via `@import-meta-env/unplugin`. Do not read `process.env` directly in application code in either tier.

## Task tracking — local vs team

Two tiers, deliberately separate:

- **Local, ephemeral, personal** — `bd` (beads) CLI. Scratch lists, in-flight per-branch notes, quick captures. State lives in `.beads/` and is **gitignored**. Use `bd q "<task>"` to capture, `bd list --ready` to pick up next. Never install `bd`'s own git hooks in this repo.
- **Team, long-running, externally visible** — GitHub Issues via `./.claude/commands/create-issue.sh`. Anything tied to a release, any bug a teammate might need to see, any discovery that produces a decision.

If a local bead outgrows its scope, copy it into a GitHub issue and close the bead.

## MCP tools available

From `.mcp.json`:
- **context7** — fetch up-to-date library docs before implementing against unfamiliar APIs.
- **playwright** — automate a browser for E2E or manual debugging.
- **chrome-devtools** — inspect a running page.

## Skills available

Surface these proactively when the situation matches — don't wait to be asked. Be assertive: state that you're running the skill, don't ask permission.

- **`/grill-me`** — before any non-trivial implementation, especially anything crossing service boundaries or with multiple unsettled decisions. When a request looks large, lead with this rather than improvising a plan.
- **`/zoom-out`** — when the user references an unfamiliar file or area, or asks "what does this do / where does this sit / what calls it".
- **`/to-prd`** — after a `/grill-me` session or a long discovery thread that's reached shared understanding and is worth filing as a GitHub issue.
- **`/tdd`** — when starting a non-trivial behaviour change where test-first is the right shape.

## Operating rules

These are non-negotiable. They exist because each has cost us time before.

### Fail, don't skip
When a hook, check, or lint fails, fix the underlying cause. Never add an escape hatch to the hook (skip-if-missing, `--no-verify`, muting the rule globally, early-return on edge cases). A hook that can be silently skipped is not a hook. If the failure is a bootstrap problem, solve it by installing what the hook needs, not by making the hook optional.

### One command at a time
Don't chain unrelated Bash commands with `&&` or `;`. Each step should be runnable and reviewable on its own. Chain only when two commands are genuinely one logical operation (e.g. `mkdir -p x && cd x`).

### Capture output for review
Prefer `cmd > .ai-wip/<name>.log 2>&1` over `cmd | rg …` or `cmd | jq …` inline. The user can re-read the file later. Inline pipes discard the raw output. If the file is small, `cat` it after. If large, `tail` or `rg` it — but the full output stays on disk. `.ai-wip/` is gitignored — one known location, survives across sessions, never committed. Don't use `/tmp/` (PreToolUse hook blocks it).

### Search with ripgrep, never grep
For ad-hoc searches, use the built-in `Grep` tool (ripgrep-backed). In shell scripts and Bash tool calls, use `rg`, not POSIX `grep`. Ripgrep is faster and respects `.gitignore`, which matters in this monorepo. `git grep` is fine when you specifically need git's index or history. See [docs/adr/0020-ripgrep-over-grep.md](docs/adr/0020-ripgrep-over-grep.md). The PreToolUse hook **blocks** Bash calls that invoke `grep`/`egrep`/`fgrep` (exit 2). Carve-outs for `git grep`, `man grep`, `which grep`, `type grep`, `command -v grep`, `apropos grep`, `whatis grep`, `info grep` — these are *about* grep, not invocations of it.

### Work from the repo root
Don't pass absolute paths into commands where a relative path from the current directory would do. If you need to work inside a subdirectory repeatedly, `cd` to it first. Keeps commands readable and diffable.

### Every commit names its ticket
Every AI-authored commit must end its subject with a tracker reference: `#NNN` (GitHub) or `PROJ-NNN` (Jira/Linear). The PreToolUse hook blocks `git commit` without one — there is no AI-side escape hatch. If a commit genuinely has no ticket (scaffolding, dep bump, hotfix-without-issue), ask the human to run the commit themselves. Same goes for PRs: use `./.claude/commands/create-pr.sh` which appends the ticket to the title and writes `Closes #N` / `Refs PROJ-N` into the body. `bd` (beads) IDs are local-only and must NOT appear in commits or PRs.

### Lock to exact versions
All dependency versions in every `package.json` are pinned exactly (e.g. `"2.2.6"`, not `"^2.2.6"` or `"~2.2.6"`). Ranges let silent upgrades break the build between `pnpm install` runs on different machines. Upgrades happen intentionally, via a PR that bumps the pin and re-runs the full quality gate.

## When in doubt

- **Ask before you start.** Confirm scope and surface your assumptions before touching code on anything beyond a fully-specified one-liner. If the request leaves any real decision unspecified, ask one or two sharp questions first. Don't paper over ambiguity with a default and a comment.
- **If multiple decisions are unsettled, don't drip-feed questions** — lead with `/grill-me` instead.
- **If you're unsure mid-task, stop and check** rather than guessing. A pause to confirm is cheaper than a wrong implementation.
- Prefer editing existing files over creating new ones.
- Prefer generators over ad-hoc project creation.
- Prefer an ADR over a silent stack change.
