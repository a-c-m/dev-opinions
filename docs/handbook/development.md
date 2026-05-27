---
title: Development
description: How we get engineering work done — structure, tickets, flow, and what good looks like
---
# Development

How we think about doing good engineering work.

> This is a living document — a set of things we've seen work. Comment on it, evolve it, push back. If you think there's a better way, try it, measure the results, and tell us what happened.

> Statements like "always", "never", "must" are deliberate, not absolute. You're smart — use your judgement. When a rule doesn't fit, flag it so we can improve the rule.

This doc covers operational flow. The principles behind *why* live in [ideas.md](ideas.md). Meeting cadence and team-update rhythm live in [meetings.md](meetings.md).

## The work structure

I think about engineering work in five levels. The terms vary by team — pick whatever your ticketing tool and product docs already use — but the levels are:

1. **Work** — a ticket, a unit of "in progress / done". E.g. tasks, bugs, releases.
2. **Output** — a handful of **Work** items that ship together to deliver one coherent thing. AKA stories, epics, bets.
3. **Outcome** — a handful of **Outputs** driving towards the same change / metric / capability. AKA outcomes, opportunities.
4. **Objective** — a handful of **Outcomes** driving multi-quarter directions. AKA objectives, strategies.
5. **Vision** — the *why* behind what we do, and where we are going with it.

Levels 1 and 2 live in the ticketing tool.
Levels 3 and 4 live in product documentation (and / or the ticketing tool).
Level 5 lives everywhere — it's company-wide, the mission statement, the framing every other level flows from.

There is also level 0: a developer's personal notes (or todos with their AI). This is kept local to the developer — see [CLAUDE.md](../../CLAUDE.md) for the local-vs-team tier.

### 1. Work

A day or less each.

Mostly one-directional flow:

- **Triage** — has the details, but not yet a plan for how to do it.
- **Open** — reviewed and estimated, ready to be picked up.
- **In progress** — being "done".
- **In review** — checking it works / does what's expected.
- **Done** — merged to its parent branch / complete.

Types:

- **Task** — things you need to do: features, designs, automations, manual QA, documentation. If it needs doing, it's probably a task.
- **Bug** — if it's not working, it's a bug.
- **Release** — technically a task, but a special one that deserves its own type.

You can have more, but in practice this is what you need.

### 2. Output (AKA stories, epics)

A few days, perhaps even a few weeks.

- An **Output** describes the **thing you want to make / do**.
- Most **Work** that moves into "in progress" belongs to one.
- It's "done" when all the **Work** inside the **Output** is done.
- An **Output** should be linked to an **Outcome**. If it isn't, ask why we're working on it right now.
- Some work won't map cleanly: maintenance, paying down debt, support tickets. But if it's new feature work, it probably needs to be linked to an **Output**, and the **Output** links to the **Outcome**.

### 3. Outcome (AKA opportunities)

Multi-week, metric-focused. The plan and the *why* behind the *whats*.

- Several **Outputs** together, trying to do the same thing.
- Each **Output** might support the next, or be a competing angle on the same **Outcome**.

### 4. Objective

Multi-month, perhaps multi-quarter. The big shots you are taking. The **O** in **OKR**.

- Likely multi-team efforts across several **Outcomes**.
- Depending on team / org / company size you might only have capacity to take on one of these.

### 5. Vision

Multi-year. The direction and destination — what success looks like if everything else lines up.

- Lives in your head, in the README, in PR descriptions, in standups, on the wall — wherever decisions get made.
- Doesn't have a board column or a deadline. Its job is to make every other level legible.
- If you can't explain how your current **Work** ladders up to the **Vision** (via **Output**, **Outcome**, **Objective**), something's off.

## Preparing the work

- Before you pick up or estimate a ticket, ask: **do I understand how this work drives our Outcome / Objective?** If not, find out — before you start working on it.

### Definition of Ready

