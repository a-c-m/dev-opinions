# pnpm overrides

Why each pin in `package.json` `pnpm.overrides` exists. Drop a pin only after `pnpm security` stays green without it.

## `fastify: 5.8.5`

CVE-2026-33806 (HIGH) — Content-Type schema-validation bypass. `@nestjs/platform-fastify@11.1.19` transitively pulls 5.8.4.

## `fast-uri: 3.1.2`

CVE-2026-6321 / CVE-2026-6322 (HIGH) — path traversal + authority-delimiter decoding. Transitive of fastify.

## `picomatch: 4.0.4`

CVE-2026-33671 (HIGH) — ReDoS via crafted extglob patterns. Transitive of NX + bundlers.
