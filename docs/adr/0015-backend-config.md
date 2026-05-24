---
date: 2026-04-26
decision-makers: [Backend platform]
tags: [backend, nestjs, nest-commander, configuration, secrets]
---

# ADR 0015: Typed file-based config with secrets-only env vars (backend)

**Supersedes**: [ADR 0017](0017-env-config.md) (per-app `src/env.ts` zod schema). The previous pattern is retired for backend services; web apps continue to use [ADR 0016](0016-web-runtime-env-tokens.md), which owns its in-browser zod validator directly.

## Context and Problem Statement

Backend services (HTTP APIs, workers, CLIs) need configuration that is:

1. **Visible and diffable** — a developer landing on the repo should be able to read a file and understand what the service expects. Spreading 40+ values across orchestrator-injected env vars makes this nearly impossible and turns code review of config changes into archaeology.
2. **Consistent across environments** — `git diff config/stage.yaml config/production.yaml` should immediately show what differs between environments. Env-var-only config gives no such artifact.
3. **Type-safe** — config access should be checked at compile time, with autocomplete and refactor-safety. `config.get('database.host')` returning `unknown` is not acceptable.
4. **Validated at boot** — invalid or missing config should fail the process at startup with a clear error, never at the first request hours later.
5. **Secret-bounded for incident response** — when a secret store is breached (Vercel 2025, Heroku/Codecov 2021, CircleCI 2023), every env var on the affected platform is potentially compromised and must be rotated. The smaller and more obvious the env-var-secret surface is, the faster and more confident the rotation. Mixing 200 non-secrets with 8 secrets in one env-var bag forces "rotate everything to be safe."
6. **Easy for local development** — `git clone && copy template && fill secrets && run` should be the entire workflow. No shell-export rituals across multiple terminals.
7. **Idiomatic in NestJS** — primary technology is NestJS HTTP services and nest-commander CLI tools. Config should be injectable via DI, work in both contexts, and play nicely with `Test.createTestingModule()` overrides.

The same loader must also work as a plain function call for non-Nest scripts, lambdas, and worker processes.

### Why not env-vars-only ("12-factor strict")

The 12-factor argument for env-vars-only is sound for *small* services. It breaks down at scale:

- A 50+ variable env block in an ECS task definition or `docker-compose.yml` is unreadable.
- There's no version-controlled artifact showing how stage differs from production.
- Code reviewers can't diff config changes alongside code changes.
- The orchestrator becomes the single source of truth for a thing that should be in the repo.

The 12-factor concern is really about *secrets and environment-specific values not being baked into immutable artifacts*. That concern is fully addressed by keeping secrets in env vars and reading non-secret files at process start (not build time). The artifact remains immutable; the values are still injected at runtime; we get the file-based ergonomics on top.

### Why not `@nestjs/config` alone

`@nestjs/config` provides the DI lifecycle but is env-var-centric. Its `ConfigService.get('a.b.c')` API is still string-path-typed, and its layering story for YAML files requires manual `load:` callbacks. We use its lifecycle plumbing (it solves real problems: async init, testing overrides, module registration) but own the schema and loading semantics.

### Why not `node-config`

Singleton with import-time side effects, no schema validation, opaque YAML precedence rules (notably: env vars beat `local.yaml` despite appearing later in the documented order — a perennial footgun), and `IConfig.get()` returns `unknown`. The file-based model is right; this implementation of it is not.

## Decision Outcome

Adopt a **typed schema + layered YAML files + secrets-only env vars** approach, with a thin NestJS adapter module for DI integration. Implementation lives in a shared package (`@shared/config`).

### Core principles

