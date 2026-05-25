// ManagedIdpAuthProvider — stub slot for a vendor-specific adapter
// (Better Auth / WorkOS / Logto Cloud / etc.) per ADR 0037.
//
// Until a fork picks a vendor, this class delegates to the generic
// OIDC verifier — every named vendor in the ladder is OIDC-compatible
// at the token-verification layer, so the OIDC impl is the right
// fallback. When a fork picks one, override with the vendor's SDK
// idioms (refresh-token rotation, session sync, etc.) on top.

import { OidcAuthProvider } from "./oidc-auth-provider.ts";
import type { AuthOutcome, AuthProvider, AuthRequest, OidcAuthConfig } from "./types.ts";

export class ManagedIdpAuthProvider implements AuthProvider {
  readonly #oidc: OidcAuthProvider;

  constructor(config: OidcAuthConfig) {
    this.#oidc = new OidcAuthProvider(config);
  }

  authenticate(req: AuthRequest): Promise<AuthOutcome> {
    return this.#oidc.authenticate(req);
  }
}
