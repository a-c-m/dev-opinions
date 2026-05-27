#!/usr/bin/env node
// `pnpm help` — print the repo's package.json scripts with one-line
// descriptions. The descriptions live inline below; keep them current
// when adding/removing a script in package.json. Walks every script and
// prints "<unknown>" for any that's missing a description (visible nudge).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

// Order groups by frequency-of-use. Scripts not listed here print at the
// end under "Other" so they're still discoverable.
const groups = [
  [
    "Day-to-day",
    {
      dev: "Run every app in dev mode (parallel, fans the laptop)",
      "dev:obs": "Bring up the local OTel stack (collector + Tempo + Loki + Grafana)",
      "dev:obs:down": "Tear down the local OTel stack",
      "watch-logs": "tail -f .ai-wip/logs/ piped through pino-pretty",
      build: "Build every app + lib via nx run-many",
      test: "Run every workspace project's unit tests via nx",
      "test:cov": "Vitest with coverage (root config, ADR 0014)",
      "test:e2e": "Run every project's Playwright suite via nx",
      commit: "Interactive Conventional Commit prompt (Commitizen)",
    },
  ],
  [
    "Quality gates",
    {
      check:
        "lint:check + typecheck + test:cov + cov:check + knip + security + check:overrides + check:shared",
      "check:fast":
        "lint+typecheck via run-many (NX deadlock workaround); test via nx affected — see docs/conventions/nx-targets.md",
      "check:overrides": "Verify pnpm-overrides.md is in sync with package.json pnpm.overrides",
      lint: "Biome 2 + Ultracite (--write, auto-fix)",
      "lint:check": "Biome read-only — fails on NEW errors vs the baseline",
      "lint:ci": "Stricter Biome — also fails when the baseline could be tightened",
      "lint:init": "Generate the initial Biome suppression baseline",
      "lint:update": "Refresh the Biome suppression baseline (humans only)",
      "lint:status": "Show the current Biome suppression baseline status",
      "lint:clear": "Drop the Biome suppression baseline",
      typecheck: "tsgo --noEmit across every workspace project (NX cached)",
      knip: "Dead-code / unused-deps scan",
      security: "Trivy fs scan — deps + secrets + IaC misconfig (ADR 0008)",
      "cov:check": "Coverage baseline ratchet check (ADR 0014)",
      "cov:promote": "Promote current coverage as the new baseline (humans use --allow-decrease)",
    },
  ],
  [
    "Maintenance",
    {
      release: "nx release — versioning + changelog (run from a clean tree)",
      reset: "Delete the sample apps when starting a real project",
      fix: "ultracite fix — last-resort full-tree autofix",
      prepare: "Install lefthook git hooks (runs automatically on pnpm install)",
    },
  ],
];

const seen = new Set();
const out = [];

const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));

for (const [header, items] of groups) {
  const rows = [];
  for (const [name, desc] of Object.entries(items)) {
    if (name in scripts) {
      rows.push([name, desc]);
      seen.add(name);
    }
  }
  if (rows.length === 0) {
    continue;
  }
  out.push(`\n## ${header}\n`);
  const width = Math.max(...rows.map(([n]) => n.length));
  for (const [n, d] of rows) {
    out.push(`  ${pad(n, width)}   ${d}`);
  }
}

const leftover = Object.keys(scripts).filter((n) => !seen.has(n));
if (leftover.length > 0) {
  out.push("\n## Other (not yet described in scripts/help.mjs)\n");
  const width = Math.max(...leftover.map((n) => n.length));
  for (const n of leftover) {
    out.push(`  ${pad(n, width)}   <add a description in scripts/help.mjs>`);
  }
}

out.push(""); // trailing newline
process.stdout.write(out.join("\n"));
