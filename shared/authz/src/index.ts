// @shared/authz — authorization seam per ADR 0038. Two-layer enforcement.
// See docs/adr/0038-authorization.md.

import { DefaultAbilityFactory } from "./ability.factory.ts";
import type { AbilityFactory } from "./types.ts";

export { DefaultAbilityFactory } from "./ability.factory.ts";
export { AUDIT_SERVICE, NoopAuditService } from "./audit.service.ts";
export { ABILITY_FACTORY, AuthzGuard } from "./authz.guard.ts";
export { AuthzModule } from "./authz.module.ts";
export { CHECK_ABILITY_METADATA_KEY, CheckAbility } from "./check-ability.decorator.ts";
export type {
  AbilityFactory,
  Action,
  AppAbility,
  AuditEvent,
  AuditService,
  CheckAbilityMetadata,
  Subject,
} from "./types.ts";

export function createDefaultAbilityFactory(): AbilityFactory {
  return new DefaultAbilityFactory();
}
