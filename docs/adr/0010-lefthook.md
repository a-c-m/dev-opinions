# ADR 0010: Lefthook for git hooks

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Git hooks catch problems before they reach CI, but only if they are fast enough that developers do not bypass them. A hook set that takes tens of seconds to run sequentially on every commit will be disabled in practice. The runner's ability to parallelise independent checks and to filter by staged files is therefore a practical correctness issue, not just an optimisation.

## Decision

- **Lefthook** as the git hooks runner.
- Config at `lefthook.yml`:
  - `pre-commit` (parallel): Biome check on staged files, Knip on affected projects, commit message lint.
  - `pre-push`: `nx affected --target=typecheck,test,lint`.
  - `commit-msg`: commitlint against the edited message.
- Installed via a post-install script at the root, so fresh clones are hooked automatically.

## Consequences

**Positive**
- Parallel execution keeps the commit loop fast, which keeps hooks enabled in practice.
- A single YAML file captures the whole hook strategy — no `.husky/` shell-script sprawl.
- Staged-file filtering is built in, so a separate staged-files tool is not needed.

**Negative**
- A binary dependency; CI and dev machines need Lefthook available. The npm package ships platform binaries which makes this seamless in most cases, but not zero.
- Teams familiar with other hook runners need a short onboarding for the YAML format.

## Alternatives

- **Husky + lint-staged** — familiar and proven, but sequential by default and requires two tools to cover what Lefthook does in one.
- **simple-git-hooks** — tiny; lacks staged-file filtering and parallelism.
- **No hooks, CI only** — defers the feedback loop; catches issues later, slower.
