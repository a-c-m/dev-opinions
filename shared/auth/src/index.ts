// @shared/auth — vendor-agnostic authentication seam per ADR 0037.
// See docs/adr/0037-authentication.md for the full contract.

import type { DevAuthConfigWithLogger } from "./dev-auth-provider.ts";
import { DevAuthProvider } from "./dev-auth-provider.ts";
import { OidcAuthProvider } from "./oidc-auth-provider.ts";
import type { AuthProvider, OidcAuthConfig } from "./types.ts";

export type { DevAuthConfigWithLogger } from "./dev-auth-provider.ts";
export { DevAuthProvider } from "./dev-auth-provider.ts";
export { OidcAuthProvider } from "./oidc-auth-provider.ts";
export type {
  AuthError,
  AuthErrorCode,
  AuthOutcome,
  AuthProvider,
  AuthRequest,
  DevAuthConfig,
  OidcAuthConfig,
  TokenClaims,
} from "./types.ts";

/**
 * Discriminated config for `createAuthProvider`. The `provider` field
 * selects the impl; selection is config-driven per ADR 0015.
 */
export type AuthProviderConfig =
  | ({ provider: "dev" } & DevAuthConfigWithLogger)
  | ({ provider: "managed" } & OidcAuthConfig)
  | ({ provider: "oidc" } & OidcAuthConfig);

/**
 * Build an `AuthProvider` from config. `oidc` and `managed` both build
 * the OIDC verifier today; managed will swap to a vendor-specific
 * adapter when a fork picks one.
 */
export function createAuthProvider(config: AuthProviderConfig): AuthProvider {
  if (config.provider === "dev") {
    return new DevAuthProvider(config);
  }
  // Both `oidc` and `managed` use the OIDC verifier for now.
  return new OidcAuthProvider(config);
}

/**
 * Tag to satisfy `noBarrelFile` — this module exports both
 * types/classes (re-export) and a concrete factory function (logic),
 * so it isn't a pure barrel.
 */
export const SHARED_AUTH_PACKAGE = "@shared/auth" as const;
