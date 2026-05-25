---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0033: API contracts & error shapes

## TL;DR

| Surface | Validator | Errors | Versioning |
|---|---|---|---|
| GraphQL (primary) | `class-validator` on `@InputType` | `errors[].extensions.{code,traceId,…}` via `GqlExceptionFilter` | Field-level `@deprecated` |
| REST (narrow: webhooks, uploads, partner) | Zod 4 | `application/problem+json` body via `AllExceptionsFilter` | URL path `/v1/` |

Same `code` taxonomy across both. Same `ApiException`. Same four-layer per-feature shape (`<feature>.input.ts` / `.types.ts` / `.service.ts`).

## Context

Two surfaces talk to clients: GraphQL (primary, per [ADR 0011](0011-frontend-frameworks.md)) and REST (narrow). Without shared contract / error / deprecation shapes, every service reinvents them and React can't discriminate errors uniformly across surfaces.

## Decision Outcome

### Validation split by surface

- **GraphQL**: `@InputType` / `@ObjectType` classes with `class-validator` decorators in `shared/contracts/<domain>/`. The class is mandatory anyway (`Reflect.getMetadata` drives SDL emission); class-validator decorators piggy-back for free.
- **REST + boundaries** (config, headers, webhooks, queue messages, the `ApiError` response parsed by React): **Zod 4**. No `@InputType` class is mandatory; Zod's refinements / issue trees / `.nullable().optional()` win cleanly. Aligns with [ADR 0012](0012-drizzle-orm.md)'s `drizzle-zod`.

No framework wrapper (tRPC / ts-rest / oRPC). ts-rest 3.53 is the named graduation for the REST surface.

### Error envelope — RFC 9457 Problem Details, hybrid

`Content-Type: application/problem+json` on every non-2xx response. Standard members plus RFC-allowed extensions:

```json
{
  "type": "https://errors.example.com/orders-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "Order ord_abc123 does not exist",
  "instance": "/v1/orders/ord_abc123",
  "code": "orders_not_found",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": [{ "path": "id", "code": "invalid_format", "message": "must match ord_*" }]
}
```

- `code` — stable string for client switching
- `traceId` — W3C trace id from the active OTel span ([ADR 0032](0032-runtime-observability.md))
- `errors[]` — Zod issue tree flattened for multi-field 422s
- `detail` — stripped to generic for 5xx outside `APP_ENV=development`; real cause goes to the log line correlated by `traceId`

### Error codes — domain-prefixed snake_case TS union

`shared/contracts/error-codes.ts` exports the union: cross-cutting (`validation_failed`, `unauthorized`, `forbidden`, `rate_limit_exceeded`, `route_sunset`, `internal_error`) plus per-domain (`orders_not_found`, `payments_card_declined`, …). Domain prefix matches the NX project name. `ApiError.code` is `z.enum(ApiErrorCodes)` — `pnpm typecheck` rejects unknown codes on both server and client.

### `ApiException` + global filters

`shared/nest-errors/` exports `ApiException` (extends NestJS 11 `IntrinsicException` — silences auto-logger for expected 4xx) with an options-bag constructor:

```typescript
throw new ApiException({
  status: 404,
  code: 'orders_not_found',
  title: 'Order not found',
  detail: `Order ${id} does not exist`,
});
```

Two filters share mapping logic:

- **`AllExceptionsFilter`** (REST): `ApiException` → emit fields; `ZodError` → 422 + `errors[]`; unmapped `HttpException` → Problem Details with `code: 'internal_error'`; unknown → 500 + log with `traceId`.
- **`GqlExceptionFilter`** (GraphQL): same mapping; emits `errors[].extensions.{code, http.status, traceId, errors}`. Always-200 means HTTP-status alerts miss app errors — track `extensions.code` distribution as a metric instead.

### REST status codes

