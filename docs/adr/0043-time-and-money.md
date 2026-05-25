---
date: 2026-05-25
tags: [backend, frontend, time, money, precision, boundaries]
---

# ADR 0043: Time and money — UTC, minor units, never floats

## Context and Problem Statement

Two value types end up reinvented per-app, badly, every time: **time** (timezones, serialisation, calendar math) and **money** (precision, currency, formatting). Both are deceptively simple — until they aren't, at which point the fixes are expensive and the bugs are subtle.

They share a shape:

- A correct storage representation that's easy to get wrong.
- A canonical wire representation that JSON can't natively express well.
- A display-time concern that depends on locale, not on the data.
- A "don't roll your own" principle that newcomers reliably ignore.

One ADR covers both because the principle is the same: **store the canonical form, fail at the boundary, format at the edge.**

## Decision Outcome

### Time

**Storage — always `timestamptz` in Postgres.**

```ts
// shared/db-<domain>/schema.ts
import { timestamp } from 'drizzle-orm/pg-core';

createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
  .notNull()
  .defaultNow(),
```

- `withTimezone: true` is non-negotiable. Postgres `timestamp` (without TZ) silently drops the offset on insert — the field-of-landmines that produces "the timestamps were wrong after we migrated regions" outages.
- `mode: 'date'` returns `Date` objects in service code, not strings. The conversion-to-string happens at the wire layer, once, not per query.

**Wire — ISO 8601 with `Z` suffix.**

- REST and GraphQL `DateTime` scalars both serialise `Date` → ISO 8601 UTC string automatically.
- Zod ingress: `z.string().datetime({ offset: false })` validates inbound (per [ADR 0033](0033-api-contracts-and-errors.md)). Reject anything without the `Z` or with a local offset — the boundary is UTC.

**In memory — `Date` for now, `Temporal` when it lands.**

- Plain `Date` is fine for storage, equality, and arithmetic-by-millisecond.
- The `Temporal` API (Node 22 ships it under `--experimental-temporal`, browsers are catching up) supersedes `Date` for anything involving calendars, durations, or timezone-aware math. **Adopt it the moment it's stable in our Node minor; not before.**
- Until then: never do timezone math by hand. Convert to UTC at the boundary, work in UTC in memory, convert to local at the display edge.

**Calendar math — `date-fns` (or `Luxon`).**

- `date-fns` for tree-shakable, function-style operations (`addDays`, `differenceInBusinessDays`, `endOfMonth`, etc.). Pin exact per [ADR 0001](0001-package-manager.md).
- `Luxon` if a project leans heavily on rich `DateTime` objects with chained methods.
- **Never** `moment` (deprecated, mutable, fat). **Never** `dayjs` — it has had recurring timezone-correctness bugs and the maintenance posture is uneven.

**Display — `Intl.DateTimeFormat`, server-driven locale.**

- No formatting library at the display layer. `Intl.DateTimeFormat(locale, opts)` is free, locale-aware, and built in.
- Locale flows from request context (Accept-Language header server-side; navigator.language client-side, overridable by user preference).

**`shared/datetime/` — thin schema package**

A tiny shared package holds:

- The Zod schema (`isoDateTime`) used at all REST boundaries.
- A `formatForLog(d)` helper that's `Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' })`. Logs are always UTC.
- A `formatForUser(d, locale, tz)` helper that's the same shape but locale-and-tz-aware.

That's the entire surface. ~30 LOC. Don't grow it without a reason.

### Money

**Storage — `BIGINT` minor units + `CHAR(3)` ISO 4217 currency.**

```ts
// shared/db-<domain>/schema.ts
amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
currency: char('currency', { length: 3 }).$type<CurrencyCode>().notNull(),
```

- `BIGINT` (`int8`) holds up to ±9.2 × 10^18 minor units — every currency in every conceivable amount.
- `mode: 'bigint'` returns `bigint` in TS, not `string`. Working with strings for arithmetic is the bug we're avoiding.
- `currency` is `CHAR(3)` for the ISO 4217 code (`USD`, `EUR`, `JPY`). Constrained via a TS union type, not a DB enum (currencies don't get added often enough to justify migration friction).

**Why not `NUMERIC(N, M)`** — Drizzle returns it as a string. Every arithmetic operation requires a library to parse and re-stringify. The ergonomics rot. `BIGINT` minor units is exact, native, and idiomatic in TS for monetary work.

**Why not `number`** — `0.1 + 0.2 !== 0.3`. This is the final answer to every "why not just use number" conversation.

**In memory — `Money` value object in `@shared/money`.**

```ts
// shared/money/src/money.ts
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | /* … */;

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export const money = (amountMinor: bigint, currency: CurrencyCode): Money => ({
  amountMinor,
  currency,
});

export const add = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new ApiException('money.currency_mismatch', /* … */);
  }
  return money(a.amountMinor + b.amountMinor, a.currency);
};

