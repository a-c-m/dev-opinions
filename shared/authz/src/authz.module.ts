// AuthzModule — NestJS DI wiring per ADR 0038. Forks override the
// `AbilityFactory` provider with their own subclass; the no-op
// `AuditService` is replaced when a concrete audit impl lands.

import { Module } from "@nestjs/common";
import { DefaultAbilityFactory } from "./ability.factory.ts";
import { AUDIT_SERVICE, NoopAuditService } from "./audit.service.ts";
import { ABILITY_FACTORY, AuthzGuard } from "./authz.guard.ts";

@Module({
  providers: [
    { provide: ABILITY_FACTORY, useClass: DefaultAbilityFactory },
    { provide: AUDIT_SERVICE, useClass: NoopAuditService },
    AuthzGuard,
  ],
  exports: [ABILITY_FACTORY, AUDIT_SERVICE, AuthzGuard],
})
export class AuthzModule {}
