<!--
PR template — see ADR 0018. Keep it short. Reviewers should be oriented in
under 30 seconds before they look at the diff.
-->

## Risk level

<!-- Pick one, delete the rest. -->
- [ ] HIGH — production data, auth, billing, migrations, infra
- [ ] MEDIUM — feature change or cross-cutting refactor
- [ ] LOW — isolated fix or small feature
- [ ] TRIVIAL — docs / comments / internal-only

## Summary

<!-- What changed. 1–3 bullets. Not a diff restatement. -->
-

## Why it matters

<!-- Who benefits, what outcome. Not what the code does. -->

## Test plan

<!-- How this was verified. Include commands and results. -->
- [ ] `pnpm check` green locally
- [ ] `pnpm test:e2e` green for affected E2E suites (if UI changed)
- [ ] Manual verification if the change has a UI or external side effect

## Breaking changes

<!-- Delete this section if none. Otherwise: what breaks, how consumers migrate. -->

## Checklist

- [ ] ADR alignment confirmed — no drift, or a new/updated ADR is in this PR
- [ ] Tests added or updated for the behaviour that changed
- [ ] Docs / READMEs updated where affected
- [ ] No secrets or `.env` committed
