# Architecture Decision Records

Records of significant technical decisions for base-app and downstream
apps scaffolded from it.

This index is designed to be **read on its own**: each entry contains
enough of the decision that an agent (or a human) gets the gist
without opening the file. Open the linked ADR when you need the
context, the alternatives that were rejected, or the consequences.

ADRs are Accepted by default. A `status` field on an ADR declares Proposed, Superseded, or Deprecated.

## Format

Each ADR follows the MADR-lite shape:

- **Frontmatter** — `date`, optional `decision-makers`, optional `tags`. A `status:` field appears only when the ADR is `proposed`, `superseded by ADR-NNNN`, or `deprecated`; absence = Accepted.
- **Context and Problem Statement** — the situation that prompts the decision.
- **Decision Outcome** — what we decided.
- **Consequences** — Positive / Negative / Neutral.
- **Alternatives considered** — what else was on the table and why rejected.
- **Relationship to prior ADRs** and **References** as needed.

## Index

### Workspace & tooling

- **[0001 — Package manager: pnpm](0001-package-manager.md)** — *Accepted*
  — Adopt pnpm 9 as the sole package manager; enforce via `packageManager` field and `engines.pnpm`; workspaces declared in `pnpm-workspace.yaml`.
- **[0002 — Node 22 LTS](0002-node-22-lts.md)** — *Accepted*
  — Pin Node 22 LTS to exact patch in `.nvmrc`; declare `engines.node >=22.0.0`; CI uses `actions/setup-node@v4` with `node-version-file: .nvmrc`.
- **[0003 — TypeScript strict + tsgo](0003-typescript-strict-tsgo.md)** — *Accepted*
  — Use TypeScript 5.8.x with `strict: true` plus extra `noUnused*` flags; typecheck via tsgo (`@typescript/native-preview --noEmit`); keep `tsc` only for `.d.ts` emission.
- **[0004 — NX for monorepo orchestration](0004-nx-monorepo.md)** — *Accepted*
  — NX 22.6.5 with `apps/*`, `shared/*`, `tools/*` layout (apps in practice are two-tier `apps/<product>/<service>/`); CI runs `nx affected`; independent per-project releases via `nx release`.
- **[0005 — Package script conventions](0005-package-script-conventions.md)** — *Accepted*
  — Fixed alphabet of script verbs (`dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test{,:cov,:watch,:int*}`, `e2e`, `codegen`, `db:*`) so `nx run-many` works without flag-juggling. `lint` writes; CI uses `lint:ci`.
- **[0006 — Biome + Ultracite for lint/format](0006-biome-ultracite.md)** — *Accepted*
  — Single tool: Biome 2.2.6 + Ultracite 5.4.5, wrapped by `biome-suppressed` (`bs` CLI) for baseline-aware checks. `lint` writes, `lint:check` reads, `lint:ci` blocks improvements without baseline update.
- **[0007 — Knip for dead-code detection](0007-knip-dead-code.md)** — *Accepted*
  — Knip ^5.62 at repo root for unused files/exports/types/deps; CI-blocking, driven by NX entry points.
- **[0008 — Trivy vulnerability scanning](0008-trivy-security-scan.md)** — *Accepted*
  — Trivy (Aqua) as the single scanner via `pnpm security` → `./scripts/security-scan.sh`; covers fs/image/config; HIGH+CRITICAL fail; part of `pnpm check`.
- **[0009 — Ripgrep over grep](0009-ripgrep-over-grep.md)** — *Accepted*
  — Use `rg` for all search; never POSIX `grep`. Prefer Claude's `Grep` tool, then `rg` in Bash. `git grep` exempt. Installed via `scripts/setup-mac.sh`. *(Hook now blocks bare grep — see CLAUDE.md.)*

### Application code

- **[0010 — NestJS for backend APIs](0010-nestjs-backend.md)** — *Accepted*
  — NestJS 11 (Fastify adapter) as default backend framework; cross-cutting concerns live in `shared/*` packages. NestJS 10 dropped due to CVE-2026-33011 / CVE-2026-25223.
