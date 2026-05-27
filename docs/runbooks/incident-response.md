# Incident response

## Overview

The under-pressure procedure for SEV1 and SEV2 incidents — declare, assess, communicate, resolve, hand off to the RCA. Norms behind this (when to declare, severity definitions, blameless culture) live in [handbook/incidents.md](../handbook/incidents.md); the ratifying decision is [ADR 0040](../adr/0040-incident-management.md); the RCA template is at [../incidents/TEMPLATE.md](../incidents/TEMPLATE.md).

SEV3 and SEV4 do not trigger this runbook — they're normal tickets. SEV3 auto-escalates to SEV2 after 2h of active investigation with no viable workaround.

## Prerequisites

- Slack workspace access; the incident channel for your fork (default: `#incidents`).
- `gh` CLI authenticated; permission to create issues with the `incident` label.
- The affected service's [CODEOWNERS team-metadata block](../adr/0031-github-repo-conventions.md#codeowners-githubcodeowners) (`# TechLead:`, `# slack:`, `# alerting:`, `# monitoring:`) — this is the lookup for who owns it.

## Roles

| Role | Who | Responsibility |
|---|---|---|
| **Incident lead** | Whoever declared. Owns *coordination*, not the fix — hands off the lead role if they're the one fixing. | Pulls in the right people. Posts timestamped notes in the incident channel as a running log. Updates the status channel on cadence. Calls the incident closed. |
| **On-call** | First responder for SEV1/SEV2. May hand the lead role to the feature owner once they're in the channel. | Initial triage; pages the feature owner. |
| **Feature owner** | TechLead per CODEOWNERS for the affected service. | Drives the fix. May be the same person as the lead on small incidents. |

The lead is whoever sees it first — promotion to lead is by declaration, not by seniority. Senior people in the channel default to advisors unless they explicitly take the lead.

## Steps

1. **Declare.** Post in the incident channel — severity, one-sentence symptom, impact, your handle as lead. The channel thread is the running log; the RCA timeline will be reconstructed from it. Set yourself as lead unless you're already fixing. Declaration is channel-first — no GitHub Issue required, no vendor tool required.

   _Initial message (SEV1/SEV2):_
   > 🚨 **[SEV1] API returning 500s for all users**
   > **Impact:** all users; payments blocked.
   > **Detected by:** @handle (Sentry alert `api-5xx-spike` 14:08 UTC).
   > **Lead:** @handle. Next update in 15 min.

2. **Assess.** Pull the affected service's dashboards (see CODEOWNERS `# monitoring:`). Check logs in `.ai-wip/logs/` locally or the routed backend per [ADR 0024](../adr/0024-structured-logging-contract.md) / [ADR 0025](../adr/0025-runtime-observability.md). If in doubt about severity, escalate — you can always downgrade. Security events are SEV1 regardless of nominal user impact.

3. **Assign.** Page the feature owner via the CODEOWNERS `# alerting:` URL (or the OOH path your fork has configured). If no response in 10 min, page secondary.

4. **Communicate.** Post timestamped updates in the incident channel — what we tried, what we ruled out, what's next. The channel is the running log; the RCA timeline will be reconstructed from it.

   _Cadence:_
   - **SEV1:** every 15–30 min until resolved.
   - **SEV2:** at declaration, when materially new information appears, and at resolution.

   _Update example:_
   > 🔴 **[SEV1 update – 14:32]** Root cause narrowed to bad deploy at 14:10. Rolling back now. ETA ~10 min.

5. **Resolve.** Confirm service is restored — dashboards green, error rate at baseline, sample requests succeed. Monitor for 15 min before closing.

   _Resolution message:_
   > ✅ **[SEV1 resolved – 14:44]** Rolled back to v1.4.2. Service restored. Post-mortem to follow.

6. **Hand off to RCA.** Post a closing message in the incident channel with a one-line summary and the post-mortem owner's handle. Open the RCA file under `docs/incidents/YYYY-MM-DD-<slug>.md` from [TEMPLATE.md](../incidents/TEMPLATE.md).

   - **SEV1:** team call within 24h of resolution.
   - **SEV2:** async write-up within 5 business days.
   - **SEV3:** only if recurrence (2nd within 30 days).

   The RCA is blameless — [handbook/incidents.md → Blameless culture](../handbook/incidents.md#blameless-culture) is not optional, and reviewers bounce blame-shaped sections.

## Escalation

| Condition | Action |
|---|---|
| SEV3 with no viable workaround after 2h active investigation | Escalate to SEV2. |
| SEV2 unresolved after 4h | Escalate to SEV1; page the TechLead. |
| On-call unresponsive within 10 min | Page secondary per CODEOWNERS. |
| Security event at any nominal severity | Treat as SEV1 regardless of user impact. |

Out-of-hours response is defined per fork — see [handbook/incidents.md → Out-of-hours](../handbook/incidents.md#out-of-hours).

## Related

- [ADR 0040](../adr/0040-incident-management.md) — the ratifying decision.
- [handbook/incidents.md](../handbook/incidents.md) — when to declare, severity definitions, blameless culture.
- [../incidents/TEMPLATE.md](../incidents/TEMPLATE.md) — RCA template the hand-off step opens.
- [../incidents/](../incidents/) — past RCAs to skim for prior art on a recurring symptom.
- [ADR 0031](../adr/0031-github-repo-conventions.md) — CODEOWNERS team-metadata = ownership lookup; issue templates.
- [ADR 0024](../adr/0024-structured-logging-contract.md) / [ADR 0025](../adr/0025-runtime-observability.md) — detection signals; the runbook for the affected service should point at specific dashboards.
- [supervised-db-migrations.md](supervised-db-migrations.md) — db-migration incidents enter this runbook from its Rollback step.
