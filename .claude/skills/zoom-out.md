---
name: zoom-out
description: Triggers when the user is unfamiliar with a section of code and wants the broader map — modules, callers, how it fits the system. Use when the user says "zoom out", "give me the bigger picture", "where does this sit", or pastes a file and asks "what does this even do".
---

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/blob/main/skills/engineering/zoom-out/SKILL.md). Audited for this repo: replaced the upstream's `CONTEXT.md` reference with our actual context sources (CLAUDE.md files + ADRs).

## Instructions

Go up a layer of abstraction. Give a map of the relevant modules and callers, using the language and conventions in:

1. The nearest `CLAUDE.md` for the area being asked about (the per-app `apps/<product>/<service>/CLAUDE.md` if one exists, otherwise the closest parent).
2. The root [CLAUDE.md](../../CLAUDE.md) for repo-wide conventions.
3. The relevant ADR(s) under [docs/adr/](../../docs/adr/) — these record the _why_ behind the structure.

Output shape (in this order):

1. **One-sentence summary** of what the module / file does in plain language.
2. **Where it sits** — which app / service, which layer (route / resolver / service / db / lib).
3. **Map of callers and callees** — `{file}` calls `{this}` calls `{that}`. Use file:line refs.
4. **Why it exists** — link the ADR or the CLAUDE.md section that motivates it.
5. **Adjacent files worth knowing about** — siblings the user will probably read next.

Keep it under ~30 lines. The point is orientation, not exhaustive documentation.

## When NOT to use

- The user already knows the area and wants you to do work, not summarise.
- The file is self-evidently a leaf with no callers (a script, a route handler, an isolated component).
- The user asked a specific question — answer the question, then optionally offer the zoom-out.
