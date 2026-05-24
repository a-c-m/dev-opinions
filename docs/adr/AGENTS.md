# Architecture Decision Records

Decisions for base-app and downstream apps scaffolded from it. Each entry is a one-line hook; open the linked ADR for context, alternatives, and consequences.

ADRs are Accepted by default. A `status:` field appears only when `proposed`, `superseded by ADR-NNNN`, or `deprecated`.

## Format (MADR-lite)

Frontmatter (`date`, optional `decision-makers` / `tags` / `status`) → **Context** → **Decision Outcome** → **Consequences** (Positive / Negative / Neutral) → **Alternatives considered** → **Related**. Soft ~150-line cap per ADR 0028.

## Index

### Workspace & tooling

- **[0001 — pnpm](0001-package-manager.md)** — pnpm 9 sole package manager; enforced via `packageManager` + `engines.pnpm`.
- **[0002 — Node 22 LTS](0002-node-22-lts.md)** — pinned via `.nvmrc`; CI uses `actions/setup-node@v4`.
- **[0003 — TypeScript strict + tsgo](0003-typescript-strict-tsgo.md)** — TS 5.8 strict; typecheck via tsgo (`@typescript/native-preview --noEmit`); `tsc` only for `.d.ts` emission.
- **[0004 — NX monorepo](0004-nx-monorepo.md)** — NX 22 with `apps/<product>/<service>/` two-tier, `shared/*`, `tools/*`; CI runs `nx affected`.
- **[0005 — Package script conventions](0005-package-script-conventions.md)** — fixed alphabet of verbs (`dev` / `build` / `lint` / `typecheck` / `test*` / `e2e` / `codegen` / `db:*`); `lint` writes, CI uses `lint:ci`.
- **[0006 — Biome + Ultracite](0006-biome-ultracite.md)** — Biome 2 + Ultracite; `biome-suppressed` (`bs`) for baseline-aware checks.
- **[0007 — Knip](0007-knip-dead-code.md)** — Knip 5 at repo root; CI-blocks new issues.
- **[0008 — Trivy](0008-trivy-security-scan.md)** — single scanner via `pnpm security`; fs/image/config; HIGH+CRITICAL fail.
- **[0009 — Ripgrep over grep](0009-ripgrep-over-grep.md)** — `rg` everywhere; PreToolUse hook blocks bare `grep`.

### Application stack

- **[0010 — NestJS 11](0010-nestjs-backend.md)** — Fastify adapter; cross-cutting in `shared/*`.
- **[0011 — React + Vite primary](0011-frontend-frameworks.md)** — React 19 + Vite 7 SPA; SvelteKit 2 as named alternative.
- **[0012 — Drizzle ORM](0012-drizzle-orm.md)** — Drizzle with `node-postgres` (prod) + `better-sqlite3` (local); schemas in `shared/db-<domain>/`; vocabulary as `readonly` tuples; `drizzle-zod` for non-GraphQL ingress only.
- **[0013 — Vitest + Playwright](0013-vitest-playwright.md)** — Vitest for unit/integration; Playwright for E2E; no Jest.
- **[0014 — Package by feature](0014-package-by-feature.md)** — vertical-slice layout; cross-domain primitives go in type-folders (`ui/`, `gql/`); extract to shared only on second consumer.

### Configuration

- **[0015 — Backend file-based config](0015-backend-config.md)** — zod schema + layered YAML (`default` → `{APP_ENV}` → `local`) + secrets-only env vars via `@shared/config`; `file()`/`secret()` helpers; branded NestJS DI tokens.
- **[0016 — Web runtime env injection](0016-web-runtime-env-tokens.md)** — `@import-meta-env/unplugin` at deploy time; byte-identical bundles; `.env.example` allowlist; in-browser zod validation.

### Data

- **[0036 — Safe database migrations](0036-safe-database-migrations.md)** — expand/contract, forward-only; Path A (auto in deploy) + Path B (operator `workflow_dispatch`) share `_db-migrate.yml`; `pg_try_advisory_lock` + `lock_timeout=3s` + `statement_timeout=15min`; programmatic `migrate()` not the CLI; Squawk PR check; N-1 + three-release column drops; backfills as separate Jobs. Runbook: [supervised-db-migrations.md](../runbooks/supervised-db-migrations.md).

### API surface

- **[0033 — API contracts & error shapes](0033-api-contracts-and-errors.md)** — class-validator on `@InputType` for GraphQL, Zod 4 for non-GraphQL boundaries; RFC 9457 Problem Details with `code`/`traceId`/`errors[]` extensions; `ApiException` + global filters in `shared/nest-errors/`; Yoga + code-first GraphQL; URL `/v1/` for REST; field-level `@deprecated` for GraphQL; four-layer per-feature shape (Drizzle / `*.input.ts` / `*.types.ts` / `*.service.ts`).

### Runtime services

