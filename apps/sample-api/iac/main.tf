# Top-level composition for sample-api infrastructure.
#
# This skeleton is intentionally empty. Add resources and modules here as the
# service grows. Split into logical files (e.g. `network.tf`, `compute.tf`,
# `data.tf`) once this file exceeds ~200 lines.
#
# Local values for naming consistency:

locals {
  name_prefix = "${var.service_name}-${var.environment}"

  common_tags = {
    project     = var.service_name
    environment = var.environment
    managed_by  = "opentofu"
  }
}
