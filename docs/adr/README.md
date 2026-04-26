# Architecture Decision Records

Records of significant technical decisions for base-app and downstream apps scaffolded from it.

## Format

Each ADR follows:

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Context**: What is the situation that prompts this decision?
- **Decision**: What did we decide?
- **Consequences**: What follows — positive, negative, and neutral?
- **Alternatives**: What else was considered and why rejected?

## Index

| # | Title | Status |
|---|---|---|
| 0001 | [Package manager: pnpm](0001-package-manager.md) | Accepted |
| 0002 | [TypeScript strict + tsgo](0002-typescript-strict-tsgo.md) | Accepted |
| 0003 | [Biome + Ultracite for lint/format](0003-biome-ultracite.md) | Accepted |
| 0004 | [Knip for dead code detection](0004-knip-dead-code.md) | Accepted |
| 0005 | [NX for monorepo orchestration](0005-nx-monorepo.md) | Accepted |
| 0006 | [NestJS 10 for backend APIs](0006-nestjs-backend.md) | Accepted |
| 0007 | [React + Vite primary, SvelteKit alternative](0007-frontend-frameworks.md) | Accepted |
| 0008 | [Vitest + Playwright for testing](0008-vitest-playwright.md) | Accepted |
| 0009 | [Drizzle ORM over Prisma](0009-drizzle-orm.md) | Accepted |
| 0010 | [Lefthook for git hooks](0010-lefthook.md) | Accepted |
| 0011 | [Conventional Commits + commitlint + commitizen](0011-conventional-commits.md) | Accepted |
| 0012 | [Claude Code configuration layout](0012-claude-code-setup.md) | Accepted |
| 0013 | [Env config via validated schema](0013-env-config.md) | Accepted |
| 0014 | [Node 22 LTS pinned via .nvmrc](0014-node-22-lts.md) | Accepted |
| 0015 | [Trivy for vulnerability scanning](0015-trivy-security-scan.md) | Accepted |
| 0016 | [GitHub Actions with reusable workflows](0016-github-actions-ci.md) | Accepted |
| 0017 | [OpenTofu for infrastructure-as-code](0017-opentofu-iac.md) | Accepted |
| 0018 | [GitHub repository conventions](0018-github-repo-conventions.md) | Accepted |
| 0019 | [Web runtime env injection via `import-meta-env`](0019-web-runtime-env-tokens.md) | Accepted |
