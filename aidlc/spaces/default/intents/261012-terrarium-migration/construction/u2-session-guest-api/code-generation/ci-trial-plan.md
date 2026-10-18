# U2 統合前 CI 試行案（実装・外部操作の承認前）

目的は専用 fork branch で現在の U2 source、そこで新しく作る pack、固定16 JS/全realm coverage、既存回帰を逐次検証すること。main の fresh local completion は exit0、source `6d6be261...` の固定16 JS/1370 realmsで1199/1334 lines＝89.88%を実観測した。localPassed=true/acceptancePassed=falseを保持する。実 CI は未検証。本資料は案であり、fresh local暫定成功や旧結果を含む診断89.88%を CI 成功としない。Step8 は未完のまま保持する。

## 対象と変更差分

- repository: `Marukome0743/formicarium`、専用 branch: `codex/terrarium-migration-u2`。upstream は `aletheia-works/formicarium`。
- 新規 `.github/workflows/migration-session-u2.yml` と `scripts/migration-session/ci.ts`、必要な最小入力検証 helper/負例試験。既存 completion の Executor に厳密な task adapter を渡し、同じ逐次試験・coverage を実行する。
- 既存 `candidate-verify.yml` の upstream 限定、固定 modernization 入力、publish/bootstrap の信頼 policy は変更しない。歴史的14/24 proof と新16/26候補を分け、U4/B1まで新候補の公開拒否を維持する。
- branch に入れるのは U2 source-manifest の実変更、U1/既存回帰を動かす必須依存の差分、CI専用入口だけ。古い未完 intent の記録や関係ない working changesを一括取り込まない。

## workflow の具体案

専用 branch の pushを入口とし、新 workflow_dispatch が default branch にない問題を避ける。`github.repository == 'Marukome0743/formicarium'` と branch完全一致を確認する。`contents: read` のみ、checkout credentialsを保持せず、publish/Release/id-token/write tokenは使わない。1 job・並列重い処理なし、`ubuntu-24.04`、Node `24.21.0`、Bun `1.4.2`、deadline360分、retryなし。同 branch の jobを並列起動しない concurrency group を設定する。

