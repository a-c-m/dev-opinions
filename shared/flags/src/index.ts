// Stub per ADR 0035. Implementation lands when first service consumes.
// See docs/adr/0035-feature-flags.md for the full contract.

export interface FlagDef {
  readonly default: boolean | string;
  readonly description?: string;
  readonly expires: string;
  readonly owner: string;
}

/**
 * Registry. Real registry adds per-flag entries here.
 * Kebab-case keys per ADR 0035 (matches the flag-tooling ecosystem).
 */
export const flags = {} as const satisfies Record<string, FlagDef>;

export type FlagKey = keyof typeof flags;

/**
 * Backend decorator options. NestJS side wraps `@openfeature/nestjs-sdk`
 * (pre-1.0) so breaking changes are a one-file edit. Real impl in
 * `shared/flags/nestjs.ts` once a service consumes.
 */
export interface BooleanFeatureFlagOptions<K extends FlagKey> {
  defaultValue: boolean;
  flagKey: K;
}

/**
 * Frontend hook signature. Body delegates to `@openfeature/react-sdk`
 * (default) or `@posthog/react` (when fork adopts PostHog per ADR 0032).
 * Real impl in `shared/flags/react.ts` once the React app consumes.
 */
export interface UseFeatureFlagResult<T> {
  loading: boolean;
  value: T;
}
