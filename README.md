# base-app

Starter template for new projects. Monorepo-capable; works equally well for a single app.

## Stack

Decisions captured in [docs/adr/](docs/adr/README.md):

| Area | Choice |
|---|---|
| Package manager | pnpm 9 |
| Monorepo | NX 22 |
| Language | TypeScript 5.8 strict, tsgo for typecheck |
| Lint/format | Biome 2 + Ultracite 5 |
| Dead code | Knip 5 |
| Backend | NestJS 10 (Fastify adapter) |
| Frontend | React 19 + Vite 7 primary, SvelteKit alternative |
| Testing | Vitest + Playwright (Stagehand optional) |
| ORM | Drizzle (Postgres / SQLite) |
| Git hooks | Lefthook |
| Commits | Conventional Commits + commitlint + commitizen |
| Env | Validated zod schema per app |
| Node | 22 LTS (`.nvmrc`) |

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

`pnpm check` requires Trivy (`brew install aquasecurity/trivy/trivy` on macOS).

## Layout

```
apps/                    # deployable units
shared/                  # reusable libraries (@shared/*)
tools/                   # workspace-internal tooling
docs/adr/                # architecture decision records
scripts/                 # repo scripts (reset, codegen)
.claude/                 # Claude Code config (agents, hooks, commands, skills)
```

## Starting a new project from this template

1. Clone or copy this repo.
2. Run `./scripts/reset-template.sh` to remove sample apps and reset the repo to a clean slate.
3. Generate your first app: `pnpm nx g @nx/nest:app <name>` or `pnpm nx g @nx/react:app <name>`.
4. Update the root `README.md` and `CLAUDE.md` with project-specific context.

## Sample apps (to be deleted via `pnpm reset`)

- `apps/sample-api` — NestJS health-check API with a Vitest test.
- `apps/sample-web` — React + Vite page with a Vitest component test and a Playwright smoke test.

They exist to prove the workspace builds, lints, and tests end-to-end. Delete once you have your own apps.
