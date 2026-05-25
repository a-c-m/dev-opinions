// Stub per ADR 0037. Implementation lands when first service consumes.
// See docs/adr/0037-authentication.md for the full contract.

/**
 * Minimal token claims. Multi-tenancy is a fork extension —
 * `tenantId` etc. live in the fork's own `shared/auth/` widening,
 * not here.
 */
export type TokenClaims = {
  userId: string;
  roles: string[];
};

export type AuthError = {
  code: "expired" | "invalid_signature" | "wrong_issuer" | "wrong_audience" | "malformed_claims";
  message: string;
};

/**
 * Three-state outcome. NEVER conflate `unauthenticated` (no credentials
 * presented — public routes pass) with `failed` (credentials presented,
 * verification failed — always 401). Conflation = public-route bypass
 * vulnerability.
 */
export type AuthOutcome =
  | { kind: "authenticated"; claims: TokenClaims }
  | { kind: "unauthenticated" }
  | { kind: "failed"; error: AuthError };

export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
};

/**
 * Vendor-agnostic seam. Three impls — `OidcAuthProvider` (canonical, via
 * `jose` against any spec-compliant IdP), `ManagedIdpAuthProvider` (thin
 * vendor adapter), `DevAuthProvider` (header shim, refused under
 * `NODE_ENV=production` unless explicit override). Selection is
 * config-driven per [ADR 0015](../../docs/adr/0015-backend-config.md).
 */
export type AuthProvider = {
  authenticate(req: AuthRequest): Promise<AuthOutcome>;
};
