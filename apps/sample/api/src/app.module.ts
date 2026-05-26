import { Module } from "@nestjs/common";
import { platformLoggerModule } from "@shared/logger/nest";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [platformLoggerModule({ name: "sample-api", version: "0.0.0" })],
  controllers: [HealthController],
})
export class AppModule {}
