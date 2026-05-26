import { type DynamicModule, Module } from "@nestjs/common";
import { platformLoggerModule } from "@shared/logger/nest";
import type { Env } from "./env.js";
import { HealthController } from "./health.controller.js";

const SERVICE_META = { name: "sample-api", version: "0.0.0" } as const;

/**
 * Built via a static factory so the validated env from `loadEnv()` in
 * `main.ts` threads into the logger module (and any future modules that
 * need typed config). Avoids the shared lib reading `process.env`
 * directly — per ADR 0016/0017.
 */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        platformLoggerModule({
          meta: SERVICE_META,
          config: { level: env.LOG_LEVEL },
        }),
      ],
      controllers: [HealthController],
    };
  }
}
