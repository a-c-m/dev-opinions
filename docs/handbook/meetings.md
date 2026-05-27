---
title: Meetings
description: When we meet, why, and when we don't — meeting types, cadences, and expected load by role
---
# Meetings

Few people like meetings, yet they can be critical (if expensive) ways to communicate.
This doc is what I've seen work, at some scales, for some teams — not a rulebook.
Adapt the cadences to your team's rhythm; if a meeting type isn't earning its place, drop it.

> Evolving document. If your agenda works better, or a meeting type isn't needed, flag it.

Async-first is the default. For how we communicate when we're *not* in a meeting, see [chat.md](chat.md).

## Effective meetings

Five rules to apply before booking, joining, or running anything:

- **Work > meetings.** Your work is more important than meetings. Decline meetings that are not more valuable than your work.
- **No agenda, no attendance.** Meetings should be focused with a clear set of things to cover. If they don't, don't attend — you need to know it'll need you and be worth your time.
- **The 5-minute rule.** If core contributors aren't there and haven't said they'll be late, cancel the meeting.
- **Discuss, don't update.** Meetings are for discussion, not status updates (if you can possibly avoid it). Status updates goes in the agenda as pre-reads. If you don't have time to read the pre-read, you don't have time for the meeting.
- **Objective and review.** Set a goal at the start. Review it at the end. Did you achieve it?

## Meeting tiers

Meetings split into six tiers by who's in the room and why. Cadence notation:

- ★ = daily, or several times a week depending on team rhythm
- ☆ = weekly, or bi-weekly depending on team rhythm

### 1. Team meetings

People working on the same thing, staying in sync. 

**Daily★ standup** — for people on your bet or outcome. Make sure you understand each other's tasks, progress, and challenges; help each other succeed.

- Round robin (often async-first):
  - What you did yesterday
  - What you plan to do today
  - Things slowing you down
  - Key decisions being made
  - Blockers

**Board walk** — triage and hygiene on the team board.

- Incoming requests (bugs, ideas, support)
- Stale tickets
- Column limits
- Next-up review
- Engineering metrics check-in

### 2. Organisational meetings

People with the same or similar specialism — your support network.

**Weekly☆ 1:1 with your manager** — your personal development, issues, opportunities to improve. **Focus on personal development, not status updates.**

**Weekly☆ sync with your organisational / functional team** — same specialism as you. They help you improve; you help them improve.

- Round-robin check-in
- Engineering metrics review
- Board walk for any outside-outcome work
- Review of notable learning reports / completed bets
- Matters arising / theme topic

### 3. Departmental meetings

Cross-team, wider org.

- **Monthly tech all-hands** — what's happening across the technical team. Demos, updates, team-building. Run by a department lead on rotation.
- **Quarterly business review** — whole company.
- **Quarterly tech review** — full technical org.

### 4. Lead / manager meetings

For people accountable for outcomes or people.

**Weekly★ 1:1s with your direct reports** — same shape as your 1:1 upward.

**Weekly★ outcome sync** — discussion between Responsible and Accountable on each cross-functional outcome, with input from Consulted as needed. Raise higher-level issues and drive cross-outcome alignment.

- Active bets review
- Date check — are we on target?
- KPI check-in — are we measuring them? Are they moving?
- Progress report / learning report review
- Engineering metrics review
- Upcoming bets — are they ready, discussed, validated?
- Outside-outcome work — is everything tied to a bet? Anything that should be prioritised in?
- Context sharing and guidance: team ↔ accountable
- Notable learnings to share

**Monthly leadership circle** — leadership-focused conversation across functional areas.

- Round-robin: how's it going?
- Engineering metrics review
- Notable learning reports
- Matters arising / theme topic

### 5. Director / principal meetings

**Weekly★ skip-level 1:1s** — less structured 1:1s with the direct reports of people you manage. A space for them to raise things they wouldn't raise with their direct manager, and for you to get a clearer read on your team and managers.

> You don't need to meet every direct report of every manager you have, every week. A single slot per manager, rotating which report fills it, works well.

### 6. Meetings as a consultant

When you're [Consulted](#raci) on an outcome you're not Responsible or Accountable for — you bring specialist knowledge or a relevant interest, but you're not in the day-to-day.

> Be careful these meetings are effective for you. Only attend if you have value to bring. The advice about effective meetings still applies.

## RACI

Where the doc says **Responsible**, **Accountable**, **Consulted**, **Informed**, that's standard RACI:

- **Responsible** — does the work.
- **Accountable** — owns the outcome. One person per item.
- **Consulted** — gives input; two-way conversation.
- **Informed** — kept up to date; one-way notification.

## Expected weekly meeting load

A guardrail, not a target. Assuming ~5 direct reports for a manager, one outcome, and no meetings on Fridays.

| Role             | Org | X-Func | 1:1s | Other | Total | Per day |
| ---------------- | --- | ------ | ---- | ----- | ----- | ------- |
| Levels 1–2 (IC) | 1   | 4      | 1    | 0.75  | 6.75  | ~1.7    |
| IC 3+ (senior)   | 1   | 4 + 1  | 1    | 0.75  | 7.75  | ~1.9    |
| Manager 3+       | 1   | 4 + 1  | 6    | 1     | 13    | ~3.25   |

If you're over the load for your role, push back. If you're a manager and your reports are over their load, push back on their behalf.

## Wow, that's a lot of meetings

If you think this is too much, suggest ones we can cut or improve. We want as few meetings as necessary — and **not fewer**.

---

For async communications structure (Slack channels, threads, DMs vs channels), see [chat.md](chat.md).
