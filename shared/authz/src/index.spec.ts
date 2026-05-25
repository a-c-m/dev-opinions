// Unit test for createDefaultAbilityFactory — the convenience builder.

import { describe, expect, it } from "vitest";
import { createDefaultAbilityFactory, DefaultAbilityFactory } from "./index.ts";

describe("createDefaultAbilityFactory", () => {
  it("returns a DefaultAbilityFactory instance", () => {
    expect(createDefaultAbilityFactory()).toBeInstanceOf(DefaultAbilityFactory);
  });
});
