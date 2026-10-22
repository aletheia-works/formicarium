# 異常の検知

自動の異常の検知は入れない（Q5 A）。異常には、run の失敗（基準を下回った試験・受入・coverage・site の大きさの確認の失敗）と、summary の値（最後の deploy からの日数、site の大きさ・最大の file・deploy の時間）で気づく。

## Sources

`observability-setup-questions.md`（人間の回答：Q1〜Q5 すべて A、2026-10-22）、monitoring-design（`../../construction/u8-showcase-site/infrastructure-design/monitoring-design.md` と U1・U5・U6・U7 の同じ file）、security-design（`../../construction/u8-showcase-site/nfr-design/security-design.md` の S20）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、infrastructure-specification（各 Unit の `infrastructure-design/infrastructure-specification.md`）、reliability-design は無い（どの Unit も作っていない）、`../deployment-execution/health-check-report.md`、`../deployment-pipeline/deployment-strategy.md`。

## 人が見る値と、気にする目安（目標ではない）

| 値 | 目安 |
|---|---|
| 最後に deploy した run からの日数 | main に変更があったのに増えていれば、配布が止まっている |
| site 全体の大きさ | 1 GB（失敗の基準）に近づいていないか（2026-10-22：formicarium 148.5 MB、vivarium 235.6 MB） |
| 最大の file | 急に大きくなっていないか（2026-10-22：formicarium 83.5 MB、vivarium 112.6 MB） |
| deploy の時間 | 10分（timeout）に近づいていないか（2026-10-22：約13.3秒） |
| 受入の時間 | 基準（U1・U3 の 3000ms、U6・U8 の 120秒・180秒）に近づいていないか |
