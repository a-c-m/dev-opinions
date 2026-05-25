# @shared/nest-errors

`ApiException` + global exception filters (`AllExceptionsFilter` for REST, `GqlExceptionFilter` for GraphQL) per ADR 0033.

**Status:** stub. Interfaces live in `src/index.ts`; the real `ApiException extends IntrinsicException` class and both filters land when the first NestJS service consumes this package. The filters map `ApiException` → Problem Details body (REST) or `errors[].extensions` (GraphQL); `ZodError` → 422 with `errors[]`; unknown → 500 with `traceId`-correlated log line.

See [ADR 0033](../../docs/adr/0033-api-contracts-and-errors.md). 5xx `detail` is stripped to a generic message outside `APP_ENV=development`.
