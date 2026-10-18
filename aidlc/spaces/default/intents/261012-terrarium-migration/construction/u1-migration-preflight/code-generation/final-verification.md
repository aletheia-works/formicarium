# U1 最終検証の観測記録

記録種別は observed-command-summary。以下はmain sessionで観測した実コマンド・結果の要約であり、全文ログではない。

## 既存consumer

`FORMICARIUM_CANDIDATE=/Users/mutoakio/Documents/formicarium/.artifacts/migration-preflight-baseline-package.manifest.json FORMICARIUM_CONSUMER=/private/tmp/formicarium-migration-preflight-consumer mise run test-consumer`

検証済み：exit0、189pass/0fail/0skip、16698.8ms。実pack tgz SHA256742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30ca、外部consumerの全file一致検査を含む。

## 既存Node回帰

`/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/node/build.test.js tests/node/probe.test.js tests/node/aube-1645.test.js`

検証済み：exit0、28pass/0fail/0skip、7083.6ms。native aube基準値一致、probe8項目、既存コア回帰、wasm上限検査を含む。consumerとNode回帰時のjjソース観測fb601c57b0c94c27789a630bef4b692285578988。

## 既存ブラウザ回帰

最初のサンドボックス実行は33件がbrowser launch前に失敗。Chromiumログ「bootstrap_check_in ... Permission denied (1100)」。試験本体の検証結果とは扱わない。元traceはtest-results/へ残し、試験の意味を変えず必要ホスト権限で再実行した。

`/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test tests/browser/probe.spec.ts tests/browser/aube-1645.spec.ts --workers=1 --retries=0 --output .artifacts/migration-preflight/browser-regression-final-v1`

検証済み：exit0、33pass/0fail/0skip、41.4s、Chromium/Firefox/WebKit、1worker/retry0、aube native出力一致。probe600s/aube840s条件は変更していない。実Safariは未検証。

## 発行者情報の統合修正

ユーザー承認後、`node .artifacts/migration-preflight/assemble-acceptance-evidence.mjs` exit0。36行、実CI first/reuse/input/build-infoのbyte copy一致を確認。tlsIssuerは各ブラウザの原値を別keyで保存し、WebKitのnot-TLSを改変しない。`assessEvidence`による実36行＋実baselineの構造検証exit0、全6組合せの非ダウンロード中央値≤3000ms。元trial JSON・共通certificateFingerprint・TLS検証条件は変更なし。

## カバレッジ

固定実packに対するprepareで14ファイルの実source SHAと固定分母を準備。Nodeのcoverage-node-preloadを用いた12suiteは115pass/0fail/0skip、exit0（6482.4ms）。ブラウザの固定4specはChromium/Firefox/WebKitの99pass/0fail/0skip、exit0（9.3m）、1worker/retry0。

収集準備では全spec指定でexternal consumer required、.spec.jsフィルタでNo tests foundとなり、試験本体は未実行。専用playwright.coverage.config.mjsとsuffixless4フィルタで予定99件のlist確認後に実行した。分母・計測対象・試験設定は維持。

`/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/package/coverage.js report .artifacts/migration-preflight/coverage-final-v1 .artifacts/migration-preflight/coverage-final-v1/browser-results .artifacts/migration-preflight-baseline-package.manifest.json`

検証済み：exit0、982行中862行、87.78%、skipped0、1253realms、passed=true。固定14ファイル、予定host/Worker inventoryと実pack同一性をcollectorが照合した。

## 完了確認入口のビルド停止

`mise run build` はexit1。completion.ts:94でTS7053、必須入力名の配列がstring[]と推論されVerificationInputのindexに使えない。typecheckと追加3境界試験を含む単体全件は未実行。配列をas constにする型修正案を人間確認中。上記coverage成功と実36行・実CI成功は保持。共通完了検証コマンドの確定・独立レビュー・U1完了はまだ行っていない。

ユーザー承認後、必須入力項目名配列へas constを追加。main `mise run build` exit0、`mise run typecheck` exit0、`mise run migration-preflight-unit` exit0、55pass/0fail/0skip（833.929ms）。追加の必須入力欠落・子失敗で後続停止・所有済みlock保持の3境界も成功。再検証後のjjソース観測29e04c3a109cb74ea0257c1ec33639476c8b58c1。共通完了検証コマンドの実行は人間承認前なので未実施。
