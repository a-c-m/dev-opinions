# Add Sentry (errors + replay + APM)

## Overview

Wire Sentry as the error/replay/APM layer for a service.
Alternative to PostHog per
[ADR 0025](../adr/0025-runtime-observability.md).

Adopt Sentry when: the service has no end-users (worker,
batch), or async/distributed-trace debugging dominates your
incident pattern, or you specifically value Sentry's
error-triage UX. For everything else, prefer
[add-posthog.md](add-posthog.md).

## Prerequisites

- Sentry account + DSN for the service (one per environment).
- Service follows [ADR 0024](../adr/0024-structured-logging-contract.md)
  and [ADR 0025](../adr/0025-runtime-observability.md).
- Backend secret store wired per
  [ADR 0016](../adr/0016-backend-config.md).

## Steps

### Backend (NestJS)

1. **Add dependencies**:

   ```jsonc
   {
     "dependencies": {
       "@sentry/nestjs": "8.55.0",
       "@sentry/profiling-node": "8.55.0"
     }
   }
   ```

2. **Initialise Sentry in `instrumentation.ts`** — before any
   `@nestjs/core` import. Co-existence with the OTel SDK:
   pass `skipOpenTelemetrySetup: true` because OTel is already
   configured per [ADR 0025](../adr/0025-runtime-observability.md).

   ```typescript
   // src/instrumentation.ts
   import * as Sentry from '@sentry/nestjs';
   import { nodeProfilingIntegration } from '@sentry/profiling-node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.APP_ENV,
     release: process.env.SERVICE_VERSION,
     tracesSampleRate: 0.1,            // matches ADR 0025 prod default
     profilesSampleRate: 0.1,
     integrations: [nodeProfilingIntegration()],
     skipOpenTelemetrySetup: true,
   });

   // ... existing OTel SDK init below ...
   ```

3. **Register the Sentry module** in `app.module.ts`:

   ```typescript
   import { SentryModule } from '@sentry/nestjs/setup';

   @Module({
     imports: [SentryModule.forRoot()],
   })
   export class AppModule {}
   ```

4. **Wire the DSN** in `config/{env}.yaml` as a secret:

   ```yaml
   sentry:
     dsn: !secret SENTRY_DSN
   ```

### Frontend (React)

5. **Add the package**:

   ```jsonc
   {
     "dependencies": {
       "@sentry/react": "8.55.0"
     }
   }
   ```

6. **Initialise** before React renders:

   ```typescript
   // src/main.tsx
   import * as Sentry from '@sentry/react';
   import { env } from './env';

   Sentry.init({
     dsn: env.VITE_SENTRY_DSN,
     environment: env.VITE_APP_ENV,
     release: env.VITE_RELEASE,
     integrations: [
       Sentry.browserTracingIntegration(),
       Sentry.replayIntegration({ maskAllText: true }),
     ],
     tracesSampleRate: 0.1,
     replaysSessionSampleRate: 0.05,
     replaysOnErrorSampleRate: 1.0,
   });
   ```

7. **Add env-var schema** in `src/env.ts` per
   [ADR 0017](../adr/0017-web-runtime-env-tokens.md).

8. **Upload source maps** at build time (CI job — see Sentry
   CLI docs; one-time per release).

### Verify

9. Trigger a known error backend-side. Confirm grouping +
   stack + `trace_id` attribute appear in Sentry within 30s.
10. Trigger a frontend error. Confirm session replay attached
    and the trace links the backend handler's span.

## Related

- [ADR 0025](../adr/0025-runtime-observability.md) — the
  decision this SOP implements.
- [add-posthog.md](add-posthog.md) — the default alternative.
- [Sentry NestJS docs](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry React docs](https://docs.sentry.io/platforms/javascript/guides/react/)
