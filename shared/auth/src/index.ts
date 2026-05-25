// @shared/auth — vendor-agnostic authentication seam per ADR 0027.
// See docs/adr/0027-authentication.md for the full contract.

import type { DevAuthConfigWithLogger } from "./dev-auth-provider.ts";
import { DevAuthProvider } from "./dev-auth-provider.ts";
import { ManagedIdpAuthProvider } from "./managed-idp-auth-provider.ts";
import { OidcAuthProvider } from "./oidc-auth-provider.ts";
import type { AuthProvider, OidcAuthConfig } from "./types.ts";

export type { DevAuthConfigWithLogger } from "./dev-auth-provider.ts";
export { DevAuthProvider } from "./dev-auth-provider.ts";
export { ManagedIdpAuthProvider } from "./managed-idp-auth-provider.ts";
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
 * selects the impl; selection is config-driven per ADR 0016.
 */
export type AuthProviderConfig =
  | ({ provider: "dev" } & DevAuthConfigWithLogger)
  | ({ provider: "managed" } & OidcAuthConfig)
  | ({ provider: "oidc" } & OidcAuthConfig);

/**
 * Build an `AuthProvider` from config. `oidc` builds the generic
 * jose-based verifier; `managed` builds the vendor adapter slot (which
 * currently delegates to OIDC); `dev` is the local-dev header shim.
 */
export function createAuthProvider(config: AuthProviderConfig): AuthProvider {
  if (config.provider === "dev") {
    return new DevAuthProvider(config);
  }
  if (config.provider === "managed") {
    return new ManagedIdpAuthProvider(config);
  }
  return new OidcAuthProvider(config);
}
