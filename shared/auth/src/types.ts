// Type surface per ADR 0037. See docs/adr/0037-authentication.md.
// Interface members alphabetised per ultracite useSortedInterfaceMembers.

/**
 * Minimal token claims. Multi-tenancy is a fork extension —
 * `tenantId` etc. live in the fork's own `shared/auth/` widening,
 * not here.
 */
export interface TokenClaims {
  roles: string[];
  userId: string;
}

export type AuthErrorCode =
  | "expired"
  | "invalid_signature"
  | "malformed_claims"
  | "no_jwks"
  | "provider_misconfigured"
  | "wrong_audience"
  | "wrong_issuer";

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

/**
 * Three-state outcome. NEVER conflate `unauthenticated` (no credentials
 * presented — public routes pass) with `failed` (credentials presented,
 * verification failed — always 401). Conflation = public-route bypass
 * vulnerability.
 */
export type AuthOutcome =
  | { claims: TokenClaims; kind: "authenticated" }
  | { kind: "unauthenticated" }
  | { error: AuthError; kind: "failed" };

export interface AuthRequest {
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Vendor-agnostic seam. Three impls — `OidcAuthProvider` (canonical, via
 * `jose` against any spec-compliant IdP), `ManagedIdpAuthProvider` (thin
 * vendor adapter), `DevAuthProvider` (header shim, refused under
 * `NODE_ENV=production` unless explicit override).
 */
export interface AuthProvider {
  authenticate(req: AuthRequest): Promise<AuthOutcome>;
}

/**
 * Config for `OidcAuthProvider`. JWKS URL / issuer / audience pinned;
 * algorithm allow-list defaults to RS256/ES256/PS256 (never HS256
 * across services); `clockTolerance` accommodates IdP/server drift.
 */
export interface OidcAuthConfig {
  algorithms?: ReadonlyArray<"RS256" | "ES256" | "PS256">;
  audience: string;
  /**
   * Maps a verified JWT payload to `TokenClaims`. Default extracts
   * `sub` → `userId` and `roles[]`. Forks override to read custom
   * claim names.
   */
  claimsMapper?: (payload: Record<string, unknown>) => TokenClaims;
  clockToleranceSec?: number;
  issuer: string;
  jwksUrl: string;
}

/**
 * Config for `DevAuthProvider`. Reads claims from request headers —
 * `x-dev-user-id`, `x-dev-roles` (CSV). Refused under
 * `NODE_ENV=production` unless `allowDevInProduction: true`.
 */
export interface DevAuthConfig {
  allowDevInProduction?: boolean;
}
