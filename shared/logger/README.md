# @shared/logger

Base pino `LoggerOptions` + NestJS wiring per the structured logging contract ([ADR 0024](../../docs/adr/0024-structured-logging-contract.md)).

## Public surface

```ts
import { baseLoggerOptions } from "@shared/logger/base-options";
import { PlatformLoggerModule, platformLoggerModule } from "@shared/logger/nest";
import type { ServiceMeta } from "@shared/logger/types";
```

No barrel — each sub-path is declared in `package.json` `exports`. Biome's `noBarrelFile` rule enforces this.

## Log shape

Per ADR 0024's required-fields table:

| Field | Source |
|---|---|
| `level` (numeric) | pino default |
| `severity` (string) | `formatters.level` mapping (OTel SeverityText) |
| `time` (epoch ms) | `pino.stdTimeFunctions.epochTime` |
| `msg` | pino default |
| `service.name`, `service.version` | `base` bindings from `ServiceMeta` |
| `trace_id`, `span_id`, `trace_flags` | injected by `@opentelemetry/instrumentation-pino` ([ADR 0025](../../docs/adr/0025-runtime-observability.md), separate package) |
| `err.type`, `err.message`, `err.stack` | `pino.stdSerializers.err` on the `err` key |
| `event` (string) | caller-supplied — e.g. `logger.log({ event: 'http.request.completed' }, 'msg')` |

## Wiring a NestJS service

`app.module.ts`:

```ts
import { platformLoggerModule } from "@shared/logger/nest";

imports: [
  platformLoggerModule({ name: "sample-api", version: "0.0.0" }),
  // …
],
```

`main.ts`:

```ts
import { Logger } from "nestjs-pino";

const app = await NestFactory.create(appModule(config), adapter, {
  bufferLogs: true,
});
app.useLogger(app.get(Logger));
app.flushLogs();
```

`bufferLogs: true` is required so framework boot logs route through pino once `useLogger` lands — otherwise the controller-mapping banner emits via the default Nest logger and never appears in the JSON stream.

## Local capture

Per [ADR 0024](../../docs/adr/0024-structured-logging-contract.md) dev scripts pipe pino's stdout JSON through `tee` to `.ai-wip/logs/<product>-<service>.log` (raw JSON, agent-readable) and through `pino-pretty` to the terminal (human-readable). The repo-root `pnpm watch-logs` script tails the log files through `pino-pretty` for human eyes:

```sh
tail -f .ai-wip/logs/*.log | pino-pretty
```

## Transport rule

Pino writes JSON to stdout. **No transport packages are imported.** Routing to a backend (CloudWatch, Loki, New Relic, …) is the infrastructure's job — see [ADR 0025](../../docs/adr/0025-runtime-observability.md).

## Shutdown / flush

No explicit flush helper is exported, deliberately. Pino's `stdout` writes are synchronous in this setup, so there's no buffered tail to lose on `SIGTERM`. Adding an `OnApplicationShutdown` helper would invent a problem this contract has already designed away.

If a fork adopts an async pino transport — against [ADR 0024](../../docs/adr/0024-structured-logging-contract.md)'s "no transports in app code" rule — they own the flush story. The right shape there is a constructor-injected pino instance + an `OnApplicationShutdown` handler that awaits `logger.flush()`; we'll add it here if and when ADR 0024 changes.
