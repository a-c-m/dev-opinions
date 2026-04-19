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

Gather facts with:

```bash
git status --short
git branch --show-current
git log --oneline -n 5
pnpm check 2>&1 | tail -n 20
```

Do not invent next steps — derive them from what is unfinished in the diff, failing tests, or TODO comments added this session.
