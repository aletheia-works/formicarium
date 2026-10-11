# GitHub settings as code

The layout and reusable Plan, Apply, fmt and state-backup workflows follow
[vivarium](https://github.com/aletheia-works/vivarium/tree/main/infra/github) and
[terrarium](https://github.com/aletheia-works/terrarium/tree/main/infra/github).
OpenTofu manages the existing repository, existing labels and main protection.
Import blocks adopt these resources from an empty state.

Unlike those repositories' rulesets, formicarium already has classic main
protection. This module adopts it instead of adding overlapping protection.
Existing settings (including signed commits, administrators subject to checks,
up-to-date branches and resolved conversations) remain enabled.

## Required checks

| Exact check name | Coverage |
| --- | --- |
| `quality` | Lint, types, package build and light/release tests |
| `commit-format` | Trusted base commit format validator |
| `ci-required` | Quality, commit-format and every product build/regression matrix job |
| `check / Commitlint` | Organization reusable commitlint workflow |

All are bound to GitHub Actions app ID `15368`. The first three already exist in
main protection; this module adds the observed shared Commitlint check. Product
Node and Chromium/Firefox/WebKit checks are covered by `ci-required`, which runs
with `always()` and rejects failed/skipped prerequisites. Preserve these exact
names when changing CI. Path-filtered infrastructure validation is not a global
required check, since unrelated PRs would otherwise wait for a missing check.

## Secret setup (日本語)

`TF_TOKEN_GITHUB` は既に登録されています（値は参照していません）。そのtokenの
権限が以下を満たせば再作成は不要です。不足している場合は本人の操作で更新します。

1. `aletheia-works` を管理できるアカウントで
   [Fine-grained token作成](https://github.com/settings/personal-access-tokens/new)
   を開きます。Token nameは `formicarium-opentofu`、Descriptionは
   `Manage formicarium GitHub settings and OpenTofu state through GitHub Actions`。
   有効期限を設定します。
2. Resource ownerを `aletheia-works`、Repository accessを
   **Only select repositories → formicarium** にします。
3. Repository permissionsで次を **Read and write** にします。
   **Administration、Actions、Contents、Issues、Pull requests、Variables**。
   Metadataは自動のRead-onlyです。Organization permissionsは不要です。
   Checksという項目を追加する必要はありません。Secrets、Pages、Environments、
   Workflowsを管理するresourceは今回含んでいないため、その書込権限も不要です。
4. Generate tokenで発行し、必要なら組織の承認を完了します。
5. [formicarium Actions secrets](https://github.com/aletheia-works/formicarium/settings/secrets/actions)
   で `TF_TOKEN_GITHUB` を編集（なければNew repository secret）し、tokenを登録します。
   tokenは会話やtfvarsへ貼り付けません。

権限の根拠:
[GitHub fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)。
Administrationは設定・保護、Issuesはlabel・失敗通知、Pull requestsはplanコメント・
fmt、Contentsはfmtとstate backup、Actionsはstate artifact、Variablesはstate run IDに使用します。

## Workflows and rollout

- `infra-check.yml`: fork PRでもsecretなしでfmt・init・validate。
- `terraform-plan.yml`: 同一repositoryのPRで共通Planを実行。secret付きPlanで
  forkの未信頼HCLを実行しないため、fork PRではskipします。
- `tofu-fmt-autofix.yml`: 同一repositoryのPRで共通fmtを使用。
- `terraform-apply.yml`: main変更または手動実行で共通Apply。
- `terraform-state-backup.yml`: 週次・Apply成功後・手動実行で共通backup。

Applyとbackupはrepository variable `FORMICARIUM_INFRA_APPLY_ENABLED=true` が
設定されるまでskipします。導入PRのmergeだけでは設定を書き換えません。
有効化前にPlanをレビューし、特にimport対象と必須check名を確認します。
有効化と初回Applyは別途承認して実行します。npm公開設定・公開workflowの
有効化はこのmoduleの管理対象ではありません。

共通workflowは同じstate artifact名でPlan/Apply/backupを直列化します。
正本はActions artifact `terraform-state`、場所はvariable `LATEST_APPLY_RUN_ID`。
backupはstate-backupタグのGitHub Release assetとartifact更新を使用します。
公開repositoryのstateには秘密を入れません。tokenをresourceとして管理しません。
stateの消失時は新規Applyせずbackupから復旧してください。

## Local verification

```sh
mise run infra:init -- -backend=false
mise run infra:fmt -- -check
mise run infra:validate
```

ローカルPlanは既存stateがあれば先に正しい `LATEST_APPLY_RUN_ID` のartifactを
取得して `infra/github/terraform.tfstate` に復元します。初回はimport blockで取り込みます。
本人の環境で `GITHUB_TOKEN` を設定して `mise run infra:plan` を実行します。
CIと同時のローカルApplyは行いません。state・tfvars・planはgitignoredです。
