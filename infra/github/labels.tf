locals {
  labels = {
    "bug"              = { color = "d73a4a", description = "Something isn't working" }
    "ci"               = { color = "ededed", description = "CI and GitHub Actions" }
    "dependencies"     = { color = "0366d6", description = "Pull requests that update a dependency file" }
    "documentation"    = { color = "0075ca", description = "Improvements or additions to documentation" }
    "duplicate"        = { color = "cfd3d7", description = "This issue or pull request already exists" }
    "enhancement"      = { color = "a2eeef", description = "New feature or request" }
    "good first issue" = { color = "7057ff", description = "Good for newcomers" }
    "help wanted"      = { color = "008672", description = "Extra attention is needed" }
    "invalid"          = { color = "e4e669", description = "This doesn't seem right" }
    "javascript"       = { color = "168700", description = "Pull requests that update javascript code" }
    "question"         = { color = "d876e3", description = "Further information is requested" }
    "runtime"          = { color = "5319e7", description = "Runtime implementation" }
    "tests"            = { color = "bfdadc", description = "Tests and verification" }
    "tooling"          = { color = "fef2c0", description = "Development tooling" }
    "type: bug"        = { color = "d73a4a", description = "Something isn't working" }
    "type: chore"      = { color = "fef2c0", description = "Maintenance tasks" }
    "type: docs"       = { color = "0075ca", description = "Documentation improvements" }
    "type: feature"    = { color = "a2eeef", description = "New feature or capability" }
    "type: refactor"   = { color = "cfd3d7", description = "Code refactoring without behavior change" }
    "type: test"       = { color = "bfdadc", description = "Test additions or improvements" }
    "wontfix"          = { color = "ffffff", description = "This will not be worked on" }
  }
}
resource "github_issue_label" "labels" {
  for_each    = local.labels
  repository  = github_repository.this.name
  name        = each.key
  color       = each.value.color
  description = each.value.description
}
import {
  for_each = local.labels
  to       = github_issue_label.labels[each.key]
  id       = "${var.repository_name}:${each.key}"
}
