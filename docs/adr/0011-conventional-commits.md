# ADR 0011: Conventional Commits + commitlint + commitizen

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Commit history is an API that tools and humans read. When it is structured, automated changelogs, semver bumps, and `git log` filtering all fall out for free. When it is freeform, every release becomes a manual review of what actually shipped. Choosing a spec, validating it, and giving authors an interactive prompt to write correct commits turns the convention from aspirational to reliable.

## Decision

- **Conventional Commits 1.0** as the spec.
- `@commitlint/cli` + `@commitlint/config-conventional` validate format via the Lefthook `commit-msg` hook.
- `commitizen` + `cz-conventional-changelog` drive an interactive `pnpm commit` (`cz`) prompt.
- Scope convention: NX project name (`api`, `web`, `logger`, `env-config`, …).
- Optional issue suffix: `#<n>` (e.g. `feat(api): add search endpoint #142`).
- `nx release` consumes commit types to compute per-project semver bumps.

## Consequences

**Positive**
- Automated changelogs and versioning without manual bookkeeping.
- Readable, grep-friendly history.
- The interactive prompt lowers the bar for correctly formatted commits, especially for new contributors.

**Negative**
- Friction on fast, informal commits during exploratory work. Mitigation: enforce on shared branches via CI commit-lint; allow looser history on solo feature branches if the prompt becomes an irritant.
- Interactive prompt and CLI tooling are one more set of dev dependencies to keep current.

## Alternatives

- **Freeform commits** — fastest to write, no automation path.
- **Conventional Commits without commitizen** — lower tooling overhead but higher author error rate.
- **Gitmoji or Angular-style custom** — niche; less ecosystem tooling.
