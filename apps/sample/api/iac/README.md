# sample-api / iac

OpenTofu skeleton for the sample app. See [ADR 0017](../../../docs/adr/0017-opentofu-iac.md) for the rationale and conventions.

This skeleton ships with **no provider resources** — only the structure. On
adoption you fill in the target cloud (AWS, GCP, Azure, Kubernetes, …) and
record that choice in a follow-up ADR.

## Layout

```
iac/
├── backend.tofu              # state backend + encryption block
├── providers.tf              # provider declarations (pinned exactly)
├── variables.tf              # input variable definitions
├── outputs.tf                # module outputs
├── main.tf                   # top-level composition
├── .conf.example.tfvars      # copy to .conf.<env>.tfvars and fill in
├── package.json              # pipeline metadata consumed by CI
├── .gitignore                # state, plan, .terraform/, *.tfvars
└── README.md                 # this file
```

## Running locally

```sh
cd apps/sample-api/iac
export TF_ENCRYPTION="<the passphrase for this project's state>"
tofu init
tofu plan -var-file=.conf.dev.tfvars
tofu apply -var-file=.conf.dev.tfvars
```

`tofu apply` should be rare locally — the normal path is the `_infra-deploy`
reusable workflow driven by a PR or a merge to `main`.

## Adopting this skeleton

1. Pick the target cloud. Uncomment the corresponding block in `providers.tf`
   and `backend.tofu`. Pin the provider version exactly.
2. Pick a state backend (S3+DynamoDB, GCS+Firestore, Azure Storage, Terraform
   Cloud, Tofu Cloud). Fill in the backend block in `backend.tofu`.
3. Generate an encryption passphrase, store it in a secret manager, and
   reference it via the `TF_ENCRYPTION` env var in the deploy workflow.
4. Copy `.conf.example.tfvars` to `.conf.dev.tfvars`, `.conf.prod.tfvars`,
   etc. Commit only non-secret tfvars; secret values flow through `TF_VAR_*`
   in CI.
5. Add your first resource in `main.tf` and run `tofu plan` locally.
6. Wire a deploy workflow that calls `.github/workflows/_infra-deploy.yml`
   with the paths and environment for this app.

## State encryption — do not disable

`backend.tofu` contains a `terraform { encryption { … } }` block. State files
record the current shape of your infrastructure, including provider
metadata, outputs, and sometimes secrets. An unencrypted state file copied
off a laptop is a credential leak waiting to happen.

If `TF_ENCRYPTION` is missing, `tofu init` fails loudly. That is the
intended behaviour. Store the passphrase in the same secret manager as the
rest of the deploy credentials.