A ticket should be **execution, not discovery** by the time someone picks it up. Use INVEST as the spine (Independent, Negotiable, Valuable, Estimable, Small, Testable — ref: [Agile Alliance — Definition of Ready](https://agilealliance.org/glossary/definition-of-ready/)) and add evidence:

- [ ] **Why + links/context** so a second person can read, check, and *agree* — not just your opinion.
- [ ] Implementation detail carried over from any prior [spike](spikes.md) (libs/models/tables) — the picker shouldn't have to go searching.
- [ ] Clear **acceptance criteria** (≈3–5, testable).
- [ ] **Independent, small** enough to finish in a sprint; **estimable in hours** (see below).
- [ ] **How we'll know it works** is noted — the prod signal for this change (see [You own how we know it works](#you-own-how-we-know-it-works)).

### Work estimates

- We estimate work before starting it. We are not [#noestimates](https://www.acmconsulting.eu/post/no-estimates/). Estimation forces the conversations that surface unclear requirements early — that's the value, not the number.
- We use hours (not story points).
- We use Fibonacci (1, 2, 3, 5, 8, 13, 21, 34) to show uncertainty as estimates get bigger.
- If it's over an 8, it probably needs to be split into smaller bits.
- Estimation usually happens during [Sprint](#sprints) planning, but never after **Work** has started.

### Sprints

We run **Scrumban** — Kanban-style ticket flow (one-directional, WIP-limited), but with a sprint cadence for planning. The sprint is a *planning unit, not a delivery unit*: **Work** flows through the board as it's ready, but we sit down on a regular cadence to plan what's next.

- The sprint is planned and agreed the week before with relevant stakeholders (Dev, Product, etc.) — including the resources and constraints we have to work with.
- The plan is for **Work** and **Output** we can complete *without* heroics. Heroic effort is evidence of a broken process.
- Work that is discovered/reported/requested mid-sprint is triaged. Unless it's [SEV3 or higher](incidents.md#severity-levels), it's pushed to the next sprint or the backlog.
- Ceremonies (planning, kick-offs, retros, etc.) are up to the team. We care that you're delivering — not which rituals get you there.

## Doing the work

### You own the outcome, not just the code

With AI handling more of the *how*, the leverage is in owning the **what, why, and "does it actually work in production"** — full-team, not just full-stack. This doesn't mean joining the product org; it means being the **product owner of the problem you're solving** — especially in a [spike](spikes.md), where you have more depth on what's possible than anyone else. Handing that thinking off to someone with less context wastes the most valuable part of the work.

This is the long-standing **"you build it, you run it"** principle (Werner Vogels, 2006): the team that builds a service operates it, which is exactly why they invest in knowing when it breaks.

#### You own how we know it works

When you build or change something, **you own answering "how do we know if it's working or broken in production?"** — and that decision is *yours to make and document*, then we review and agree. This isn't about adding logging for its own sake. A thrown exception is a signal; an error tracker is a signal; a metric is a signal. The question isn't "did you add logs" — it's *"can we tell something's wrong before a user reports it?"* Often the right answer is "the existing error path is enough" — and that's a perfectly good answer, as long as it's written down so we can agree on it. Without a way to see if it's working, a fix is a hope, not a fix.

The mechanics — what we log, how, and where it goes — are defined in [ADR 0024 (structured logging)](../adr/0024-structured-logging-contract.md) and [ADR 0025 (runtime observability)](../adr/0025-runtime-observability.md). Pick a signal from there; don't invent a new pipeline. The [RCA template's Detection section](../incidents/TEMPLATE.md) is a feedback loop on this — if a signal wasn't good enough in retrospect, that's the place to flag it and graduate the detection.

You don't have to predict everything up front. Code review is still where most implementation-level failure handling gets surfaced and decided. What a spike or ticket front-loads is only the stuff that's **expensive to discover late**: the chosen approach, the concrete build shape, and how we'll know it works. Finer-grained detail stays where it already works well — in the code and the review.

### Look around the corner

Before building, spend a few minutes on the *next* corner — the adjacent use case or near-future need (e.g. "is this specific to this one case, or will we want it more broadly?"). You don't have to build for it — but **consider it and make an explicit keep/defer decision**, recorded on the ticket. That lets us choose deliberately instead of assuming it's a non-issue and refactoring next sprint.

### Decisions live in the repo, not in DMs

If a decision matters, write it down where it won't get lost — **not** in a DM or buried Slack thread. Markdown means humans *and* AI/MCP tooling can consume it in seconds, and new joiners can find "how we work" without asking.

Four sinks, each for a different shape of decision. Pick the lightest one that fits:

- **On the ticket** — implementation-level calls made while doing the work (chosen approach, trade-off taken, scope deferred, "around the corner" call). A few lines. This is the default — most decisions live here.
- **Spike writeup** (on the spike ticket) — answers to a single research question, with options compared and a recommendation. Format in [spikes.md](spikes.md). Spawns implementation tickets.
- **ADR** under [docs/adr/](../adr/) — load-bearing technical decisions that will constrain future work (stack choice, cross-cutting pattern, anything that supersedes a prior ADR). MADR-lite shape (Context → Decision → Consequences → Alternatives → Related), soft ~150-line cap. See [docs/adr/AGENTS.md](../adr/AGENTS.md) for the format and the existing index.
- **`AGENTS.md`** (root or per-folder) — durable rule or convention every contributor and agent needs to follow when working in this repo. Short bullet with inline rationale.

If you're unsure: write it on the ticket first. Promote upward (spike → ADR → `AGENTS.md`) only when reuse or constraint reach demands it.

### Write the *why*, especially when we deviate

Every AI session starts cold — see [Every AI call is an onboarding](ideas.md#every-ai-call-is-an-onboarding). The docs you write are no longer just for the next human; they're the context every agent reads on every task. What multiplies most across those sessions is **the *why*** behind non-obvious choices:

- **House rules and constraints** — performance budgets, security posture, the threshold below which a check fails. Things that aren't in the code but constrain every change.
- **Deliberate deviations from defaults** — we use X *instead of* the obvious Y because `<reason>`. Without this written down, AI cheerfully suggests Y every session and you burn tokens (and review time) reverting.
- **Decisions and their alternatives** — captured in the right sink per [Decisions live in the repo](#decisions-live-in-the-repo-not-in-dms). An ADR's *Alternatives considered* section stops a future agent re-litigating a settled call.

When AI gets the same thing wrong twice, the doc is the bug — not the model. Update the rule, the ADR, or the `AGENTS.md` bullet so the next session starts further forward. (Same instinct as ["fail, don't skip"](../../CLAUDE.md#fail-dont-skip) — fix the cause, don't paper over the symptom.)

### Review before code

- Clear the review queue before picking up a new ticket.
- Saying it again. **Clear the review queue before picking up a new ticket.**
- Reviewing other people's work *is* work, not a distraction from it.
- **Work** "in review" is the worst kind of **Work**: already paid for, but going stale. We've done the hard part but can't get the benefit until it's done. Help it get done.

### Small work

A piece of **Work** shouldn't need more than **one working day (8 hours)** to complete. Past that, stop.

- Slice it down. Talk to your team / leads. Break future **Work** into one or more new 1-day units if needed.
- If slicing reveals the scope is genuinely larger, consider spinning it out as its own **Output**.

**Why?**

- Completing at least one thing a day, feels good.
- It gives you a chance to "come up for air" every day — to clear issues, take meetings, do PR reviews etc.
- It gives your team a chance to check in, if you've been bashing your head against the same problem for a day (instead of that check-in happening after a week).

Three properties to aim for in every ticket:

- **Small** — fits in one working day. This is the most important property; it forces the other two.
- **Clear** — any engineer can pick it up and know what "done" looks like. Both PM and engineering should shape the ticket before it's ready.
- **Independent** — deployable on its own. If it's part of a larger release, put it behind a feature flag. At worst, integrate on an **Output**-scoped branch and merge it once the whole **Output** is ready.

Small **Work** makes missing requirements visible. Small **Work** is more likely to be independent. Optimise for small; the rest follows.

### Pair planning (and pair review)

AI can help you build things fast, but your co-workers and subject matter experts are ideal partners for decide WHAT to build and if it was built right.

https://www.acmconsulting.eu/post/pair-planning-the-missing-step-for-enthusiastic-ai-development-and-team-happiness-2/

> Pair Planning: Check and commit with a human
>
> Dead simple. Two checkpoints (pair points) system for implementation. Zero ceremony. 100% more accountability.
>
> Pair Point 1: The review of the plan
> Pair Point 2: The Informed Code Review

See the blog for the details, but TL:DR; Having a human review the plan improves it and gives you an invested reviewer to insure the plan was followed. 

> Reality check: This only works if your pair planners actually engage. Rubber-stamp reviews are worse than no reviews. Fix your culture first.

#### Pair-plan the child Work *before* creating the tickets

The cheapest place to pair-plan an **[Output](#2-output-aka-stories-epics)** is at the **breakdown** — before any of its child Work becomes a real ticket. This is an **Output-scoped practice** because Outputs are big enough to earn it; single Tasks and spike follow-ups don't need the full three-stage ceremony (though the underlying idea — sketch the list before fleshing out tickets — still applies in lighter form).

Three stages, kept deliberately separate:

1. **Open the Output** with its parent context — goal, parent Outcome, success metric, impact, acceptance criteria. Most of the child Work is deliberately *not* there yet. Exceptions could be if we know its going to need a UAT pass or its own release, then they would be pre sketched (not ticket created).

2. When estimating, we **sketch the breakdown** inside the Output ticket's *Child Work* section. One bullet per item: **title + estimate + short description** — not fully-detailed tickets. Then sit with a peer and pair-plan *that list*: are the edges covered, is anything missing, are you solving the problem the right way? Make sure QA, UAT, and release tickets are considered if they apply. The **sum of the estimates is your sizing signal** — if it's bigger than this Output should be, slice the Output here, before any tickets exist. The [`output.md`](../../.github/ISSUE_TEMPLATE/output.md) issue template's *Child Work* section is shaped for exactly this list.

3. **Create the real tickets** only when the Output (or a slice of it) moves into *in progress*. Expect to **replan** at this point — the act of starting work surfaces detail the breakdown didn't. Each ticket then meets the [Definition of Ready](#definition-of-ready) on its own terms.

Writing a detailed ticket is slow; *deleting* ten half-written tickets when the breakdown turns out wrong is worse — and there's a temptation to keep tickets that no longer fit just because they exist. A list inside the Output is cheap to revise; a dozen written-but-wrong child tickets aren't.

This is Pair Point 1 (review of the plan) applied at the breakdown level — same loop, earlier in the process, where the unit of work is still a sentence.

### Small code

Small tickets lead to small code:

- **PRs** — length matters less than reviewability. The target: a competent reviewer can fully understand and review the diff in **under 10 minutes**. If they can't, the PR is too big.
- **Functions** — easy to read, easy to test. If a function isn't, either refactor or add a comment explaining why it has to be that way.
- **Files** — aim for files that "fit in your head". A file growing past a few hundred lines is a code smell — usually it's doing too much or getting too complex.

## Finishing the work

### Definition of Done

Before a ticket ships:

- [ ] Acceptance criteria met; tested.
- [ ] Peer reviewed (see [Pair planning (and pair review)](#pair-planning-and-pair-review)).
- [ ] **You can answer "is this working in prod?"** — the agreed signal (exception / error tracker / metric / dashboard) is in place. See [You own how we know it works](#you-own-how-we-know-it-works).
- [ ] Docs / decision record updated where it matters (see [Decisions live in the repo, not in DMs](#decisions-live-in-the-repo-not-in-dms)).

(Definition of Ready = the work *coming in*; Definition of Done = the product *going out*.)

### Other notes

- When an **Output** completes, consider what you learned. The learnings are the deliverable as much as the code.
- Track [engineering metrics](#metrics-and-kpis), but treat them as a process signal, not a success measure. **Outcomes** and their metrics are the success measure.
- Once a ticket is closed, it stays closed. If more work is needed — even rework — open a new ticket. Reopening hides scope / change / issue.

## Metrics and KPIs

Three layers, each for a different audience:

- **Engineering metrics** — help us improve our process. (Cycle time, PR review latency, deploy frequency, MTTR, etc.)
- **User metrics** — help us improve the product.
- **Business metrics** — help us improve the bottom line.

KPIs let you focus on the outcome, not the output. The output (code, tickets, PRs) is the cost; the outcome (the number that moved) is the value.

## Leadership and priority

Most teams are **cross-functional** by nature — even when it's one person wearing several hats: product, engineering, support, design. Borrowed from Holacracy: think in terms of *roles* (the work you're doing right now) rather than fixed *jobs*.

- Your **cross-functional team** is your focus. You prioritise work with them.
- Your **organisational team** (other engineers, if applicable) is your support — they help you improve, you help them.
- You're accountable to your cross-functional team for **results**, and to your organisational team for **quality** and **practice**.
- Leadership is not a title. It's an action. Lead in the areas where you excel.

## Expectations

- **A ticket** (or more) **a day keeps the micromanager away.** A closed ticket every working day is the rhythm. (See: small **Work**.)
- **Learn the context.** Ask questions until you understand the *why*. The *why* determines what "done" looks like.
- **Quality is yours to ensure.** Don't assume someone else will catch it.
- **Always improve** — your skills, the codebase, the process, your work-life balance. Getting better at your job is part of your job.
- **Have fun.** If you're not enjoying the work, say so, so we can fix it.

---

For meeting cadence and how often to update which team, see [meetings.md](meetings.md). For the principles behind these practices, see [ideas.md](ideas.md).
