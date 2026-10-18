# U1 main session の実装検証

実行日2026-10-12。ビルド・型検査・各試験を順次実行。fixtureの成功と公式資産・実ブラウザ・remote CIの成功を区別する。

## Step 2–3（検証済み）

- `mise run build`: exit 0。
- `mise run typecheck`: exit 0。
- Node24実体で `node --test --test-concurrency=1 tests/migration-preflight/evidence.test.js`: 9 pass / 0 fail / 0 skip、54.9ms。
- 36行一意性、欠落・重複、CORS/nonzero exit、3000msの境界、時間不正、固定資産identityとCI再利用identityをfixtureで確認。

## Step 4（検証済み、fixture）

最初の `mise run build` は `assets.ts(20,15): TS1294` でexit 1。既存 `erasableSyntaxOnly` に非対応のconstructor parameter propertyが原因。ユーザーが修正・再検証と成功後の計画続行を承認。設定を変更せずAssetErrorのfield宣言・明示代入へ修正した。

- 修正後 `mise run build`: exit 0。
- 修正後 `mise run typecheck`: exit 0。
- Node24実体で `node --test --test-concurrency=1 tests/migration-preflight/assets.test.js`: 9 pass / 0 fail / 0 skip、135.3ms。
- raw ELF/gzip全entry検査、パス・link・重複・破損、全サイズ境界、digest/metadata/buildKey、HTTP/redirect/opaque、deadline・abort分類を確認。

## 未検証

runner処理、実公式資産のbrowser取得・36試行、CI固定baselineと同key再利用、今回のcoverage、独立コードレビュー。移管用専用taskの全対象が実装済みになるまで、部分試験をU1全体成功と扱わない。

## Step 5 部分結果

## Step 6 ローカル案検証（実CIは未検証）

## Step 7 初回build停止

環境fixture修正をユーザーが承認し、正常environmentをコピーしてcertificateFingerprintだけを欠落させた。main build/typecheck各exit0、verify8 pass / 0 fail / 0 skip（79.1ms）。続けて `mise run migration-preflight-unit` は全6部品50 pass / 0 fail / 0 skip（735.3ms）。Step7の受入入口と境界試験は検証済み。実CI/coverage欠落のためU1受入は未完。

Step8の部分結果をdocs/results/terrarium-migration-preflight.md/.jsonへ保存。main保存処理exit0、原36trial JSONとofficial/mirror input計38fileをbyte比較一致で保存しSHA inventoryを記録。status=incomplete、baseline/coverageはnullで実績代用なし。外部CI案4fileの完全差分と固定file SHA、fork基点commit、job/保存/費用/切戻しをvivarium-ci-execution-proposal.mdへ具体化。外部操作未実施、人間確認待ち。

ユーザー承認後、fixture environment配列にReadonly<Record<string,string>>[]型を明示。main build/typecheck各exit0。verify試験は7pass/1fail/0skip（73.97ms）。`missing TLS/core environment and instrumentation reject`で環境不足fixtureがoriginも失い、先の検査で`official/mirror provenance mismatch`となって期待`/environment/`に到達しない。拒否機能は働いているが意図した環境境界を検証できていない。出所を維持した環境欠落fixtureへ修正する案を人間確認。受入条件・実36試行・証明書削除状態は変更なし。

受入入口verify.tsと8fixture試験作成後、main format exit0。`mise run build`はexit1：`tests/migration-preflight/verify.test.ts(272,5): TS2322`、環境fixtureのunionにoptional undefinedが推論され、`Readonly<Record<string,string>>`と不一致。typecheck/8試験は未実行。実36成功/証明書削除とStep6ローカル成功は保持し、Step7型修正・再検証を人間確認。Step7/8/9未完、外部操作未実施。

baseline.ts/baseline.test.tsとCI案を作成。main format後 `mise run build` / `mise run typecheck` 各exit0、`node --test --test-concurrency=1 tests/migration-preflight/baseline.test.js` 8 pass / 0 fail / 0 skip（100.1ms）。完全入力のkey変化、同key compile省略、改変/欠損拒否、単一writer、取消staging除去、静的ELF境界を注入fixtureで確認。

project pinned Bun1.4.2で `bun build scripts/migration-preflight/baseline.ts --target=node --format=esm --outfile=integration/vivarium/preflight/baseline-controller.mjs` exit0（1module / 16.59KB）。Node24 `--check`生成bundleと`bash -n integration/vivarium/preflight/build-baseline.sh`各exit0。生成bundleはsource-manifest対象。workflowは固定checkout/setup-node/upload-artifact SHA、contents read、250分job/4h全体期限、1日artifact保持のローカル提案。実vivarium編集/push/CI起動はしていない。

実Docker compilation、remote CI同key再利用、OS process group終了は未検証。これらはStep8の具体外部操作承認と実証拠が必要。Step7の受入入口は欠落証拠を非zeroで拒否する。

検証入力補完後のmain build/typecheck各exit0、4部品34試験pass（332.5ms）。専用サーバーは実loader/wasm SHA256を既存配布候補のpinと照合し、RAM snapshotのbuild-info応答だけにassetDigests補完。原distとruntimeは変更なし。derived metadata SHA=d150bd44bfe6a79103e5322f36a3f5cef0cbc5bddb4dcaea444848ed4b22f8c5、原metadata SHA=1fbffc142253fcd793da2bad8981146949ef18c7134629467f08b4375a750818。

