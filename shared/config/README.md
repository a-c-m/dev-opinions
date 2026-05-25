# @shared/config

Typed, file-based, layered-YAML configuration with secrets-only env vars.

**Status:** stub. The interface is declared in `src/index.ts`; the runtime loader, `ConfigModule`, branded token factory, and validation lint land when the first NestJS service consumes this package.

See [ADR 0016](../../docs/adr/0016-backend-config.md) for the full contract and [ADR 0026](../../docs/adr/0026-secrets-runtime-injection.md) for how secret env vars actually reach the process.
