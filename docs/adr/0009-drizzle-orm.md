# ADR 0009: Drizzle ORM with Postgres or SQLite

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

A modern TypeScript data layer should give the compiler full visibility into the schema, avoid a separate codegen step, and work with more than one database dialect so production (hosted Postgres) and local-first or CLI contexts (SQLite) share a common API. ORMs with runtime clients or heavyweight codegen introduce friction at every point of that path.

## Decision

- **Drizzle ORM** as the default data layer.
- Dialects supported out of the box:
  - `drizzle-orm/node-postgres` with `pg` for Postgres (production services).
  - `drizzle-orm/better-sqlite3` for local-first/CLI apps and integration tests.
- Schemas live in `shared/db-<domain>/src/schema.ts`; migrations in `shared/db-<domain>/drizzle/`.
- **drizzle-kit** generates migrations and drives introspection.
- DTO validation uses zod schemas derived from Drizzle tables via `drizzle-zod`.

## Consequences

**Positive**
- Zero-runtime schema inference: the compiler knows the shape of every row and query.
- Query builder reads like SQL, which means the ORM does not hide what actually runs against the database.
- The same API targets both Postgres and SQLite — fast dev against SQLite, deploy against Postgres.
- No codegen step to keep in sync; the schema is TypeScript.

**Negative**
- Fewer high-level features than heavier ORMs (for example, no built-in relation-query caching or studio UI).
- Migrations are generated from diffs, so reviewing the generated SQL is a required step, not an optional one.

## Alternatives

- **Prisma** — mature DX and tooling, but runtime client and codegen step add weight, and its query engine abstracts SQL further than needed here.
- **Kysely** — pure query builder; no schema as single source of truth.
- **TypeORM** — decorator-heavy, dated idioms, inconsistent typing.
