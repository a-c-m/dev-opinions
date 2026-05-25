---
date: 2026-05-25
tags: [backend, async, jobs, workers, webhooks, inngest, postgres]
---

# ADR 0042: Async work & external integrations — jobs and webhooks

## Context and Problem Statement

Three closely related patterns sit outside the synchronous request cycle and end up reinvented per service without a convention:

1. **Background jobs** — work that doesn't have to happen on a user's request: cache cleanup, report generation, file processing, scheduled tasks.
2. **Webhooks in** — receiving signed events from third parties (Stripe, Twilio, GitHub). The provider retries on non-200, so slow inline processing causes duplicate deliveries.
3. **Webhooks out** — sending signed events to our consumers, with at-least-once delivery, retries, and idempotency.

All three share the same primitives: **durable state for in-flight work**, **idempotency keys**, **retry with backoff**, and **observability of work that doesn't appear in HTTP traces**. Sync-only resilience (rate limiting, caching) is in [ADR 0041](0041-request-cycle-resilience.md).

The repo's pattern is "Postgres until you NEED something else." This ADR fixes what that looks like, and where the line is.

## Decision Outcome

### Background jobs — DIY on Postgres day-one, Inngest as graduation

**Day-one**: a hand-rolled jobs table + worker loop. ~100 LOC in `shared/jobs/`.

```sql
CREATE TABLE jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status        job_status  NOT NULL DEFAULT 'pending',  -- enum: pending|running|done|failed
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts      INT         NOT NULL DEFAULT 0,
  max_attempts  INT         NOT NULL DEFAULT 5,
  last_error    TEXT,
  dedup_key     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, dedup_key)
);

CREATE INDEX jobs_ready ON jobs (run_at) WHERE status = 'pending';
```

Worker claims work with the load-bearing Postgres trick:

```sql
SELECT * FROM jobs
WHERE status = 'pending' AND run_at <= now()
ORDER BY run_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

`FOR UPDATE SKIP LOCKED` is what makes this safe under concurrent workers — each worker sees a different pending row and they never fight.

- **Retry**: exponential backoff (`run_at = now() + min(2^attempts seconds, 1 hour)`).
- **Idempotency**: `(name, dedup_key)` UNIQUE — `INSERT … ON CONFLICT DO NOTHING` to enqueue safely.
- **Scheduled work**: cron-style triggers live in a separate `job_schedules` table; a tick worker materialises ready schedules into `jobs` rows.
- **Observability**: each job execution is an OTel span ([ADR 0032](0032-runtime-observability.md)); queue depth + failure rate are Prometheus gauges.
- **Process model**: the worker is a separate NX project (`apps/<product>/worker/`) so it deploys and scales independently of HTTP services. The container shape is the standard one from [ADR 0023](0023-container-conventions.md).

**Graduation to Inngest** when *any* of:

1. You need **fan-out / parallel branches** in a job (`step.parallel(...)` is exactly what Inngest does well).
2. You need **durable function semantics across deploys** — long-running flows that survive container restarts mid-flight without DIY checkpointing.
3. **Operational complexity outgrows the DIY layer** — concurrency controls per-key, debounce, structured retries with replay UI all become Inngest features you'd otherwise reimplement.

Inngest is the named graduation, not pg-boss / BullMQ / Temporal. Pg-boss is essentially "the DIY pattern above, packaged" — if you reach for it, you've added a dep without changing the graduation lever. BullMQ requires Redis (additional infra). Temporal is industrial-strength but heavyweight to operate.

### Webhooks in — inbox pattern

The endpoint validates and stores; the worker processes. **Return 200 on receipt, not on completion.**

Flow:

1. **Validate signature** against the raw request body. The signature middleware must read the raw bytes — register it before any JSON parser. Provider-specific HMAC SHA-256 against a shared secret from [ADR 0034](0034-secrets-runtime-injection.md).
2. **Insert into `webhook_inbox`** with the provider's event ID as a UNIQUE column:
   ```sql
   CREATE TABLE webhook_inbox (
     provider     TEXT        NOT NULL,
     event_id     TEXT        NOT NULL,
     payload      JSONB       NOT NULL,
     received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     processed_at TIMESTAMPTZ,
     PRIMARY KEY (provider, event_id)
   );
   ```
   `INSERT … ON CONFLICT DO NOTHING` — a duplicate delivery is a no-op.
3. **Enqueue a job** (`webhook.process`) carrying the inbox row's primary key.
4. **Return 200** immediately. Total endpoint work: signature check + one insert + one job enqueue. Should be <50ms.

The worker is what fails and retries — that's load on us, not load on the provider. The provider sees a 200, stops retrying, and we own the processing reliability.

### Webhooks out — outbox pattern

The state change and the intent-to-deliver are written in the same database transaction. A worker drains the outbox.

```sql
CREATE TABLE webhook_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID        NOT NULL REFERENCES webhook_consumers(id),
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  status          delivery_status NOT NULL DEFAULT 'pending',  -- pending|delivered|abandoned
  attempts        INT         NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The drain worker:

