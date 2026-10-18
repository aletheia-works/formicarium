# U2 検証の観測

## Step1・Step3
検証済み：main sessionで逐次実行。
- mise run build、mise run typecheck：修正後exit0。
- tests/package/runner-ready.test.js：3pass/0fail/0skip、294.9065ms。
- Node --test --test-concurrency=1 tests/migration-session/guest-validation.test.js tests/migration-session/fixture.test.js：17pass/0fail/0skip、3958.71825ms。128MiB ELF、256MiB fixtureの境界試験を含む。
最初のbuildはfixtureのunknown型/union絞り込みで失敗。ユーザーのRetry回答後、実typeof検証と種別local型を揃えて再検証成功。公開型・上限・検証条件を緩和しない。

## Step4・Step5
検証済み：mainでformat、mise run build/typecheckがexit0。
Node --test --test-concurrency=1 tests/migration-session/reservation.test.js tests/package/state.test.js tests/package/lifecycle.test.js は33pass/0fail/0skip、259.814583ms（新reservation10件）。旧reset BUSY期待を承認済みC02の取消・cleanup待機へ対応させ、新競合試験で確認した。その他既存Worker結果/取消/cleanup watchdog/状態回帰は維持。

## Step6・Step7準備
公開API・型・配布一覧・consumer/type/browser試験の書込み後、main format13files成功。mise run buildはtests/migration-session/types-invalid.tsの@ts-expect-error注釈位置で失敗（TS2578 line15、意図したinodeId欠落拒否TS2322 line17）。型拒否試験の注釈位置修正が必要。Step7試験は未実施、pack準備前。ユーザーへRetry/Skip/Abortを提示する。

## Step6・Step7 再検証
ユーザーのRetry回答後、型拒否fixtureの注釈位置を修正。検証済み：mainでbuild/typecheck exit0、public.test.jsは8pass/0fail/0skip（260.630875ms）。
既存stagePackage/verifyPackageで新規0.3.0候補を生成し、実tarballの一覧・SHA256と独立consumerの全配布ファイルSHA256を照合。root package version/privateは維持。候補は.artifacts/migration-session/step7-df5b4bc6-cefc-4dfb-b522-88b4d74b4f13/package.manifest.json、pack SHA256=49d865a13bd7e40c1f5640abf89f23f8da16ab72a7e9f33d7916b4c3446dc99e、first-party JS16。consumerは/private/tmp/formicarium-migration-session-consumer-df5b4bc6-cefc-4dfb-b522-88b4d74b4f13。
検証済み：同候補のconsumer.test.jsは8pass/0fail/0skip（4247.123291ms）、公式aubeの実行・複製保持・取消・偽handle拒否を含む。
最初のbrowser試行はPlaywright configディレクトリを基準にscripts/serve.jsを探してMODULE_NOT_FOUNDとなり、試験開始前exit1。ユーザーRetry後、webServer.cwdをrepository rootへ固定。承認済みmigration-session-browserを同候補・同consumerで再実行し、Chromium/Firefox/WebKit各3件、合計9pass/0fail/0skip（17.5s）、worker1/retry0。実Safariは未検証。

## Step8・Step9 準備
検証済み：新stage/coverage/completionと境界試験をmainでformat。build/typecheck exit0、completion.test.js 3pass/0fail/0skip（67.607292ms）。候補生成の最初のnpm packはsandboxによるcache書込み拒否。同じmise stageコマンドをホスト権限で再実行しexit0。キャッシュ権限・設定は変更しない。
候補.artifacts/migration-session/candidate-c9c9dd00-9b2e-46c9-914d-ba0a353b50c9/package.manifest.jsonは0.3.0暫定、第一者JS16、pack SHA256=c8610b00deb15f6a2984215ea3a1d1b57975f8e6e15f0f2e077f8dc5c7e879e3。sourceIdentity=129ee575a1865f4eadfd322ef0354ef78ed9519489a79cdcdc8703ba29403b3e、sourceCommitKind=base-revision-with-working-source-inventory（未コミットbytesをbase commitのbytesとみなさない）。独立consumer /private/tmp/formicarium-migration-session-consumer-b531e7e6-6742-4467-9811-5bbf18a062f3 に導入し全ファイルSHA256一致、exit0。
全回帰・新16ファイルcoverage・U2統合前CIは未検証。local-verification-command.txtのコマンドを提示して承認待ち。LOCAL_ONLY=1ではlocalPassedのみ、acceptancePassed=false、CI未検証を保持。U2正式完了確認のcanonical commandとしては未登録。

