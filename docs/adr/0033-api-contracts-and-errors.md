---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0033: API contracts & error shapes

## Context and Problem Statement

Two surfaces talk to clients: GraphQL (primary, per
[ADR 0011](0011-frontend-frameworks.md)) and REST (narrow —
webhooks, uploads, partner endpoints). Without shared contract,
error, and deprecation shapes, every service reinvents them and
React can't discriminate errors uniformly across surfaces.
`traceId` ties back to [ADR 0031](0031-structured-logging-contract.md)
+ [ADR 0032](0032-runtime-observability.md).

## Decision Outcome

### Contracts — split by surface

GraphQL (primary surface) and REST/boundary inputs use
different validation engines, because the structural
constraints differ.

- **GraphQL**: `@InputType` / `@ObjectType` classes with
  `class-validator` decorators in `shared/contracts/<domain>/`.
  See the composition section below for why class-validator
  beats Zod here.
- **REST endpoints, config, headers, webhooks, queue
  messages, the `ApiError` response schema parsed by the
  React fetcher**: Zod 4. No `@InputType` class is mandatory
  at these boundaries, so Zod's structural advantages
  (refinements, issue trees, `.nullable().optional()`) win
  cleanly. Aligns with [ADR 0012](0012-drizzle-orm.md)'s
  `drizzle-zod` for the non-GraphQL ingress.

No framework wrapper (tRPC / ts-rest / oRPC) in the template.
ts-rest 3.53 is the named graduation for the REST surface if
drift bites.

### Error envelope — RFC 9457 Problem Details, hybrid

`Content-Type: application/problem+json` on every non-2xx
response. Standard members (`type`, `title`, `status`,
`detail`, `instance`) plus extensions allowed by the RFC:

```json
{
  "type": "https://errors.example.com/orders-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "Order ord_abc123 does not exist",
  "instance": "/v1/orders/ord_abc123",
  "code": "orders_not_found",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": [
    { "path": "id", "code": "invalid_format", "message": "must match ord_*" }
  ]
}
```

- `code` — stable string for client switching (taxonomy below)
- `traceId` — W3C trace id from the active OTel span
- `errors[]` — Zod issue tree flattened for multi-field 422s
- `detail` — stripped to a generic message for 5xx outside
  `APP_ENV=development`; real cause goes to the log line
  correlated by `traceId`

`ApiError` Zod schema in `shared/contracts/api-error.ts`.

### Error codes — domain-prefixed flat snake_case

Codes live in `shared/contracts/error-codes.ts` as a TS union:
cross-cutting (`validation_failed`, `unauthorized`,
`forbidden`, `rate_limit_exceeded`, `route_sunset`,
`internal_error`) plus per-domain
(`orders_not_found`, `payments_card_declined`, …). Domain
prefix matches the NX project name where possible.
`ApiError.code` is `z.enum(ApiErrorCodes)` — `pnpm typecheck`
rejects unknown codes on both server and client. Lint rule for
the prefix convention deferred until drift shows.

### NestJS exception filter — single `ApiException`

`shared/nest-errors/` exports `ApiException` (extends NestJS 11
`IntrinsicException` — silences the auto-logger for expected
4xx) with an options-bag constructor:

```typescript
throw new ApiException({
  status: 404,
  code: 'orders_not_found',
  title: 'Order not found',
  detail: `Order ${id} does not exist`,
});
```

Per-domain factory helpers in `shared/contracts/<domain>/errors.ts`
wrap common throws for ergonomics. Class hierarchies are an
optional convenience — codes are the discriminator.

Two filters share mapping logic in the same package:

- `AllExceptionsFilter` (REST): `ApiException` → emit fields;
  `ZodError` → 422 + `errors[]` (`code: 'validation_failed'`);
  unmapped `HttpException` → Problem Details with
  `code: 'internal_error'`; unknown → 500 + log with `traceId`.
- `GqlExceptionFilter` (GraphQL): same mapping; emits
  `errors[].extensions` with `code`, `http.status`, `traceId`,
  `errors`.

Both registered per service via `APP_FILTER`.

### Status codes — REST

