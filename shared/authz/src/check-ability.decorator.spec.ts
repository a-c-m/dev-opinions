// Unit tests for @CheckAbility — verifies metadata key + payload
// attached by the decorator.

import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { CHECK_ABILITY_METADATA_KEY, CheckAbility } from "./check-ability.decorator.ts";

const reflector = new Reflector();

describe("CheckAbility", () => {
  it("attaches the metadata key and payload to the decorated method", () => {
    class Target {
      @CheckAbility("update", "Order")
      handler(): void {
        // empty handler stub for decorator test
      }
    }
    const meta = reflector.get(CHECK_ABILITY_METADATA_KEY, Target.prototype.handler);
    expect(meta).toEqual({ action: "update", subject: "Order" });
  });

  it("attaches different actions independently", () => {
    class Target {
      @CheckAbility("read", "Audit")
      read(): void {
        // empty
      }
      @CheckAbility("delete", "Audit")
      remove(): void {
        // empty
      }
    }
    expect(reflector.get(CHECK_ABILITY_METADATA_KEY, Target.prototype.read)).toEqual({
      action: "read",
      subject: "Audit",
    });
    expect(reflector.get(CHECK_ABILITY_METADATA_KEY, Target.prototype.remove)).toEqual({
      action: "delete",
      subject: "Audit",
    });
  });
});
