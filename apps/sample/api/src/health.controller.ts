import { Controller, Get } from "@nestjs/common";

export type HealthResponse = {
  status: "ok";
  uptimeSeconds: number;
};

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
