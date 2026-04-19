# ADR 0001: Package manager — pnpm

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

A monorepo-capable template needs a deterministic, fast, workspace-aware package manager. The choice shapes install time, disk footprint, how strictly dependencies are isolated between packages, and how cleanly the manager integrates with the monorepo orchestrator.

## Decision

Use **pnpm** (≥ 9.x) as the sole package manager. Enforce with the `packageManager` field in `package.json` and `engines.pnpm`. Declare workspaces in `pnpm-workspace.yaml`.

## Consequences

**Positive**
- Symlinked `node_modules` gives fast installs, low disk use, and strict dependency resolution — a package cannot silently import something it did not declare, which prevents a common class of monorepo bugs.
- First-class workspace protocol (`workspace:*`) keeps intra-repo links explicit and versioned, which integrates cleanly with NX.
- Healthy ecosystem momentum and broad tooling compatibility.

**Negative**
- Some tools assume a flat `node_modules` layout; those occasionally need an `.npmrc` escape hatch (`public-hoist-pattern`, `shamefully-hoist`).
- Contributors unfamiliar with pnpm's symlink model may be surprised when a "works locally" build fails on a peer with stricter resolution.

## Alternatives

- **Yarn 4 (Berry)** — capable, but PnP/Berry still has rougher edges with NestJS and some ESM tooling, and the stricter resolution story is no longer unique.
- **npm workspaces** — zero extra install, but slower and weaker package isolation at scale.
- **bun** — fastest installer, but coupling the package manager to a specific runtime adds risk, and parts of the NestJS/testing ecosystem still lag on bun.
