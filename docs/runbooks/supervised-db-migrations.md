# Supervised database migrations

## Overview

**This runbook is for the supervised exception path
(Path B per [ADR 0036](../adr/0036-safe-database-migrations.md)),
not the everyday automated path.**

The default flow (Path A): migrations apply automatically as a
step in `deploy-prod.yml` *before* new pods promote. Operator
does nothing. Most migrations ship this way.

Take Path B (this runbook) only when one of:

- Squawk flagged a HIGH-severity rule and the PR took a
  per-file exclude (drops, type changes,
  `constraint-missing-not-valid`, etc.)
- Target table is "large by your fork's standards" — your
  stage dry-run took noticeable time
- A backfill follows the DDL (the backfill itself is a
  separate Job, *not* `db:migrate` — see step 5)
- High-blast-radius surface (auth, sessions, payments,
  tenancy keys)
- A previous migration failed and you're investigating

Path A and Path B run the **same SQL via the same command**.
Idempotency + a Postgres advisory lock in the runner script
make concurrent triggers safe:

- The migrate wrapper takes `pg_try_advisory_lock(<package-hash>)`
  before doing anything. If it can't acquire the lock, it
  exits non-zero with `"another migration is in progress for
  @shared/db-<domain>"`.
- The migration itself is idempotent — already-applied
  migrations are recorded in `__drizzle_migrations` and
  skipped.

Net effect: if a Path A deploy fires while you're in the
middle of Path B (e.g. a hotfix deploy lands), one of them
will lose the lock race and exit fast. Re-run the failed
one after the winner finishes. No partial state, no double
application.

Still, **don't lean on the lock as your coordination
mechanism.** Pause the deploy workflow for the affected
service before starting Path B; resume after step 6.

## Prerequisites

- **Dry-run done** on a sanitised stage clone of comparable
  size ([ADR 0025](../adr/0025-production-data-flow.md)).
- **Backup window confirmed.** Postgres has Point-In-Time
  Recovery (PITR) — restore to any second within a retention
  window (cloud-provider dependent, typically 24h–35 days).
  Verify retention covers "now + expected migration duration
  + 1h" before proceeding.
  ```bash
  # AWS RDS example
  aws rds describe-db-instances \
    --db-instance-identifier <prod-db> \
    --query 'DBInstances[0].BackupRetentionPeriod'
  ```
- **Row count + table size recorded**:
  ```sql
  SELECT reltuples::bigint AS approx_rows,
         pg_size_pretty(pg_total_relation_size('public.<table>')) AS total_size
  FROM pg_class WHERE relname = '<table>';
  ```

## Steps

1. **Confirm no deploy is in flight** against
   `release-candidate` for the affected service.

2. **Trigger the migration via `workflow_dispatch`** on the
   `db-migrate.yml` GitHub Actions workflow. Inputs: the
   `shared/db-<domain>` package name.

   This runs `_db-migrate.yml` (the same reusable workflow
   the deploy job uses), which in turn runs:
   ```
   pnpm --filter @shared/db-<domain> db:migrate
   ```
   The script enforces `lock_timeout = 3s` and
   `statement_timeout = 15min` automatically.

3. **Watch four signals** for the migration's duration on the
   service's Grafana dashboard:
   - Ungranted lock count on the target table
   - p99 query latency
   - Replication lag (`pg_stat_replication.write_lag`)
   - Connection pool saturation

4. **Verify** the migration applied cleanly:
   ```sql
   \d+ <table>
   SELECT count(*) FROM __drizzle_migrations
     ORDER BY created_at DESC LIMIT 5;
   ```

5. **For backfills only:** the DDL above is finished, but data
   isn't backfilled yet. Trigger the **separate** backfill Job
   (k8s Job / scheduled task / ops script — *not*
   `db:migrate`). The backfill cursors through rows in 10k
   batches; sleep between batches if replication lag climbs
   above 5s.

   The backfill is a one-off ops task per migration, not a
   migration file. Constraint validation
   (`VALIDATE CONSTRAINT`, promoting NULL → NOT NULL) is a
   *follow-up* migration after backfill is verified —
   that follow-up can ship via Path A.

6. **Trigger the deploy.** Run `deploy-prod.yml` normally.
   Its inline `db:migrate` step sees the migration already
   in `__drizzle_migrations` and no-ops; pods promote against
   the already-applied schema.

## Rollback

**Forward-only** per [ADR 0036](../adr/0036-safe-database-migrations.md).
No `down.sql`; drizzle-kit 1.x has no `down` command. Three
escalating responses:

1. **Migration aborted itself** (`lock_timeout` /
   `statement_timeout` fired): Postgres rolled the transaction
   back. Schema unchanged. Investigate the trigger
   (long-running query? autovacuum? lock queue?) and retry the
   `workflow_dispatch`.

2. **Migration succeeded but app is broken**: write a new
   roll-forward migration that fixes the shape. Append-only;
   this is the normal recovery path.

3. **Catastrophic** (data corrupted, prior shape gone):
   PITR restore to a timestamp before the migration ran.
   **You lose everything written after that timestamp.**
   Bridge with on-call; document as an incident.

## Escalation

Abort the migration if any of these is sustained for 60s:

- Ungranted locks > 50
- p99 latency > 2× pre-migration baseline
- Replication lag > 30s
- Connection pool saturation > 90%
- Foreign-key violations appearing in app logs

Contacts: CODEOWNERS for the affected `shared/db-<domain>/`
package — Slack + on-call alerting per the file's `# slack:` /
`# alerting:` metadata ([ADR 0020 → CODEOWNERS](../adr/0020-github-repo-conventions.md#codeowners-githubcodeowners)).

## Related

- [ADR 0036](../adr/0036-safe-database-migrations.md) — the design,
  including the Path A / Path B split and idempotency rationale
- [ADR 0012](../adr/0012-drizzle-orm.md) — Drizzle schemas / migrations
- [ADR 0021](../adr/0021-github-actions-ci.md) — the reusable
  `_db-migrate.yml` workflow lives here
- [ADR 0024](../adr/0024-branching-releases-environments.md) — release flow
- [ADR 0025](../adr/0025-production-data-flow.md) — sanitised stage clones
- [ADR 0020](../adr/0020-github-repo-conventions.md) — CODEOWNERS team metadata = escalation contacts
- [release-pr-flow.md](../sops/release-pr-flow.md) — the
  default release path (Path A); this runbook is the deviation
