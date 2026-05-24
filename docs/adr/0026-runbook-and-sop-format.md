---
date: 2026-05-22
tags: [ai-agents, runbooks, sops, operations]
---

# ADR 0026: Runbook and SOP format

## Context and Problem Statement

Operational procedures (runbooks) and process procedures (SOPs)
today live in wikis, heads, or nowhere — invisible to agents,
unreachable during incidents, lost on turnover. They're
structurally identical (title, context, steps, sometimes rollback)
and differ only in audience: on-call under pressure vs developer
doing normal work. One ADR, one template, two folder conventions.

## Decision Outcome

Procedure docs live in version control as structured markdown,
co-located with the code they describe, written to a shared
template.

### Folders

| Type | Service-specific | Cross-cutting |
|---|---|---|
| **Runbook** (operational) | `apps/<product>/<service>/runbooks/` | `docs/runbooks/` |
| **SOP** (process) | `apps/<product>/<service>/sops/` *(rare)* | `docs/sops/` |

Filenames: **kebab-case**, descriptive, no `RUN-NNN` prefix. The
path is the identity.

A `runbooks/` or `sops/` folder may carry an `AGENTS.md` once it
holds enough procedures to warrant a brief — per [ADR 0028](0028-multi-agent-rule-distribution.md)'s
per-folder pattern, with `README.md` symlinked to it for human
browsing.

### Frontmatter (both optional)

```yaml
---
triggers:                  # alert names; omit for SOPs/non-alert runbooks
  - PaymentsDatabaseDown
status: deprecated         # omit when active
---
```

`triggers:` earns its place — the alert→runbook mapping isn't
derivable from path or prose. Excluded: `service` (path),
`id`/`RUN-NNN` (path), `severity` (alert property, not runbook
property), `type` (folder + content carry it), `last-reviewed` /
`reviewed-by` (`git log` covers both).

### Body template

````markdown
# <Title>

## Overview
What this is for and what success looks like.

## Prerequisites
Access, tools, permissions. Write "None" rather than omit.

## Symptoms                    <!-- OPTIONAL — alert-bound runbooks -->
Signals beyond the `triggers:` list (dashboards, error shapes).

## Steps
1. ...

```bash
# exact commands in fenced blocks
```

## Rollback                    <!-- OPTIONAL — state-changing -->
How to undo.

## Escalation                  <!-- OPTIONAL — on-call relevance -->
See `.github/CODEOWNERS` for current TechLead / Slack / alerting.

## Related
ADRs, dashboards, post-mortems, sibling procedures.
````

**Required**: Overview, Prerequisites, Steps, Related.
**Optional**: Symptoms, Rollback, Escalation — runbooks typically
use all three; SOPs rarely do.

### Staleness

Procedure files aren't high-traffic, so PR-pressure doesn't
naturally refresh them. Two mechanisms, both rooted in `git log`
(no decorative date field):

- **Agent point-of-use check**: before relying on a procedure, the
  agent runs `git log -1 --follow --format=%cI <file>` and surfaces
  to the user if > 90 days.
- **Advisory script**: `scripts/check-stale-procedures.sh` lists
  procedures past threshold; CI warning, not blocking (forcing
  touches recreates the no-op problem).

### Agent prompt in AGENTS.md

> **Runbooks & SOPs** — When relevant to the task, consult the
> matching file under `runbooks/` or `sops/`. Before relying on
> it, check its `git log` — if > 90 days old, surface to the user
> that it may be stale and confirm before acting.

## Consequences

### Positive

- **Source of truth in repo** — survives outages, access loss,
  and team turnover.
- **AI-readable and offline-accessible**.
- **One shape covers both** runbook and SOP — same template,
  staleness mechanism, agent prompt.

### Negative

- **Stale procedures are still better than none** but trust
  calibration matters; the agent check surfaces, the human decides.
- **Semantic blur risk** between runbook and SOP — mitigated by
  separate folder names; reviewable at PR time.

### Neutral

- `docs/runbooks/` and `docs/sops/` ship empty (`.gitkeep`);
  per-service folders appear when the first procedure is added.

## Alternatives considered

1. **Separate ADRs for runbooks vs SOPs.** Structurally redundant. Rejected.
2. **Notion / Confluence.** Unavailable during outages; invisible to agents. Rejected.
3. **Executable runbooks (`khalidx/runbook`, `braintree/runbook`).** Tooling dependency at incident time is the wrong bet. Rejected.
4. **Central `/docs/runbooks/` only.** Flat dir doesn't scale; orphans on service deletion. Cross-cutting at root retained as carve-out.
## Related

- **[ADR 0027](0027-codeowners-team-metadata.md)** — Escalation points at CODEOWNERS metadata rather than duplicating contacts.
- **[ADR 0028](0028-multi-agent-rule-distribution.md)** — AGENTS.md gains the prompt above.
- **[ADR 0030](0030-child-apps-and-repos.md)** — scope-bounded: applies to this repo's layout. Children under `repos/` own their own; convention recommended, not enforced.
- [AWS Well-Architected — runbooks](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_use_runbooks.html)
- [SkeltonThatcher/run-book-template](https://github.com/SkeltonThatcher/run-book-template) — acknowledged shape, not adopted as standard.
