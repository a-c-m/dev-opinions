# ADR 0017: OpenTofu for infrastructure-as-code

- **Status**: Accepted
- **Date**: 2026-04-19

## Context

Infrastructure drifts when it is not declared. Manual console changes become undocumented, un-reviewable state that only one person understands. IaC solves the drift problem by making the cloud a product of files in git, reviewed through the same PR flow as application code. The remaining questions are *which tool* and *how the state is stored*.

Terraform has been the industry default for a decade, but since its 2023 licence change (BSL) the open-source fork **OpenTofu** (MPL-2.0) has become the community continuation. OpenTofu is HCL-compatible, provider-compatible, and adds features that matter for a template: **native state encryption** (PBKDF2 + AES-GCM), explicit state file integrity checks, and a permissive licence that will not surprise users later.

## Decision

- **OpenTofu** as the IaC tool. File suffix is `.tofu` for OpenTofu-only syntax, `.tf` for shared HCL. CLI is `tofu`.
- **Per-app `iac/` directory** under `apps/<name>/iac/`. Each deployable unit owns its infrastructure next to its code.
- **Directory shape** (convention):
  ```
  apps/<name>/iac/
  ├── backend.tofu             # state backend + encryption block
  ├── providers.tf             # provider declarations, pinned
  ├── variables.tf             # input variable definitions
  ├── outputs.tf               # module outputs
  ├── main.tf                  # top-level composition
  ├── <resource-group>.tf      # one file per logical group (compute, data, network…)
  ├── .conf.dev.tfvars         # environment inputs (gitignored if secret, committed if not)
  ├── .conf.prod.tfvars
  ├── README.md                # what this deploys, how to run
  └── package.json             # pipeline metadata consumed by CI
  ```
- **State backend**: remote, with locking. The template ships a commented example for S3 + DynamoDB; consumers swap for GCS+Firestore, Azure Storage, Terraform Cloud, or Tofu Cloud at adoption time.
- **State encryption**: always on. Passphrase supplied via a `TF_ENCRYPTION` environment variable that the deploy workflow reads from the CI secret store. An unencrypted state file is never written to disk.
- **Environments**: one tfvars file per environment (`dev`, `staging`, `prod`). Environment is selected at apply time via `-var-file`, not via workspaces (workspaces hide environment in a terminal command and are easy to get wrong).
- **Secrets**: application secrets live in the target cloud's secret manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault), *referenced* by name in tfvars. Secret *values* are injected at apply time via `TF_VAR_*` env vars from CI secrets. Nothing secret is ever committed.
- **Provider versions are pinned exactly** in `providers.tf` and `.terraform.lock.hcl` is committed — the same "exact versions" rule as application dependencies.
- **Deploys via CI only**: `.github/workflows/_infra-deploy.yml` is the reusable workflow that runs `tofu init / validate / plan / apply`. Local apply is for emergencies, not the default loop. The state lock + the CI concurrency group prevent races.

## Consequences

**Positive**
- OpenTofu gives Terraform's ecosystem with a permissive licence and better state handling.
- Per-app `iac/` co-locates infrastructure with the service it runs; PRs that change behaviour and capacity together are reviewed together.
- Native state encryption closes a common leak path (a state file copied off a laptop is no longer catastrophic).
- Var-files per environment keep the `tofu apply` command explicit about where it is landing.

**Negative**
- Some enterprise features (Terraform Cloud, certain providers' registry entries) are downstream of HashiCorp; OpenTofu mirrors most but may lag.
- State encryption requires the passphrase to be available wherever apply runs. Losing the passphrase means the state is unreadable — treat it as the most sensitive secret in the deployment.

## Alternatives

- **Terraform (HashiCorp)** — same ergonomics, BSL licence. Rejected to avoid the licence surprise.
- **Pulumi** — real programming languages, smaller ecosystem, harder to review for non-authors.
- **CDK** — same drawback as Pulumi, tied to one cloud.
- **Plain cloud-native templates (CloudFormation, ARM, Deployment Manager)** — cloud lock-in, weaker module story.
- **Helm / k8s manifests only** — covers workload, not platform. Pairs with IaC rather than replacing it.

## Open decisions (captured here, not blocking)

- **Target cloud**: not fixed. The template ships a provider- and backend-agnostic skeleton with example blocks for AWS. Consumers pick their cloud when first using the skeleton and record that choice in a follow-up ADR.
- **Secret manager**: coupled to the chosen cloud. Same deferral.
