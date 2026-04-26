# shared

Reusable libraries consumed by `apps/*`. Each package here is a workspace
member (`pnpm-workspace.yaml` globs `shared/*`) and is imported by its
package name (e.g. `@shared/logger`).

Typical occupants:

- `@shared/logger` — structured logger wrapper.
- `@shared/env-config` — zod-validated env loader for server apps; web apps
  pair the same zod pattern with `@import-meta-env/unplugin` (ADRs 0013 and 0019).
- `@shared/auth` — cross-app authentication helpers.
- `@shared/ui` — shared React/Svelte components.

## Adding a package

```sh
pnpm nx g @nx/js:library <name> --directory=shared/<name>
```

Then expose public API from `src/index.ts` and consume in apps via
`"@shared/<name>": "workspace:*"` in their `package.json`.

## Conventions

- Each package exposes a single `src/index.ts` barrel; deep imports are
  discouraged.
- Strict TypeScript, no `any`, no re-exported third-party types where a
  domain type would do.
- Tests live alongside source as `*.spec.ts` or `*.test.ts` and run via
  Vitest (see ADR 0008).
