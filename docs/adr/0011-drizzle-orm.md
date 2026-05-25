---
date: 2026-04-19
---

# ADR 0011: Drizzle ORM with Postgres or SQLite

## Context and Problem Statement

A modern TypeScript data layer should give the compiler full visibility into the schema, avoid a separate codegen step, and work with more than one database dialect so production (hosted Postgres) and local-first or CLI contexts (SQLite) share a common API. ORMs with runtime clients or heavyweight codegen introduce friction at every point of that path.

## Decision Outcome

- **Drizzle ORM** as the default data layer.
- Dialects supported out of the box:
  - `drizzle-orm/node-postgres` with `pg` for Postgres (production services).
  - `drizzle-orm/better-sqlite3` for local-first/CLI apps and integration tests.
- Schemas live in `shared/db-<domain>/src/schema.ts`; migrations in `shared/db-<domain>/drizzle/`.
- **drizzle-kit** generates migrations and drives introspection.
- **Vocabulary sets** (status enums, flow enums, role enums) are exported from the schema package as `readonly` tuples, with the matching string-literal-union type derived from the tuple. Consumers — validators, service domain rules, narrowed types — reference the tuple. Never re-typed inline.
  ```typescript
  export const PRODUCT_POST_RETURN_FLOWS = ['reimage', 'clean', 'inspect'] as const;
  export type ProductPostReturnFlow = typeof PRODUCT_POST_RETURN_FLOWS[number];
  ```
- **DTO validation**: `drizzle-zod` for non-GraphQL ingress (REST endpoints, webhooks, queue consumers, CLI). GraphQL inputs use `class-validator` decorators on `@InputType` classes per [ADR 0019](0019-api-contracts-and-errors.md) — the `@InputType` class is mandatory, so the second runtime check Zod would provide is redundant.

## Consequences

### Positive
- Zero-runtime schema inference: the compiler knows the shape of every row and query.
- Query builder reads like SQL, which means the ORM does not hide what actually runs against the database.
- The same API targets both Postgres and SQLite — fast dev against SQLite, deploy against Postgres.
- No codegen step to keep in sync; the schema is TypeScript.

### Negative
- Fewer high-level features than heavier ORMs (for example, no built-in relation-query caching or studio UI).
- Migrations are generated from diffs, so reviewing the generated SQL is a required step, not an optional one.

## Alternatives considered

- **Prisma** — mature DX and tooling, but runtime client and codegen step add weight, and its query engine abstracts SQL further than needed here.
- **Kysely** — pure query builder; no schema as single source of truth.
- **TypeORM** — decorator-heavy, dated idioms, inconsistent typing.
