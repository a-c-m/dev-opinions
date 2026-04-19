---
name: beads-local-tasks
description: Auto-triggers when the user mentions tasks, todos, what's next, or local work-in-progress. Uses the `bd` (beads) CLI for local tracking; defers to GitHub issues for team/long-running work.
---

This repo uses **beads** (`bd` CLI) for *local* task management: scratch lists,
in-flight personal work, per-branch context. Beads state lives in `.beads/`,
which is **gitignored**. It does not leave the machine.

For anything team-visible, long-running, or external (stories, bugs, release
notes, customer issues), use **GitHub Issues**: `./.claude/commands/create-issue.sh`.

## When to reach for `bd`

- "What was I working on?" — `bd list --ready` or `bd list --status in_progress`
- "Quickly note a TODO I don't want to lose" — `bd q "<one-line task>"`
- "Show the details of task X" — `bd show bd-<n>`
- "Mark done" — `bd close bd-<n>`
- "What's blocking me?" — `bd list --status blocked`
- "Show today's activity" — `bd activity`
- "What's stale?" — `bd stale`
- "Dependency graph between tasks" — `bd graph`

## When NOT to use `bd`

- Anything another person needs to see.
- Anything tied to a release or a deliverable commitment.
- Anything that outlives this branch or this week.

In those cases use `gh issue create` via `./.claude/commands/create-issue.sh`
so the item is visible to the team and appears in project boards.

## Quick capture pattern

When the user drops a task in conversation ("remember to X", "we should Y"),
prefer `bd q "X"` over making them remember. `bd q` creates and returns the
ID in one line — minimal ceremony.

## Opening a bead

Open beads in Markdown look like: `bd-42 (P1, open) — <title>`.
`bd show bd-42` prints the full record. `bd edit bd-42` opens `$EDITOR`.

## Do NOT

- Install beads' own git hooks (`bd hooks install`). Beads state is local-only
  in this repo — we do not want it synced to git.
- Commit anything under `.beads/`. It is gitignored for a reason.
- Promote a `bd` task to "real" by editing files — copy it to a GitHub issue
  and close the bead.
