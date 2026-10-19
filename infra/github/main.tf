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
    # Pages is managed by github_repository_pages below (the `pages` block of
    # this resource is deprecated in integrations/github 6.13).
    ignore_changes = [pages]
  }
}
# U8 showcase site: Pages is built and deployed by showcase-site.yml.
resource "github_repository_pages" "this" {
  repository = github_repository.this.name
  build_type = "workflow"
}
import {
  to = github_repository.this
  id = var.repository_name
}

# U8 showcase site: only protected branches (main) deploy to Pages, and the
# first deployment waits for this reviewer. A later PR removes the reviewer
# after the first site has been checked. The environment GitHub may
# create when Pages is enabled is updated in place (the API call is a PUT).
resource "github_repository_environment" "github_pages" {
  repository  = github_repository.this.name
  environment = "github-pages"
  reviewers {
    # JamBalaya56562 (the CODEOWNERS maintainer), by GitHub user ID.
    users = [88115388]
  }
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
  depends_on = [github_repository_pages.this]
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