- **[0031 — Structured logging contract](0031-structured-logging-contract.md)** — pino 10 + `nestjs-pino`; stdout-only JSON, no in-process transports (Biome rule); local dev tees raw JSON to `.ai-wip/logs/<product>-<service>.log`; `pnpm watch-logs` for humans.
- **[0032 — Runtime observability](0032-runtime-observability.md)** — OpenTelemetry SDK with OTLP/HTTP to a local Collector (the swap point); 10% head sampling in prod; `prom-client` for runtime + OTel for app metrics; `pnpm dev:obs` brings up the full Grafana stack; advised prod ladder New Relic Free → Grafana Cloud → self-host.
- **[0034 — Secrets injection at runtime](0034-secrets-runtime-injection.md)** — entrypoint shim (vault CLI inside `ENTRYPOINT`) over platform-native; cloud-native identity (IRSA / WIF / Pod Identity); local dev = same CLI wrapping `pnpm dev`; `.env` files retired; CI OIDC-only; store agnostic with advisory ladder.
- **[0037 — Authentication](0037-authentication.md)** — `AuthProvider` interface with OIDC / managed / dev impls; `jose` direct (not `@nestjs/passport`); minimal `TokenClaims = {userId, roles}`; `AuthOutcome` discriminated union to prevent public-route bypass; JWT hardening (algorithm allow-list, `clockTolerance`, iss/aud pinning); BFF cookie default with Postgres-backed sessions; Bearer JWT graduation; entitlements off-token.
- **[0035 — Feature flags](0035-feature-flags.md)** — OpenFeature + TS registry + `InMemoryProvider` day-one; backend via wrapped `@openfeature/nestjs-sdk`; frontend via in-house `useFeatureFlag` hook (PostHog adopters bypass OpenFeature client-side); graduation ladder TS registry → Unleash → PostHog/GrowthBook/ConfigCat.

### CI / CD / releases

- **[0018 — Lefthook for git hooks](0018-lefthook.md)** — YAML runner; pre-commit (biome, knip, commitlint), pre-push (`nx affected`), commit-msg gates.
- **[0019 — Conventional Commits](0019-conventional-commits.md)** — commitlint via `commit-msg`; scope = NX project name; mandatory `#<n>` / `PROJ-<n>` ticket suffix for AI commits (PreToolUse hook blocks).
- **[0020 — GitHub repo conventions](0020-github-repo-conventions.md)** — PR template + 5 issue templates + path-based CODEOWNERS + staggered weekly Dependabot + SECURITY.md.
- **[0021 — GitHub Actions](0021-github-actions-ci.md)** — reusable workflows (`_` prefix) + `setup-monorepo` composite; PR CI runs `nx affected` + Trivy; OIDC-only cloud auth.
- **[0022 — OpenTofu IaC](0022-opentofu-iac.md)** — per-app `apps/<name>/iac/`; remote encrypted state; environments via `-var-file`; deploys via `_infra-deploy.yml`.
- **[0023 — Container conventions](0023-container-conventions.md)** — single `Dockerfile` per service, four targets, `node:22-bookworm-slim`; `USER node`; `HEALTHCHECK` on `/health`; `ENTRYPOINT` stacks vault → OTel → app.
- **[0024 — Branches, releases, environments](0024-branching-releases-environments.md)** — two branches (`main` + `release-candidate`); tag-driven prod with merge-back on success; hotfix from prod tag → PR into `release-candidate`; GitLab Flow + SemVer.

### Operations & security

- **[0025 — Production data flow](0025-production-data-flow.md)** — companion to 0024; three hard rules (raw prod data never leaves prod; sanitisation inside prod boundary; prod creds never reach CI / dev); decoupled snapshot/restore pipeline; SQL-level sanitisation.
- **[0026 — Runbook and SOP format](0026-runbook-and-sop-format.md)** — shared template; co-located (`apps/<p>/<s>/runbooks|sops/`) or cross-cutting (`docs/runbooks|sops/`); kebab-case; required sections Overview / Prerequisites / Steps / Related.
- **[0027 — CODEOWNERS team metadata](0027-codeowners-team-metadata.md)** — `# key: value` comments above CODEOWNERS rule lines (`PM` + `TechLead` required when block present; optional `slack` / `alerting` / `monitoring`); extends 0020.

### AI agents (meta)

- **[0028 — AGENTS.md as cross-agent standard](0028-multi-agent-rule-distribution.md)** — `AGENTS.md` canonical; `CLAUDE.md` symlinked; skills in `.agents/skills/<name>/SKILL.md` with per-agent symlinks; OpenCode hook parity via plugin (best-effort).
- **[0029 — Claude Code config layout](0029-claude-code-setup.md)** — `.claude/` layout (agents, hooks, commands, skills, settings); `.mcp.json` (context7, playwright, chrome-devtools); hooks split into content validators and command guards. Claude-specific impl; cross-agent parts superseded by 0028.
- **[0030 — Child code layout: `apps/` and `repos/`](0030-child-apps-and-repos.md)** — two parallel optional roots; `apps/` for workspace members, `repos/` for independent child git repos; cross-repo agent context via running at parent root.

### Superseded

- **[0017 — Env config via validated schema](0017-env-config.md)** — *Superseded by [0015](0015-backend-config.md) (backend) and [0016](0016-web-runtime-env-tokens.md) (frontend).* Original per-app `src/env.ts` zod schema pattern retired; zod-for-env idea survives in both successors.
