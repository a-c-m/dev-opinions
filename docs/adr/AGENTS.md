# Architecture Decision Records

Decisions for base-app and downstream apps scaffolded from it. Each entry is a one-line hook; open the linked ADR for context, alternatives, and consequences.

ADRs are Accepted by default. A `status:` field appears only when `proposed`, `superseded by ADR-NNNN`, or `deprecated`.

> This index covers **technical decisions**. People-and-process norms (development flow, spikes, meetings, chat, career) live in [../handbook/](../handbook/).

## Format (MADR-lite)

Frontmatter (`date`, optional `decision-makers` / `tags` / `status`) → **Context** → **Decision Outcome** → **Consequences** (Positive / Negative / Neutral) → **Alternatives considered** → **Related**. Soft ~150-line cap per ADR 0037.

## Index

### Workspace & tooling

- **[0001 — pnpm](0001-package-manager.md)** — pnpm 9 sole package manager; enforced via `packageManager` + `engines.pnpm`.
- **[0002 — Node 22 LTS](0002-node-22-lts.md)** — pinned via `.nvmrc`; CI uses `actions/setup-node@v4`.
- **[0003 — TypeScript strict + tsgo](0003-typescript-strict-tsgo.md)** — TS 5.8 strict; typecheck via tsgo (`@typescript/native-preview --noEmit`); `tsc` only for `.d.ts` emission.
- **[0004 — NX monorepo](0004-nx-monorepo.md)** — NX 22 with `apps/<product>/<service>/` two-tier, `shared/*`, `tools/*`; CI runs `nx affected`; canonical script-verb alphabet (`dev` / `build` / `lint` / `typecheck` / `test*` / `e2e` / `codegen` / `db:*`) detailed in [docs/conventions/scripts.md](../conventions/scripts.md).
- **[0005 — Child code layout: `apps/` and `repos/`](0005-child-apps-and-repos.md)** — two parallel optional roots; `apps/` for workspace members, `repos/` for independent child git repos; cross-repo agent context via running at parent root.
- **[0006 — Biome + Ultracite](0006-biome-ultracite.md)** — Biome 2 + Ultracite; `biome-suppressed` (`bs`) for baseline-aware checks.
- **[0007 — Knip](0007-knip-dead-code.md)** — Knip 5 at repo root; CI-blocks new issues.
- **[0008 — Trivy](0008-trivy-security-scan.md)** — single scanner via `pnpm security`; fs/image/config; HIGH+CRITICAL fail.

### Application stack

- **[0009 — NestJS 11](0009-nestjs-backend.md)** — Fastify adapter; cross-cutting in `shared/*`.
- **[0010 — React + Vite primary](0010-frontend-frameworks.md)** — React 19 + Vite 7 SPA; SvelteKit 2 as named alternative.
- **[0011 — Drizzle ORM](0011-drizzle-orm.md)** — Drizzle with `node-postgres` (prod) + `better-sqlite3` (local); schemas in `shared/db-<domain>/`; vocabulary as `readonly` tuples; `drizzle-zod` for non-GraphQL ingress only.
- **[0012 — Vitest + Playwright](0012-vitest-playwright.md)** — Vitest for unit/integration; Playwright for E2E; no Jest.
- **[0013 — Package by feature](0013-package-by-feature.md)** — vertical-slice layout; cross-domain primitives go in type-folders (`ui/`, `gql/`); extract to shared only on second consumer.
- **[0014 — Test coverage policy](0014-test-coverage-policy.md)** — `@vitest/coverage-v8` on Vitest ≥4; single root `vitest.config.ts` with glob-keyed thresholds; `shared/*` 100/100/100 lines/functions/statements + hard-95 branches (paradox-honest, `/* v8 ignore next -- @preserve */` as escape valve); services 80/80; resolvers/controllers smoke-only via E2E; mutation testing (StrykerJS) documented as graduation.
- **[0015 — E2E structure](0015-e2e-structure.md)** — per-app `apps/<p>/<s>-e2e/` workspace package + shared `shared/e2e-helpers/`; fixtures-injected POM (bare class POM rejected); selectors live in one place; `retries: CI?2:0`, `trace: 'retain-on-failure-and-retries'` (Playwright ≥1.59); projects `local` + `stage` (+ `setup-stage` dep); `@smoke` tag drives PR / prod-smoke cadence; `staging-with-prod-auth` deferred to graduation; Stagehand opt-in under `stagehand/` per ADR 0012.

### Configuration

- **[0016 — Backend file-based config](0016-backend-config.md)** — zod schema + layered YAML (`default` → `{APP_ENV}` → `local`) + secrets-only env vars via `@shared/config`; `file()`/`secret()` helpers; branded NestJS DI tokens.
- **[0017 — Web runtime env injection](0017-web-runtime-env-tokens.md)** — `@import-meta-env/unplugin` at deploy time; byte-identical bundles; `.env.example` allowlist; in-browser zod validation.

