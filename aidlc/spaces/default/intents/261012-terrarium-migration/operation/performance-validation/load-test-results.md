# 性能の測定の結果（2026-10-22、最新の道具）

## Sources

`performance-validation-questions.md`（人間の回答：Q1〜Q3 すべて A、2026-10-22）、performance-requirements（`../../construction/u6-recipe-runtime/nfr-requirements/performance-requirements.md`・`../../construction/u8-showcase-site/nfr-requirements/performance-requirements.md`、`../../inception/requirements-analysis/requirements.md` の NFR1）、performance-design（`../../construction/u6-recipe-runtime/nfr-design/performance-design.md`・`../../construction/u8-showcase-site/nfr-design/performance-design.md`）、scalability-requirements と scalability-design は無い（server が無く、どの Unit も作っていない）、dashboards（`../observability-setup/dashboards.md`）、`../../construction/build-and-test/build-and-test-summary.md`・`test-results.md`、`../deployment-execution/smoke-test-results.md`。

## 1. U1 の初回の試行（公式の資産、HTTPS の mirror、36試行）

- PR #68 の後の main の source（`e915bf48`、同じ tree は `2f77d308`）、Node 26.12.1、Playwright 1.64.1、Chromium 156・Firefox 157・WebKit 27.2、1 worker、retry なし。記録：`.artifacts/ws-biome/.artifacts/migration-preflight/mirror-browser-20261022b/trials/`（36 file、OS `Darwin 27.0.0 arm64`、CPU `Apple M1 x8`、負荷の記録あり）。
- trial1–5 の非 DL 5工程の中央値（Build and Test の品質担当の集計）：aube chromium 460.7・firefox 515.3・webkit 489.0、biome chromium 586.5・firefox 674.1・webkit 457.3 ms。5工程の最大 871.1 ms。36 passed。

## 2. U3 の正式 install の試行（36試行）

| 測定 | aube chromium | aube firefox | aube webkit | biome chromium | biome firefox | biome webkit |
|---|---|---|---|---|---|---|
| 正式な完了確認（手元、`completion-934d4082-…/measurement/measurement-report.json`）の中央値 ms | 673.9 | 1639.4 | 692.5 | 903.9 | **2595.0** | 1013.7 |
| CI の受入 run 39709015067 の中央値 ms | 1091.9 | 1818.6 | 1115.3 | 1421.4 | **2587.3** | 1404.2 |

どちらも `passed: true`、基準 3000 ms。

## 3. site の受入の時間

- formicarium の showcase site（run 39761271174、main `1bdd984a`）：accept-chromium 16 passed（6.1分）、accept-firefox 16 passed（3.4分）、accept-webkit 16 passed（3.0分）。各件の上限 180秒・準備 120秒は試験が強制し、すべて passed。
- vivarium の公開の page（`../deployment-execution/smoke-test-results.md`）：12行 passed、elapsedMs は Chromium 4752〜15551、Firefox 11460〜34455、WebKit 5259〜6113（上限 120秒）。

## 4. 配布の大きさと時間

- formicarium の site 全体 148,507,859 bytes（上限 1 GB）、最大の file 83,524,512 bytes、deploy 約13.3秒（上限10分）。vivarium の docs 235,607,368 bytes、最大の file 112,564,936 bytes。

## 所見

- **biome/Firefox の U3 の中央値の余裕が小さい**：2587〜2595 ms で基準 3000 ms の約86%（前の CI では 2938 ms もあった）。基準は変えない。超えたときは、基準を変えずに止め、負荷を確かめて測り直す（前からの運用）。
- U1 の新しい試行は、修正の前（Build and Test の1回目、Firefox の中央値 2245〜2478 ms、全工程の合計）より速い。理由は確かめていない（測定の条件の違いの可能性。U1 のレビューの N-03）。
- 実機の Safari は未検証（WebKit は Playwright の同梱版）。
