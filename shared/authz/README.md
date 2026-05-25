# @shared/authz

`AbilityFactory` + `AuthzGuard` + `@CheckAbility()` + `AuditService` per ADR 0028.

**Status:** stub. Type surface lives in `src/index.ts`. Hand-rolled (~40 LOC + tests) per ADR 0028 — no `nest-casl` wrapper (supply-chain minimisation). Real impl lands when the first NestJS service consumes:

- `ability.factory.ts` — `TokenClaims → AppAbility` via `@casl/ability`'s `AbilityBuilder`
- `ability.factory.spec.ts` — RBAC matrix + ABAC ownership tests
- `check-ability.decorator.ts` — `@CheckAbility(action, subject)` metadata
- `authz.guard.ts` — reads metadata, calls factory, deny-by-default; maps `ForbiddenException` via ADR 0019's `ApiException` filter
- `authz.module.ts` — DI wiring

Two-layer enforcement per ADR 0028: **guard** for role gating at route/resolver boundary (no DB fetch); **service** for ownership via `ability.can(action, loadedObject)` after fetch. Both mandatory — skipping the service check is the IDOR / OWASP A01 trap.

`AuditService` interface defined here; no-op default ships with the impl PR; concrete Drizzle-backed impl + `audit_log` table land when first SOC 2 / ISO 27001 / PCI ask arrives.

See [ADR 0028](../../docs/adr/0028-authorization.md).
