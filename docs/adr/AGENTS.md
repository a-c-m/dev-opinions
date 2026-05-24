# Architecture Decision Records

Records of significant technical decisions for base-app and downstream
apps scaffolded from it.

This index is designed to be **read on its own**: each entry contains
enough of the decision that an agent (or a human) gets the gist
without opening the file. Open the linked ADR when you need the
context, the alternatives that were rejected, or the consequences.

## Format

Each ADR follows:

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Context**: What is the situation that prompts this decision?
- **Decision**: What did we decide?
- **Consequences**: What follows — positive, negative, and neutral?
- **Alternatives**: What else was considered and why rejected?

## Index

### Workspace & tooling

- **[0001 — Package manager: pnpm](0001-package-manager.md)** — *Accepted*
  — Adopt pnpm 9 as the sole package manager; enforce via `packageManager` field and `engines.pnpm`; workspaces declared in `pnpm-workspace.yaml`.
- **[0002 — TypeScript strict + tsgo](0002-typescript-strict-tsgo.md)** — *Accepted*
  — Use TypeScript 5.8.x with `strict: true` plus extra `noUnused*` flags; typecheck via tsgo (`@typescript/native-preview --noEmit`); keep `tsc` only for `.d.ts` emission.
- **[0003 — Biome + Ultracite for lint/format](0003-biome-ultracite.md)** — *Accepted*
  — Single tool: Biome 2.2.6 + Ultracite 5.4.5, wrapped by `biome-suppressed` (`bs` CLI) for baseline-aware checks. `lint` writes, `lint:check` reads, `lint:ci` blocks improvements without baseline update.
- **[0004 — Knip for dead-code detection](0004-knip-dead-code.md)** — *Accepted*
  — Knip ^5.62 at repo root for unused files/exports/types/deps; CI-blocking, driven by NX entry points.
- **[0005 — NX for monorepo orchestration](0005-nx-monorepo.md)** — *Accepted*
  — NX 22.6.5 with `apps/*`, `shared/*`, `tools/*` layout; CI runs `nx affected`; independent per-project releases via `nx release`.
- **[0010 — Lefthook for git hooks](0010-lefthook.md)** — *Accepted*
  — Lefthook (YAML) as runner with parallel pre-commit (biome, knip, commitlint), pre-push (`nx affected`), and commit-msg gates.
- **[0011 — Conventional Commits](0011-conventional-commits.md)** — *Accepted*
  — Conventional Commits 1.0 enforced by commitlint via `commit-msg`; `pnpm commit` for interactive prompts; scope = NX project name; optional `#<n>` issue suffix; drives `nx release`.
- **[0014 — Node 22 LTS](0014-node-22-lts.md)** — *Accepted*
  — Pin Node 22 LTS to exact patch in `.nvmrc`; declare `engines.node >=22.0.0`; CI uses `actions/setup-node@v4` with `node-version-file: .nvmrc`.
- **[0020 — Ripgrep over grep](0020-ripgrep-over-grep.md)** — *Accepted*
  — Use `rg` for all search; never POSIX `grep`. Prefer Claude's `Grep` tool, then `rg` in Bash. `git grep` exempt. Installed via `scripts/setup-mac.sh`. *(Hook now blocks bare grep — see CLAUDE.md.)*
- **[0023 — Package script conventions](0023-package-script-conventions.md)** — *Proposed*
  — Fixed alphabet of script verbs (`dev`, `serve`, `start`, `build`, `clean`, `lint`, `typecheck`, `test{,:cov,:watch,:int*}`, `e2e`, `codegen`, `db:*`) so `nx run-many` works without flag-juggling. `lint` writes; CI uses `lint:ci`.

### Application code

- **[0006 — NestJS for backend APIs](0006-nestjs-backend.md)** — *Accepted*
  — NestJS 11 (Fastify adapter) as default backend framework; cross-cutting concerns live in `shared/*` packages. NestJS 10 dropped due to CVE-2026-33011 / CVE-2026-25223.
- **[0007 — React primary, SvelteKit alternative](0007-frontend-frameworks.md)** — *Accepted*
  — Default frontend is React 19 + Vite 7 SPA; SvelteKit 2 is the explicit alternative for bundle-sensitive or form-heavy apps. Next.js is not the default.
- **[0008 — Vitest + Playwright](0008-vitest-playwright.md)** — *Accepted*
  — Vitest ≥2 for unit/integration; Playwright ≥1.56 for E2E; Stagehand opt-in per app; no Jest.
- **[0009 — Drizzle ORM](0009-drizzle-orm.md)** — *Accepted*
  — Drizzle as data layer with `node-postgres` (Postgres) and `better-sqlite3` (SQLite); schemas in `shared/db-<domain>/`; migrations via drizzle-kit; DTO validation via `drizzle-zod`.
- **[0022 — Package by feature](0022-package-by-feature.md)** — *Proposed*
  — Vertical-slice layout: domain folders own resolver/service/component/tests/types. Cross-domain primitives go in type-folders (`ui/`, `gql/`). Files extract to shared only on second consumer.

