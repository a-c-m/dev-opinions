# ADR 0019: Runtime env injection for static web bundles via placeholder tokens

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Browser-side env variables are a harder problem than server-side ones. On a
Node server, `process.env` is read at boot, after the image has been deployed
to an environment — so one image plus per-environment env vars is enough (see
ADR 0013).

Static web bundlers (Vite, webpack, Rollup) work differently. References to
`import.meta.env.VITE_*` are **inlined at build time**: the final JS/CSS/HTML
contains the literal string value, not a runtime lookup. Naive options are
all bad:

- **Build once per environment.** Multiplies CI time and artefact count,
  breaks the "one immutable artefact promoted through envs" model, makes
  rollback per-env rather than global.
- **Ship secrets in the build.** Registry, image scanners, SBOMs, and
  per-developer pulls all end up with production secrets.
- **Fetch `/env.json` on boot.** Adds a blocking request before the app can
  render, complicates CSR caching, and still needs a server process to emit
  env-aware JSON.

A pattern that gives build-once-deploy-many for static bundles: bake
**placeholder tokens** at build time, replace them with real values at
container startup using a byte-level text replace over the compiled files.
The technique has been battle-tested in production across multiple
environments and handles minified bundles reliably.

## Decision

- Web apps whose config varies by environment use a **placeholder + runtime
  sed** pattern, not per-env builds and not baked-in values.

### Build phase (inside the CI job that produces the image)

- The env-config package exposes a `BUILD_MODE=true` flag. When set, its
  config flattener emits the token string `___<KEY>___` in place of the real
  value for every declared env variable.
- `generate-env.ts` (run as a `prebuild` step) writes `.env.local` with both
  the plain key and a `VITE_`-prefixed duplicate, each mapped to the same
  placeholder. Duplicating the prefix is required because Vite inlines
  `import.meta.env.VITE_*` at build time — the runtime replacer must see the
  same placeholder in both code paths.
- `vite build` runs normally; the resulting `dist/` contains the placeholder
  tokens as literal strings inside JS, CSS, and HTML.

### Runtime phase (container entrypoint)

- The container's entrypoint script is small and does one thing: it reads the
  real environment variables and runs a single `find … | xargs sed -i` pass
  over `dist/*.{js,css,html}` that substitutes every placeholder (both plain
  and `VITE_` variants) for its real value.
- The entrypoint detects **GNU vs BSD sed** and applies the in-place flag
  accordingly (`sed -i ''` on BSD, `sed -i` on GNU).
- Special characters in values (`$`, `/`, `\`) are escaped before being
  embedded in the sed expression.
- Missing values for optional variables fall through to the placeholder
  staying in place; required variables are validated at boot and the
  container fails fast if they are absent.

### What is NOT replaced

- Server-side Node apps continue to use the zod-validated env module at boot
  (ADR 0013). Placeholders are for artefacts that are baked before they know
  which environment they will run in — that is only true for browser
  bundles.

## Consequences

**Positive**
- One build, one image, one SBOM, promoted through every environment. The
  artefact in the registry contains no production secrets.
- Per-environment deploys cost an image pull plus a few milliseconds of sed
  — the artefact is not rebuilt per env.
- Rollback is a single image-tag swap across every environment.
- The technique works identically for secrets, API base URLs, feature flags,
  build IDs, or anything else the client needs to know at runtime.

**Negative**
- The container image must carry `sed` in its runtime stage (`apk add sed`
  on Alpine). Small cost, worth noting in the Dockerfile.
- Placeholder tokens leak into any artefacts that capture the build before
  the entrypoint runs (e.g. a preview deploy built without a replacement
  step will display `___KEY___` literally). The entrypoint must run, or a
  CI-side `replace-env` must run before serving.
- Source maps contain the placeholders too — sed the source maps as well or
  disable them in the environments where they would leak the token shape.
- Escaping is implementation-critical; an unescaped `/` or `$` in a value
  corrupts the sed expression. Use the central helper, don't hand-roll per
  app.

## Alternatives

- **Per-environment builds** — simple, but multiplies CI cost, defeats the
  one-image-promoted model, and slows rollback.
- **Runtime `GET /env.json`** — clean architecturally, but needs a server
  process to emit the JSON, adds a blocking round-trip before the SPA can
  render, and caching rules become tricky.
- **Server-rendered `window.__ENV__` bootstrap** — works if you already have
  SSR or an HTML template process. Not viable for pure static hosting.
- **Vite `define` at build time** — equivalent to baking values into the
  bundle; same problem this ADR is solving.

## Cross-references

- **ADR 0013** (env config via validated schema) — server-side counterpart.
  Server apps use zod-at-boot; web apps use the placeholder pattern. A
  shared env-config package exposes `BUILD_MODE`, the placeholder emitter,
  and the replace-env helper so both sides stay aligned.

## Implementation notes

When the shared env-config package is extracted (ADR 0013 follow-up), ship
three public entry points:

- `getFlattenedConfigAsEnvVars()` — reads the config tree and emits real
  values or placeholders depending on `BUILD_MODE`.
- `generate-env` CLI — writes `.env.local` with plain + `VITE_` pairs.
- `replace-env` CLI — runs the runtime sed pass over a `dist/` directory.

Web apps' Dockerfiles then need two lines: `BUILD_MODE=true` on the build
step, and a small entrypoint that invokes `replace-env` before handing off
to the static server.
