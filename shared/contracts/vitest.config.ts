import { defineConfig } from "vitest/config";

// Coverage policy lives in the root vitest.config.ts (ADR 0014).
// Per-package coverage blocks are ignored when the root runs.
// Pure-type stub per ADR 0039 — no specs yet, so `--passWithNoTests`
// in the package.json test script.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    passWithNoTests: true,
  },
});
