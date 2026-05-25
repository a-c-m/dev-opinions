---
name: tdd
description: Auto-triggers when the user wants to build a feature or fix a bug using TDD, mentions "red-green-refactor", asks for test-first development, or asks for tests around a behaviour that doesn't have any. Encodes a vertical-slice (tracer-bullet) loop, not horizontal "all tests then all code".
---

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). Audited for this repo: stripped external file references (`tests.md`, `mocking.md`, `deep-modules.md`) — the philosophy is in the body; we don't want to maintain a satellite library.

## Philosophy

**Tests verify behaviour through public interfaces, not implementation details.** Code can change entirely; tests shouldn't.

- **Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_. "User can checkout with valid cart" tells you exactly what capability exists. They survive refactors.
- **Bad tests** are coupled to implementation: they mock internal collaborators, test private methods, or verify through external means. The warning sign: your test breaks when you refactor, but behaviour hasn't changed.

For our stack ([ADR 0012](../../docs/adr/0012-vitest-playwright.md)):
- Vitest for unit + integration. Mock only at external boundaries (network, filesystem, time, random) — see also [.claude/agents/testing-specialist.md](../agents/testing-specialist.md).
- Playwright for E2E (`apps/<product>/<service>-e2e/`).

## The anti-pattern: horizontal slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" and it produces crap tests:

- Tests written in bulk test _imagined_ behaviour, not _actual_ behaviour.
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behaviour.
- Tests become insensitive to real changes — they pass when behaviour breaks, fail when behaviour is fine.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical / tracer bullets):
  RED → GREEN: test1 → impl1
  RED → GREEN: test2 → impl2
  ...
```

## Workflow

### 1. Plan (no code yet)

- Confirm with the user which behaviours matter most. You can't test everything; prioritise.
- Sketch the public interface — what does the caller / user see?
- Confirm with the user before writing the first test.

Ask: "What should the public interface look like? Which behaviours are most important?"

### 2. Tracer bullet

Write ONE test that confirms ONE thing about the system end-to-end:

```
RED:   write test for first behaviour → test fails
GREEN: minimal code to pass            → test passes
```

This proves the path works. Don't worry about edge cases yet.

### 3. Incremental loop

For each remaining behaviour:

```
RED:   write next test → fails
GREEN: minimal code to pass → passes
```

Rules:
- One test at a time.
- Only enough code to pass the current test.
- Don't anticipate future tests.
- Keep tests focused on observable behaviour.

### 4. Refactor (only when GREEN)

After all tests pass, look for:
- Duplication to extract.
- Modules to deepen (move complexity behind a simple interface).
- What new code reveals about existing code.

Run tests after each refactor step. **Never refactor while RED.** Get to GREEN first.

## Per-cycle checklist

```
[ ] Test describes behaviour, not implementation
[ ] Test uses public interface only
[ ] Test would survive an internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```

## When to escalate to the testing-specialist subagent

For test-strategy questions (which layer to test at, what's covered already, what's flaky), delegate to [.claude/agents/testing-specialist.md](../agents/testing-specialist.md) rather than improvising. It returns a plan; this skill is the plan-execution loop.