- **[0011 — React primary, SvelteKit alternative](0011-frontend-frameworks.md)** — *Accepted*
  — Default frontend is React 19 + Vite 7 SPA; SvelteKit 2 is the explicit alternative for bundle-sensitive or form-heavy apps. Next.js is not the default.
- **[0012 — Drizzle ORM](0012-drizzle-orm.md)** — *Accepted*
  — Drizzle as data layer with `node-postgres` (Postgres) and `better-sqlite3` (SQLite); schemas in `shared/db-<domain>/`; migrations via drizzle-kit; DTO validation via `drizzle-zod`.
- **[0013 — Vitest + Playwright](0013-vitest-playwright.md)** — *Accepted*
  — Vitest ≥2 for unit/integration; Playwright ≥1.56 for E2E; Stagehand opt-in per app; no Jest.
- **[0014 — Package by feature](0014-package-by-feature.md)** — *Accepted*
  — Vertical-slice layout: domain folders own resolver/service/component/tests/types. Cross-domain primitives go in type-folders (`ui/`, `gql/`). Files extract to shared only on second consumer.

### Configuration

- **[0015 — Backend file-based config](0015-backend-config.md)** — *Accepted*
  — Backend config = typed zod schema + layered YAML (`default.yaml` → `{APP_ENV}.yaml` → `local.yaml`) + secrets-only env vars, via `@shared/config` with `file()`/`secret()` helpers and branded NestJS DI tokens. `APP_ENV` separate from `NODE_ENV`. Supersedes 0017 for backend.
- **[0016 — Web runtime env injection](0016-web-runtime-env-tokens.md)** — *Accepted*
  — Inject web env vars at deploy time via `@import-meta-env/unplugin` + CLI: byte-identical bundles, single `index.html` placeholder swap, `.env.example` allowlist, in-browser zod validation in `src/env.ts`. Supersedes the prior `sed`-replacement revision.
- **[0017 — Env config via validated schema](0017-env-config.md)** — *Superseded by 0015 (backend) and 0016 (frontend)*
  — Original per-app `src/env.ts` zod schema pattern is retired. Zod-for-env idea survives in both successors.

### CI / CD / infra / security

- **[0018 — Lefthook for git hooks](0018-lefthook.md)** — *Accepted*
  — Lefthook (YAML) as runner with parallel pre-commit (biome, knip, commitlint), pre-push (`nx affected`), and commit-msg gates.
- **[0019 — Conventional Commits](0019-conventional-commits.md)** — *Accepted*
  — Conventional Commits 1.0 enforced by commitlint via `commit-msg`; `pnpm commit` for interactive prompts; scope = NX project name; mandatory `#<n>` or `PROJ-<n>` ticket suffix for AI-authored commits (PreToolUse hook blocks omission); drives `nx release`.
- **[0020 — GitHub repo conventions](0020-github-repo-conventions.md)** — *Accepted*
  — PR template (risk level + structured sections), 5 issue templates, path-based CODEOWNERS, staggered weekly Dependabot (4 ecosystems), SECURITY.md with severity SLAs. No Copilot-instructions file; canonical AI context is `AGENTS.md` (with `CLAUDE.md` as a symlink) per ADR 0028.
- **[0021 — GitHub Actions](0021-github-actions-ci.md)** — *Accepted*
  — Reusable workflows (prefix `_`) + `setup-monorepo` composite action; PR CI runs `nx affected` + Trivy; container registry parameterised; cloud creds via OIDC.
- **[0022 — OpenTofu for IaC](0022-opentofu-iac.md)** — *Accepted*
  — OpenTofu (MPL-2.0) with per-app `apps/<name>/iac/` directories; remote encrypted state (`TF_ENCRYPTION`); environments via `-var-file` not workspaces; deploys via `_infra-deploy.yml` only.
