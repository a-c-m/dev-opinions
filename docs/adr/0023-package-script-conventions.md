# ADR 0023: Package script conventions

- **Status**: Proposed
- **Date**: 2026-05-15
- **Deciders**: Repo platform
- **Tags**: tooling, conventions, nx, scripts

## Context

NX's `run-many --target=<verb>` only does useful work when projects across
the workspace share verb names. The same is true of `nx affected -t <verb>`
in CI. As soon as two leaf packages disagree on what `serve`, `dev`,
`preview`, or `test:coverage` mean, `run-many` either skips work or runs
the wrong thing — and contributors learn the workspace is "kind of like a
monorepo but each project is its own snowflake".

Vite calls "run the built artifact" `preview`. Astro calls it `preview`
too. NestJS calls "start the autoreload dev loop" `start:dev`. npm
privileges `start` to mean "run the production thing", but most tooling
ignores that. Without a workspace-wide convention, every new app drifts
toward its framework's defaults.

There's no convention yet for integration tests, no convention for
database lifecycle scripts (`db:up`/`db:migrate`/etc.), and `lint` does
different things in different repos (sometimes read-only, sometimes
write).

The cost of fixing this is small while the repo is a starter. The cost
of *not* fixing it grows linearly with every new project that gets
scaffolded against an inconsistent template.

## Decision

Adopt a fixed alphabet of script verbs across the workspace. Every leaf
project that has a given concept exposes it under the canonical verb;
projects that don't have the concept omit the script entirely, and
`run-many` excludes them naturally.

### Verb table

| Verb | Means | Notes |
|---|---|---|
| `dev` | Long-lived, autoreload dev loop | Vite, `node --watch`, `nodemon`, etc. Never runs in CI. |
| `serve` | Run the **pre-built** artifact | Assumes `dist/` (or framework equivalent) exists. Replaces Vite/Astro `preview`. |
| `start` | `serve` + `dependsOn: ["build"]` | One command from a clean tree to a running process. For onboarding and CI smoke tests. |
| `build` | Produce `dist/` | Deterministic, reproducible, no dev-only steps. |
| `clean` | Wipe `dist/` and framework caches | `dist/`, `.svelte-kit/`, `.astro/`. `.nx/cache` is **not** cleaned by this — use `pnpm nx:reset`. |
| `lint` | Biome (`bs check --write`) | **Writes** by design — see "Lint writes by design" below. |
| `lint:container` | hadolint over the project's `Dockerfile` | Only on services that ship a container. |
| `typecheck` | `tsgo --noEmit` (or framework equivalent: `svelte-check`, `astro check`) | |
| `test` | Unit tests, fast, no coverage | `vitest run` |
| `test:cov` | Unit tests + coverage | `vitest run --coverage` |
| `test:watch` | Unit tests, watch mode | `vitest` |
| `test:int` | Integration tests, fast | Separate vitest project / config when the runner is shared; separate tool otherwise. |
| `test:int:cov` | Integration + coverage | Double colon is the price of consistency — see "Naming integration tests". |
| `test:int:watch` | Integration, watch mode | |
| `e2e` | Playwright, system-wide | Lives in `apps/<product>/<service>-e2e/` only. Never on a non-e2e service. |
| `codegen` | Run code generators (graphql-codegen, drizzle-kit generate, etc.) | Output is gitignored; generated paths are excluded from the production input set. |
| `db:up` / `db:down` | Bring the dev database up / down | `podman compose` / `docker compose`. |
| `db:migrate` | Apply migrations against the dev database | |
| `db:seed` | Populate dev fixtures | |
| `db:reset` | `db:down && db:up && db:migrate && db:seed` | Single command to a known-good state. |

### Per-project-type contracts

Each project type exposes a fixed subset of the verbs above. A verb a
project doesn't expose simply isn't defined, and `nx run-many -t <verb>`
will skip it.

