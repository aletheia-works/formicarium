# The organization's reusable plan and apply workflows pass github_owner to
# every module. This module does not use it: the OIDC subject in iam.tf is
# fixed to this repository's immutable IDs.
variable "github_owner" {
  description = "GitHub owner of the repository whose workflows assume the CI roles"
  type        = string
  default     = "aletheia-works"
}

variable "aws_region" {
  description = "AWS Region for every resource in this module"
  type        = string
  default     = "ap-northeast-1"
}
