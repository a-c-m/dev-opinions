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
- **Commits**: Conventional Commits + **trailing ticket reference**. Use `pnpm commit` for the interactive prompt, or write messages like `feat(api): add search endpoint #123` / `feat(api): add search endpoint PROJ-456`. The trailer is required — open an issue first via `./.claude/commands/create-issue.sh` if there isn't one (see **Every commit names its ticket** under Operating rules).
- **PRs**: Use `./.claude/commands/create-pr.sh "<title>" "<summary>" <ticket>`. Title gets the ticket suffix; body opens with `Closes #N` (GitHub) or `Refs PROJ-N` (Jira/Linear). Direct `gh pr create` is blocked.

## Repo layout

- `apps/<product>/<service>/` — deployable units, two-tier. Second tier is the product (e.g. `tool1`, `funnels`, `marketing`); third tier is the service within it (e.g. `web`, `api`, `worker`). Each leaf has `src/main.ts(x)` and a scoped `package.json` (no `project.json` — NX metadata goes in `package.json` `"nx"`, see [ADR 0004](docs/adr/0004-nx-monorepo.md)).
- `repos/*` — independent child repos (often symlinks to external checkouts) for wrapping existing setups. See [repos/README.md](repos/README.md).
- `shared/*` — reusable libraries, imported as `@shared/<name>`.
- `tools/*` — workspace-internal tooling (custom reporters, generators).
- `docs/adr/` — architecture decision records. New significant decisions get a new ADR.
- `scripts/` — repo scripts. `reset-template.sh` deletes sample apps when starting a new project.
- `.claude/` — Claude Code configuration (agents, hooks, commands, skills, settings).

## Apps and Repos
<!-- One line per app/repo (name + description). If empty, offer to populate; if stale, offer to update. -->

- 

## Preferred workflow

1. Read any `AGENTS.md` in the app you are working on before editing (`CLAUDE.md` symlinks to it).
2. Use NX generators for new apps/libs — do not hand-roll project structure.
3. Run `pnpm check:fast` before committing.
4. Run `pnpm knip` to confirm no dead code was added.
5. For any decision that changes the stack, add or supersede an ADR under `docs/adr/`.

## Env variables

- **Backend** (ADR 0016): typed schema + layered YAML in `config/`; secrets-only in env vars, injected via `@shared/config`.
- **Web** (ADR 0017): a zod schema in `src/env.ts` over values injected at deploy time via `@import-meta-env/unplugin`.
- **Never** read `process.env` directly in app code — either tier.

Bash **sandbox** is enabled, credential stores (cloud/registry/CLI tokens, keychain, shell rc) are blocked from reads and writes are confined to the workspace — see [docs/conventions/sandbox.md](docs/conventions/sandbox.md).

## Task tracking — local vs team

Two tiers, deliberately separate:

- **Local, ephemeral, personal** — `bd` (beads) CLI. Scratch lists, in-flight per-branch notes, quick captures. State lives in `.beads/` and is **gitignored**. Use `bd q "<task>"` to capture, `bd list --ready` to pick up next. Never install `bd`'s own git hooks in this repo.
- **Team, long-running, externally visible** — Issues in centralized tracker e.g. `./.claude/commands/create-issue.sh`. Anything tied to a release, any bug a teammate might need to see, any discovery that produces a decision.

If a local bead outgrows its scope, copy it into a GitHub issue and close the bead.

## Memory — project vs personal

Two sinks — same split as task tracking. Test: *would another contributor want this?*

- **Project-shared** (yes) — conventions, rules, gotchas, non-obvious constraints: a bullet in the nearest `AGENTS.md`. Committed; subject to the ~150-line cap + inline-rationale rule per [ADR 0037](docs/adr/0037-multi-agent-rule-distribution.md).
- **Personal** (no) — facts about *this developer* (role, expertise, response-style): the harness auto-memory under `~/.claude/`. Not committed.

