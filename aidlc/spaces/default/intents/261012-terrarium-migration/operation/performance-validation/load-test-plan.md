# 負荷試験の計画

負荷試験はしない（Q1 A）。

## Sources

`performance-validation-questions.md`（人間の回答：Q1〜Q3 すべて A、2026-10-22）、performance-requirements（`../../construction/u6-recipe-runtime/nfr-requirements/performance-requirements.md`・`../../construction/u8-showcase-site/nfr-requirements/performance-requirements.md`、`../../inception/requirements-analysis/requirements.md` の NFR1）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、scalability-requirements と scalability-design は無い（server が無く、どの Unit も作っていない）、dashboards（`../observability-setup/dashboards.md`）、`../../construction/build-and-test/build-and-test-summary.md`・`test-results.md`、`../deployment-execution/smoke-test-results.md`。

## 理由

- server・API・常時稼働のサービスが無い。formicarium は library（npm）で、利用者のブラウザと Node の中で動く。site は GitHub Pages の静的な配布で、配布の基盤は GitHub のもの。
- GitHub Pages や npm に負荷をかけるのは、私たちの試験の対象外で、不適切である。
- 転送量の上限（Pages の月 100 GB の soft limit）は監視しない（`../deployment-pipeline/deployment-strategy.md`）。

## 代わりの確認

性能の目標は、利用者の環境の中での試行と受入の時間である。今日（2026-10-22）、最新の道具で測った値を `load-test-results.md` にまとめ、`nfr-validation-matrix.md` で目標と比べる（Q3 A：測り直さない）。指標は要件のとおり、試行の中央値・初回・最大と、受入の件ごとの時間（Q2 A：p95・p99 は足さない）。
