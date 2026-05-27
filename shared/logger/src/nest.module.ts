import { type DynamicModule, Module } from "@nestjs/common";
import { LoggerModule, type Params } from "nestjs-pino";
import { type DestinationStream, type Logger as PinoLogger, pino } from "pino";
import { baseLoggerOptions } from "./base-options.ts";
import type { LoggerConfig, ServiceMeta } from "./types.ts";

/**
 * Constructs the pino instance that nestjs-pino will use as both the
 * framework logger (boot, lifecycle, scheduled, ad-hoc injections) AND
 * the parent of per-request HTTP child loggers. Exported separately so
 * the same construction can be exercised in tests with a sink stream
 * (without `@nestjs/testing`).
 *
 * The optional `destination` argument is for tests only — production
 * use omits it and pino writes to stdout per the ADR 0024 contract
 * (transports are forbidden in process; ship JSON to stdout, route at
 * infra).
 */
export const buildPinoLogger = (
  meta: ServiceMeta,
  config?: LoggerConfig,
  destination?: DestinationStream
): PinoLogger =>
  destination
    ? pino(baseLoggerOptions(meta, config), destination)
    : pino(baseLoggerOptions(meta, config));

/**
 * NestJS wiring for the pino base options. Use in `app.module.ts`:
 *
 *   imports: [platformLoggerModule({
 *     meta: { name: 'sample-api', version: '0.0.0' },
 *     config: { level: env.LOG_LEVEL },
 *   })]
 *
 * And in `main.ts` before any framework log emits:
 *
 *   const app = await NestFactory.create(appModule(config), adapter, {
 *     bufferLogs: true,
 *   });
 *   app.useLogger(app.get(Logger));
 *   app.flushLogs();
 *
 * `bufferLogs: true` is required so framework boot logs route through
 * the pino instance once `useLogger` lands — otherwise the
 * controller-mapping / route-registration banner emits via the default
 * Nest logger and never appears in the JSON stream.
 *
 * `config.level` must come from the host's validated env (ADR 0016/0017).
 * Shared libs do not read `process.env` directly.
 *
 * `overrides` accepts extra `nestjs-pino` `Params` (e.g.
 * `pinoHttp.customLogLevel` for per-route log suppression). Don't extend
 * the base pino options here — derive them from `baseLoggerOptions(...)`
 * and pass via `pinoHttp.logger` so the contract stays in one place.
 *
 * Wiring detail: a single pino instance is constructed from
 * `baseLoggerOptions(...)` and passed as `pinoHttp.logger`. nestjs-pino
 * then uses it both for the framework `Logger` (boot, lifecycle,
 * scheduled jobs, ad-hoc service-injected logs) AND as the parent of
 * the per-request HTTP child logger. Putting `baseLoggerOptions` in the
 * `pinoHttp` slot directly only applies the base contract to the HTTP
 * child logger — boot/lifecycle/scheduled lines lose `service.name`,
 * the severity formatter, and the `err` serializer. The `.logger` key
 * is the load-bearing one.
 */
@Module({})
export class PlatformLoggerModule {}

export interface PlatformLoggerModuleOptions {
  config?: LoggerConfig;
  meta: ServiceMeta;
  overrides?: Partial<Params>;
}

export const platformLoggerModule = ({
  meta,
  config,
  overrides,
}: PlatformLoggerModuleOptions): DynamicModule => {
  const logger = buildPinoLogger(meta, config);
  const { pinoHttp: pinoHttpOverrides, ...restOverrides } = overrides ?? {};
  return {
    imports: [
      LoggerModule.forRoot({
        pinoHttp: { logger, ...pinoHttpOverrides },
        ...restOverrides,
      }),
    ],
    module: PlatformLoggerModule,
  };
};
