# Unit Test Instructions — U2 Guest Distribution

## Framework and Readiness

Node>=24/node:test、Playwright、TypeScript、Biomeを使用する。ソースは.ts、正式buildでemitした実行対象は.js。mainのみが各commandを逐次実行する。mise実体は実行前に確認し、shim/mise execを使用しない。既存成功結果はcode-summary.mdに保持するが、今回修正後の成功証拠へ流用しない。

## Build and Unit-scoped Commands

package.jsonの正式buildと同じ3段階を一つずつ実行する。共通buildはU2試験の前提であり、project全体のtest commandは呼ばない。emitは既存のruntime/scripts/integration/testsのcompiled JSを既定配置へコピーする。build/config/閾値を緩めない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.tests.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node .build/scripts/emit.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/manifest.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/fixtures.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/resolver.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/stage.test.js
U2_ACTUAL_SITE=.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/integration.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc --project tests/guest-distribution/tsconfig.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@biomejs/biome/bin/biome check integration/terrarium/guest-distribution/manifest.ts integration/terrarium/guest-distribution/fixtures.ts integration/terrarium/guest-distribution/resolver.ts scripts/guest-distribution/coverage.ts scripts/guest-distribution/stage.ts scripts/coverage-types.ts tests/guest-distribution/stage.test.ts tests/guest-distribution/integration.test.ts tests/guest-distribution/consumer.spec.ts tests/guest-distribution/serve.ts
U2_ACTUAL_SITE=.artifacts/u2-guest-distribution/site-v2 PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/guest-distribution/playwright.config.ts tests/guest-distribution/consumer.spec.ts --workers=1 --retries=0
```

consumer tsconfig.jsonはNodeNext/strict/noEmit、files=[types.ts]。Playwright config.tsはconsumer.spec.tsを選びserve.jsを起動するため、build/emitを先に完了する。runnerの起動失敗を製品のRedとして扱わない。probe/aube/pitchforkの重い実行suiteをU2で重複起動しない。

## Repair Regressions and Oracles

通常実装はtest-after。今回の不具合修正は再現試験追加→正式build→main Red→修正→正式build→同じmain試験Greenとする。各componentは5–8ケース群、normalと2つ以上のerror/edgeを含め、AC4.3.1–3を全件検証する。

collector self-testへ、使用済みdirectoryの再prepareとsource/candidate変更後の旧receipt採用を再現する試験を追加する。修正後は使用済みdirectory再prepareを拒否し、新規directoryへの旧receiptコピーもpreparation identity/sourceIdentity/candidate digestの照合で拒否する。Node/browser realm/case欠落は失敗とする。共有scripts/coverage-types.tsの既存generation/sourceIdentity/candidateSha256 fieldsを保持し、U2に必要な最小型変更だけ行う。

producer/HTTP試験へ、old refを持つ既存distribution rootからnew refのみを追加したstandalone候補を生成し、両refのguest・全fixture・build-infoをHTTPで取得する試験を追加する。全保持資産の存在、digest/provenance、resolveGuest成功、legacy bytes/metadata保持を確認する。欠落・root外path・symlinkは生成失敗とする。架空2ref fixtureと実guestの検証を区別し、取得元commitを捏造しない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/guest-distribution/coverage.js self-test
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/stage.test.js
U2_ACTUAL_SITE=.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/guest-distribution/integration.test.js
U2_ACTUAL_SITE=.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-concurrency=1 tests/guest-distribution/manifest.test.js tests/guest-distribution/fixtures.test.js tests/guest-distribution/resolver.test.js tests/guest-distribution/stage.test.js tests/guest-distribution/integration.test.js
```

HTTP serverはloopback/private一時dir、afterで終了。retry/fallbackとguest暗黙実行なし。fixture/path/copy/symlink、URL/origin/redirect、ELF/PT_INTERP、未知tool/ref/fixture、404、digest/provenanceを既存試験で保持する。npm exports/filesにguestを加えない。

## Coverage and Limits

