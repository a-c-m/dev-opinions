---
date: 2026-05-22
tags: [ai-agents, codeowners, team, ownership]
---

# ADR 0027: Team metadata in CODEOWNERS comments

## Context and Problem Statement

[ADR 0020](0020-github-repo-conventions.md) established CODEOWNERS
for PR review routing — *who reviews changes to this path*. But
CODEOWNERS doesn't say *who is on the team* or *what each person
does*. We want that answered in code, not in Slack.

## Decision Outcome

Carry team-and-ops metadata in **comment blocks above CODEOWNERS
rule lines**. Blocks are opt-in — present where there's something
worth saying, absent where the rule line is enough. The parser
recognises lines by shape; unknown comment lines are ignored.

### Required when a block exists

- `# PM: @handle` — exactly one person.
- `# TechLead: @handle` — exactly one person.

These are what an incident responder or agent reaches for first.

### Optional roles, free-form names

```
# <RoleName> [/ @org/<team>]: @handle1 @handle2 ...
```

Each service picks role names that fit (`Frontend`, `Backend`,
`DBA`, `QA`, `DevOps`, `Security`, …). PascalCase recommended; not
strictly enforced.

### Optional operational keys

- `# slack: #<channel>`
- `# alerting: <url>` — vendor-neutral (PagerDuty / Opsgenie / etc.)
- `# monitoring: <url>` — dashboard or metrics view
- `# status: deprecated | experimental` — omit when `production`

### Example

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

Service with nothing notable gets just the rule line.

### Deliberately excluded

- `name` (path is the identity), `team` (on the rule line below),
  `runbook` (convention `docs/runbooks/<service>.md`), `description`
  (in README / AGENTS.md), `last-updated` (`git log`).

### Staleness

CODEOWNERS is a high-traffic file; PR-review reassignment surfaces
absences naturally. Quiet inactivity isn't caught — git log + human
check on update is the manual fallback; a drift-audit skill could
automate later if needed.

### Agent prompt

A short section added to `AGENTS.md`:

> **CODEOWNERS** — Before big edits or new modules, check
> `.github/CODEOWNERS`. Look at both the team section and the code
> ownership rules — confirm they're aligned. Surface any issues or
> updates to the user before proceeding.

Trigger words ("big edits", "new modules"); incidental edits skip.

## Consequences

### Positive

- **Single file** for review routing + team metadata; no second
  document to drift.
- **GitHub-native**: existing CODEOWNERS parsers ignore comments;
  no new tooling required to consume.
- **Path-scoped**, fits monorepos natively.
- **Dynamic role taxonomy** — new role types need no ADR update.
- **Sparse by default** — services without metadata pay nothing.

### Negative

- **PR pressure doesn't catch quiet inactivity** — optional future
  drift-audit skill could close this gap.
- **No machine-validated schema** — malformed metadata parses as
  commentary and is silently ignored.
- **Role-name casing can drift** across services; linter
  normalises later if it becomes noise.

### Neutral

- Blocks are opt-in; convention applies only where it pays.
- `@org/team` slot is optional on role lines — pizza teams list
  individuals, formal team structures get both.

## Alternatives considered

1. **Separate `TEAM.md` file.** Two files for one ownership story;
   one TEAM.md can't capture per-service detail in a monorepo.
   Rejected.
2. **Closed role taxonomy in this ADR.** Listing every allowed
   role dates the ADR and adds churn for no gain. Rejected.
3. **Backstage `catalog-info.yaml`.** Couples to Backstage before
   it's adopted; same vendor-lock critique that ruled out
   PagerDuty-named keys. Rejected.
4. **Individual `@handles` on rule lines only, no comments.**
   Loses role differentiation entirely. Rejected.
5. **`last-updated:` field + CI freshness warning.** Decorative
   without enforcement; invites "touch the date" edits. Git
   already carries recency. Rejected.

## Relationship to prior ADRs

- **Extends [ADR 0020](0020-github-repo-conventions.md)**: same
  file, additional convention. Not superseding.
- **Complements [ADR 0028](0028-multi-agent-rule-distribution.md)**:
  `AGENTS.md` gains the three-sentence pointer above.
- **Scope-bounded by [ADR 0030](0030-child-apps-and-repos.md)**:
  applies to this repo's CODEOWNERS only. Children under `repos/`
  own their own files; the convention is recommended, not enforced
  for them.

## References

- [CODEOWNERS documentation — GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [ADR 0020](0020-github-repo-conventions.md) — established CODEOWNERS for review routing.
- [ADR 0028](0028-multi-agent-rule-distribution.md) — receives the prompt addition.
