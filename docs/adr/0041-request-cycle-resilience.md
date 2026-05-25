---
date: 2026-05-25
tags: [api, backend, rate-limiting, caching, resilience]
---

# ADR 0041: Request-cycle resilience — rate limiting & caching

## Context and Problem Statement

Two cross-cutting backend concerns live in every service and end up reinvented per-app without a convention: **rate limiting** (protecting the service from over-use) and **caching** (avoiding work the service already did). Both are *synchronous, request-cycle* concerns — they happen on the call path of a single HTTP/GraphQL request, in-process, with no durable state in flight.

Async concerns (background jobs, webhooks, the outbox/inbox pair) are out of scope here — see [ADR 0042](0042-async-work-and-webhooks.md).

The repo's stated pattern is "Postgres until you NEED something else." This ADR ratifies what that looks like for these two slots and defines the graduation lever for each.

## Decision Outcome

### Rate limiting — `@nestjs/throttler`

Use Nest's first-party throttler. It exists, it's well-maintained, and the decision is *policy* rather than *library*.

- **Module registration** at the app root with global defaults: `100 requests / minute` for anonymous traffic, `1000 / minute` for authenticated. Tunable per-route via `@Throttle({ ... })`.
- **Identifier**: user ID when authenticated (via the `AuthOutcome` from [ADR 0037](0037-authentication.md)); IP fallback otherwise. Implemented via a small `ThrottlerGuard` subclass — `<10 LOC`.
- **Skip the health endpoints**: `@SkipThrottle()` on `/healthz` and `/readyz` per [ADR 0023](0023-container-conventions.md). Otherwise the orchestrator's probe traffic eats the budget.
- **Storage**: in-memory day-one (single replica is fine). Graduate to `@nest-lab/throttler-storage-redis` when running >1 replica behind a load balancer — that's the trigger, not "we should use Redis."
- **Error shape**: 429 responses go through the global `ApiException` filter and emit RFC 9457 Problem Details per [ADR 0033](0033-api-contracts-and-errors.md), with `Retry-After` populated from the throttler.
- **Observability**: throttle decisions surface as OTel span attributes (`throttle.allowed`, `throttle.remaining`) per [ADR 0032](0032-runtime-observability.md). A counter metric tracks 429s.

### Caching — layered, not centralised

Three layers, each with a defined responsibility. Don't reach for a fourth (Redis) without a stated reason.

**Layer 1 — HTTP response headers**

For idempotent GETs that can be cached:

- `Cache-Control: public, max-age=N` for genuinely public data; `private, max-age=N` for user-scoped responses.
- `ETag` for conditional GETs (Nest serves `304 Not Modified` automatically when set).
- `Vary: Authorization` on any authenticated response (otherwise a shared cache returns one user's payload to another).
- `Cache-Control: no-store` for anything PII-bound or session-bound — the default for unmarked endpoints.

**Layer 2 — React Query (client)**

Per [ADR 0011](0011-frontend-frameworks.md). Repo-wide defaults set once at the `QueryClient`:

```ts
{
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  retry: 1,
}
```

Per-query overrides for known-volatility data (live counters: `staleTime: 0`; immutable config: `staleTime: Infinity`).

**Layer 3 — Postgres-as-cache (server)**

For expensive computations the service genuinely repeats. A single shared `cache_entries` table in `shared/db-cache/`:

```sql
key         TEXT PRIMARY KEY,
value       JSONB NOT NULL,
expires_at  TIMESTAMPTZ NOT NULL,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

A thin `@shared/cache` wrapper exposes `get(key)`, `set(key, value, ttl)`, `invalidate(key)`, `invalidatePrefix(prefix)`. Cleanup runs as a scheduled job ([ADR 0042](0042-async-work-and-webhooks.md)) — `DELETE WHERE expires_at < now()` nightly.

Why Postgres? It's already there, it's already observable, it's already backed up. The latency overhead vs Redis is ~1ms on a warm pool — irrelevant unless the cache itself is the bottleneck, which it almost never is until you have a stated p99 budget that says so.

**Graduation to Redis** when *any* of:

1. You need <1ms cache reads on the hot path (rare).
2. You need pub/sub for cross-instance invalidation (`@shared/cache` API would gain `subscribe()`).
3. The cache table is causing measurable bloat in your DB backups.

Until then: Postgres.

## Consequences

### Positive

- **No new infra day-one.** Throttler + React Query + Postgres are all already in the stack.
- **Graduation triggers are explicit.** "We have >1 replica" → Redis-backed throttle. "We need pub/sub invalidation" → Redis cache. No ambient drift toward complexity.
- **Error shape is unified.** 429s flow through the same problem-details envelope as every other error ([ADR 0033](0033-api-contracts-and-errors.md)).
- **Observability is free.** Both layers emit OTel attributes and metrics through the existing collector.

### Negative

- **Single-replica throttle is a footgun if forgotten on graduation.** Without Redis storage, each replica enforces its own counter — a 100/min limit becomes effectively 100×N/min across N replicas. The deploy ADR should call this out at the moment of horizontal scale-out.
- **Postgres-as-cache is a row hotspot if abused.** A high-write cache key creates a vacuum-heavy table. Keep per-key write rates sane or graduate.
- **`Vary: Authorization` defeats CDN caching.** That's correct (don't share authed responses across users), but means CDN-cached endpoints must be unauthenticated.

### Neutral

- **No global `CacheInterceptor`.** `@nestjs/cache-manager` exists but the decision is which *layer* caches, not which Nest wrapper imports it. Skipping the interceptor keeps the layering explicit.
- **Rate limit policy is per-service.** Defaults at 100/1000 are starting points; each service tunes via `@Throttle()` on hot routes.

## Alternatives considered

1. **Redis day-one for both** — wrong tradeoff for the day-one case (one replica, low traffic). Adds a service, adds a failure mode, adds OPS surface. Rejected; kept as the named graduation.
2. **`@nestjs/cache-manager` as the cache API** — wraps `cache-manager` and lets you swap stores, but doesn't answer the layering question. Skipped; `@shared/cache` is ~30 lines and owns the Postgres-as-cache decision directly.
3. **CDN-only caching (no app-layer)** — works for static or fully public content; insufficient for authenticated GETs and computed responses. Composes with layer 1 but doesn't replace it.
4. **`fastify-rate-limit`** — Fastify-native, slightly less ceremony than `@nestjs/throttler`. Rejected because it sits below Nest's DI lifecycle, making "throttle by authenticated user ID" awkward. Throttler integrates with the guard chain.

## Related

- [ADR 0010](0010-nestjs-backend.md) — NestJS as the backend; throttler module lives here.
- [ADR 0011](0011-frontend-frameworks.md) — React + Vite; React Query is the client cache.
- [ADR 0023](0023-container-conventions.md) — `/healthz` and `/readyz` must be exempt from rate limits.
- [ADR 0033](0033-api-contracts-and-errors.md) — 429 problem-details shape.
- [ADR 0032](0032-runtime-observability.md) — throttle and cache OTel attributes.
- [ADR 0037](0037-authentication.md) — `AuthOutcome` drives the user-vs-IP throttle key.
- [ADR 0042](0042-async-work-and-webhooks.md) — async sibling; cache cleanup runs as a scheduled job.
- [`@nestjs/throttler` docs](https://docs.nestjs.com/security/rate-limiting)
- [TanStack Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