### Data

- **[0018 — Safe database migrations](0018-safe-database-migrations.md)** — expand/contract, forward-only; Path A (auto in deploy) + Path B (operator `workflow_dispatch`) share `_db-migrate.yml`; `pg_try_advisory_lock` + `lock_timeout=3s` + `statement_timeout=15min`; programmatic `migrate()` not the CLI; Squawk PR check; N-1 + three-release column drops; backfills as separate Jobs. Runbook: [supervised-db-migrations.md](../runbooks/supervised-db-migrations.md).

### API surface

- **[0019 — API contracts & error shapes](0019-api-contracts-and-errors.md)** — class-validator on `@InputType` for GraphQL, Zod 4 for non-GraphQL boundaries; RFC 9457 Problem Details with `code`/`traceId`/`errors[]` extensions; `ApiException` + global filters in `shared/nest-errors/`; Yoga + code-first GraphQL; URL `/v1/` for REST; field-level `@deprecated` for GraphQL; `graphql-inspector` diff in CI as the lightweight contract check (Pact deferred until ≥3 consumers); four-layer per-feature shape (Drizzle / `*.input.ts` / `*.types.ts` / `*.service.ts`).
- **[0020 — Request-cycle resilience](0020-request-cycle-resilience.md)** — `@nestjs/throttler` for rate limiting (in-memory day-one, Redis storage on horizontal scale-out); layered caching = HTTP `Cache-Control`/`ETag` + React Query defaults + Postgres-as-cache via `@shared/cache`; Redis named as the graduation lever for both, not a day-one dep; 429s via standard problem-details envelope; throttle skip on `/healthz` + `/readyz`.
- **[0021 — Async work & webhooks](0021-async-work-and-webhooks.md)** — DIY Postgres-backed `jobs` table + worker loop day-one (`FOR UPDATE SKIP LOCKED` is load-bearing); Inngest as named graduation when fan-out / durable cross-deploy semantics actually arrive; webhooks-in via inbox pattern (signature verify → insert → 200; worker processes; provider event ID as dedup key); webhooks-out via transactional outbox (state change + intent-to-deliver in one TX; drain worker signs + posts; do-not-retry 4xx except 429). **Consumer registry: config day-one (`webhookConsumers` array validated at boot), `webhook_consumers` table as graduation when runtime onboarding / audit trail / dynamic filtering arrive.**
- **[0022 — Time and money](0022-time-and-money.md)** — Postgres `timestamptz` always (Drizzle `timestamp({ withTimezone: true, mode: 'date' })`); ISO 8601 with `Z` on the wire; `Date` in memory until `Temporal` stabilises; `Intl.DateTimeFormat` at the display edge; `date-fns` for calendar math, never `dayjs`/`moment`. Money as `BIGINT` minor units + `CHAR(3)` ISO 4217 currency; `@shared/money` value object with `bigint` amounts; never `number`, never `NUMERIC`; wire format `{ amountMinor: string, currency }`; `Intl.NumberFormat` for display; `decimal.js` as graduation for sub-cent math.
- **[0023 — File storage](0023-file-storage.md)** — S3 API as the contract (AWS / R2 / B2 / MinIO interchangeable via config); `@shared/storage` with `s3` + `fs` + `memory` drivers behind a single interface; MinIO in `compose.yml` is the local-dev default (exercises SigV4 + POST policy + CORS); presigned **POST** (not PUT) so `content-length-range` + `Content-Type` are enforced at the storage layer; UUID v7 + tenant prefix keys; three visibility classes (public CDN-fronted, private, shareable-private 15-min TTL); Postgres `files` + `storage_audit` tables are truth, object store is bytes; content-type detection + virus scanning + purge as Postgres-backed jobs; bucket-per-region for residency, never CRR by default; image transforms / AV deferred with explicit triggers (imgproxy / ClamAV).

### Runtime services

