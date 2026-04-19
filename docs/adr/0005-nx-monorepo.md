# ADR 0005: NX for monorepo orchestration

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

This template is designed to host multiple apps plus shared packages, while remaining usable for a single-app project. Either mode benefits from task orchestration, running only the affected tasks on a change, caching, and independent release versioning. Doing these by hand with raw workspace scripts stops scaling quickly as project count grows.

## Decision

- **NX 22** (pinned exact to `22.6.5` — see ADR 0001 on exact pins) as the monorepo orchestrator.
- Workspace layout:
  - `apps/*` — deployable units (APIs, frontends, CLIs, worker processes).
  - `shared/*` — reusable libraries (logging, env config, auth, HTTP clients, domain models).
  - `tools/*` — workspace-internal tooling (custom reporters, codegen, generators).
- `nx.json` defines `targetDefaults` for `build`, `test`, `lint`, `typecheck` so every project gets the same shape for free.
- CI uses `nx affected --target=…` to skip unchanged projects.
- Independent release strategy (`nx release`): each publishable project versions and releases on its own cadence rather than one repo-wide version.

## Consequences

**Positive**
- Task caching and affected graphs cut CI time significantly on typical PRs.
- Generators produce consistently-structured projects, so the tenth app looks like the first.
- The orchestrator overhead is the same whether the repo has one app or fifty, so starting small is not penalised.

**Negative**
- NX introduces its own vocabulary — `project.json`, executors, plugins — that has a learning curve for new contributors.
- Some NX plugins lag behind upstream framework majors. Occasionally this forces a short wait before adopting a new framework version.

## Alternatives

- **Turborepo** — simpler mental model and fast, but weaker affected analysis, no generators, and no integrated release tooling.
- **Package-manager workspaces alone** — minimal, but lacks caching and task orchestration; ends up reinvented via shell scripts.
- **Moon** — modern and compelling, but smaller community and less proven at the scale of features NX ships.
