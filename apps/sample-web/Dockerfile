# syntax=docker/dockerfile:1.7
#
# sample-web — React 19 + Vite 8, with ADR 0019 runtime env injection.
#
# Multi-stage:
#   1. builder — install workspace deps, vite build with BUILD_MODE=true so
#      VITE_* env values are baked as ___KEY___ placeholder tokens (ADR 0019)
#   2. runtime — nginx-alpine + a small entrypoint that sed-replaces the
#      placeholders with real env values at container start, then hands off
#      to nginx
#
# Example call from repo root:
#   docker build -f apps/sample-web/Dockerfile -t sample-web:dev .
#   docker run -e VITE_API_URL=https://prod.api.example.com -p 8080:8080 sample-web:dev

ARG NODE_VERSION=22.19.0
ARG PNPM_VERSION=9.15.0

# ============================================================================
# 1. Builder
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS builder
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/sample-web/package.json ./apps/sample-web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json tsconfig.json nx.json ./
COPY apps/sample-web ./apps/sample-web

# BUILD_MODE=true tells vite.config.ts to bake placeholder tokens for VITE_*
# vars instead of their build-time values. The runtime entrypoint then swaps
# them for real values per environment. See ADR 0019.
RUN BUILD_MODE=true pnpm exec nx build sample-web --skip-nx-cache

# ============================================================================
# 2. Runtime
# ============================================================================
# nginx-unprivileged runs as the `nginx` user (uid 101) by default — no
# root in the running container. Listens on 8080 out of the box.
FROM nginxinc/nginx-unprivileged:alpine AS runtime
USER root
RUN apk add --no-cache --no-progress wget

COPY --from=builder --chown=nginx:nginx /workspace/apps/sample-web/dist /usr/share/nginx/html
COPY --chown=nginx:nginx apps/sample-web/container/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx apps/sample-web/container/entrypoint.sh /docker-entrypoint.d/40-replace-env.sh
RUN chmod +x /docker-entrypoint.d/40-replace-env.sh

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
