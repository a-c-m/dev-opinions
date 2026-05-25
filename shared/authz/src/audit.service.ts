// AuditService — no-op default per ADR 0028. The seam is mandatory
// (service code calls it after every `ability.can()` decision); the
// real Drizzle-backed impl + `audit_log` table land when the first
// SOC 2 / ISO 27001 / PCI ask arrives.

import { Injectable } from "@nestjs/common";
import type { AuditEvent, AuditService } from "./types.ts";

export const AUDIT_SERVICE = Symbol("shared.authz.AuditService");

@Injectable()
export class NoopAuditService implements AuditService {
  emit(_event: AuditEvent): Promise<void> {
    // Default: discard. Forks register a concrete impl via DI to
    // route events to a database / SIEM.
    return Promise.resolve();
  }
}
