import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { env } from "./env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(env.PORT, "0.0.0.0");
}

bootstrap().catch((err: unknown) => {
  // Boot-time error reporting before logger is attached.
  console.error("failed to bootstrap", err);
  process.exit(1);
});
