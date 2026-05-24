---
date: 2026-04-19
---

# ADR 0002: Node 22 LTS pinned via .nvmrc

## Context and Problem Statement

Node 22 entered LTS in October 2024 and is the current active LTS through 2027. Audited projects do not pin Node versions consistently; this causes drift across machines and CI. NX, pnpm, Vitest, NestJS 10, and Drizzle all support Node 22.

## Decision Outcome

- Pin Node **22 LTS** to an **exact** patch version via `.nvmrc` at repo root
  (e.g. `22.19.0`, not `22` or `22.x`). Drift between dev machines and CI is
  the whole reason this ADR exists; an unpinned minor re-opens that drift.
- Declare `"engines": { "node": ">=22.0.0", "pnpm": ">=9.0.0" }` in root
  `package.json` as a compatibility floor (patch versions are allowed to
  slide, but not majors).
- CI consumes `.nvmrc` through `actions/setup-node@v4` with
  `node-version-file: .nvmrc`, so local and CI run the same patch.
- Bumps happen in a PR that updates `.nvmrc` and re-runs the full quality
  gate. Renovate/Dependabot cover the "remind me there's a newer patch"
  side; the pin side is deliberate.

## Consequences

### Positive
- One pinned version for all contributors and CI → deterministic builds.
- Access to Node 22 features: stable `node:test`, built-in `--watch`, ESM-first ergonomics, `require(esm)` support.
- LTS window until 2027 gives runway.

### Negative
- Tooling that lags on Node 22 (rare now) would need patching or a downshift.
- nvm/fnm/volta is required locally; lightweight but not zero-install.

## Alternatives considered

- **Node 20 LTS** — still supported, slightly safer, misses newer perf wins.
- **Node 24** — current, but not LTS until Oct 2025 → too fresh for a template default.
- **No pinning** — rejected; invites drift.
