// Unit tests for OidcAuthProvider — verifies JWT verification, claims
// mapping, and AuthError translation against jose error classes.

import { errors, generateKeyPair, jwtVerify, type KeyLike, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { OidcAuthProvider } from "./oidc-auth-provider.ts";
import type { AuthRequest } from "./types.ts";

// jose's createRemoteJWKSet fetches over HTTP; we mock it to return a
// resolver bound to a locally-generated key. jwtVerify is wrapped so
// specific tests can override its behaviour via vi.mocked().
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() => mockJWKSResolver),
    jwtVerify: vi.fn(actual.jwtVerify),
  };
});

let mockKey: KeyLike;
let mockJWKSResolver: () => Promise<KeyLike>;

const makeRequest = (token?: string): AuthRequest => ({
  headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
});

const makeProvider = (overrides: Partial<ConstructorParameters<typeof OidcAuthProvider>[0]> = {}) =>
  new OidcAuthProvider({
    audience: "test-svc",
    issuer: "https://issuer.test",
    jwksUrl: "https://issuer.test/.well-known/jwks.json",
    ...overrides,
  });

const signToken = async (
  payload: Record<string, unknown>,
  opts: { audience?: string; expirationTime?: string; issuer?: string } = {}
) => {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(opts.issuer ?? "https://issuer.test")
    .setAudience(opts.audience ?? "test-svc")
    .setIssuedAt()
    .setExpirationTime(opts.expirationTime ?? "1h");
  return await jwt.sign(mockKey);
};

