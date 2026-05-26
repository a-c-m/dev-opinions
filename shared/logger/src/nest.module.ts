import { type DynamicModule, Module } from "@nestjs/common";
import { LoggerModule, type Params } from "nestjs-pino";
import { baseLoggerOptions } from "./base-options.ts";
import type { LoggerConfig, ServiceMeta } from "./types.ts";

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
 * and pass via `pinoHttp` so the contract stays in one place.
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
}: PlatformLoggerModuleOptions): DynamicModule => ({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: baseLoggerOptions(meta, config),
      ...overrides,
    }),
  ],
  module: PlatformLoggerModule,
});
