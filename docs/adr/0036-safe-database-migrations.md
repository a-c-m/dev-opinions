---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0036: Safe database migrations

## Context and Problem Statement

Schema migrations are high-blast-radius operations: a bad one
takes the service down and rarely warns first. Most ship fine
as a routine deploy step, but two situations need explicit
handling and aren't covered by [ADR 0012](0012-drizzle-orm.md)
or [ADR 0005](0005-package-script-conventions.md):

1. **High-risk or long-running migrations** — drops, type
   changes, populated-table backfills. The migration command
   is the same; what changes is whether you watch it run.
2. **Multi-server / concurrent-actor races** — multiple replicas,
   concurrent CI workflows, hotfix during a release. Without
   coordination, two migrate processes can both think a
   migration is pending and apply it twice.

This ADR settles both: two execution paths (auto vs supervised)
sharing the same SQL via the same command, with a Postgres
advisory lock making concurrent triggers safe.

## Decision Outcome

### Two paths, same SQL, same command

`drizzle-kit migrate` is **idempotent** — it consults
`__drizzle_migrations` and applies only what's pending.
Combined with an advisory lock (below), two callers can race
safely.

**Path A — automated (default).** `deploy-prod.yml` runs
`pnpm --filter @shared/db-<domain> db:migrate` as a step
*before* promoting new pods. Operator does nothing. Default for
every migration unless one of the triggers below applies.

**Path B — supervised (exception).** Operator triggers
`db-migrate.yml` (`workflow_dispatch`) *before* kicking off the
deploy. When the deploy runs, its inline `db:migrate` step
finds the migration already applied and no-ops.

Choose **Path B** when:

- The PR's Squawk lint flagged a HIGH-severity rule and you
  accepted it with a per-file exclude (drops, type changes,
  missing `NOT VALID`, etc. — Squawk is the Postgres migration
  linter that catches dangerous DDL at PR time, see Linting
  below)
- Target table is "large by your fork's standards" — your
  sanitised stage clone ([ADR 0025](0025-production-data-flow.md))
  took noticeable time
- A backfill follows the DDL (the backfill itself is a
  separate Job — see Long-running migrations)
- High-blast-radius surface (auth, sessions, payments,
  tenancy keys)
- A migration failed in CI and you're investigating

Both paths call the same reusable `_db-migrate.yml` workflow
([ADR 0021](0021-github-actions-ci.md)) so the SQL execution
shape can't drift between them. The runbook at
[docs/runbooks/supervised-db-migrations.md](../runbooks/supervised-db-migrations.md)
covers Path B execution.

### Concurrent-runner safety — Postgres advisory lock

Every `db:migrate` invocation runs through a wrapper that:

1. Opens a connection.
2. `SELECT pg_try_advisory_lock(<hash-of-package-name>)`. If
   false, exit non-zero: *"another migration in progress for
   `@shared/db-<domain>`; retry after it completes."* Fail
   fast; no retry-with-backoff in the script.
3. `SET lock_timeout = '3s'; SET statement_timeout = '15min';`
   on the same connection.
4. Invokes drizzle's programmatic `migrate()` from
   `drizzle-orm/postgres-js/migrator` — *not* the
   `drizzle-kit migrate` CLI, which doesn't give us the
   connection control needed for steps 1–3.
5. Releases the lock on exit.

This makes Path A and Path B safe under concurrent triggers:
hotfix-during-release, two operators reaching for
`workflow_dispatch`, a CI runner retry overlapping the
original. The second caller fails fast; no partial state.

**Boot-time migration (`migrate()` in `main.ts`) is rejected.**
With >1 replica per [ADR 0023](0023-container-conventions.md),
rolling-deploy replicas race. The advisory lock helps but
doesn't fix "two replicas thought it was their job." Run from
CI, not from app pods.

**`drizzle-kit push` is dev-only.** Drizzle's own docs ban it
in prod — it bypasses the migration file system and can
silently skip changes. Enforced by ADR text + PR review; same
posture as the long-lived-cloud-keys rule in
[ADR 0034](0034-secrets-runtime-injection.md).

### `lock_timeout = 3s` — the canonical safety knob

`lock_timeout = 3s` aborts the migration before it can queue
an `ACCESS EXCLUSIVE` behind a long-running `SELECT` and stall
every subsequent query (the canonical failure mode). The
migration runner enforces this — drift is not a per-migration
option. Migrations that genuinely need longer raise
`statement_timeout` (not `lock_timeout`) *for that session
only*, with a comment in the migration file explaining why.

### Pattern — expand / contract, forward-only, additive-first

Every schema change decomposes into safe DDL primitives:

