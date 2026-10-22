# log の見方

CloudWatch Logs Insights は使わない。log は GitHub Actions の job の log と job summary だけで、URL は query と fragment を落として書く（U8 の NFR8.6）。保持は今の設定のまま（Q4 A）。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## よく使う読取り（command）

| 目的 | command |
|---|---|
| main の最近の run の結果 | `gh run list -R aletheia-works/formicarium --branch main --limit 20 --json databaseId,workflowName,conclusion,headSha` |
| 1つの run の job の結果 | `gh run view <run-id> -R aletheia-works/formicarium --json jobs --jq '.jobs[]|"\(.name)=\(.conclusion)"'` |
| run の log の取得（読取り） | `gh run view <run-id> -R aletheia-works/formicarium --log` |
| 受入の結果 | `gh run list -R aletheia-works/formicarium --workflow migration-acceptance.yml --limit 5` |
| vivarium の docs の site の大きさ | `gh run view <run-id> -R aletheia-works/vivarium --log \| grep 'Site: '` |

## 保持（infrastructure-specification と workflow の指定、Q4 A）

| もの | 保持 |
|---|---|
| Actions の log | repository の既定 |
| showcase site の deployed の evidence | 90日（`showcase-site.yml`） |
| 受入・CI の多くの artifact | 7日（`ci.yml`・`migration-acceptance.yml`・`showcase-site.yml`） |
| showcase の一部の作業の artifact | 1日（`showcase.yml`・`showcase-site.yml`） |
