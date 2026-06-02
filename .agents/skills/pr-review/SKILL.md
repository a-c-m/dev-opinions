---
name: pr-review
description: Auto-triggers when the user asks to review a PR or paste a diff. Delegates to the code-reviewer agent for an independent pass and frames findings for the author.
---

For PR review:

1. Pull the diff with `gh pr diff <n>` or `git diff <base>...<head>`.
2. Spawn the `code-reviewer` agent with the diff so the review is genuinely independent of any authoring context. If the diff is prose (docs, ADRs, audits), the code-reviewer pass adds little — instead fan out read-only agents to fact-check the doc's claims against the codebase. Either way, state which method you used in the posted review.
3. Group findings as `BLOCKING / SHOULD / NIT`. Quote the file and line.
4. Separately verify:
   - Does any change drift from an ADR? If yes, call it out explicitly.
   - Does the test plan in the PR body match what actually changed?
   - Did `pnpm check:affected` run green in CI?

When the review produces fewer than two items, say so — do not pad with nits.
