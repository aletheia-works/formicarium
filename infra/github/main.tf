# description, homepage_url and topics are the About box. homepage_url is the
# showcase site that showcase-site.yml deploys; it is a literal, since
# github_repository_pages depends on this resource.
resource "github_repository" "this" {
  name                        = var.repository_name
  description                 = "Run unmodified x86-64 Linux CLI binaries in the browser and Node.js — the paludarium emulator on WebAssembly, no kernel to boot."
  homepage_url                = "https://aletheia-works.github.io/formicarium/"
  topics                      = ["browser", "bug-reproduction", "cli", "developer-tools", "emulator", "linux", "nodejs", "webassembly", "x86-64"]
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
# Showcase site: Pages is built and deployed by showcase-site.yml.
resource "github_repository_pages" "this" {
  repository = github_repository.this.name
  build_type = "workflow"
}
import {
  to = github_repository.this
  id = var.repository_name
}

# Showcase site: only protected branches (main) deploy to Pages. The
# environment GitHub may create when Pages is enabled is updated in place (the
# API call is a PUT).
resource "github_repository_environment" "github_pages" {
  repository  = github_repository.this.name
  environment = "github-pages"
  # No reviewers: the first deployment (run 39422079965) was approved by hand,
  # and later ones deploy without approval. Only main may deploy.
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
  depends_on = [github_repository_pages.this]
}

# infra/aws applies through this environment: its apply role trusts only
# the OIDC subject of a job in it, and only main may deploy to it.
resource "github_repository_environment" "aws_apply" {
  repository  = github_repository.this.name
  environment = "aws-apply"
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

# Main is protected by the ruleset below (as in vivarium). The
# classic protection it replaced is removed: integrations/github 6.13.0 sent
# every existing check twice when it updated github_branch_protection_v3
# (provider #3420), so that resource could no longer be changed.
locals {
  # ci-required is the one required check of ci.yml: it passes when every job
  # the PR's changes need passed and the rest were skipped, so ci.yml jobs can
  # be skipped, renamed or added without a ruleset change. showcase-site-required
  # runs on every PR and passes a PR without site changes, so requiring it
  # never leaves an unrelated PR waiting.
  required_checks = ["ci-required", "check / Commitlint", "showcase-site-required"]
}
# Administrators have no bypass (enforce_admins). Branches need not be up to
# date with main before merging, as in paludarium and vivarium: the long
# candidate CI would otherwise rerun on every open PR after each merge, and
# CI on pushes to main still catches two PRs that only break together. Force
# pushes and deletion stay blocked; only squash merges are allowed, so linear
# history changes nothing.
resource "github_repository_ruleset" "main" {
  name        = "main"
  repository  = github_repository.this.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    deletion                = true
    non_fast_forward        = true
    required_linear_history = true
    required_signatures     = true

    pull_request {
      required_approving_review_count   = 0
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_review_thread_resolution = true
    }

    required_status_checks {
      strict_required_status_checks_policy = false

      dynamic "required_check" {
        for_each = local.required_checks

        content {
          context        = required_check.value
          integration_id = 15368
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
