# /handover

Produce a handover note for the next session or contributor. Write to stdout in this exact shape:

```
## Handover — <YYYY-MM-DD>

### What I was doing
<one sentence>

### Where I left it
- Branch: <name>
- Uncommitted files: <list or "none">
- Tests: <passing | failing: …>

### What is next
- [ ] <action 1>
- [ ] <action 2>

### Gotchas
- <anything non-obvious the next person would hit>
```

Gather facts as separate Bash steps (no chaining):

1. `git status --short`
2. `git branch --show-current`
3. `git log --oneline -n 5`
4. `pnpm check > .ai-wip/handover-check.log 2>&1` — capture full output to disk per AGENTS.md "Capture output for review".
5. `tail -n 20 .ai-wip/handover-check.log` — surface the trailing summary; the full log stays on disk for follow-up.

Do not invent next steps — derive them from what is unfinished in the diff, failing tests, or TODO comments added this session.
