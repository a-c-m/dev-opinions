// Unit tests for ManagedIdpAuthProvider — verifies it delegates to
// OIDC verification at the token layer (the current stub behaviour).

import { describe, expect, it, vi } from "vitest";
import { ManagedIdpAuthProvider } from "./managed-idp-auth-provider.ts";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() => () => Promise.reject(new Error("not called"))),
  };
});

describe("ManagedIdpAuthProvider", () => {
  it("constructs without throwing", () => {
    expect(
      () =>
        new ManagedIdpAuthProvider({
          audience: "test-svc",
          issuer: "https://issuer.test",
          jwksUrl: "https://issuer.test/jwks",
        })
    ).not.toThrow();
  });

  it("delegates authenticate() to the OIDC verifier (returns unauthenticated for no header)", async () => {
    const provider = new ManagedIdpAuthProvider({
      audience: "test-svc",
      issuer: "https://issuer.test",
      jwksUrl: "https://issuer.test/jwks",
    });
    const result = await provider.authenticate({ headers: {} });
    expect(result.kind).toBe("unauthenticated");
  });
});
