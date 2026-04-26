# ADR 0019: Web runtime env injection via `import-meta-env`

- **Status**: Accepted
- **Date**: 2026-04-26
- **Supersedes**: prior 2026-04-19 revision of this ADR (bespoke `BUILD_MODE` + `___KEY___` tokens + runtime sed). No production callers existed; the only implementation was the throwaway `apps/sample-web` scaffold, which is migrated alongside this rewrite.
- **Deciders**: Frontend platform
- **Tags**: frontend, vite, configuration, deployment

## Context

Single-page applications built by a bundler (Vite, Webpack, Rollup, esbuild) inline environment variables into the JavaScript bundle at **build time**. Any reference to `import.meta.env.FOO` (Vite) or `process.env.FOO` (Webpack/CRA) is replaced by the literal string value during compilation.

This conflicts with the **build-once, deploy-many** principle (12-factor §V): a single immutable artifact should be promoted unchanged from CI through staging to production, with environment-specific values supplied at deploy or runtime.

The default bundler behaviour forces one of two undesirable outcomes:

1. **Build per environment** — slow CI, separate artifacts per stage; the artifact tested in staging is not bit-identical to the one in production.
2. **Mutate the built artifact** — post-build string-replacement on `.js` files. This invalidates content hashes (breaking long-term CDN caching), shifts byte offsets (corrupting source maps), forces the same dance over `.css` and source maps, and risks unintended substring collisions with user code or string literals. The previous revision of this ADR took this route and accepted those costs; this revision retires them.

We need a mechanism that:

- Keeps the JS bundle **byte-identical** across environments (cacheable, hashable, signable via SRI).
- Allows config to be set at **deploy time** without rebuilding.
- Has an **explicit allowlist** so secret env vars cannot accidentally leak into the client bundle.
- Provides **type safety** on the env surface.
- Works across our bundlers (today: Vite; potentially Webpack/Rollup/esbuild for other apps).

## Decision

