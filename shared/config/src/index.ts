// Stub per ADR 0017. Implementation lands when first service consumes.
// See docs/adr/0016-backend-config.md for the full contract.

/**
 * Marks a config field as file-sourced (read from layered YAML only).
 * Env vars are never consulted for these fields.
 */
export interface FileField<T> {
  readonly __source: "file";
  readonly schema: T;
}

/**
 * Marks a config field as secret-sourced (read from `process.env[name]` only).
 * May appear in `local.yaml` for dev-only override (warning logged).
 */
export interface SecretField<T> {
  readonly __source: "secret";
  readonly envVar: string;
  readonly schema: T;
}

/**
 * Top-level keys must be objects (sections). Bare scalars at the top level
 * are rejected by `defineConfig` — every value belongs to a named section.
 */
export type ConfigSchema = Record<
  string,
  Record<string, FileField<unknown> | SecretField<unknown>>
>;

/**
 * Per-section type derivation. Forks implement when the loader lands.
 */
export type InferConfig<_S extends ConfigSchema> = Record<string, Record<string, unknown>>;

/**
 * Branded DI token for a config section. Cannot be constructed for a
 * non-existent section — typecheck error at every consumer.
 */
export type ConfigToken<Section> = symbol & { readonly __section: Section };
