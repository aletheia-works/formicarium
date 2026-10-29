# ── The OpenTofu identities ──────────────────────────────────────────────
#
# The roles that let CI manage the account cannot be created by CI, so they
# and the permissions boundary were created by hand from the templates in
# bootstrap/ (README.md has the commands), and are imported here so a plan
# notices if anyone changes them. The apply role can read them but not change
# them: a role that could rewrite its own policy could grant itself anything.
# A change to them is made by hand from the same templates, and the plan then
# shows no changes.
#
# The plan role trusts every workflow of this repository, since the
# organization's plan workflow runs on pull_request_target, so it reads only
# what a refresh needs: this module's resources and IAM, and no object in any
# bucket (the account runs other stacks). The apply role trusts only the
# aws-apply environment, which only main reaches, and reads the same way.

data "aws_caller_identity" "current" {}

# The account's GitHub OIDC provider belongs to another stack; one account
# has one provider per issuer, so this module only reads it.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # GitHub's subject with immutable owner and repository IDs, as the
  # repository's OIDC settings use (use_immutable_subject). It names this
  # repository only; README.md step 1 uses the same literal.
  subject_prefix = "repo:aletheia-works@277398715/formicarium@1408680867"
  bootstrap = {
    account_id     = local.account_id
    subject_prefix = local.subject_prefix
  }
}

resource "aws_iam_policy" "workload_boundary" {
  name        = "formicarium-workload-boundary"
  description = "The most any role this module creates may do."
  policy      = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/workload-boundary.json.tftpl", local.bootstrap)))
}

resource "aws_iam_role" "tofu_plan" {
  name               = "github-actions-formicarium-tofu-plan"
  description        = "OpenTofu plan for infra/aws. Reads this module only."
  assume_role_policy = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/trust-plan.json.tftpl", local.bootstrap)))
}

resource "aws_iam_role_policy" "tofu_plan_read" {
  name   = "tofu-read"
  role   = aws_iam_role.tofu_plan.name
  policy = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/read-policy.json.tftpl", local.bootstrap)))
}

resource "aws_iam_role" "tofu_apply" {
  name               = "github-actions-formicarium-tofu-apply"
  description        = "OpenTofu apply for infra/aws from main."
  assume_role_policy = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/trust-apply.json.tftpl", local.bootstrap)))
}

# Refreshing the state reads every resource; the writes are in tofu-apply.
resource "aws_iam_role_policy" "tofu_apply_read" {
  name   = "tofu-read"
  role   = aws_iam_role.tofu_apply.name
  policy = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/read-policy.json.tftpl", local.bootstrap)))
}

resource "aws_iam_role_policy" "tofu_apply" {
  name   = "tofu-apply"
  role   = aws_iam_role.tofu_apply.name
  policy = jsonencode(jsondecode(templatefile("${path.module}/bootstrap/apply-policy.json.tftpl", local.bootstrap)))
}

import {
  to = aws_iam_policy.workload_boundary
  id = "arn:aws:iam::${local.account_id}:policy/formicarium-workload-boundary"
}

import {
  to = aws_iam_role.tofu_plan
  id = "github-actions-formicarium-tofu-plan"
}

import {
  to = aws_iam_role_policy.tofu_plan_read
  id = "github-actions-formicarium-tofu-plan:tofu-read"
}

import {
  to = aws_iam_role.tofu_apply
  id = "github-actions-formicarium-tofu-apply"
}

import {
  to = aws_iam_role_policy.tofu_apply_read
  id = "github-actions-formicarium-tofu-apply:tofu-read"
}

import {
  to = aws_iam_role_policy.tofu_apply
  id = "github-actions-formicarium-tofu-apply:tofu-apply"
}
