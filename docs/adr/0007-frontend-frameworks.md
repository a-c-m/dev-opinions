# ADR 0007: Frontend — React + Vite primary, SvelteKit alternative

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Frontend choice is driven by three questions: how much server rendering the app needs, how sensitive it is to bundle size and runtime cost, and how productive the team already is in the framework. Most apps in this environment are SPAs or internal tools where SSR is overkill; a smaller set benefit meaningfully from a lighter runtime.

## Decision

- **Primary default**: React 19 + Vite 7 SPA. Low-ceremony setup, huge ecosystem, pairs cleanly with admin-UI frameworks.
- **Alternative**: SvelteKit 2 for apps where bundle size, load performance, or form-heavy flows dominate — and for intentional team growth into Svelte.
- **Not the default**: Next.js. A separate ADR will cover it if an app requires SSR or edge rendering.
- Both stacks share the same lint/format config, env-config, test runners, and E2E setup, so switching cost for reviewers is low.

## Consequences

**Positive**
- The default path is frictionless for most apps and matches the stack the team is already fastest in.
- SvelteKit as an explicit alternative keeps the lighter option available without forcing every app into React.
- Shared tooling below the framework line means the choice of framework is local, not systemic.

**Negative**
- Two frontend stacks to document and keep generator templates for — mild duplication.
- SvelteKit adoption depends on some team upskilling; first couple of apps in it will be slower.

## Alternatives

- **React only** — simpler template, but rules out legitimate Svelte use cases.
- **Next.js 15 App Router as default** — excellent when SSR is needed, but heavier mental model and deploy complexity make it a bad default for SPAs and internal tools.
- **Solid / Qwik** — interesting runtime properties, smaller ecosystem, no in-house fluency.
