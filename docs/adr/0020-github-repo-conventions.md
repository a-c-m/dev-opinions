---
date: 2026-04-19
---

# ADR 0020: GitHub repository conventions

## Context and Problem Statement

A repository communicates through more than its code. GitHub surfaces — issue templates, PR templates, CODEOWNERS, Dependabot, SECURITY.md — are all default-on slots for conventions that otherwise live in tribal knowledge. A template that ships with these slots filled puts every downstream project on the same footing from day one, instead of re-inventing them at different rates.

This ADR covers the repository-meta layer. CI workflows themselves are in ADR 0021.

## Decision Outcome

### Pull request template (`.github/pull_request_template.md`)

Every PR opens with the same structure so reviewers can orient in seconds:

- **Risk level** — `HIGH | MEDIUM | LOW | TRIVIAL`. Author self-assesses. Forces a pause.
- **Summary** — what changed. One to three bullets, no diff restatement.
- **Why it matters** — who benefits, what outcome. Not "what the code does".
- **Test plan** — concrete steps and commands that were run. Checklist style.
- **Breaking changes** — optional, explicit if present.
- **Checklist** — ADR alignment, tests added/updated, docs updated, `pnpm check` green.

### Issue templates (`.github/ISSUE_TEMPLATE/`)

Five templates cover the common intake shapes, with `config.yml` disabling the blank template so every issue picks a category.

- `story.md` — feature work: goal, success metric, impact, acceptance criteria.
- `bug.md` — description, reproduction steps, expected vs actual, environment.
- `discovery.md` — research spikes with explicit deliverable (a decision, a doc, a spike branch).
- `release.md` — release planning or release notes.
- `default.md` — catch-all for issues that do not fit a category.

### CODEOWNERS (`.github/CODEOWNERS`)

- **By path**, not by file. `/apps/<name>/` maps to the owners of that app, `/shared/<name>/` to its maintainers, `/docs/adr/` to the architects who ratify decisions.
- **Last match wins** — ordering matters and is documented inline.
- **Cross-cutting paths** (`**/Dockerfile`, `**/iac/`, `.github/workflows/`) map to the platform/DevOps owners, regardless of app.
- The template ships a stub with comments explaining the pattern, not placeholder team names.

### Dependabot (`.github/dependabot.yml`)

Four ecosystems, **staggered weekly** so the review load spreads across the week:

| Ecosystem | Day | Rationale |
|---|---|---|
| `npm` | Monday | App code; most frequent churn. |
| `github-actions` | Tuesday | Keeps CI infra current. |
| `docker` | Wednesday | Base images; security-sensitive. |
| `terraform` | Friday | Providers; reviewed before the weekend. |

- **PR caps**: 3 open PRs per ecosystem (1 for GitHub Actions — they should not be noisy).
- **Grouping**: minor + patch grouped per ecosystem so the review queue does not explode; majors open as individual PRs so breaking changes are visible.
- **Ignored**: Node major upgrades in Docker base images until the `.nvmrc` bumps (prevents Dependabot fighting the platform ADR).

### SECURITY.md (`.github/SECURITY.md`)

- **Reporting channel**: a dedicated security email (placeholder `security@example.com` in the template; consumers swap on adoption).
- **SLA by severity**:
  - Initial response within 48 hours for any report.
  - Fix timelines: Critical 30 days, High 60 days, Medium/Low 90 days.
- **Severity definitions** inline so reporters and reviewers disagree on the right axis, not the label.

### Copilot / other AI instruction files

Deliberately **not** added. Per [ADR 0028](0028-multi-agent-rule-distribution.md), `AGENTS.md` is now the canonical cross-agent context file; `CLAUDE.md` is a committed symlink to it. Mirroring into `copilot-instructions.md` guarantees drift. If Copilot users join the project, point them at `AGENTS.md`.

## Consequences

### Positive
- Every repo spawned from the template has the same issue/PR shape, making cross-repo review and triage lower-friction.
- Dependabot is on by default with a sensible cadence, not a rushed afterthought that teams disable because it became noisy.
- CODEOWNERS is a concrete stub, not a blank file — consumers have a pattern to follow.
- SECURITY.md gives external reporters a channel from day one, not after the first disclosure panic.

### Negative
- The templates are opinionated. Teams wanting a different PR shape must edit them on adoption.
- Staggered Dependabot days are a convention; a team in a different timezone or cadence may want to shift the schedule.

## Alternatives considered

- **Ship the repo without these files** — fastest to write, forces every downstream project to invent the shape. Rejected.
- **Link to external docs instead of inlining templates** — external docs drift and are not surfaced by GitHub. Inlined is cheaper.
- **Skip Dependabot, rely on Renovate or Trivy only** — Renovate is more flexible but heavier to configure; Trivy finds vulnerabilities but not version currency. Dependabot covers the common 80% and is free/native.