We use **[`@import-meta-env/unplugin`](https://github.com/iendeavor/import-meta-env)** as the standard runtime configuration mechanism for frontend applications. It is paired with our existing zod-validated `src/env.ts` pattern from [ADR 0013](0013-env-config.md): the plugin handles the build-time/deploy-time mechanics, and zod handles in-browser shape and value validation after the swap.

### How it works

1. **Allowlist** — A `.env.example` file at the app root declares every variable the client is allowed to read. Variables not listed cannot be referenced at runtime.

2. **Build-time transform** — The plugin replaces every `import.meta.env.FOO` reference in source with a property access on a global:

   ```js
   // source
   const apiUrl = import.meta.env.API_URL;

   // built
   const apiUrl = globalThis.import_meta_env.API_URL;
   ```

   The JS bundle contains **no values and no per-variable placeholders**.

3. **Single placeholder in HTML** — The plugin injects one inline script tag into `index.html`, before the bundle's module script:

   ```html
   <script>
     globalThis.import_meta_env = JSON.parse('"import_meta_env_placeholder"');
   </script>
   ```

4. **Deploy-time replacement** — `@import-meta-env/cli` replaces that single placeholder in `index.html` with a JSON payload built from the deploy environment:

   ```html
   <script>
     globalThis.import_meta_env = JSON.parse('{"API_URL":"https://prod.api"}');
   </script>
   ```

   Run this once at container start, in an entrypoint script, or as part of the deploy pipeline.

5. **Type generation** — Types for `import.meta.env` are generated from `.env.example` (compile-time safety on the env surface).

### Operational model

- **CI**: Build the bundle once. Publish as an immutable artifact (Docker image / S3 object).
- **Deploy**: Container entrypoint runs `import-meta-env -x .env.example -p index.html` against the on-disk `index.html` using values from the container's environment. Bundle JS is never touched.
- **Local dev**: A `.env` (or process env) provides values; the dev plugin reads them directly without the placeholder dance.

### Reconciliation with [ADR 0013](0013-env-config.md)

[ADR 0013](0013-env-config.md) requires every app to declare env in `src/env.ts` via a zod schema. That contract stays. In a web app, `src/env.ts` reads `import.meta.env` exactly as today — but the values now arrive via `globalThis.import_meta_env` after the entrypoint swap.

- The plugin gives us **shape/type** safety against the `.env.example` allowlist.
- The zod schema gives us **value** validation (e.g. `z.string().url()`, enums, defaults). Keep it.
- The schema runs in the browser after the swap script executes, so by the time `src/env.ts` is evaluated, real values are present.

`src/env.ts` therefore becomes simpler than the prior 2026-04-19 revision required: validators can use their natural strict forms (URLs, enums) instead of being loosened to admit placeholder strings.

### Required vs optional variables

- A variable listed in `.env.example` with **no value at deploy time** appears as `undefined` in `globalThis.import_meta_env`.
- The zod schema in `src/env.ts` decides what is required vs optional. Required-but-missing fails fast in the browser at module init.
- For variables that must fail the **container** (not the page), add a check in the entrypoint script before invoking the CLI — fail the container start rather than ship a broken page.

### Script ordering

The plugin places the placeholder `<script>` in `<head>`, before the bundle's `<script type="module">`. Module scripts are deferred by spec, so the synchronous placeholder script always runs first and `globalThis.import_meta_env` is populated before any module-level code executes. Do not move the bundle script into `<head>` as a non-module classic script — that ordering guarantee would break.

### Content Security Policy

The injected `<script>` is inline, so apps with a strict CSP must either:

- Allow the script's hash via `script-src 'sha256-…'` (the plugin emits a stable hash for its placeholder script), **or**
- Use the plugin's nonce option and pipe the nonce through your CSP header.

`'unsafe-inline'` is acceptable for sample/scaffold apps but is not the recommendation for production.

### HTML processing constraints

Anything that mutates `index.html` between plugin output and the entrypoint CLI must preserve the placeholder string verbatim:

- **Minifier**: Verify it preserves inline scripts byte-for-byte (most do; some collapse the JSON string).
- **Multiple HTML entry points**: The CLI accepts a glob; supply it explicitly (`-p 'dist/**/*.html'`) when an app has more than one entry HTML.
- **Edge transforms / CDN response rewriters**: Do not enable HTML transforms in front of the served `index.html`.

### Pinned versions

Per CLAUDE.md ("Lock to exact versions"), `@import-meta-env/unplugin` and `@import-meta-env/cli` are pinned exactly in `package.json`. Bumps go through a PR that re-runs the full quality gate. The current pinned version is recorded in the implementing app's `package.json`; this ADR does not enshrine a number to avoid drift.

## Consequences

### Positive

- **Immutable bundles** — Same content hash and same SRI integrity hash across every environment. CDN caches survive promotion.
- **Source maps stay valid** — Bundle bytes are never modified post-build.
- **Single point of substitution** — One placeholder, one file (`index.html`), one atomic swap. Easy to verify, easy to roll back.
- **Secret-leak protection** — `.env.example` is an explicit allowlist; a developer cannot accidentally expose a server-side secret by referencing it in client code.
- **Faster CI** — One build, not N.
- **Type-safe env surface** — Generated types catch typos at compile time; zod catches bad values at boot.
- **Bundler-agnostic** — Same plugin shape across Vite, Webpack, Rollup, esbuild via Unplugin.
- **No `sed` in runtime image** — runtime stage drops `apk add sed`, escaping helpers, and BSD-vs-GNU detection.
- **No `VITE_*` duplication** — the prior revision required mirroring every key with a `VITE_` prefix; the plugin removes that.
- **12-factor compliant** — Code and config are properly separated.

### Negative

- **Frontend-only** — Does not address backend/Node service config (covered by [ADR 0013](0013-env-config.md)).
- **Runtime indirection** — Every env access is a property lookup on a global instead of an inlined literal. Negligible perf cost; slightly less amenable to dead-code elimination based on env values (e.g. `if (import.meta.env.DEV)` may not tree-shake at build time the way Vite's native handling does).
- **HTML mutation step required** — Deploys must run the CLI (or equivalent) before serving. One step in the entrypoint.
- **Placeholder must reach the browser unchanged** — Constraints listed in "HTML processing constraints" above.
- **Inline script + CSP** — Strict-CSP apps need a hash or nonce, not a free pass.
- **Adds a dependency** — Maintained by a small team; bus-factor is non-zero. See mitigation below.

### Bus-factor mitigation

The mechanism is small enough to fork or replace if the package were abandoned:

- The plugin's transform: rewrite `import.meta.env.X` → `globalThis.import_meta_env.X` (a few dozen lines on top of any AST tool).
- The HTML injection: a single `<script>` tag with a sentinel JSON string.
- The CLI: read env, build a JSON object filtered by `.env.example` keys, replace the sentinel in `index.html`.

If the dependency disappears, an in-house replacement is small and isolated. We do not need to plan for this proactively, but the cost ceiling is bounded.

### Neutral

- Production builds use the runtime-replacement mechanism; **dev builds use `import.meta.env` natively** via the plugin's dev mode. The two paths must stay in sync (the plugin handles this).
- Vite built-ins (`import.meta.env.DEV` / `MODE` / `PROD` / `SSR`) are still inlined statically and behave normally.

## Alternatives Considered

### 1. Build per environment

- **Pro**: Zero runtime indirection; values inlined.
- **Con**: Multiple artifacts; staging artifact is not the production artifact; CI cost scales with environment count. Rejected.

### 2. Post-build `sed` replacement of N placeholders in JS (the prior 2026-04-19 revision)

- **Pro**: No build dependency; a few shell lines.
- **Con**: Mutates JS/CSS/source-map bytes per env (breaks CDN caching, breaks SRI, mangles source maps); platform-dependent (BSD vs GNU sed); collision risk with user strings; no allowlist; no type generation; requires `VITE_*` duplication of every key. Rejected as the standing approach; superseded by this revision.

### 3. Fetch `/config.json` at app startup

- **Pro**: Bundle untouched; standard HTTP semantics; trivially cacheable separately.
- **Con**: Adds a blocking network request before the app can render (or a complex loading state); config arrives async, so any module-level code reading env values must defer; no static type generation. Viable fallback if the placeholder approach proves problematic, but worse DX.

### 4. Server-templated `window.__CONFIG__` via SSR/edge

- **Pro**: Same one-placeholder principle, no separate CLI step.
- **Con**: Requires a server in front of every deploy (rules out static hosting); couples config to the rendering layer; we don't have SSR everywhere. Useful where we do have SSR, but not as a universal solution.

### 5. Vite `define` / hardcoded env vars

- **Pro**: Native, zero deps.
- **Con**: Build-time only — the original problem.

## Implementation Plan

1. Migrate `apps/sample-web` to demonstrate the new pattern (smallest blast radius; throwaway scaffold).
2. Add `@import-meta-env/unplugin` to its `vite.config.ts` and create `apps/sample-web/.env.example`.
3. Restore strict zod validators in `src/env.ts` (e.g. `z.string().url()` for `VITE_API_URL`) now that placeholders are no longer flowing through the schema.
4. Replace `apps/sample-web/container/entrypoint.sh` with a thin script that invokes `import-meta-env -x .env.example -p /usr/share/nginx/html/index.html`. Drop the BSD/GNU `sed` handling.
5. Drop `BUILD_MODE` from the Dockerfile build step.
6. Verify: same image, two stages, two configs, identical bundle hash; confirm SRI integrity hashes are stable across deploys.
7. Roll out to subsequent frontend apps as they are scaffolded.

## References

- [import-meta-env documentation](https://import-meta-env.org/)
- [GitHub: iendeavor/import-meta-env](https://github.com/iendeavor/import-meta-env)
- [12-factor: Config](https://12factor.net/config)
- [12-factor: Build, release, run](https://12factor.net/build-release-run)
- [ADR 0013: Env config via validated schema](0013-env-config.md) — server-side counterpart and the in-browser zod validator that complements this plugin.
