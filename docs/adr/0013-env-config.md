# ADR 0013: Env config via validated schema

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Environment variables are the most common source of production misconfiguration because they are string-typed, typo-prone, and usually read from scattered call sites. A validated env layer turns runtime surprises into boot-time failures and gives every call site a fully-typed object to work from.

## Decision

- Each app declares its environment in a single `src/env.ts` module: a zod schema validated once at boot, producing a typed `env` object exported for the rest of the app.
- No raw `process.env.FOO` access in application code — every variable flows through the schema.
- `.env.example` is committed at repo root and in each app; `.env` is gitignored.
- When a shared env-config package becomes available (see follow-up), apps swap the implementation of `env.ts` for that package. The call-site contract stays the same, so migration is mechanical.

## Consequences

**Positive**
- Missing or malformed variables fail at boot with a clear error, not silently at runtime.
- Types propagate from the schema out to every consumer — typos are compile errors.
- A single pattern means the same shape of env handling in every app.

**Negative**
- A small amount of per-app boilerplate. Mitigated by generators and, later, the shared package.
- Two documented layers (current local module, future shared package) until the shared package ships.

## Alternatives

- **Plain `process.env` access with no validation** — rejected; easy to ship misconfiguration to production.
- **Third-party env libraries** — viable, but locking in a specific library trades flexibility for little gain over a short, local zod module.

## Follow-ups

- [ ] Publish a shared env-config package so apps stop re-implementing the pattern.
- [ ] Update this ADR and any consumer apps once the shared package is available.

## Related

- **ADR 0019** — static web bundles cannot read `process.env` at runtime,
  since `import.meta.env.*` is inlined at build time. For browser apps, the
  env layer uses build-time placeholder tokens replaced at container
  startup. This ADR covers the server side only.