## 公開基準の照合
## 回帰7件修正後の再検証停止
### Worker記録修正と集計の先行検証
ユーザーRetryを記録。consumerのreset試験を実onOutput bytes観測後の取消へ変更し、生成済みWorkerのbootstrap前終了を防止。即時取消は既存reservation試験で維持。Node U2の全5Workerを厳密names/countで要求し、欠落・余剰・重複・未登録を拒否。製品runtime・共有collector・80%下限・旧25Workers・browser17/0/17・承認済み計画/試験指示は変更しない。
検証済み：format/build/typecheck exit0、completion集計境界6pass（188.987916ms）、通常consumer8pass（6690.538292ms）、fresh diagnostic計測consumer8pass（292440.111708ms）。新しいWorker1/2/3/4/5は全てbootstrap1、非ゼロcounter230/230/230/184/230。診断用metadataは前回とbyte一致。前回full-suite hostと新consumer hostのcounter最大値union、および前回package Node/browser原記録copyの由来をdiagnostic-provenance.jsonへ明示、前回outputは上書きしない。worker-diagnostic-20261013の集計exit0、全16files・lines1199/1334=89.88%・80%下限通過。これは集計経路の先行診断のみで、現在sourceの正式受入に使わない。
fresh candidate-49df6ae6-977f-4cad-9391-633083a2cd1c/package.manifest.json生成exit0、sourceIdentity=6d6be261d196a83a0774f289ad56ef019923dfa819e4c79b697953ce0efece98、packSHA=c8610b00deb15f6a2984215ea3a1d1b57975f8e6e15f0f2e077f8dc5c7e879e3、JS16/pack26。独立consumer2c80314e-8bd9-473c-b564-9305d69d360b全配布SHA一致。local-verification-worker-retry-command.txtの承認済み同内容で全計測をfreshに取り直す。CI未検証・最終受入未完。
最終再試行の観測：build/typecheck/test-light exit0（既存2skipは成功扱いしない）、tooling236pass（38920.726542ms）、U2Node43pass（12296.192375ms）、U2Browser9pass（21.0s）、consumer189pass（19709.140709ms）、Node回帰28pass（13876.344375ms）、browser回帰33pass（47.6s）、measured packageNode115pass（6540.33075ms）、measured U2Node43pass（743312.092125ms）、measured packageBrowser99pass（9.1m）、measured U2Browser9pass（9.3m）。fresh completion-d3a2ae8c-d7c2-421d-8360-30ba2e63c8f6/coverage/coverage-session-node.jsonはhost+全5Worker、全bootstrap1、非ゼロcounter731/230/230/230/184/230。
検証済み：同fresh dirのcoverage-report.jsonは全16JS、1370realm、1199/1334lines=89.88%、threshold80、passed=true。全command exit0、completion exit0、終了時current source照合も成功。local-provisional-report.json assembledAt=2026-10-13T10:47:31.682Z、localPassed=true、acceptancePassed=false、blocker統合前CI未検証。診断copy/max-unionを流用せず全recordをfresh実行で生成した。実Safari・U3/U4/B1・CIは未検証で、正式受入/canonical command更新はまだ行わない。承認済み計画の次作業としてCI入口具体化案ci-trial-plan.mdを準備した。

