# syntax=docker/dockerfile:1.7
#
# sample-api — NestJS 11 + Fastify
#
# Multi-stage:
#   1. builder — install workspace deps, run nx build, prune to prod via pnpm deploy
#   2. runtime — minimal Node 22 Alpine, non-root, healthcheck
#
# Build context is the repo root (so the workspace lockfile + sibling apps are
# visible). Example call from repo root:
#   docker build -f apps/sample-api/Dockerfile -t sample-api:dev .

ARG NODE_VERSION=22.19.0
ARG PNPM_VERSION=9.15.0

# ============================================================================
# 1. Builder
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS builder
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

# Manifest layer — cache install when only source changed.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/sample-api/package.json ./apps/sample-api/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Source.
COPY tsconfig.base.json tsconfig.json nx.json ./
COPY apps/sample-api ./apps/sample-api

# Build via NX.
RUN pnpm exec nx build sample-api --skip-nx-cache

# Extract a prod-only deployable bundle (package.json + prod deps + dist).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter=sample-api deploy --prod /opt/sample-api

# ============================================================================
# 2. Runtime
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --from=builder --chown=app:app /opt/sample-api ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
