# smoke test の結果

## Sources

`deployment-log.md`、`deployment-execution-questions.md`（Q2 A）、`.artifacts/deployment-execution/`（取得した evidence と、公開の site での受入の出力）、`../../construction/build-and-test/build-and-test-summary.md`（U6-W5・U8-NFR8.1b・U8-NFR8.10 を後の段階に回した行）。

## 1. formicarium の公開の site の identity（U8-NFR8.10）

- `curl https://aletheia-works.github.io/formicarium/site-identity.json`（2026-10-22）：`sourceCommit` `1bdd984a6f75b0cc0d3fcbe3ecfbf89a0b0ded9e`、`runNumber` 58、`candidateId` `7a1e94d5…3881`。
- GitHub REST の `repos/aletheia-works/formicarium/commits/main`：`1bdd984a6f75b0cc0d3fcbe3ecfbf89a0b0ded9e`。
- **一致**。公開の site は main の最新の commit を配布している。

## 2. 配布した run の証拠（U8-NFR8.1b）

- 人間の承認で run 39761271174 の artifact `showcase-site-evidence-39761271174-deployed` を取得した（`.artifacts/deployment-execution/evidence-39761271174/`）。
- `evidence.json`（SHA256 `dbb27cc1…dd10`）：unit `u8-showcase-site`、sourceCommit `1bdd984a…`、recordedAt 2026-10-22T10:48:43.902Z、identity 7、**checks 27（すべて passed）**、deployedIdentity `bb323d2f…`。

## 3. vivarium の公開の page での受入（U6-W5）

- `node .artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs <browser>` を Chromium 156.0.8078.4・Firefox 157.0・WebKit 27.2 で1つずつ実行した（2026-10-22T11:00:37Z〜11:03:09Z、`https://aletheia-works.github.io/vivarium/repro/biome/migrate-override-bracket-spacing/` と ja の page、retry なし、1回の訪問の上限 120秒、1組の上限 180秒）。出力：`.artifacts/deployment-execution/w5/<browser>.json`。
- 3ブラウザとも `passed: true`。12行（3ブラウザ × en・ja × 初回・再訪問）すべてで verdict `reproduced`、baseline と fix の error なし、page は crossOriginIsolated・SharedArrayBuffer、service worker が制御中、`coepCredentialless` false。
- 時間（elapsedMs）：Chromium 4752〜15551、Firefox 11460〜34455、WebKit 5259〜6113。最も遅いのは Firefox の en の初回 34.5秒（上限 120秒）。
- 実機の Safari は未検証（WebKit は Playwright の同梱版）。

## まとめ

| Target ID | 結果 |
|---|---|
| U8-NFR8.10 | Met（公開の `site-identity.json` が main の最新と一致） |
| U8-NFR8.1b | Met（今の source を配布した run の deployed の evidence、27 checks passed） |
| U6-W5 | Met（公開の site で12行 passed） |