1. Claims rows with `FOR UPDATE SKIP LOCKED` (same trick).
2. Builds the payload, signs it (HMAC SHA-256 over body with the per-consumer secret), POSTs.
3. **Retry policy**: exponential backoff on 5xx, timeouts, network errors. **Do-not-retry on 4xx** (except 429, which honours `Retry-After`). After `max_attempts`, status flips to `abandoned` and an alert fires.
4. Successful delivery marks `status = 'delivered'`; the row stays for audit (TTL'd by the cache-cleanup pattern from [ADR 0041](0041-request-cycle-resilience.md)).

**Why outbox not "POST in the request handler"**: a POST after a DB commit can fail to reach the consumer; the database is the only thing that knows the truth. Writing both in one transaction is the only at-least-once contract that doesn't require distributed transactions.

## Consequences

### Positive

- **No new infra day-one** for any of the three patterns. Postgres + worker process, both already in the stack.
- **`FOR UPDATE SKIP LOCKED` is load-bearing and well-understood** — same pattern across jobs, inbox processing, outbox delivery.
- **Webhook reliability is decoupled from request reliability** — slow processors don't cause provider retry storms.
- **Audit trail in PG** for every webhook in and out — incident response has rows to read instead of logs to scrape.
- **Graduation is clean**: Inngest replaces the worker process, leaves the table schema alone (consumer code keeps working during the swap).

### Negative

- **Workers are now a deployable** — every service that uses jobs needs a worker process in its `apps/<product>/worker/` slot, plus the container + deploy plumbing.
- **The `jobs` table grows.** Periodic prune of completed rows (status='done' AND updated_at < now() - interval '7 days') is a required scheduled job.
- **DIY semantics have edges.** Lost lock during long-running jobs, clock skew on `run_at`, worker crash mid-job. Mitigations in the implementation; pathological cases are exactly what triggers graduation.
- **Outbox throughput is bounded by DB write throughput.** For >100 events/sec sustained, this becomes a hotspot — graduate.

### Neutral

- **Postgres as the queue is well-trodden ground.** GitHub, Sidekiq Pro, and pg-boss all ride this pattern; the prior art is solid.
- **No Kafka, no SQS, no RabbitMQ** until there's a stated need (cross-service fan-out, retention beyond 7 days, ordering guarantees beyond a single key). Most apps don't need them.

## Alternatives considered

1. **pg-boss day-one** — same shape as the DIY pattern, packaged. Rejected as default because it locks the graduation lever to "more pg-boss" instead of "Inngest or something else"; the DIY layer is ~100 LOC and stays under our control. Acceptable choice if a team prefers the wrapper.
2. **BullMQ + Redis day-one** — Redis as new infra, queue semantics in a sidecar service. Rejected for the same reason Redis caching is rejected in [ADR 0041](0041-request-cycle-resilience.md) — solves a problem we don't have yet.
3. **Inngest day-one** — managed durable functions are excellent but introduce a third-party dependency on the critical path before we've validated the work shape. Rejected as default; named as the graduation.
4. **Temporal** — industrial-grade workflow engine. Right answer for genuinely complex long-running orchestrations; massive operational footprint. Rejected for now; revisit if Inngest itself becomes the bottleneck.
5. **Sync webhook processing** (no inbox) — simplest possible, but at the cost of duplicate deliveries every time processing is slower than the provider's retry timeout. Rejected.
6. **Direct POST for webhooks-out** (no outbox) — simplest until the first lost delivery after a crash between commit and POST. The outbox is the only at-least-once contract without distributed transactions. Rejected.

## Related

- [ADR 0010](0010-nestjs-backend.md) — Nest is the worker process framework; same DI patterns as HTTP services.
- [ADR 0012](0012-drizzle-orm.md) — Drizzle schemas for `jobs`, `webhook_inbox`, `webhook_outbox` live in `shared/db-<domain>/`.
- [ADR 0023](0023-container-conventions.md) — worker container shape (no HTTP, no `/healthz` requirement; readiness via Postgres ping).
- [ADR 0032](0032-runtime-observability.md) — jobs and webhook deliveries emit OTel spans + metrics.
- [ADR 0033](0033-api-contracts-and-errors.md) — webhook-in endpoints use the standard problem-details envelope for signature failures.
- [ADR 0034](0034-secrets-runtime-injection.md) — webhook signing keys are secrets, injected at runtime.
- [ADR 0036](0036-safe-database-migrations.md) — migrations for the three new tables follow the expand/contract rules.
- [ADR 0041](0041-request-cycle-resilience.md) — sync sibling.
- [Inngest docs](https://www.inngest.com/docs) — durable function model, what graduation looks like.
- [Postgres `SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — the load-bearing primitive.
- [Outbox pattern — microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
