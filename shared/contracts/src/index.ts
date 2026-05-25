// Stub per ADR 0019. Implementation lands when first service consumes.
// See docs/adr/0019-api-contracts-and-errors.md for the full contract.

/**
 * Closed set of error codes across REST and GraphQL surfaces.
 * Adding a code = one PR adding to the union.
 * `pnpm typecheck` rejects unknown codes on both server and client.
 *
 * Cross-cutting codes only at the stub stage; per-domain codes
 * (`orders_not_found`, `payments_card_declined`, …) added by the
 * owning feature module.
 */
export type ApiErrorCode =
  | "forbidden"
  | "internal_error"
  | "rate_limit_exceeded"
  | "route_sunset"
  | "unauthorized"
  | "validation_failed";

/**
 * RFC 9457 Problem Details with `code` / `traceId` / `errors[]` extensions
 * per ADR 0019. The real Zod schema lands when first service consumes;
 * this type describes the wire shape.
 */
export interface ApiError {
  code: ApiErrorCode;
  detail: string;
  errors?: Array<{ code: string; message: string; path: string }>;
  instance?: string;
  status: number;
  title: string;
  traceId: string;
  type: string;
}
