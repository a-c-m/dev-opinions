import { defineConfig } from "vitest/config";

// ADR 0039: single root config owns coverage policy. Per-package
// vitest configs handle project-specific concerns (environment,
// setupFiles, include globs) but must NOT declare their own
// `coverage.*` blocks — Vitest ignores them when the root runs.
//
// Globs match files relative to repo root. A file matched by a
// glob threshold must satisfy BOTH the glob tier AND the global
// floor (Vitest's behaviour, differs from Jest).
export default defineConfig({
  test: {
    projects: [
      "apps/*/*/vite.config.ts",
      "apps/*/*/vitest.config.ts",
      "shared/*/vitest.config.ts",
      "tools/*/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary", "json"],
      reportOnFailure: true,
      include: ["apps/*/*/src/**/*.{ts,tsx}", "shared/*/src/**/*.ts", "tools/*/src/**/*.ts"],
      exclude: [
        // ADR 0039 — types & DI wiring
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
        // Drizzle declarative schema (ADR 0012)
        "**/db/schema/**",
        "**/drizzle/**",
        // Smoke-only via E2E (ADR 0013 / ADR 0039)
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
      thresholds: {
        // Global floor — applies to every counted file, including
        // files matched by glob tiers below.
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
        // shared/* infra — 100 on statements/lines/functions, hard 95
        // on branches per ADR 0039 (branch-coverage paradox).
        // Escape valve is `/* v8 ignore next -- @preserve */`, NOT
        // a threshold drop.
        "shared/**/src/**/*.ts": {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 95,
        },
        // App services — 80/80. Resolvers/controllers are excluded
        // from rollup entirely (smoke-only via E2E per ADR 0013).
        "apps/*/*/src/**/*.service.ts": {
          lines: 80,
          branches: 80,
        },
      },
    },
  },
});
