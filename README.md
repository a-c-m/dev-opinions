# dev-opinions

*I wrote this for you.*

A collection of ADRs — what I currently think "good" looks like, mostly for projects in the JavaScript ecosystem.

Packaged as a runnable monorepo template, but the real payload is [`docs/adr/`](docs/adr/). Three ways to use it:

- **Start a new project from it.** Clone, run `./scripts/reset-template.sh`, generate your first app. The opinions come with you.
- **Wrap an existing setup with it.** One monorepo, or a group of related repos that want a shared source of truth for conventions. Vendor [`docs/adr/`](docs/adr/), the agent files, and the hooks; leave the sample apps behind.
- **Just read it — or have your AI read it.** Point Claude / Cursor / Copilot at [`docs/adr/`](docs/adr/) and [`AGENTS.md`](AGENTS.md) and they stop guessing about your conventions. Equally useful for humans venturing into territory outside their usual skill set, where the *why* in each ADR matters more than the *what*.

## A note before you clone

These are my dev opinions. They've been collected over a few years from talking to people, trying things, building systems, breaking systems, and occasionally being wrong in public. You might not like them. That's fine — but if you don't, **I'd love to hear why**, because that's how I improve them. As Turi Munthe says, "thinking is a contact sport". Bring it on!

The point of this repo is not "do it this way". The point is to give you an *opinionated starting position* to push against. Deviate freely. Disagree loudly. But start from something that's already made the boring decisions, so your energy goes into the interesting ones.

It's built with the assumption that you're working primarily in the **JavaScript ecosystem** (TypeScript everywhere, NestJS on the back, React or SvelteKit on the front, Postgres underneath). Plenty of the conventions — ADRs, the commit/PR discipline, the agent setup — will travel to other stacks. The tooling won't.

### Licensing — AGPL, and why

Published under **[AGPL-3.0-or-later](LICENSE)** because I want the loop to close: if you learn something building on top of this, I want to learn it too. That's the deal.

If AGPL doesn't work for what you're building and you'd rather not share back, **get in touch** — I hold the copyright, so I can grant you different terms. I'd be excited to have that conversation.

---

> AI agents read [`AGENTS.md`](AGENTS.md) instead of this README. `CLAUDE.md` is a symlink to it ([ADR 0028](docs/adr/0028-multi-agent-rule-distribution.md)).

## Proposed stack

One concrete implementation of the opinions. Deviate as needed — the ADRs in [docs/adr/AGENTS.md](docs/adr/AGENTS.md) explain why each choice was made, so you can tell which ones you can swap freely and which ones drag others along.

| Area            | Choice                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Package manager | pnpm 9                                                                                          |
| Monorepo        | NX 22                                                                                           |
| Language        | TypeScript 5.8 strict, tsgo for typecheck                                                       |
| Lint/format     | Biome 2 + Ultracite 5                                                                           |
| Dead code       | Knip 5                                                                                          |
| Backend         | NestJS 11 (Fastify adapter)                                                                     |
| Frontend        | React 19 + Vite 7 primary, SvelteKit alternative                                                |
| GraphQL         | Yoga via `@graphql-yoga/nestjs`, code-first                                                   |
| Testing         | Vitest + Playwright (Stagehand optional)                                                        |
| ORM             | Drizzle (Postgres / SQLite)                                                                     |
| Git hooks       | Lefthook                                                                                        |
| Commits         | Conventional Commits + commitlint + commitizen                                                  |
| Backend config  | Typed schema + layered YAML + secrets-only env vars ([ADR 0015](docs/adr/0015-backend-config.md))  |
| Web env         | `@import-meta-env/unplugin` at deploy time ([ADR 0016](docs/adr/0016-web-runtime-env-tokens.md)) |
| Node            | 22 LTS (`.nvmrc`)                                                                             |
| Containers      | `node:22-bookworm-slim` four-stage Dockerfile, podman                                         |
| IaC             | OpenTofu, per-app `iac/`                                                                      |