- **[0024 — Structured logging contract](0024-structured-logging-contract.md)** — pino 10 + `nestjs-pino`; stdout-only JSON, no in-process transports (Biome rule); local dev tees raw JSON to `.ai-wip/logs/<product>-<service>.log`; `pnpm watch-logs` for humans.
- **[0025 — Runtime observability](0025-runtime-observability.md)** — OpenTelemetry SDK with OTLP/HTTP to a local Collector (the swap point); 10% head sampling in prod; `prom-client` for runtime + OTel for app metrics; `pnpm dev:obs` brings up the full Grafana stack; advised prod ladder New Relic Free → Grafana Cloud → self-host.
- **[0026 — Secrets injection at runtime](0026-secrets-runtime-injection.md)** — entrypoint shim (vault CLI inside `ENTRYPOINT`) over platform-native; cloud-native identity (IRSA / WIF / Pod Identity); local dev = same CLI wrapping `pnpm dev`; `.env` files retired; CI OIDC-only; store agnostic with advisory ladder.
- **[0027 — Authentication](0027-authentication.md)** — `AuthProvider` interface with OIDC / managed / dev impls; `jose` direct (not `@nestjs/passport`); minimal `TokenClaims = {userId, roles}`; `AuthOutcome` discriminated union to prevent public-route bypass; JWT hardening (algorithm allow-list, `clockTolerance`, iss/aud pinning); BFF cookie default with Postgres-backed sessions; Bearer JWT graduation; entitlements off-token.
- **[0028 — Authorization](0028-authorization.md)** — `@casl/ability` v6 with a hand-rolled `AbilityFactory` (~40 LOC + tests) in `shared/authz/`; no `nest-casl` wrapper (supply-chain minimisation). Two-layer enforcement: `@CheckAbility(action, SubjectClass)` guard for role gating + `ability.can(action, loadedObject)` in services for ownership. RBAC default; ABAC via subject conditions preferred wherever ownership / tenant scope matters (accept the fetch-before-check cost; `abilityToDrizzleWhere` helper as graduation for list endpoints). Same decorator works on REST + GraphQL + WS. `<Can>` + `useCan()` from `@casl/react` for frontend UX gating (never the security boundary). `AuditService` interface defined with a no-op default; concrete Drizzle-backed impl + table when first compliance ask lands. Cerbos / OPA as policy-as-code graduation; OpenFGA / Permify as ReBAC graduation; `@auth` SDL directives deferred.
- **[0029 — Feature flags](0029-feature-flags.md)** — OpenFeature + TS registry + `InMemoryProvider` day-one; backend via wrapped `@openfeature/nestjs-sdk`; frontend via in-house `useFeatureFlag` hook (PostHog adopters bypass OpenFeature client-side); graduation ladder TS registry → Unleash → PostHog/GrowthBook/ConfigCat.

### CI / CD / releases

- **[0030 — Lefthook for git hooks](0030-lefthook.md)** — YAML runner; pre-commit (biome, knip, commitlint), pre-push (`nx affected`), commit-msg gates.
- **[0031 — GitHub repo conventions](0031-github-repo-conventions.md)** — PR template + 5 issue templates + path-based CODEOWNERS (with team-metadata comment blocks) + Conventional Commits + mandatory `#N` / `PROJ-N` ticket suffix for AI commits + staggered weekly Dependabot + SECURITY.md.
- **[0032 — GitHub Actions](0032-github-actions-ci.md)** — reusable workflows (`_` prefix) + `setup-monorepo` composite; PR CI runs `nx affected` + Trivy; OIDC-only cloud auth.
- **[0033 — OpenTofu IaC](0033-opentofu-iac.md)** — per-app `apps/<name>/iac/`; remote encrypted state; environments via `-var-file`; deploys via `_tofu-deploy.yml`.
- **[0034 — Container conventions](0034-container-conventions.md)** — single `Dockerfile` per service, four targets, `node:22-bookworm-slim`; `USER node`; `HEALTHCHECK` on `/healthz` (liveness, no DB) + `/readyz` (readiness, DB + downstreams) via `@nestjs/terminus`; `ENTRYPOINT` stacks vault → OTel → app.
- **[0035 — Branches, releases, environments](0035-branching-releases-environments.md)** — two branches (`main` + `release-candidate`); tag-driven prod with merge-back on success; hotfix from prod tag → PR into `release-candidate`; GitLab Flow + SemVer.

### Operations & security

- **[0036 — Production data flow](0036-production-data-flow.md)** — companion to 0035; three hard rules (raw prod data never leaves prod; sanitisation inside prod boundary; prod creds never reach CI / dev); decoupled snapshot/restore pipeline; SQL-level sanitisation.
- **[0040 — Incident management](0040-incident-management.md)** — SEV1–SEV4 vocabulary; blameless RCAs mandatory for SEV1/2 + recurring SEV3; declaration is channel-first (no GitHub Issue template); CODEOWNERS team-metadata = service ownership; OOH defined per fork. Ratifies [handbook/incidents.md](../handbook/incidents.md) + [runbooks/incident-response.md](../runbooks/incident-response.md) + [incidents/TEMPLATE.md](../incidents/TEMPLATE.md).

### AI agents (meta)

- **[0037 — AGENTS.md as cross-agent standard](0037-multi-agent-rule-distribution.md)** — `AGENTS.md` canonical; `CLAUDE.md` symlinked; skills in `.agents/skills/<name>/SKILL.md` with per-agent symlinks; OpenCode hook parity via plugin (best-effort).
- **[0038 — Agent harness configuration](0038-agent-harness-configuration.md)** — per-harness runtime layer (Claude Code today). Directory layout; four-tier hook philosophy (content validators, command guards, post-tool notifiers, session bootstrappers); permission model (pattern over enumeration; deny as enforcement edge); shell-script commands; memory split (project-shared → AGENTS.md, personal → harness auto-memory); session lifecycle. Complementary to 0037 (cross-agent context).
