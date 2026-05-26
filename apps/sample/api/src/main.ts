import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { baseLoggerOptions } from "@shared/logger/base-options";
import { Logger } from "nestjs-pino";
import { pino } from "pino";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./env.js";

const SERVICE_META = { name: "sample-api", version: "0.0.0" } as const;

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env),
    new FastifyAdapter(),
    { bufferLogs: true }
  );
  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");
}

bootstrap().catch((err: unknown) => {
  // Boot-time fatal — Nest's logger isn't attached yet, so build a
  // standalone pino instance from the same base options used by
  // @shared/logger/nest. One JSON line into the same log stream the
  // rest of the service uses.
  pino(baseLoggerOptions(SERVICE_META)).fatal({ err }, "failed to bootstrap");
  process.exit(1);
});
