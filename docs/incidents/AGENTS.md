# Incidents (post-mortems)

Filed RCAs from SEV1, SEV2, and recurring-SEV3 incidents. Start from [`TEMPLATE.md`](TEMPLATE.md). The protocol is ratified in [ADR 0040](../adr/0040-incident-management.md); norms in [handbook/incidents.md](../handbook/incidents.md); the on-call playbook in [runbooks/incident-response.md](../runbooks/incident-response.md).

## Format

- Filename: `YYYY-MM-DD-<short-slug>.md`. Date is the **incident detection date**, not the write-up date. Slug is kebab-case, ≤ 5 words, describes the user-visible symptom (`api-5xx-spike`, not `bad-deploy`).
- Frontmatter required: `date`, `severity`, `duration`, `services`, `author`, `reviewers`, `issue`.
- Required sections: Summary, Timeline, Detection, Impact, Root cause, Contributing factors, What went well, What went poorly, Action items.
- Optional: Lessons.
- **Blameless.** Sections that read as blame get bounced back at review. See [handbook/incidents.md → Blameless culture](../handbook/incidents.md#blameless-culture).

## Agent prompt

When investigating a class of failure, search this directory for prior RCAs (`rg -l <symptom-keyword> docs/incidents/`). A recurring failure means the prior RCA's action items either didn't ship or didn't cover the actual root cause — flag the gap, link the prior RCA, and surface it to the user before proposing a new fix.

Before relying on a procedure or claim from an RCA, check the file's age (`git log -1 --follow --format=%cI <file>`) and surface to the user if it's **>180 days old** — system shape may have moved on. RCAs accumulate; they don't expire, but their action items might already have shipped.
