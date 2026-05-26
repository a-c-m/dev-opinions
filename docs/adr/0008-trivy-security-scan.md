---
date: 2026-04-19
---

# ADR 0008: Trivy for vulnerability scanning

## Context and Problem Statement

A quality gate that covers lint, types, tests, and dead code still lets vulnerable dependencies, misconfigured infrastructure, and leaked secrets through to production. Catching these earlier — on every PR rather than via an external audit — is the difference between a 1-line bump and a breach postmortem. The scanner needs to cover multiple surfaces (npm dependencies, container images, IaC, committed secrets) without a per-surface tool for each.

## Decision Outcome

- **Trivy** (Aqua Security) as the single vulnerability scanner.
- Run locally and in CI via `pnpm security` → `./scripts/security-scan.sh`.
- Scans cover:
  - `fs` scan over the whole repo for known-vuln packages in lockfiles, secrets in source, and misconfigurations in IaC.
  - `image` scan over any Dockerfiles' produced images (when Docker is present in CI).
  - `config` scan over Kubernetes/Terraform/Helm when present.
- Severity gate: `HIGH` and `CRITICAL` findings fail the script. `MEDIUM` and below are reported but non-blocking.
- `pnpm check` invokes `pnpm security` as a mandatory step — security is part of the same gate as lint and tests, not a separate ceremony.
- Trivy DB is cached in CI to keep runs fast.

### Installation

- macOS: `brew install aquasecurity/trivy/trivy`
- Linux (Debian/Ubuntu): see <https://aquasecurity.github.io/trivy/>
- CI: the `aquasecurity/trivy-action` GitHub Action (or equivalent for other CIs).

The script fails with a clear message if Trivy is missing, so a fresh clone cannot silently skip security scanning.

## Lifecycle script policy

Supply-chain attacks against npm packages have repeatedly used install lifecycle scripts (`preinstall`, `install`, `postinstall`) as the execution vector — the package gets pulled in by `pnpm install` and its postinstall runs with full developer credentials. Recent incidents that motivated this hardening:

- **Nx s1ngularity** (Aug 2025) — compromised `nx` releases shipped a postinstall that exfiltrated tokens.
- **Shai-Hulud** (Sept 2025) — self-replicating worm propagated via lifecycle scripts across npm.
- **Shai-Hulud 2.0** (Nov 2025) — second wave; same vector, different payload.

### Decision

Install lifecycle scripts are **denied by default**. The repo opts specific packages into running their scripts via `pnpm.onlyBuiltDependencies` in the root `package.json`. Anything not on the list has its postinstall silently skipped by pnpm.

### Current allow-list

- **esbuild** — downloads the platform-native binary (no binary, no bundler).
- **lefthook** — installs the local git hook shims that wire `lefthook.yml` into `.git/hooks/`.
- **nx** — registers the NX daemon and CLI shims for local cache.
- **unrs-resolver** — Rust napi-rs resolver; the postinstall picks the correct prebuilt binary for the host platform.
- **@import-meta-env/unplugin** — wires up the ADR 0017 build-time env-injection hook.

`@nestjs/core`'s postinstall is intentionally **not** allow-listed — it is `opencollective || exit 0`, a funding-attribution probe that is safe to skip.

### Migration path

pnpm 11 renames this field to `allowBuilds` with an object syntax (`{name: "reason"}`). When we move to pnpm 11 (currently blocked on a `pnpm.overrides` regression and NX ≥22.7.3 for pnpm 11 compatibility), translate the array above to the new shape and inline the justifications.

## Consequences

### Positive
- One tool covers multiple surfaces instead of four narrow ones.
- Findings surface on the PR that introduced them, while context is fresh.
- Secrets scan reduces the chance of an accidental commit going unnoticed.

### Negative
- Trivy binary must be installed on dev machines and CI runners. Not a transitive npm dep — it is a system tool.
- Severity tuning takes care; over-aggressive gating turns the tool into noise that gets disabled.

## Alternatives considered

- **Snyk / GitHub Dependabot** — excellent for dependency scanning but narrower (no secrets/IaC out of the box, or gated by tier).
- **npm audit** — dependency-only, notoriously noisy, Node-only.
- **gitleaks + checkov + grype** stack — more tools, more config surface, more maintenance.
