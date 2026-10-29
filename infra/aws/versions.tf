terraform {
  required_version = ">= 1.13.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.71"
    }
    # The relay's MicroVM image needs its memory size and hooks, which only
    # the Cloud Control resource exposes (hashicorp/aws has neither).
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 1.108"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}