| Situation | Code |
|---|---|
| Malformed JSON | 400 (framework default before our filter) |
| Zod validation failure | 422 + `code: 'validation_failed'` + `errors[]` |
| Auth missing / invalid | 401 |
| Authenticated, not allowed | 403 |
| Sunset route | 410 + `code: 'route_sunset'` (set by deprecation interceptor) |
| Rate limited | 429 + `Retry-After` + RFC 9331 `RateLimit-*` |
| Planned outage | 503 + `Retry-After` |
| Upstream timeout | 504 |
| Server fault | 500 + `code: 'internal_error'` |

`ValidationPipe` is configured for 422, not framework default 400.

### GraphQL — Yoga, code-first

- **Server**: `graphql-yoga` via community `@graphql-yoga/nestjs` (Apollo and Mercurius are the first-party `@nestjs/graphql` drivers; Yoga's leaner runtime + Guild-stack alignment justify the non-first-party path)
- **Schema**: code-first (decorators → SDL emitted)
- **Client**: `graphql-codegen` + TanStack Query (not Apollo Client — codegen + TanStack matches Yoga's ecosystem and unifies with the REST fetch layer)

### Contract composition — four-layer per feature

| Layer | File | Library | Role |
|---|---|---|---|
| Persistence | `shared/db-<domain>/schema.ts` + vocabulary tuples | `drizzle-orm/pg-core` | Source of truth for columns + legal-value sets |
| Wire in | `<feature>.input.ts` | `@nestjs/graphql` + `class-validator` | `@InputType` classes; runtime field validation |
| Wire out | `<feature>.types.ts` | `@nestjs/graphql` | `@ObjectType` classes |
| Service | `<feature>.service.ts` (returns `XxxView`) | hand-written TS | Domain return shape; accepts POJOs |

Three principles:

1. **Vocabulary as `readonly` tuples in Drizzle** (per [ADR 0012](0012-drizzle-orm.md)). Reused in `@IsIn([...TUPLE])` and service domain logic; never re-typed inline.
2. **Service takes POJOs, not class instances.** Resolver hand-copies fields from the `@InputType` instance into a named service-input type. Keeps services framework-free (specs are plain Vitest, no NestJS bootstrap). The named type makes the hand-copy compile-time-complete.
3. **`Input` / `View` / `Type` triple is intentional.** Three audiences (wire-in / domain / wire-out) with legitimate shape differences — `CreateInput` has no `id`; `Type` has derived fields like `inventoryCount`; `View` may carry audit fields that don't ship. Collapsing them forces audiences to match and breaks at the first identifier asymmetry.

**PATCH semantics:** update inputs typed `T | null | undefined` — `undefined` = unchanged, `null` = clear, value = set. Decorators: `@IsOptional()` + a `validateWhenPresent` shim (`ValidateIf((_o, v) => v !== null && v !== undefined)`) at the top of each `*.input.ts`. Service: `if (input.x !== undefined) patch.x = input.x;`.

### Versioning & deprecation

Same announce → monitor → sunset lifecycle on both surfaces; different on-the-wire mechanism.

| Stage | REST | GraphQL |
|---|---|---|
| Default | URL path `/v1/` via `VersioningType.URI` | None — field-level evolution |
| Announce | `@Deprecated({ sunset, successor })` → `Deprecation` (RFC 9745) + `Sunset` (RFC 8594) + `Link rel="successor-version"` headers | `@deprecated(reason)` SDL directive |
| Monitor | Access logs on the deprecated path | GraphQL Inspector / Yoga `usage` plugin |
| Sunset | 410 + `code: 'route_sunset'` | Field removed; codegen breaks clients at compile time |
| Major rewrite | `/v2/` alongside `/v1/`; Stripe-style date headers as graduation | New field name; old deprecated. Shopify-style date-pinned endpoint as last-resort |

Sunset windows: **public APIs** (anonymous / partners without active contract) 6 months minimum; **internal-only** 2 months minimum. `shared/nest-versioning/` holds the decorator, interceptor, and `route_sunset` wiring.

### Subscriptions — wire shape now, operations later

`graphql-ws` protocol (Yoga + codegen ship it). Auth: token in `connectionParams` on `connection_init`. In-band errors send the same Problem Details body inside an `error` message frame; connection-terminating failures use close codes 4401 / 4403 / 4429. Pubsub backend, multiplexing, per-tenant quotas, long-lived-socket observability all deferred.

### What this defers (and re-evaluate when)

- **Lint rule for the domain-prefix code convention** — until drift shows up in review
- **`drizzle-zod` at the resolver layer** — kept as a dep only if a non-GraphQL ingress (REST/webhook/queue) earns it
- **`tools/gen-gql-from-drizzle` in-tree codegen** — graduation when the triple's per-field overhead becomes recurring PR noise
- **GQLoom migration** ([modevol-com/gqloom](https://github.com/modevol-com/gqloom)) — schema-first; reverses the code-first decision when (a) GQLoom crosses ~500 stars / picks up a NestJS adapter, AND (b) drift cost exceeds code-first benefit
- **Re-evaluate this ADR** when `drizzle-orm@1.0` ships (codemod the import path) or when `class-validator` + `@nestjs/graphql` decorator metadata stops working under the team's TS toolchain

## Consequences

### Positive

- **One discriminator across surfaces** — same `code` in REST `ApiError.code` and GraphQL `errors[].extensions.code`
- **Trace correlation by construction** — `traceId` ties errors to ADR 0031 / 0032
- **Deprecation enforced, not remembered** — `@Deprecated` decorator; 410 after sunset
- **Services are framework-free** — POJO inputs + plain Vitest specs

### Negative

- **Three declarations per entity** (Input / View / Type) — ~7 places per added field. Mitigated by vocabulary-tuple reuse and named service-input types; G1 codegen exists if it bites
- **`class-validator` + `@nestjs/graphql` depend on `emitDecoratorMetadata`** — fragile under tsgo / strip-only TS modes ([ADR 0003](0003-typescript-strict-tsgo.md))
- **Two validation libraries** — class-validator for GraphQL, Zod for non-GraphQL boundaries. Mental overhead trade for the no-double-declaration win
- **Always-200 GraphQL inverts observability** — need an `extensions.code` metric; HTTP-status alerts miss app errors here
- **Yoga + NestJS isn't first-party** — community adapter is the seam; fallback is Apollo

### Neutral

- REST is a minority surface
- `instance` leaks request paths (fine for API threat model; per-route opt-out if anonymous-discovery is a concern)

## Alternatives considered

1. **Zod for GraphQL inputs via `nestjs-zod`** — the original spike answer. Rejected after IMS evidence: the `@InputType` class is mandatory regardless, so Zod becomes a redundant second declaration.
2. **tRPC v11 / oRPC 1.0** — best TS-only DX; mismatch for non-TS clients and REST-shape APIs.
3. **Apollo driver + Apollo Client** — first-party, biggest corpus; loses Guild alignment and ships heavier.
4. **Collapse Input/View/Type to one shape** — forces audiences to match; breaks at identifier asymmetry and derived fields.
5. **Schema-first GraphQL (SDL files)** — reverses code-first; GQLoom is the named graduation if it becomes worth it.

## Related

- [ADR 0010](0010-nestjs-backend.md) — Yoga vs Apollo settled here (Yoga)
- [ADR 0011](0011-frontend-frameworks.md) — React consumes via codegen + TanStack Query
- [ADR 0012](0012-drizzle-orm.md) — Drizzle is the persistence + vocabulary truth
- [ADR 0031](0031-structured-logging-contract.md) + [ADR 0032](0032-runtime-observability.md) — `traceId` source
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details; [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745) Deprecation; [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594) Sunset
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server); [graphql-ws protocol](https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md)
- [`class-validator`](https://github.com/typestack/class-validator); [`drizzle-zod`](https://orm.drizzle.team/docs/zod); [GQLoom](https://github.com/modevol-com/gqloom)
