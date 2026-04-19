# ADR 0002: TypeScript strict + tsgo for typecheck

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

TypeScript's type system catches a large class of bugs only when strict mode is on; loose configurations silently erode that value over time. On larger codebases, `tsc` also becomes the slowest step in the inner dev loop and in CI, which discourages running it often.

## Decision

- TypeScript 5.8.x with `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`.
- Target `ES2022`, module `ESNext`, `moduleResolution: bundler` for bundled apps or `node` for Node-targeted code.
- `typecheck` script uses **tsgo** (`@typescript/native-preview`) with `--noEmit`. `tsc` remains the emitter for `.d.ts` when packages need to publish types.

## Consequences

**Positive**
- Strict mode surfaces real bugs at the type layer; every relaxation of strictness is visible in a tsconfig, not hidden in code.
- tsgo collapses typecheck time from minutes to seconds on wide repos, which makes it realistic to run in pre-push hooks and on every CI job.
- `moduleResolution: bundler` removes the `.js` import-extension friction that shows up when `node` resolution is used with modern bundlers.

**Negative**
- tsgo is still labelled preview and may diverge from `tsc` in subtle ways. Mitigation: run full `tsc` in a release-gate CI job as a safety net until tsgo is GA.
- Strict flags can be noisy on newly generated code; prefer per-file suppressions over loosening the repo-wide config.

## Alternatives

- **`tsc` only** — safest and slowest; acceptable on small repos, painful at scale.
- **Non-strict TypeScript** — rejected; the cost of strictness is paid up front, the cost of looseness compounds.
