// Unit tests for AuthzGuard — verifies metadata read, claims
// extraction, ability evaluation, and 401/403 error mapping.

import { type ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TokenClaims } from "@shared/auth";
import { describe, expect, it, vi } from "vitest";
import { DefaultAbilityFactory } from "./ability.factory.ts";
import { AuthzGuard } from "./authz.guard.ts";
import type { CheckAbilityMetadata } from "./types.ts";

const makeContext = (meta: CheckAbilityMetadata | undefined, user: TokenClaims | undefined) => {
  const reflector = new Reflector();
  vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(meta);
  const guard = new AuthzGuard(reflector, new DefaultAbilityFactory());
  const ctx = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return { guard, ctx: ctx as unknown as ExecutionContext };
};

describe("AuthzGuard", () => {
  it("passes when no @CheckAbility metadata is present", () => {
    const { guard, ctx } = makeContext(undefined, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("throws UnauthorizedException when claims are missing", () => {
    const { guard, ctx } = makeContext({ action: "read", subject: "Order" }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("passes when ability.can() returns true", () => {
    const adminClaims: TokenClaims = { userId: "u1", roles: ["admin"] };
    const { guard, ctx } = makeContext({ action: "read", subject: "Order" }, adminClaims);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("throws ForbiddenException when ability.can() returns false", () => {
    const viewerClaims: TokenClaims = { userId: "u1", roles: ["viewer"] };
    const { guard, ctx } = makeContext({ action: "delete", subject: "Order" }, viewerClaims);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("ForbiddenException carries the structured payload", () => {
    const viewerClaims: TokenClaims = { userId: "u1", roles: ["viewer"] };
    const { guard, ctx } = makeContext({ action: "delete", subject: "Order" }, viewerClaims);
    try {
      guard.canActivate(ctx);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: "forbidden",
        subject: "Order",
      });
    }
  });
});