- **[0023 — Container build and local dev conventions](0023-container-conventions.md)** — *Proposed*
  — Single `Dockerfile` per service, four targets (`deps`/`dev`/`builder`/`runtime`), `node:22-bookworm-slim` throughout (distroless deferred pending devops review). Same `runtime` image promotes through stage/temp/prod; `dev` target only used by local compose. `USER node`, `ENTRYPOINT ["node"]`, `HEALTHCHECK` on `GET /health`. CI tags `<service>:vX.Y.Z` + `<service>:<sha>`; no `latest`. Per-service `compose.yml` with `postgres:16-bookworm`, source bind + anonymous `node_modules`, healthcheck-gated `depends_on`. Connective tissue for 0008/0021/0022/0024/0025. First ADR in MADR-lite format.
- **[0024 — Branching, releases, and environments](0024-branching-releases-environments.md)** — *Accepted*
  — Two branches: `main` (trunk) + `release-candidate` (deliberate release branch, renamed from `stage` to disambiguate from the env). Mandatory envs: stage + prod; hosted dev optional with direction-of-travel toward "1% cutdown of stage". Tag-driven prod with merge-back on success. Hotfix from prod tag → PR into `release-candidate`. Per-service temp env as escape hatch (one at a time, off by default, social governance). Release-in-flight enforced by precondition + concurrency group. GitLab Flow + SemVer. Companion to 0025 (data flow).
- **[0025 — Production data flow to lower environments](0025-production-data-flow.md)** — *Accepted*
  — Data direction companion to 0024. Three hard rules: raw prod data never leaves its environment; sanitisation happens inside the prod boundary; prod credentials never reach CI runners or developer machines. Decoupled snapshot/restore pipeline (one job dumps + sanitises to artifact store; another reads to lower envs). SQL-level sanitisation, not stream parsing. Lower envs (stage, hosted dev, developer laptops, temp) see only sanitised data; hosted dev as 1% cutdown. Implementation (cloud, scheduler, store) per-fork.
- **[0026 — Runbook and SOP format](0026-runbook-and-sop-format.md)** — *Accepted*
  — Procedure docs (runbooks for ops, SOPs for process) in version control, shared template. Co-located: `apps/<p>/<s>/runbooks|sops/`; cross-cutting at `docs/runbooks|sops/`. Kebab-case filenames, no `RUN-NNN`. Frontmatter only `triggers:` and `status:` (both optional). Required sections: Overview, Prerequisites, Steps, Related. Staleness via git mtime + agent point-of-use check + advisory CI script; no `last-reviewed` field.
- **[0027 — Team metadata in CODEOWNERS comments](0027-codeowners-team-metadata.md)** — *Accepted*
  — Carry team-and-ops metadata in `# key: value` comments above CODEOWNERS rule lines. Required when block present: `PM` and `TechLead` (one person each). Free-form additional role lines (`# Frontend: @a @b`, `# DBA: @c`). Optional operational keys: `slack`, `alerting`, `monitoring`, `status`. No separate `TEAM.md` file. AGENTS.md gains a 3-sentence pointer telling the agent to consult CODEOWNERS on big edits. Extends 0020.

### AI agents

- **[0028 — AGENTS.md as cross-agent standard](0028-multi-agent-rule-distribution.md)** — *Accepted*
  — `AGENTS.md` is the canonical cross-agent brief; `CLAUDE.md` is a committed symlink to it. Skills move to `.agents/skills/<name>/SKILL.md` with per-agent symlinks. OpenCode hook parity via `opencode-claude-hooks` plugin (best-effort). Principles: toolchain-first, soft ~150-line cap, inline rationale, review-on-signal. Path-scoping via per-app `AGENTS.md`. Supersedes the single-agent parts of 0029.
- **[0029 — Claude Code configuration layout](0029-claude-code-setup.md)** — *Accepted (single-agent parts superseded by 0028)*
  — Curated `.claude/` layout (agents, hooks, commands, skills, settings.json) plus root + per-app `CLAUDE.md` and `.mcp.json` (context7, playwright, chrome-devtools). Hooks split into content validators and command guards, no escape hatches.
