---
date: 2026-04-19
---

# ADR 0006: Biome 2 + Ultracite + biome-suppressed for lint and format

## Context and Problem Statement

A repository needs one source of truth for lint rules and code formatting. Running ESLint and Prettier side by side means two config surfaces, two parsers, two install trees, and two places where preferences can drift. Biome replaces both with a single Rust binary; Ultracite adds a curated, opinionated ruleset on top so each repo does not re-derive its own preferences.

An opinionated, strict preset applied to an existing codebase produces a wall of errors. Without a way to accept the current state and only block *new* regressions, teams either turn off rules that matter or merge with red CI. `biome-suppressed` (command `bs`) sits between the scripts and biome: it records the current error count as a baseline and fails CI only when that count grows. The baseline is a small, reviewable artefact committed to the repo; cleanups ratchet the count down over time.

## Decision Outcome

- `@biomejs/biome` (exact `2.4.15`) as the single lint + format tool.
- `ultracite` (exact `7.7.0`) as the shared rule preset. v7 layout requires extending **both** `ultracite` and `ultracite/biome/core` in `biome.jsonc` — `npx ultracite@latest init` sets this up. The pair is known-compatible: newer biome minors rename rules that older ultracite releases reference.
- **Agent priming**: `npx ultracite@latest init --agents claude --agents opencode` appends the rule-summary section to `AGENTS.md`. Future agents read this on session start; saves rediscovering rules error-by-error.
- `biome-suppressed` (exact `1.3.0`) provides the `bs` CLI, used by every lint script. The baseline is stored in `.biome-suppressed.json` and committed.
- Scripts in `package.json`:
  - `lint` = `bs check --write` — format and fix.
  - `lint:check` = `bs check` — baseline-aware check (fails on new issues only).
  - `lint:ci` = `bs check --suppression-fail-on-improvement` — CI gate that also fails if the baseline has improved without being updated (so improvements are locked in).
  - `lint:init` / `lint:update` / `lint:status` / `lint:clear` — manage the baseline explicitly.
- The Claude Code pre-edit hook uses raw `biome check` (not `bs`), because hook validation must act on the specific content being written and not consult a historical baseline.
- Per-framework overrides in `biome.jsonc` stay narrow — for example, env files exempt `useNamingConvention` (env vars are idiomatically `UPPER_CASE`), test files exempt `noConsole`, backend decorator files exempt `useImportType`.

## Consequences

### Positive
- One binary replaces ESLint + Prettier + import sorter, which cuts install size, startup time, and config complexity.
- An opinionated shared preset stops the team debating style choices at the PR level.
- Biome is fast enough to run on every save and in every pre-commit hook without noticeable lag.
- `bs` makes it realistic to adopt strict linting on brownfield repos: accept the current state, block regressions, ratchet down.

### Negative
- Biome's plugin ecosystem is smaller than ESLint's. Custom rules need to be proposed upstream or enforced via separate tooling.
- An opinionated preset occasionally clashes with legitimate exceptions. The suppression baseline is the escape valve; its size should be monitored and driven down over time, not treated as a landing pad.
- The biome + ultracite version pair is tight. An upgrade of either requires checking the other's compatibility before bumping.

## Alternatives considered

- **ESLint 9 flat + Prettier** — broader ecosystem, but slower, more config surface, and still requires a separate formatter.
- **Biome alone (no shared preset)** — loses the curated default; every repo re-derives rules and they drift.
- **Biome without `bs`** — workable on greenfield, painful on brownfield: every rule tightening becomes a big-bang cleanup PR instead of a ratchet.
