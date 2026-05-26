import { type LoggerOptions, stdSerializers, stdTimeFunctions } from "pino";
import type { LoggerConfig, ServiceMeta } from "./types.ts";

// OTel SeverityText mapping per ADR 0024's required-fields table. Pino's
// numeric levels are the canonical wire shape; `severity` is the human/
// agent-readable mirror that downstream log backends key on.
const SEVERITY_BY_PINO_LEVEL: Record<number, string> = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

const DEFAULT_LEVEL = "info";

/**
 * Base pino LoggerOptions per ADR 0024. Services consume this directly or
 * via `platformLoggerModule` in `./nest.module.ts`.
 *
 * Commits to:
 * - `severity` mirror of numeric `level` (OTel SeverityText).
 * - `service.name` + `service.version` base bindings on every line.
 * - `err` serializer via `pino.stdSerializers.err` (type/message/stack).
 * - `level` injected by the caller (default "info"). Per ADR 0016/0017,
 *   shared libs do not read `process.env` — the host service validates
 *   `LOG_LEVEL` via its env schema and threads it through here.
 *
 * NOT here: `trace_id` / `span_id` / `trace_flags` — those arrive via
 * `@opentelemetry/instrumentation-pino` (ADR 0025) which patches the live
 * logger inside an active span. Setting them statically would override
 * OTel's injection.
 */
export const baseLoggerOptions = (meta: ServiceMeta, config: LoggerConfig = {}): LoggerOptions => ({
  base: {
    "service.name": meta.name,
    "service.version": meta.version,
  },
  formatters: {
    level: (label, number) => ({
      level: number,
      severity: SEVERITY_BY_PINO_LEVEL[number] ?? label.toUpperCase(),
    }),
  },
  level: config.level ?? DEFAULT_LEVEL,
  serializers: {
    err: stdSerializers.err,
  },
  timestamp: stdTimeFunctions.epochTime,
});
