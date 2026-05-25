---
date: 2026-05-24
decision-makers: [Repo platform]
---

# ADR 0026: Secrets injection at runtime

## Context and Problem Statement

[ADR 0016](0016-backend-config.md) settles the *shape* of
secrets — `secret("ENV_VAR", z.…)` in the typed schema —
and explicitly punts on how env vars get into the container.
That's this ADR. It also covers the local dev CLI, the CI
authentication rule, and the store-choice ladder.

`.env` files in git remain the dominant secret-leak vector
(GitGuardian: 28.65M new hardcoded secrets on public GitHub
in 2025). The default path needs to make committing a real
secret structurally hard.

## Decision Outcome

### Runtime injection — entrypoint shim, not platform-native

Container `ENTRYPOINT` runs a vault CLI agent that
authenticates as the workload (via IRSA / Pod Identity / GCP
WIF / OIDC token — never a baked-in credential), fetches
secrets, exports them as env vars, then `exec`s the app.
Stacks with [ADR 0025](0025-runtime-observability.md)'s OTel
boot order:

```dockerfile
# updates ADR 0034 runtime stage
RUN curl -sSL https://infisical.com/install.sh | sh   # or doppler / 1password / vault agent
ENTRYPOINT ["infisical", "run", "--", "node", "--import", "./dist/instrumentation.mjs"]
CMD ["dist/main.js"]
```

Why shim over platform-native (ECS `secrets:`, ESO):
- **Portable across clouds and on-prem** — same Dockerfile
- **Local `podman compose up` works against the dev vault**
  with no cloud-platform fakery
- **Rotation without redeploy** — agents like Vault Agent /
  Infisical refresh in place
- **Container declares what it needs** — no platform-side
  drift between task definition and code

Cost: ~20 MB of CLI binary in every image; one more thing in
the boot path. Accepted.

The shim agent never receives long-lived credentials. It
exchanges a cloud-native identity (IRSA / Pod Identity / WIF)
for a short-lived vault token at process start.

### Local dev — CLI-wrap, no `.env` files

[ADR 0016](0016-backend-config.md)'s dev workflow updates:
`cp .env.example .env` and filling secrets by hand is
retired. Devs run the dev server through the same CLI that
runs in containers:

```jsonc
// apps/<product>/<service>/package.json
{
  "scripts": {
    "dev": "op run --env-file=.env.example -- node --import ./dist/instrumentation.mjs dist/main.js"
  }
}
```

- **1Password (`op run --`)** is the named default. Carries
  forward from ADR 0016's "fill from 1Password" dev story.
- **Drop-in alternatives** documented: `infisical run --`,
  `doppler run --`, `vault agent` in supervisor mode.
- **`.env.example` is the allowlist** — `op run` reads it to
  know which keys to populate from the vault. Committed, no
  values.
- **No `.env` file ever exists on disk.** Structurally
  impossible to commit a real secret.

First-run cost: `op signin` once (or `infisical login`,
`doppler login`). Documented in QUICKSTART.

### CI authentication — OIDC only, no long-lived keys

GitHub Actions → AWS via OIDC + `aws-actions/configure-aws-credentials`
exchanges a workflow-scoped token for short-lived STS creds.
Same shape for GCP Workload Identity Federation and Azure WIF.

