// Stub per ADR 0024. Implementation lands when first service consumes.
// See docs/adr/0024-structured-logging-contract.md for the full shape.

/**
 * Required fields on every log line per ADR 0024's table.
 * `trace_id` / `span_id` / `trace_flags` are injected by
 * `@opentelemetry/instrumentation-pino` inside an active span.
 * biome.jsonc disables useNamingConvention for shared/logger/ so OTel
 * spec snake_case names are allowed.
 */
export interface LogLine {
  err?: { message: string; stack?: string; type: string };
  event?: string;
  level: number;
  msg: string;
  "service.name": string;
  "service.version": string;
  severity: "DEBUG" | "ERROR" | "FATAL" | "INFO" | "TRACE" | "WARN";
  span_id?: string;
  time: number;
  trace_flags?: string;
  trace_id?: string;
}

/**
 * Base pino `LoggerOptions` shape — formatters, serialisers, LOG_LEVEL.
 * Services import and extend. Real impl wraps `pino` + `pino.stdSerializers.err`.
 */
export interface BaseLoggerOptions {
  formatters: { level: (label: string) => { level: string; severity: string } };
  level: string;
  serializers: Record<string, (err: unknown) => unknown>;
}
