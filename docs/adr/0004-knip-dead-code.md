# ADR 0004: Knip for dead code detection

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Unused exports, unreferenced files, and declared-but-unused dependencies accumulate invisibly. Left alone, they inflate bundles, slow installs, mislead readers about what the codebase actually uses, and make refactors harder because it is unclear what is live. No lint rule catches these at the repository level — it requires a tool that understands the whole dependency graph.

## Decision

- `knip ^5.62` at the repo root.
- `knip.json` configures entry points derived from each project's `project.json` (NX targets) and `package.json` `main`/`bin`.
- Treated as a CI-blocking quality gate. New repos start with a ratchet from the initial issue count and drive toward zero.
- A custom issue-count reporter is used to keep signal high while a repo is being cleaned up, then dropped once the count is at zero.

## Consequences

**Positive**
- A single tool covers unused files, exports, types, and dependencies — no tool-sprawl.
- Bundles and install trees stay lean without relying on reviewer vigilance.
- Refactors become safer: it is clear what is still reachable.

**Negative**
- False positives happen for dynamic imports and side-effect-only modules. This requires per-app configuration tuning, not rule suppression.
- CI time increases slightly. Worth it for the continual cleanup signal.

## Alternatives

- **ts-prune** — narrower: unused exports only.
- **depcheck** — narrower: unused dependencies only.
- **Manual review** — does not scale, regresses on every PR.
