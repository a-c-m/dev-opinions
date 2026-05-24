# State backend + encryption.
#
# Pick ONE backend block below (uncomment and fill in), delete the others.
# Encryption block stays as-is for every choice — see ADR 0022.

terraform {
  # ----------------------------------------------------------------------
  # State encryption — ALWAYS ON.
  # The passphrase comes from the TF_ENCRYPTION environment variable.
  # Deploy workflow reads it from CI secrets; locally, export it from your
  # secret manager before running `tofu init`.
  # ----------------------------------------------------------------------
  encryption {
    key_provider "pbkdf2" "default" {
      passphrase = env("TF_ENCRYPTION")
    }
    method "aes_gcm" "default" {
      keys = key_provider.pbkdf2.default
    }
    state {
      method   = method.aes_gcm.default
      enforced = true
    }
    plan {
      method   = method.aes_gcm.default
      enforced = true
    }
  }

  # ----------------------------------------------------------------------
  # Backend — AWS S3 + DynamoDB locking. Uncomment and fill in.
  # ----------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "<tf-state-bucket>"
  #   key            = "sample-api/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "<tf-state-lock>"
  #   encrypt        = true
  # }

  # ----------------------------------------------------------------------
  # Backend — GCS. Uncomment and fill in.
  # ----------------------------------------------------------------------
  # backend "gcs" {
  #   bucket = "<tf-state-bucket>"
  #   prefix = "sample-api"
  # }

  # ----------------------------------------------------------------------
  # Backend — Azure Storage. Uncomment and fill in.
  # ----------------------------------------------------------------------
  # backend "azurerm" {
  #   resource_group_name  = "<rg>"
  #   storage_account_name = "<sa>"
  #   container_name       = "tfstate"
  #   key                  = "sample-api.tfstate"
  # }

  # ----------------------------------------------------------------------
  # Backend — Terraform Cloud / Tofu Cloud. Uncomment and fill in.
  # ----------------------------------------------------------------------
  # cloud {
  #   organization = "<org>"
  #   workspaces {
  #     name = "sample-api"
  #   }
  # }
}
