---
title: Spikes
description: What a spike is for, when to use one, and what "done" looks like
---
# Spikes

> **How to use this:** guidance + checklists, **not a hard gate**. The checklists are a shared default so reviewers and the next person (which might be future-you) can agree on the work. If you skip something, that's fine — say so and why, so it's a *decision*, not an *omission*.

A spike is a **timeboxed research task to answer one specific question and reduce risk** — not to ship the feature. The concept comes from Extreme Programming; the output is *knowledge*, not production code (refs 1–3).

"Answer the question" ≠ "is it technically possible, yes/no". A spike is done when it answers **how** we'd build this *in a way that works for us and doesn't create debt later*, with enough detail and evidence that the resulting implementation ticket is **execution, not re-discovery** (refs 4–5).

The deliverable is a short **decision record on the ticket**: the recommended approach, *why*, with links, and the concrete shape of the build.

## When to spike / when not

- **Spike** when there's a real unknown blocking a confident estimate or approach (new tech, unfamiliar API, "can we even…").
- **Don't spike** routine work you can estimate. Spikes are the exception, not the default (ref 3).

## Rules of thumb

- **One question.** If it needs two sentences to state, it's two spikes (ref 2).
- **Timebox it** (a cap in hours, e.g. 4–16h). The timebox is a *limit*, not an effort estimate — when you hit it, stop and report what you've found, even if that's "I need more time" (refs 1, 3).
- **Define "done" up front** — decide what artefact proves it's finished (decision record + the tickets it produces) before starting (ref 2).
- **Name who's accountable** for the follow-up tickets and decisions (ref 3).
- Spike artefacts are **throwaway/experimental** — the value is the writeup, not the code (ref 2).
- Spikes follow **normal scheduling** — they're not auto-pulled into the current sprint unless they're a [SEV1 or SEV2](incidents.md#severity-levels) or explicitly pulled in.

## Definition of Done (checklist)

- [ ] The single question is stated at the top.
- [ ] Options considered, each with **links/evidence** (docs, lib, prior art) — not just an opinion.
- [ ] A clear **recommendation and the why**.
- [ ] Concrete build shape: **specific libs / models / tables / endpoints** the implementation will use (not "probably X").
- [ ] **Around-the-corner** note — adjacent scope considered and an explicit keep/defer call made. See [development.md](development.md#look-around-the-corner).
- [ ] **"How do we know it works?" note** — the mechanism for telling if it's working or broken in prod (a thrown exception, an error tracker, a metric, a dashboard — whatever fits). See [development.md](development.md#you-own-how-we-know-it-works); pick the signal type from [ADR 0024](../adr/0024-structured-logging-contract.md) / [ADR 0025](../adr/0025-runtime-observability.md).
- [ ] Open questions listed (and who answers them).
- [ ] Follow-up implementation tickets created and linked, each meeting the [Definition of Ready](development.md#definition-of-ready).

## Spike writeup template (copy into the ticket)

```md
## Question
<the one thing this spike must answer>

## Timebox
<e.g. 8h cap · start/end>

## Options considered
- Option A — <summary> — <link/evidence> — pros / cons
- Option B — ...

## Recommendation
<chosen option> because <reasoning, tied to evidence above>

## Implementation shape
- Interfaces / endpoints: <what we'll add or change>
- Libs / services: <named dependencies, not "some library">
- Models / tables / migrations: <...>
- Config / values to agree: <any thresholds or magic numbers — agree them here>

## Around the corner
<adjacent use cases or near-future needs considered>
Decision: <keep now / defer> because <...>

## How do we know it works?
- Signal: <how we tell it's working or broken — exception, error tracker, metric, dashboard>
- The failure we'd want to catch early: <the bad outcome we'd want to see before users report it>
- Tracked where: <server / client / both>

## Open questions
- <q> — owner: <who>

## Resulting tickets
- <TICKET-ID> <title> (DoR met: y/n)
```

## References

1. Mountain Goat Software — *What Are Agile Spikes?* (timeboxed research; XP origin) — https://www.mountaingoatsoftware.com/blog/spikes
2. aqua cloud — *Agile Testing Spikes* (one-sentence question; timebox; success criteria up front; decision-record artefact) — https://aqua-cloud.io/agile-testing-spike/
3. Gareth Saunders — *Spikes: supporting agile practice* (timebox not story-point; SMART objective; name who's accountable; spikes are the exception) — https://www.garethjmsaunders.co.uk/2019/05/24/spikes-supporting-agile-practice/
4. Agilemania — *Agile Spike Story* (learn just enough to progress, not build the whole solution) — https://agilemania.com/agile-spike-story-what-is-a-spike-in-agile
5. talent500 — *What Is a Spike in Agile?* (spikes deliver knowledge/clarity that feeds defined stories) — https://talent500.com/blog/spike-in-agile-purpose-process-best-practices/
