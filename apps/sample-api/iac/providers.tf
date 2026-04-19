# Provider declarations — pin every version exactly (see CLAUDE.md rule).
# Uncomment the provider block that matches your target and remove the rest.

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    # ------------------------------------------------------------------
    # AWS
    # ------------------------------------------------------------------
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "5.78.0"
    # }

    # ------------------------------------------------------------------
    # Google Cloud
    # ------------------------------------------------------------------
    # google = {
    #   source  = "hashicorp/google"
    #   version = "6.14.1"
    # }

    # ------------------------------------------------------------------
    # Azure
    # ------------------------------------------------------------------
    # azurerm = {
    #   source  = "hashicorp/azurerm"
    #   version = "4.12.0"
    # }

    # ------------------------------------------------------------------
    # Kubernetes (generic)
    # ------------------------------------------------------------------
    # kubernetes = {
    #   source  = "hashicorp/kubernetes"
    #   version = "2.35.1"
    # }
  }
}

# Fill in the provider config block that matches your chosen required_providers.
# Example (AWS):
#
# provider "aws" {
#   region = var.aws_region
#   default_tags {
#     tags = {
#       project     = "sample-api"
#       environment = var.environment
#       managed_by  = "opentofu"
#     }
#   }
# }
