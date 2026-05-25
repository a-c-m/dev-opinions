// `@CheckAbility(action, subject)` — metadata decorator per ADR 0038.
// Reflector-based: `AuthzGuard` reads the metadata at request time and
// runs `ability.can(action, subject)` against the factory output.

import { SetMetadata } from "@nestjs/common";
import type { Action, CheckAbilityMetadata, Subject } from "./types.ts";

export const CHECK_ABILITY_METADATA_KEY = "shared.authz.check-ability";

export const CheckAbility = (action: Action, subject: Subject) =>
  SetMetadata<string, CheckAbilityMetadata>(CHECK_ABILITY_METADATA_KEY, {
    action,
    subject,
  });