1. **Zod schema is the single source of truth** for config shape, types, defaults, env-var names, and secret/non-secret classification.
2. **Non-secret values live in version-controlled YAML files.** Secrets live exclusively in env vars.
3. **Schema-level enforcement of the secret/file split.** A secret value appearing in any committed YAML file fails CI lint and (as a safety net) boot.
4. **Permissive `local.yaml` with warning** — for dev DX, `local.yaml` (gitignored, dockerignored) may override anything including secrets, but boot logs a warning naming each secret it overrode. Visibility without friction.
5. **Validate at boot, fail fast** — the process refuses to start if config is invalid; the error tells the developer exactly what's wrong.
6. **DI-first integration in NestJS** — config is injected via branded tokens (whole-config and per-section), never pulled from a global. The same loader works as a plain function for non-Nest code.
7. **Async loader from day one** — the loader returns `Promise<Config>` to accommodate remote secret sources (Vault, AWS Secrets Manager, etc.) without a future breaking change.

### Schema shape

A single `config/schema.ts` per service declares the entire config surface. **Top-level keys must be objects (sections).** Bare scalars at the top level are rejected by the schema helper — every value belongs to a named section. This keeps the DI surface clean (every section is an injectable token) and avoids the "where do I put this scalar" decision creeping in over time.

```ts
import { z } from "zod";
import { defineConfig, file, secret, type InferConfig } from "@shared/config";

export const ConfigSchema = defineConfig({
  http: {
    port: file(z.coerce.number().int().positive()).default(8000),
    host: file(z.string()).default("0.0.0.0"),
  },

  database: {
    host: file(z.string()),
    port: file(z.coerce.number().int()),
    user: file(z.string()),
    password: secret("DB_PASSWORD", z.string().min(1)),
    ssl: file(z.coerce.boolean()).default(false),
  },

  thirdPartyService: {
    url: file(z.string().url()),
    apiKey: secret("THIRD_PARTY_API_KEY", z.string().min(1)),
  },
});

export type Config = InferConfig<typeof ConfigSchema>;
export type DatabaseConfig = Config["database"];
```