Mis-filed a personal note that's actually shared? Move it to `AGENTS.md`/`docs/`.

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

Non-negotiable — each has cost us time before.

- **Fail, don't skip** — when a hook/check/lint fails, fix the cause; never add an escape hatch (skip-if-missing, `--no-verify`, muting the rule, early-return). A hook you can silently skip isn't a hook.
- **One command at a time** — don't chain Bash with `&&` or `;`; each step must be runnable and reviewable alone.
- **Capture output for review** — prefer `cmd > .ai-wip/<name>.log 2>&1` over inline `| rg`/`| jq`, which discard the raw output. `.ai-wip/` is gitignored and survives sessions; `cat`/`tail`/`rg` the file after. Never `/tmp/` or `$TMPDIR` — the harness's own Bash-tool guidance pushes `$TMPDIR`, but this repo overrides it; the `block-bash-rules.sh` hook blocks `>` redirects to both.
- **Search with ripgrep, never grep** — use `rg` via Bash for all searches, not POSIX `grep` or the built-in `Grep` tool. Faster, respects `.gitignore`.
- **Work from the repo root** — don't pass absolute paths where a relative one works.
- **Sub-repos under `repos/*`** — run `cd repos/<name> && <cmd>` as **one** Bash call. This single chained form is the sanctioned exception to "one command at a time" (a `cd` is just navigation, so it's still one real command) and the only form that works in **agent threads** — they reset cwd between Bash calls, so a bare `cd` in a prior call is lost. Keep it to one `cd` + one command: a *second* `&&`/`;`, `git -C`, and `gh --repo`/`-R` all stay blocked. Capture works inside too: `cd repos/<name> && <cmd> > .ai-wip/<name>.log 2>&1` is prompt-free. Don't capture back to root via `../../.ai-wip/…` (`repos/*` can be symlinks). See [repos/README.md](repos/README.md).
- **Coverage baseline — ratchet up only** — `pnpm cov:check` compares per-file coverage to committed `coverage-baseline.json` (ADR 0014). `cov:promote` is fine when nothing regresses; `--allow-decrease` *lowers* a baseline and is human-only — the PreToolUse hook blocks AI from passing it.
- **Mini scripts: Node in `.ai-wip/`** — write one-shot scripts as `.mjs` and run with `node`; don't reach for Python unless a Node equivalent is materially harder. Never `/tmp/` or `$TMPDIR`.
- **Lock to exact versions** — pin every `package.json` dep exactly (`"2.2.6"`, not `^`/`~`). Ranges drift between installs; upgrade intentionally via a PR that bumps the pin and re-runs the gate.
- **Every commit names its ticket** — subject must end with `#NNN` (GitHub) or `PROJ-NNN` (Jira/Linear). Enforced twice: the commit-msg lefthook (commitlint `subject-ticket-suffix`, all authors) and the `block-bash-git.sh` PreToolUse hook (blocks a missing trailer *and* `--no-verify` for AI — no bypass). Open a ticket first if none exists. `bd` IDs are local-only — never in commits or PRs.

## When in doubt

- **Ask before you start.** Confirm scope and surface your assumptions before touching code on anything beyond a fully-specified one-liner. If the request leaves any real decision unspecified, ask one or two sharp questions first.
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

Biome 2 (Ultracite preset) enforces formatting / lint rules at edit time via the `validate-edit-biome` hook (`.claude/hooks/validate-edit-biome.sh`) — so agents do not need to re-read the full standards each session. See [docs/conventions/code-standards.md](docs/conventions/code-standards.md) for the long-form human reference (naming, architecture, edge cases Biome can't catch). Run `pnpm dlx ultracite fix` to apply, `pnpm dlx ultracite check` to verify.

## Before you are done

- Could it have been shorter? 50% or more less verbose and keep its value?
- Try another pass, make it shorter/simpler/more concise
- No, really - remove verbosity when you see it.
