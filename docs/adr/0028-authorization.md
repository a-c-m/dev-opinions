---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0028: Authorization

## TL;DR

| Layer | What it decides | Where |
|---|---|---|
| Guard | Does this role have access to this operation? | `@CheckAbility(action, SubjectClass)` + `AuthzGuard` |
| Service | Does this user have access to *this* object? | `ability.can(action, loadedObject)` after fetch |
| Frontend | UX gating (not security) | `<Can>` + `useCan()` from `@casl/react` |

**Default:** `@casl/ability` v6 + a hand-rolled `AbilityFactory` (~40 LOC, tests included) in `shared/authz/`. No `nest-casl` wrapper (supply-chain minimisation). RBAC by default; ABAC via subject conditions where ownership matters.

[ADR 0027](0027-authentication.md) settles authn (who you are); this ADR settles authz (what you can do).

## Context

ADR 0027 puts `roles: string[]` on `TokenClaims` and explicitly defers authz. Every fork hits the gap on day two — "user can read their own orders, admins can read all" needs more than a role check. Without a convention, every service grows `if (user.roles.includes('admin'))` branches and IDOR (OWASP A01) bugs follow.

This ADR settles: the framework choice, the two-layer enforcement pattern, the file layout, frontend gating, and the audit-log seam. Stays scoped to authz; service-to-service auth and SCIM remain deferred per ADR 0027.

## Decision Outcome

### `@casl/ability` direct, factory hand-rolled

