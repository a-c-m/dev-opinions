// OidcAuthProvider — generic OIDC verification via `jose`.
// Production canonical impl per ADR 0027.

import type { JWTVerifyOptions } from "jose";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type {
  AuthError,
  AuthErrorCode,
  AuthOutcome,
  AuthProvider,
  AuthRequest,
  OidcAuthConfig,
  TokenClaims,
} from "./types.ts";

const DEFAULT_ALGORITHMS = ["RS256", "ES256", "PS256"] as const;
const DEFAULT_CLOCK_TOLERANCE_SEC = 30;

const defaultClaimsMapper = (payload: Record<string, unknown>): TokenClaims => {
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const rolesRaw = payload.roles;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw.filter((r): r is string => typeof r === "string")
    : [];
  return { userId, roles };
};

const claimToCode = (claim: string): AuthErrorCode => {
  if (claim === "iss") {
    return "wrong_issuer";
  }
  if (claim === "aud") {
    return "wrong_audience";
  }
  return "malformed_claims";
};

const mapJoseError = (err: unknown): AuthError => {
  if (err instanceof errors.JWTExpired) {
    return { code: "expired", message: err.message };
  }
  if (err instanceof errors.JWTClaimValidationFailed) {
    return { code: claimToCode(err.claim), message: err.message };
  }
  if (err instanceof errors.JWSSignatureVerificationFailed) {
    return { code: "invalid_signature", message: err.message };
  }
  if (err instanceof errors.JWSInvalid) {
    return { code: "malformed_claims", message: err.message };
  }
  if (err instanceof errors.JWTInvalid) {
    return { code: "malformed_claims", message: err.message };
  }
  if (err instanceof errors.JWKSNoMatchingKey) {
    return { code: "no_jwks", message: err.message };
  }
  if (err instanceof errors.JWKSMultipleMatchingKeys) {
    return { code: "no_jwks", message: err.message };
  }
  const message = err instanceof Error ? err.message : "unknown verification error";
  return { code: "malformed_claims", message };
};

const extractBearer = (req: AuthRequest): string | null => {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header !== "string") {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

export class OidcAuthProvider implements AuthProvider {
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #verifyOptions: JWTVerifyOptions;
  readonly #mapClaims: (payload: Record<string, unknown>) => TokenClaims;

  constructor(config: OidcAuthConfig) {
    if (!(config.jwksUrl && config.issuer && config.audience)) {
      throw new Error("OidcAuthProvider requires jwksUrl, issuer, and audience");
    }
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl));
    this.#verifyOptions = {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: [...(config.algorithms ?? DEFAULT_ALGORITHMS)],
      clockTolerance: config.clockToleranceSec ?? DEFAULT_CLOCK_TOLERANCE_SEC,
    };
    this.#mapClaims = config.claimsMapper ?? defaultClaimsMapper;
  }

  async authenticate(req: AuthRequest): Promise<AuthOutcome> {
    const token = extractBearer(req);
    if (token === null) {
      return { kind: "unauthenticated" };
    }
    try {
      const { payload } = await jwtVerify(token, this.#jwks, this.#verifyOptions);
      const claims = this.#mapClaims(payload as Record<string, unknown>);
      if (!claims.userId) {
        return {
          kind: "failed",
          error: { code: "malformed_claims", message: "userId missing from claims" },
        };
      }
      return { kind: "authenticated", claims };
    } catch (err) {
      return { kind: "failed", error: mapJoseError(err) };
    }
  }
}
