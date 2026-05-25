---
date: 2026-05-22
decision-makers: [Repo platform]
---

# ADR 0023: Container build and local dev conventions

## Context and Problem Statement

[ADR 0008](0008-trivy-security-scan.md) (Trivy scans),
[ADR 0021](0021-github-actions-ci.md) (CI builds),
[ADR 0022](0022-opentofu-iac.md) (IaC deploys),
[ADR 0004](0004-nx-monorepo.md) (`lint:container` verb — see [docs/conventions/scripts.md](../conventions/scripts.md)),
and [ADR 0025](0025-production-data-flow.md) (in-VPC sanitisation
container) all assume a `Dockerfile` shape that no ADR defines.
Each service inventing its own = different base images,
different attack surfaces, different healthcheck contracts.

This ADR fixes the **image shape** and the **local dev loop**
(`compose.yml`). Deploy runtime (k8s, helm) varies per fork and
is out of scope.

## Decision Outcome

Single `Dockerfile` per service at
`apps/<product>/<service>/Dockerfile`, four targets,
`node:22-bookworm-slim` throughout. Per-service `compose.yml`
beside it.

### Image — multi-stage `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
CMD ["pnpm", "dev"]

FROM deps AS builder
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist

# Vault CLI shim per ADR 0034. Pick the fork's vendor at build time.
ARG VAULT_CLI=infisical
RUN /bin/bash -c '\
  case "$VAULT_CLI" in \
    infisical) curl -sSL https://infisical.com/install.sh | sh ;; \
    op)        curl -sSL https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor -o /usr/share/keyrings/1password-archive-keyring.gpg \
                 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/amd64 stable main" \
                    > /etc/apt/sources.list.d/1password.list \
                 && apt-get update && apt-get install -y --no-install-recommends 1password-cli ;; \
    doppler)   curl -sLf https://cli.doppler.com/install.sh | sh ;; \
    none)      echo "skipping vault CLI install" ;; \
  esac'

USER node
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1))"

# Stacking order: vault shim → OTel boot → app. See ADR 0034 + 0032.
ENTRYPOINT ["infisical", "run", "--", "node", "--import", "./dist/instrumentation.mjs"]
CMD ["dist/main.js"]
```

Forks that don't run a vault CLI in-container (e.g. platform-native
injection via ECS `secrets:` block — see [ADR 0034](0034-secrets-runtime-injection.md))
build with `--build-arg VAULT_CLI=none` and use `ENTRYPOINT ["node",
"--import", "./dist/instrumentation.mjs"]`.

- **Slim Debian** for every stage (glibc — `better-sqlite3` and
  other native modules from [ADR 0012](0012-drizzle-orm.md) work
  without rebuild flags). Distroless deferred pending devops review.
- **`USER node`** (uid 1000, shipped by the official image —
  no `useradd` ceremony).
- **`ENTRYPOINT` stacks vault → OTel → app.** `infisical run --`
  (or `op run --` / `doppler run --`) authenticates and exports
  secrets ([ADR 0034](0034-secrets-runtime-injection.md)); `node --import` boots OTel before
  `@nestjs/core` is required ([ADR 0032](0032-runtime-observability.md));
  `CMD` is the only thing services override.
- **`HEALTHCHECK` hits `GET /healthz`** (liveness). See
  **Health probe contract** below for the `/healthz` vs `/readyz`
  split. Contract is the URLs, not the implementation.
- **Layer order**: lockfile first, source last. Maximises cache hits.
- **`--prod` in runtime stage** — dev deps don't ship.

### Health probe contract — `/healthz` + `/readyz`

Two endpoints, not one. Both implemented via `@nestjs/terminus`
11.x:

```ts
@Controller()
export class HealthController {
  constructor(private h: HealthCheckService, private db: TypeOrmHealthIndicator) {}

  @Get('healthz') @HealthCheck() // liveness — cheap, never touches DB
  live() { return this.h.check([async () => ({ self: { status: 'up' } })]); }

