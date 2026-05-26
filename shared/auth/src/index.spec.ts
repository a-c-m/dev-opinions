// Unit tests for the createAuthProvider factory — verifies the
// discriminated-config selection picks the correct impl per provider.

import { describe, expect, it, vi } from "vitest";
import {
  type AuthProviderConfig,
  createAuthProvider,
  DevAuthProvider,
  ManagedIdpAuthProvider,
  OidcAuthProvider,
} from "./index.ts";

// jose's createRemoteJWKSet would fetch over HTTP — short-circuit so
// the OIDC + Managed constructors don't error.
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() => () => Promise.reject(new Error("not called"))),
  };
});

const oidcConfig = {
  audience: "test-svc",
  issuer: "https://issuer.test",
  jwksUrl: "https://issuer.test/jwks",
} as const;

describe("createAuthProvider", () => {
  it("returns DevAuthProvider when config.provider === 'dev'", () => {
    const config: AuthProviderConfig = {
      nodeEnv: "development",
      provider: "dev",
      warn: vi.fn(),
    };
    const provider = createAuthProvider(config);
    expect(provider).toBeInstanceOf(DevAuthProvider);
  });

  it("returns ManagedIdpAuthProvider when config.provider === 'managed'", () => {
    const config: AuthProviderConfig = { provider: "managed", ...oidcConfig };
    const provider = createAuthProvider(config);
    expect(provider).toBeInstanceOf(ManagedIdpAuthProvider);
  });

  it("returns OidcAuthProvider when config.provider === 'oidc'", () => {
    const config: AuthProviderConfig = { provider: "oidc", ...oidcConfig };
    const provider = createAuthProvider(config);
    expect(provider).toBeInstanceOf(OidcAuthProvider);
  });
});
