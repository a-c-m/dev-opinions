// Type surface for @shared/authz per ADR 0028.
// Members alphabetised per ultracite useSortedInterfaceMembers.

import type { MongoAbility } from "@casl/ability";
import type { TokenClaims } from "@shared/auth";

/**
 * CRUD-shaped action vocabulary. Real impls (forks) extend with
 * custom actions (`approve`, `archive`, etc.) by widening the union.
 */
export type Action = "create" | "delete" | "manage" | "read" | "update";

/**
 * Subject discriminator. Forks narrow to the union of their
 * `@ObjectType` class names. Stub leaves it open as `string` so the
 * factory works without per-domain typing.
 */
export type Subject = string;

/**
 * `AppAbility` is a thin alias over CASL's `MongoAbility`. Forks
 * narrow this with their own Action/Subject unions.
 */
export type AppAbility = MongoAbility<[Action, Subject]>;

/**
 * Factory contract. The default impl in `ability.factory.ts` returns
 * a fresh `AppAbility` per request. Forks add domain-specific rules
 * by extending the default factory.
 */
export interface AbilityFactory {
  createForUser(claims: TokenClaims): AppAbility;
}

/**
 * `@CheckAbility(action, subject)` metadata read by `AuthzGuard`.
 */
export interface CheckAbilityMetadata {
  action: Action;
  subject: Subject;
}

/**
 * Audit event emitted around every `ability.can()` decision in
 * services. Real impl writes to a Drizzle `audit_log` table; the
 * no-op default discards.
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
