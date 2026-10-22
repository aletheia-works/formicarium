# GitHub settings as code

The layout and reusable Plan, Apply, fmt and state-backup workflows follow
[vivarium](https://github.com/aletheia-works/vivarium/tree/main/infra/github).
OpenTofu manages the existing repository, existing labels and the main ruleset.
Import blocks adopt these resources from an empty state.

formicarium first adopted its existing classic main protection, then moved to
a `main` ruleset like those repositories, because integrations/github 6.13.0
sent every existing check twice when it updated `github_branch_protection_v3`
([provider #3420](https://github.com/integrations/terraform-provider-github/issues/3420)).
The ruleset keeps the same settings (signed commits, no bypass for
administrators, resolved conversations and the required checks below), and
also blocks force pushes and deletion and requires linear history. The classic
protection is removed. Like paludarium and vivarium, it does not require a
branch to be up to date with main before merging.

## Required checks

| Exact check name         | Coverage                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `quality`                | Lint, types, package build and light/release tests                                                |
| `commit-format`          | Trusted base commit format validator                                                              |
| `ci-required`            | Quality, commit-format and every product build/regression matrix job                              |
| `check / Commitlint`     | Organization reusable commitlint workflow                                                         |
| `showcase-site-required` | U8 showcase site: Chromium/Firefox/WebKit acceptance, coverage and evidence (`showcase-site.yml`) |

All are bound to GitHub Actions app ID `15368` in the `main` ruleset. Product
Node and Chromium/Firefox/WebKit checks are covered by `ci-required`, which runs
with `always()` and rejects failed/skipped prerequisites. Preserve these exact
names when changing CI. Path-filtered infrastructure validation is not a global
required check, since unrelated PRs would otherwise wait for a missing check.
`showcase-site.yml` instead runs on every PR: its `changes` job decides whether
the site jobs run, and `showcase-site-required` passes a PR without site
changes and fails any other run with a failed or skipped site job.

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
   **Administration、Actions、Contents、Issues、Pull requests、Variables、Pages**。
   Metadataは自動のRead-onlyです。Organization permissionsは不要です。
   Checksという項目を追加する必要はありません。Secrets、Workflowsを管理する
   resourceは含んでいないため、その書込権限は不要です。Environmentsの権限は
   environmentのsecretと変数だけに使われ、environment自体はAdministrationで
   作るので不要です。
4. Generate tokenで発行し、必要なら組織の承認を完了します。
5. [formicarium Actions secrets](https://github.com/aletheia-works/formicarium/settings/secrets/actions)
   で `TF_TOKEN_GITHUB` を編集（なければNew repository secret）し、tokenを登録します。
   tokenは会話やtfvarsへ貼り付けません。

権限の根拠:
[GitHub fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)。
Administrationは設定・保護、Issuesはlabel・失敗通知、Pull requestsはplanコメント・
fmt、Contentsはfmtとstate backup、Actionsはstate artifact、Variablesはstate run IDに使用します。
PagesはPagesの有効化（`github_repository_pages.this`、`build_type = "workflow"`）に、
Administrationは `github-pages` environment（保護された branch だけ）にも使用します。

## Showcase site の Pages

1. token に Pages の権限があるかを確かめ、無ければ作り直して secret を更新します。
2. OpenTofu の PR を merge すると Apply されます。fork の PR では Plan が skip される
   ので、Apply の log で、Pages の作成・`github-pages` environment の作成（又は更新）
   だけで、branch の保護・label・変数に変更が無いことを確かめます。
3. その後に showcase の site と workflow の PR を merge します（先に入れると
   配布の run が Pages の無い状態で失敗します）。
4. 最初の deploy（run 39422079965）は承認者（JamBalaya56562、user ID 88115388）が
   承認しました。site を確かめた後に承認者を外したので、以降の deploy は承認なしで、
   main からだけ動きます。
5. Pages を無効にする変更は site を消すので、内容を示して承認を受けてから行います。

## Workflows and rollout

- `infra-check.yml`: fork PRでもsecretなしでfmt・init・validate。
- `terraform-plan.yml`: 同一repositoryのPRで共通Planを実行。secret付きPlanで
  forkの未信頼HCLを実行しないため、fork PRではskipします。
- `tofu-fmt-autofix.yml`: 同一repositoryのPRで共通fmtを使用。
- `terraform-apply.yml`: main変更または手動実行で共通Apply。
- `terraform-state-backup.yml`: 週次・Apply成功後・手動実行で共通backup。

`infra/github/**` を変えるPRは、mergeするとそのままApplyされます（vivariumと
同じ）。merge前にPRのPlanのcommentをレビューし、特にimport対象と必須check名を
確認します。npm公開設定・公開workflowの有効化はこのmoduleの管理対象では
ありません。

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
