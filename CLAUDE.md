# Claude Code context

This repo is a monorepo starter (pnpm + NX). See [docs/adr/](docs/adr/README.md) for the decisions behind every tool and framework here — read them before proposing a change to stack choices.

## Core conventions

- **Package manager**: pnpm 9. Never run `npm` or `yarn` against this repo.
- **Typecheck**: `pnpm typecheck` (uses tsgo, not plain `tsc`).
- **Lint + format**: `pnpm lint` writes; `pnpm lint:check` verifies. Biome 2 extending Ultracite.
- **Test**: `pnpm test` runs Vitest across all projects. E2E lives under `apps/*-e2e` and runs via `pnpm test:e2e`.
- **Dead code**: `pnpm knip` — CI blocks on new issues.
- **Security**: `pnpm security` — Trivy scans deps, secrets, and IaC. Fails on HIGH/CRITICAL (ADR 0015).
- **Full gate**: `pnpm check` = lint + typecheck + test + knip + security.
- **Commits**: Conventional Commits. Use `pnpm commit` for the interactive prompt, or write messages like `feat(api): add search endpoint`.

## Repo layout

- `apps/*` — deployable units. Each has a `project.json`, `src/main.ts`(x), and a scoped `package.json`.
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

Every app declares its env in `src/env.ts` via a zod schema (see ADR 0013). Do not read `process.env` directly in application code. Web apps additionally follow ADR 0019 for runtime env injection via placeholder tokens.

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

## Operating rules

These are non-negotiable. They exist because each has cost us time before.

### Fail, don't skip
When a hook, check, or lint fails, fix the underlying cause. Never add an escape hatch to the hook (skip-if-missing, `--no-verify`, muting the rule globally, early-return on edge cases). A hook that can be silently skipped is not a hook. If the failure is a bootstrap problem, solve it by installing what the hook needs, not by making the hook optional.

### One command at a time
Don't chain unrelated Bash commands with `&&` or `;`. Each step should be runnable and reviewable on its own. Chain only when two commands are genuinely one logical operation (e.g. `mkdir -p x && cd x`).

### Capture output for review
Prefer `cmd > /tmp/<name>.log 2>&1` over `cmd | grep …` or `cmd | jq …` inline. The user can re-read the file later. Inline pipes discard the raw output. If the file is small, `cat` it after. If large, `tail` or `grep` it — but the full output stays on disk.

### Work from the repo root
Don't pass absolute paths into commands where a relative path from the current directory would do. If you need to work inside a subdirectory repeatedly, `cd` to it first. Keeps commands readable and diffable.

### Lock to exact versions
All dependency versions in every `package.json` are pinned exactly (e.g. `"2.2.6"`, not `"^2.2.6"` or `"~2.2.6"`). Ranges let silent upgrades break the build between `pnpm install` runs on different machines. Upgrades happen intentionally, via a PR that bumps the pin and re-runs the full quality gate.

## When in doubt

- Prefer editing existing files over creating new ones.
- Prefer generators over ad-hoc project creation.
- Prefer an ADR over a silent stack change.
