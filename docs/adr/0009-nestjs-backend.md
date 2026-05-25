---
date: 2026-04-19
---

# ADR 0009: NestJS 11 as default backend framework

## Context and Problem Statement

Backend apps in this template need a consistent module layout, dependency injection, a testing story that works across services, and a structure that scales from a single controller to dozens of feature modules without rewriting. Framework choice dictates how much of this is given versus assembled by hand.

NestJS 11 is the current major (Fastify 5 underneath). NestJS 10 is no longer receiving security patches — see CVE-2026-33011 in `@nestjs/platform-fastify 10.x` and CVE-2026-25223 in `fastify 4.x`. New apps pin exact NestJS 11 across the core packages.

## Decision Outcome

- **NestJS 11** for API apps under `apps/*-api`.
- Fastify adapter by default — lower latency and memory than Express; switch only when a dependency forces it.
- Per-app structure:
  - `src/main.ts` boots the app and validates env via the shared env-config package.
  - Feature modules live under `src/<feature>/`.
  - GraphQL (Apollo or Yoga) when the API surface is rich; plain REST controllers otherwise.
- Cross-cutting concerns (logger, env, auth, health) come from `shared/*` packages, not app-local code.

## Consequences

### Positive
- A well-understood module system pairs cleanly with monorepo shared libraries.
- First-class DI gives a clean testability story — swap providers in tests without monkey-patching.
- The conventions are stable enough that new apps look the same without central policing.

### Negative
- Heavier than a minimal Node framework; higher cold start and baseline memory matter for edge or serverless deployments.
- Decorator-heavy code can obscure control flow for reviewers who did not write it, which puts a small premium on readable module boundaries.

## Alternatives considered

- **Hono** — lighter and edge-ready; kept as an option for tiny services and MCP servers, not the default for full APIs.
- **Fastify alone** — loses DI, module structure, and the shared-library integration story.
- **tRPC-first (no backend framework)** — tight client/server typing, but less structure as APIs grow and limited language interop with non-TS clients.
