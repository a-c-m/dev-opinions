import { defineConfig } from "vitest/config";

// ADR 0014: single root config owns coverage policy. Per-package
// vitest configs handle project-specific concerns (environment,
// setupFiles, include globs) but must NOT declare their own
// `coverage.*` blocks — Vitest ignores them when the root runs.
//
// Globs match files relative to repo root. A file matched by a
// glob threshold must satisfy BOTH the glob tier AND the global
// floor (Vitest's behaviour, differs from Jest).
export default defineConfig({
  // ADR 0039 — source-mode dev. Tests resolve `@shared/*` to raw `.ts`
  // via the `source` export-condition key rather than the built `dist/`.
  // No `pnpm build` required before `pnpm test`.
  resolve: {
    conditions: ["source"],
  },
  test: {
    projects: [
      "apps/*/*/vite.config.ts",
      "apps/*/*/vitest.config.ts",
      "shared/*/vitest.config.ts",
      "tools/*/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      // `json-summary` is the input format `pnpm cov:check` (the
      // per-file ratchet) reads. Don't remove it without updating
      // `.coverage-baseline.json#coverageFile`.
      reporter: ["text", "lcov", "json-summary", "json"],
      reportOnFailure: true,
      include: ["apps/*/*/src/**/*.{ts,tsx}", "shared/*/src/**/*.ts", "tools/*/src/**/*.ts"],
      exclude: [
        // ADR 0014 — types & DI wiring
        "**/*.types.ts",
        "**/types.ts",
        "**/*.dto.ts",
        "**/*.module.ts",
        // barrels / re-exports
        "**/index.ts",
        "**/*.barrel.ts",
        // generated code
        "**/__generated__/**",
        "**/*.gen.ts",
        // Drizzle declarative schema (ADR 0011)
        "**/db/schema/**",
        "**/drizzle/**",
        // Smoke-only via E2E (ADR 0012 / ADR 0014)
        "**/*.controller.ts",
        "**/*.resolver.ts",
        // configs / boot / test infra
        "**/*.config.*",
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.e2e-spec.ts",
        "**/test/**",
        "**/test-setup.ts",
        "**/main.{ts,tsx}",
        "**/instrumentation.{mts,mjs,ts}",
      ],
      // Vitest's own `thresholds:` is intentionally absent.
      //
      // Per ADR 0014, coverage is gated by the per-file ratchet in
      // `tools/coverage-baseline/` — run via `pnpm cov:check`, fed by
      // the `json-summary` reporter above, configured in
      // `.coverage-baseline.json` (glob → per-file threshold map) and
      // pinned by `coverage-baseline.json` (committed per-file
      // snapshot). The ratchet catches "file X regressed" and "new
      // file Y is below its glob's bar"; vitest's `thresholds` only
      // catches "the *average* across globbed files dropped", which
      // hides per-file regressions and fails on the wrong shape (one
      // 0% file drags the mean below a global floor even when every
      // other file is at 100%).
      //
      // Don't add `thresholds:` back here. Edit `.coverage-baseline.json`
      // glob tiers, then run `pnpm cov:promote` to refresh the snapshot.
    },
  },
});