- **Expand** — add the new shape additively
  (`ADD COLUMN … NULL`, `CREATE INDEX CONCURRENTLY`,
  `ADD CONSTRAINT … NOT VALID`)
- **Backfill** — batched `UPDATE` with cursors (no full-table
  rewrite); see Long-running migrations
- **Validate** — `VALIDATE CONSTRAINT`; promote `NULL` →
  `NOT NULL` only after backfill is verified
- **Contract** — drop the old shape, minimum two releases
  later (see N-1 rule)

**Forward-only.** drizzle-kit 1.x has no `down` command; the
v1 roadmap line for rollback is unchecked. Practically
permanent. Catastrophic recovery = PITR / snapshot, never down
migrations. To fix a broken migration, write a new roll-forward
migration.

**Additive-first.** Never `ALTER COLUMN … SET NOT NULL`
directly on a populated table. Never `ADD COLUMN … DEFAULT
<volatile expr>` (Postgres ≥11 makes *constant* defaults
metadata-only; volatile defaults still rewrite the heap).
Never `DROP COLUMN` until both N-1 and N reads are gone.

### Linting — Squawk

**Squawk** ([sbdchd/squawk](https://github.com/sbdchd/squawk))
is a Postgres-specific SQL linter that flags dangerous DDL
patterns — missing `CONCURRENTLY` on index creation,
`ADD CONSTRAINT` without `NOT VALID`, `DROP COLUMN`,
`ALTER COLUMN` type changes, etc. Used at PR time before the
migration ever runs.

`sbdchd/squawk-action@v2` is a required PR check on
`shared/db-*/drizzle/**/*.sql`. `.squawk.toml` pins
`pg_version = "16.0"` and `assume_in_transaction = true`.

Known false positive: `require-concurrent-index-creation`
inside transactions (Squawk issue #331). Exclude per-file
via `-- squawk-ignore require-concurrent-index-creation`,
*not* by disabling the rule globally. An accepted HIGH-severity
Squawk verdict is one of the triggers for Path B above.

### Rolling-deploy compatibility — old code, new schema

This is why "additive-first" is non-negotiable and why drops
take three releases.

In Path A, the migration runs *before* pod promotion. There is
no moment when new code sees the old schema. But every Path A
deploy has a window where **old code sees the new schema**:

| Phase | Schema | Code | Notes |
|---|---|---|---|
| 1. Steady state | N | N | — |
| 2. Migration runs | N+1 | N | **Critical window: old code, new schema** |
| 3. Pods rolling | N+1 | mixed N + N+1 | Both old and new code talk to the same N+1 schema |
| 4. Steady state | N+1 | N+1 | — |

Phases 2 + 3 last for the rolling deploy duration — seconds
to minutes depending on the orchestrator's promotion strategy
and bake time. The schema is single; the code is plural. There
is no point at which "some servers see the old schema and
others see the new" — there's one database. The variation is
in *which code version* is running against the *single current
schema*.

**Additive-first guarantees old code keeps working during
phases 2 and 3:**

- New columns are nullable → old code that doesn't write them
  produces `NULL`, which the column allows
- New indexes / new tables / new `NOT VALID` constraints
  don't conflict with old code's queries
- Default values are constant (metadata-only) so heap layout
  doesn't shift under old code mid-deploy

**Drops invert the problem.** Removing a column the moment
you remove writes from code is unsafe — old code still running
during phases 2–3 of *that* deploy might write to it. Hence
the three-release dance:

| Release | Action | Reads `col`? | Writes `col`? |
|---|---|---|---|
| N | Add replacement; write to both | Yes | Both |
| N+1 | Stop reading `col`; read replacement | No | Old still |
| N+2 | Stop writing `col`; drop the column | No | No |

By release N+2, no code at any version in the rolling
overlap touches `col`. Drop is safe.

The 410-after-sunset pattern from
[ADR 0033](0033-api-contracts-and-errors.md)'s versioning
section is the API-shape equivalent of this rule.

**Exception:** internal idle workloads (cron with no
concurrent runners) that you can *prove* aren't in flight
during the deploy can collapse the window with explicit
downtime.

### Long-running migrations — backfills are separate Jobs

For any backfill over a few seconds, the DDL adds the column
*nullable* and finishes fast. The backfill itself is a
**separate operator-run Job**, not part of `db:migrate`:

```sql
-- runs in a Job / one-off task, NOT the migrate runner
UPDATE orders SET new_col = derive(old_col)
  WHERE id > $cursor
  ORDER BY id
  LIMIT 10000;
```

Loop with a cursor; ~10k rows per batch; pause if replication
lag climbs >5s. Constraint validation (`VALIDATE CONSTRAINT`,
`NULL` → `NOT NULL`) is a *follow-up* migration after the
backfill is verified — that follow-up can ship via Path A.

**pgroll** ([xataio/pgroll](https://github.com/xataio/pgroll),
v0.16.1 Feb 2026) automates expand/contract with versioned
views. Named as graduation when (a) a table needs dual-schema
views during a rolling deploy and (b) pgroll ships 1.0 stable
(currently pre-1.0 with file-format churn).

### Per-package scripts

One migration history per `shared/db-<domain>/` package per
[ADR 0012](0012-drizzle-orm.md). Each package's `package.json`
per [ADR 0005](0005-package-script-conventions.md):

- `db:generate` — `drizzle-kit generate`
- `db:migrate` — the wrapper above (advisory lock + timeouts +
  programmatic `migrate()`)
- `db:migrate:dry` — apply against an ephemeral container, used
  by CI for shape validation

CI workflows:

- `_db-migrate.yml` — reusable; takes a package name input
- `db-migrate.yml` — operator-triggered (`workflow_dispatch`)
- `deploy-prod.yml` — calls `_db-migrate.yml` inline before
  pod promotion

### What this defers

- **Atlas as alternative linter** — only relevant with a second
  ORM; we're single-ORM
- **SQLite migration nuance** — [ADR 0012](0012-drizzle-orm.md)
  scopes SQLite to local-first / CLI; prod is Postgres. SQLite
  schemas stay append-only or accept a maintenance window

## Consequences

### Positive

- **Two clearly-named paths** with the trigger criteria
  spelled out — agents and humans can pick correctly.
- **Concurrent triggers are safe by construction** —
  advisory lock + idempotency. Hotfix-during-release stops
  being a coordination nightmare.
- **Predictable migrations** — `lock_timeout = 3s` makes
  "stall the whole DB" structurally hard.
- **Forward-only ends the rollback-script debt trap.**
- **Squawk catches well-known footguns at PR time.**

### Negative

- **Three-release drop cycle is real overhead** for routine
  column removals. Accepted — alternative is downtime.
- **`lock_timeout` aborts can confuse first-time operators.**
  Runbook documents "this is the system working as intended."
- **drizzle-kit is pre-1.0** (`1.0.0-rc.3` at time of writing).
  Track the v1 release; revisit forward-only if rollback
  support lands.
- **Backfills are separate Jobs** — one more artefact to
  deploy and monitor.

### Neutral

- pgroll graduation deferred until 1.0 + a real dual-schema need
- SQLite handling kept simple
- No lefthook hook for `drizzle-kit push` — PR review and the
  deploy job's `migrate` call are the controls

## Alternatives considered

1. **Down migrations** — practically permanent forward-only
   wins on every survey (Atlas, Spatie, Graphile Migrate).
   Untested code; rarely runs successfully under pressure.
2. **Boot-time `migrate()`** — races on >1 replica even with
   advisory locks. Acceptable only for single-instance serverless.
3. **`drizzle-kit push` in prod** — banned by Drizzle docs;
   silently skips changes.
4. **pgroll as default** — pre-1.0 file-format churn; overkill
   for sub-100M-row tables.
5. **Atlas as the apply tool + linter** — opinionated; only
   wins when supporting multiple ORMs.
6. **Single global migration script** at repo root — couples
   unrelated DB packages; one bad migration blocks unrelated
   deploys.

## Relationship to prior ADRs

- **Builds on [0012](0012-drizzle-orm.md)** — schemas + per-package
  migration histories
- **Realises [0005](0005-package-script-conventions.md)** —
  `db:migrate` is now a defined, safe verb
- **Consumed by [0024](0024-branching-releases-environments.md)**
  — `deploy-prod.yml` runs migrations before pod promotion
- **References [0025](0025-production-data-flow.md)** — sanitised
  stage clones are the only honest dry-run target
- **References [0026](0026-runbook-and-sop-format.md)** —
  runbook at `docs/runbooks/supervised-db-migrations.md`

## References

- [GoCardless — Zero-downtime Postgres migrations](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/)
- [Benchling — Move fast and migrate things](https://benchling.engineering/move-fast-and-migrate-things-how-we-automated-migrations-in-postgres-d60aba0fc3d4)
- [Atlas — The Myth of Down Migrations](https://atlasgo.io/blog/2024/04/01/migrate-down)
- [Squawk](https://github.com/sbdchd/squawk) — Postgres migration linter
- [pgroll](https://github.com/xataio/pgroll) — named graduation
- [Drizzle v1 roadmap](https://orm.drizzle.team/roadmap)
