variable "environment" {
  description = "Deployment environment: dev | staging | prod."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "service_name" {
  description = "Logical name of the service this iac/ deploys. Used in resource naming and tags."
  type        = string
  default     = "sample-api"
}

# Add app-specific variables below. Examples:
#
# variable "aws_region" {
#   description = "Target AWS region."
#   type        = string
# }
#
# variable "instance_size" {
#   description = "Compute size for the API task."
#   type        = string
# }
#
# Secret variables should NOT have a default. They come from TF_VAR_* in CI.
#
# variable "database_password" {
#   description = "Injected from the secret manager via TF_VAR_database_password."
#   type        = string
#   sensitive   = true
# }
