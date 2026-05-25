// Stub per ADR 0033. Implementation lands when first service consumes.
// See docs/adr/0033-api-contracts-and-errors.md for the full contract.

import type { ApiErrorCode } from "@shared/contracts";

/**
 * Options-bag for `ApiException`. The real class extends NestJS 11's
 * `IntrinsicException` (silences the auto-logger for expected 4xx).
 */
export interface ApiExceptionOptions {
  code: ApiErrorCode;
  detail?: string;
  errors?: Array<{ code: string; message: string; path: string }>;
  status: number;
  title: string;
}

/**
 * Throwable. Both filters (REST + GraphQL) catch it and emit the
 * Problem Details body / `errors[].extensions` payload respectively.
 *
 * Stub: declared as an interface here so the contract is visible;
 * real impl in the implementation PR extends `IntrinsicException`.
 */
export interface ApiException {
  readonly options: ApiExceptionOptions;
}

/**
 * Filter shapes. Real impls register via `APP_FILTER` providers and
 * carry the mapping logic for `ApiException` / `ZodError` / unknown.
 */
export interface AllExceptionsFilter {
  catch(exception: unknown, host: unknown): void;
}

export interface GqlExceptionFilter {
  catch(exception: unknown, host: unknown): unknown;
}