既存 workflow に観測済みの full SHAを使用する：checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`（v7.0.1）、setup-node `949feb2413d6458794dcd2491c4babbbce0c15c1`（v7.1.0）、setup-bun `0c5077e51419868618aeaa5fe8019c62421857d6`（v2.2.0）、upload-artifact `cf430e030ddbb5b0abf93d22962f4752f3646cd9`（v7.0.2）。新 trial に cache は不要。artifact は private host path/秘密を除いた入力 identity、候補 manifest、各試験の receipt、coverage metadata/raw realm/report、実 run/head/attempt の観測を1日保存する。巨大 core/guestや node_modulesを結果 artifactへ重複保存しない。

準備・jobの予定コマンド：

```text
node scripts/ci/tasks.ts install-frozen --cacheless
node scripts/ci/tasks.ts build
node scripts/ci/tasks.ts typecheck
node node_modules/@playwright/test/cli.js install --with-deps chromium firefox webkit
node scripts/migration-session/ci.js prepare <approved-input-manifest>
node scripts/migration-session/ci.js verify <prepared-ci-context>
```

`ci.ts` の task mapping は未知 taskを拒否する固定表：`build/typecheck/test-light/test-consumer` は `node scripts/ci/tasks.ts <same-task>`、`migration-session-unit` は承認済み5 Node試験の exact file列、`migration-session-browser` は承認済み専用 Playwright config/spec。その他の completion command は Node `process.execPath` と宣言済み引数/cwdを維持し、shell評価へ変換しない。初回実行前に完成した sourceと exact argv/envを提示し、この予定名を確定コマンドの承認に置き換えない。

## 固定入力と fresh candidate

既存 `scripts/ci/bundle.ts` は source/PAYLOAD SHA検査の参考として読むが、upstream限定の旧 `validateCandidateManifest` を fork向けへ緩めない。新 U2 payload は explicit allowlist、regular fileのみ、全 path/size/SHA256、HTTPS credentialなし・redirect hop安全検査、有限取得/展開、未知entry/改変/欠落拒否を備える専用境界とする。具体 archive URL/SHA・各入力SHAは main準備後に確認する。未確定値を架空 SHAで埋めない。

必要入力は `dist/blink/{blink.mjs,blink.wasm,build-info.json}` と blink.lock整合、既存 `dist/guests` の実試験が必要とする probe/aube/hello/exit3/pthread/spin/pitchfork等と metadata、native oracle、aube-local-deps/session fixture、`.artifacts/u1-fixture` の既存配布fixture、U2の公式 aube2.7.0 ELFと固定metadataである。必要な全ファイルを実 test/helper依存から mainで列挙し、総容量・license/notices・秘密不在をレビューする。aube/coreを再buildせず、既存byteをSHAで照合する。CI外のローカルreceiptやcoverageを payloadの成功証拠にしない。

CIは検証済みpayloadから assetsを設置し、CIの実 headを `FORMICARIUM_SESSION_SOURCE` に渡して新 stage→pack→tar検査→checkout外の独立 consumer install→全 installed SHA照合を行う。Node/browserは同じ新 packを利用する。CI source inventoryに新workflow/adapter/input validatorを含め、元local working source identityとの差分を明示する。現在のlocal base `74dd...` や source identity `6d6be261...` を CI headやCI packへ再ラベルしない。

CI内の completion は local/provisional modeで循環なく各実試験を行い、`acceptancePassed=false` を維持する。jobが終わった後、mainが GitHub APIの実 repository/head/workflow/run/attempt/job/conclusionと成果 SHAを独立読取り照合して統合前CI観測を作る。job自身の任意 `success` fieldだけで最終受入を通さない。80%未満・欠落realm・skip/未検証は完了成功へ置換しない。既存 known skip2は独立して明示し、扱いの確認を checkpoint に残す。

## main の事前準備と承認境界

1. 凍結した現在の source/試験結果を保持したまま、mainが jjで専用 checkoutを準備する。remote mainの現 full SHAを読取り固定し、いま観測済みの prefix `567799f5...` を exact値とみなさない。差分は source-manifest と依存閉包で選び、対象path/diffをレビュー可能にする。shared workspaceの他者変更を戻さない。
2. adapter/workflow/input検証 helperを作成し、mainで format/build/typecheck・狭い負例/Executor mapping試験・新 stage/独立consumerの入力確認を行う。ローカルfull再検証が必要な差分は理由を示す。input transferのURL、保存先、サイズ、SHA、retention/cost、削除方法を確定する。
3. `jj` の署名付き専用 branch pushと1回のCI試行を行う前に、**完成したdiff、実full head、exact push/CI command、payload URL/SHA、費用上限、切戻しを人へ提示して承認を待つ**。実装計画の承認と外部操作の承認は別。新 branch名の bookmark以外を作らない。
4. 承認後のpushは既存SSH agentへアクセスする escalated host permissionsで `jj git push --remote origin --bookmark codex/terrarium-migration-u2`。署名を無効化せず、GitHubで実 headの `Verified` を読取り確認する。push-trigger jobの実 run URL/headを記録する。push失敗/未知結果は状態照合して確認し、自動再送しない。
5. 結果を独立確認し、source/pack/inventory/全realm/回帰/CIを同じU2候補として追跡する。失敗時は確認し、未完を保持する。切戻しは専用branch/workflow/payload/jobの停止・削除範囲を事前確定し、mainや既公開版を変更しない。U2承認は公開・tag・Release・U3/U4/B1承認を含まない。

現時点で未確定：新CI source diff/head、payload完全inventory/サイズ/URL/SHA、CI consumer/context path、exact新入口argv、push/job実績。これらを準備してから具体承認へ進む。実CI・実機Safariは未検証である。
