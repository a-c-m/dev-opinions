---
name: Spike
about: Timeboxed research answering one question (per handbook/spikes.md)
title: 'spike: <short title>'
labels: ['spike']
---

<!--
Spike writeup template — mirrors handbook/spikes.md. Fill in as you go;
complete by the end of the timebox. Sections you can't answer yet move
into Open Questions.
-->

## Question

<!-- The one thing this spike must answer. One sentence. If it needs two, it's two spikes. -->

## Timebox

<!-- e.g. 8h cap · start/end. The cap is a limit, not an effort estimate. -->

## Options considered

<!-- Each option needs link/evidence — not just opinion. -->

- Option A —
- Option B —

## Recommendation

<!-- Chosen option + reasoning, tied to the evidence above. -->

## Implementation shape

<!-- Concrete: named libs, named services, agreed thresholds. Not "probably X". -->

- Interfaces / endpoints:
- Libs / services:
- Models / tables / migrations:
- Config / values to agree:

## Around the corner

<!-- Adjacent use cases or near-future needs considered. See handbook/development.md → "Look around the corner". -->

Decision: <!-- keep now / defer — and why -->

## How do we know it works?

<!-- Per handbook/development.md → "You own how we know it works". Pick a signal type from ADR 0024 (logging) or ADR 0025 (observability); don't invent a new pipeline. -->

- Signal:
- Failure we'd want to catch early:
- Tracked where: <!-- server / client / both -->

## Open questions

<!-- Each question gets an owner. -->

-

## Resulting tickets

<!--
List follow-up tickets here as one-line titles first. Pair-plan the
list with a peer before fleshing them out — same underlying principle
as the Output breakdown (docs/handbook/development.md → "Pair-plan the
child Work before creating the tickets"), but lighter weight: spikes
produce smaller lists than Outputs do, so the formal three-stage flow
is overkill here.

Each follow-up ticket must meet the Definition of Ready.
-->

- #
