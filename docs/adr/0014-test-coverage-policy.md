---
date: 2026-05-25
decision-makers: [Repo platform]
---

# ADR 0014: Test coverage policy

## TL;DR

| Tier | Lines / Functions / Statements | Branches | Enforced where |
|---|---|---|---|
| `shared/**/src/**/*.ts` | **100** | **soft 100 / hard 95** | root `vitest.config.ts` glob |
| `apps/*/src/**/*.service.ts` | **80** | **80** | root glob |
| `*.resolver.ts`, `*.controller.ts` | smoke only — covered by E2E ([ADR 0012](0012-vitest-playwright.md)) | — | excluded from % rollup |
| UI components (React 19) | no % target — behaviour assertions only | — | excluded from % rollup |
| `tools/*`, `scripts/*` | best-effort | — | excluded from rollup |

Provider: `@vitest/coverage-v8` on Vitest ≥4. Thresholds enforced from a single **root** `vitest.config.ts` — per-project `coverage.*` blocks are ignored when running from the root. Mutation testing **off**; StrykerJS is the documented graduation.

## Context

[ADR 0012](0012-vitest-playwright.md) picked Vitest + v8 coverage and punted the actual numbers ("CI fails below per-project thresholds once a project is stable"). Two `shared/*` packages now ship at 100% and the question of *what to enforce where* is live: holding every package to 100% rewards low-value tests on typed-TS nullish branches; holding nothing erodes the signal that `shared/*` infra is bulletproof.

Vitest 4 also changed the workspace shape — `vitest.workspace.ts` is gone, replaced by `projects: [...]` inside the root config. Coverage thresholds declared in per-project configs are silently ignored when the root invokes them, so the policy has to live in one place.

## Decision Outcome

### Provider — `@vitest/coverage-v8`

v8 is the default. Since Vitest 3.2 it uses AST-based remapping (the `ast-v8-to-istanbul` package); the 2022–2024 branch-coverage inaccuracy on implicit-else and ternary short-circuits is materially resolved, and Vitest 4 removes `experimentalAstAwareRemapping` as a flag (always on). Istanbul stays available as a graduation for UI-heavy packages where JSX branch accuracy matters; expect ~2–3× slower runs.

### Single root `vitest.config.ts` with glob-keyed thresholds

```ts
// vitest.config.ts (repo root) — sketch, not the final file
export default defineConfig({
  test: {
    projects: ['apps/*/*', 'shared/*', 'tools/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary', 'json'], // + 'html' locally
      reportOnFailure: true,
      thresholds: {
        lines: 80, functions: 80, branches: 80, statements: 80,
        'shared/**/src/**/*.ts': {
          lines: 100, functions: 100, statements: 100, branches: 95,
        },
        'apps/*/*/src/**/*.service.ts': { lines: 80, branches: 80 },
      },
      exclude: [
        '**/*.types.ts', '**/*.dto.ts', '**/*.module.ts',
        '**/index.ts', '**/*.barrel.ts',
        '**/__generated__/**', '**/*.gen.ts',
        '**/db/schema/**', '**/drizzle/**',
        '**/*.config.*', '**/*.e2e-spec.ts', '**/test/**',
        '**/main.ts', '**/instrumentation.mts',
      ],
    },
  },
});
```

**Critical gotcha**: Vitest counts files matched by a glob threshold against **both** the glob threshold **and** the global tier — a glob does not carve a file out of the global floor. The 80/80 global tier is therefore the *floor* for everything not excluded.

### Branch policy on `shared/*` — 100 statements, hard 95 branches

The branch-coverage paradox is real: in typed TypeScript most `?.` / `??` short-circuits are parsed but not meaningful. Holding 100% lines/functions/statements on `shared/*` is the signal ("infra code is fully exercised"); the 95-branch floor leaves room for `/* v8 ignore next -- @preserve */` on invariant throws (`?? throw new InvariantError(...)`), unreachable defaults, and similar. The escape valve is **the comment, not the threshold** — every ignore must be justified in PR review.

### What's excluded from coverage entirely

- Types (`*.types.ts`, `*.dto.ts`) — disappear at runtime.
- DI wiring (`*.module.ts`) — the assertion is "Nest boots", which E2E covers.
- Barrels (`**/index.ts`, `**/*.barrel.ts`) — re-exports only.
- Generated code (`**/__generated__/**`, `**/*.gen.ts`).
- Drizzle schema (`**/db/schema/**`) — declarative table defs ([ADR 0011](0011-drizzle-orm.md)).
- Configs, migrations, E2E specs, OTel boot (`instrumentation.mts` per [ADR 0025](0025-runtime-observability.md)).

**Not excluded even when tempting**: mappers, anti-corruption layers, custom Zod refinements, error classes with constructor logic. These are where bugs hide.

### Reporters and PR comment

- CI: `text`, `lcov`, `json-summary`, `json` (last two required for the PR-comment action).
- Local: add `html` (gitignored).
- PR comment via `davelosert/vitest-coverage-report-action@v2`; reads thresholds straight from the root config and diffs against `main` via `json-summary-compare-path`. Hardened fork `step-security/vitest-coverage-report-action` is the named supply-chain graduation.

### Adoption ratchet — `coverage-baseline`

Vitest's threshold check is a **floor**: every file must hit the threshold every run. That's the wrong shape for adopting this policy into a codebase that already ships at mixed coverage — you either drop the policy to today's worst-coverage file or invest weeks raising coverage before you can merge anything.

