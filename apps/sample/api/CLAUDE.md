# sample-api

Throwaway NestJS app used to verify the workspace is wired up. It exposes a single `/health` endpoint and has a Vitest unit test.

Delete this app with `pnpm reset` once your own APIs are in place.

## Commands

```sh
pnpm --filter sample-api dev         # nest start --watch
pnpm --filter sample-api test        # vitest
pnpm --filter sample-api typecheck   # tsgo
pnpm --filter sample-api lint        # biome
```

## Env

See `src/env.ts` — zod schema validated at boot. Add new variables there, not via `process.env`.