### guest path修正の先行確認と再試行（集計で停止）
ユーザー「パスを修正し、失敗箇所を先に確認して再試行」をRetryとして記録。scripts/migration-session/coverage.tsで生成helperのguest pathをresolve(root, envPath)として絶対化。build/typecheck exit0、candidate-0fba587c-1c7a-442b-9db2-ddd60c212e00/package.manifest.json生成exit0、sourceIdentity=bfd874b51fd00605b48e10c94e12935f4aaad6e61c5f96f9ad8d0175b68d5d49、packSHA=c8610b00deb15f6a2984215ea3a1d1b57975f8e6e15f0f2e077f8dc5c7e879e3。独立consumer de8cce69-5fda-4f41-8de0-70ea98e29f7b の全配布SHA一致。
fresh path-check-0fba587c-1c7a-442b-9db2-ddd60c212e00をprepareし、cwd=同dir/tests/migration-sessionでPlaywright --config playwright.coverage.config.mjs --listを実行、全3browser9件の読込み成功exit0。前回ENOENTの境界を先に確認し、local-verification-path-retry-command.txtの同じ承認済み内容でmain逐次再試行中。
検証済み：build/typecheck、light unit177pass/0fail/2既存skip（3273.547958ms）、tooling236pass（29061.466958ms）、U2unit43pass（9110.584125ms）、U2browser9pass（17.7s）、consumer189pass（15531.145042ms）、Node28pass（10525.752ms）、browser33pass、measured packageNode115pass（5931.813375ms）、measured U2Node43pass（723108.676292ms）、measured packageBrowser99pass（9.3m）、measured U2Browser9pass（8.8m）。計測付き実行時間は性能値ではない。前回のguest path ENOENTは再発せず、全ブラウザ試験が成功。
最後のcoverage reportが「U2 planned Node Worker realms were not all retained」でexit1。completion-3f370f3c-a919-47d3-8dfa-2a35858c48f1/incomplete.jsonを保持。検証済み：SESSION_REALMS.nodeWorkersは4だがcoverage-session-node.jsonはhost+Worker5件。Worker1/2/3/5は各230の非ゼロcounter、Worker4は全ゼロ。既存package Nodeは予定どおり25Workers。推測：reset試験で起動直後に取り消されたWorkerが追加のゼロ記録として残る。Worker数・ゼロ記録の扱いを試験の起動/取消と対応づける必要があり、単純な件数緩和や記録削除はしない。最終coverage達成率は未検証、CI未検証・最終受入未完。ユーザーの失敗時確認方針に従い修正前に停止。

### 固定件数修正後の完了検証再試行
ユーザー「配布JSを16件、候補一覧を26件へ修正して再試行」をRetryとして記録。pack.test.tsとcurrent-candidate.test.tsの旧件数だけを修正し、実一覧/digest一致・欠落/重複拒否を維持。後者のTS/JSをsource inventoryへ追加し、4変更pathをsource-manifestへ記録。
build/typecheck exit0、candidate-14ddc43d-ba49-41f1-aaba-70d5af5ccf91/package.manifest.json生成exit0。sourceIdentity=fe5ea808499232ccb265e71af5d8bfe445cce4d578759429474302aa677e35ca、packSHA=c8610b00deb15f6a2984215ea3a1d1b57975f8e6e15f0f2e077f8dc5c7e879e3、独立consumer c2d5713d-bc44-4add-8d0c-78e0fe83d58b 全配布SHA一致。local-verification-count-retry-command.txtの同内容で再試行。
検証済み：light unit177pass/0fail/2既存skip、tooling236pass、U2unit43pass（9125.938459ms）、U2browser9pass（17.3s）、consumer189pass（14994.609041ms）、Node build/probe/aube28pass（10371.832417ms）、browser probe/aube33pass（40.3s）。計測用package Node115pass（6402.02875ms）、U2 Node43pass（722578.377375ms、計測用コードの時間であり性能値ではない）、package browser99pass（8.2m）。
次のU2 browser計測開始時に生成consumer-input.jsが相対guest path .artifacts/u2-release-inputs/aube-v2.7.0/aubeを埋め込んでおり、cwd coverage/tests/migration-sessionではENOENTとなって試験読込みを拒否、completion exit1。U2browser計測と最終coverage集計は未実行。completion-1802b594-a736-4bec-926f-5f32876436eb/incomplete.jsonを保持し、追加修正前に停止してRetry確認。

### 参照名修正後の完了検証再試行
ユーザー「参照名を修正して再試行」をRetryとして記録、publication-alignment-fixture.ts:284をHISTORICAL_PACKAGE_FILESへ修正。main build/typecheck exit0。固定Bun1.4.2/Biome2.5.15によるpublication bundle generate/verify双方exit0。test-lightはunit179=177pass/0fail/2既存skip、tooling236pass/0fail/0skip（31438.812125ms）。
新候補candidate-8015dfb3-cc2d-4fcb-ad3b-b8c6bc4ec0dd/package.manifest.json、sourceIdentity=3889ed4ec8689e8ae5d0824caba75385c2ce262baa4eb64337f7494aa4a7b53b、packSHA=c8610b00deb15f6a2984215ea3a1d1b57975f8e6e15f0f2e077f8dc5c7e879e3。独立consumer f78951e1-1827-4d8e-b59f-52a419da23f5 の全byteSHA照合成功。必要な候補pathだけ差替えた同じ承認済み内容をlocal-verification-retry-command.txtへ保存して実行。
検証済み：completion内build/typecheck/light成功、U2 unit43pass/0fail/0skip（9353.535708ms）、browser9pass（19.2s）。test-consumerは189件=187pass/2fail/0skip（16155.4675ms）。pack.test.tsのJS14期待に対し16、current-candidate.test.tsの24期待に対し26。失敗記録completion-4e4cae38-b4fe-4fdd-9be7-a69a98a372e7/incomplete.json。probe/aube/coverage未実行。追加修正前に停止しRetry確認。

