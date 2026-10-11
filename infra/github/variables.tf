variable "github_owner" {
  description = "GitHub owner of the managed repository"
  type        = string
  default     = "aletheia-works"
}
variable "repository_name" {
  description = "Existing repository to manage"
  type        = string
  default     = "formicarium"
}
