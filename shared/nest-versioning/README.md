# @shared/nest-versioning

`@Deprecated()` decorator + `DeprecationInterceptor` for REST route lifecycle per ADR 0019.

**Status:** stub. Decorator and interceptor signatures live in `src/index.ts`; the real impl reads decorator metadata and emits `Deprecation` (RFC 9745, Unix-ts) + `Sunset` (RFC 8594, HTTP-date) + `Link rel="successor-version"` headers on every response from a marked route. After sunset, returns 410 with `code: 'route_sunset'`.

Sunset windows per ADR 0019: public APIs 6 months minimum, internal-only 2 months minimum.

GraphQL uses the SDL `@deprecated(reason)` directive instead — not in scope for this package.