| Project type | Required | Optional |
|---|---|---|
| Backend service (NestJS API, worker) | `dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | `lint:container`, `test:int`, `test:int:cov`, `test:int:watch`, `codegen` |
| Frontend service (SvelteKit, React, Astro) | `dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | `lint:container`, `codegen` |
| Database package | `lint`, `typecheck`, `test`, `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset` | `codegen` (drizzle-kit) |
| E2E suite | `e2e`, `lint`, `typecheck` | — |
| Shared library (`shared/*`) | `build`, `lint`, `typecheck`, `test`, `test:cov`, `test:watch` | — |

### Lint writes by design

`lint` writes (auto-fixes) deliberately. The repo policy is **zero lint
errors** — no warnings, no escape hatches, no allowlists. Under that
policy, auto-fix is a safety net, not a footgun: if a fixable rule trips,
the fix is applied and the diff makes the change reviewable. A read-only
`lint` would just push every contributor to type `lint` then `lint --fix`
back-to-back; the convention captures the second step.

CI uses `lint:ci` (`bs check --suppression-fail-on-improvement`) at the
root, which is read-only and fails the build if a suppression could be
removed. That's the gate; per-project `lint` is the developer ergonomic.
This split lives at the **root** package.json only — leaf projects expose
just `lint`, because CI runs the gate centrally via `pnpm lint:ci`.

### Naming integration tests

Integration tests live in `test:int*` rather than a separate top-level
verb (`integ`, `integration`) so that:

1. `nx run-many -t test:int` is a coherent slice across the workspace.
2. The `test:*` family stays unified — anyone scanning a `package.json`
   sees all test variants in one alphabetical block.
3. NX target defaults for caching and inputs apply to the family by
   pattern.

The `test:int:cov` double-colon is acceptable. Colon-namespacing is
already in use elsewhere in the repo (`db:migrate`, `lint:check`,
`lint:ci`) and parses unambiguously left-to-right: "test, integration
variant, with coverage". Coverage as a CLI flag (`--coverage`) was
considered and rejected — it loses muscle-memory parity with `test:cov`
and forces every CI config to remember the flag.

### `start` vs `serve` vs `dev`

Three verbs, three contracts. The temptation to collapse them is real but
each carries a meaning the others don't:

- `dev` runs from source, with autoreload, for development. Never in CI.
- `serve` runs the **built** artifact. Useful for smoke tests against
  what would actually deploy, or for previewing a static-site build.
- `start` is `serve` with `dependsOn: ["build"]`. One command from a
  clean checkout to a running process. Earns its slot for onboarding,
  CI smoke jobs, and bug repros where "did you build first" is a real
  question.

### `e2e` is not a service verb

E2E suites live in `apps/<product>/<service>-e2e/`, never inside a
service. They expose `e2e`, `lint`, `typecheck` and nothing else.
Consequences:

- `nx run-many -t dev` doesn't try to "dev" the e2e project — it has no
  `dev` script.
- `nx run-many -t e2e` runs only the e2e suites, naturally.
- No `--exclude=tag:type:e2e` flag-juggling is needed. The contract is
  per-target, not per-tag.

A `type:e2e` tag may still exist for documentation, but the exclusion
mechanism is the missing target.

### Root scripts

