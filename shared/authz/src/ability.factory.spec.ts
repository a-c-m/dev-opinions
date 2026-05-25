// Unit tests for DefaultAbilityFactory — admin gets manage-all,
// everyone else has no default permissions.

import type { TokenClaims } from "@shared/auth";
import { describe, expect, it } from "vitest";
import { DefaultAbilityFactory } from "./ability.factory.ts";

const factory = new DefaultAbilityFactory();

describe("DefaultAbilityFactory", () => {
  it("grants manage-all to users with the admin role", () => {
    const claims: TokenClaims = { userId: "u1", roles: ["admin"] };
    const ability = factory.createForUser(claims);
    expect(ability.can("manage", "Order")).toBe(true);
    expect(ability.can("create", "AnythingElse")).toBe(true);
    expect(ability.can("delete", "User")).toBe(true);
  });

  it("denies everything for users without admin role", () => {
    const claims: TokenClaims = { userId: "u1", roles: ["viewer"] };
    const ability = factory.createForUser(claims);
    expect(ability.can("read", "Order")).toBe(false);
    expect(ability.can("update", "Order")).toBe(false);
  });

  it("denies everything for users with no roles", () => {
    const claims: TokenClaims = { userId: "u1", roles: [] };
    const ability = factory.createForUser(claims);
    expect(ability.can("read", "Order")).toBe(false);
  });

  it("treats admin as one role among many", () => {
    const claims: TokenClaims = { userId: "u1", roles: ["viewer", "admin"] };
    const ability = factory.createForUser(claims);
    expect(ability.can("manage", "Anything")).toBe(true);
  });
});
