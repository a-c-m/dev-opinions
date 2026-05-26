export interface ServiceMeta {
  name: string;
  version: string;
}

/**
 * Per-ADR-0024 valid pino levels. `silent` disables the logger entirely.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/**
 * Caller-supplied logger config. Kept narrow on purpose — anything broader
 * belongs in `nestjs-pino` `Params` overrides on `platformLoggerModule`,
 * not in the base options contract.
 */
export interface LoggerConfig {
  level?: LogLevel;
}
