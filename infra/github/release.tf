variable "release_automation_enabled" {
  description = "Enable release PR generation and tag/GitHub release creation"
  type        = bool
  default     = true
}
variable "weekly_release_merge_enabled" {
  description = "Enable weekly release PR auto-merge after required checks"
  type        = bool
  default     = false
}
resource "github_actions_variable" "release_automation" {
  repository    = github_repository.this.name
  variable_name = "RELEASE_AUTOMATION_ENABLED"
  value         = tostring(var.release_automation_enabled)
}
resource "github_actions_variable" "weekly_release_merge" {
  repository    = github_repository.this.name
  variable_name = "WEEKLY_RELEASE_MERGE_ENABLED"
  value         = tostring(var.weekly_release_merge_enabled)
}
