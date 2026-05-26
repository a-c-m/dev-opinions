---
date: 2026-05-25
decision-makers: [Repo platform]
---

# ADR 0015: E2E structure — per-app `-e2e` packages, fixtures-injected POM, project-scoped runs

## TL;DR

- One `apps/<product>/<service>-e2e/` workspace package per deployable. Holds `playwright.config.ts`, `tests/`, per-feature folders, env-specific auth setup.
- One `shared/e2e-helpers/` workspace package. Holds locators, API clients, data builders, and the **fixtures-augmented `test` export** every `-e2e` package imports.
- **Fixtures-injected POM** is the default. Bare `new LoginPage(page)` instantiation is rejected. Extract a POM class only when ≥3 fixtures share interaction sequences against the same page.
- `retries: process.env.CI ? 2 : 0`. `trace: 'retain-on-failure-and-retries'` (Playwright ≥1.59).
- Projects: **`local`** (default) and **`stage`** with `setup-stage` auth dependency. `staging-with-prod-auth` is a documented graduation, not day-one.
- Suite tagging: `@smoke` describes the subset that runs on every PR / preview env / prod-smoke. Full suite runs on merge-to-main and nightly.
- Stagehand stays opt-in under `<service>-e2e/stagehand/` per [ADR 0012](0012-vitest-playwright.md), gated by `STAGEHAND_MODE=1`.

## Context

[ADR 0012](0012-vitest-playwright.md) picked Playwright and asserted "E2E lives under `apps/<product>/<service>-e2e/`" without committing to the package shape, the page-object pattern, the project layout, or the retries/trace defaults. The sample app currently colocates `e2e/` inside the web app — the throwaway scaffold pattern, not the production one. Real services need a shared answer before the second `-e2e` package lands.

The community has moved off bare POM toward fixtures-injected POM (Playwright `test-fixtures` docs; Checkly / BrowserStack 2026 guides; Autonoma 2026 "Best Practices"). Trace mode `'retain-on-failure-and-retries'` shipped in Playwright 1.59 and resolves the pass-vs-fail diffing gap that `'on-first-retry'` left open.

## Decision Outcome

### Package shape

```
apps/<product>/<service>-e2e/
├── package.json                 # private workspace package
├── playwright.config.ts         # ONE config per package, not at repo root
├── tests/
│   ├── auth.setup.ts            # storageState producer for the `stage` project
│   ├── smoke/                   # @smoke-tagged tests; PR + prod-smoke runs
│   └── <feature>/               # full-regression tests
├── fixtures/                    # local-only fixtures (rare; prefer shared)
├── stagehand/                   # opt-in, gated by STAGEHAND_MODE env (ADR 0012)
└── tsconfig.json

shared/e2e-helpers/              # imported as `@shared/e2e-helpers`
├── src/
│   ├── locators/                # one file per page; the single edit-point
│   ├── api-clients/             # typed wrappers over the public API
│   ├── data-builders/           # POJO factories (returns DTOs, never hits DB)
│   ├── fixtures/                # composable Playwright fixtures
│   └── test.ts                  # re-exports `test` extended with fixtures
└── package.json
```

`-e2e` packages depend on `"@shared/e2e-helpers": "workspace:*"`. Importing `test` from `@playwright/test` directly in a test file is rejected by lint — every test imports from `@shared/e2e-helpers`.

### Fixtures-injected POM

```ts
// shared/e2e-helpers/src/test.ts
import { test as base, expect } from "@playwright/test";
import { LoginPage } from "./pages/login-page";

export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
});
export { expect };
```

```ts
// apps/sample/web-e2e/tests/auth/login.spec.ts
import { test, expect } from "@shared/e2e-helpers";

test("@smoke logs in", async ({ loginPage }) => {
  await loginPage.gotoAndSubmit({ email: "u@e2e.test", password: "x" });
  await expect(loginPage.welcomeBanner).toBeVisible();
});
```

- Locators are addressed via `page.getByRole` / `getByTestId`. Raw CSS / XPath selectors are last resort.
- A POM class is allowed but **earned** — extract one only when ≥3 fixtures repeat the same interaction sequence against the same page. Default is fixtures only.
- All selectors live under `shared/e2e-helpers/src/locators/`. A button-id change is a one-line fix.

