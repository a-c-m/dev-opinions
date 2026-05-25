---
name: quality-checks
description: Auto-triggers when the user asks to verify a change, run checks, or prepare to push. Walks the full quality gate.
---

The quality gate is five steps:

```bash
pnpm lint:check      # bs check (baseline-aware biome)
pnpm typecheck       # tsgo across projects
pnpm test            # vitest
pnpm knip            # dead code / unused deps
pnpm security        # trivy (HIGH + CRITICAL)
```

Shortcuts:
- `pnpm check` — all five.
- `pnpm check:affected` — restricts to NX-affected projects for the first three.

If any step fails:

1. Fix the failure. Do not suppress it silently.
2. Re-run the full gate, not just the step that failed.
3. If a fix touches more than the obvious area, stop and ask — cascading edits under "just making the check pass" are a red flag.

For tests specifically: a flaky test is a broken test. Do not re-run until green; investigate.

For security: `pnpm security` requires Trivy on PATH. If missing, install it (`brew install aquasecurity/trivy/trivy`); do not skip.
