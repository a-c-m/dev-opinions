---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0037: Authentication

## Context and Problem Statement

Every service needs to know who's making the request. Without
a convention forks reinvent: ad-hoc JWT parsing, inconsistent
Passport strategies, tokens in `localStorage`, bespoke session
schemes. Getting it wrong = total account compromise.

This ADR settles the architectural shape (interface, verification,
session vs token, claims) without prescribing a vendor. The
 Auth ADR is the empirical reference.

Authorization (can-this-user-do-X), service-to-service auth,
and staff impersonation are **out of scope**.

## Decision Outcome

### `AuthProvider` interface — vendor-agnostic seam

`shared/auth/` exports a single interface that every service
consumes via DI:

```typescript
type AuthProvider = {
  authenticate(req: AuthRequest): Promise<AuthOutcome>;
};

type AuthOutcome =
  | { kind: 'authenticated'; claims: TokenClaims }
  | { kind: 'unauthenticated' }            // no credentials presented
  | { kind: 'failed'; error: AuthError };  // credentials presented, verify failed

type TokenClaims = {
  userId: string;
  roles: string[];
};

type AuthError = {
  code: 'expired' | 'invalid_signature' | 'wrong_issuer'
      | 'wrong_audience' | 'malformed_claims';
  message: string;
};
```

The provider returns the outcome; it does not throw on bad
credentials. Guards consume the outcome directly. Throwing
would conflate "no credentials presented" with "verification
failed" — see below.

`TokenClaims` is deliberately minimal — only what every fork
needs. Forks adding multi-tenancy widen with `tenantId` /
`clientId` / similar in their own `shared/auth/` extension;
not a default assumption.

Three implementations:

- **`OidcAuthProvider`** — generic OIDC via `jose` against any
  spec-compliant IdP (Better Auth, WorkOS, Logto, customer
  Auth0/Okta). Production canonical.
- **`ManagedIdpAuthProvider`** — thin vendor adapter when a
  fork picks one.
- **`DevAuthProvider`** — header shim for local dev. Refused
  at construction under `NODE_ENV=production` unless
  `auth.allowDevInProduction: true`. Visible warning at boot
  in any env.

Selection is config-driven per [ADR 0015](0015-backend-config.md):

```yaml
auth:
  provider: oidc | managed | dev
  jwksUrl: https://...
  issuer: https://...
  audience: <service-name>
  algorithms: ['RS256', 'ES256', 'PS256']  # defaults
  clockToleranceSec: 30                     # default
  allowDevInProduction: false               # default
```

No `process.env` reading in app code.

### `AuthOutcome` — never conflate "missing" with "bad"

The three states above (`authenticated` / `unauthenticated` /
`failed`) are the load-bearing distinction. Public routes pass
on `unauthenticated`; `failed` must always reject with 401.

**Conflating the two turns every public route into a token
bypass** — the foot-gun caught by the  security review.
Adopted verbatim.

### JWT verification — hardening defaults

`OidcAuthProvider` passes these to `jose.jwtVerify`:

- **`algorithms` allow-list** — `['RS256', 'ES256', 'PS256']`.
  Blocks "alg confusion at JWKS level"; never HS256 across
  service boundaries (shared HMAC = any consumer can forge).
- **`clockTolerance: 30s`** — tolerates IdP/service drift.
- **`issuer` + `audience`** — pinned from config; per-service
  `audience` prevents service A's token being replayed at B.

`jose` defaults already block `alg: none` and HMAC-vs-asymmetric
confusion; the allow-list is belt-and-braces.

### Session model — BFF cookie default, Bearer JWT graduation

Two shapes are documented; the default is BFF cookie because
the typical base-app fork is same-site SPA + API.

**Default — BFF cookie session, Postgres-backed.**

| Aspect | Detail |
|---|---|
| Credential | Opaque session ID in HttpOnly, Secure, SameSite=Lax cookie |
| Server validates by | `SELECT … FROM sessions WHERE id = ?` (drizzle, indexed PK) |
| Storage | Postgres `sessions` table — same DB as the rest of the app, no Redis |
| CSRF | Double-submit token (non-HttpOnly `csrf` cookie + `X-CSRF-Token` header on writes) |
| Logout | `DELETE FROM sessions WHERE id = ?` — instant revoke |
| Expiry | 30-day default; rolling refresh on activity |

Postgres over Redis because base-app already requires Postgres
([ADR 0012](0012-drizzle-orm.md)) and the indexed session
lookup is ~1ms p99 — fine for typical fork RPS. Migrating to
Redis later is impl-only; the interface doesn't change.

**Graduation — Bearer JWT in memory.**

When a fork adds cross-domain consumers (multi-product on
different domains, native mobile, partner APIs, service-to-service):

| Aspect | Detail |
|---|---|
| Credential | Short-lived JWT (≤15min) in SPA JS memory |
| Refresh | Rotating refresh token in HttpOnly cookie; ≤24h TTL |
| Server validates by | `jose.jwtVerify` against JWKS — no DB I/O |
| Signing | RS256 or ES256 against a JWKS endpoint; never HS256 |
| Revocation | Short access TTL is the revocation window; refresh-token rotation with replay detection |
| Storage | Memory only — *never* `localStorage` or `sessionStorage` (OWASP-explicit) |

`AuthProvider.authenticate(req)` stays identical across both;
the cookie-vs-`Authorization`-header extraction lives in the
provider impl.

**Anti-patterns (do not):** `localStorage` tokens (XSS =
account takeover); HS256 across services; long-lived JWTs
without rotation; skip PKCE on OAuth flows (RFC 9700); roll
your own password hashing (use `argon2`) or token signing (use
`jose`); call a header-forwarding reverse proxy a "BFF" (tokens
still reach the browser).

