# SLO・SLI

数値の SLO は置かない（Q2 A。U8 の NFR Requirements の「訪問者向けの新しい目標を置かない」方針）。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## 記録する SLI（目標なし）

| SLI | 測り方 | 記録の場所 |
|---|---|---|
| 最後に deploy した run からの日数 | showcase site の summary の job | run の summary |
| main の workflow の成功の割合 | Actions の run の結果 | Actions の画面 |
| site の大きさ・最大の file・deploy の時間 | build と deploy の summary、`check-site.json` | run の summary と artifact |
| 公開の site の受入の時間（U6・U8） | 受入の attachment・`.artifacts/deployment-execution/w5/` | artifact と記録 |

性能の基準（U1・U3 の非 DL 工程の中央値 3000ms、U8 の1件 180秒・準備完了 120秒など）は、受入と CI の試験の基準として既に強制されている（performance-design）。ここで新しい目標は足さない。
