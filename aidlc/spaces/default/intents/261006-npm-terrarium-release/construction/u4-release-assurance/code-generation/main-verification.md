# U4 Main Verification

## Current v9 observations（2026-10-10記録）

main観測の正本は下表のverification相対path。各observerは開始/終了UTC、絶対実体argv、cwd、exit分類、stdout/stderr SHAを保存する。以下は新規U4回帰であり旧coreの成功/失敗を再ラベルしない。

| 対象 | 結果 | 正本 |
| --- | --- | --- |
| aube Node | 4PASS、native一致、5.7s | current-aube-node-v1/e815e506-208c-40ba-a6f4-4c4edecfe78b/observation.json |
| build/runner/probe Node | 39PASS | current-probe-node-v1/fc589623-6a58-4015-96be-89ff45453a09/observation.json |
| probe/aube Chromium・Firefox・WebKit | 33PASS、42s | current-probe-aube-browser-v1/b9f503b0-45f5-4c5f-bef9-19c6e844e0e9/observation.json |
| session/pitchfork Node | 11PASS | current-pitchfork-node-v1/6e639786-9522-455c-b4ea-a23da4237ac5/observation.json |
| pitchfork 3browser | 3PASS、14.7s | current-pitchfork-browser-v1/8a779c5a-34cd-4711-8b5d-7ed7414ebb92/observation.json |
| v9 pack/types | 9PASS | current-v9-pack-types.log |
| 指定collector4files | 41PASS、skip0 | current-collector-regression.log |
| C6 binding regression | Red22PASS/4FAIL→Green26PASS/skip0 | c6-binding-red.log、c6-binding-green.log |

aube observerの実argvは`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test tests/node/aube-1645.test.js`、UTC15:31:12.772–15:31:18.590（2026-10-09）、stdout SHA dbf94c659830498dbffb5b6a09f2f22f2b25c456203448399f6abf15ec7c45f2。pitchfork browserは同Nodeの`node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0 --output .artifacts/u4-current-pitchfork-browser-v1`、UTC15:37:11.668–15:37:26.718、stdout SHA78ad0780bf2d4b6573e5e6047d409e959b2da6ed4b51291cd16d054fc7ad1204。他argv・raw SHAは表の正本を参照する。

current-v9-before-identity.json/current-v9-after-identity.jsonの134filesが完全不変。core a882fb2f3df14115b7e46f6812fb296eef5934d7 dirty=false、tgz dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d。nativeHistoricalImportはguest/session/fixture/baseline/archiveの既存原bytes再照合でありnative再実行ではない。

current-v9-coverage-import-revalidation.json（2026-10-09T15:39:44.402Z）はU3 v3のread-only historical import。seal1705files、24source、site/tgz、U1report、46receipts、再集計と永久report原bytesの一致を観測。generation6e347c83-aca9-48b2-90bf-e0ce5ad9bb7d、source ba1deaee3e5ff17b94931e5f2abcfa18ab66ea6dc321fac06ce25b78da2c5d49、site2b62bb57a2c757a30ffa88609ebc605191b438510e98796b6d93df9570208e26、execution2942cf1d2190942b222f57a24bde0be33015ef8c85bd0abb8bdb31509de30180。固定24、1450/1801=80.51%、skip0、U1同pack1253realms。notFreshU4Execution=true。補助read-only script初回のinventory.tarball参照TypeErrorは固定tgzpathに訂正した再照合で解消し、製品測定failureとは区別する。

整形後の正式2tsc/emit exit0、release26PASSはc6-binding-green-formatted.log。scoped Biome exit0、既存useTemplateのinfo1件を保持。実API正常受入れはcurrent-evidence-validation-result.json/helper.mjsが正本で、元report/inventoryへのread-only validateEvidenceのみ。fixed24・23measured・npm.ts未実行0、再照合された独立bindingを維持。evidenceSaved=false、envelope保存・公開判定なし。sourceCommitは観測jj baseで、working-tree第一者SHAを別結合し公開可能commitを主張しない。U1実Safari5成功とU3候補Safari未検証は別範囲。遠隔CI/TrustedPublisher実設定/公開RC採用/公開は未検証、Step8・正式reviewは未完。

