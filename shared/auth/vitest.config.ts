import { defineConfig } from "vitest/config";

// Coverage policy lives in the root vitest.config.ts (ADR 0039).
// Per-package coverage blocks are ignored when the root runs.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
