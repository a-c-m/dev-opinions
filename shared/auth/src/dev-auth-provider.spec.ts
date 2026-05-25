// Unit tests for DevAuthProvider — verifies header extraction, prod
// refusal, and the warn-on-construction signal.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevAuthProvider } from "./dev-auth-provider.ts";
import type { AuthRequest } from "./types.ts";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const DEV_AUTH_PROVIDER_LOG_RE = /DevAuthProvider/;
const REFUSED_MSG_RE = /refused/;

describe("DevAuthProvider", () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  describe("constructor", () => {
    it("warns on construction outside production", () => {
      process.env.NODE_ENV = "development";
      const warn = vi.fn();
      new DevAuthProvider({ warn });
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toMatch(DEV_AUTH_PROVIDER_LOG_RE);
    });

    it("uses a no-op warn when none provided", () => {
      process.env.NODE_ENV = "development";
      // Doesn't throw — that's the assertion.
      expect(() => new DevAuthProvider()).not.toThrow();
    });

    it("refuses to construct under NODE_ENV=production", () => {
      process.env.NODE_ENV = "production";
      expect(() => new DevAuthProvider()).toThrow(REFUSED_MSG_RE);
    });

    it("allows construction under production with explicit override", () => {
      process.env.NODE_ENV = "production";
      const warn = vi.fn();
      expect(() => new DevAuthProvider({ allowDevInProduction: true, warn })).not.toThrow();
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  describe("authenticate", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    const makeProvider = () => new DevAuthProvider({ warn: vi.fn() });

    it("returns unauthenticated when x-dev-user-id is missing", async () => {
      const req: AuthRequest = { headers: {} };
      const result = await makeProvider().authenticate(req);
      expect(result.kind).toBe("unauthenticated");
    });

    it("returns authenticated with roles parsed from CSV", async () => {
      const req: AuthRequest = {
        headers: { "x-dev-user-id": "u1", "x-dev-roles": "admin, viewer , editor" },
      };
      const result = await makeProvider().authenticate(req);
      expect(result).toEqual({
        kind: "authenticated",
        claims: { userId: "u1", roles: ["admin", "viewer", "editor"] },
      });
    });

    it("returns authenticated with empty roles when x-dev-roles missing", async () => {
      const req: AuthRequest = { headers: { "x-dev-user-id": "u1" } };
      const result = await makeProvider().authenticate(req);
      expect(result).toEqual({
        kind: "authenticated",
        claims: { userId: "u1", roles: [] },
      });
    });

    it("returns authenticated with empty roles when x-dev-roles is empty", async () => {
      const req: AuthRequest = {
        headers: { "x-dev-user-id": "u1", "x-dev-roles": "" },
      };
      const result = await makeProvider().authenticate(req);
      if (result.kind !== "authenticated") {
        throw new Error("expected authenticated");
      }
      expect(result.claims.roles).toEqual([]);
    });

    it("supports headers as arrays (picks first)", async () => {
      const req: AuthRequest = {
        headers: { "x-dev-user-id": ["u1", "u2"], "x-dev-roles": ["admin"] },
      };
      const result = await makeProvider().authenticate(req);
      expect(result).toEqual({
        kind: "authenticated",
        claims: { userId: "u1", roles: ["admin"] },
      });
    });

    it("treats non-string header value as missing", async () => {
      const req: AuthRequest = {
        headers: { "x-dev-user-id": undefined },
      };
      const result = await makeProvider().authenticate(req);
      expect(result.kind).toBe("unauthenticated");
    });

    it("treats empty array header value as missing", async () => {
      const req: AuthRequest = {
        headers: { "x-dev-user-id": [] },
      };
      const result = await makeProvider().authenticate(req);
      expect(result.kind).toBe("unauthenticated");
    });
  });
});
