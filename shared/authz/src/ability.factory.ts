// Default AbilityFactory per ADR 0038. ~40 LOC hand-rolled — no
// `nest-casl` wrapper (supply-chain minimisation). Forks extend by
// subclassing `DefaultAbilityFactory` and overriding `defineRulesFor`
// to add domain-specific RBAC + ABAC conditions.

import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { TokenClaims } from "@shared/auth";
import type { AbilityFactory, AppAbility, Subject } from "./types.ts";

const ADMIN_ROLE = "admin";

/**
 * Default factory: admin can manage everything; everyone else has no
 * default permissions. Forks override `defineRulesFor` to add
 * domain rules (e.g. `can('read', 'Order', { ownerId: claims.userId })`).
 */
export class DefaultAbilityFactory implements AbilityFactory {
  createForUser(claims: TokenClaims): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    this.defineRulesFor(claims, builder);
    return builder.build();
  }

  /**
   * Override in fork-specific subclasses to add rules.
   * Default applies the admin-manage-all baseline only.
   */
  protected defineRulesFor(claims: TokenClaims, builder: AbilityBuilder<AppAbility>): void {
    if (claims.roles.includes(ADMIN_ROLE)) {
      builder.can("manage", "all" as Subject);
    }
  }
}