`@casl/ability` v6.8 (~950k weekly downloads) is the framework. The NestJS-side wiring is **hand-rolled** in `shared/authz/` rather than adopting `nest-casl` — fewer supply-chain surfaces and full control over hardening (deny-by-default, audit emission seam, error mapping into [ADR 0019](0019-api-contracts-and-errors.md)'s `ApiException`).

`@casl/react` is used on the client (mature, ~214k weekly, isomorphic with the server `Ability` type).

### `shared/authz/` file layout

```
shared/authz/
├── ability.types.ts        # Actions enum, Subjects union, AppAbility type alias
├── ability.factory.ts      # AbilityFactory: TokenClaims → AppAbility (~40 LOC)
├── ability.factory.spec.ts # tests for the factory (RBAC matrix + ownership conditions)
├── check-ability.decorator.ts  # @CheckAbility(action, SubjectClass) metadata
├── authz.guard.ts          # NestJS guard reading the decorator; deny-by-default
├── authz.module.ts         # exports for DI
└── index.ts                # public re-exports
```

`ability.factory.ts` is the *only* place where roles → permissions is defined. Adding a role = one branch in one file.

### Two-layer enforcement

Both layers are mandatory. Skipping either is the OWASP A01 trap.

**Guard (entry-point, coarse).** `@CheckAbility('update', Order)` on a controller route or GraphQL resolver. The guard fetches `TokenClaims` from the request, builds an `Ability` via the factory, and checks `ability.can(action, SubjectClass)`. Subject-class check only — no DB fetch, no object loaded. Decides "does this role have any access to Order updates at all?"

**Service (per-object, fine).** After the service loads the object, call `ability.can(action, loadedOrder)`. CASL checks attribute conditions (`{ userId: user.id }`) against the loaded record. Throw `ForbiddenException` if false; the [ADR 0019](0019-api-contracts-and-errors.md) `ApiException` filter maps this to `code: 'forbidden'`.

```typescript
async update(claims: TokenClaims, input: UpdateOrderServiceInput) {
  const order = await this.db.query.orders.findFirst({ where: eq(orders.id, input.id) });
  const ability = this.abilityFactory.createForUser(claims);
  if (!ability.can('update', subject('Order', order))) {
    throw new ForbiddenException({ code: 'forbidden', subject: 'Order', id: input.id });
  }
  // ... mutate
}
```

Services stay framework-free per ADR 0019 — the `AbilityFactory` is injected, but the `ability.can()` call is plain TS.

### RBAC default, ABAC where ownership matters

CASL handles both shapes cleanly inside one factory. Start with RBAC (`can('manage', 'all')` for admin; `can('read', 'Order')` for viewer); add ABAC conditions where ownership / scope matters:

```typescript
// shared/authz/ability.factory.ts
createForUser(claims: TokenClaims): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (claims.roles.includes('admin')) {
    can('manage', 'all');                        // RBAC
  } else {
    can('read', 'Order', { userId: claims.userId });  // ABAC
    can('update', 'Order', { userId: claims.userId, status: { $ne: 'shipped' } });
  }

  return build({ detectSubjectType: (item) => item.constructor as ExtractSubjectType<Subjects> });
}
```

**ABAC complexity to accept:**

- **Fetch-before-check.** ABAC needs the loaded object. Services that do "list all things I can update" need either (a) load-all-then-filter-in-memory (cheap for small sets, slow for large), (b) hand-write the SQL `WHERE` to match the ability conditions (drift risk), or (c) wait for a Drizzle adapter (none exists in 2026; `@casl/prisma` is the closest, no equivalent).
- **The DB-filter graduation.** When list endpoints hit ABAC scale issues, write a thin `abilityToDrizzleWhere(ability, 'update', 'Order')` helper in `shared/authz/`. It walks the rule set and emits Drizzle conditions. ~30 LOC; defer until forks need it.
- **Conditions are MongoDB-like JSON.** CASL uses `$eq` / `$ne` / `$in` / `$gt` / etc. Powerful, but worth a short cheatsheet in `shared/authz/README.md`.

**Recommendation: prefer ABAC conditions over role-only checks wherever a resource has an owner or tenant scope.** Role-only is correct for cross-cutting actions (`admin can manage everything`). Object-owned actions get ABAC conditions even when "current user only" feels obvious — the rule is in one place and survives refactors.

### Frontend — `@casl/react` + TanStack Query

Server returns the user's permissions in the session/profile response — same shape as the `Ability` factory produces:

```typescript
// GET /me → { userId, roles, abilityRules }
// where abilityRules is the serialised rule set from ability.rules
```

Client builds an `Ability` from `abilityRules` and caches it via TanStack Query (`useQuery({ queryKey: ['me'], ... })`). Two gating helpers from `@casl/react`:

- **`<Can I="update" a={order}>...</Can>`** for JSX conditional rendering
- **`useCan('update', order)`** for imperative checks (event handlers, route loaders)

[TanStack Router](https://tanstack.com/router/v1/docs/how-to/setup-rbac)'s `beforeLoad` is the right place to redirect on missing permission; route gates are still UX (not security).

**Frontend is never the security boundary.** Hidden buttons matter for UX; the server's guard + service check is the enforcement. A button that 403s on click is better than no button that breaks accessibility.

### GraphQL — same decorator, same factory

The pattern is identical across REST and GraphQL because the `@CheckAbility(action, SubjectClass)` decorator + `AuthzGuard` work on any NestJS handler (controller route, GraphQL resolver, WS gateway). NestJS `Reflector` reads metadata regardless of transport.

Three GraphQL specifics:

- **Resolver-level**: `@CheckAbility('read', 'Order')` on `@Query()` / `@Mutation()` works the same as on REST `@Get()` / `@Post()`. Service-layer `ability.can(action, loaded)` is identical.
- **Field-level (`@ResolveField`)**: optional per-field gating when some users see different fields on the same object. `@CheckAbility('read', 'Order.cost')` style — use a subject string like `'Order.cost'` and add the rule in the factory. Defer the directive-based approach (see below).
- **Error shape**: `ForbiddenException` maps via `GqlExceptionFilter` (ADR 0019) to a GraphQL error with `extensions.code = 'forbidden'`, `extensions.http.status = 403`, `extensions.traceId`. Same `code` discriminator the REST surface uses.

**`@auth` SDL directives are a graduation.** Schema-first plugin maintenance + drift between SDL and the factory is real overhead. Add only when field-level gating proliferates.

### Audit log — interface now, impl when needed

Define the seam in this ADR; ship the impl when first SOC 2 / ISO 27001 / PCI ask lands.

```typescript
// shared/authz/audit.types.ts
export type AuditEvent = {
  userId: string;
  action: string;            // 'read' | 'update' | …
  subjectType: string;       // 'Order' | …
  subjectId: string | null;  // null for class-level checks
  outcome: 'allowed' | 'denied';
  reason?: string;           // ability rule that matched, or denial cause
  at: Date;
};

export interface AuditService {
  emit(event: AuditEvent): Promise<void>;
}
```

Services call `auditService.emit(...)` immediately after the `ability.can()` check, before the business operation. The first concrete impl writes to a Postgres `audit_log` table via Drizzle (same DB, same shape as everything else); the SIEM-forwarding impl is the next graduation.

A no-op default ships in `shared/authz/` so call sites don't break before forks wire a real impl.

### Anti-patterns

| Anti-pattern | Failure mode | Fix |
|---|---|---|
| **IDOR / BOLA** (OWASP A01:2025 #1) | Guard says "admin or self"; service skips the per-object check. Authenticated user fetches someone else's order via `GET /orders/:id` | Always `ability.can('read', loadedOrder)` in the service |
| **Guard-only enforcement** | Internal callers (queue consumers, scheduled jobs) bypass the guard | Service check is mandatory; guard is UX |
| **Frontend-only gating** | Hidden buttons, client redirects, no server check | Server enforces; frontend gates UX |
| **Role explosion** | 30+ overlapping roles; nobody knows what `editor_v2_legacy` does | Model resources × CRUD actions; roles are small sets of those tuples |
| **Entitlements / plan on token** | Plan changes require token re-issuance | Use [ADR 0027](0027-authentication.md)'s `EntitlementResolver`, not roles |

### What this defers

- **`abilityToDrizzleWhere` helper** — graduation when list endpoints hit ABAC scale issues
- **Concrete `AuditService` impl + Drizzle table schema** — wire when first compliance ask lands
- **GraphQL `@auth` SDL directives** — graduation when field-level gating proliferates
- **Cerbos sidecar (policy-as-code track)** — graduation when condition logic in the factory exceeds ~100 LOC or non-developers need to own rules
- **OpenFGA / Permify (ReBAC track)** — when multi-tenant workspace/folder hierarchies need relationship-graph traversal
- **SIEM forwarding** — when the in-Postgres audit log isn't enough for compliance

*Re-evaluate when:* CASL v7 lands (the migration may touch the factory); Better Auth's `createAccessControl` stabilises and gets a NestJS adapter; Permify's status post-FusionAuth-acquisition becomes clear; an OPA-WASM Node SDK matures into something first-class.

## Consequences

### Positive

- **One file owns role → permission mapping** — adding a role is one branch in `ability.factory.ts`
- **Same `Ability` shape server + client** — isomorphic via `@casl/react`; no duplicated rule logic
- **Two-layer enforcement makes IDOR structurally hard** — guard misses the role gate; service misses the object gate; both have to fail to leak
- **Transport-agnostic** — `@CheckAbility` works on REST controllers, GraphQL resolvers, WS gateways
- **No supply-chain wrapper** — we own ~40 LOC + tests; `@casl/ability` is the only auth dep

### Negative

- **ABAC requires fetch-before-check** — list endpoints can hit performance issues until `abilityToDrizzleWhere` lands
- **No SDL directive for GraphQL field gating by default** — field-level checks live in `@ResolveField` methods until directives earn their place
- **CASL is the lock-in surface** — v6 → v7 migration will touch the factory if breaking API changes land
- **MongoDB-like condition syntax (`$eq`, `$ne`, `$in`)** — unfamiliar to some; needs a cheatsheet

### Neutral

- Auth + authz are deliberately separate ADRs (0037 + 0038); fork can adopt different vendors per layer
- Audit log is opt-in via the impl; the seam is mandatory

## Alternatives considered

1. **`nest-casl` wrapper** — saves ~20 LOC of boilerplate; adds a supply-chain surface and an interceptor we don't need. Hand-rolled keeps full control over hardening and ADR 0019 error mapping.
2. **Hand-rolled `RolesGuard` (no framework)** — sufficient for 2-3 roles without per-object conditions; breaks the moment ownership matters. Migrating later means rewriting every guard call site.
3. **Cerbos / OPA as default** — policy-as-code is the right answer when policy is centrally audited or owned by a non-developer team. Both add a sidecar at template scale; corpus is sparse. Named as graduations.
4. **Better Auth `createAccessControl`** — scoped to Better Auth's own admin endpoints, not general-purpose business authz. Multiple open bugs (issues #4557, #6772, #3011 as of Dec 2025). Wrong tool.

## Related

- **[ADR 0009](0009-nestjs-backend.md)** — NestJS DI hosts `AbilityFactory` and `AuthzGuard`
- **[ADR 0010](0010-frontend-frameworks.md)** — React client uses `@casl/react`
- **[ADR 0011](0011-drizzle-orm.md)** — `audit_log` table (when implemented) follows the same Drizzle pattern
- **[ADR 0016](0016-backend-config.md)** — no `auth.*` config needed beyond ADR 0027
- **[ADR 0019](0019-api-contracts-and-errors.md)** — `ForbiddenException` maps to `code: 'forbidden'`; cross-surface error shape
- **[ADR 0027](0027-authentication.md)** — `TokenClaims.roles` feeds the factory; entitlements stay off-token
- [CASL docs](https://casl.js.org/v6/en/) — `@casl/ability`, `@casl/react`
- [NestJS Authorization recipe](https://docs.nestjs.com/security/authorization) — the upstream pattern this ADR codifies
- [TanStack Router RBAC how-to](https://tanstack.com/router/v1/docs/how-to/setup-rbac)
- [OWASP Top 10:2025 A01 — Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
