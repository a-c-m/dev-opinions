---
name: pr-review
description: Auto-triggers when the user asks to review a PR or paste a diff. Delegates to the code-reviewer agent for an independent pass and frames findings for the author.
---
For PR review:

1. Pull the diff: `gh pr diff <n>` or `git diff <base>...<head>`.
2. Read the referenced ticket(s) for intent and acceptance criteria.
3. Spawn the `code-reviewer` agent for an independent pass. For prose diffs (docs, ADRs), skip it — fan out read-only agents to fact-check claims against the codebase instead. State which you used.
4. Group findings as `BLOCKING / SHOULD / NIT`, each quoting `file:line`.
5. Separately verify:
   - Does the PR do what the ticket asks for (no more, no less)?
   - Drift from an ADR? Call it out.
   - Are there any security or performance implications?
   - Could it be more concise or clearer?
   - Do our tests cover the change?
6. Draft to `.ai-wip/pr-<n>-review.md`, ready to post as a comment: a 2-3 line overview (what it does + verdict), then findings, then verify notes. The agent returns findings only — write the overview yourself.

Fewer than two items? Say so — don't pad with nits.
