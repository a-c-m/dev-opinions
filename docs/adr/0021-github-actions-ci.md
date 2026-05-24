---
date: 2026-04-19
---

# ADR 0021: GitHub Actions with reusable workflows

## Context and Problem Statement

CI is part of the quality gate, not a layer bolted on afterwards. Every check that exists locally (`pnpm check`, `pnpm security`) must run on every PR, and must run fast enough that contributors do not learn to ignore it. Two common failure modes to avoid:

- **Copy-paste workflows** — one YAML per app, all subtly different, drifting over time.
- **One giant workflow** — unreadable, hard to change, prone to silent regressions.

The pattern that avoids both is a small library of **reusable workflows** (prefix `_`) plus thin app-specific workflows that call them.

## Decision Outcome

- **GitHub Actions** as the sole CI provider.
- Repository layout:
  ```
  .github/
  ├── actions/
  │   └── setup-monorepo/             # composite action: checkout + pnpm + cache + install
  │       └── action.yml
  └── workflows/
      ├── ci.yml                      # PR entry point: calls nx affected + knip + trivy
      ├── trivy.yml                   # scheduled full vulnerability scan
      ├── _container-build.yml        # reusable: build, tag, scan, push an image
      └── _infra-deploy.yml           # reusable: tofu init/validate/plan/apply
  ```
- **Naming**: reusable workflows are prefixed `_`. App-specific workflows call them with inputs; they do not duplicate the steps.
- **Composite action `setup-monorepo`**: encapsulates Node via `.nvmrc`, pnpm via Corepack, pnpm store cache keyed on `pnpm-lock.yaml`, and `pnpm install --frozen-lockfile`. Every workflow that touches Node code uses this action — there is no place where the setup steps are re-inlined.
- **Affected-only by default**: PR CI runs `nx affected --target=lint,typecheck,test` (driven by the base branch). Full-repo equivalents exist for scheduled runs or release gates.
- **Security runs on every PR**: Trivy fs-scan for HIGH/CRITICAL (dependencies, secrets, misconfigurations). Scheduled weekly full scan for drift detection.
- **Container registry is parameterised**: `_container-build.yml` takes `registry`, `image`, `username`, `password` as inputs. The template's example wiring uses GHCR via `GITHUB_TOKEN`; consumers point it elsewhere (ECR, Harbor, Docker Hub) without editing the reusable workflow.
- **Concurrency**: each workflow cancels in-progress runs for the same branch so a forced push does not queue stale CI.
- **OIDC**: cloud authentication is OIDC-only. Long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / equivalents must not be added as repo or environment secrets. The control is the cloud-side IAM posture (no long-lived-key users provisioned) plus Trivy secret scanning on every PR; PR review catches the shape mistake. See [ADR 0034](0034-secrets-runtime-injection.md) for the full secrets-injection model.

## Consequences

### Positive
- Reusable workflows make per-app CI a one-line `uses:` invocation. Drift between apps becomes impossible in the shared layer.
- `setup-monorepo` centralises the install path; changing Node version or switching package manager is one file.
- Parameterised registry makes the container workflow reusable by consumers with any target — no rewrite on adoption.
- Trivy on every PR keeps dependency/secret issues at the PR boundary, not discovered at release time.

### Negative
- The prefix-`_` convention is a team convention, not enforced by GitHub. It has to be documented (this ADR) and reviewed in PRs.
- Reusable workflows add a level of indirection that can be confusing to readers. Mitigation: the reusable workflow file is short and its inputs are documented at the top.

## Alternatives considered

- **GitLab CI, CircleCI, Buildkite** — capable alternatives, but repo lives on GitHub; keeping CI on the same platform removes a permissions and secrets integration layer.
- **Inlined workflows per app** — simplest to write, painful to maintain. Rejected.
- **One monolithic pipeline** — hides the boundaries between apps; PR feedback becomes a single long log. Rejected.
