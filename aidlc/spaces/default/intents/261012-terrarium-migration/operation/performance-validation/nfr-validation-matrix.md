# 非機能要件の確認の表（目標と実際）

## Sources

`performance-validation-questions.md`（人間の回答：Q1〜Q3 すべて A、2026-10-22）、performance-requirements（`../../construction/u6-recipe-runtime/nfr-requirements/performance-requirements.md`・`../../construction/u8-showcase-site/nfr-requirements/performance-requirements.md`、`../../inception/requirements-analysis/requirements.md` の NFR1）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、scalability-requirements と scalability-design は無い（server が無く、どの Unit も作っていない）、dashboards（`../observability-setup/dashboards.md`）、`../../construction/build-and-test/build-and-test-summary.md`・`test-results.md`、`../deployment-execution/smoke-test-results.md`。

## 目標と実際

| ID | 目標 | 実際（2026-10-22、最新の道具） | 判定 |
|---|---|---|---|
| NFR1（INC-NFR1） | aube・Biome × 3ブラウザ、trial1–5 の非 DL 5工程の中央値 ≤3000 ms、初回・最大・fetch は別 | U1：最大の中央値 674.1 ms。U3 の正式：最大の中央値 2595.0 ms（biome/Firefox）。CI：2587.3 ms | Met（biome/Firefox の余裕は小さい） |
| U1-NFR1.1 | 36行が一意、中央値 ≤3000 ms | 36 passed、36 file、最大の中央値 674.1 ms | Met |
| U1-NFR1.2 | 1 worker、環境・版・負荷・sourceCommit を記録 | 1 worker、OS・CPU・負荷・testSourceCommit を記録 | Met |
| U3-NFR1.1 | 正式 install の36試行で中央値 ≤3000 ms | 正式な完了確認と CI の両方で passed | Met |
| U6-NFR6.1 | 3ブラウザ × en・ja の各件 ≤180秒、retry 0 | 手元の Playwright（Build and Test）と公開の page（12行、最大 34.5秒） | Met |
| U6-NFR6.2 | 取得は 120秒で TIMEOUT、bytes と時間を記録 | 試験と公開の page の受入（verdict 120秒の上限） | Met |
| U6-NFR6.4 | site 全体が Pages の上限以下 | vivarium の docs 235,607,368 bytes（上限 1 GB、公式の文書） | Met |
| U8-NFR6.1 | 各件 ≤180秒、準備 ≤120秒、retry 0、1 worker、16件 | run 39761271174 で3ブラウザ × 16 passed | Met |
| U8-NFR6.2 | 取得の 120秒・180秒、bytes と時間を記録 | 同じ受入で passed | Met |
| U8-NFR6.4 | site 全体 <1073741824 bytes | 148,507,859 bytes、最大の file 83,524,512 bytes | Met |
| U8-NFR6.4b | Pages の1 file の上限と転送量 | 公式の文書に1 file の上限は無い。最大の file を build ごとに記録。転送量は監視しない（soft limit） | Met（記録の範囲） |
| 負荷（throughput・同時の利用者） | — | server が無いので対象外（Q1 A） | N/A |
| 実機の Safari | — | 未検証（WebKit は Playwright の同梱版） | 未検証 |

## まとめ

性能の目標（NFR1、U1・U3・U6・U8 の時間と大きさ）は、今日の最新の道具での測定ですべて満たす。負荷は対象外（server が無い）。biome/Firefox の U3 の中央値は基準 3000 ms の約86% で余裕が小さく、実機の Safari は未検証。どちらも所見として残し、基準は変えない（`load-test-results.md`）。
