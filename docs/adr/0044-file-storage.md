---
date: 2026-05-25
tags: [backend, storage, s3, files, uploads]
---

# ADR 0044: File storage — S3-API as the contract, MinIO local, Postgres as truth

## Context and Problem Statement

Every service that accepts uploads, serves user-generated content, or holds large binary artifacts reinvents the same machinery — drivers, presigned URLs, visibility classes, lifecycle policies. Without a convention each fork makes a different set of subtle choices (presigned PUT vs POST, bucket-per-tenant vs prefix, SSE-S3 vs SSE-KMS) and bakes vendor lock-in before the first feature ships.

The standing pattern in this repo is "Postgres or local until you actually need something else." This ADR ratifies what that looks like for object storage and names the graduation levers explicitly.

## Decision Outcome

### The contract is the S3 API, not S3 the service

Treat **the S3 protocol** as the contract. AWS S3, Cloudflare R2, Backblaze B2, Tigris, MinIO, Garage all implement it; the application code never knows which one. The choice of backend is `@shared/config` plumbing, not architecture.

### `@shared/storage` — one interface, three implementations

A single library under the standard `@shared/<name>` shape, with three driver implementations selected by config:

- **`s3`** — `@aws-sdk/client-s3` v3 + `@aws-sdk/s3-request-presigner` + `@aws-sdk/s3-presigned-post` + `@aws-sdk/lib-storage`. Pointed at AWS, R2, B2, MinIO — whichever endpoint the config supplies.
- **`fs`** — local filesystem. Enforces POST-policy constraints (`content-length-range`, content-type allowlist, key prefix) in a signed-route handler on the dev server. **The S3 backend is still the production contract**; the `fs` driver mirrors it for offline work.
- **`memory`** — in-process `Map<string, Uint8Array>` + a fake signer. For tests; the standard `@shared/<name>` testable shape.

Interface (in `shared/storage/src/types.ts`):

```ts
export type Visibility = 'public' | 'private' | 'shareable';

export interface PresignPostOptions {
  expiresIn?: number;
  contentTypeAllowlist: readonly string[];   // required
  contentLengthRange: readonly [number, number];
  keyPrefix?: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  put(key: string, body: Uint8Array | ReadableStream, opts?: PutOptions): Promise<{ etag: string; size: number }>;
  get(key: string): Promise<ReadableStream<Uint8Array>>;
  head(key: string): Promise<HeadResult>;
  delete(key: string): Promise<void>;
  copy(opts: CopyOptions): Promise<void>;
  list(opts: ListOptions): Promise<ListResult>;
  presignGet(key: string, opts?: PresignGetOptions): Promise<string>;
  presignPut(key: string, opts?: PresignPutOptions): Promise<string>;
  presignPost(key: string, opts: PresignPostOptions): Promise<PresignedPost>;
  publicUrl(key: string): string;            // CDN-composed, no signing
  healthcheck(): Promise<{ ok: boolean; latencyMs: number }>;  // 1-byte HEAD on a sentinel object
}

export const STORAGE_DRIVER = Symbol.for('@shared/storage/Driver');
```

`presignPost.contentTypeAllowlist` is **required** on the type — there is no presigned POST without an allowlist. Streams are Web Streams (Node 22 native); the SDK v3 returns them by default.

No third-party wrapper as the public API. flydrive, @flystorage/file-storage, and unstorage are useful libraries but their abstractions don't expose POST policies in a form-fields shape, and wrapping our own surface keeps the in-memory test impl trivial.

### Local development = MinIO in `compose.yml`

Default. MinIO exercises SigV4, virtual-host vs path-style routing, presigned POST policies, and CORS — the four things that bite first on AWS. The `fs` driver is the documented fallback for contributors who want zero containers, but the default `pnpm dev` brings up MinIO so what runs locally matches production semantics. LocalStack is heavier than needed for an S3-only dependency; R2/Tigris dev tier violates the offline-first requirement.

### Visibility, keys, and uploads

**Three visibility classes** at the metadata layer, each with a defined storage shape:

- **Public** — a separate bucket (or distinct prefix with its own CDN origin) fronted by a CDN. No signing. `Cache-Control: public, max-age=31536000, immutable` set at upload. Content-hashed keys safe to cache forever.
- **Private** — never directly addressable. `Cache-Control: private, no-store`. Reads only via the app server.
- **Shareable private** — presigned GET with a short TTL.

**Key layout**: `tenants/{tenantId}/{yyyy}/{mm}/{uuidv7}{ext?}`. UUID v7 (RFC 9562) is time-sortable for cheap "recent uploads per tenant" queries, the tenant prefix breaks the timestamp-hot-prefix problem on S3 partitioning, and display filenames live in the `files` row — never in the key. Safe key character set: ASCII alphanumerics plus `/_-.` only (R2 is stricter than S3; this is the safe intersection).

