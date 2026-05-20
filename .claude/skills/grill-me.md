---
name: grill-me
description: Auto-triggers when the user asks to be grilled, stress-tested on a plan, or wants to reach shared understanding before implementation. Use when the user mentions "grill me", "grill me on this", "challenge this plan", or before any non-trivial implementation begins.
---

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md). Audited for this repo: kept verbatim — the original is three sentences and adding to it makes it worse.

## Instructions

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## When to use

- Before starting a non-trivial implementation, especially anything that crosses service boundaries (web → api → db, or one product to another).
- When a plan has felt too vague and a previous session shipped the wrong thing.
- Before writing a PRD via the `to-prd` skill — grilling sharpens what goes into the PRD.

## When NOT to use

- One-line edits, typos, or anything fully specified.
- When the user explicitly says "just do it" or "no questions" — they've already decided.
- When the codebase already answers the question (the third sentence above is doing real work — don't ask the user what `rg` would tell you).