## Getting started

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for the full first-clone walkthrough (system tools, sample apps, container builds, troubleshooting).

TL;DR:

```sh
nvm use                   # picks up Node 22 from .nvmrc
pnpm install              # installs deps + lefthook git hooks via `prepare`
pnpm dev                  # run all apps in dev
pnpm check                # lint + typecheck + test + knip + security (Trivy)
pnpm commit               # interactive conventional commit
```

`pnpm check` requires Trivy (`brew install aquasecurity/trivy/trivy` on macOS); see also [`scripts/setup-mac.sh`](scripts/setup-mac.sh) to install all system prerequisites at once.

## Layout

```
apps/<product>/<service>/  # deployable units, two-tier
shared/                    # reusable libraries (@shared/*)
tools/                     # workspace-internal tooling
docs/adr/                  # architecture decision records (AGENTS.md = index)
docs/runbooks/             # ops runbooks (3am-ready)
docs/sops/                 # standard operating procedures
scripts/                   # repo scripts (reset, codegen, security-scan)
AGENTS.md                  # canonical cross-agent brief; CLAUDE.md is a symlink
.agents/skills/            # canonical skill sources, symlinked per agent
.claude/                   # Claude Code config (agents, hooks, commands, settings)
```

## Starting a new project from this template

1. Clone or copy this repo.
2. Run `./scripts/reset-template.sh` to remove sample apps and reset the repo to a clean slate.
3. Generate your first app: `pnpm nx g @nx/nest:app <name>` or `pnpm nx g @nx/react:app <name>`.
4. Update `README.md` and `AGENTS.md` with project-specific context.

## Wrapping an existing setup

For when you already have one or more repos and don't want to move them — but you do want the ADRs and agent setup to apply when you're working on them with an AI.

1. Clone (or symlink) the repos you want to work on into `repos/` at the root of this one. `repos/` is gitignored — your code stays in its own repo, with its own history, untouched.
2. Start your agent session from this repo's root. The agent picks up [`AGENTS.md`](AGENTS.md), [`docs/adr/`](docs/adr/), the hooks, and the skills here, and can read anything under `repos/`.
3. From there, three patterns:
   - **Make it yours.** Treat this repo as a parent — fork it, then diverge fast. Add your own ADRs, swap tooling choices you disagree with, refine the agent setup as you learn what trips it up. You're *expected* to drift from upstream; that's the point. From then on, every agent session run from this root carries your curated context into whatever sits under `repos/`.
   - **Audit drift.** Ask the agent to compare a child repo against your ADRs and report where it deviates — and whether the deviation is deliberate, a gap, or a signal that the ADR itself wants updating.
   - **Propagate.** Have the agent port a specific ADR (and any associated tooling — hooks, configs, scripts) into a child repo, adapted to whatever framework actually lives there.

The wrapping repo is read-only context by default; child repos only get edited when you explicitly ask the agent to write into them.

## Following upstream

Once you've forked and diverged, don't expect to `git merge` upstream changes back in — your tree shape will have moved too much for the merge cost to be worth it. The usable workflow is to watch upstream, read what's changed (especially new or revised ADRs), and **re-make the decision** in your own context. Apply the understanding, not the diff.

This is consistent with how the ADRs themselves work: each one is a decision made in a specific context, not a configuration to be inherited. When the context changes — yours, or mine — the decision has to be made again.

**The reverse also holds.** If you find an ADR here that's wrong, missing, or just stupid, please open a PR and tell me. The whole point of this repo is that I want to learn what you've learned. Same loop, other direction.

## Sample apps (to be deleted via `./scripts/reset-template.sh`)

- `apps/sample/api` — NestJS health-check API with a Vitest test.
- `apps/sample/web` — React + Vite page with a Vitest component test and a Playwright smoke test.

They exist to prove the workspace builds, lints, and tests end-to-end. Delete once you have your own apps.
