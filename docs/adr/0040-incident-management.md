---
date: 2026-05-27
tags: [incidents, operations, on-call, post-mortem]
---

# ADR 0040: Incident management

## Context and Problem Statement

We need to know what to do when things go wrong. 

- [career.md Operations facet](../handbook/career.md#operations) defines progression at every level in RCA terms (L1 contributes, L2 owns, L3 audits cross-team, L5/L6 lead incident calls).
- [supervised-db-migrations.md → Rollback](../runbooks/supervised-db-migrations.md#rollback) instructs "document as an incident" with no destination.
- [spikes.md → Sprints](../handbook/spikes.md) gates urgent intake on "SEV3 or higher" with no severity definition.

Without a shared severity vocabulary, a declaration protocol, and a post-mortem template, every incident is handled ad-hoc — different responders handle similar failures differently, the timeline isn't captured, and learning doesn't compound.

## Decision Outcome

Four artifacts, four homes — split along the doc-tree the repo already uses (decisions / norms / procedures / artifacts).

| Artifact | Home | Carries |
|---|---|---|
| Decision | this ADR | Severity vocabulary, when RCAs are mandatory, where artifacts live |
| Norms | [handbook/incidents.md](../handbook/incidents.md) | When to declare, blameless culture, severity ≠ priority, examples |
| Playbook | [runbooks/incident-response.md](../runbooks/incident-response.md) | The under-pressure procedure (declare → assess → comms → resolve → hand-off) |
| Post-mortems | [docs/incidents/](../incidents/) | RCA template + filed RCAs as `YYYY-MM-DD-<slug>.md` |

### Severity vocabulary — SEV1 to SEV4

Caps to match the repo's acronym convention (`ADR`, `SOP`, `RCA`).

| Severity | Trigger | Sprint impact | RCA required |
|---|---|---|---|
| **SEV1** | Service down, data loss, or security breach. No workaround. Revenue or all users impacted. | Stop sprint; all hands. | Yes — within 24h of resolution. |
| **SEV2** | Core flow degraded. Workaround exists. Subset of users affected. | Interrupt the responsible owner; rest of team continues. | Yes — async write-up within 5 business days. |
| **SEV3** | Non-critical bug or degradation. Users can work around it. No one blocked. | Triage at next standup; current sprint. | Conditional — required on 2nd occurrence within 30 days. |
| **SEV4** | Nothing broken yet. Near-miss, approaching limits, cosmetic, tech-debt risk. | Backlog; weekly triage. | No. |

Full definitions, examples, and severity ≠ priority guidance live in [handbook/incidents.md](../handbook/incidents.md).

### Escalation thresholds (mechanism, not policy)

- **SEV3 → SEV2** after 2h of active investigation with no viable workaround.
- **SEV2 → SEV1** after 4h unresolved.
- **Security event** at any nominal severity → treat as SEV1.

### Blameless RCAs — non-negotiable

Post-mortems exist to improve systems, not to assign blame. The [template](../incidents/TEMPLATE.md) names this in the opening block; the runbook reinforces it during hand-off; reviewers reject blame-shaped RCAs. A post-mortem that names an individual as the root cause has been written wrong — the cause is the system that let one person's mistake reach production.

### Service ownership — CODEOWNERS, not a new file

"Who owns this service" is answered by the [CODEOWNERS team-metadata blocks](0031-github-repo-conventions.md#codeowners-githubcodeowners) — `# TechLead:`, `# slack:`, `# alerting:`, `# monitoring:`. The runbook reads from there; no separate `EMERGENCY.md`. One source, updated in the same PR as the code.

### Out-of-hours coverage — defined per fork

The template makes no claim about 24/7 reachability. Forks adopting paid on-call (incident.io, PagerDuty, Opsgenie) wire it into the runbook's escalation step and update affected services' CODEOWNERS `# alerting:` field at adoption.

### Detection — reuse existing signals

The runbook references existing logging ([ADR 0024](0024-structured-logging-contract.md)) and observability ([ADR 0025](0025-runtime-observability.md)) — no new alerting pipeline introduced by this ADR.

### Declaration — channel-first, tool-agnostic

Declaration is a post in the incident channel per the runbook's message template — not a GitHub Issue template, not coupled to any vendor. The channel thread is the running log from which the RCA timeline is reconstructed. Forks adopting incident.io / Linear / Jira / PagerDuty wire their own intake on top without the template prescribing it. Keeping declaration out of `.github/ISSUE_TEMPLATE/` also preserves the deliberate scope of the five templates in [ADR 0031](0031-github-repo-conventions.md) (backlog-shaped intake) — an incident's live-coordination lifecycle doesn't fit alongside them.

## Consequences

### Positive

- **Shared vocabulary** — `SEV1`/`SEV2`/`SEV3`/`SEV4` mean the same thing across PRs, ADRs, sprint planning, and incident channels.
- **Blameless culture from day one** — the template and review pattern make blame-shaped RCAs structurally hard.
- **No new tooling required** — incident channel + on-disk RCA suffices. incident.io / PagerDuty are graduation levers, not day-one deps.
- **CODEOWNERS stays the single source of truth** for service ownership — no drift between two ownership files.
- **career.md Operations facet stops promising practice the repo doesn't ship.**

### Negative

- **RCA template is a maintenance surface** — drifts from reality if not exercised. Mitigation: the runbook's hand-off step requires picking up the template.
- **OOH is unresolved at template level** — every fork must answer it.
- **SEV3 recurrence tracking is manual** — no tool reminds you "this is the 2nd within 30 days." Mitigation: incident-channel search + `rg` over `docs/incidents/` filenames + the agent prompt in [incidents/AGENTS.md](../incidents/AGENTS.md) that surfaces prior RCAs on related symptoms.

### Neutral

- **incident.io / PagerDuty** named as graduation, not foreclosed.
- **Frontend-originated incidents** (PostHog session-replay-triggered, etc.) follow the same protocol — no separate frontend shape.

## Alternatives considered

1. **One ADR carrying severity + declaration + comms + roles + RCA.** Violates the [~150-line MADR-lite cap](0037-multi-agent-rule-distribution.md) and conflates norms (handbook-shaped) with procedure (runbook-shaped). Rejected — split per artifact type.
2. **Mandate incident.io / PagerDuty as the day-one declaration mechanism.** Couples the template to a vendor; defaults a paid product on small forks. Rejected — Slack + GitHub Issue is enough; vendor named as graduation.
3. **`EMERGENCY.md` at repo root for service ownership.** Duplicates CODEOWNERS team-metadata; second sync surface. Rejected.
4. **No formal protocol — Slack improvisation.** Already implicitly promised by career.md; not delivering is the failure mode this ADR fixes. Rejected.
5. **`docs/post-mortems/` as the artifact directory.** Reads less naturally than `incidents/` (the post-mortem is *of an incident*); "postmortem" is the report not the dir. Rejected.
6. **`.github/ISSUE_TEMPLATE/incident.md` as the declaration mechanism.** Couples declaration to GitHub Issues; the five existing templates in [ADR 0031](0031-github-repo-conventions.md) are backlog-shaped (output / task / bug / spike / release) and an incident's live-coordination lifecycle doesn't fit alongside them. Rejected — declaration is channel-first per the runbook's message template.

## Related

- [handbook/incidents.md](../handbook/incidents.md) — norms, severity definitions, blameless culture.
- [runbooks/incident-response.md](../runbooks/incident-response.md) — under-pressure playbook.
- [incidents/TEMPLATE.md](../incidents/TEMPLATE.md) — RCA template.
- [ADR 0024](0024-structured-logging-contract.md) / [ADR 0025](0025-runtime-observability.md) — detection signals + log shape for timeline reconstruction.
- [ADR 0031](0031-github-repo-conventions.md) — CODEOWNERS team-metadata = ownership lookup; issue templates.
- [career.md → Operations](../handbook/career.md) — career progression in RCA terms.
- [supervised-db-migrations.md](../runbooks/supervised-db-migrations.md) — references this protocol from its Rollback step.
- [Google SRE — postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [PostHog incident handbook](https://posthog.com/handbook/engineering/incidents)
