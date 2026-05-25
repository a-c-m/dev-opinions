# @shared/contracts

Cross-surface contracts: `ApiErrorCode` union and `ApiError` Problem Details shape.

**Status:** stub. The TS surface lives in `src/index.ts`; the actual Zod schema for `ApiError` (used by the React fetcher to `safeParse` non-2xx responses) and the per-domain code extensions land alongside the first feature module. Per-domain contracts go in `shared/contracts/<domain>/` (`*.input.ts`, `*.types.ts`, etc.) per the four-layer pattern.

See [ADR 0033](../../docs/adr/0033-api-contracts-and-errors.md) for the full composition pattern and [ADR 0012](../../docs/adr/0012-drizzle-orm.md) for the vocabulary-tuple convention shared schemas use.
