# 分散の tracing

入れない（Q5 A）。server が無く、library と静的な site なので、tracing の対象が無い。X-Ray は使わない。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## 代わりに使う記録

- 受入の件ごとの時間と工程（U1・U3 の trial の `phasesMs`、U6・U8 の受入の attachment）。
- 試験の log（Node・ブラウザ）。
