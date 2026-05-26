# sample-web

Throwaway React + Vite app used to verify the workspace is wired up. It renders a page with a counter and has both a Vitest component test and a Playwright smoke test.

Delete this app with `pnpm reset` once your own frontends are in place.

## Commands

```sh
pnpm --filter sample-web dev         # vite dev server
pnpm --filter sample-web test        # vitest component tests
pnpm --filter sample-web-e2e e2e     # playwright smoke (sibling package per ADR 0015)
pnpm --filter sample-web typecheck   # tsgo
pnpm --filter sample-web lint        # biome
```

## Env

See `src/env.ts` — zod schema validated against `import.meta.env`. Add new variables there, not inline.
