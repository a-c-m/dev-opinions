// Stub per ADR 0031. Implementation lands when first service consumes.
// See docs/adr/0031-structured-logging-contract.md for the full shape.

/**
 * Required fields on every log line per ADR 0031's table.
 * `trace_id` / `span_id` / `trace_flags` are injected by
 * `@opentelemetry/instrumentation-pino` inside an active span.
 */
export type LogLine = {
  level: number;
  severity: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  time: number;
  msg: string;
  "service.name": string;
  "service.version": string;
  // OTel spec field names — snake_case to match what
  // @opentelemetry/instrumentation-pino emits. biome.jsonc disables
  // useNamingConvention for shared/logger/ to allow this.
  trace_id?: string;
  span_id?: string;
  trace_flags?: string;
  err?: { type: string; message: string; stack?: string };
  event?: string;
};

/**
 * Base pino `LoggerOptions` shape — formatters, serialisers, LOG_LEVEL.
 * Services import and extend. Real impl wraps `pino` + `pino.stdSerializers.err`.
 */
export type BaseLoggerOptions = {
  level: string;
  formatters: { level: (label: string) => { level: string; severity: string } };
  serializers: Record<string, (err: unknown) => unknown>;
};
