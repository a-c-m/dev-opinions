import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  const controller = new HealthController();

  it("returns status ok", () => {
    expect(controller.check().status).toBe("ok");
  });

  it("returns a non-negative uptime", () => {
    expect(controller.check().uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