### Entitlements are NOT on the token

Tokens carry identity (`userId`, `roles`) only. Plan / feature
entitlements live behind a separate `EntitlementResolver`
seam, resolved per-request. This avoids the "re-issue tokens
to change plan" pain. Aligns with [ADR 0035](0035-feature-flags.md)'s
flags-as-config-not-token pattern.

### OIDC client — `openid-client` (panva)

`openid-client` directly for OAuth2/OIDC flows — OpenID-certified
for FAPI 1.0/2.0, most spec-correct Node client. Not
`@nestjs/passport` (the abstraction is `AuthProvider`; Passport's
strategy/guard indirection is extra ceremony). Passport stays
as a documented alternative for forks invested in it.

### Vendor ladder — defer the pick

| Rung | When |
|---|---|
| **`DevAuthProvider`** | Day one, local + tests |
| **Better Auth (self-hosted)** | Greenfield fork wants email/social/passkeys/orgs batteries-included (MIT; absorbed Auth.js Sep 2025) |
| **WorkOS** (managed, **named default**) | First enterprise SAML / SCIM ask — best DX for SAML + Directory Sync |
| **Logto Cloud** (managed alt) | Cheaper if WorkOS-level SAML DX isn't needed (OSS-backed self-host fallback) |
| **Keycloak / Zitadel** (self-host) | Need SAML + ops capacity to run it (Zitadel lighter, Keycloak more featureful) |

Auth.js / NextAuth is off the ladder — Next.js-shaped only.

### What this defers

- **Authorization** (RBAC/ABAC, CASL, OPA) — authn ≠ authz
- **Service-to-service auth** — mTLS / OIDC client-credentials
- **Staff impersonation** via RFC 8693 token exchange
- **SCIM / Directory Sync** — first enterprise customer ask
- **Multi-tenancy claims** — forks extend `TokenClaims` in their
  own `shared/auth/` extension; not a default

## Consequences

### Positive

- **Vendor swap is a code change.** `AuthProvider` is the
  only contact point.
- **`AuthOutcome` prevents public-route bypass.** Guards
  can't pass on bad tokens.
- **JWT hardening is first-class**, not per-service buried.
- **No Redis dependency in defaults.**
- **`DevAuthProvider` refused in prod** — same structural
  control as ADR 0034's posture.

### Negative

- **~150 LOC abstraction to maintain** in `shared/auth/`.
- **Postgres session lookup per request** — ~1ms p99; Redis
  is the high-RPS graduation.
- **CSRF double-submit token** is one more thing for SPAs
  on writes.
- **OAuth flow code lives in `shared/auth/`** — first fork
  writes it; subsequent forks inherit.

### Neutral

- Better Auth and WorkOS *advised*, not prescribed.
- Multi-tenancy is a fork extension.
- `@nestjs/passport` available; not default.

## Alternatives considered

1. **`@nestjs/passport` + `passport-jwt` default** — guards/strategies
   add indirection on top of `AuthProvider`. Stays available, not default.
2. **Better Auth as default** — batteries-included, but bundles UI
   flow assumptions (passkeys, magic links) not every fork needs.
   Named as first ladder rung.
3. **Bearer JWT default for all SPAs** — cleaner cross-domain, loses
   the XSS-immune cookie property. Default fork is same-site; BFF wins.
4. **Redis sessions default** — adds infra not otherwise required.
   Postgres is ~1ms p99; impl-only migration when needed.
5. **Entitlements on token** — locks plan changes behind re-issue;
   wrong for SaaS tier changes mid-session.
6. **Auth.js / NextAuth v5** — Next.js-shaped; `@auth/express` is
   a thin wrapper not idiomatic NestJS.
7. **Lucia** — deprecated by author March 2025.
8. **No abstraction, vendor SDK in controllers** — locks the fork
   to one vendor; cost of the interface is one file.

## Relationship to prior ADRs

- **References [0010](0010-nestjs-backend.md)** — NestJS DI
  consumes `AuthProvider`
- **References [0011](0011-frontend-frameworks.md)** — React
  SPA holds session cookie (default) or JWT in memory
  (graduation)
- **References [0012](0012-drizzle-orm.md)** — Postgres
  `sessions` table for BFF; same Drizzle pattern as everything
  else
- **References [0015](0015-backend-config.md)** — `auth.*`
  config schema; JWKS URL / issuer / audience as `file()`;
  any signing keys as `secret()`
- **References [0033](0033-api-contracts-and-errors.md)** —
  401 emits Problem Details with `code: 'unauthorized'`;
  403 with `code: 'forbidden'`
- **References [0034](0034-secrets-runtime-injection.md)** —
  vendor API keys (WorkOS, etc.) flow via the entrypoint shim
- **References [0035](0035-feature-flags.md)** — same
  off-token resolver pattern for entitlements

## References

- [ ADR 0028 — Auth architecture](../../..//docs/adr/0028-auth-architecture.md)
  (the empirical reference)
- [`jose`](https://github.com/panva/jose) — JWT verification
- [`openid-client`](https://github.com/panva/node-openid-client) — OIDC client (panva, OpenID-certified)
- [Better Auth](https://github.com/better-auth/better-auth)
- [WorkOS](https://workos.com) — managed IdP, named default
- [`draft-ietf-oauth-browser-based-apps-26`](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/) — BFF most-secure for SPAs
- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [RFC 8693 — Token Exchange](https://www.rfc-editor.org/rfc/rfc8693) — named for future impersonation graduation