### Configuration

- **[0013 — Env config via validated schema](0013-env-config.md)** — *Superseded by 0021 (backend) and 0019 (frontend)*
  — Original per-app `src/env.ts` zod schema pattern is retired. Zod-for-env idea survives in both successors.
- **[0019 — Web runtime env injection](0019-web-runtime-env-tokens.md)** — *Accepted*
  — Inject web env vars at deploy time via `@import-meta-env/unplugin` + CLI: byte-identical bundles, single `index.html` placeholder swap, `.env.example` allowlist, in-browser zod validation in `src/env.ts`. Supersedes the prior `sed`-replacement revision.
- **[0021 — Backend file-based config](0021-backend-config.md)** — *Proposed*
  — Backend config = typed zod schema + layered YAML (`default.yaml` → `{APP_ENV}.yaml` → `local.yaml`) + secrets-only env vars, via `@shared/config` with `file()`/`secret()` helpers and branded NestJS DI tokens. `APP_ENV` separate from `NODE_ENV`. Supersedes 0013 for backend.

### CI / CD / infra / security

- **[0015 — Trivy vulnerability scanning](0015-trivy-security-scan.md)** — *Accepted*
  — Trivy (Aqua) as the single scanner via `pnpm security` → `./scripts/security-scan.sh`; covers fs/image/config; HIGH+CRITICAL fail; part of `pnpm check`.
- **[0016 — GitHub Actions](0016-github-actions-ci.md)** — *Accepted*
  — Reusable workflows (prefix `_`) + `setup-monorepo` composite action; PR CI runs `nx affected` + Trivy; container registry parameterised; cloud creds via OIDC.
- **[0017 — OpenTofu for IaC](0017-opentofu-iac.md)** — *Accepted*
  — OpenTofu (MPL-2.0) with per-app `apps/<name>/iac/` directories; remote encrypted state (`TF_ENCRYPTION`); environments via `-var-file` not workspaces; deploys via `_infra-deploy.yml` only.
- **[0018 — GitHub repo conventions](0018-github-repo-conventions.md)** — *Accepted*
  — PR template (risk level + structured sections), 5 issue templates, path-based CODEOWNERS, staggered weekly Dependabot (4 ecosystems), SECURITY.md with severity SLAs. No Copilot-instructions file.

### AI agents

- **[0012 — Claude Code configuration layout](0012-claude-code-setup.md)** — *Accepted (single-agent parts superseded by 0024)*
  — Curated `.claude/` layout (agents, hooks, commands, skills, settings.json) plus root + per-app `CLAUDE.md` and `.mcp.json` (context7, playwright, chrome-devtools). Hooks split into content validators and command guards, no escape hatches.
- **[0024 — AGENTS.md as cross-agent standard](0024-multi-agent-rule-distribution.md)** — *Proposed*
  — `AGENTS.md` is the canonical cross-agent brief; `CLAUDE.md` is a committed symlink to it. Skills move to `.agents/skills/<name>/SKILL.md` with per-agent symlinks. OpenCode hook parity via `opencode-claude-hooks` plugin (best-effort). Principles: toolchain-first, soft ~150-line cap, inline rationale, review-on-signal. Path-scoping via per-app `AGENTS.md`. Supersedes the single-agent parts of 0012.
- **[0025 — Child code layout: `apps/` and `repos/`](0025-child-apps-and-repos.md)** — *Proposed*
  — Two parallel root directories, each optional: `apps/` for pnpm workspace members (existing monorepo), `repos/` for independent child git repos (new). Children in `repos/` are excluded from pnpm workspace and NX graph, own their own everything, work standalone. Capability is opt-in by population; no flag. Cross-repo agent context via running the agent at the parent root. No git-hook cascading. Extends 0024.
- **[0026 — Team metadata in CODEOWNERS comments](0026-codeowners-team-metadata.md)** — *Proposed*
  — Carry team-and-ops metadata in `# key: value` comments above CODEOWNERS rule lines. Required when block present: `PM` and `TechLead` (one person each). Free-form additional role lines (`# Frontend: @a @b`, `# DBA: @c`). Optional operational keys: `slack`, `alerting`, `monitoring`, `status`. No separate `TEAM.md` file. AGENTS.md gains a 3-sentence pointer telling the agent to consult CODEOWNERS on big edits. Extends 0018.
- **[0027 — Runbook and SOP format](0027-runbook-and-sop-format.md)** — *Proposed*
  — Procedure docs (runbooks for ops, SOPs for process) in version control, shared template. Co-located: `apps/<p>/<s>/runbooks|sops/`; cross-cutting at `docs/runbooks|sops/`. Kebab-case filenames, no `RUN-NNN`. Frontmatter only `triggers:` and `status:` (both optional). Required sections: Overview, Prerequisites, Steps, Related. Staleness via git mtime + agent point-of-use check + advisory CI script; no `last-reviewed` field.
