---
title: Chat
description: Async communications structure — channels, threads, DMs, and how to name things
---
# Chat

How we communicate outside of meetings. Usually using a chat system like Slack.
For the meetings, see [meetings.md](meetings.md).

## The two rules that matter most

1. **Channels over DMs.** If it's work-related and two or more people need it, it belongs in a channel, not a DM.
2. **Public by default.** Private channels are the exception, not the norm.

## Channel naming at a glance

| Pattern                                | Lifespan               | Visibility          | Example                      |
| -------------------------------------- | ---------------------- | ------------------- | ---------------------------- |
| `team-<name>`                        | Permanent              | Public              | `team-shop`                |
| `team-<name>-info`                   | Permanent              | Public (read-only)  | `team-shop-info`           |
| `team-<name>-leads`                  | Permanent              | Private             | `team-marketing-leads`     |
| `team-<name>-bots`                   | Permanent              | Public (bot output) | `team-devops-bots`         |
| `proj-<name>`                        | Time-bound             | Public              | `proj-checkout-redesign`   |
| `outcome-<focus>`                    | Permanent              | Public              | `outcome-retention`        |
| `<partner>` or `<partner>-<topic>` | Relationship-dependent | Slack Connect       | `partner-x-billing`        |
| Social / general                       | Permanent              | Public              | `random`, `celebrations` |

## Why this matters

As a workspace grows organically, channel names drift, it stops being obvious where a conversation belongs, and useful decisions end up buried in DMs where only a handful of people can see them.

A shared naming convention makes channels **predictable** — ideally you can guess a channel name before you search for it. It gives every team a clear home, makes onboarding faster, and keeps day-to-day knowledge accessible to everyone who needs it.

## Guiding principles

**Prefer channels over DMs.** If a conversation involves more than one person, or is about work, a channel is almost always the right place. Channels are searchable, inclusive of the right people, and don't disappear when someone leaves. DMs are for quick, personal, or genuinely sensitive exchanges. **If a decision gets made in a DM, there's a good chance someone who needed to know wasn't in the room.**

If someone messages you about a team topic in a DM, it's fine to say *"let's move this to `team-x` so the rest of the team has the context"* — then continue there.

**Public by default.** Public channels are searchable by anyone. When someone joins six months from now and needs to understand why a decision was made, they can find it. Private channels are fine for genuinely sensitive topics (HR, commercial negotiations, leadership-specific discussions), but they should be the exception, not the starting point.

**Use threads.** When you're responding to a message, reply in the thread rather than posting to the channel. The main channel stays easy to skim; related conversation stays together. Think of the channel as a list of topics and threads as where each conversation lives.

**Keep names simple and guessable.** A new joiner should be able to guess a channel name. Use full words rather than abbreviations. `team-shop` is clearer than `team-h` or `team-shop-dev-2`.

**Hyphens, not underscores.** `team-shop`, not `team_shop`.

**Lowercase throughout.** `team-shop`, not `Team-Hub`.

**Archive, don't delete.** When a project wraps up, archive — don't delete. The history stays searchable.

## Channel prefixes

Channels are organised by lifespan — whether they're permanent or created for a specific piece of work.

### Long-lived channels

#### `team-<name>` — team channels

The main home for each team. Anyone who works on or alongside a team is welcome to join. This is where day-to-day conversation happens — prioritisation, requests, planning, quick questions, meeting invites. Holding that discussion in the open keeps everyone affected by it in the loop.

Engineers, designers, QA, product, and support all sit in the same channel — there's no separate `dev-<team>` or `ops-<team>`. Fewer channels means less relaying and fewer things falling through the gaps.

These channels are busy by design. Members can mute and check in when useful. Threading consistently is the best way to keep them manageable: each topic stays contained, and the main feed stays scannable.

Most `team-` channels are public. A small number are private where the subject matter warrants it (e.g. `team-slt`, `team-hr`), but the same naming convention applies.

### Short-lived channels (archive when done)

#### `proj-<project-name>` — project channels

For a defined piece of work that spans multiple teams and has a clear end. When the work ships or is cancelled, the channel is archived — typically 30 days later to capture any retrospective discussion.

Name the channel after the work, not the team. Use enough words to be unambiguous.

Before creating a project channel, consider whether the conversation fits inside the relevant `team-` channel instead. A `proj-` channel makes sense when the work involves three or more teams, runs for more than a few weeks, or has a stakeholder group that doesn't map neatly to an existing team.

## Channel suffixes

Suffixes refine the base channel pattern to indicate a specific mode of communication.

#### `-info` — broadcast / announcement channels

A companion to a `team-` channel for sharing updates with the wider organisation. If you want to follow what a team ships or decides but don't want to be in their busier main channel, `-info` is where to follow along.

- **Posting access:** team leads only. Everyone else reads.
- **Purpose:** releases, roadmap updates, policy changes, product announcements.

Not every team needs one — create it when there's genuine cross-org interest.

#### `-bots` — automation output channels

For when automated tools (ticketing, CI, monitoring, integrations) are doing most of the posting. Keeping bot output in its own channel means the main team channel stays focused on human conversation, and anyone who wants to follow the automation closely can without it drowning the rest.

- **Posting access:** bots and integrations. Humans can react or thread, but this isn't a discussion channel.
- **Purpose:** ticket updates, deploy notifications, automated reports, alerting.

Create one when automated noise is getting in the way. Not every team needs one from the start.

#### `-leads` — private leadership channel

A private channel for a team's leads, used sparingly for topics that genuinely can't be discussed openly — performance matters, sensitive hiring decisions, early-stage commercial conversations.

This isn't a default. Most leadership discussion should still happen in `team-slt` or the relevant `team-` channel. The `-leads` channel is for the exceptions.

## External / partner channels

Channels with external companies (agencies, partners, vendors) follow a straightforward convention:

- **`<partner>`** — for a company-wide relationship.
- **`<partner>-<topic>`** — if there are multiple workstreams with the same partner.
- **`<partner>-<ours>`** — when the channel is set up on the partner's side via Slack Connect and they control the naming; the suffix identifies us as the other party.

Created via **Slack Connect** and shared with the external organisation. Keep names short and recognisable to both sides.

## Outcome channels

For [outcomes](development.md#the-work-structure) — cross-functional groups working on a shared business goal (retention, acquisition, and so on). Membership cuts across team lines, and/or includes several teams, so outcomes get their own `outcome-` prefix rather than sitting under a single `team-`.

Outcome channels are used for cross-team announcements, updates, and coordination. They're not a substitute for team channels — they sit alongside them for the cross-team work on that specific outcome.

Like team channels, outcome channels are public.

## General / social channels

These sit outside the naming system and should be left as-is. They're for culture, connection, and the informal side of work — `general`, `random`, `celebrations`, `focus-friday`, and similar.

This includes affinity and community channels — spaces for parents, wellbeing, shared interests, or any group that wants a home. These are welcome and encouraged. They don't need a prefix, but should have a description explaining who the channel is for.

New social channels can be created by anyone — just add a clear description when you set one up.

## Governance

### Creating a new channel

Before creating one, ask:

1. Does something already exist for this? (Search first — it often does.)
2. Will more than one person use this regularly?
3. Will the conversation run for more than a week?

If yes to all three, create it. Otherwise an existing channel or a DM is the right call.

Every new channel should have:

- A **description** explaining what it's for and any posting expectations.
- An **owner** responsible for keeping it relevant.

### Archiving

- Project channels: archive 30 days after the work is complete.
- Channels with no activity in 90 days: the owner is prompted to archive or confirm it's still needed.
- Archived channels are never deleted — the history stays searchable.
