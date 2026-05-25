// Unit tests for NoopAuditService — verifies emit() resolves
// without side effects.

import { describe, expect, it } from "vitest";
import { NoopAuditService } from "./audit.service.ts";
import type { AuditEvent } from "./types.ts";

describe("NoopAuditService", () => {
  it("resolves emit() to undefined without throwing", async () => {
    const svc = new NoopAuditService();
    const event: AuditEvent = {
      action: "read",
      at: new Date("2026-01-01T00:00:00Z"),
      outcome: "allowed",
      subjectId: "ord_123",
      subjectType: "Order",
      userId: "u1",
    };
    await expect(svc.emit(event)).resolves.toBeUndefined();
  });
});
