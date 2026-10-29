# AWS resources as code

This module manages the AWS side of guest networking in the browser: a
WebSocket relay on [Lambda MicroVMs](https://docs.aws.amazon.com/lambda/latest/dg/microvms-launching.html)
that opens the TCP connections a guest asks for. A browser cannot open TCP
itself, so the core sends a guest's connections to the relay over WebSocket.
The relay and its wire protocol come from paludarium; this module only
deploys them.

It follows the layout of [infra/github](../github/README.md), but plans and
applies through this repository's own workflows,
[aws-terraform-plan.yml](../../.github/workflows/aws-terraform-plan.yml) and
[aws-terraform-apply.yml](../../.github/workflows/aws-terraform-apply.yml).
Only this repository uses AWS and the account is not the organization's, so
the organization's shared OpenTofu workflows carry no AWS step. The two
workflows follow them otherwise: a plan runs on `pull_request_target` only for
a PR from this repository or from someone with write access, the state is
encrypted with `TF_STATE_PASSPHRASE` and kept as the `terraform-state-aws`
artifact of the run named by `LATEST_AWS_APPLY_RUN_ID`, and the plan is posted
on the PR. They assume an AWS role through GitHub's OIDC token, so no AWS
access key is stored anywhere. The state backup has no AWS step, so
[aws-terraform-state-backup.yml](../../.github/workflows/aws-terraform-state-backup.yml)
calls the organization's reusable backup workflow.

## What is managed

| File                     | Resources                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| [iam.tf](iam.tf)         | The CI roles for plan and apply and the permissions boundary, created by hand and imported |
| [storage.tf](storage.tf) | The private, versioned S3 bucket for the relay's code artifacts                            |

The relay's MicroVM image, its build and execution roles, and the small
function that starts the shared MicroVM and hands a browser its endpoint and
a short-lived token come once paludarium's relay is released. No MicroVM is
kept in the state: the platform ends a MicroVM after at most 8 hours, so the
function starts one when none is running, and the idle policy suspends it
when nobody uses it.

## Why the CI roles are narrow

The account also runs other stacks, so neither role uses an account-wide
managed policy.

Both read through `tofu-read` ([bootstrap/read-policy.json.tftpl](bootstrap/read-policy.json.tftpl)):
the settings of `formicarium-*` buckets (no object in any bucket), their own
functions, MicroVM images and `/formicarium/*` log groups, and IAM. This
matters most for the plan role, which every workflow of this repository can
assume, since the organization's plan workflow runs on `pull_request_target`.

Beyond that, the apply role, which only the `aws-apply` environment on `main`
can assume, may write only `formicarium-*` buckets, functions, MicroVM images
and `/formicarium/*` log groups. It may create a `formicarium-*` role only
with the `formicarium-workload-boundary` permissions boundary attached, may
not remove that boundary, and may pass such a role only to Lambda. It cannot
change the boundary or the two CI roles, so it cannot grant itself more: they
are created by hand from [bootstrap/](bootstrap/), and a plan reports any
change made to them since.

## Setup (日本語)

AWS の認証情報は、この会話や tfvars に貼り付けません。次の作業はすべて、本人の端末で
本人の認証情報を使って行います。

### 1. CI の role と permissions boundary を手で作る

`aws login`（または SSO の profile）で、この account の管理者として認証してから、
この directory（`infra/aws`）で次を実行します。template の `${account_id}` と
`${subject_prefix}` を置き換えて、OpenTofu が読むのと同じ内容で作ります。tag は
provider の `default_tags` と同じにします（違うと plan が tag の変更を出し、apply の
role はこれらを変えられないので失敗します）。

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
SUBJECT='repo:aletheia-works@277398715/formicarium@1408680867'
render() { sed -e "s|\${account_id}|$ACCOUNT|g" -e "s|\${subject_prefix}|$SUBJECT|g" "bootstrap/$1.json.tftpl"; }
TAGS='Key=Project,Value=formicarium Key=ManagedBy,Value=opentofu'

aws iam create-policy --policy-name formicarium-workload-boundary \
  --description 'The most any role this module creates may do.' \
  --policy-document "$(render workload-boundary)" --tags $TAGS

aws iam create-role --role-name github-actions-formicarium-tofu-plan \
  --description 'OpenTofu plan for infra/aws. Reads this module only.' \
  --assume-role-policy-document "$(render trust-plan)" --tags $TAGS
aws iam put-role-policy --role-name github-actions-formicarium-tofu-plan \
  --policy-name tofu-read --policy-document "$(render read-policy)"

aws iam create-role --role-name github-actions-formicarium-tofu-apply \
  --description 'OpenTofu apply for infra/aws from main.' \
  --assume-role-policy-document "$(render trust-apply)" --tags $TAGS
aws iam put-role-policy --role-name github-actions-formicarium-tofu-apply \
  --policy-name tofu-read --policy-document "$(render read-policy)"
aws iam put-role-policy --role-name github-actions-formicarium-tofu-apply \
  --policy-name tofu-apply --policy-document "$(render apply-policy)"
```

GitHub の OIDC provider（`token.actions.githubusercontent.com`）は、この account に
既にあるものを読むだけです（1 つの account に issuer ごとに 1 つしか作れません）。

### 2. GitHub 側

- [formicarium の Actions の変数](https://github.com/aletheia-works/formicarium/settings/variables/actions)
  に、次の 2 つを手で登録します。ARN には account ID が入るので、repo のコードには書きません。
  - `AWS_TOFU_PLAN_ROLE_ARN`：`arn:aws:iam::<account>:role/github-actions-formicarium-tofu-plan`
  - `AWS_TOFU_APPLY_ROLE_ARN`：`arn:aws:iam::<account>:role/github-actions-formicarium-tofu-apply`
- `aws-apply` environment（protected branch、つまり `main` だけが deploy できる）は、
  infra/github の `github_repository_environment.aws_apply` が作ります。infra/github の
  Apply が先に済んでいる必要があります。
- state の暗号化は、infra/github と同じ `TF_STATE_PASSPHRASE` を使います。
  `LATEST_AWS_APPLY_RUN_ID` は最初の Apply が作るので、登録は要りません。

### 3. 最初の Apply

`LATEST_AWS_APPLY_RUN_ID` がない間は、Plan も Apply も state なしで動きます。最初の
Apply は、import block で手作りの role と boundary を取り込み、bucket を作って、state を
保存します。それ以降は、変数が指す run の state を必ず使います（取れなければ止まります）。

## Running it locally

```bash
eval "$(aws configure export-credentials --format env)"
tofu init
tofu plan
```

A plan against an empty state proposes to create everything, so run plans in
CI, which fetches the encrypted state first.
