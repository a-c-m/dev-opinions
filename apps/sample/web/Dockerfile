# syntax=docker/dockerfile:1.7
#
# sample-web — React 19 + Vite 8, with ADR 0017 runtime env injection.
#
# Multi-stage:
#   1. builder — Chainguard Node dev (Wolfi). Installs workspace deps and
#      `vite build`. `@import-meta-env/unplugin` rewrites every
#      `import.meta.env.X` to a global accessor and injects a single
#      placeholder script into index.html. The bundle JS contains no env
#      values and no per-variable tokens; it is byte-identical across
#      environments.
#   2. runtime — Chainguard wolfi-base + apk-installed nginx + nodejs.
#      Nightly Wolfi rebuilds against the latest packages; Chainguard image
#      sign + SBOM stories apply (Priya F-11 / ADR 0008). The custom
#      entrypoint runs `@import-meta-env/cli` to substitute the placeholder
#      in index.html, then execs nginx.
#
# Build context is the repo root:
#   docker build -f apps/sample/web/Dockerfile -t sample-web:dev .
#   docker run -e API_URL=https://prod.api.example.com -p 8080:8080 sample-web:dev
#
# Dependabot auto-pins the `cgr.dev/chainguard/*` digests on every base update.

ARG PNPM_VERSION=9.15.9
ARG IMV_CLI_VERSION=0.7.4

# ============================================================================
# 1. Builder (Chainguard Node dev — Wolfi, has shell, corepack, apk)
# ============================================================================
FROM cgr.dev/chainguard/node:latest-dev@sha256:faccba56d910f16378d9dceda517a3df2aa1196731769255def28265f50336d0 AS builder
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
USER root
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/sample/web/package.json ./apps/sample/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json nx.json ./
COPY apps/sample/web ./apps/sample/web

RUN pnpm exec nx build sample-web --skip-nx-cache

# ============================================================================
# 2. Runtime (Chainguard wolfi-base + nginx + nodejs)
# ============================================================================
FROM cgr.dev/chainguard/wolfi-base:latest@sha256:5743937d521cbeb9e8c73bf1bd7ba2589c178940eb03d7b148efecc962be8587 AS runtime
ARG IMV_CLI_VERSION
USER root

# nginx + nodejs at runtime. npm is build-only (for the global CLI install)
# and removed afterwards so it doesn't sit in the production image.
RUN apk add --no-cache nginx nodejs && \
    apk add --no-cache --virtual .build npm && \
    npm install -g "@import-meta-env/cli@${IMV_CLI_VERSION}" && \
    npm cache clean --force && \
    apk del --no-cache .build

# Run as a stable non-root uid (Chainguard convention: 65532).
# nginx needs writable PID + log + temp dirs at this uid.
RUN adduser -D -u 65532 -g app app && \
    mkdir -p /var/lib/nginx/tmp /var/log/nginx /run/nginx && \
    chown -R 65532:65532 /var/lib/nginx /var/log/nginx /run/nginx /usr/share/nginx

COPY --from=builder --chown=65532:65532 /workspace/apps/sample/web/dist /usr/share/nginx/html
COPY --chown=65532:65532 apps/sample/web/.env.example /etc/import-meta-env/.env.example
COPY --chown=65532:65532 apps/sample/web/container/nginx.conf /etc/nginx/http.d/default.conf
COPY --chown=65532:65532 apps/sample/web/container/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER 65532
EXPOSE 8080

# Node-based healthcheck — runtime image has node from the apk install.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# Entrypoint runs env injection then execs CMD.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