### 公開配布一覧整合の再試行準備
ユーザー「配布一覧と関連検証資料を整合させて再試行」をRetryとして記録。現16JS/26packと歴史14JS/24packを分離、歴史24正例fixtureと現26候補の公開executorゼロ負例を準備。新候補の公開はU4/B1証拠が揃うまで拒否する。source inventory/manifestへ依存・生成artifactを追加。
検証済み：Bun1.4.2、Biome2.5.15の実path版を確認、mainで7TSをformat。buildはtests/release/publication-alignment-fixture.ts:284の未定義PACKAGE_FILES（TS2304、関連TS7006）でexit1。歴史一覧へのrename後の参照漏れ。typecheck、bundle generate/verify、回帰は未実行。修正前に停止しRetryを確認する。

ユーザー「修正して再試行」をRetryとして記録。public厳密7export、現在のpackage固定16、TerrariumのHISTORICAL_U1_JS固定14／FILES歴史24の境界を修正。新16reportや新module差替え14reportを旧U1成績として取り込めない負例も維持。関連source inventory/manifestへ変更pathを追加し、凍結証拠を変更しない。
検証済み：format/build/typecheck exit0。mise run test-lightではunit部分を通過し、後続toolingで234件中217pass/17fail/0skip（24601.592959ms）、最終exit1。publication-alignment/publication-versionの17失敗は共通してarchive inventory differs。scripts/release/inventory.tsは固定旧FIRST_PARTY_JS14/pack24のまま、試験fixtureは現在scripts/packageの16/pack26を使用して不一致となる。公開処理は実行されていない。新candidate生成と完了検証の再実行前に停止し、追加修正を確認する。

## 承認コマンド初回実行の停止
ユーザー「承認して実行」をlog answerで記録し、local-verification-command.txtのコマンドをホスト権限で実行。build/typecheckはexit0。test-lightのunit部分は179件中170pass/7fail/2skip、3170.946417ms、completion exit1。以降のU2/consumer/probe/aube/coverage収集は未実行。
検証済み：tests/package/coverage.test.tsは固定14期待に対し現FIRST_PARTY_JS16。tests/package/public.test.tsは旧公開3項目だけを期待し、新C03の4関数追加と不一致。scripts/terrarium/coverage.tsは現FIRST_PARTY_JSを歴史的U1 report分母にも使用し、fixtureの不変14件と不一致（5件の失敗）。Terrarium FILESも現一覧から26へ増え、固定24期待に不一致。歴史的U1証拠と現在U2配布一覧の境界整理が必要。2skipは公式release assets未配置という既存試験であり成功扱いしない。
失敗記録は.artifacts/migration-session/completion-b8b5d365-3da6-4271-9640-5e15710b3324/incomplete.json。指示「失敗時は確認」に従い修正前に停止し、Retry/Skip/Abortを確認する。

検証済み：npm0.2.1 tarball SHA256=71ae44f6f8d9de62cda1256e293025bcb40c67c00836f99767e435c478df7e35。npm registry integrity SHA512と一致。署名/provenanceの検証は未実施。
session実装変更をbuildする前のローカル配布JS14ファイル・型3ファイルはnpm pack内SHA256と一致。package.json/READMEとassets配置には差があり、全source/全候補の一致は主張しない。tag v0.2.1の型もU2変更前ローカルと全文一致、開発tool宣言は異なる。観測JSONは.artifacts/migration-session/npm-baseline-v0.2.1.jsonとpublic-baseline-v0.2.1.json。
検証済み：公開packと現在dist/blinkは同じblinkCommit=a882fb2f3df14115b7e46f6812fb296eef5934d7・dirty=false・configure/link条件を記録するが、Emscripten宣言は公開6.0.12/ローカル6.0.10。loader/wasm SHAは異なる。これを同一byteの公開assetとは扱わず、U2候補の実assetで回帰する。npm-baseline-v0.2.1-with-info.jsonに公開build-infoを保持する。toolchain差がdigest差の全原因とは未検証。
