# `coverage-baseline`

Coverage ratchet for monorepos that mirror lint's "fail-on-improvement-undone" mechanic onto test coverage.

A committed `coverage-baseline.json` records each file's last-known coverage percentages. Every CI run compares the latest `coverage-summary.json` against it:

- **Existing files** must not drop below their baseline (within a small `epsilon` tolerance).
- **New files** (no baseline entry) must hit a glob-keyed threshold rule. First match wins.

Net effect: legacy code keeps shipping at its current coverage, new code is gated, and accepted improvements are explicitly promoted into the baseline via `coverage-baseline promote`. Same mental model as `bs` (biome-suppressed) for lint.

## Companion ADR

See [`docs/adr/0014-test-coverage-policy.md`](../../docs/adr/0014-test-coverage-policy.md) for the policy this tool enforces.

## Install

Local to this repo: already wired via the workspace and the root `package.json` scripts (`pnpm cov:check`, `pnpm cov:promote`).

If this package is later extracted and published to npm, the bin name is `coverage-baseline`.

## Usage

```sh
# Run tests with coverage first; this is what produces coverage/coverage-summary.json
pnpm test:cov

# Fail-fast check (CI)
pnpm cov:check

# Promote the latest run into the baseline. SAFE BY DEFAULT — refuses to
# write a baseline that would lower any file's metric or accept a sub-threshold
# new file. AI-safe.
pnpm cov:promote

# Permit lowering a metric. HUMAN-ONLY — a PreToolUse hook blocks AI from
# passing --allow-decrease. Use only when a refactor deliberately drops a
# tested file's coverage and you're recording that drop on purpose.
pnpm cov:promote -- --allow-decrease
```

## Safety model

The split between safe `promote` and the `--allow-decrease` override mirrors `bs` (biome-suppressed): a default operation that can only ratchet up, and an explicit override that humans run when they accept a regression. The intent is that an AI agent **cannot** silently drop the floor — a baseline regression is always an audited human decision.

## Configuration

The tool reads `.coverage-baseline.json` at the repo root by default:

```json
{
  "coverageFile": "coverage/coverage-summary.json",
  "baselineFile": "coverage-baseline.json",
  "epsilon": 0.1,
  "thresholds": [
    { "glob": "shared/**", "branches": 95, "functions": 100, "lines": 100, "statements": 100 },
    { "glob": "apps/**",   "branches": 80, "functions": 80,  "lines": 80,  "statements": 80  },
    { "glob": "tools/**",  "branches": 80, "functions": 80,  "lines": 80,  "statements": 80  }
  ]
}
```

| Field | Meaning |
|---|---|
| `coverageFile` | Path to the v8/Istanbul `coverage-summary.json` produced by your runner. |
| `baselineFile` | Path to the committed baseline. Created on first `promote`. |
| `epsilon` | Tolerance in percentage points below baseline that's still "no drop". Default `0.1`. |
| `thresholds[]` | Ordered glob rules for files with no baseline entry. First match wins. A file matching no rule is **ungated** and fails the check. |

## Library API

```ts
import {
  checkBaseline,
  promoteBaseline,
  compare,
  matchRule,
} from 'coverage-baseline';

const result = await checkBaseline(config, process.cwd());
if (!result.ok) {
  // result.drops[]          — files that dropped below baseline
  // result.newFilesBelow[]  — new files below their matched rule
  // result.newFilesUngated[] — new files matching no rule
  process.exit(1);
}
```

`compare()` and `matchRule()` are pure functions for unit testing.

## Architecture

```
src/
  types.ts     Public types (Baseline, CheckResult, ThresholdRule, …)
  compare.ts   Pure comparison logic (compare(), matchRule())
  reader.ts    Reads coverage-summary.json + baseline; normalises paths
  index.ts     Public API (checkBaseline, promoteBaseline)
  cli.ts       CLI entry point — subcommands: check, promote
```

The CLI is a thin shell around `index.ts`. Logic lives in `compare.ts` and is covered by unit tests against in-memory fixtures.

## Why not Jest's `coverageThreshold` / vitest thresholds?

Both runners support global and per-file thresholds, but they enforce a **floor** — every file must hit the threshold every run. That's exactly the wrong shape for adopting coverage policy into a codebase that's already shipping: you either drop the policy to today's worst-coverage file, or you spend weeks raising coverage before you can ship anything.

This tool inverts the gate: today's coverage is the floor, new code is gated, improvements are explicit. The standard threshold check is still useful as a **maximum**-aspiration policy for new code (which is what the `thresholds[]` rules express).

## Testing

```sh
pnpm --filter coverage-baseline test
pnpm --filter coverage-baseline typecheck
```

## Publishing (future)

When extracted to npm:

1. Move to its own repo, retain MIT licence.
2. Add a build step (`tsc` to `dist/`) — currently the bin shebang assumes Node 22's native TS type stripping.
3. Strip workspace-specific config defaults; keep the API.
