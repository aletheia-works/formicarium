# 環境の一覧

人間の回答（`environment-provisioning-questions.md`、2026-10-22）：Q1 A（AWS の用意はしない。GitHub と npm の環境を読取りだけで確かめる。secret の値は読まない）、Q2 A、Q3 A、Q4 B。

## Sources

infrastructure-specification（`../../construction/u1-migration-preflight/infrastructure-design/infrastructure-specification.md`・`u5-fixed-guest-build`・`u6-recipe-runtime`・`u7-showcase-guests`・`u8-showcase-site` の同じ file。どれも GitHub Actions・GitHub Release・GitHub Pages・npm を使い、AWS を使わない）、GitHub REST の読取り（2026-10-22。`gh api` の `repos/<repo>`・`environments`・`actions/secrets`・`actions/variables`・`pages`・`rulesets`・`labels`）、formicarium の upstream main の `infra/github/*.tf`・`.github/workflows/*.yml`、vivarium の main の `.github/workflows/*.yml`、`../deployment-pipeline/cd-config.md`。

## AWS

使わない。VPC・subnet・security group・NACL・Secrets Manager・Parameter Store・アカウントをまたぐ接続は無い（Infrastructure Design と CD の構成のどれも AWS を使わない）。

## GitHub：aletheia-works/formicarium

| 項目 | 値 | 使う所・管理 |
|---|---|---|
| environment `github-pages` | branch policy：protected branch だけ。required reviewers なし | `showcase-site.yml` の deploy。OpenTofu（`main.tf` の `github_repository_environment.github_pages`） |
| environment `release` | 保護の規則なし | `publish.yml`（2つの job）。npm の Trusted Publishing。公開の承認は release PR の merge（`../deployment-pipeline/deployment-strategy.md`） |
| environment `production` | 保護の規則なし | どの workflow も使わない（`.github/workflows/*.yml` に `environment: production` は無い）。所見 |
| secret（名前だけ） | `TF_TOKEN_GITHUB` | OpenTofu の workflow（plan・apply・state-backup） |
| variable（名前だけ） | `FORMICARIUM_MODERNIZATION_INPUT_SHA256`・`_URL`、`FORMICARIUM_RELEASE_INPUT_SHA256`・`_URL`、`LATEST_APPLY_RUN_ID`、`RELEASE_AUTOMATION_ENABLED`（true）、`WEEKLY_RELEASE_MERGE_ENABLED`（false） | 候補の検証の入力、OpenTofu の apply の記録、release の自動化（`release.tf`） |
| Pages | build_type `workflow`、https あり、`https://aletheia-works.github.io/formicarium/` | `showcase-site.yml`。OpenTofu（`github_repository_pages.this`） |
| ruleset `main` | active。必須の check：`quality`・`commit-format`・`ci-required`・`check / Commitlint`・`showcase-site-required` | OpenTofu（`github_repository_ruleset.main`） |
| label | 26（OpenTofu の管理は23） | OpenTofu（`labels.tf`、label ごとの `github_issue_label`） |

## GitHub：aletheia-works/vivarium

| 項目 | 値 | 使う所 |
|---|---|---|
| environment `fixed-guest-release` | required reviewers と custom branch policy | `fixed-guest-release.yml`（guest の Release） |
| environment `github-pages` | custom branch policy | `deploy-docs.yml` |
| environment `production` | 保護の規則なし | どの workflow も使わない（`production` の一致は語「reproduction」の中だけ）。所見 |
| secret（名前だけ） | `PROJECTS_TOKEN`、`TF_TOKEN_GITHUB` | project の連携、OpenTofu |
| secret・variable（repository の一覧に無い） | `BOT_PRIVATE_KEY`・`BOT_CLIENT_ID`（`fixed-guest-bump.yml` が使う） | organization の設定にあると見込む（推測、未検証） |
| variable（名前だけ） | `LATEST_APPLY_RUN_ID` | OpenTofu の apply の記録 |
| Pages | build_type `workflow`、https あり、`https://aletheia-works.github.io/vivarium/` | `deploy-docs.yml` |
| ruleset `main` | active。必須の check：`Unit (resolveReproFile)`・`Polyglot lint`・`check / Commitlint`・`E2E (firefox|webkit|chromium)`・`Test MCP server`・`regression (firefox|webkit|chromium)` | vivarium の OpenTofu |

## npm

| 項目 | 値 |
|---|---|
| package | `@aletheia-works/formicarium`、dist-tags `latest: 0.3.0`・`next: 0.1.0-rc.1`（2026-10-22 の `npm view`） |
| Trusted Publishing の信頼先 | 未検証（npmjs.com の package の設定はログインが要る。人間の回答 Q4 B） |