  @Get('readyz') @HealthCheck()  // readiness — DB + critical downstreams
  ready() {
    return this.h.check([
      () => this.db.pingCheck('postgres', { timeout: 300 }),
      // add HttpHealthIndicator for critical synchronous downstreams
    ]);
  }
}
```

- **Liveness (`/healthz`)** must **not** depend on the DB. A bad
  DB does not mean the pod should be restarted — only readiness
  should fail. The Dockerfile `HEALTHCHECK` above probes this.
- **Readiness (`/readyz`)** checks the DB ping plus any
  synchronous downstream the service cannot serve without.
  Async-only dependencies (queues, S3) should be circuit-broken
  inside the app, not gated here. K8s `readinessProbe` and
  synthetic monitors (when adopted) target `/readyz`.
- A deep-health mode (e.g. `?detail=full` returning the
  indicator tree) is fine for ops dashboards but **must not**
  be wired to k8s probes.

The legacy `/health` URL stays out of the contract — every new
service ships both `/healthz` and `/readyz`.

### Targets → environments

`dev` → local compose only. `runtime` → stage / temp / prod.
`deps` and `builder` are intermediate. Single artifact promotes
through environments unchanged
([ADR 0024](0024-branching-releases-environments.md)).

### CI image tagging

Two tags per prod build: `<service>:vX.Y.Z` (from the release
tag) and `<service>:<git-sha-short>` (traceability). **No `latest`**
— avoids "deployed-but-what-version" failures.

### Local dev — `compose.yml`

Per-service file at `apps/<product>/<service>/compose.yml`:

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "${LOCAL_PORT:-3000}:3000"
    volumes:
      - .:/app
      - /app/node_modules        # anonymous; host node_modules don't pollute
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://app:app@db:5432/app

  db:
    image: postgres:16-bookworm
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 5
```

- Deployable service named **`app`**; dependencies use generic
  names (`db`, `cache`, `queue`). Compose namespaces by project;
  prefixing is noise.
- **`target: dev`** locally; CI builds `runtime`.
- **Source bind + anonymous `node_modules`** for hot reload
  without host pollution.
- **`depends_on` + `service_healthy`** — app doesn't start until
  deps are ready.
- **postgres pinned `postgres:16-bookworm`** — Debian-based,
  matches the slim alignment. Major pinned; patch via PR.

The `db:up`/`db:down`/`db:reset` verbs from [ADR 0004](0004-nx-monorepo.md)
(see [docs/conventions/scripts.md](../conventions/scripts.md)) wrap this compose file per service.

### Out of scope

k8s / helm / kustomize manifests; image registry choice (already
parameterised in [ADR 0021](0021-github-actions-ci.md)); image
signing / SBOM (security follow-up).

Build tool: `podman build` (or `buildah bud`) locally; CI uses
`docker/build-push-action`-equivalent — same OCI output either way.

## Consequences

### Positive

- **One image, every environment** — `runtime` promotes through
  stage/temp/prod unchanged.
- **Trivy scan surface is bounded** ([ADR 0008](0008-trivy-security-scan.md))
  — same base across services means findings dedupe.
- **Hadolint contract from [ADR 0004](0004-nx-monorepo.md)
  (`lint:container` verb) is concrete** — there's a shape to lint against.
- **`podman compose up` is the whole local dev story.**

### Negative

- **Slim is ~200 MB; distroless would be ~150** — accepted for
  now, follow-up after devops review.
- **`/healthz` + `/readyz` discipline required** of every
  service. No silent omissions; no DB calls on liveness.
- **Hot reload depends on the framework's watch mode** (NestJS,
  Vite, etc. all support; verify per service).

### Neutral

- **Frontend services** ([ADR 0011](0011-frontend-frameworks.md))
  ship a similarly-shaped image where `dist/main.js` is an SSR
  entry or static-serve. Shape unchanged.
- **`node` uid 1000** — bind mounts work if host UID matches;
  otherwise add `--userns` to the podman command.

## Alternatives considered

1. **Distroless runtime** — smaller, smaller attack surface, no
   shell. Deferred pending devops review (debugging tradeoff +
   sidecar workflow readiness).
2. **Alpine** — musl breaks `better-sqlite3` and other native
   modules without rebuild flags. Rejected.
3. **Two Dockerfiles (`Dockerfile` + `Dockerfile.dev`)** —
   duplicate `deps` install across files; drifts. Single-file
   targets is one source of truth.
4. **Single root `compose.yml`** for the whole stack — forces
   every dev to bring up the whole monorepo. NX `run-many`
   composes per-service files when multi-service is needed.

## Related

- **[ADR 0002](0002-node-22-lts.md)** — base image follows the Node LTS pin.
- **[ADR 0004](0004-nx-monorepo.md)** —
  `lint:container` lints this shape; `db:*` family wraps the
  per-service compose. See [docs/conventions/scripts.md](../conventions/scripts.md).
- **[ADR 0008](0008-trivy-security-scan.md)** — Trivy scans this image.
- **[ADR 0012](0012-drizzle-orm.md)** — native modules motivate slim/glibc over Alpine.
- **[ADR 0021](0021-github-actions-ci.md)** — CI builds this image.
- **[ADR 0024](0024-branching-releases-environments.md)** — release flow deploys it.
- **[ADR 0032](0032-runtime-observability.md)** —
  `ENTRYPOINT` carries `--import ./dist/instrumentation.mjs`
  to fix OTel boot order.
- [hadolint](https://github.com/hadolint/hadolint) — Dockerfile linter.
- [pnpm in Docker](https://pnpm.io/docker) — corepack + lockfile patterns.