// subtract, multiply (by integer scalar), negate, eq, gt, lt, isZero.
// No divide — that's where decimals enter; see graduation below.
```

- Cross-currency operations throw. There's no implicit FX.
- No `divide` operation in the core surface. Division of money creates fractional minor units (sub-cent), which is exactly the case that triggers graduation.

**Wire — `{ amountMinor: string, currency: 'USD' }`.**

JSON can't represent `bigint`. `JSON.stringify(1n)` throws. So at the boundary:

- Outbound: `bigint` → decimal-string. `'1000000'` not `1000000` (numbers > 2^53 lose precision in JS clients).
- Inbound: Zod schema validates the shape and coerces via `BigInt(value)`. Reject scientific notation and decimals.

The shared `@shared/money` package exports the Zod schema (`MoneySchema`) and the codec helpers (`toWire(money)`, `fromWire(json)`). Every REST/GraphQL boundary uses them — no per-feature reimplementation.

**Display — `Intl.NumberFormat`.**

```ts
const formatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: m.currency,
});

formatter.format(Number(m.amountMinor) / 100);  // for two-decimal currencies
```

The minor-unit divisor depends on currency exponent (JPY has 0 decimals, BHD has 3). A small map in `@shared/money` (`currencyExponent['JPY'] === 0`) handles this; `Intl.NumberFormat` does the rest.

**Graduation — `decimal.js`** when sub-cent math arrives (proportional discounts, tax proration, FX with mid-rates). The `Money` interface stays the same; the *internals* of `@shared/money` start carrying a `Decimal` alongside `amountMinor` for high-precision calculations, normalising back to `amountMinor` at the boundary. Don't reach for `Dinero.js` first — it's a lovely library but it's a dependency for what `BigInt` already does.

## Consequences

### Positive

- **Storage canonical forms are unambiguous.** `timestamptz` and `BIGINT amount_minor` are exact, performant, and resist drift.
- **Wire formats are JSON-friendly.** ISO 8601 strings + decimal strings for `bigint` — no custom serialisers per service.
- **One Zod schema per type.** `isoDateTime` and `MoneySchema` are imported from `@shared/datetime` and `@shared/money`; the same validator runs on every REST boundary.
- **Display concerns are decoupled.** Locale + currency live in the formatter call, not in the storage layer. The same `Money` displays as `$1,234.56`, `1.234,56 €`, or `¥123,456` depending on locale.
- **Graduation is in-place.** `decimal.js` and `Temporal` slot into `@shared/*` packages without changing the surface visible to consumers.

### Negative

- **`bigint` JSON serialisation is manual.** `JSON.stringify(money)` won't work by default; consumers must use the codec helpers. Mitigation: the helpers are the boundary contract — if you're hand-stringifying money, you're doing it wrong.
- **`Date` vs `Temporal` is a known migration ahead.** When `Temporal` stabilises, every `Date` in service code becomes a candidate for replacement. The schema package abstracts most of it.
- **Currency exponent map needs maintenance** when new currencies appear. Rare event; lives in one place.

### Neutral

- **No global date library.** `date-fns` is the recommendation but not a hard rule; a project that only uses `Intl.DateTimeFormat` adds nothing.
- **`bigint` precision is overkill for almost all amounts.** That's fine — it's free, and it's correct for the cases that aren't.

## Alternatives considered

1. **`Date` stored as `timestamp` (without TZ) + a separate `timezone` column** — works but loads complexity onto every read. `timestamptz` is the standard answer; the rare "I need the original wall-clock time" case is solved by storing both, not by demoting the canonical column. Rejected.
2. **`NUMERIC(20, 4)` for money** — handles sub-cent natively, no codec dance. But Drizzle returns it as a string, every arithmetic op needs a library, and you're doing the same work `BigInt` already does for free. Rejected as default; reachable via `decimal.js` graduation if needed.
3. **`Dinero.js` as the in-memory representation** — well-designed, immutable, expressive. Adds a dep for what `BigInt` does natively at this level of math. Rejected; revisit when sub-cent precision becomes routine.
4. **`dayjs`** — small footprint, moment-compatible API. Repeatedly flagged for timezone correctness bugs. Rejected.
5. **GraphQL `BigInt` scalar instead of string-encoded money** — works in GraphQL-land but breaks REST and external consumers (most clients don't know what to do with a BigInt scalar). String at the wire is the lowest common denominator. Rejected.

## Related

- [ADR 0012](0012-drizzle-orm.md) — Drizzle column types (`timestamp({ withTimezone: true })`, `bigint({ mode: 'bigint' })`).
- [ADR 0033](0033-api-contracts-and-errors.md) — Zod schemas at REST boundaries; `MoneySchema` and `isoDateTime` are imported from `@shared/*`.
- [ADR 0034](0034-secrets-runtime-injection.md) — currencies have no secrets; locale + timezone are not configuration.
- [ECMA-402 Intl](https://tc39.es/ecma402/) — `Intl.DateTimeFormat` and `Intl.NumberFormat` are the only formatters we need.
- [TC39 Temporal proposal](https://tc39.es/proposal-temporal/) — the named successor to `Date` for calendar math.
- [Postgres `timestamptz` docs](https://www.postgresql.org/docs/current/datatype-datetime.html) — what we're storing and why.
- [ISO 4217 currency codes](https://www.iso.org/iso-4217-currency-codes.html) — the source for `CurrencyCode`.
