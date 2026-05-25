---
date: 2026-04-19
---

# ADR 0031: GitHub repository conventions

## Context and Problem Statement

A repository communicates through more than its code. GitHub surfaces — issue templates, PR templates, CODEOWNERS, Dependabot, SECURITY.md — are all default-on slots for conventions that otherwise live in tribal knowledge. Commit history is also a GitHub-surface API: when structured, automated changelogs, semver bumps, and `git log` filtering all fall out for free; when freeform, every release becomes manual review of what actually shipped.

A template that ships with these slots filled puts every downstream project on the same footing from day one, instead of re-inventing them at different rates.

This ADR covers the repository-meta layer. CI workflows themselves are in [ADR 0032](0032-github-actions-ci.md).

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

### Commit conventions

- **[Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/)** as the spec.
- `@commitlint/cli` + `@commitlint/config-conventional` validate format via the Lefthook `commit-msg` hook ([ADR 0030](0030-lefthook.md)).
- `commitizen` + `cz-conventional-changelog` drive an interactive `pnpm commit` (`cz`) prompt.
- **Scope = NX project name** (`api`, `web`, `logger`, `env-config`, …) so commits filter cleanly by project and `nx release` can compute per-project semver bumps from the history.
- **Trailing ticket suffix is mandatory for AI-authored commits**: `#<n>` (GitHub) or `PROJ-<n>` (Jira/Linear), e.g. `feat(api): add search endpoint #142`. The PreToolUse hook blocks AI `git commit` without one — no AI-side escape hatch. Humans MAY commit without one when there is genuinely no ticket (scaffolding, dep bump, hotfix-without-issue). See [CLAUDE.md "Every commit names its ticket"](../../CLAUDE.md).

The ticket suffix is the load-bearing piece: it underpins the commit ↔ ticket ↔ release traceability that PR review, release notes, and audit all depend on.

### CODEOWNERS (`.github/CODEOWNERS`)

CODEOWNERS carries two things in this repo: **PR-review routing** (who reviews changes to a path) and **team metadata** (who is on the team, where they're reachable). One file, parsed natively by GitHub for routing and ignored-as-comments for metadata.

**Routing rules**

- **By path**, not by file. `/apps/<name>/` maps to the owners of that app, `/shared/<name>/` to its maintainers, `/docs/adr/` to the architects who ratify decisions.
- **Last match wins** — ordering matters and is documented inline.
- **Cross-cutting paths** (`**/Dockerfile`, `**/iac/`, `.github/workflows/`) map to the platform/DevOps owners, regardless of app.
- The template ships a stub with comments explaining the pattern, not placeholder team names.

**Team metadata (opt-in comment blocks above rule lines)**

When a block is present, it carries:

- `# PM: @handle` — exactly one person. *(Required when block exists.)*
- `# TechLead: @handle` — exactly one person. *(Required when block exists.)*
- `# <RoleName> [/ @org/<team>]: @handle1 @handle2 …` — optional roles, free-form names (`Frontend`, `Backend`, `DBA`, `QA`, `DevOps`, `Security`, …). PascalCase recommended.
- `# slack: #<channel>` — optional.
- `# alerting: <url>` — vendor-neutral (PagerDuty / Opsgenie / etc.). Optional.
- `# monitoring: <url>` — dashboard or metrics view. Optional.
- `# status: deprecated | experimental` — omit when `production`. Optional.

Example:

```
# --------------------------------------------------------------------------
# PM:         @alice
# TechLead:   @bob
# Frontend:   @charlie @diana
# Backend:    @bob @eric @frank
# slack:      #payments-engineering
# alerting:   https://acme.pagerduty.com/services/PD123
# monitoring: https://grafana.acme.io/d/payments-api
# --------------------------------------------------------------------------
/apps/payments/api/    @org/payments
```

Services with nothing notable get just the rule line — blocks are opt-in. Unknown comment lines are ignored.

Deliberately excluded: `name` (path is the identity), `team` (on the rule line below), `runbook` (convention `docs/runbooks/<service>.md`), `description` (in README / AGENTS.md), `last-updated` (`git log`).

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

Deliberately **not** added. Per [ADR 0037](0037-multi-agent-rule-distribution.md), `AGENTS.md` is the canonical cross-agent context file; `CLAUDE.md` is a committed symlink to it. Mirroring into `copilot-instructions.md` guarantees drift. If Copilot users join the project, point them at `AGENTS.md`.

## Consequences

### Positive
- Every repo spawned from the template has the same issue/PR shape, making cross-repo review and triage lower-friction.
- Conventional Commits + scoped history feeds `nx release` for automated, per-project changelogs and semver bumps.
- Single file (CODEOWNERS) covers review routing **and** team metadata; no second document to drift.
- Dependabot is on by default with a sensible cadence, not a rushed afterthought that teams disable because it became noisy.
- SECURITY.md gives external reporters a channel from day one, not after the first disclosure panic.

### Negative
- The templates are opinionated. Teams wanting a different PR shape must edit them on adoption.
- Conventional Commits adds friction on fast, informal commits during exploratory work; mitigated by allowing looser history on solo feature branches when the prompt is an irritant (CI still gates shared branches).
- Staggered Dependabot days are a convention; a team in a different timezone or cadence may want to shift the schedule.
- CODEOWNERS team-metadata blocks have no machine-validated schema — malformed metadata parses as commentary and is silently ignored.

## Alternatives considered

- **Ship the repo without these files** — fastest to write, forces every downstream project to invent the shape. Rejected.
- **Link to external docs instead of inlining templates** — external docs drift and are not surfaced by GitHub. Inlined is cheaper.
- **Skip Dependabot, rely on Renovate or Trivy only** — Renovate is more flexible but heavier to configure; Trivy finds vulnerabilities but not version currency. Dependabot covers the common 80% and is free/native.
- **Freeform commits / Gitmoji / Angular-style custom** — no automation path or niche ecosystem. Conventional Commits has the broadest tooling. Rejected.
- **Separate `TEAM.md` file for team metadata** — two files for one ownership story; one `TEAM.md` can't capture per-service detail in a monorepo. Rejected.
- **Backstage `catalog-info.yaml` for team metadata** — couples to Backstage before it's adopted; same vendor-lock concern as PagerDuty-named keys. Rejected.

## Related

- [ADR 0030](0030-lefthook.md) — Lefthook hosts the `commit-msg` gate.
- [ADR 0032](0032-github-actions-ci.md) — CI workflows that consume the conventions here.
- [ADR 0035](0035-branching-releases-environments.md) — release flow that depends on Conventional Commits + CODEOWNERS review.
- [ADR 0037](0037-multi-agent-rule-distribution.md) — `AGENTS.md` cross-agent standard; explains why we don't mirror into per-agent files.
- [ADR 0005](0005-child-apps-and-repos.md) — scope: CODEOWNERS conventions apply to this repo; children under `repos/` own their own files.
- [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [CODEOWNERS documentation — GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