| Situation | Code | Notes |
|---|---|---|
| Malformed JSON, parse fails | 400 | Framework returns before our filter |
| Zod validation failure | 422 | `code: 'validation_failed'`, `errors[]` |
| Auth missing/invalid | 401 | `WWW-Authenticate` header |
| Authenticated, not allowed | 403 | |
| Sunset route | 410 | Set by deprecation interceptor (below) |
| Rate limited | 429 | + `Retry-After` + RFC 9331 `RateLimit-*` |
| Planned outage | 503 | + `Retry-After` |
| Upstream timeout | 504 | |
| Server fault | 500 | `code: 'internal_error'`, detail stripped non-dev |

NestJS's `ValidationPipe` is configured to throw with status
422, not the framework default of 400.

### REST surface — narrow

Webhook receivers, file uploads, and partner REST endpoints
only. URL path versioning per the versioning section.

### GraphQL surface — Yoga, code-first

Primary surface for React → NestJS:

- **Server**: `graphql-yoga` via `@graphql-yoga/nestjs`
  (community-maintained — Apollo and Mercurius are the only
  first-party `@nestjs/graphql` drivers). Yoga's leaner
  runtime and Guild-stack alignment justify the
  non-first-party path.
- **Schema**: code-first (decorators → SDL emitted).
- **Errors**: `GqlExceptionFilter` emits
  `errors[].extensions.{code, http.status, traceId, errors}`.
  Same `code` union as REST. Always-200 means
  observability tracks `extensions.code` distribution as a
  metric — HTTP-status alerts miss application errors here.
- **Client**: `graphql-codegen` produces typed React hooks;
  TanStack Query owns cache / retry / optimistic updates.
  Apollo Client is not the default — codegen + TanStack
  matches the Yoga ecosystem and unifies with the REST fetch
  layer.

### Contract composition — Drizzle / class-validator / GraphQL

Four-layer shape per feature module. Same recipe across
every domain — new modules copy and rename.

| Layer | File | Library | Role |
|---|---|---|---|
| Persistence | `shared/db-<domain>/schema.ts` + exported vocabulary tuples | `drizzle-orm/pg-core` | Source of truth for columns + legal-value sets |
| Wire in | `<feature>.input.ts` | `@nestjs/graphql` + `class-validator` | `@InputType` classes; runtime field validation |
| Wire out | `<feature>.types.ts` | `@nestjs/graphql` | `@ObjectType` classes |
| Service | `<feature>.service.ts` — `XxxView` type | hand-written TS | Domain return shape; service accepts POJOs |

#### Why class-validator on `@InputType`, not Zod

Code-first GraphQL reads `Reflect.getMetadata` off
`@InputType()` classes to emit SDL. The class is mandatory —
no path from a Zod schema to an `@InputType` registration
without re-declaring the shape. class-validator decorators
piggy-back on the same class for free; one declaration,
two purposes. Picking Zod here means writing the class anyway
and using the Zod schema as a redundant second runtime check.

Evidence: the  IMS project shipped six feature
modules with this exact pattern after pivoting away from
`drizzle-zod` for the resolver layer. None of the three
candidate Zod → code-first GraphQL bridges
(`nestjs-graphql-zod`, `zod-to-nestjs-graphql`,
`zod-nestjs-graphql`) are alive in 2026.

#### Vocabulary — Drizzle exports `readonly` tuples

Per [ADR 0012](0012-drizzle-orm.md):

```typescript
// shared/db-product/src/schema.ts
export const PRODUCT_POST_RETURN_FLOWS = [
  'reimage', 'clean', 'inspect',
] as const;
export type ProductPostReturnFlow = typeof PRODUCT_POST_RETURN_FLOWS[number];
```

Reused in `@IsIn([...PRODUCT_POST_RETURN_FLOWS])` and in
service domain logic. Never re-typed inline. One source of
truth for legal-value sets.

#### Service boundary — POJOs, not class instances

Services accept plain TS object literals and return `XxxView`
types. The resolver hand-copies fields from the `@InputType`
instance into the service call. This keeps services
framework-free — specs are plain Vitest (`new
ProductService(mockDb, mockAudit)`), no NestJS bootstrap.

Service inputs are named TS types so the hand-copy is
compile-time-complete:

```typescript
// product.service.ts
export type CreateProductServiceInput = {
  brandId: string;
  name: string;
  /* … */
};

// product.resolver.ts
@Mutation(() => ProductType)
createProduct(@Args('input') input: CreateProductInput) {
  return this.service.create({
    brandId: input.brandId,
    name: input.name,
    /* TS rejects the call if a required field is missing */
  });
}
```

