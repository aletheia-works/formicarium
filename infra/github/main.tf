resource "github_repository" "this" {
  name                        = var.repository_name
  description                 = "blink on WebAssembly proof of concept for Node.js and browsers"
  visibility                  = "public"
  has_issues                  = true
  has_discussions             = false
  has_projects                = true
  has_wiki                    = true
  allow_merge_commit          = false
  allow_squash_merge          = true
  allow_rebase_merge          = false
  allow_auto_merge            = true
  delete_branch_on_merge      = true
  web_commit_signoff_required = true
  archived                    = false
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [pages]
  }
}
import {
  to = github_repository.this
  id = var.repository_name
}

# Keep the existing classic protection; do not create a second overlapping ruleset.
locals {
  required_checks = ["quality", "commit-format", "ci-required", "check / Commitlint"]
}
resource "github_branch_protection_v3" "main" {
  repository                      = github_repository.this.name
  branch                          = "main"
  enforce_admins                  = true
  require_signed_commits          = true
  require_conversation_resolution = true
  required_status_checks {
    strict = true
    checks = [for context in local.required_checks : "${context}:15368"]
  }
  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = false
    required_approving_review_count = 0
    require_last_push_approval      = false
  }
  lifecycle {
    prevent_destroy = true
  }
}
import {
  to = github_branch_protection_v3.main
  id = "${var.repository_name}:main"
}
