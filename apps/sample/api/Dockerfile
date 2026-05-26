# syntax=docker/dockerfile:1.7
#
# sample-api — NestJS 11 + Fastify
#
# Multi-stage:
#   1. builder — Chainguard Node (Wolfi, dev variant) — has shell + corepack
#      + apk for the install/build phase. Installs workspace deps, runs nx
#      build, prunes to prod via `pnpm deploy`.
#   2. runtime — Chainguard Node (minimal) — no shell, no apt/apk, no
#      package manager. Just node. Nightly rebuilds against the latest
#      Wolfi base; nightly CVE re-scans (Priya F-11 / ADR 0008).
#
# Build context is the repo root (workspace lockfile + sibling apps visible):
#   docker build -f apps/sample/api/Dockerfile -t sample-api:dev .
#
# Dependabot (ecosystem: docker) auto-pins the `cgr.dev/chainguard/node`
# digest on every base update — see `.github/dependabot.yml`.

ARG PNPM_VERSION=9.15.0

# ============================================================================
# 1. Builder (Chainguard Node dev — has shell, corepack, apk)
# ============================================================================
FROM cgr.dev/chainguard/node:latest-dev AS builder
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
USER root
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

# Manifest layer — cache install when only source changed.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/sample/api/package.json ./apps/sample/api/
COPY shared ./shared

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Source.
COPY tsconfig.base.json nx.json ./
COPY apps/sample/api ./apps/sample/api

# Build via NX — runs `^build` first, so @shared/logger emits to its dist/
# (per ADR 0039) before sample-api's nest build resolves `@shared/logger/*`
# imports against the workspace symlink → dist.
RUN pnpm exec nx build sample-api --skip-nx-cache

# Extract a prod-only deployable bundle (package.json + prod deps + dist).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter=sample-api deploy --prod /opt/sample-api

# ============================================================================
# 2. Runtime (Chainguard Node minimal — no shell, no package manager)
# ============================================================================
# Runs as `node` user (uid 65532) by default. Read-only filesystem-friendly.
# CMD must use exec form (no shell available).
FROM cgr.dev/chainguard/node:latest AS runtime
ENV NODE_ENV=production

WORKDIR /app
COPY --from=builder --chown=65532:65532 /opt/sample-api ./

# Chainguard's runtime image defaults to nonroot uid 65532; declare it
# explicitly so Trivy / DS-0002 / admission controllers see it and the
# intent isn't dependent on the base image's defaults.
USER 65532
EXPOSE 3000

# Node-based healthcheck — Chainguard runtime has no shell, no wget, no
# curl. Native fetch (Node 18+) is the cleanest probe. Exec form bypasses
# the missing shell.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["dist/main.js"]