**Uploads = presigned POST**, always. POST is the only mechanism that enforces `content-length-range` and `starts-with $Content-Type` at the storage layer — presigned PUT can't. Multipart via `@aws-sdk/lib-storage` for files ≥ 100 MB (heuristic, tunable; the S3 hard ceiling is 5 GB single-shot).

**CORS** on the upload bucket: allow the deployed origin in stage/prod (`https://app.example.com`); allow `http://localhost:5173` in local. Configured in IaC ([ADR 0022](0022-opentofu-iac.md)), not at runtime.

### URL TTLs

All from `@shared/config`, all bounded to 7 days max (SigV4's hard limit) so a misconfigured YAML can't mint a year-long URL. Defaults: presigned GET = **15 minutes**; presigned PUT/POST = **15 minutes**. Aligned with the SDK default and short enough to limit blast radius on a leak.

### Content-type handling = inbox pattern

Trust client `Content-Type` only as a hint, even when enforced by the POST policy. On upload-complete, the client calls `POST /v1/files/{id}/finalize` which enqueues a Postgres-backed job ([ADR 0042](0042-async-work-and-webhooks.md)) that reads the first 4 KB via Range, runs the `file-type` package, and updates `files.detected_mime`. If the detected MIME contradicts the allowlist, mark the row `quarantined=true` and refuse all future presigned GETs.

### Postgres is the metadata source of truth

```ts
// shared/db-files/src/schema.ts
export const files = pgTable('files', {
  id:              uuid('id').primaryKey().defaultRandom(),
  bucket:          text('bucket').notNull(),
  key:             text('key').notNull(),
  contentType:     text('content_type').notNull(),
  detectedMime:    text('detected_mime'),
  size:            bigint('size', { mode: 'bigint' }).notNull(),
  sha256:          char('sha256', { length: 64 }),
  ownerId:         uuid('owner_id').notNull(),
  tenantId:        uuid('tenant_id').notNull(),
  visibility:      varchar('visibility', { length: 16 }).$type<Visibility>().notNull(),
  quarantined:     boolean('quarantined').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
}, (t) => ({
  bucketKey:       uniqueIndex('files_bucket_key').on(t.bucket, t.key),
  tenantCreated:   index('files_tenant_created').on(t.tenantId, t.createdAt),
}));
```

`storage_audit` mirrors the same pattern: who-presigned-what-for-whom, who-deleted-what, written by `@shared/storage` on every mutating call. Required because OTel is sampled — auditors want every event, not 10%.

Presigned URLs are refused on any row where `deleted_at IS NOT NULL` or `quarantined = true`. The object purge job runs N days after `deleted_at` is set (default 30; configurable per visibility class).

### Encryption, lifecycle, multi-region

- **SSE-S3** by default. AWS automatically encrypts new objects (since Jan 2023); R2 / B2 / MinIO encrypt at rest by default. **SSE-KMS** + Bucket Keys is a config toggle, enabled per-tenant when a contract names it.
- **Lifecycle rules** on every production bucket: abort `IncompleteMultipartUpload` after 7 days; expire `tmp/` and `uploads-pending/` after 3 days. Both configured in IaC.
- **Single region day-one**, region from config. EU residency = **bucket per region** (not prefix; bucket region is bucket-scoped). Cross-region replication off by default — it inverts the residency story.

### Day-one omissions with explicit triggers

- **Image variants / on-the-fly resize** — skip. Graduation: imgproxy behind the CDN when LCP on the primary surface degrades past 2.5 s due to image weight, or when > 10% of GETs target full-resolution images. Never Cloudflare Images or Imgix as defaults — they bake the vendor into the URL.
- **Virus scanning** — skip. Graduation: ClamAV via Postgres-backed jobs the sprint that the product first serves one user's uploads to another user. On AWS, GuardDuty Malware Protection for S3 is the managed alternative.
- **Variants / responsive transforms** — generated on demand by the imgproxy graduation, never pre-generated at upload.

### NestJS integration

Use `@fastify/multipart` for the rare server-side multipart receive path (Nest's `FileInterceptor` is multer-based and documented incompatible with `FastifyAdapter`). Storage injected via `@InjectStorage()` resolving to the `STORAGE_DRIVER` branded token. `/readyz` calls `driver.healthcheck()` and includes its result; `/healthz` stays liveness-only ([ADR 0023](0023-container-conventions.md)).

### Observability

Wrap every driver call in an OTel span named `S3.{Operation}` per the OTel AWS-SDK convention, with attributes from the experimental object-stores semconv (`aws.s3.bucket`, `aws.s3.key`, `aws.request_id`, `cloud.region`). Constants copied to our own file rather than imported from `@opentelemetry/semantic-conventions/incubating` — the incubating tier "MAY contain breaking changes in minor releases" per its README. Four metrics: upload latency histogram, presign issuance rate counter, bytes in/out counters, error rate by op. `aws.s3.key` is high-cardinality and disabled by default; flip on per-incident.

## Consequences

### Positive

- **Vendor-portable contract.** The same code path runs against AWS, R2, B2, or MinIO. Switching is a config change.
- **Local dev matches production.** MinIO exercises the same SigV4 + POST-policy semantics; bugs surface locally, not on first deploy.
- **POST policy enforces size + content-type at the storage layer.** A misbehaving client cannot smuggle a 10 GB upload into a 5 MB slot.
- **GDPR right-to-delete propagates predictably** via the two-phase `deleted_at` + deferred purge job pattern.
- **Graduation triggers are explicit.** No ambient drift toward Cloudflare Images, Imgix, or on-the-fly transforms before there's a stated need.
- **Bill-paying is configurable.** R2-for-egress vs S3+CloudFront is a YAML change, not a refactor.

### Negative

- **Two metadata tables (`files`, `storage_audit`) per service.** Cheap to schema, real to maintain.
- **`fs` driver is a second-class path.** It enforces POST policies in a local route handler, not at the storage layer. Contributors must understand the asymmetry; the dev-default of MinIO mitigates.
- **AWS SDK v3 minor-version drift.** Presigner shape has changed in 3.x minor bumps (`aws/aws-sdk-js-v3` #7402); pin exact and gate Renovate on a presigner contract test.
- **Bucket-per-region residency** is structurally correct but adds an IAM + lifecycle replication surface per region.

### Neutral

- **No third-party wrapper** as the public API. flydrive / @flystorage / unstorage are fine libraries but ours is narrower and we keep control of the in-memory test impl.
- **No image transforms day-one.** Originals only; CDN-cached. Tracked under explicit graduation triggers above.
- **`presignPost` requires an allowlist on the type.** Forces a design choice at every callsite; that's the point.

## Alternatives considered

1. **Presigned PUT as the default upload mechanism** — simpler, no policy bundle, but cannot enforce content-length or content-type at the storage layer. Rejected.
2. **Proxy uploads through the API** — buffers large files in Fastify, defeats direct-upload latency, contradicts stack goals. Rejected.
3. **Pure filesystem driver as the local-dev default** — works offline but doesn't exercise SigV4, CORS, or POST policies. Kept as a fallback, not the default.
4. **LocalStack instead of MinIO** — heavier, broader-than-S3 surface we don't need; S3 fidelity is *worse* than MinIO for POST policy edges. Rejected.
5. **`@flystorage/file-storage` or `flydrive` as the public API** — useful libraries, but their signed-URL APIs don't expose form-fields bundles for browser POST. Rejected.
6. **Bucket per tenant** — hits AWS's 1,000-bucket soft limit fast; complicates IAM. Prefix-per-tenant + bucket-per-region is the right composition.
7. **Hash-based keys (`sha256/{hash}`) for deduplication** — wins on dedup, breaks per-tenant deletion and GDPR propagation. Rejected.
8. **Cloudflare Images / Imgix as the day-one image story** — bakes the vendor into the URL; antithetical to portability. Rejected; imgproxy as the self-hostable graduation.
9. **Versioning on by default** — doubles storage for overwrite-heavy workloads. Off; toggle on when an immutability requirement appears.

## Related

- [ADR 0015](0015-backend-config.md) — `@shared/config` selects the driver per `APP_ENV`; bucket names, region, endpoint, TTL defaults all live in the schema.
- [ADR 0022](0022-opentofu-iac.md) — bucket creation, CORS, lifecycle rules, KMS keys, IAM roles all in IaC.
- [ADR 0023](0023-container-conventions.md) — `/readyz` calls `driver.healthcheck()`.
- [ADR 0032](0032-runtime-observability.md) — OTel spans + metrics from `@shared/storage`.
- [ADR 0033](0033-api-contracts-and-errors.md) — RFC 9457 problem details for `quarantined`, presign-refused, etc.
- [ADR 0034](0034-secrets-runtime-injection.md) — AWS / R2 / B2 credentials via the vault CLI in `ENTRYPOINT`; never `.env`.
- [ADR 0037](0037-authentication.md) / [ADR 0038](0038-authorization.md) — `ability.can('read', file)` gates every presigned-GET issuance.
- [ADR 0042](0042-async-work-and-webhooks.md) — content-type detection, virus scanning, purge jobs all ride the Postgres jobs queue.
- [ADR 0043](0043-time-and-money.md) — `timestamptz` and `bigint` types on `files`.
- [`@aws-sdk/s3-presigned-post` README](https://www.npmjs.com/package/@aws-sdk/s3-presigned-post)
- [OpenTelemetry object-stores semconv (Development)](https://opentelemetry.io/docs/specs/semconv/object-stores/s3/)
- [RFC 9562 — UUID v7](https://www.rfc-editor.org/rfc/rfc9562)
