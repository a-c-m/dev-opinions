# ADR 0015: Trivy for vulnerability scanning

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

A quality gate that covers lint, types, tests, and dead code still lets vulnerable dependencies, misconfigured infrastructure, and leaked secrets through to production. Catching these earlier — on every PR rather than via an external audit — is the difference between a 1-line bump and a breach postmortem. The scanner needs to cover multiple surfaces (npm dependencies, container images, IaC, committed secrets) without a per-surface tool for each.

## Decision

- **Trivy** (Aqua Security) as the single vulnerability scanner.
- Run locally and in CI via `pnpm security` → `./scripts/security-scan.sh`.
- Scans cover:
  - `fs` scan over the whole repo for known-vuln packages in lockfiles, secrets in source, and misconfigurations in IaC.
  - `image` scan over any Dockerfiles' produced images (when Docker is present in CI).
  - `config` scan over Kubernetes/Terraform/Helm when present.
- Severity gate: `HIGH` and `CRITICAL` findings fail the script. `MEDIUM` and below are reported but non-blocking.
- `pnpm check` invokes `pnpm security` as a mandatory step — security is part of the same gate as lint and tests, not a separate ceremony.
- Trivy DB is cached in CI to keep runs fast.

## Consequences

**Positive**
- One tool covers multiple surfaces instead of four narrow ones.
- Findings surface on the PR that introduced them, while context is fresh.
- Secrets scan reduces the chance of an accidental commit going unnoticed.

**Negative**
- Trivy binary must be installed on dev machines and CI runners. Not a transitive npm dep — it is a system tool.
- Severity tuning takes care; over-aggressive gating turns the tool into noise that gets disabled.

## Alternatives

- **Snyk / GitHub Dependabot** — excellent for dependency scanning but narrower (no secrets/IaC out of the box, or gated by tier).
- **npm audit** — dependency-only, notoriously noisy, Node-only.
- **gitleaks + checkov + grype** stack — more tools, more config surface, more maintenance.

## Installation

- macOS: `brew install aquasecurity/trivy/trivy`
- Linux (Debian/Ubuntu): see <https://aquasecurity.github.io/trivy/>
- CI: the `aquasecurity/trivy-action` GitHub Action (or equivalent for other CIs).

The script fails with a clear message if Trivy is missing, so a fresh clone cannot silently skip security scanning.