- **[0030 — Child code layout: `apps/` and `repos/`](0030-child-apps-and-repos.md)** — *Accepted*
  — Two parallel root directories, each optional: `apps/` for pnpm workspace members (existing monorepo), `repos/` for independent child git repos (new). Children in `repos/` are excluded from pnpm workspace and NX graph, own their own everything, work standalone. Capability is opt-in by population; no flag. Cross-repo agent context via running the agent at the parent root. No git-hook cascading. Extends 0028.

### Secrets

- **[0034 — Secrets injection at runtime](0034-secrets-runtime-injection.md)** — *Accepted*
  — Pattern B (entrypoint shim, not platform-native): a vault CLI (`infisical run --` / `op run --` / `doppler run --` / Vault Agent) sits in the container `ENTRYPOINT`, authenticates as the workload via cloud-native identity (IRSA / Pod Identity / WIF), exports secrets as env vars, then exec's into node. Stacks with ADR 0032's OTel `--import`: `["<vault-cli>", "run", "--", "node", "--import", "./dist/instrumentation.mjs"]`. Local dev: same CLI wrapping `pnpm dev` (1Password `op run --` as named default, `.env` files retired). CI: OIDC-only (defense = cloud-side IAM posture + Trivy + PR review, not a lefthook hook). Store agnostic, advisory ladder: 1Password Secrets Automation → Doppler/Infisical Cloud → Infisical self-hosted (MIT) → OpenBao (MPL-2.0) → SPIFFE/SPIRE for ≥3 clouds. Static secrets default; dynamic secrets (Vault/OpenBao mints per-instance DB creds with 1h TTL) named as graduation when compliance / leak-rotation lag / multi-service-DB pain triggers it. Six hard rules surfaced from 2024–2026 incidents (no `.env` in git, no long-lived CI keys, etc.). Fills the gap ADR 0015 deliberately left open; supersedes its `.env`-based dev workflow.

### Observability

- **[0031 — Structured logging contract](0031-structured-logging-contract.md)** — *Accepted*
  — pino 10 + `nestjs-pino`; stdout-only JSON, no transports in app code (Biome rule enforces); fixed log shape including `trace_id`/`span_id` from `@opentelemetry/instrumentation-pino`; local dev tees raw JSON to `.ai-wip/logs/<product>-<service>.log` and pretty to terminal; `pnpm watch-logs` for humans.
- **[0032 — Runtime observability: OTel, metrics, tracing](0032-runtime-observability.md)** — *Accepted*
  — OpenTelemetry Node SDK with OTLP/HTTP to a local Collector (the swap point). `ENTRYPOINT ["node", "--import", "./dist/instrumentation.mjs"]` fixes boot order. W3C `traceparent` only. Metrics split: `prom-client` for runtime, OTel SDK for app (RED). 10% head-based sampling in prod, 100% local; tail-based at Collector as graduation. `pnpm dev` logs-only by default, `pnpm dev:obs` brings up Collector + Grafana + Tempo + Loki + Prometheus. Prod backend not prescribed; advised ladder New Relic Free → Grafana Cloud Free → self-host. Error/replay layer opt-in via SOPs (PostHog default-advised, Sentry alternative for backend-heavy). No OTel web SDK in template.

### API contracts & errors

- **[0033 — API contracts & error shapes](0033-api-contracts-and-errors.md)** — *Accepted*
  — Validation split by surface: **class-validator on `@InputType` classes** for GraphQL (the class is mandatory for `Reflect.getMetadata`; class-validator piggy-backs for free), **Zod 4** for non-GraphQL boundaries (REST, config, headers, webhooks, the `ApiError` response). RFC 9457 Problem Details with `code` / `traceId` / `errors[]` extensions. Domain-prefixed flat snake_case codes. Single `ApiException extends IntrinsicException` + `AllExceptionsFilter` / `GqlExceptionFilter` in `shared/nest-errors/`; 5xx detail stripped outside dev. 422 for validation. GraphQL primary (Yoga + `@graphql-yoga/nestjs` + code-first); REST narrow (`/v1/`, `@Deprecated` decorator → RFC 9745/8594 headers, 410 on sunset). React via `graphql-codegen` + TanStack Query. Four-layer composition per feature: Drizzle schema (+ `readonly` vocabulary tuples) → `<feature>.input.ts` (`@InputType` + class-validator) → `<feature>.types.ts` (`@ObjectType`) → `<feature>.service.ts` (POJO inputs, `XxxView` returns, framework-free for plain Vitest). Resolver hand-copies fields. `Input` / `View` / `Type` triple kept intentional (different audiences). PATCH via `T \| null \| undefined` + `validateWhenPresent` shim. Subscriptions wire-shape settled, operations deferred. GQLoom + homegrown gen-from-drizzle codegen named as graduations. Empirical evidence:  IMS project.