The companion tool [`tools/coverage-baseline/`](../../tools/coverage-baseline/) inverts the gate, matching the mental model of `bs` (biome-suppressed) for lint:

- A committed `coverage-baseline.json` records every file's current percentages.
- `pnpm cov:check` (run after `pnpm test:cov`) fails when **any** file drops below its baseline (within a small `epsilon` tolerance).
- **New files** (no baseline entry) are gated by glob rules in `.coverage-baseline.json`. The glob rules mirror the tiers above (`shared/**` → 100/95/100/100, `apps/**` and `tools/**` → 80/80/80/80).
- `pnpm cov:promote` regenerates the baseline from the latest run. **Safe by default** — refuses to write a baseline that would lower any file's metric or accept a sub-threshold new file. AI agents may run safe-mode `promote` freely.
- `pnpm cov:promote -- --allow-decrease` is the human-only override for deliberate regressions (e.g. a refactor that legitimately drops a tested file's coverage). A PreToolUse hook (`.claude/hooks/block-bash-rules.sh`) blocks AI from passing the flag — lowering the floor is always an audited human decision.

Net effect: existing files keep shipping at today's coverage, new code is gated, accepted improvements are explicit, and only humans can accept regressions. The tool is library-shaped (~150 LOC core, pure comparison logic + thin CLI) and designed for extraction to npm later.

CI gates `pnpm cov:check` in addition to Vitest's own threshold check — both run, both must pass. Vitest's floor catches a regression in *aggregate*; `cov:check` catches a regression in *any specific file*.

### Mutation testing — off, documented graduation

StrykerJS works against Vitest 4 (`@stryker-mutator/core` v9.6.x, Vitest runner PR #5928 landed Feb 2026), but a full-monorepo run on a ~5k-LOC NestJS service typically takes 20–60 min even with `--incremental`. **Default: off.** **Graduation 1**: weekly cron on `shared/*` only, mutation score gate 70%. **Graduation 2**: Stryker on PRs that touch `shared/*`, scoped via `--mutate` glob.

### Worked example — `@shared/auth` + `@shared/authz`

Both ship at 100/100/100/100 today. Under this policy:
- Lines/functions/statements stay at 100 (no change).
- Branches drop from 100 to a 95 floor — frees the next invariant-throw addition from needing a synthetic "this can't happen" test.
- Their per-package `vitest.config.ts` files retire their `coverage.thresholds` blocks; the root config owns enforcement.

## Consequences

### Positive

- **One place to read the policy** — root config, glob-keyed, matches the file layout.
- **`shared/*` 100% is honest** — statements are real coverage; branches are pragmatic.
- **Resolvers/controllers stop demanding unit-test theatre** — covered by E2E per [ADR 0012](0012-vitest-playwright.md).
- **`/* v8 ignore next -- @preserve */` is the documented escape valve** — auditable in PR diffs, not a threshold drop.

### Negative

- **Globs do not carve files out of the global floor** — a file matched by a glob threshold must satisfy both. Documented; trips devs who expect Jest-style behaviour.
- **Per-package `coverage.thresholds` blocks become dead code** — they don't run from the root; must be removed to avoid the appearance of enforcement.
- **Branch coverage is admitted to be partially theatre** — relies on mutation testing graduation for real branch-level confidence.

### Neutral

- Codecov / SonarCloud remain options as the graduation path for PR comments; today's action is enough.
- UI components have no %-target; the assertion is via Vitest browser mode + Testing Library behaviour tests, not line counts.

## Alternatives considered

1. **Hold every `shared/*` package at 100/100/100/100** — current state. Rewards writing low-value tests for typed-TS short-circuits. Rejected per the branch-coverage paradox.
2. **One global 80/80 tier for everything** — loses the "infra is bulletproof" signal; the two existing `shared/*` packages would regress.
3. **Per-project `coverage.thresholds` blocks** — Vitest 4 does support them, but they are ignored when the root runs coverage. Splitting policy across N configs invites drift.
4. **Codecov / SonarCloud for PR enforcement** — both work; both add an external SaaS dependency for a feature the open-source action covers.
5. **Adopt StrykerJS now** — wall-clock cost and LLM-corpus depth fail the gates set in [AGENTS.md](../../AGENTS.md). Documented as a graduation instead.

## Related

- [ADR 0012](0012-vitest-playwright.md) — picked Vitest + v8; punted thresholds here.
- [ADR 0011](0011-drizzle-orm.md) — schema files are declarative; excluded from rollup.
- [ADR 0025](0025-runtime-observability.md) — `instrumentation.mts` is boot glue; excluded.
- [Vitest coverage docs](https://vitest.dev/guide/coverage) — `ast-v8-to-istanbul`, glob thresholds, `reportOnFailure`.
- [`davelosert/vitest-coverage-report-action`](https://github.com/davelosert/vitest-coverage-report-action) — PR comment action; reads root config.
- [StrykerJS](https://stryker-mutator.io/docs/stryker-js/introduction/) — mutation testing graduation.
- Parsai & Demeyer, "Comparing Mutation Coverage Against Branch Coverage in an Industrial Setting" ([arXiv:2104.11767](https://arxiv.org/abs/2104.11767)) — evidence basis for mutation-as-real-branch-confidence.
