# ADR 0008: Vitest for unit, Playwright for E2E, Stagehand optional

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

A repository typically needs a unit/integration runner and a browser E2E tool. The unit runner sits on the critical path of every developer edit, so its speed and ergonomics dominate daily experience. E2E runs less often but must be reliable enough to block releases. A third, AI-assisted category (natural-language browser control) is emerging and worth leaving a seat at the table for without making it mandatory.

## Decision

- **Unit / integration**: Vitest ≥ 2.x. Co-located `vitest.config.ts` per project, or inherited from `vite.config.ts`.
- **E2E**: Playwright ≥ 1.56. One `playwright.config.ts` per E2E project.
- **Experimental AI E2E**: Stagehand allowed per-app where it fits (flaky or vision-dependent scenarios). Not the default — it introduces an LLM dependency and runtime cost.
- Backend apps use Vitest directly; no Jest setup is maintained.
- Coverage uses Vitest's v8 provider; CI fails below per-project thresholds once a project is stable.

## Consequences

**Positive**
- A single Vite pipeline covers source and tests, which reduces config drift and speeds iteration.
- ESM-first by default, matching the rest of the stack — fewer interop surprises.
- Stagehand as opt-in gives a clear path to AI-assisted E2E without everyone paying the cost.

**Negative**
- Stagehand's LLM cost and non-determinism make it unsuitable for tight CI loops; teams must distinguish smoke suites from full regressions.
- Teams used to Jest globals and mocking idioms will have small adjustments. Vitest's API is close to Jest's but not identical.

## Alternatives

- **Jest + Playwright** — proven, but CJS-first, slower, and requires separate config to align with a Vite build.
- **Node test runner** — zero deps, weaker DX, no watch-mode ergonomics.
- **Playwright Component Testing** — viable but less mature than Vitest for unit work.