## Observed Commands and Results — 2026-10-08履歴

検証済み：Plan Approvalは人間のApprove Planを正式receiptへ記録、UNIT_STARTED。Node24.21.0/Bun1.4.2をmise lsで確認。jj statusとremote listはhost実行exit0。現remoteはorigin Marukome0743/formicarium、upstream aletheia-works/formicarium。既存記録のremoteなしは現在状態として採用しない。push/PR/公開未実施。

runner readiness：直接Node24でproduct/test tscとemit exit0、tests/terrarium/coverage.test.js既存9件成功。R-01回帰3件追加後、同正式build/emit→exact coverage suiteは12件中9成功3失敗。全3失敗はMissing expected rejectionで、原outputはred-coverage.txt。後続seal修正で3件すべてGreen。

新規release層は実装後試験。fixture IDの不正文字とnegative fixture前提不足を修正。正式buildと新規release22件+既存U3/collectorを含む55件成功を観測。その後coverage report原digest/fixedInventory一致を追加し、再build後release22件+coverage14件の36件が成功（green-local.txt）。候補判定試験の承認・公開済みRCはfixtureだけで、実承認/実公開ではない。

fresh coverage：直接Node scripts/terrarium/coverage.js prepare verification/coverage-input.json、直接Bun build src/index.ts→site/web/terrarium.mjs（19modules）、直接Node coverage.js seal .artifacts/u4-coverage-v1、coverage.js node同out/directBun、generatedworkspaceの専用Playwright CLIで45browser（workers1/retries0）、coverage.js reportを逐次実行。Node30pass/155assertions、browser45pass1.3m、全exit0。reportは1451/1801行80.56%、skip0、passedtrue。U1同pack v11は明示import。

generation63d3e8d4-a1b7-4f55-83cd-4a37e318ebd4、sourceIdentity26cc8d1960fb1bd60147cea98e9ecbad68bf114088d30f9fc7796a8230360c24、candidateSha25645e230fb6541e26683b313b9d5e28101296d0f80aa434f49d561123fcb0c120e、executionIdentity10e02129943632e9993cc5a721e7f5cb7a3273c73cff1c1efb28f32e2b78c59f。実行前後とreportで測定copy/最終bundle/必要集合を検査した。Node attempt f9711a9b-9b04-46e7-aad9-f17e3a7452e4。原inventory/seal/46receipts/reportは同新outに保存。

現owner BT siteのconsumer6件も3browserすべて成功（11.7秒、workers1/retries0）。外部owner/古測定out/guest sourceの変更なし。

## Regression Failure — 2026-10-08履歴

直接Node --test tests/node/build.test.js tests/node/runner.test.js tests/node/probe.test.js：38件中37pass/1fail、exit1。probe8項目と指定futex-deadline/page-fault-race/madvise-dontneedは成功。失敗はtests/node/build.test.ts:209のpitchfork.build-info ref一致、expected v2.29.0 / actual v2.30.1。

検証済み：dist/guests/pitchfork.build-infoはref=v2.30.1、commit1054549e85470b08d9507e2c82c850959a4b3914、既存patch SHA1e307ed8c3009ead22a08c5615fda5b30ac42cdc79726bbb722e10b5426dbac6、UI Nodev24.18.1。既存build-guests.shの既定はv2.29.0、native pitchfork baselineも2.29.0。U3 ownerの最新2.30.0、formicarium dist2.30.1、旧baseline2.29.0を同候補結果として混同しない。

検査/fixtureを新versionへ緩めず、生成build-infoを手修正せず、guest再build/既存dist上書きはまだ実行しない。正しい固定guest候補の復元または正式buildという修復判断が必要。aube/browser全回帰/native再照合、外部CI、正式U4review/Unit完了は未完了。

## Publication Preconditions

ドキュメント根拠（2026-10-08公式資料確認）：https://docs.npmjs.com/trusted-publishers/ と https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md 。npm OIDCは対応CLI/Node、GitHub-hosted runner、owner/repo/workflow（必要ならenvironment）の一致、publish jobのid-token:writeを必要とする。具体実Trusted Publisher設定・公開権限・CI結果は未検証。private:trueを維持する。資料の確認を実設定成功として扱わない。