- `file(z.…)` — sourced from YAML files only. Env vars are never consulted for these fields, so unrelated environment exports (e.g. a stray `DATABASE_HOST` in a developer's shell) cannot interfere.
- `secret("ENV_VAR", z.…)` — sourced from `process.env.ENV_VAR` only. May appear in `local.yaml` as a dev-only override (warning logged); appearing in `default.yaml` or any `{APP_ENV}.yaml` is an error.
- The schema is the **rotation list**: `rg "secret\(" config/` returns every secret the service uses.

### File layout

```
config/
  default.yaml          # base values, version controlled
  development.yaml      # APP_ENV=development overrides (often empty)
  stage.yaml            # APP_ENV=stage overrides
  production.yaml       # APP_ENV=production overrides
  local.yaml            # gitignored + dockerignored, dev-only personal overrides
  local.example.yaml    # committed template showing non-secret shape
  schema.ts             # the single source of truth
.env.example            # committed list of secret env-var names + placeholder values
.env                    # gitignored, dev-only secret values
```

### Environment discriminator: `APP_ENV`, not `NODE_ENV`

`NODE_ENV` is reserved for the JS-ecosystem convention: many libraries (React, Express, parts of Node) gate optimisations on `NODE_ENV === "production"`. Using it as the deploy-environment discriminator (e.g. `NODE_ENV=stage`) silently disables those optimisations everywhere except prod.

Treat them as separate concepts:

- `NODE_ENV ∈ { development, production }` — controls library prod-mode behaviour. Set to `production` everywhere except local dev/test.
- `APP_ENV ∈ { development, stage, production }` — selects which `config/{APP_ENV}.yaml` overlay to load. The loader keys file selection on `APP_ENV` only.

In production deploys: `NODE_ENV=production`, `APP_ENV=production`. In stage: `NODE_ENV=production`, `APP_ENV=stage`. Locally: both `development`.

### Loading semantics

The loader is async (`loadConfig(schema, opts?) => Promise<Config>`). Steps, in order:

1. Read `config/default.yaml` (required).
2. If `config/{APP_ENV}.yaml` exists, deep-merge over the base.
3. If `config/local.yaml` exists, deep-merge over that.
4. **Secrets-in-committed-files check**: if any `secret()` field is present in `default.yaml` or `{APP_ENV}.yaml`, fail with the field path and file name. `local.yaml` is exempt (warning logged instead of failure). This is a safety net — the static lint (see Implementation plan) catches it earlier.
5. For every `secret()` field, read `process.env[VAR]`. If unset and the schema marks it required, fail.
6. Validate the merged result with the zod schema.
7. On any failure, reject the promise (or exit non-zero in CLI usage) with a formatted error.

**Precedence per field kind:**

- `file()` fields: `local.yaml > {APP_ENV}.yaml > default.yaml`. Env is never read.
- `secret()` fields: `process.env > local.yaml (dev only) > error`. YAML files other than `local.yaml` are never read for secrets.

Single source per field, no cross-source contention.

### Deep-merge semantics

- **Objects**: recursively merged.
- **Arrays**: replaced (not concatenated). Same as the de-facto industry behaviour.
- **`null`**: explicit override to `null`. The schema decides if this is valid (via `.nullable()`).
- **Omitted key**: falls through to the next layer; ultimately the schema's `.default()`. **Deletion of a previously-set key is not supported** — to revert, omit the key from your override layer.

These rules are documented in the loader's docstring and unit-tested. They are the rules `node-config` notoriously gets wrong.

### NestJS integration

`@shared/config` exports a thin module wrapping the loader and providing **branded** DI tokens. Token types are inferred from the schema — consumers do not write type annotations, and renaming a section in the schema produces a typecheck error at every consumer.

```ts
// app.module.ts
import { ConfigModule } from "@shared/config";
import { ConfigSchema } from "./config/schema.js";

@Module({
  imports: [
    ConfigModule.forRootAsync({ schema: ConfigSchema }),
    // ...
  ],
})
export class AppModule {}
```

```ts
// database.service.ts
import { configToken, InjectConfig } from "@shared/config";
import { ConfigSchema } from "../config/schema.js";

const DATABASE_CONFIG = configToken(ConfigSchema, "database");

@Injectable()
export class DatabaseService {
  constructor(
    @InjectConfig(DATABASE_CONFIG) private readonly config,
  ) {}
}
```

- `configToken(schema, sectionName)` returns a branded token typed as `unique symbol & { __type: Section }`, where `Section` is inferred from the schema and the section key. You cannot create a token for a non-existent section — it's a typecheck error.
- `@InjectConfig(token)` reads the brand and types the constructor parameter automatically. No `: DatabaseConfig` annotation required, no drift possible between the token and what's injected.
- A whole-config token is exported for code that genuinely needs cross-section access; per-section is the default.

### nest-commander integration

Identical pattern. The CLI bootstrap uses `CommandFactory.run(AppModule)`; `ConfigModule` is in `AppModule`'s imports; commands inject the same tokens. No HTTP context required, no special CLI mode in the loader. CLIs that need different config (e.g. an admin tool with extra credentials) declare a separate schema and module.

### Non-Nest usage

```ts
import { loadConfig } from "@shared/config";
import { ConfigSchema } from "./config/schema.js";

const config = await loadConfig(ConfigSchema);
// fully typed, validated
```

Same loader, no DI overhead. For lambdas, scripts, workers.

### Test mode

The loader accepts a `source` discriminated union to bypass file I/O in tests:

```ts
loadConfig(ConfigSchema, {
  source: { kind: "object", data: { database: { host: "test", /* ... */ } } },
});
```

`ConfigModule.forRootAsync({ schema, source })` accepts the same option, so `Test.createTestingModule()` can supply a fixture object at module construction:

```ts
const moduleRef = await Test.createTestingModule({
  imports: [
    ConfigModule.forRootAsync({
      schema: ConfigSchema,
      source: { kind: "object", data: testFixture },
    }),
  ],
}).compile();
```

Per-section tokens are derived from that object exactly as if it had come from files. `overrideProvider(DATABASE_CONFIG).useValue({...})` still works for replacing one section after init.

The default source is `{ kind: "files" }`. Test code never touches the filesystem, no fixture YAML files are required.

### Local dev workflow

1. `git clone <repo>`
2. `cp config/local.example.yaml config/local.yaml` (optional — for non-secret overrides)
3. `op signin` (once per machine — or the equivalent for your chosen vault CLI)
4. `pnpm dev` — the `dev` script wraps `op run --env-file=.env.example -- …` so secrets are injected at process start; no `.env` file is ever written to disk. See [ADR 0034](0034-secrets-runtime-injection.md).

Boot logs (dev):

```
[ConfigModule] Loaded config from default.yaml + development.yaml + local.yaml
[ConfigModule] Secrets from op run -- (10 keys injected from 1Password "base-app dev" vault)
[ConfigModule] WARNING: secret 'database.password' was overridden by local.yaml (acceptable in dev only)
```

### Docker workflow

`local.yaml` is gitignored *and* listed in `.dockerignore`. It cannot be copied into a built image. Therefore:

- **Local docker-compose dev**: mount `./config/local.yaml:/app/config/local.yaml:ro` in the dev compose file.
- **Stage / production images**: `local.yaml` simply does not exist in the container; the loader skips step 3 silently. This is the *structural* enforcement of "local.yaml is dev-only" — no `APP_ENV` guard required, the file isn't there to read.

Secrets reach containers via the entrypoint-shim CLI per [ADR 0034](0034-secrets-runtime-injection.md): a vault agent (`infisical run --` / `op run --` / etc.) runs inside the container at process start, authenticates as the workload, exports env vars, and `exec`s the app. `@shared/config` then reads `process.env` as normal.

## Consequences

### Positive

- **Visible, diffable, reviewable config** in version control.
- **Tiny, explicit env-var surface = clear rotation surface** when a secret store is breached. `rg "secret\(" config/` enumerates every secret in seconds.
- **Compile-time safety + boot-time validation** — most config bugs are caught before they reach production; the rest fail loudly at startup.
- **Schema enforces the secret/file boundary** — a developer cannot accidentally commit a secret to `default.yaml`. CI lint blocks the push, boot fails as a safety net.
- **Per-section DI injection** in NestJS — services depend only on the config they need, narrower types, simpler tests.
- **Branded tokens prevent drift** — token type ↔ schema section is enforced at compile time; renaming a section produces a typecheck error at every consumer.
- **Same loader** for HTTP apps, nest-commander CLIs, lambdas, scripts.
- **Excellent local DX** — copy template, fill secrets, run.
- **Test mode without fixture files** — `source: { kind: 'object', data: ... }` keeps tests in-memory and explicit.
- **Async-by-design** — remote secret sources can be added without a breaking change.
- **`NODE_ENV` left alone** — library prod-mode optimisations behave correctly in stage and production.

### Negative

- **Custom shared package to maintain** — though it's small (mostly thin glue around zod, js-yaml, @nestjs/config).
- **Two places to look for "where does this value come from"** — files for non-secrets, env for secrets. The schema makes it unambiguous, but it's still two places.
- **`local.yaml` permissiveness allows dev/prod drift** if devs aren't careful. The dockerignore + boot-time warning are the mitigations; a stricter mode could be introduced later if abuse appears.
- **Adopters need to learn the `file()` / `secret()` distinction.** One concept; covered by docs and a single example schema.
- **Two environment variables (`NODE_ENV` + `APP_ENV`)** — slightly more to remember than just `NODE_ENV`. Trade-off accepted to avoid breaking library prod-mode behaviour.

### Neutral

- **`APP_ENV` must be set explicitly outside development.** The loader logs which environment it loaded.
- **Schema lives per-service**, not centralised. Right call: each service has different config; centralising would create coupling.

## Alternatives considered

### 1. `@nestjs/config` alone (no custom schema layer)


- **Pro**: Zero custom code, well-documented, Nest-native.
- **Con**: Env-var-centric; YAML loading requires manual `load:` callbacks per file with no layering helper; `ConfigService.get('a.b.c')` is string-path even with strict typing; no enforcement of the secret/file split. We'd write the same helpers anyway, just less coherently. Rejected as a complete solution; *adopted as the underlying lifecycle mechanism*.

### 2. `node-config`

- **Pro**: Familiar, layered YAML, widely used and actively maintained.
- **Con**: Singleton with import-time I/O; opaque precedence rules (env vars beat `local.yaml` despite documented order — a known footgun); no schema validation; `IConfig.get()` returns `unknown`. The file-based model is right; this implementation is not. Rejected.

### 3. `convict` (Mozilla)

- **Pro**: Schema-based, mature, supports layering.
- **Con**: Its own DSL for schemas in a project that already standardises on zod; less idiomatic in TS; smaller ecosystem than zod-based tooling. Rejected on consistency grounds.

### 4. `t3-env` / `znv`

- **Pro**: Zod-based, type-safe, popular.
- **Con**: Designed for env-var-only flat structures; doesn't address file layering, the secret/file boundary, or NestJS DI integration. Solves a strictly smaller problem. Rejected.

### 5. Env-vars-only (strict 12-factor)

- **Pro**: Smallest possible loader.
- **Con**: Loses everything in the Context section: no diffable artifact, no review-friendly changes, env block sprawl, no rotation-surface clarity. Rejected.

### 6. JSON instead of YAML

- **Pro**: Native parser; no `js-yaml` dependency; no YAML quirks (1.1 vs 1.2, the Norway problem, etc.).
- **Con**: No comments, worse for human authoring of nested structures. Worth revisiting if YAML quirks bite us, but YAML wins on DX today.

### 7. SOPS-encrypted secrets in repo

- **Pro**: Single source of truth in git; per-environment diffs include secret rotations; no separate secrets manager.
- **Con**: Requires KMS setup per environment; "who can decrypt" becomes an access-control question we'd rather leave to the secrets manager; rotation surface is now files + KMS keys instead of one env-var bag. Reconsider when we have a KMS dependency for other reasons.

### 8. Reuse the per-app `src/env.ts` pattern from retired ADR 0017

- **Pro**: Already established; minimal new code.
- **Con**: Doesn't address file layering, env-block sprawl, or rotation-surface clarity. ADR 0017 explicitly listed "publish a shared env-config package" as a follow-up — this ADR is that follow-up, expanded.

## Implementation plan

1. **Build the shared package** (`@shared/config`):
   - `defineConfig`, `file`, `secret`, `InferConfig` helpers wrapping zod
   - `loadConfig(schema, opts?) => Promise<Config>` portable async loader
   - `configToken(schema, section)` branded-token factory + `@InjectConfig` decorator
   - `ConfigModule.forRootAsync({ schema, source? })` NestJS adapter
   - Deep-merge with documented array-replace + null-override semantics
   - Test source via `{ kind: 'object', data }`
2. **Static lint (primary defence)**: a precommit/CI check that parses every committed `config/*.yaml` against its sibling schema and fails on any `secret()` field present. The boot-time check (step 4 of Loading semantics) is the safety net.
3. **CI config validation**: CI runs `loadConfig(schema, { source: { kind: 'files', stubSecrets: true } })` against each `default.yaml + {APP_ENV}.yaml` pair. `stubSecrets` tells the loader to skip `secret()` field reads (CI doesn't have prod secrets), so only `file()` validation runs. Catches invalid YAML before deploy.
4. **Pilot on `apps/sample-api`**. Migrate its config to the new schema; verify boot, tests, docker-compose dev workflow.
5. **Pilot on a nest-commander CLI** once one exists. Verify the CLI bootstrap path works without HTTP context.
6. **Document the migration recipe** in `docs/development/`.
7. **Roll out to remaining services** incrementally — each migration is independent.
8. **Retire the legacy `src/env.ts` pattern** once all services have migrated; ADR 0017's status is already Superseded as of this ADR.

## References

- [zod](https://zod.dev/) — schema and validation
- [@nestjs/config](https://docs.nestjs.com/techniques/configuration) — DI lifecycle (used as the underlying mechanism)
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML parsing
- [nest-commander](https://nest-commander.jaymcdoniel.dev/) — CLI framework
- [12-factor: Config](https://12factor.net/config)
- [ADR 0010](0010-nestjs-backend.md) — NestJS as the default backend framework
- [ADR 0016](0016-web-runtime-env-tokens.md) — frontend counterpart (browser env injection + zod validation)
