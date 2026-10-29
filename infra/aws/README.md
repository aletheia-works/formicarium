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
| [relay.tf](relay.tf)     | The relay's MicroVM image, its build role and the token function with its URL              |

The relay is paludarium's `relay.mjs`, at the version the package's core
comes from, built into a MicroVM image of the smallest size (0.5 GB). Only
the Cloud Control resource (`hashicorp/awscc`) sets an image's memory and
hooks, so the image uses it, and the CI roles may call Cloud Control. The
relay connects only to `github.com:443`, and accepts WebSockets only from
`https://aletheia-works.github.io`. Cloud Control requires an image's OS
capabilities and hooks, and awscc drops empty values, so the image takes the
only capability value, `ALL`, which applies inside the MicroVM only (it has no
execution role, so no AWS credentials), and lists every hook as disabled.

No MicroVM is kept in the state: the platform ends a MicroVM after at most 8
hours. The token function ([relay-token/index.mjs](relay-token/index.mjs))
finds the shared MicroVM or starts one when none is running, and hands the
page its URL and a token for the relay's port that expires in 15 minutes.
The MicroVM suspends after 5 minutes without traffic and ends after an hour
suspended. The function's URL is public, since a GitHub Pages site can hold
no secret; it answers only the site's origin, and the relay reaches only
`github.com:443`, so a client outside a browser can at most use the relay to
reach GitHub.

That client can also keep the MicroVM busy, so the cost is bounded by count,
not by who calls: there is one shared MicroVM of the smallest size, and the
function runs at most 2 at once (reserved concurrency, which also leaves the
account's other stacks their share). At about $0.03 an hour for 0.5 GB and
0.25 vCPU running (us-east-1 rates; check the Lambda pricing page), a MicroVM
kept running all month costs about $25, plus its traffic. The cap bounds cost,
not availability: such a client can hold both of the function's slots, and
visitors then get Lambda's 429 until it stops. Its tests need no
AWS account: `node --test relay-token/`.

The MicroVM base image's version is pinned in `relay.tf`. When Lambda
deprecates it, update `relay_base_image_version` to the version that
`aws lambda-microvms list-managed-microvm-image-versions` lists as
`AVAILABLE`.

## Why the CI roles are narrow

The account also runs other stacks, so neither role uses an account-wide
managed policy.

Both read through `tofu-read` ([bootstrap/read-policy.json.tftpl](bootstrap/read-policy.json.tftpl)):
the settings of `formicarium-*` buckets, the objects under `relay/` in the
relay's artifact bucket (the relay's Dockerfile, which a refresh reads, and no
object in any other bucket), their own functions, MicroVM images and
`/formicarium/*` log groups, IAM, and Cloud Control reads, which the awscc
resource refreshes through. Cloud Control has no resource-level permissions,
so these are on `*`; Cloud Control acts with the caller's own permissions, so
they reach no more than the rest of the policy. This matters most for the
plan role, which every workflow of this repository can assume, since the plan
workflow runs on `pull_request_target`.

Beyond that, the apply role, which only the `aws-apply` environment on `main`
can assume, may write only `formicarium-*` buckets, functions, MicroVM images
and `/formicarium/*` log groups, through Cloud Control too (its writes are on
`*` for the same reason). Lambda checks three actions against no resource:
it may create a MicroVM image only with the tag `Project = formicarium`; it
may call `TagResource` on `*` with that tag too, because tagging an image as
it is created is checked against `*` and IAM cannot tell that call from a
later one, so it can add that one tag to any Lambda resource in the account;
and it may pass network connectors, which the
relay's image and MicroVM use. It may create a `formicarium-*` role only
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

### CI の role と boundary を変えるとき

`bootstrap/` の template を変えた PR は、マージの前に、変えた policy を同じ template から手で更新します
（apply の role はこれらを変えられないので、更新しないと Apply が失敗します）。inline policy は
`aws iam put-role-policy`、boundary は `aws iam create-policy-version --set-as-default` です。手順 1 の
`render()` をそのまま使えます。

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
