// Stub per ADR 0033. Implementation lands when first service consumes.
// See docs/adr/0033-api-contracts-and-errors.md for the full contract.

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
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "rate_limit_exceeded"
  | "route_sunset"
  | "internal_error";

/**
 * RFC 9457 Problem Details with `code` / `traceId` / `errors[]` extensions
 * per ADR 0033. The real Zod schema lands when first service consumes;
 * this type describes the wire shape.
 */
export type ApiError = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: ApiErrorCode;
  traceId: string;
  errors?: Array<{ path: string; code: string; message: string }>;
};