U2の固定第一者配布JS inventoryはintegration/terrarium/guest-distribution/{manifest,fixtures,resolver}.jsの3ファイル。authoring TSを編集後、正式buildでcompiled JSを確定してから計測する。U1固定14と合算してU4固定17を維持する。第一者配布JS全体80%行coverageと統合前CI必須。未importは0%、未収集realm/caseは失敗/未検証として分母から除外しない。test/型/development producer/ELF/生成blinkは理由付き除外、資産/型を別検証する。

次のdirectoryは必ず未使用であること。使用済みなら削除/上書きせず別末尾番号を選び全測定を実行する。修正後の保持ref候補を測る場合は全commandのU2_ACTUAL_SITEをその同じ候補の絶対pathへ変更し、candidate digestとsource identityを記録する。generated instrumented Playwright configはcollectorのcompiledTestConfigに従い.jsを選択する。

```sh
U2_ACTUAL_SITE=/Users/mutoakio/Documents/formicarium/.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/guest-distribution/coverage.js prepare .artifacts/u2-coverage-repair-v1
U2_ACTUAL_SITE=/Users/mutoakio/Documents/formicarium/.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --import ./.artifacts/u2-coverage-repair-v1/node-preload.mjs --test --test-concurrency=1 .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/manifest.test.js .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/fixtures.test.js .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/resolver.test.js .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/stage.test.js .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/integration.test.js
U2_ACTUAL_SITE=/Users/mutoakio/Documents/formicarium/.artifacts/u2-guest-distribution/site-v2 PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/playwright.config.js .artifacts/u2-coverage-repair-v1/workspace/tests/guest-distribution/consumer.spec.js --workers=1 --retries=0
U2_ACTUAL_SITE=/Users/mutoakio/Documents/formicarium/.artifacts/u2-guest-distribution/site-v2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/guest-distribution/coverage.js report .artifacts/u2-coverage-repair-v1
```

計測中はproduction/tests/candidateを変更せず、identityを測定前後で照合する。main逐次実行、browser1worker/no retries。probe600秒/aube browser840秒/pitchfork browser600秒Node120秒/wasm1GB維持。変更のないaube再buildなし。実機Safari・実配信・CI・公開RC受入れは未検証として別記録する。
# Current Recovery Verification (2026-10-10)

今回の実行対象はcode-generation-plan.mdのStep 16–20である。以下の既存コマンドとRed/Green手順は過去の実装検証記録として保持し、今回の承認で一括再実行しない。

計画承認後、main sessionで保存済み`verification/official-restart-20261010-v2/main-results.json`およびreconciliation、候補`.artifacts/u2-guest-distribution/site-repair-v1`、coverage`.artifacts/u2-coverage-repair-v3/report.json`を読み取り照合する。runner/configと実行済みコマンドを先に確認する。11要件IDの全条件を名前付き試験・結果・候補identityへ対応付ける。照合helperは新規`verification/ci-traceability-repair-v1/reconcile.mjs`へ作成でき、候補・既存receipt・製品ファイルを書き換えない。mainで`node <record>/construction/u2-guest-distribution/code-generation/verification/ci-traceability-repair-v1/reconcile.mjs`を実行し、実体のNodeパスと結果を記録する。`<record>`は本intentのrecordディレクトリに展開する。

Node 41件、Chromium/Firefox/WebKit計15件、固定JS 3件のcoverage 249/254・skip 0は保存済み結果の期待値であり、実ファイル照合後に検証済みとする。不一致を成功扱いしない。正式チェックポイントはAI-DLCが提示する承認済みコマンドで検証し、証拠と承認を別々に記録する。新規browser測定やproducer再実行が必要なら、根拠と新規出力先を計画に反映してから実行する。既存測定directoryを再prepareしない。

U2の旧pitchfork候補を2.30.1として報告しない。遠隔CI・実配信・全体NFRの未検証条件は残し、品質基準を下げない。Stopフックは全Code Generation完了まで無効を維持する。