### Data

- **[0036 — Safe database migrations](0036-safe-database-migrations.md)** — *Accepted*
  — Expand/contract, forward-only, additive-first DDL. **Two paths, same SQL, same command**: Path A (default) runs `drizzle-kit migrate` as an inline step in `deploy-prod.yml` before pod promotion; Path B (supervised) is operator-triggered via `db-migrate.yml` `workflow_dispatch` for risky/large/incident cases — both wrap the same `_db-migrate.yml` reusable workflow. Boot-time migration rejected (multi-replica races); `drizzle-kit push` banned in prod. **Concurrent-runner safety**: every `db:migrate` invocation takes a Postgres advisory lock (`pg_try_advisory_lock(<package-hash>)`) and fails fast if held — makes Path A vs Path B races, hotfix-during-release races, and CI retries all safe; no partial state. Programmatic `migrate()` from `drizzle-orm/postgres-js/migrator` for the connection control needed to set `lock_timeout = 3s` + `statement_timeout = 15min` per session. Squawk action is a required PR check on `shared/db-*/drizzle/**/*.sql`; per-file ignore for the `require-concurrent-index-creation` FP. N-1 backward compat; dropping a column takes three releases (write-only-new → read-only-new → drop). Backfills are app-code Jobs with cursored `LIMIT 10k` batches, not migrate steps. Forward-only is practically permanent — drizzle-kit 1.x has no `down`; rollback = roll-forward fix or PITR. pgroll named as graduation when a table needs dual-schema views *and* pgroll ships 1.0. Per-package `db:migrate` scripts (one history per `shared/db-<domain>/`). Cross-cutting runbook at [docs/runbooks/supervised-db-migrations.md](../runbooks/supervised-db-migrations.md) for Path B execution.

### Feature flags

- **[0035 — Feature flags](0035-feature-flags.md)** — *Accepted*
  — Day-one stack: OpenFeature SDKs + a TypeScript flag registry in `shared/flags/` exposed via `InMemoryProvider`. Kebab-case keys (`new-checkout`); required `default` / `owner` / `expires` fields; TS `FlagKey` union enforced at typecheck on both server and client. Lifecycle hygiene by convention + PR review; no CI hook (same reasoning as 0034). **Backend**: `@openfeature/nestjs-sdk` (pre-1.0; wrapped in `shared/flags/nestjs.ts` so breaking changes are one-file edits); `@BooleanFeatureFlag(...)` decorators; `contextFactory` interceptor reads auth → `targetingKey`. **Frontend**: in-house `useFeatureFlag(key, defaultValue)` hook with OpenFeature-shaped contract — not `@openfeature/react-sdk` yet, because no `posthog-js` OpenFeature web provider exists. **Asymmetric PostHog story**: if a fork adopts PostHog per ADR 0032, backend swaps `InMemoryProvider` → Tapico's `PostHogProvider` (likely forked to re-pin `posthog-node ^5`); frontend re-implements `useFeatureFlag` body to delegate to `@posthog/react`. Hook signature stays identical. Graduation ladder: TS registry → Unleash self-hosted → PostHog flags / GrowthBook Cloud / ConfigCat. LaunchDarkly intentionally not on first rung (per-context pricing + proprietary FDN). Experimentation, multivariate semantics, OFREP deferred.