mirror-browser-attempt-2（sourceCommit75e4adf0a51db8fcc1af25676d54fc81fa09efee）：3ブラウザ×2ツール×6試行、36 passed / 0 fail / 0 skip、39.2s、worker1/retry0。実TLS検証維持、全試行exit0・same-origin取得成功。非ダウンロード工程のtrial1–5中央値ms：aube Chromium493.185 / Firefox525.5 / WebKit482.66、Biome Chromium586.625 / Firefox710.3 / WebKit479.74。全組合せ3000ms以下。trial0、最大、fetch6値、出力とdigest、TLS/core入力証拠は各trial JSONへ記録。WebKit結果は実機Safari確認とは扱わない。

試行環境main実コマンド観測：macOS27.0.1 build26A434、CPU Apple M1、Nodev24.21.0。重いbuild/testは試行中並行せず1workerで実施。他アプリの負荷は測定していないため無負荷保証とは扱わない。ブラウザ実version/userAgentはtrial JSONに保存。

終了後security delete-certificate -t -Z exit0、find-certificateでitem could not be foundを観測し一時登録削除確認済み。Step5の実36試行完了。固定baseline remote CI/reuse、全体coverage、独立レビューは未完なのでU1全体は未完のままStep6へ続行。

訂正指紋でNode専用CAによるHTTPS配信を再検証しexit0。aube/Biome両方のTLS検証と配信byte SHA256一致を確認。ユーザー承認後security add-trusted-cert exit0、登録のSHA256一致を確認。mirror-browser-attempt-1は36予定中Chromium aube trial0のrun段階ASSET_LOADでexit1（1 failed / 35 did not run）。fetch31.625ms、extract120.355ms、digest40.700ms、validate3.565ms、register4.245msは観測済み。完了行はなし。

security delete-certificate -t -Zで一時登録を削除（exit0）、同CNのfind-certificateがitem could not be foundで不存在を確認。試行sourceCommit=7bc9d800a7cd4f211d9b43adcf3874f340f9c5fd。traceに保存された実配信build-info.jsonにはassetDigestsがなく、runtime/core.tsのloadPackageCoreは必須loader/wasm digest不一致をASSET_LOADに分類する。これが今回の入力欠落原因（コードと実応答による根拠）。runtime変更なしで専用の検証metadataを補完する案を人間確認。Step5未完、後続工程未着手。

HTTPSミラー追加後のmain `mise run build` と `mise run typecheck` はexit0。evidence/assets/runner/prepare-mirrorは34 pass / 0 fail / 0 skip（317.1ms）。prepare-mirror実コマンドexit0、新attemptへaube 22235806 bytesとBiome 66123120 bytesを固定SHA照合して保存。BiomeはHTTPS redirect1回を検査、aubeはローカル固定byteを再照合。

Node専用CAでの実配信検証はserver起動時の `TLS certificate fingerprint differs from explicitly pinned input` で停止。証明書実ファイルのOpenSSL SHA256は8CEEFCA11574E696F6841F9644A9E88029B8B0B852429F3C3CFB59D30ADF139Fで、以前の入力95160...と不一致。配信成功・ブラウザ成功は未検証。OS信頼設定変更は未実施。訂正入力での再検証と一時信頼登録を人間確認する。

mainで新TSをBiome format --write（exit0、8files整形）、その後build/typecheck各exit0。cleanup失敗のartifact保存とmaxFailures=1の追加後、evidence/assets/runnerを再検証して26 pass / 0 fail / 0 skip（418.5ms）、runner単独8件成功。これはfixture検証済み。

実ソースrevision `95fd4886d3a7c3eedeeb4cf869cf7544955a9e49` に対し、公式REST pinと実在のmetadata producer script/configのSHA inventoryから `.artifacts/migration-preflight/official-input.json` を作成。builderHash/buildKey/metadata digestの2入力一致をmainで確認。rustc=null、upstream compilation inputsは未検証と明示し、公式release由来metadataをupstream buildの再現証拠とは呼ばない。

`FORMICARIUM_PREFLIGHT_INPUT=/Users/mutoakio/Documents/formicarium/.artifacts/migration-preflight/official-input.json mise run migration-preflight-browser`: exit1。Chromium aube trial0が取得でASSET_LOAD、1 failed / 35 did not run、retry0・worker1・maxFailures1。`.artifacts/migration-preflight/trials/aube.chromium.0.failure.json` と `test-results/consumer-aube-official-trial-0-chromium/trace.zip` に保存。未計測phaseは空objectで、ゼロや成功行へ置換しない。

traceのconsoleに実URLへのfetchがCORSで拒否され、`No 'Access-Control-Allow-Origin' header is present on the requested resource` と記録。network snapshot status=-1。redirect:errorで全hopの検査不能を成功にしない既存制約を維持し、取得失敗後は人間確認まで停止。Step5未完、Step6–9未着手。前段の『runner処理未検証』はこの部分結果でfixtureのみ検証済みに更新し、実36試行/remote再利用/coverage/レビューは引き続き未検証。