The root `package.json` keeps a thin orchestration layer over
`nx run-many`. Only the verbs that are workspace-wide operations live at
the root:

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
    "check":       "pnpm lint:check && pnpm typecheck && pnpm test && pnpm knip && pnpm security",
    "check:affected": "nx affected --target=lint,typecheck,test"
  }
}
```

`start` and `serve` deliberately don't appear at the root: starting "the
whole workspace" is a per-product operation, not a per-workspace one. Use
`nx run-many -t start --projects=<product>-*` instead.

## Consequences

### Positive

- **`run-many` works without flag-juggling.** `nx run-many -t test --projects=<product>-*`
  catches all unit tests; `nx run-many -t test:int --projects=<product>-*` catches
  integration; `nx run-many -t e2e` catches only e2e suites because services
  don't expose it.
- **NX caching applies uniformly.** `targetDefaults` in `nx.json` can be
  tightened per-verb because every project with a verb means the same
  thing by it.
- **New project scaffolding is mechanical.** The per-project-type table is
  the generator template.
- **Onboarding is shorter.** "Start the stack" is one `nx run-many -t start --projects=<product>-*`
  command. No tribal knowledge required.

### Negative

- **`start` adds a third runtime verb** when two would suffice for many
  use cases. Justified by the onboarding/smoke-test value but a real
  cognitive cost for the reader who only ever uses `dev`.
- **`test:int:cov` is ugly.** The alternatives (separate verb, NX
  configurations, CLI flag) were uglier in different ways. Documented
  here so the question doesn't get relitigated.

### Neutral

- **Auto-fixing `lint` surprises npm-veterans.** The convention is widely
  the opposite (`lint` reads, `lint:fix` writes). This ADR's policy
  inverts that for an explicit reason — see "Lint writes by design". CI
  runs `lint:ci` (read-only) so the gate isn't compromised.

## Alternatives considered

### 1. Status quo — let each project pick its own verbs

- **Pro**: zero work today.
- **Con**: every new project compounds the drift. The Vite/Astro
  `preview` vs NestJS `start:dev` mismatch is exactly what bites
  `nx run-many`. Rejected.

### 2. NX configurations instead of `:cov` and `:watch` scripts

`nx test some-api --configuration=coverage` instead of `nx test:cov some-api`.

- **Pro**: idiomatic NX. Single target per concept, axes as
  configurations.
- **Con**: cognitive load shifts from "what's the script name" to "which
  targets have which configurations and what are they called". At <10
  leaf packages the abstraction costs more than it saves. Revisit if the
  workspace grows past ~20. Rejected for now.

### 3. Coverage as a vitest CLI flag, no `:cov` script

- **Pro**: one less verb in the table.
- **Con**: every CI workflow has to remember `--coverage`. Loses muscle
  memory parity with `test:cov`. Rejected.

### 4. Drop `start`, keep only `dev` and `serve`

- **Pro**: smaller alphabet.
- **Con**: "build then run" is a real workflow (onboarding, CI smoke
  tests, bug repros). Forcing every caller to remember `nx run-many -t build,serve`
  with the right ordering is worse than naming the combo. Rejected.

### 5. Tag-based exclusion of e2e from `run-many`

`nx run-many -t dev --exclude=tag:type:e2e`.

- **Pro**: explicit, documented in tags.
- **Con**: relies on every caller remembering the flag. The
  per-target-contract approach (e2e simply doesn't expose `dev`) is
  enforceable by code review of the e2e project's `package.json`, not
  by hoping callers passed the right `--exclude`. Rejected.

## Implementation plan

This ADR formalises a contract. Concrete migrations happen per-project
as they are scaffolded or touched:

1. When a new app is generated, the generator template must produce
   scripts that match the per-project-type contract above.
2. When an existing app is touched, audit its scripts against the table
   and bring them into compliance in the same PR.
3. The root `package.json` already exposes the workspace-wide verbs in
   the table above; add new ones as they're needed.
4. Update `nx.json` `targetDefaults` as new verbs land, with
   appropriate `cache`, `inputs`, and `dependsOn` entries.

The root [CLAUDE.md](../../CLAUDE.md) "Core conventions" section should
link to this ADR for the full contract, with the verb table inline as
the cheat sheet.

## References

- [NX targets concept](https://nx.dev/concepts/executors-and-configurations)
  — official guidance on consistent target naming for `run-many` and
  `affected`.
- [NX run-many recipe](https://nx.dev/recipes/running-tasks/run-tasks-in-parallel)
  — the affected-graph + parallel-execution model that this ADR underpins.
- [npm scripts spec](https://docs.npmjs.com/cli/v10/using-npm/scripts) —
  the privileged `start` / `test` / `restart` / `stop` names that this
  ADR's `start` is compatible with.
- [ADR 0003](0003-biome-ultracite.md) — Biome + Ultracite, the linter
  this ADR's `lint` script wraps.
- [ADR 0005](0005-nx-monorepo.md) — NX as the orchestrator that makes
  these conventions load-bearing.
- [ADR 0008](0008-vitest-playwright.md) — Vitest + Playwright, the
  runners this ADR's `test*` and `e2e` verbs invoke.
