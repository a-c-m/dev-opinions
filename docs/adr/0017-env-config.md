---
status: superseded by ADR-0015 and ADR-0016
date: 2026-04-19
---

# ADR 0017: Env config via validated schema

## Context and Problem Statement

The original pattern — per-app `src/env.ts` declaring a zod schema validated once at boot — is retired.

- **Backend services** now use the typed-schema + layered-YAML + secrets-only-env approach defined in [ADR 0015](0015-backend-config.md).
- **Web apps** continue to use [ADR 0016](0016-web-runtime-env-tokens.md), which now owns its in-browser zod validator directly rather than referencing this ADR.

## Decision Outcome

Superseded as of 2026-04-26 by [ADR 0015](0015-backend-config.md) (backend) and [ADR 0016](0016-web-runtime-env-tokens.md) (frontend).

The idea this ADR established — zod schemas for env validation — survives in both successors. Only the file layout, env-vs-file split, and DI integration changed.
