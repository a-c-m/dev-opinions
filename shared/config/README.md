# @shared/config

Typed, file-based, layered-YAML configuration with secrets-only env vars.

**Status:** stub. The interface is declared in `src/index.ts`; the runtime loader, `ConfigModule`, branded token factory, and validation lint land when the first NestJS service consumes this package.

See [ADR 0015](../../docs/adr/0015-backend-config.md) for the full contract and [ADR 0034](../../docs/adr/0034-secrets-runtime-injection.md) for how secret env vars actually reach the process.
