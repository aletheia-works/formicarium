# 初期試行の試験手順

## Setup

既存Node node:test / Playwright / strict TypeScriptを使う。mise lsでproject pinと実体を確認。宣言taskはmise run、その他はmise実体のNode/Playwrightを解決して実行しshim/mise execを使わない。main sessionで全試験逐次、性能計測時はCI buildも同時に走らせない。新taskはStep2で整備してから使う。

## Unit-Scoped Commands

- `mise run migration-preflight-unit`: 実装済みtask。build済みtests/migration-preflight/のevidence、assets、runner、baseline、prepare-mirror、verify、completionの7単体ファイルをnode --test --test-concurrency=1で実行する。最新のmain観測は55pass/0fail/0skip。
- `mise run migration-preflight-browser`: 新規task。tests/migration-preflight/playwright.config.tsとconsumer.spec.tsだけを対象にChromium/Firefox/WebKit、worker1/retry0、aube/Biome trial0–5の36行を記録する。
- `mise run migration-preflight-verify`: 新規task。上記Unitの試験/実証拠/C01/schema/環境/CI再利用/適用回帰と固定分母coverage証拠の一致を検査。証拠欠損をskipで通さない。共通検証コマンドとしては別途提示・承認を受けるまで未確定。

U1の実装と過去の36行・CI初回/再利用・完了確認成功資料は保存済み。完了確認スクリプトの修正後、改変拒否と歴史資料/現行sourceの区別に関する35件がmainでpass/0fail/0skip。現在の変更済みsourceに対する全工程の再確認は未検証。外部CI試行は具体workflow/commit/権限/保存先/費用と復帰方法を示して承認後に起動し、local模擬結果で代替しない。

## 完了確認の復旧手順

1. `RECOVERY_EXECUTION_BINDING=.artifacts/migration-session/recovery-execution-binding.json /Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test --test-concurrency=1 .artifacts/migration-session/verify-completed-result.test.mjs .artifacts/migration-session/aidlc-investigation/reproduce-completion-inventory-drift.test.mjs`で固定証拠と改変拒否を確認する。
2. `--retained-evidence`による歴史資料の成功を、現在のUnitの完了確認に使用しない。既定のcurrent検査は、sourceが変わった古いU2候補を拒否すること。
3. 新規候補を固定し、現在のU1/U2の単体・結合・Node/Worker/3ブラウザconsumer・既存回帰・全第一者JS coverage80%以上をmainで逐次確認する入口を整備する。現在のinstall JSもcoverage分母に残す。未収集・skip・出力不一致・古いsource/pack・不足CI証拠を成功にしない。
4. 実コマンド・必須検査範囲・未完のU3性能/CIを提示し、新しい共通検証コマンドの承認を得てから設定する。必要なCIを省略せず、外部操作は別途具体承認を得る。U3のSHA256改善は、そのU3実装計画の承認が記録されてから実装する。

## Cases and Coverage

## 今回の再開（2026-10-17、Steps 15–17）の試験

古い版のtoolで作った記録は、今の根拠にしない（人間の方針）。下の各節にあるNode 24.21.0・v8以前の手順と確認値は、履歴として残す。`<node>` は `mise ls` が示すNode 26.12.0の実体pathを表す。mainが一つずつ実行する。

1. 準備：`mise run build`、`mise run typecheck`。
2. Step 16の再現試験と回帰：`<node> --test --test-concurrency=1 tests/migration-preflight/current-completion.test.js tests/migration-preflight/current-evidence.test.js tests/migration-preflight/baseline.test.js`。指摘ごとに、修正前にfailを観測してから修正し、同じコマンドでpassを確かめる。
3. U1の単体：`mise run migration-preflight-unit`。
4. 追加する試験ケース：
   - 試行の記録にNodeまたはPlaywrightの版がない場合、今の版と違う場合、試行ごとに違う場合を拒否する。
   - browserLogの36件の試験名とtrial fileが一致しない場合（欠落・余分・ずれ）を拒否する。
   - 1MiB+1のbuild-info.jsonは、読み込む前に拒否する。
   - reportの `pending` に、完了済みの項目が入らない。
5. `consumer.spec.ts` の変更（試行の記録に版を書く）は、ブラウザでの36試行を実行するときに確かめる。この実行は、U4の共有fileの変更がすべて終わった後の、段階Bのcurrent completion（v11）でまとめて行う。今回は単体試験で、組み立て側の照合だけを確かめる。

## 今回の再開時の確認

### 生成JSのレビュー復旧

実装前承認後、`.gitignore`へ `!/scripts/migration-preflight/current-coverage.js` と `!/tests/migration-preflight/current-completion.test.js` だけを追加し、`jj file track scripts/migration-preflight/current-coverage.js tests/migration-preflight/current-completion.test.js` で追跡する。必要なjj操作はホスト権限で実行する。2件の内容と `.js.map` のignoreは変更しない。

v8入力SHA `25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0` と成功report SHA `fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079` を再確認し、入力の全currentSource・candidate・独立consumer・pack、reportの全evidenceFilesが保持されたことを読取り専用で検証する。2件のJSのSHAはv8 currentSourceと一致させる。追跡状態だけの変更を成功証拠の書換えにしない。不一致なら停止し、全封印対象が一致すれば21工程の再実行は行わない。新しい短い正式完了確認コマンドは独立レビュー後に提示・承認を受ける。

### 既存の復旧検証

1. `mise run migration-preflight-unit`をmain sessionで実行する。
2. `mise run migration-preflight-current-unit`をmain sessionで逐次実行する。
3. 旧v6の完了確認結果はsourceの一致が確認できるまで現在の完了証拠へ転用しない。不一致の場合は固定入力・候補・必要な全工程の再実行案を具体化し、新完了確認コマンドを人間へ提示して承認を得る。
4. 生記録と現sourceの照合を独立レビューへ渡す。失敗・不足証拠を成功へ置換せず停止する。U3の新起動台帳修正はU1の復旧へ混ぜない。

証拠集計・取得検証・実行計測の3部品各5–8件以上、baseline境界の結合試験を追加。正常入力と少なくとも2種の失敗/edgeを各部品で確認。digest/ELF/metadata/path/link/duplicate/truncated/サイズ+1/deadline/abort/HTTP/redirect/36行欠落/重複/3000境界を含む。模擬fetchと極小archiveを使い大容量fixtureを不用意に保存しない。

性能trialのELF/wasm/APIは実物、coverage instrumentationなし。coverageは別に固定配布JS全一覧を分母として80%以上を照合し、Worker/別realm欠落を拒否。既存回帰のprobe600s/8項目、aube840s、native完全一致/wasm1GB/worker1/retry0を維持。未変更aubeを再buildせず、未実行は理由付き未検証として停止する。
