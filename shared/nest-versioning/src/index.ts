// Stub per ADR 0033. Implementation lands when first service consumes.
// See docs/adr/0033-api-contracts-and-errors.md for the full contract.

/**
 * Decorator options for marking a route deprecated.
 * Real impl: a NestJS method/class decorator that attaches metadata read
 * by `DeprecationInterceptor`.
 */
export type DeprecatedOptions = {
  /** ISO date the deprecation was announced. */
  since: string;
  /** ISO date after which the route returns 410. */
  sunset: string;
  /** URL or route that replaces this one (sets `Link` header). */
  successor?: string;
};

/**
 * Interceptor signature. The real impl adds RFC 9745 `Deprecation`,
 * RFC 8594 `Sunset`, and `Link rel="successor-version"` headers
 * on every response from a `@Deprecated`-marked route. After the
 * sunset date, returns 410 + `code: 'route_sunset'`.
 */
export type DeprecationInterceptor = {
  intercept(context: unknown, next: unknown): unknown;
};
