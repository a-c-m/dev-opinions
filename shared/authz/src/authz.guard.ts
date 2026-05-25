// AuthzGuard — route-boundary role check per ADR 0028's two-layer
// enforcement. Reads `@CheckAbility(action, subject)` metadata,
// builds an Ability via the factory, runs `ability.can()` against
// the *subject class* (no DB fetch). Service layer does per-object
// checks separately — both are mandatory.

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { TokenClaims } from "@shared/auth";
import { CHECK_ABILITY_METADATA_KEY } from "./check-ability.decorator.ts";
import type { AbilityFactory, CheckAbilityMetadata } from "./types.ts";

export const ABILITY_FACTORY = Symbol("shared.authz.AbilityFactory");

/**
 * Pulls `TokenClaims` from the request. Forks wire this by setting
 * `request.user = claims` in their auth middleware/interceptor (per
 * ADR 0027). Returns null when no claims are attached.
 */
const claimsFromRequest = (req: { user?: TokenClaims }): TokenClaims | null => req.user ?? null;

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ABILITY_FACTORY) private readonly abilityFactory: AbilityFactory
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<CheckAbilityMetadata | undefined>(
      CHECK_ABILITY_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!meta) {
      // No `@CheckAbility` on the route — guard is a no-op pass.
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: TokenClaims }>();
    const claims = claimsFromRequest(req);
    if (!claims) {
      throw new UnauthorizedException({ code: "unauthorized" });
    }

    const ability = this.abilityFactory.createForUser(claims);
    if (!ability.can(meta.action, meta.subject)) {
      throw new ForbiddenException({
        code: "forbidden",
        subject: meta.subject,
      });
    }
    return true;
  }
}
