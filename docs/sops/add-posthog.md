# Add PostHog (errors + replay + analytics + flags)

## Overview

Wire PostHog as the error/replay/analytics/feature-flags layer
for a service. Default-advised choice per
[ADR 0025](../adr/0025-runtime-observability.md).

Adopt PostHog when at least two of these are true: you want
session replay; you'll need feature flags soon; product
analytics matter; the free tier (100k errors, unlimited users)
matches your scale.

For backend-heavy services (no end-users, async-debugging
dominant), prefer [add-sentry.md](add-sentry.md) instead.

## Prerequisites

- PostHog account (cloud or self-hosted) and a project API key.
- Service follows [ADR 0024](../adr/0024-structured-logging-contract.md)
  (pino + stdout) and [ADR 0025](../adr/0025-runtime-observability.md)
  (OTel SDK + `--import` boot order).
- Backend secret store wired per
  [ADR 0016](../adr/0016-backend-config.md).

## Steps

### Backend (NestJS)

1. **Add dependencies** to the service's `package.json`:

   ```jsonc
   {
     "dependencies": {
       "posthog-node": "5.10.0"
     }
   }
   ```

2. **Wire the secret** in `config/{env}.yaml`:

   ```yaml
   posthog:
     apiKey: !secret POSTHOG_API_KEY
     host: https://eu.posthog.com   # or your region
   ```

3. **Create a global exception filter** that forwards to
   PostHog. NestJS doesn't have a first-party PostHog SDK, so
   bridge once per service via a global filter:

   ```typescript
   // src/posthog/posthog.filter.ts
   import {
     ArgumentsHost,
     Catch,
     ExceptionFilter,
     HttpException,
     Inject,
   } from '@nestjs/common';
   import { PostHog } from 'posthog-node';

   @Catch()
   export class PostHogExceptionFilter implements ExceptionFilter {
     constructor(@Inject('POSTHOG') private readonly posthog: PostHog) {}

     catch(exception: unknown, host: ArgumentsHost): void {
       const req = host.switchToHttp().getRequest();
       this.posthog.captureException(
         exception instanceof Error ? exception : new Error(String(exception)),
         req.user?.id ?? 'anonymous',
         {
           url: req.url,
           method: req.method,
           // trace_id from pino log line correlates back
         },
       );
       // Re-throw so NestJS's default filter still responds
       throw exception;
     }
   }
   ```

4. **Register** the filter and the client in `app.module.ts`:

   ```typescript
   import { APP_FILTER } from '@nestjs/core';
   import { PostHog } from 'posthog-node';
   import { PostHogExceptionFilter } from './posthog/posthog.filter';

   @Module({
     providers: [
       {
         provide: 'POSTHOG',
         useFactory: (config: AppConfig) =>
           new PostHog(config.posthog.apiKey, { host: config.posthog.host }),
         inject: [AppConfig],
       },
       { provide: APP_FILTER, useClass: PostHogExceptionFilter },
     ],
   })
   export class AppModule {}
   ```

5. **Shut down cleanly** on app close:

   ```typescript
   // src/main.ts (after NestFactory.create)
   const posthog = app.get<PostHog>('POSTHOG');
   app.enableShutdownHooks();
   app.beforeApplicationShutdown(async () => {
     await posthog.shutdown();
   });
   ```

### Frontend (React)

6. **Add the package**:

   ```jsonc
   {
     "dependencies": {
       "posthog-js": "1.270.0"
     }
   }
   ```

7. **Initialise** before the React render:

   ```typescript
   // src/main.tsx
   import posthog from 'posthog-js';
   import { PostHogProvider } from 'posthog-js/react';
   import { env } from './env';

   posthog.init(env.VITE_POSTHOG_KEY, {
     api_host: env.VITE_POSTHOG_HOST,
     capture_pageview: true,
     session_recording: { maskAllInputs: true },
   });

   root.render(
     <PostHogProvider client={posthog}>
       <App />
     </PostHogProvider>,
   );
   ```

8. **Add the env-var schema** in `src/env.ts` per
   [ADR 0017](../adr/0017-web-runtime-env-tokens.md):

   ```typescript
   VITE_POSTHOG_KEY: z.string().min(1),
   VITE_POSTHOG_HOST: z.string().url(),
   ```

### Verify

9. Run `pnpm dev` for the service. Trigger a known error
   (e.g. `throw new Error('test')` in a controller). Confirm
   the event appears in PostHog within 30s.
10. In the same PostHog event, confirm `trace_id` is present
    in the properties — copy it, search Tempo (`pnpm dev:obs`)
    for the matching span. End-to-end correlation works.

## Related

- [ADR 0025](../adr/0025-runtime-observability.md) — the
  decision this SOP implements.
- [ADR 0024](../adr/0024-structured-logging-contract.md) —
  `trace_id` injection that makes the cross-tool correlation
  work.
- [add-sentry.md](add-sentry.md) — the alternative.
- [PostHog Node SDK docs](https://posthog.com/docs/libraries/node)
- [PostHog React SDK docs](https://posthog.com/docs/libraries/react)
