provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "formicarium"
      ManagedBy = "opentofu"
    }
  }
}
