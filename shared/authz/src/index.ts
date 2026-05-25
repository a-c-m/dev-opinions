// Stub per ADR 0038. Implementation lands when first service consumes.
// See docs/adr/0038-authorization.md for the full contract.

import type { TokenClaims } from "@shared/auth";

/**
 * CRUD-shaped action vocabulary. Real impl uses CASL's action union;
 * forks extend with custom actions (`approve`, `archive`, etc.).
 */
export type Action = "create" | "delete" | "manage" | "read" | "update";

/**
 * Subject discriminator. Real impl is the union of all `@ObjectType`
 * class names. Stub is open-ended `string` until a fork populates.
 */
export type Subject = string;

/**
 * `AppAbility` is the type alias forks narrow once they wire CASL.
 * Stub keeps it loose for the typecheck.
 */
export interface AppAbility {
  can(action: Action, subject: Subject | object): boolean;
  cannot(action: Action, subject: Subject | object): boolean;
}

/**
 * Hand-rolled factory per ADR 0038 — no `nest-casl` wrapper.
 * Real impl: ~40 LOC of `AbilityBuilder` rules + tests.
 */
export interface AbilityFactory {
  createForUser(claims: TokenClaims): AppAbility;
}

/**
 * `@CheckAbility(action, subject)` metadata read by `AuthzGuard`.
 * Real impl: `Reflector.createDecorator()` factory.
 */
export interface CheckAbilityMetadata {
  action: Action;
  subject: Subject;
}

/**
 * Audit event shape per ADR 0038. The `AuditService` interface ships
 * with a no-op default in the impl PR; concrete Drizzle-backed impl
 * + `audit_log` table land when first compliance ask arrives.
 */
export interface AuditEvent {
  action: Action;
  at: Date;
  outcome: "allowed" | "denied";
  reason?: string;
  subjectId: string | null;
  subjectType: Subject;
  userId: string;
}

export interface AuditService {
  emit(event: AuditEvent): Promise<void>;
}
