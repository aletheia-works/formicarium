# 観測の一覧（dashboard の代わり）

dashboard は作らない（Q1 A）。server は無く、CloudWatch は使わない。次の画面と記録を見る。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## 見る所

| 信号 | どこで見るか | 何に気づくか |
|---|---|---|
| main の各 workflow の run の結果（CI・Showcase guests・Showcase site・Release・Check Conventional Commit、vivarium の deploy-docs・repro-regression・Test docs） | GitHub の Actions の画面（`gh run list --branch main`） | build・試験・配布の失敗 |
| showcase site の summary の job（最後に deploy した run からの日数、失敗した job） | Showcase site の run の summary | 配布が止まっていること、どの job が落ちたか |
| site の大きさ・最大の file（build の summary と `check-site.json`）、deploy の時間（deploy の job の summary） | Showcase site の run | Pages の上限（1 GB、deploy 10分）に近づくこと（`../deployment-pipeline/deployment-strategy.md`） |
| vivarium の docs の site の大きさ・最大の file | deploy-docs の run の log と summary | 同上 |
| 公開の site の `site-identity.json` と main の一致 | `curl https://aletheia-works.github.io/formicarium/site-identity.json` と `gh api repos/aletheia-works/formicarium/commits/main` | 公開の site が main と違うこと |
| npm の dist-tags | `npm view @aletheia-works/formicarium dist-tags` | 公開・切戻しの状態 |
| 受入（手動）の結果 | `migration-acceptance.yml` の run と artifact | U2〜U4 の受入の失敗 |
