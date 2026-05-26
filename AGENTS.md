# Project context

Canonical cross-agent brief per [ADR 0037](docs/adr/0037-multi-agent-rule-distribution.md). `CLAUDE.md` is a symlink to this file — edits to either path edit one file.

This repo is a monorepo starter (pnpm + NX). See [docs/adr/AGENTS.md](docs/adr/AGENTS.md) for the decisions behind every tool and framework here — read them before proposing a change to stack choices.

Note: ADRs refer to this template as **base-app**; the published GitHub artifact is **dev-opinions**. Both names refer to the same repo.

## Core conventions

- **Package manager**: pnpm 9. Never run `npm` or `yarn` against this repo.
- **Typecheck**: `pnpm typecheck` (uses tsgo, not plain `tsc`).
- **Lint + format**: `pnpm lint` writes; `pnpm lint:check` verifies. Biome 2 extending Ultracite.
- **Test**: `pnpm test` runs Vitest across all projects. E2E lives under `apps/<product>/<service>-e2e/` and runs via `pnpm test:e2e`.
- **Dead code**: `pnpm knip` — CI blocks on new issues.
- **Security**: `pnpm security` — Trivy scans deps, secrets, and IaC. Fails on HIGH/CRITICAL (ADR 0008).
- **Full gate**: `pnpm check` = lint + typecheck + test + knip + security.
- **Commits**: Conventional Commits + **trailing ticket reference**. Use `pnpm commit` for the interactive prompt, or write messages like `feat(api): add search endpoint #123` / `feat(api): add search endpoint PROJ-456`. Use `#000` as a placeholder when there genuinely is no ticket (scaffolding, dep bump). See [Every commit names its ticket](#every-commit-names-its-ticket).
- **PRs**: Use `./.claude/commands/create-pr.sh "<title>" "<summary>" <ticket>`. Title gets the ticket suffix; body opens with `Closes #N` (GitHub) or `Refs PROJ-N` (Jira/Linear). Direct `gh pr create` is blocked.

## Repo layout

- `apps/<product>/<service>/` — deployable units, two-tier. Second tier is the product (e.g. `tool1`, `funnels`, `marketing`); third tier is the service within it (e.g. `web`, `api`, `worker`). Each leaf has `src/main.ts(x)` and a scoped `package.json` (no `project.json` — NX metadata goes in `package.json` `"nx"`, see [ADR 0004](docs/adr/0004-nx-monorepo.md)).
- `shared/*` — reusable libraries, imported as `@shared/<name>`.
- `tools/*` — workspace-internal tooling (custom reporters, generators).
- `docs/adr/` — architecture decision records. New significant decisions get a new ADR.
- `scripts/` — repo scripts. `reset-template.sh` deletes sample apps when starting a new project.
- `.claude/` — Claude Code configuration (agents, hooks, commands, skills, settings).

## Preferred workflow

1. Read any `AGENTS.md` in the app you are working on before editing (`CLAUDE.md` symlinks to it).
2. Use NX generators for new apps/libs — do not hand-roll project structure.
3. Run `pnpm check:affected` before committing.
4. Run `pnpm knip` to confirm no dead code was added.
5. For any decision that changes the stack, add or supersede an ADR under `docs/adr/`.

## Env variables

Backend services follow ADR 0016: typed schema + layered YAML files in `config/`, with secrets-only living in env vars and injected via `@shared/config`. Web apps follow ADR 0017: a zod schema in `src/env.ts` validating values injected at deploy time via `@import-meta-env/unplugin`. Do not read `process.env` directly in application code in either tier.

## Task tracking — local vs team

Two tiers, deliberately separate:

- **Local, ephemeral, personal** — `bd` (beads) CLI. Scratch lists, in-flight per-branch notes, quick captures. State lives in `.beads/` and is **gitignored**. Use `bd q "<task>"` to capture, `bd list --ready` to pick up next. Never install `bd`'s own git hooks in this repo.
- **Team, long-running, externally visible** — GitHub Issues via `./.claude/commands/create-issue.sh`. Anything tied to a release, any bug a teammate might need to see, any discovery that produces a decision.

If a local bead outgrows its scope, copy it into a GitHub issue and close the bead.

## Memory — project vs personal

Two sinks, deliberately separate — same two-tier shape as task tracking.

- **Project-shared** — facts every contributor benefits from (a convention, a rule, a recurring gotcha, a non-obvious constraint): add a bullet to the nearest `AGENTS.md` (root or per-folder). Committed; shared via git; subject to the ~150-line cap and inline-rationale rule per [ADR 0037](docs/adr/0037-multi-agent-rule-distribution.md).
- **Personal** — facts about *this developer* (role, expertise level, response-style preferences): write to the harness's auto-memory under `~/.claude/`. Per-developer; not committed. Cannot be redirected from project settings — Claude Code ignores `autoMemoryDirectory` in committed `.claude/settings.json` for security.

Before writing to auto-memory, ask: "would another contributor want this?" If yes, it's project-shared — write to `AGENTS.md`, not auto-memory. If a memory turns out to be project-shared after the fact, promote it: delete the personal entry, add the AGENTS.md bullet.

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
Use `rg` via Bash for **all** searches — not POSIX `grep`, and not the built-in `Grep` tool. Bash calls are reviewable and capturable to `.ai-wip/<name>.log`; the built-in tool's output isn't. Ripgrep is faster and respects `.gitignore`, which matters in this monorepo. `git grep` is fine when you specifically need git's index or history. Enforcement: the built-in `Grep` tool is in `permissions.deny` (`.claude/settings.json`); the PreToolUse hook **blocks** Bash calls that invoke `grep`/`egrep`/`fgrep` (exit 2). Carve-outs for `git grep`, `man grep`, `which grep`, `type grep`, `command -v grep`, `apropos grep`, `whatis grep`, `info grep` — these are *about* grep, not invocations of it.

### Work from the repo root
Don't pass absolute paths into commands where a relative path from the current directory would do. If you need to work inside a subdirectory repeatedly, `cd` to it first. Keeps commands readable and diffable.

### Coverage baseline — ratchet up only
The `pnpm cov:check` gate compares per-file coverage against a committed `coverage-baseline.json` (ratchet — see ADR 0014). `pnpm cov:promote` (safe mode) is fine to run when nothing regresses. `pnpm cov:promote -- --allow-decrease` writes a baseline that *lowers* a file's coverage; that's a deliberate human call. The PreToolUse hook blocks AI from passing `--allow-decrease`. If a refactor genuinely needs to drop coverage, hand the command to the human.

### Mini scripts: Node, written to `.ai-wip/`
For one-shot verification / batch-transform / regex-sweep scripts, write a `.mjs` file under `.ai-wip/` and run it with `node`. Don't reach for Python — the team's primary language is TS/JS, Node is on every machine, and the script is easier to re-read and amend later. Reach for Python only if a Node equivalent would be materially harder. Never write the script to `/tmp/` (PreToolUse hook blocks it; `.ai-wip/` is the documented scratch location).

### Every commit names its ticket (AI-only enforcement)
Every AI-authored commit must end its subject with a tracker reference: `#NNN` (GitHub), `PROJ-NNN` (Jira/Linear), or `#000` (no-ticket placeholder for scaffolding / dep bumps). The PreToolUse hook (`.claude/hooks/block-bash-git.sh`) blocks `git commit` without one — there is no AI-side escape hatch. If a commit genuinely has no ticket and `#000` isn't appropriate, ask the human to run the commit themselves. Same goes for PRs: use `./.claude/commands/create-pr.sh` which appends the ticket to the title and writes `Closes #N` / `Refs PROJ-N` into the body. `bd` (beads) IDs are local-only and must NOT appear in commits or PRs.

**Asymmetry — humans are NOT subject to this hook.** Lefthook's `commit-msg` runs commitlint, which enforces Conventional Commits format only — it does *not* require a ticket trailer. Humans are still strongly encouraged to follow the same convention, but nothing blocks them. **Why:** humans can be held accountable for misuse via PR review, CODEOWNERS, and `git blame`; AI agents cannot, so the gate runs at the harness layer where the agent acts. Do not "fix" this asymmetry by adding a ticket-trailer check to commitlint — it is deliberate.

### Lock to exact versions
All dependency versions in every `package.json` are pinned exactly (e.g. `"2.2.6"`, not `"^2.2.6"` or `"~2.2.6"`). Ranges let silent upgrades break the build between `pnpm install` runs on different machines. Upgrades happen intentionally, via a PR that bumps the pin and re-runs the full quality gate.

## When in doubt

- **Ask before you start.** Confirm scope and surface your assumptions before touching code on anything beyond a fully-specified one-liner. If the request leaves any real decision unspecified, ask one or two sharp questions first. Don't paper over ambiguity with a default and a comment.
- **If multiple decisions are unsettled, don't drip-feed questions** — lead with `/grill-me` instead.
- **If you're unsure mid-task, stop and check** rather than guessing. A pause to confirm is cheaper than a wrong implementation.
- Prefer editing existing files over creating new ones.
- Prefer generators over ad-hoc project creation.
- Prefer an ADR over a silent stack change.

## Reasoning & Pushback

- Be direct. If something is wrong or flawed, say so.
- Challenge weak reasoning before helping execute it.
- Form strongest-case counter arguments before conceding a point.
- Hold positions under pressure unless given new evidence — not just pushback.
- Flag uncertainty with a confidence level when relevant.

## Code standards

Biome 2 (Ultracite preset) enforces formatting and most lint rules at edit time via the `validate-edit-biome` hook (`.claude/hooks/validate-edit-biome.sh`) — so agents do not need to re-read the full standards each session. See [docs/conventions/code-standards.md](docs/conventions/code-standards.md) for the long-form human reference (naming, architecture, edge cases Biome can't catch). Run `pnpm dlx ultracite fix` to apply, `pnpm dlx ultracite check` to verify.
