# @shared/flags

TypeScript flag registry + OpenFeature wrappers per ADR 0029.

**Status:** stub. The `FlagDef` type, empty `flags` registry, and `FlagKey` derivation live in `src/index.ts`. The NestJS `@BooleanFeatureFlag` wrapper around `@openfeature/nestjs-sdk` (pre-1.0; wrapped so breaking changes are a one-file edit) lands in `src/nestjs.ts` when the first backend consumes; the in-house `useFeatureFlag` hook lands in `src/react.ts` when the React app consumes.

Asymmetric PostHog story (per ADR 0029): when a fork adopts PostHog as the analytics layer (per ADR 0025), the backend swaps `InMemoryProvider` → Tapico's `PostHogProvider` (fork-and-pin to `posthog-node ^5`); the frontend re-implements `useFeatureFlag` body to delegate to `@posthog/react`. Hook signature stays identical.

See [ADR 0029](../../docs/adr/0029-feature-flags.md).
