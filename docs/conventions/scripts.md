# Package script verb reference

Canonical alphabet of script verbs across the workspace. Established by [ADR 0004](../adr/0004-nx-monorepo.md). Every leaf project that has a given concept exposes it under the canonical verb; projects that don't have the concept omit the script entirely, and `nx run-many` skips them naturally.

## Verb table

| Verb | Means | Notes |
|---|---|---|
| `dev` | Long-lived, autoreload dev loop | Vite, `node --watch`, `nodemon`, etc. Never runs in CI. |
| `serve` | Run the **pre-built** artifact | Assumes `dist/` (or framework equivalent) exists. Replaces Vite/Astro `preview`. |
| `start` | `serve` + `dependsOn: ["build"]` | One command from a clean tree to a running process. For onboarding and CI smoke tests. |
| `build` | Produce `dist/` | Deterministic, reproducible, no dev-only steps. |
| `clean` | Wipe `dist/` and framework caches | `dist/`, `.svelte-kit/`, `.astro/`. `.nx/cache` is **not** cleaned by this — use `pnpm nx:reset`. |
| `lint` | Biome (`bs check --write`) | **Writes** by design — see [ADR 0004 "Script verb conventions"](../adr/0004-nx-monorepo.md#script-verb-conventions). |
| `lint:container` | hadolint over the project's `Dockerfile` | Only on services that ship a container. |
| `typecheck` | `tsgo --noEmit` (or framework equivalent: `svelte-check`, `astro check`) | |
| `test` | Unit tests, fast, no coverage | `vitest run` |
| `test:cov` | Unit tests + coverage | `vitest run --coverage` |
| `test:watch` | Unit tests, watch mode | `vitest` |
| `test:int` | Integration tests, fast | Separate vitest project / config when the runner is shared; separate tool otherwise. |
| `test:int:cov` | Integration + coverage | Double colon is the price of consistency — see [Naming integration tests](#naming-integration-tests). |
| `test:int:watch` | Integration, watch mode | |
| `e2e` | Playwright, system-wide | Lives in `apps/<product>/<service>-e2e/` only. Never on a non-e2e service. |
| `codegen` | Run code generators (graphql-codegen, drizzle-kit generate, etc.) | Output is gitignored; generated paths are excluded from the production input set. |
| `db:up` / `db:down` | Bring the dev database up / down | `podman compose` / `docker compose`. |
| `db:migrate` | Apply migrations against the dev database | |
| `db:seed` | Populate dev fixtures | |
| `db:reset` | `db:down && db:up && db:migrate && db:seed` | Single command to a known-good state. |

## Per-project-type contracts

Each project type exposes a fixed subset of the verbs above. A verb a project doesn't expose simply isn't defined, and `nx run-many -t <verb>` will skip it.

| Project type | Required | Optional |
|---|---|---|
| Backend service (NestJS API, worker) | `dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | `lint:container`, `test:int`, `test:int:cov`, `test:int:watch`, `codegen` |
| Frontend service (SvelteKit, React, Astro) | `dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | `lint:container`, `codegen` |
| Database package | `lint`, `typecheck`, `test`, `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset` | `codegen` (drizzle-kit) |
| E2E suite | `e2e`, `lint`, `typecheck` | — |
| Shared library (`shared/*`) | `build`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | — |

## Root scripts

The root `package.json` keeps a thin orchestration layer over `nx run-many`. Only verbs that are workspace-wide operations live at the root:

```json
{
  "scripts": {
    "dev":         "nx run-many --target=dev --all --parallel",
    "build":       "nx run-many --target=build --all",
    "clean":       "nx run-many --target=clean --all",
    "test":        "nx run-many --target=test --all",
    "test:cov":    "nx run-many --target=test:cov --all",
    "test:int":    "nx run-many --target=test:int --all",
    "test:e2e":    "nx run-many --target=e2e --all",
    "typecheck":   "nx run-many --target=typecheck --all",
    "lint":        "bs check --write",
    "lint:check":  "bs check",
    "lint:ci":     "bs check --suppression-fail-on-improvement",
    "knip":        "knip",
    "security":    "./scripts/security-scan.sh",
    "check":       "pnpm lint:check && pnpm typecheck && pnpm test:cov && pnpm cov:check && pnpm knip && pnpm security",
    "check:fast":  "nx run-many --target=lint,typecheck --all && nx affected --target=test"
  }
}
```

`start` and `serve` deliberately don't appear at the root: starting "the whole workspace" is a per-product operation, not a per-workspace one. Use `nx run-many -t start --projects=<product>-*` instead.

## Naming integration tests

Integration tests live under `test:int*` rather than a separate top-level verb (`integ`, `integration`) so that:

1. `nx run-many -t test:int` is a coherent slice across the workspace.
2. The `test:*` family stays unified — anyone scanning a `package.json` sees all test variants in one alphabetical block.
3. NX `targetDefaults` for caching and inputs apply to the family by pattern.

The `test:int:cov` double-colon parses unambiguously left-to-right: "test, integration variant, with coverage". A `--coverage` CLI flag was considered and rejected — it loses muscle-memory parity with `test:cov` and forces every CI config to remember the flag.

## `start` vs `serve` vs `dev`

Three verbs, three contracts. Each carries a meaning the others don't:

- `dev` runs from source, with autoreload, for development. Never in CI.
- `serve` runs the **built** artifact. Useful for smoke tests against what would actually deploy, or for previewing a static-site build.
- `start` is `serve` with `dependsOn: ["build"]`. One command from a clean checkout to a running process. Earns its slot for onboarding, CI smoke jobs, and bug repros where "did you build first" is a real question.