#### `Input` / `View` / `Type` triple is intentional

The three shapes share columns but serve distinct audiences:

- `CreateInput` — no `id` (generated server-side)
- `UpdateInput` — `id` required, all other fields partial
- `View` — domain shape; may include audit fields that don't
  leave the service
- `Type` — wire-out; may include derived fields
  (`inventoryCount`) that don't belong on `View`

Collapsing to one (e.g. `Type` ≡ `z.infer<Schema>`) forces
audiences to match and breaks at the first identifier
asymmetry or derived field. The duplication pays for
independent evolution.

#### PATCH semantics

Per the IMS pattern. Update inputs typed `T | null |
undefined`:

- `undefined` — leave unchanged
- `null` — clear
- value — set

Decorators: `@IsOptional()` + `validateWhenPresent` shim:

```typescript
const validateWhenPresent = ValidateIf(
  (_o, v: unknown) => v !== null && v !== undefined,
);
```

Service: `if (input.x !== undefined) patch.x = input.x;`.
The `validateWhenPresent` shim sits at the top of each
`<feature>.input.ts` file.

#### What this rules out

- **`drizzle-zod` at the GraphQL resolver layer.** Stays as a
  dependency only if a non-GraphQL ingress (REST, webhook,
  CLI, queue consumer) earns it.
- **Passing `@InputType` instances into services.** Couples
  the service to NestJS + class-validator runtimes; breaks
  plain Vitest specs.
- **Inferring `View` from `Type`** (or vice versa). The
  duplication is load-bearing.

#### Graduations

- **G1**: when the triple's per-field overhead becomes
  recurring PR-review noise, build a homegrown
  `tools/gen-gql-from-drizzle` codegen (in-repo, no external
  dep). Derives Input/View/Type skeletons from a single
  source.
