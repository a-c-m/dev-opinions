---
date: 2026-04-19
---

# ADR 0004: NX for monorepo orchestration

## Context and Problem Statement

This template is designed to host multiple apps plus shared packages, while remaining usable for a single-app project. Either mode benefits from task orchestration, running only the affected tasks on a change, caching, and independent release versioning. Doing these by hand with raw workspace scripts stops scaling quickly as project count grows.

`nx run-many --target=<verb>` and `nx affected -t <verb>` only do useful work when projects across the workspace share verb names. As soon as two leaf packages disagree on what `serve`, `dev`, `preview`, or `test:coverage` mean, `run-many` either skips work or runs the wrong thing — and contributors learn the workspace is "kind of like a monorepo but each project is its own snowflake". Without a workspace-wide convention, every new app drifts toward its framework's defaults (Vite `preview`, NestJS `start:dev`, npm-privileged `start`).

## Decision Outcome

- **NX 22** (pinned exact to `22.6.5` — see ADR 0001 on exact pins) as the monorepo orchestrator.
- Workspace layout:
  - `apps/*` — deployable units (APIs, frontends, CLIs, worker processes). In practice apps follow a two-tier `apps/<product>/<service>/` layout (per [ADR 0013](0013-package-by-feature.md) and [ADR 0005](0005-child-apps-and-repos.md)); the original flat `apps/*` shape is the conceptual root rather than the on-disk layout.
  - `shared/*` — reusable libraries (logging, env config, auth, HTTP clients, domain models).
  - `tools/*` — workspace-internal tooling (custom reporters, codegen, generators).
- `nx.json` defines `targetDefaults` for `build`, `test`, `lint`, `typecheck` so every project gets the same shape for free.
- CI uses `nx affected --target=…` to skip unchanged projects.
- Independent release strategy (`nx release`): each publishable project versions and releases on its own cadence rather than one repo-wide version.

### Script verb conventions

A fixed alphabet of script verbs is the contract that makes `run-many`/`affected` load-bearing. Every leaf project exposing a given concept uses the canonical verb; projects without the concept omit the script and `run-many` skips them naturally. The full verb table and per-project-type contract live in [docs/conventions/scripts.md](../conventions/scripts.md) — that's the cheat sheet for authors and the NX generator template.

Two design choices in that table are architecturally significant and recorded here:

- **`lint` writes by design.** Under a zero-lint-errors policy, auto-fix is a safety net, not a footgun: fixable rules apply automatically and the diff is reviewable. CI uses `lint:ci` (`bs check --suppression-fail-on-improvement`) at the root, which is read-only and fails the build if a suppression could be removed. The split lives at the **root** `package.json` only — leaf projects expose just `lint`, because CI runs the gate centrally.
- **`e2e` is not a service verb.** E2E suites live in `apps/<product>/<service>-e2e/` and expose `e2e`, `lint`, `typecheck` only. `nx run-many -t dev` therefore doesn't try to "dev" the e2e project — it has no `dev` script. Exclusion is by missing target, not by tag flag. A `type:e2e` tag may exist for documentation but is not the exclusion mechanism.

## Consequences

### Positive
- Task caching and affected graphs cut CI time significantly on typical PRs.
- `run-many` works without flag-juggling because every project means the same thing by a given verb.
- Generators produce consistently-structured projects, so the tenth app looks like the first.
- The orchestrator overhead is the same whether the repo has one app or fifty, so starting small is not penalised.

### Negative
- NX introduces its own vocabulary — `project.json`, executors, plugins — that has a learning curve for new contributors.
- Some NX plugins lag behind upstream framework majors. Occasionally this forces a short wait before adopting a new framework version.
- Auto-fixing `lint` surprises npm-veterans (`lint:fix` is the more common convention). CI still gates via `lint:ci` so the policy isn't compromised.

## Alternatives considered

- **Turborepo** — simpler mental model and fast, but weaker affected analysis, no generators, and no integrated release tooling.
- **Package-manager workspaces alone** — minimal, but lacks caching and task orchestration; ends up reinvented via shell scripts.
- **Moon** — modern and compelling, but smaller community and less proven at the scale of features NX ships.
- **NX configurations instead of `:cov`/`:watch` scripts** (e.g. `nx test some-api --configuration=coverage`) — idiomatic NX but shifts cognitive load to "which targets have which configurations". At <10 leaf packages the abstraction costs more than it saves; revisit past ~20.
- **Tag-based exclusion of e2e from `run-many`** (`--exclude=tag:type:e2e`) — relies on every caller remembering the flag. The per-target-contract approach is enforceable by code review, not by hoping callers passed the right flag.

## Related

- [ADR 0006](0006-biome-ultracite.md) — Biome + Ultracite; the linter `lint`/`lint:ci` wrap.
- [ADR 0012](0012-vitest-playwright.md) — Vitest + Playwright; the runners `test*` and `e2e` invoke.
- [docs/conventions/scripts.md](../conventions/scripts.md) — the verb table and per-project-type contract.
- [NX targets concept](https://nx.dev/concepts/executors-and-configurations) — official guidance on consistent target naming for `run-many` and `affected`.
