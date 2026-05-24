# syntax=docker/dockerfile:1.7
#
# sample-web — React 19 + Vite 8, with ADR 0016 runtime env injection.
#
# Multi-stage:
#   1. builder — install workspace deps and `vite build`. The
#      `@import-meta-env/unplugin` rewrites every `import.meta.env.X` to a
#      global accessor and injects a single placeholder script into
#      index.html. The bundle JS contains no env values and no per-variable
#      tokens; it is byte-identical across environments.
#   2. runtime — unprivileged nginx-alpine + node + `@import-meta-env/cli`.
#      The entrypoint substitutes the single placeholder in index.html with
#      a JSON object built from the container's env, then hands off to nginx.
#
# Example call from repo root:
#   docker build -f apps/sample-web/Dockerfile -t sample-web:dev .
#   docker run -e API_URL=https://prod.api.example.com -p 8080:8080 sample-web:dev

ARG NODE_VERSION=22.19.0
ARG PNPM_VERSION=9.15.0
ARG IMV_CLI_VERSION=0.7.4

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

RUN pnpm exec nx build sample-web --skip-nx-cache

# ============================================================================
# 2. Runtime
# ============================================================================
# nginx-unprivileged runs as the `nginx` user (uid 101) by default — no
# root in the running container. Listens on 8080 out of the box.
FROM nginxinc/nginx-unprivileged:alpine AS runtime
ARG IMV_CLI_VERSION
USER root

# nodejs to run the @import-meta-env/cli at container start; wget for the
# healthcheck. Production deployments may prefer running the CLI in CD on a
# node-capable runner instead of carrying node in the runtime image.
RUN apk add --no-cache --no-progress nodejs npm wget \
 && npm install -g "@import-meta-env/cli@${IMV_CLI_VERSION}" \
 && npm cache clean --force \
 && apk del --no-progress npm

COPY --from=builder --chown=nginx:nginx /workspace/apps/sample-web/dist /usr/share/nginx/html
COPY --chown=nginx:nginx apps/sample-web/.env.example /etc/import-meta-env/.env.example
COPY --chown=nginx:nginx apps/sample-web/container/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx apps/sample-web/container/entrypoint.sh /docker-entrypoint.d/40-replace-env.sh
RUN chmod +x /docker-entrypoint.d/40-replace-env.sh

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
