---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0035: Feature flags

## Context and Problem Statement

Flags are inevitable: kill switches, dark launches, gating,
A/B. Without a convention, every service reinvents them. The
honest asymmetry up front: OpenFeature works server-side;
the client-side story is provider-dependent because no
first-party `posthog-js` OpenFeature provider exists.

## Decision Outcome

### Day-one stack — OpenFeature + TS registry + `InMemoryProvider`

No infra. Registry is a TypeScript `const` in `shared/flags/`.
OpenFeature's `InMemoryProvider` serves it; backend reads
via NestJS decorators, frontend via an in-house hook.

### Registry — `shared/flags/`

```typescript
// shared/flags/src/registry.ts
export const flags = {
  'new-checkout': { default: false, owner: 'payments', expires: '2026-09-01' },
  'ai-summaries': { default: false, owner: 'ml',       expires: '2026-07-15' },
} as const satisfies Record<string, FlagDef>;
export type FlagKey = keyof typeof flags;
```

- **Kebab-case** keys (ecosystem standard).
- Required: `default`, `owner` (NX project / team), `expires`
  (ISO review date).
- `FlagKey` union rejects unknown keys at typecheck on both
  sides. Same `as const satisfies` pattern as `ApiErrorCode`
  in [ADR 0033](0033-api-contracts-and-errors.md).

### Lifecycle hygiene — convention, not CI

`expires` is a review date. Past-expiry flags land on the
next planning agenda. No CI hook today — same reasoning as
the reverted long-lived-key hook in [ADR 0034](0034-secrets-runtime-injection.md):
PR review and git blame are the controls. Graduation:
`scripts/check-stale-flags.sh` modelled on
`check-stale-procedures.sh` if drift accumulates.

### Backend — `@openfeature/nestjs-sdk` (wrapped)

`OpenFeatureModule.forRoot({ defaultProvider: new InMemoryProvider(flags) })`
in `AppModule`. Wrapped in `shared/flags/nestjs.ts` because
the SDK is **pre-1.0** (v0.2.5) — breaking changes stay
one-file edits.

```typescript
@Get()
checkout(
  @BooleanFeatureFlag({ flagKey: 'new-checkout', defaultValue: false })
  flag: Observable<EvaluationDetails<boolean>>,
) { /* ... */ }
```

A `contextFactory` interceptor maps auth → `targetingKey`,
tenant → OpenFeature attributes. Application code doesn't
pass context.

### Frontend — in-house hook, not `@openfeature/react-sdk`

`@openfeature/react-sdk` is stable, but no `posthog-js`
OpenFeature web provider exists. Committing to OpenFeature
on the client means writing and maintaining a ~200 LOC
custom provider the day a fork adopts PostHog per
[ADR 0032](0032-runtime-observability.md). Defer:

```typescript
// shared/flags/react.ts
export function useFeatureFlag<K extends FlagKey>(
  key: K,
  defaultValue: typeof flags[K]['default'],
): { value: typeof flags[K]['default']; loading: boolean };
```

Signature matches `@openfeature/react-sdk`'s `useFlag`, so a
later swap doesn't change call sites.

### Asymmetric PostHog story

When a fork adopts PostHog per ADR 0032:

- **Backend**: `InMemoryProvider` → `PostHogProvider` from
  `@tapico/node-openfeature-posthog`. Tapico is stale
  (v1.1.4 June 2024, pinned to `posthog-node ^4`); expect
  to fork-and-pin to `^5` until upstream catches up.
  Application code unchanged.
- **Frontend**: re-implement `useFeatureFlag`'s body to
  delegate to `@posthog/react`'s `useFeatureFlagEnabled` /
  `useFeatureFlagVariantKey`. Hook signature unchanged.

Trade-off accepted: backend swap is one line; frontend swap
needs ~30 LOC re-implementation. Most forks pick one
provider.

### Graduation ladder

Triggers (any): >3 active flags, any flag >30 days, non-engineers
need to toggle, first kill-switch incident, first A/B request.

| Rung | When | Trade-off |
|---|---|---|
| **TS registry + InMemoryProvider** | Day one | No runtime toggling; deploy to change |
| **Unleash self-hosted** | OSS, no PostHog | First-class OpenFeature on both surfaces |
| **PostHog flags** (native both sides) | Already on PostHog per 0032 | Bundled with analytics/replay; no client-side abstraction |
| **GrowthBook Cloud** | Experimentation > flagging | Warehouse-native A/B; OSS escape |
| **ConfigCat** | Just managed flags, flat pricing | Weak on experimentation |

LaunchDarkly intentionally off the first rung — per-context
pricing + proprietary FDN is the lock-in shape OpenFeature
exists to mitigate.

### Deferred

- Experimentation (statistical analysis, exposure events)
- Multivariate flag payloads across providers (Tapico
  supports inconsistently; test before shipping)
- OFREP — too new; revisit if PostHog implements

## Consequences

### Positive

- Type-safe flag keys on both sides; typos rejected at compile.
- Lifecycle hygiene by construction — `expires` required.
- Vendor swap = one line on backend, ~30 LOC on frontend.
- Zero infra day one.

### Negative

- **`@openfeature/nestjs-sdk` is pre-1.0** — wrapped.
- **Tapico PostHog provider is stale** — fork-and-pin
  required if PostHog adopted backend-side.
- **Asymmetric frontend story** — PostHog forks bypass
  OpenFeature client-side; hook signature stays, body
  diverges.

### Neutral

- Registry kebab-case vs `ApiErrorCode` snake_case — flag
  ecosystem uses kebab; different audience.
- Experimentation deferred, not foreclosed.

## Alternatives considered

1. **Skip OpenFeature entirely.** Loses backend swap-point;
   accepted for frontend (no provider exists), rejected for
   backend.
2. **`@openfeature/react-sdk` now.** Commits us to writing a
   ~200 LOC custom `posthog-js` provider. Defer.
3. **LaunchDarkly day one.** Best at scale; exactly the
   lock-in shape we're designing against.
4. **Runtime JSON config in S3/Postgres without abstraction.**
   Owning the dashboard + audit log; outgrown in 1–2 quarters.
5. **Strangler / progressive rollout primitives by default.**
   Right for high-blast-radius flags only; default = boolean.

## Relationship to prior ADRs

- **References [0010](0010-nestjs-backend.md),
  [0011](0011-frontend-frameworks.md),
  [0015](0015-backend-config.md),
  [0034](0034-secrets-runtime-injection.md)** — NestJS DI,
  React 19 hosting, provider keys via typed secrets +
  entrypoint shim.
- **Interacts with [0032](0032-runtime-observability.md)** —
  PostHog adoption triggers the asymmetric path.
- **Mirrors [0033](0033-api-contracts-and-errors.md)** — same
  `as const satisfies` registry pattern as `ApiErrorCode`.

## References

- [OpenFeature](https://openfeature.dev) — CNCF Incubating
- [`@openfeature/nestjs-sdk`](https://www.npmjs.com/package/@openfeature/nestjs-sdk) — pre-1.0
- [`@tapico/node-openfeature-posthog`](https://github.com/Tapico/node-posthog-openfeature) — stale community provider
- [Unleash](https://github.com/Unleash/unleash) — graduation
- [PostHog issue #9609](https://github.com/PostHog/posthog/issues/9609) — open since May 2022; no first-party OpenFeature commitment
