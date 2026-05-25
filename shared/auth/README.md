# @shared/auth

Vendor-agnostic `AuthProvider` interface + `AuthOutcome` union + minimal `TokenClaims` per ADR 0027.

**Status:** stub. Interface and types live in `src/index.ts`. Three concrete implementations (`OidcAuthProvider` via `jose`, `ManagedIdpAuthProvider`, `DevAuthProvider`) land when the first NestJS service consumes. `DevAuthProvider` is refused at construction under `NODE_ENV=production` unless `auth.allowDevInProduction: true` per [ADR 0016](../../docs/adr/0016-backend-config.md).

JWT hardening defaults (per ADR 0027): algorithm allow-list `['RS256','ES256','PS256']`; `clockTolerance: 30s`; issuer + audience pinned from config. Never HS256 across services.

Session model per ADR 0027: BFF cookie default with Postgres-backed sessions (no Redis dependency); Bearer JWT graduation for cross-domain / mobile / S2S. `AuthProvider.authenticate(req)` signature stays identical across both — the cookie-vs-header extraction lives in the provider impl.
