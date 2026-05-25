# @shared/logger

Base pino `LoggerOptions` per the structured logging contract.

**Status:** stub. The interface lives in `src/index.ts`; the actual `pino` config (level formatter, `severity` mirror, `err` serialiser, `LOG_LEVEL` env binding) lands when the first service consumes this package.

See [ADR 0031](../../docs/adr/0031-structured-logging-contract.md). Production routing is per [ADR 0032](../../docs/adr/0032-runtime-observability.md) — this package never imports a pino transport.