### `playwright.config.ts` — per-package shape

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure-and-retries", // ADR 0015 — Playwright ≥1.59
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup-stage", testMatch: /auth\.setup\.ts/ },
    { name: "stage",
      use: { baseURL: process.env.STAGE_URL, storageState: ".auth/stage.json", ...devices["Desktop Chrome"] },
      dependencies: ["setup-stage"] },
    { name: "local",
      use: { baseURL: "http://localhost:5173", ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: "pnpm --filter <service> dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

CI scopes via `--project=stage --grep @smoke` (PR / prod-smoke) or `--project=stage` (full).

### Run cadence by trigger

| Trigger | Scope | Wall-clock target |
|---|---|---|
| PR open / preview env | `--project=stage --grep @smoke`, 1 browser | ≤ 5 min |
| Merge to `main` → stage | `--project=stage`, 1 browser | ≤ 15 min |
| Nightly cron | full × 3 browsers (chromium / firefox / webkit) | unbounded |
| Production deploy | `--project=stage --grep @smoke` against prod, scoped tokens | ≤ 3 min |

### Stagehand carve-out

Stagehand v3 lives at `apps/<p>/<s>-e2e/stagehand/`, ignored by the default `testDir`. Gated by `STAGEHAND_MODE=1` and a separate `playwright.stagehand.config.ts`. LLM cost and non-determinism keep it off the default gate per [ADR 0012](0012-vitest-playwright.md).

### What this defers (and the graduation trigger)

- **`staging-with-prod-auth` project** — implies a read-only prod token scoped per the synthetic-user model. Crosses [ADR 0027](0027-authentication.md) (token issuance) and [ADR 0036](0036-production-data-flow.md) (prod data egress). Graduation: when production runs and the token policy is approved.
- **Synthetic monitoring** (Checkly / Datadog Synthetics deploying the same `@smoke` scripts as scheduled monitors) — separate ADR when there's a real prod surface.
- **Playwright Component Testing for React 19** — Vitest browser mode is the current pick; revisit when CT stabilises.

## Consequences

### Positive

- **Selectors change in one file** — `shared/e2e-helpers/src/locators/`, not scattered through specs.
- **Fixtures compose without inheritance gymnastics** — `test.extend` chains; no POM class hierarchy.
- **`@smoke` is the only knob CI needs** — same suite, different `--grep` per cadence.
- **Per-package config matches the deployable shape** — one `-e2e` per service, mirrors the runtime topology.

### Negative

- **Two workspaces to add per new service** (`<service>` + `<service>-e2e`). Mitigated when NX generators ship for this.
- **`shared/e2e-helpers/` is a coupling point** — a breaking locator change ripples to every `-e2e` consumer. Trade for the single-edit-point benefit.
- **Two workspaces to add per new service** is the cost; `apps/sample/web-e2e/` shows the canonical shape (sibling package, implicit-deps the web app, owns its own `playwright.config.ts`).

### Neutral

- **`-e2e` packages are private workspaces** — never published, never imported by runtime code. They appear in `pnpm-workspace.yaml` only.
- **Browser matrix is single-chromium by default** — firefox / webkit run nightly only. PRs stay fast; cross-browser confidence is a daily artifact.

## Alternatives considered

1. **Single root `playwright.config.ts`** with all services as projects. Rejected — couples release cadence across services; one slow service blocks everyone's PRs.
2. **Bare POM (`new LoginPage(page)` in every test)**. Rejected per the 2026 community consensus and the fixtures-composable benefit.
3. **Selectors inline in tests**. Rejected — every selector change becomes an N-file PR.
4. **Stagehand as the default** (browserbase/stagehand v3). Rejected per [ADR 0012](0012-vitest-playwright.md): LLM latency + cost on the deterministic CI gate is a regression.
5. **`testDir: "../<service>/e2e"`** (colocated tests, no `-e2e` package). Works for the throwaway sample but loses the workspace-dep model for `shared/e2e-helpers/`.

## Related

- [ADR 0012](0012-vitest-playwright.md) — picked Playwright; this ADR is the package + pattern detail.
- [ADR 0013](0013-package-by-feature.md) — `tests/<feature>/` mirrors the source package-by-feature shape.
- [ADR 0027](0027-authentication.md) — the `staging-with-prod-auth` graduation depends on the token policy here.
- [ADR 0036](0036-production-data-flow.md) — prod-auth E2E also needs sanctioned data-egress rules.
- [Playwright test-fixtures](https://playwright.dev/docs/test-fixtures); [trace `retain-on-failure-and-retries`](https://playwright.dev/docs/api/class-testoptions#test-options-trace) (≥1.59).
- [Stagehand v3](https://github.com/browserbase/stagehand) — opt-in graduation.
