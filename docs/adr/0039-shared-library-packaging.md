---
date: 2026-05-26
amended: 2026-05-26
decision-makers: [Repo platform]
tags: [monorepo, packaging, nx, typescript, build]
---

# ADR 0039: Shared library packaging — source-mode dev, built `dist/` consumption

## Status

**Accepted** (2026-05-26). Amended same day to remove the Phase 1 / Phase 2 hedge — see [Why amended](#why-amended).

## Context and Problem Statement

Originally every `shared/*/package.json` exported `src/index.ts` (or per-subpath `.ts`) directly:

```jsonc
// shared/auth/package.json (pre-ADR)
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

## Decision

**Every runtime shared lib MUST ship a built `dist/` and declare the `customConditions: ["source"]` resolution path for source-mode dev. Pure-type shared libs (no runtime emission) are carved out explicitly.**

A lib is **runtime** if its `src/` exports anything other than types / interfaces / type aliases — i.e. any `class`, `function`, `const`, decorator, NestJS module, etc. that emits to JavaScript.

A lib is **pure-type** if its `src/` exports *only* type-level constructs. Pure-type libs have no JS to emit; consumers only need `.d.ts`. They keep the source-only `exports` shape and do not build.

Current classification (as of this ADR amendment):

| Lib | Classification | Notes |
|---|---|---|
| `shared/auth` | Runtime | Classes (`OidcAuthProvider`, `DevAuthProvider`, …), factory function |
| `shared/authz` | Runtime | NestJS module, guard, decorator, factory |
| `shared/flags` | Runtime | `export const flags = {}` is a runtime value (even if empty today) |
| `shared/logger` | Runtime | Pino options, NestJS module |
| `shared/config` | Pure-type | Stub: only `interface` / `type` exports |
| `shared/contracts` | Pure-type | Stub: only `type` / `interface` exports |
| `shared/nest-errors` | Pure-type | Stub: only `interface` exports (real impl will flip this to runtime) |
| `shared/nest-versioning` | Pure-type | Stub: only `interface` exports (real impl will flip this to runtime) |

When a pure-type lib gains its first runtime export, it migrates to the runtime shape in the same PR.

### Runtime libs — `package.json` shape

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
    "typecheck": "tsgo --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:cov": "vitest run --coverage",
    "test:watch": "vitest",
    "lint": "bs check --write ."
  },
  "nx": {
    "projectType": "library",
    "targets": {
      "build": { "outputs": ["{projectRoot}/dist"] }
    },
    "tags": ["scope:shared", "type:lib"]
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
    "rewriteRelativeImportExtensions": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

The lib's own `tsconfig.json` carries `allowImportingTsExtensions: true` + `noEmit: true` so the lib's source-mode typecheck and the source-condition consumers can keep the `.ts` import extensions.

### Pure-type libs — `package.json` shape

```jsonc
{
  "name": "@shared/<name>",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsgo --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:cov": "vitest run --coverage",
    "test:watch": "vitest",
    "lint": "bs check --write ."
  }
}
```

No `build` script (nothing to build). A pure-type lib's `index.ts` MUST NOT re-export with `.ts` extensions and MUST NOT import a runtime value from another package — the moment it does, it becomes runtime and follows the runtime shape.

### Source condition — `customConditions: ["source"]`

`tsconfig.base.json` declares `customConditions: ["source"]`. Every leaf inherits it. This makes `tsgo` (and any consumer using the base tsconfig) prefer the `source` export key (raw `.ts`) over `default` (built `.js`) when resolving `@shared/*`. Result:

- `pnpm typecheck` reads `shared/<name>/src/*.ts` directly — no prior `pnpm build` required.
- `tsgo --noEmit` in every leaf resolves cross-package imports to source.
- `pnpm --filter sample-api dev` (`nest start --watch`) reads source via `ts-node` / `tsx`.
- `nest build` (emit mode) follows `default` to `dist/<name>/index.js` — its tsconfig drops the `source` condition.
- Production `node dist/main.js` resolves `default` via Node's standard module resolution.

Vitest is given `resolve.conditions: ["source"]` in the root `vitest.config.ts` so test runs read source directly without a build step.

### Build order

NX `targetDefaults.build.dependsOn: ["^build"]` (already set in `nx.json`) ensures shared libs build before consuming apps for the *emit* path. `pnpm build` at the workspace root produces a consistent ordering. `pnpm typecheck` does NOT depend on `^build` because the `source` condition routes typecheck directly to source.

### Export shape — subpath vs single-entry

Two `package.json` `exports` shapes are in active use across `shared/*`:

- **Single entry** (most libs): `exports: { ".": { source, types, default } }`. Consumers `import { X } from "@shared/<name>"`. Re-exports everything from a top-level barrel.
- **Subpath** (`shared/logger`): `exports: { "./types": "...", "./base-options": "...", "./nest": "..." }`. Consumers `import { X } from "@shared/logger/nest"`. No top-level barrel.

**Default to single entry.** Promote to subpath exports only when the lib has *distinct consumer audiences* that should be able to import a subset without paying for the other (e.g. `shared/logger`'s framework-neutral `base-options` vs Nest-coupled `nest` surface). Don't pre-split a single-audience lib speculatively.

### Watch mode

`pnpm --filter @shared/<name> build --watch` runs alongside `pnpm --filter <app> dev` for cross-package edit-rebuild *when an app's emit path is what's being exercised*. For tests and typecheck, the source condition removes the need for watch-rebuild entirely.

## Why amended

The original draft of this ADR shipped Phase 1 (build to `dist/`) and deferred Phase 2 (`customConditions: ["source"]`) "until pressure from a second shared lib." That hedge was wrong on the day it shipped:

1. The second consumer already existed — `apps/sample/api` imports `@shared/logger/nest` and `@shared/logger/base-options`. The trigger condition for Phase 2 had already fired.
2. Without `customConditions: ["source"]`, a fresh `pnpm typecheck` against `@shared/*` required `pnpm build` first — undeclared work, contradicting the "source-mode dev" half of the ADR title.
3. Hedging the rollout left 7 of 8 shared libs declaring `"main": "src/index.ts"` and re-exporting via `.ts` extensions. The next service that imported any of them under `nest build` was guaranteed to hit `TS5097` — the exact failure this ADR was written to prevent.

The convergent C-2 finding in the 2026-05-26 cross-persona review surfaced (1)–(3) together. Decision: promote to a single accepted pattern, roll it out across all runtime libs in one PR, carve out pure-type stubs explicitly.

## Why this shape

- **Source files stay editable.** No two-step "edit → build → re-import" for dev.
- **Runtime is conventional.** `dist/<name>/index.js` is exactly what every Node CLI, container, and CI runner expects.
- **`customConditions` is a 2026 TS-native pattern.** Supported by TS ≥ 5.7 (we're on 6.0.3). Vitest 4 supports it natively via `resolve.conditions`. No bespoke aliasing.
- **Future-proof.** When a `shared/*` lib gets published to npm one day, the same `package.json` works unchanged.
- **One shape for the runtime tier; no per-lib bespoke variants.** The pure-type carve-out is mechanical (does the source emit JS?) and survives `pnpm typecheck` on its own merits.

## Alternatives considered

- **Status quo (source-only exports).** Works for tests and tsgo. Breaks for any `nest build` / `next build` / Node-runtime consumer. Already broke the sample API wiring.
- **Ship Phase 1 only, defer the source condition.** What the previous draft of this ADR did. Failed on day one — see [Why amended](#why-amended).
- **swc emit in `nest-cli.json`.** swc transpiles each file independently and could emit cross-package. But swc still doesn't transpile files inside `node_modules` symlinks by default — would need careful `swcrc` includes per app. Solves the wrong problem (emit speed, not source-vs-dist resolution).
- **TS project references + composite + `tsc --build`.** Workable but heavier ceremony (each lib needs `composite: true`, `references` arrays, careful `paths` mapping). The `customConditions` approach achieves the same outcome with one config key.
- **Bundle the app (esbuild / webpack via nest build).** Bundles workspace deps into the app's `dist/main.js`. Works, but loses the "one image per service, deps visible" model and complicates SBOM / Trivy image scans.

## Consequences

### Positive
- App emit paths (`nest build`, `next build`, container CMD) work for every runtime shared-lib consumer.
- Source-mode dev preserved for tests, typecheck, and watch — no `pnpm build` required before `pnpm typecheck`.
- One ADR-blessed pattern across all runtime shared libs — no per-lib bespoke shape.
- Pure-type stubs stay simple; they migrate to runtime in the same PR that adds runtime code.
- The convention is machine-checkable via `scripts/check-shared-conventions.mjs`, which `pnpm check` runs.

### Negative
- One more build step per runtime lib in `pnpm build` (compounding via NX cache).
- Each runtime shared lib needs a `tsconfig.build.json` + dist output.
- `dist/` directories need to be in `.gitignore` (already are via the global pattern).
- Watch-mode dev across the *emit* path needs `--filter @shared/<name> build --watch` running alongside the app — documented in `shared/README.md`. Tests and typecheck don't need it.
- Promoting a pure-type stub to runtime is a small but deliberate ceremony — adds `tsconfig.build.json`, `dist` exports keys, `build` script. The gate script flags the moment that's needed.

## Acceptance

This ADR is accepted when every condition holds:

1. Every runtime shared lib (`shared/auth`, `shared/authz`, `shared/flags`, `shared/logger`) declares the runtime `exports` shape with `source` / `types` / `default` keys and ships a `build` script.
2. Every pure-type shared lib declares the source-only `exports` shape and omits `build`.
3. `tsconfig.base.json` declares `customConditions: ["source"]`.
4. Root `vitest.config.ts` declares `resolve.conditions: ["source"]`.
5. `scripts/check-shared-conventions.mjs` exists, walks `shared/*/package.json`, enforces the per-classification contract, and is wired into `pnpm check`.
6. `pnpm typecheck` succeeds on a clean tree with no prior `pnpm build`.
7. `pnpm build` succeeds and produces `dist/` for every runtime lib.
8. `pnpm test` succeeds and runs against every lib (no silent skips).

## Related ADRs

- [ADR 0004 — NX monorepo](0004-nx-monorepo.md) — workspace shape this builds on.
- [ADR 0009 — Nest emit / build](0009-nest-builder.md) — the emit path that hit the constraint.
- [ADR 0014 — Coverage baseline](0014-coverage-baseline.md) — the coverage policy applied to `shared/**`.
- [ADR 0024 — Structured logging contract](0024-structured-logging-contract.md) — the contract `shared/logger` exposes (the pilot consumer of this ADR).
