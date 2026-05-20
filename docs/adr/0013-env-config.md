# ADR 0013: Env config via validated schema

- **Status**: Superseded
- **Date**: 2026-04-19
- **Superseded**: 2026-04-26 by [ADR 0021](0021-backend-config.md) (backend) and [ADR 0019](0019-web-runtime-env-tokens.md) (frontend).

The original pattern — per-app `src/env.ts` declaring a zod schema validated once at boot — is retired.

- **Backend services** now use the typed-schema + layered-YAML + secrets-only-env approach defined in [ADR 0021](0021-backend-config.md).
- **Web apps** continue to use [ADR 0019](0019-web-runtime-env-tokens.md), which now owns its in-browser zod validator directly rather than referencing this ADR.

The idea this ADR established — zod schemas for env validation — survives in both successors. Only the file layout, env-vs-file split, and DI integration changed.