- **G2**: migrate to **GQLoom** ([modevol-com/gqloom](https://github.com/modevol-com/gqloom),
  v0.16.0 Feb 2026, Yoga-native, official Drizzle plugin).
  Schema-first; reverses the code-first decision — new ADR
  supersedes that part.

#### Re-evaluate when

- `drizzle-orm@1.0` ships (the package folds into
  `drizzle-orm/zod`; codemod the import path)
- GQLoom crosses ~500 stars / picks up a NestJS adapter
- `class-validator` + `@nestjs/graphql` decorator metadata
  becomes incompatible with the team's TS toolchain

### Versioning & deprecation — same lifecycle, different mechanism

Same announce → monitor → sunset lifecycle on both surfaces;
different on-the-wire mechanism.

| Stage | REST | GraphQL |
|---|---|---|
| **Default** | URL path `/v1/` via `VersioningType.URI` | None — field-level evolution |
| **Announce** | `@Deprecated({ sunset, successor })` decorator → `Deprecation` (RFC 9745) + `Sunset` (RFC 8594) + `Link rel="successor-version"` headers | `@deprecated(reason)` SDL directive |
| **Monitor** | Access logs on the deprecated path | GraphQL Inspector / Yoga `usage` plugin |
| **Sunset** | Route returns 410 `code: 'route_sunset'` | Field removed; codegen breaks clients at compile time |
| **Major rewrite** | `/v2/` alongside `/v1/`; Stripe-style date headers as graduation | New field name; old deprecated. Shopify-style date-pinned endpoint as last-resort. |

External-facing routes: 6-month minimum sunset window.
Internal: team's call. `shared/nest-versioning/` holds the
decorator, interceptor, and `route_sunset` wiring.

### Subscriptions — shape now, operations later

Real-time GraphQL over WebSocket. Settle the wire contract;
defer operations.

- **Transport**: `graphql-ws` protocol (replaces deprecated
  `subscriptions-transport-ws`). Yoga + codegen ship it. WSS
  in prod.
- **Auth**: token in `connectionParams` on `connection_init`;
  server validates before first `subscribe`. Token refresh =
  close + reopen.
- **Errors**: in-band Problem Details inside an `error`
  message frame. Connection-terminating failures use WS close
  codes 4401 / 4403 / 4429.

Deferred to first-adopter addendum: pubsub backend,
multiplexing, per-tenant quotas, long-lived-socket
observability.

## Consequences

### Positive

- **One discriminator across surfaces** — same `code` in REST
  `ApiError.code` and GraphQL `errors[].extensions.code`.
- **Vendor-neutral contracts** — Zod survives any future
  framework choice.
- **Trace correlation by construction** — `traceId` ties
  errors to ADR 0031 / 0032.
- **Deprecation enforced, not remembered** — `@Deprecated`
  decorator; 410 after sunset.

### Negative

- **Yoga + NestJS isn't first-party.** Community adapter is
  the seam; fallback is Apollo or a custom module.
- **Always-200 GraphQL inverts observability** — HTTP-status
  alerts miss app errors; need `extensions.code` metric.
- **Three declarations of (mostly) the same shape per entity**
  — Input + View + Type. ~7 places per added field. Mitigated
  by named service input types (compile-time completeness)
  and Drizzle vocabulary-tuple reuse. G1 codegen exists if
  this becomes a recurring cost.
- **`class-validator` + `@nestjs/graphql` both depend on
  `emitDecoratorMetadata`** — fragile under tsgo / strip-only
  TS modes ([ADR 0003](0003-typescript-strict-tsgo.md)).
  Migrating off the decorator stack would touch every input
  / output class.
- **Two validation libraries** — class-validator for GraphQL
  inputs; Zod for non-GraphQL boundaries. Mental overhead
  trade for the no-double-declaration win.
- **`validateWhenPresent` is easy to forget** on a new
  nullable field — validators run on `null` and reject.
  Caught by tests but easy to miss in review.

### Neutral

- REST is a minority surface; most code path is GraphQL.
- Subscriptions deferred at the operational layer.
- `instance` leaks request paths — fine for API threat model;
  per-route opt-out if anonymous-discovery is a concern.

## Alternatives considered

1. **tRPC v11 default** — best TS-only DX; mismatch for
   non-TS clients and REST-shape APIs.
2. **oRPC 1.0 default** — Dec 2025 GA, compelling but low
   LLM-corpus; revisit after 12 months.
3. **Apollo driver + Apollo Client** — first-party, biggest
   corpus, loses Guild alignment and bundles heavier.
4. **Zod via `nestjs-zod` for GraphQL inputs** — the original
   spike answer. Rejected after  IMS evidence:
   the `@InputType` class is mandatory regardless, making
   Zod a redundant second declaration. class-validator on the
   same class is free.
5. **Pass `@InputType` instance to services** — couples the
   service to NestJS + class-validator runtimes; breaks plain
   Vitest specs; opens the "assume validated" trap.
6. **Collapse Input/View/Type to one shape** — forces
   audiences to match; breaks at identifier asymmetry
   (`CreateInput` no `id`; `Type` always has it) and derived
   fields.
7. **Schema-first GraphQL (SDL files + generated types)** —
   reverses code-first; costs a codegen step. GQLoom (G2) is
   the named graduation if this becomes worth it.
8. **Strict RFC 9457, no extensions** — interoperable but
   loses `code` / `traceId` ergonomics. Extensions allowed.
9. **Vendored envelope** (`{ error: {…} }`) — zero interop
   with problem+json tooling.
10. **URL versioning on GraphQL** — anti-pattern in 2026;
    field-level deprecation is standard.
11. **Hierarchical codes (`type` + `code`)** — overloads RFC
    9457 `type` URI; over-engineered for the template.

## Relationship to prior ADRs

- **Settles the Yoga vs Apollo choice left open in
  [0010](0010-nestjs-backend.md)** (Yoga).
- **References [0011](0011-frontend-frameworks.md)** — React
  consumes GraphQL via codegen + TanStack Query.
- **References [0012](0012-drizzle-orm.md)** — `drizzle-zod`
  is the DB-side Zod source; composition pattern resolved in
  the Contract composition section.
- **Builds on [0031](0031-structured-logging-contract.md) +
  [0032](0032-runtime-observability.md)** — `traceId` ties to
  the active OTel span.

## References

- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [RFC 9745 — Deprecation HTTP Header](https://www.rfc-editor.org/rfc/rfc9745)
- [RFC 8594 — Sunset HTTP Header](https://www.rfc-editor.org/rfc/rfc8594)
- [Zod 4 docs](https://zod.dev/v4)
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [graphql-ws protocol](https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md)
- [`class-validator` docs](https://github.com/typestack/class-validator)
- [`drizzle-zod` docs](https://orm.drizzle.team/docs/zod) — kept for non-GraphQL boundaries
- [GQLoom](https://github.com/modevol-com/gqloom) — schema-first graduation