describe("OidcAuthProvider", () => {
  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    mockKey = privateKey;
    mockJWKSResolver = async () => publicKey;
  });

  describe("constructor", () => {
    it("rejects missing jwksUrl", () => {
      expect(
        () =>
          new OidcAuthProvider({
            audience: "x",
            issuer: "y",
            jwksUrl: "",
          })
      ).toThrow("jwksUrl, issuer, and audience");
    });

    it("rejects missing issuer", () => {
      expect(
        () =>
          new OidcAuthProvider({
            audience: "x",
            issuer: "",
            jwksUrl: "https://x/jwks",
          })
      ).toThrow();
    });

    it("rejects missing audience", () => {
      expect(
        () =>
          new OidcAuthProvider({
            audience: "",
            issuer: "y",
            jwksUrl: "https://x/jwks",
          })
      ).toThrow();
    });
  });

  describe("authenticate", () => {
    it("returns unauthenticated when no Authorization header", async () => {
      const result = await makeProvider().authenticate({ headers: {} });
      expect(result.kind).toBe("unauthenticated");
    });

    it("returns unauthenticated when scheme is not Bearer", async () => {
      const result = await makeProvider().authenticate({
        headers: { authorization: "Basic abc" },
      });
      expect(result.kind).toBe("unauthenticated");
    });

    it("returns unauthenticated when Authorization header is non-string", async () => {
      const result = await makeProvider().authenticate({
        headers: { authorization: undefined },
      });
      expect(result.kind).toBe("unauthenticated");
    });

    it("handles Authorization header as array (picks first)", async () => {
      const token = await signToken({ sub: "user-1", roles: ["viewer"] });
      const result = await makeProvider().authenticate({
        headers: { authorization: [`Bearer ${token}`] },
      });
      expect(result.kind).toBe("authenticated");
    });

    it("supports capitalised Authorization header", async () => {
      const token = await signToken({ sub: "user-1", roles: ["viewer"] });
      const result = await makeProvider().authenticate({
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(result.kind).toBe("authenticated");
    });

    it("returns authenticated with claims for a valid token", async () => {
      const token = await signToken({ sub: "user-1", roles: ["admin", "viewer"] });
      const result = await makeProvider().authenticate(makeRequest(token));
      expect(result).toEqual({
        kind: "authenticated",
        claims: { userId: "user-1", roles: ["admin", "viewer"] },
      });
    });

    it("returns empty roles when payload has no roles[]", async () => {
      const token = await signToken({ sub: "user-1" });
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "authenticated") {
        throw new Error("expected authenticated");
      }
      expect(result.claims.roles).toEqual([]);
    });

    it("filters non-string roles from the payload", async () => {
      const token = await signToken({
        sub: "user-1",
        roles: ["admin", 42, null, "viewer"],
      });
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "authenticated") {
        throw new Error("expected authenticated");
      }
      expect(result.claims.roles).toEqual(["admin", "viewer"]);
    });

    it("returns failed when sub is missing", async () => {
      const token = await signToken({ roles: ["x"] });
      const result = await makeProvider().authenticate(makeRequest(token));
      expect(result).toEqual({
        kind: "failed",
        error: { code: "malformed_claims", message: "userId missing from claims" },
      });
    });

    it("returns failed with code 'expired' when token is expired", async () => {
      // clockTolerance defaults to 30s; expire long enough ago to clear it.
      const token = await signToken({ sub: "user-1" }, { expirationTime: "-2m" });
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("expired");
    });

    it("returns failed with code 'wrong_issuer' on issuer mismatch", async () => {
      const token = await signToken({ sub: "user-1" }, { issuer: "https://other.test" });
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("wrong_issuer");
    });

    it("returns failed with code 'wrong_audience' on audience mismatch", async () => {
      const token = await signToken({ sub: "user-1" }, { audience: "wrong-svc" });
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("wrong_audience");
    });

    it("returns failed with code 'malformed_claims' on garbage token", async () => {
      const result = await makeProvider().authenticate(makeRequest("not-a-jwt"));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("malformed_claims");
    });

    it("returns failed with code 'invalid_signature' when token is signed by another key", async () => {
      const other = await generateKeyPair("RS256");
      const token = await new SignJWT({ sub: "user-1" })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer("https://issuer.test")
        .setAudience("test-svc")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(other.privateKey);
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("invalid_signature");
    });

    it("returns failed with 'malformed_claims' for non-iss/aud claim mismatch (nbf)", async () => {
      const token = await new SignJWT({ sub: "user-1" })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer("https://issuer.test")
        .setAudience("test-svc")
        .setIssuedAt()
        .setNotBefore("1y")
        .setExpirationTime("2y")
        .sign(mockKey);
      const result = await makeProvider().authenticate(makeRequest(token));
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe("malformed_claims");
    });

    it.each([
      ["JWSInvalid", new errors.JWSInvalid(), "malformed_claims"],
      ["JWTInvalid", new errors.JWTInvalid(), "malformed_claims"],
      ["JWKSNoMatchingKey", new errors.JWKSNoMatchingKey(), "no_jwks"],
      ["JWKSMultipleMatchingKeys", new errors.JWKSMultipleMatchingKeys(), "no_jwks"],
    ])("maps jose error %s to AuthErrorCode %s", async (_name, errToThrow, expectedCode) => {
      const spy = vi.mocked(jwtVerify).mockRejectedValueOnce(errToThrow);
      const result = await makeProvider().authenticate(makeRequest("any.token.value"));
      spy.mockRestore();
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error.code).toBe(expectedCode);
    });

    it("maps unknown non-Error throw to malformed_claims with generic message", async () => {
      // biome-ignore lint/style/useThrowOnlyError: simulating a non-Error throw
      const spy = vi.mocked(jwtVerify).mockRejectedValueOnce("not an Error");
      const result = await makeProvider().authenticate(makeRequest("any.token.value"));
      spy.mockRestore();
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error).toEqual({
        code: "malformed_claims",
        message: "unknown verification error",
      });
    });

    it("maps a plain Error throw to malformed_claims preserving message", async () => {
      const spy = vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("oh no"));
      const result = await makeProvider().authenticate(makeRequest("any.token.value"));
      spy.mockRestore();
      if (result.kind !== "failed") {
        throw new Error("expected failed");
      }
      expect(result.error).toEqual({ code: "malformed_claims", message: "oh no" });
    });

    it("applies a custom claimsMapper", async () => {
      const provider = makeProvider({
        claimsMapper: (p) => ({
          userId: typeof p.user_id === "string" ? p.user_id : "",
          roles: Array.isArray(p.scope_roles) ? (p.scope_roles as string[]) : [],
        }),
      });
      const token = await signToken({
        sub: "ignored",
        user_id: "u-from-custom",
        scope_roles: ["a", "b"],
      });
      const result = await provider.authenticate(makeRequest(token));
      expect(result).toEqual({
        kind: "authenticated",
        claims: { userId: "u-from-custom", roles: ["a", "b"] },
      });
    });
  });
});