**No `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / equivalents
as repo or environment secrets.** Enforcement is layered:

- **Trivy** ([ADR 0008](0008-trivy-security-scan.md)) scans
  for actual leaked credential *values* in the working tree
- **PR review** catches the shape mistake (workflow references
  long-lived key names)
- **Cloud-side IAM**: don't provision long-lived-key IAM users
  in the first place — if the AWS account only has OIDC roles,
  a workflow referencing `AWS_ACCESS_KEY_ID` has nothing to
  authenticate against

[ADR 0032](0032-github-actions-ci.md) already prescribes
OIDC; the cloud-side absence of long-lived users is the
load-bearing control.

### Store choice — agnostic, advisory ladder

Base-app does not pick. The shim CLI is the swap point:
change `op run --` → `infisical run --` → done.

| Rung | When | Trade-off |
|---|---|---|
| **1Password Secrets Automation** | Already on 1Password; small team; static secrets only | No dynamic-secret generation; per-user pricing |
| **Doppler / Infisical Cloud** | Small-to-mid team; want managed; OSS escape hatch matters | SaaS lock-in (low — both export) |
| **Infisical self-hosted** (MIT) | >25 engineers, regulated, or compliance demands data residency | Operational cost; you run it |
| **OpenBao** (Vault fork, MPL-2.0, Linux Foundation) | Need dynamic secrets, broader auth methods, or want a Vault-shaped API without BUSL | Heaviest to run; horizontal-read scaling now in the free core (v2.5.4) |
| **SPIFFE/SPIRE** | ≥3 clouds in prod | CNCF-graduated multi-cloud identity; OIDC federation to AWS/GCP/Azure |

HashiCorp Vault is still defensible but its August 2023 BUSL
relicense + IBM acquisition (Feb 2025) push OSS-first forks
toward OpenBao. Both speak the same API.

### Hard rules

The six anti-patterns the research surfaced (all driven by
real 2024–2026 incidents):

1. **`.env` files in git.** `.env.example` is committed (key
   names + placeholders); real values never.
2. **Long-lived cloud keys in CI.** OIDC only. Trivy catches
   leaked values; the absence of long-lived IAM users on the
   cloud side is the real control.
3. **Base64 K8s `Secret` without an external store.** Base64
   is not encryption; the cluster admin reads it.
4. **Prod creds in shared 1Password vaults with humans.**
   Workload vault is separate; humans never see prod values.
5. **Single Vault root token for app auth.** Use Kubernetes
   / OIDC auth methods; root tokens are break-glass only.
6. **Manual rotation by calendar reminder.** Automate or
   adopt dynamic secrets when it bites.

### Dynamic secrets — named graduation, not default

Static secrets (one value, valid until rotated) are the
default. **Dynamic secrets** (Vault/OpenBao mints a per-instance
DB user with a 1h TTL on each app boot, auto-revokes on
expiry) are the graduation when:

- Compliance asks "who connected to the DB last Tuesday?"
- 10+ services share a database and manual rotation is too
  slow
- A static credential leak has happened and rotation took
  >24h
- The team already runs Vault/OpenBao for static, and turning
  on dynamic for one path is incremental

Wrong tool for SaaS APIs (Stripe doesn't issue a new key per
hour). Right for Postgres / Redis / RabbitMQ / cloud IAM roles
where the vault mints credentials on demand.

## Consequences

### Positive

- **One mechanism, all environments.** Same `infisical run --`
  (or chosen CLI) runs locally, in CI, in containers.
- **No `.env` file on disk.** Structurally impossible to
  commit a real secret.
- **Cloud-portable.** Same Dockerfile runs on AWS / GCP /
  Azure / on-prem without rewiring.
- **Stacks with OTel boot order.** `infisical run -- node
  --import …` is one ENTRYPOINT line.
- **CI gets short-lived creds only.** OIDC + STS; cloud-side
  IAM has no long-lived users to authenticate against.

### Negative

- **~20 MB binary per container image.** Real but bounded.
- **Boot path has one more failure mode** — vault auth or
  network can fail before app code runs. Monitored as a
  startup-error metric.
- **Dev first-run friction.** `op signin` once per machine
  before `pnpm dev` works.
- **Cloud-native identity setup (IRSA / Pod Identity / WIF)
  is real work** — falls on whoever wires Tofu, not the
  template.

### Neutral

- Store choice stays per-fork; base-app advises.
- Dynamic secrets are deferred until they earn their place.
- The shim CLI replaces, not augments, the platform-native
  injection — pick one. Pattern A (ECS `secrets:`, ESO) is
  available as a graduation if a fork standardises on a
  single cloud and the portability cost is irrelevant.

## Alternatives considered

1. **Platform-native injection (ECS `secrets:`, ESO).**
   Simplest in one cloud; loses portability and the local-dev
   parity story. Available as Pattern A graduation for
   single-cloud forks.
2. **SDK fetch in `boot.ts`.** Couples app code to a
   vendor SDK; breaks the "app reads `process.env`" guarantee
   from ADR 0016.
3. **SOPS-encrypted secrets in repo.** Single source in git;
   per-environment KMS access becomes the bottleneck;
   rotation surface grows to files + keys.
4. **Doppler / 1Password as the prescribed default.** Lock-in
   risk for forks with different vault choices already.
5. **Vault Enterprise.** BUSL since 2023; OpenBao is the
   API-compatible MPL-2.0 fork. No reason for the template
   to prescribe Enterprise.

## Relationship to prior ADRs

- **Fills the gap in [0016](0016-backend-config.md)** —
  secret env-var injection mechanism. ADR 15's loader is
  unchanged; this ADR feeds it.
- **Stacks with [0034](0034-container-conventions.md)** —
  `ENTRYPOINT` becomes `["<vault-cli>", "run", "--", "node",
  "--import", "./dist/instrumentation.mjs"]`.
- **Hardens [0032](0032-github-actions-ci.md)** — OIDC was
  already prescribed; this ADR layers Trivy + cloud-side IAM
  posture as the real defenses against long-lived keys.
- **References [0025](0025-runtime-observability.md)** —
  boot order stays the same; OTel still loads via `--import`
  after the vault shim has set env vars.

## References

- [Infisical](https://github.com/Infisical/infisical) — MIT, self-hostable
- [1Password CLI `op run`](https://developer.1password.com/docs/cli/secrets-environment-variables/)
- [Doppler CLI](https://docs.doppler.com/docs/cli)
- [OpenBao](https://github.com/openbao/openbao) — MPL-2.0 Vault fork
- [SPIFFE / SPIRE](https://spiffe.io/) — CNCF-graduated workload identity
- [AWS OIDC for GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [GitGuardian 2025 State of Secrets Sprawl](https://www.gitguardian.com/state-of-secrets-sprawl-report-2025)
