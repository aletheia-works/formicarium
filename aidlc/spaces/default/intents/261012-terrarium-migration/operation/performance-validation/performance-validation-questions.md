# Performance Validation の確認

## Sources

- performance-requirements（`../../construction/u6-recipe-runtime/nfr-requirements/performance-requirements.md`・`../../construction/u8-showcase-site/nfr-requirements/performance-requirements.md`）、`../../inception/requirements-analysis/requirements.md` の NFR1（U1・U3 の非 DL 工程の中央値 3000ms）。scalability-requirements と scalability-design の file は無い（どの Unit も作っていない。server が無いため）。
- performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）。
- dashboards（`../observability-setup/dashboards.md`）。
- `../../construction/build-and-test/build-and-test-summary.md` の性能の行（INC-NFR1・U1-NFR1.1・U3-NFR1.1・U6-NFR6.x・U8-NFR6.x は Met、U6-NFR6.4 は Unverified で Deployment Pipeline が答えた）、`../deployment-execution/smoke-test-results.md`（公開の site での U6 の受入）。

## 今の性能の目標と測り方（観測した事実）

- server・API・常時稼働のサービスは無い。性能の目標は、利用者のブラウザと Node の中での試行の時間（U1・U3：aube・Biome × 3ブラウザ × 初回＋5回、非 DL 工程の中央値 ≤3000ms）と、site の受入の時間（U6・U8：1件 ≤180秒、準備 ≤120秒）である。
- 今日（2026-10-22）、最新の道具で測り終えている：U1 の36試行（PR #68 の後、trial1–5 の非 DL 5工程の中央値の最大は biome/Firefox の 674.1ms。回答の後に訂正：前の 755.4ms は fetch を含む全工程の合計で、要件の指標ではなかった）、U3・U4 の正式な完了確認の36試行（中央値の最大は biome/Firefox の 2595.0ms）、CI の受入の36試行（中央値の最大は biome/Firefox の 2587.3ms）、showcase site の受入（3ブラウザ×16件 passed）、vivarium の公開の page の受入（12行、最大 34.5秒）。
- 配布先は GitHub Pages（CDN）と npm で、私たちの負荷試験の対象ではない。

## Q1: 負荷試験

A. 負荷試験はしない（server が無く、GitHub Pages や npm に負荷をかけるのは対象外で不適切）。性能の目標は、今日の測定を target と actual の表（nfr-validation-matrix）にまとめて確かめる（推奨）。
B. 公開の site に同時の訪問を模した試験をする（GitHub の基盤に負荷をかけることになる）。
X. Other (please specify)

[Answer]: A

## Q2: latency の指標

A. 要件のとおり、試行の中央値・初回・最大と、受入の件ごとの時間で判定する。p95・p99 は新しく足さない（試行は各組6回で、p99 に意味が無い）（推奨）。
B. p95・p99 を足す（試行の数を増やす必要がある）。
X. Other (please specify)

[Answer]: A

## Q3: 測り直し

A. 測り直さない。今日の最新の道具での測定を使う（推奨）。
B. この段階で、もう一度測る（U1 は証明書の一時登録が要る）。
X. Other (please specify)

[Answer]: A

## Assumptions & Open Questions

None.

Biome/Firefox の中央値は、正式な完了確認と CI で基準 3000ms の約86%（2587〜2595ms）で、余裕が小さい（前の CI で 2938ms もあった）。これは記録する所見で、基準は変えない。
