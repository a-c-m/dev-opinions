// Stub per ADR 0033. Implementation lands when first service consumes.
// See docs/adr/0033-api-contracts-and-errors.md for the full contract.

import type { ApiErrorCode } from "@shared/contracts";

/**
 * Options-bag for `ApiException`. The real class extends NestJS 11's
 * `IntrinsicException` (silences the auto-logger for expected 4xx).
 */
export type ApiExceptionOptions = {
  status: number;
  code: ApiErrorCode;
  title: string;
  detail?: string;
  errors?: Array<{ path: string; code: string; message: string }>;
};

/**
 * Throwable. Both filters (REST + GraphQL) catch it and emit the
 * Problem Details body / `errors[].extensions` payload respectively.
 *
 * Stub: declared as an interface here so the contract is visible;
 * real impl in the implementation PR extends `IntrinsicException`.
 */
export type ApiException = {
  readonly options: ApiExceptionOptions;
};

/**
 * Filter shapes. Real impls register via `APP_FILTER` providers and
 * carry the mapping logic for `ApiException` / `ZodError` / unknown.
 */
export type AllExceptionsFilter = {
  catch(exception: unknown, host: unknown): void;
};

export type GqlExceptionFilter = {
  catch(exception: unknown, host: unknown): unknown;
};
