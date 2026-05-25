# tools

Workspace-internal tooling: custom reporters, code generators, one-off
scripts packaged as proper workspace members so they typecheck and lint
alongside the rest of the monorepo.

Typical occupants:

- `knip-issue-count-reporter` — reporter for the `knip` dead-code tool.
- `monorepo-cz-adapter` — custom Commitizen adapter enforcing the repo's
  scope conventions (ADR 0020 → Commit conventions).
- `eslint-plugin-package-json-dependencies` — project-local lint rules.

## Conventions

- Packages here are `private: true`; they are never published to npm.
- They run via `pnpm nx run <tool>:…` or are invoked as a dependency of
  another package's scripts.
- Tests optional; if present, Vitest.
