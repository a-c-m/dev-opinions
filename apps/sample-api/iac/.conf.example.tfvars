# Example tfvars file. Copy to .conf.<env>.tfvars (e.g. .conf.dev.tfvars) and
# fill in. Non-secret values live here and are committed. Secret values come
# from TF_VAR_* env vars in CI — never commit them.

environment  = "dev"
service_name = "sample-api"

# Add app-specific non-secret inputs:
# aws_region    = "us-east-1"
# instance_size = "small"
