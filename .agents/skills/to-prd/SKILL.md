---
name: to-prd
description: Auto-triggers when the user wants to turn the current conversation into a PRD (Product Requirements Document) — usually after a grill-me session or a long discovery thread. Synthesises what's already been discussed, then files it as a GitHub issue. Does NOT interview — use grill-me first if the discussion is incomplete.
---

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-prd/SKILL.md). Audited for this repo: wired the issue-filing step to our `./.claude/commands/create-issue.sh`; replaced upstream `CONTEXT.md` references with the relevant `AGENTS.md` and ADRs; kept the PRD template verbatim because it's a known-good shape.

## When to use

- After a `grill-me` session that has reached shared understanding.
- After a long discovery / debugging thread that surfaced a real piece of work worth tracking.
- When the user says "write this up", "file an issue for this", "make this a PRD".

## When NOT to use

- The discussion is incomplete — run `grill-me` first.
- The work is small (one-line fix, typo). Use `bd q "<task>"` for local capture instead.
- The user already has an issue ID in mind — they want a body, not a synthesis.

## Process

### 1. Synthesise, don't interview

Use only what's already in the conversation context plus the codebase. Do **not** ask the user follow-up questions during this skill — that's `grill-me`'s job.

### 2. Verify against the relevant AGENTS.md + ADRs

Before writing, read:
- The nearest `AGENTS.md` (root, product, or service) for vocabulary and conventions.
- Any ADR under [docs/adr/](../../docs/adr/) the change touches — particularly if it modifies a stack choice (a new ADR is required per AGENTS.md, not just a PRD).

Use the project's actual vocabulary in the PRD.

### 3. Sketch the modules

List the major modules / files / packages that will need to change. For each, note:
- Will it be modified or created?
- Is it a deep module (small interface, lots of behaviour) or shallow (passthrough)?
- Does it have an existing test pattern to mirror?

Don't include code snippets or specific line numbers — they go stale fast.

### 4. File the issue

Use the repo's issue-creation script — it sets labels, scope, and links to the right project board:

```sh
./.claude/commands/create-issue.sh
```

The script accepts the PRD body via stdin or a file argument. Pass the body using a HEREDOC redirect to `.ai-wip/<name>-prd.md` first, then point the script at that file.

## PRD template

```markdown
## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A long, numbered list. Each in the format:

1. As an <actor>, I want a <feature>, so that <benefit>

Example:
1. As an admin, I want to filter by tag, so that I can find a record fast.

This list should be extensive — cover all aspects of the feature.

## Implementation Decisions

A list of decisions made during discussion. Include:

- The modules that will be built / modified
- The interfaces of those modules
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets — they go stale.

## Testing Decisions

- What makes a good test for this change (test external behaviour, not implementation).
- Which modules will be tested.
- Prior art (similar tests in the codebase) to mirror.

## ADR Alignment

- If this change touches a stack choice (per [docs/adr/](../../docs/adr/)), link or supersede the relevant ADR.
- If it doesn't, say so explicitly: "No ADR impact."

## Out of Scope

A description of what's deliberately not in this PRD.

## Further Notes

Anything else worth recording.
```

## After filing

Capture the issue ID in `.ai-wip/<name>-prd.md` for traceability and consider opening a corresponding `bd` task for any local follow-ups.
