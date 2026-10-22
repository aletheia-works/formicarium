# 環境の確認の報告

## Sources

`environment-inventory.md`、`environment-provisioning-questions.md`、GitHub REST の読取り（2026-10-22）、formicarium の upstream main の `infra/github/main.tf`・`labels.tf`・`release.tf`、`.artifacts/deployment-pipeline/repo-actual.json`（repository の設定の読取りの写し）。

## 1. 用意（provision）

AWS の環境は用意していない（Q1 A）。GitHub の環境は前の段階と OpenTofu で用意済みで、この段階では変えていない。stack の deploy の log は無い。

## 2. OpenTofu の設定と実際の状態（Q2 A、読取りだけ。`terraform-plan.yml` は起動していない）

| 管理の項目 | 結果 |
|---|---|
| repository の設定（description・homepage・topics・visibility・has_issues・has_discussions・has_projects・has_wiki・allow_merge_commit・allow_squash_merge・allow_rebase_merge・allow_auto_merge・delete_branch_on_merge・web_commit_signoff_required・archived） | 一致（違いなし） |
| Pages（build_type `workflow`） | 一致 |
| environment `github-pages`（protected branch だけ、reviewers なし） | 一致 |
| ruleset `main` の必須の check（5つ） | 一致 |
| variable `RELEASE_AUTOMATION_ENABLED`・`WEEKLY_RELEASE_MERGE_ENABLED`（既定 true・false） | 一致（true・false） |
| label（`labels.tf` の23件の名前・色・説明） | 一致。GitHub には管理の外の label が3つある（`priority: p0`・`scope: infra`・`status: apply-failure`）。`github_issue_label` は label ごとの resource なので、plan の差にはならない。repository の中で使う所は見つからない |

- 制約：この突き合わせは私が `.tf` の値を読んで比べたもので、OpenTofu の plan ではない。ruleset の bypass や対象の branch の条件、label 以外の resource の全ての属性までは比べていない（未検証）。`terraform-plan.yml` の最近の2つの run（39602237414・39528786145）は skipped。

## 3. secret と variable（名前だけ。値は読んでいない）

- formicarium の secret は `TF_TOKEN_GITHUB` だけ。npm の公開は Trusted Publishing（OIDC、`id-token: write`）で、npm の token の secret は無い。
- vivarium の bump の bot の `BOT_PRIVATE_KEY`・`BOT_CLIENT_ID` は repository の一覧に無い。organization の設定にあると見込む（未検証）。
- npm の Trusted Publishing の信頼先は未検証（Q4 B）。

## 4. 保護の状態

- 公開の経路の承認：npm は release PR の merge（formicarium の `release` environment に reviewers なし。人間の決定）。vivarium の guest の Release は `fixed-guest-release` の required reviewers。
- Pages の deploy：formicarium は protected branch（main）だけ、vivarium は custom branch policy。
- 使っていない environment `production` が両方の repository にある（保護の規則なし、workflow から使われない）。所見として残す。消すかどうかは後で人間が決める（Q3 A）。

## 5. 環境の健康の確認

- formicarium の Pages：`https://aletheia-works.github.io/formicarium/` は、2026-10-22 の showcase site の run 39761271174 の verify-deployment が success。
- vivarium の Pages：deploy-docs の run 39760158634 が success。
- npm：`latest: 0.3.0` を読めた。

## 判定

AWS の用意は対象外。GitHub の環境は OpenTofu の設定と一致し、保護は前の段階の決定どおり。残る所見：使っていない `production` environment（両方）、管理の外の label 3つ、npm の Trusted Publishing の信頼先と bot の secret の置き場所が未検証、OpenTofu の plan そのものは実行していない。
