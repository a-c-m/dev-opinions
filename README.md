# base-app

Starter template for new projects. Monorepo-capable; works equally well for a single app.

> AI agents read [`AGENTS.md`](AGENTS.md) instead of this README. `CLAUDE.md` is a symlink to it ([ADR 0028](docs/adr/0028-multi-agent-rule-distribution.md)).

## Stack

Decisions captured in [docs/adr/AGENTS.md](docs/adr/AGENTS.md):

| Area | Choice |
|---|---|
| Package manager | pnpm 9 |
| Monorepo | NX 22 |
| Language | TypeScript 5.8 strict, tsgo for typecheck |
| Lint/format | Biome 2 + Ultracite 5 |
| Dead code | Knip 5 |
| Backend | NestJS 11 (Fastify adapter) |
| Frontend | React 19 + Vite 7 primary, SvelteKit alternative |
| GraphQL | Yoga via `@graphql-yoga/nestjs`, code-first |
| Testing | Vitest + Playwright (Stagehand optional) |
| ORM | Drizzle (Postgres / SQLite) |
| Git hooks | Lefthook |
| Commits | Conventional Commits + commitlint + commitizen |
| Backend config | Typed schema + layered YAML + secrets-only env vars ([ADR 0015](docs/adr/0015-backend-config.md)) |
| Web env | `@import-meta-env/unplugin` at deploy time ([ADR 0016](docs/adr/0016-web-runtime-env-tokens.md)) |
| Node | 22 LTS (`.nvmrc`) |
| Containers | `node:22-bookworm-slim` four-stage Dockerfile, podman |
| IaC | OpenTofu, per-app `iac/` |

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

## Sample apps (to be deleted via `./scripts/reset-template.sh`)

- `apps/sample/api` — NestJS health-check API with a Vitest test.
- `apps/sample/web` — React + Vite page with a Vitest component test and a Playwright smoke test.

They exist to prove the workspace builds, lints, and tests end-to-end. Delete once you have your own apps.
