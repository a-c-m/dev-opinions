---
date: 2026-05-26
decision-makers: [Repo platform]
tags: [monorepo, packaging, nx, typescript, build]
---

# ADR 0039: Shared library packaging — source-mode dev, built `dist/` consumption

## Context and Problem Statement

Today every `shared/*/package.json` exports `src/index.ts` (or per-subpath `.ts`) directly:

```jsonc
// shared/auth/package.json
{
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

Source-only resolution works for the runtimes that read TypeScript directly:
- Vitest (via `vite-node`)
- `tsgo --noEmit` (typecheck)
- Claude/agents reading source

It breaks at the first attempt to **emit** an app that consumes a shared lib:

- `nest build` uses `tsc` and follows the `exports.main` into `shared/auth/src/index.ts`, which re-exports from `./oidc-auth-provider.ts` (with `.ts` extension). `tsc` rejects with `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.`
- Even with `allowImportingTsExtensions: true`, that flag requires `noEmit: true` — incompatible with `nest build`. `rewriteRelativeImportExtensions: true` only rewrites paths in files `tsc` *compiles* (i.e. the app's own sources), not files imported from `node_modules` symlinks.
- At runtime, Node can't `import` `.ts` files (Node 24's `--experimental-strip-types` is not the production deployment target).

Concretely: the sample API was unable to import `@shared/logger/nest` without crashing `nest build`. The wiring landed inline-pino instead, with a TODO pointing at this ADR.

## Decision Outcome

**Shared libs build to `dist/` and publish that as the runtime entry point. Source files remain the editable thing; consumers of source — Vitest, tsgo, agents — keep working via a parallel `customConditions: ["source"]` resolution.**

Concretely, each `shared/*/package.json`:

```jsonc
{
  "name": "@shared/<name>",
  "type": "module",
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsgo --noEmit -p tsconfig.json"
  }
}
```

With `tsconfig.build.json` per lib:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "rewriteRelativeImportExtensions": true,
    "allowImportingTsExtensions": true
  },
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

And the lib's `nx` block in `package.json` declares the build target so `nx affected` runs it on dependent app builds:

```jsonc
"nx": {
  "targets": {
    "build": { "outputs": ["{projectRoot}/dist"] }
  }
}
```

### Dev / test path — `customConditions: ["source"]`

Vitest's resolver and the root `tsconfig.base.json` add `customConditions: ["source"]`. This makes them prefer the `source` export key (raw `.ts`) over `default` (built `.js`). Result:

- `pnpm test` reads `shared/<name>/src/*.ts` directly — no build needed.
- `tsgo --noEmit` reads source for type-checking.
- `pnpm --filter sample-api dev` (`nest start --watch`) reads source via `ts-node` / `tsx` (already in the Nest stack).
- `nest build` and `node dist/main.js` (production path) follow `default` to `dist/<name>/index.js`.

### Build order

NX `targetDefaults.build.dependsOn: ["^build"]` (already set in `nx.json`) ensures shared libs build before consuming apps. `pnpm build` at the workspace root produces a consistent ordering.

### Export shape — subpath vs single-entry

Two `package.json` `exports` shapes are in active use across `shared/*`:

- **Single entry** (`shared/auth`, `shared/authz`): `exports: { ".": "./dist/index.js" }`. Consumers `import { X } from "@shared/auth"`. Re-exports everything from a top-level barrel.
- **Subpath** (`shared/logger`): `exports: { "./types": "...", "./base-options": "...", "./nest": "..." }`. Consumers `import { X } from "@shared/logger/nest"`. No top-level barrel.

**Default to single entry.** It's the simpler import shape, the conventional one, and the one Biome's `noBarrelFile` overrides already understand.

**Use subpath exports only when the lib has *distinct consumer audiences* that should be able to import a subset without paying for the other.** Concretely:

- `shared/logger` exposes a framework-neutral `base-options` surface (just pino) and a Nest-coupled `nest` surface (`nestjs-pino`). A non-Nest consumer importing `@shared/logger/base-options` should not transitively pull in `nestjs-pino`. The subpath split is the contract.
- `shared/auth` / `shared/authz` are cohesive within one domain — there's no realistic consumer that wants half of them. Single entry is correct.

When a lib grows a second audience (e.g. a CLI surface in addition to a library surface, or a framework-coupled module added alongside a framework-neutral one), promote it to subpath exports in the same PR that adds the second audience. Don't pre-split a single-audience lib speculatively.

### Watch mode

`pnpm --filter @shared/<name> build --watch` runs alongside `pnpm --filter <app> dev` for cross-package edit-rebuild. Documented in `shared/README.md`.

## Why this shape

- **Source files stay editable.** No two-step "edit → build → re-import" for dev.
- **Runtime is conventional.** `dist/<name>/index.js` is exactly what every Node CLI, container, and CI runner expects.
- **`customConditions` is a 2026 TS-native pattern.** Supported by TS ≥ 5.7 (we're on 6.0.3). Vitest 4 supports it natively via `resolve.conditions`. No bespoke aliasing.
- **Future-proof.** When a `shared/*` lib gets published to npm one day, the same `package.json` works unchanged.

## Alternatives considered

- **Status quo (source-only exports).** Works for tests and tsgo. Breaks for any `nest build` / `next build` / Node-runtime consumer. Already broke the sample API wiring.
- **swc emit in `nest-cli.json` (Daniel F-13).** swc transpiles each file independently and could emit cross-package. But swc still doesn't transpile files inside `node_modules` symlinks by default — would need careful `swcrc` includes per app. Solves the wrong problem (emit speed, not source-vs-dist resolution).
- **TS project references + composite + `tsc --build`.** Workable but heavier ceremony (each lib needs `composite: true`, `references` arrays, careful `paths` mapping). The `customConditions` approach achieves the same outcome with one config key.
- **Bundle the app (esbuild / webpack via nest build).** Bundles workspace deps into the app's `dist/main.js`. Works, but loses the "one image per service, deps visible" model and complicates SBOM / Trivy image scans.

## Consequences

### Positive
- App emit paths (`nest build`, `next build`, container CMD) work for any shared-lib consumer.
- Source-mode dev preserved for tests and watch.
- One ADR-blessed pattern across all shared libs — no per-lib bespoke shape.
- Sample API can be reverted to import `@shared/logger/nest` once `shared/logger` adopts this (see "Pilot" below).

### Negative
- One more build step in `pnpm build` (compounding via NX cache).
- Each shared lib needs a `tsconfig.build.json` + dist output.
- `dist/` directories need to be in `.gitignore` (already are via the global pattern).
- Watch-mode dev now needs `--filter @shared/<name> build --watch` running alongside the app — document this in `shared/README.md`.
- `pnpm typecheck` needs the lib built first if it consumes `@shared/*` via package exports (NX's `^build` dependency takes care of this in `pnpm check:affected`; standalone `pnpm typecheck` may need `pnpm build` first until Phase 2 lands).

## Pilot — two phases

### Phase 1 (this ADR ships with): `shared/logger` builds to `dist/`, exports point at `dist/`

Simplest viable shape. No `customConditions` yet — not needed because:
- `shared/logger`'s tests use relative imports (`./base-options.ts`), not `@shared/logger/...`, so Vitest doesn't need source resolution through package exports.
- No other shared lib currently consumes `@shared/logger`. The only consumer is the sample API, which goes through normal package resolution → `dist/`.

Acceptance for Phase 1:
1. `shared/logger/tsconfig.build.json` extends `tsconfig.json` with `noEmit: false`, `outDir: ./dist`, `declaration: true`, `rewriteRelativeImportExtensions: true`.
2. `shared/logger/package.json` `exports` keys point at `dist/<name>.js` (default) + `dist/<name>.d.ts` (types).
3. `shared/logger/package.json` has `build: tsc -p tsconfig.build.json`.
4. `shared/logger`'s `nx` block declares `build` target with `outputs: ["{projectRoot}/dist"]`.
5. Sample API reverts the inline-pino code in `apps/sample/api/src/app.module.ts` to `imports: [platformLoggerModule({ name: "sample-api", version: "0.0.0" })]`.
6. `pnpm build` (NX runs `^build` before app builds, so the lib emits first), then `pnpm --filter sample-api build` exits 0.
7. `pnpm test` exits 0 (Vitest reads source via relative imports inside the lib).
8. `pnpm typecheck` exits 0 (tsgo resolves `@shared/logger/...` to `dist/*.d.ts`; requires `pnpm build` to have run first — NX's `targetDefaults.typecheck` should declare `dependsOn: ["^build"]`, see "Consequences").

### Phase 2 (future, when a second shared lib needs it): add `customConditions: ["source"]` for cross-lib source resolution

When a `shared/*` lib starts consuming another `shared/*` lib in *test* code, or when `pnpm typecheck` needs to run without first building dependencies, add the `source` condition pattern from the "Decision Outcome" section. Until that pressure exists, the simpler Phase 1 shape is enough.

## Related ADRs

- [ADR 0004 — NX monorepo](0004-nx-monorepo.md) — workspace shape this builds on.
- [ADR 0009 — Nest emit / build](0009-nest-builder.md) — the emit path that hit the constraint.
- [ADR 0024 — Structured logging contract](0024-structured-logging-contract.md) — the contract `shared/logger` exposes (the pilot consumer of this ADR).
