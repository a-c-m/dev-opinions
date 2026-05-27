---
# Fill in at file creation. Filename: YYYY-MM-DD-<short-slug>.md
# date: 2026-MM-DD
# severity: SEV1 | SEV2 | SEV3
# duration: HHhMMm           # detection → resolution
# services: [<service1>, <service2>]
# author: <Incident Lead handle>
# reviewers: [<TechLead handles for each affected service>]
# coordination: <link to incident channel thread (or tracking issue if your fork uses one)>
---

# Post-mortem: <title>

> **Blameless.** This document exists to improve the system that allowed this incident, not to attribute fault. If a section reads as blame, rewrite it as a system finding — what was missing, ambiguous, or unguarded. See [handbook/incidents.md → Blameless culture](../handbook/incidents.md#blameless-culture).
>
> Copy this file (don't edit in place) when authoring a new RCA. Filename: `YYYY-MM-DD-<short-slug>.md`. Format per [`AGENTS.md`](AGENTS.md).

## Summary

One paragraph. What happened, who was affected, how long it lasted, how it was resolved. If a reader stops after this paragraph, they should have the gist.

## Timeline

All times in UTC. Reconstructed from the incident channel + dashboards. Include both action and signal events.

| Time (UTC) | Event |
|---|---|
| HH:MM | First signal — <what fired, where it surfaced> |
| HH:MM | Incident declared by <handle>; lead assigned |
| HH:MM | <hypothesis tried; result> |
| HH:MM | Root cause identified |
| HH:MM | Mitigation deployed |
| HH:MM | Service restored |
| HH:MM | Monitoring window complete; incident closed |

## Detection

How we knew. Reference the actual signal — alert, dashboard, log query, user report. Per [development.md → You own how we know it works](../handbook/development.md#you-own-how-we-know-it-works), this section is also a check on whether the detection was good enough or needs to graduate.

- **Signal:** <alert name, dashboard panel, log query, error-tracker event>
- **Time to detection:** <signal time minus actual onset>
- **Gap (if any):** <window between user impact and detection, and why>

## Impact

- **Users affected:** <count or %, segment if relevant>
- **Duration of user impact:** <not always the same as total incident duration>
- **Revenue / SLO impact:** <"none material" is a valid answer>
- **Data impact:** <loss / corruption / inconsistency, or "none">
- **Downstream services:** <which other services felt this>

## Root cause

What actually caused this — the *system finding*, not the person.

If you find yourself naming an individual, rewrite as *"the system permitted X because Y was missing"*:

- ❌ "Alice deployed a bad config."
- ✅ "The config schema didn't validate the field type, so a typo passed CI and reached prod."

## Contributing factors

Conditions that made this possible, or that made recovery slower. Often the more important section — the cheapest wins live here.

-

## What went well

The things we want to do again. Easy to skip, expensive to lose.

- Detection fired before the user-report channel woke up
- The runbook for this exact failure mode existed and was followed
- Rollback completed in under 10 min because we'd practised it

## What went poorly

Decisions and conditions that slowed us down. Phrased as systems, not people.

-

## Action items

Owner is named; due date is realistic; ticket link is mandatory — open tickets in the same session as writing the RCA, not "later." Action items without tickets are theatre.

| Action | Owner | Due | Ticket |
|---|---|---|---|
|  | @handle | YYYY-MM-DD | #NNN |

## Lessons

One or two sentences on what this RCA changes about how we think — the bit that should propagate to other services even if their action items don't. Optional, but cheap and high-value.
