# Code Summary — U2 Guest Distribution

## Current Recovery Steps 16–19 — 要件対応と証拠保持

ドキュメント根拠と保存済み検証を照合し、11要件の全条件を `verification/ci-traceability-repair-v1/requirement-mapping.md` に記録した。traceabilityは11 ID・targetを保持し、AC4.3.1–3/FR6.1/6.2の5件をC3ローカル供給境界のOK、FR6とNFR1/3/4/5/7の6件を理由付きDeferredへ修正した。実配信、FR1–FR7全体/iframe、安全確認、全配布JS union・Worker・遠隔CI、実行終端/出力の受入れはU3/U4等の同一候補証拠が必要であり、対象ファイルの実在だけで全要件達成としない。

今回変更したのはこのsummary、traceability、要件対応資料と新規read-only `reconcile.mjs`およびmainの新規照合結果だけ。source-manifest18件、製品TS/JS、core、guest、既存候補・測定・review・receiptは保持する。計画Step16–19のチェック以外に承認済み計画・Testing Contract・試験指示は変更しない。mainが新helperを実行しexit0/passed:trueを観測した。候補11file・配布3JS・20copy・raw20receiptのidentity/成功/唯一性・coverage mergeと保存結果41/15を照合し、`verification/ci-traceability-repair-v1/main-reconciliation.json`へSHA/size付き結果を保存した。最初のhelper実行はIstanbulオブジェクトとplain JSONの比較形式で失敗し、JSONへ正規化して同一のcounter比較を再実行した。保存artifactは修正していない。正式レビュー/完了はこの資料作成時点で未検証である。

保存正本v3の249/254行98.03%、skip0と既存41Node/15browserの成功は過去のmain観測として保持する。現mainによる旧helperの再照合成功も引き継ぐが、新しいcoverage測定と称さない。U2候補pitchfork2.30.0とU3の2.30.1は別identityである。U1固定14+U2固定3は小計17であり、全体一覧はU3も含めU4で確定する。遠隔CI・実配信・公開RC・全体要件は未検証。Code Generation全体の完了までStopフックは無効を維持する。

## 2026-10-10 正式再開始 attempt 6620d2c934cd0a17

検証済み：ユーザーが通常ターミナルで正式なUNIT_STARTEDを記録した後、既存の製品修正・compiled bytes・供給候補・coverage rawを保持して再検証した。今回のmainによる全5Node試験は41pass/0fail/0skip（1474.470292ms）、Chromium/Firefox/WebKitは15pass（12.4秒、1worker、retry0）。collector self-test、consumer noEmit型検査、Biome10pathも各exit0。詳細は `verification/official-restart-20261010-v2/main-results.json`。

mainのread-only照合もexit0/ passed:true。固定3配布JS、候補11file、測定copy20path、manifest18path、traceability11targetと20receiptを確認した。保存coverage-v3のgeneration/sourceIdentity/candidateSHA256と現bytesが一致し、249/254行98.03%、skip0を保持する。これは旧測定と現identityの照合であり、新しいcoverage測定ではない。再prepare、製品再build、旧raw上書き、ゲスト再buildを行わない。

Step13のstale receipt拒否とStep14の保持ref/legacy-only修正について、過去のRed→Greenは `main-verification.md` の履歴を保持する。今回の正常なソースを修正前Redとして扱わない。Step15の新規v3測定は過去の実施済み結果、今回の41件/15件は追加の非計測再検証として分離した。承認済み計画本文・検証手順、source-manifest、traceability、製品ソースは変更しない。

U2候補のpitchforkはv2.30.0であり、最新v2.30.1の実行受入れはU3の別候補の証拠で評価する。U2の実配信、公開RC受入れ、remote CI、今回の実機Safariは未検証。U1固定14とU2固定3の全17JS/80%以上・統合前CI、既存実行上限を維持する。正式レビュー、Unit完了とcheckpointはmainの正規手続へ引き渡す。Stopフックは全体完了まで無効のまま。

## 2026-10-10 正式再開の照合と新しいmain検証

検証済み：承認済み計画のStep13–15の製品修正と回帰試験は既に現ソースに存在する。使用済み計測directoryの拒否、generation/sourceIdentity/candidateSha256の全receipt結合、existingRootの保持資産コピーとlegacy-only refでもrootを必須とする条件を確認した。今回、新しい製品変更は行わず、過去のRed→Greenを保持し、既に修正済みのソースを修正前Redとして扱わない。

今回main sessionが新たに実行した結果は `verification/official-recovery-20261010-v1/main-results.json` に保存した。候補は全て `.artifacts/u2-guest-distribution/site-repair-v1` で統一した。

| 今回の確認 | 観測結果 |
|---|---|
| 全5ファイルのNode試験 | 41pass / 0fail / 0skip、957ms |
| Chromium / Firefox / WebKit | 15pass、9.9秒、1worker / retry0、正式ホスト権限で実行 |
| consumer型検査 | tsc --project tests/guest-distribution/tsconfig.json、exit0 |
| 計画記載のBiome対象10ファイル | exit0、Checked10、No fixes |
| collector self-test | exit0、未import3ファイルを0%として保持、Node/browser/case欠落・skipの拒否を確認 |
| 保存測定と現ソース・候補の読み取り照合 | helperをmainが実行しexit0、passed:true。配布3JS source/instrumented SHA、候補11file size/SHA、計測copy20path、manifest18path、traceability11targetを確認 |

保存測定の正本は `.artifacts/u2-coverage-repair-v3/report.json`。固定3配布JSは249/254行=98.03%、skip0、20receipt。generation `976e4419-c417-45ce-a819-46a1ab6c148c`、sourceIdentity `7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54`、candidateSHA256 `cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7` が現bytesと一致し、全receiptも同identityへ結合している。**これは保存されたcoverageの現identityへの照合であり、今回新しくcoverageを測定した結果ではない。** 過去の測定directory・report・receiptは変更しない。mainは一致した証拠を維持し、再prepareや新測定を不要と判断した。

正式buildで生成された現compiled bytesを保持し、今回は製品TS/JS、候補、guest、他Unit、AI-DLC導入ファイルを変更・再buildしない。検証用テストのタイトルにある「latest pitchfork」は候補内のv2.30.0を指す歴史的名称であり、最新版v2.30.1の供給・実行を今回U2で検証したとは主張しない。供給対象はaube v2.6.1/v2.7.0とpitchfork v2.30.0、tools既定値はローカル検証用再構成のまま。U1のv2.30.1実行結果をこの別候補へ転用しない。

未検証：実配信、公開RC、remote CI、今回の実機Safari、以前のSafari接続問題の原因・恒久的解消。U4の固定17JS・80%以上・統合前CI、既存probe600秒 / aube browser840秒 / 1worker / retry0 / wasm1GB条件を維持する。この資料整理は正式レビュー、Unit完了記録、工程承認を代行しない。第三者レビューと正式Unit手続はmainへ引き渡す。

## 現在の状態

検証済み：2026-10-08、計画の人間承認後に2件の不具合を修正し、main sessionでRed→Green、正式TypeScript build、Node40件、3ブラウザー15件、consumer型検査、Biome、collector self-testを確認した。新しい計測copyのNode40件とbrowser15件も成功し、固定3配布JSの249/254行=98.03%で80%基準を通過。U2のローカル供給契約の検証であり、実terrarium接続・実配信・U4 CI/全17配布JS・実機Safariは未検証。

## ソースと変更

現リポジトリはTypeScriptでauthoringし、正式build後の.jsを実行・計測する。旧.mjs/ESLint記述を現在のsource-manifest/traceability/docsに対応付けた。既存manifest.ts、fixtures.ts、resolver.tsの公開契約と実装は変更しない。

- scripts/guest-distribution/coverage.ts：出力directoryを排他的新規作成とし、Node/browserの全測定receiptをgeneration/sourceIdentity/candidateSha256へ結合する。不一致・欠落・使用済みdirectoryを拒否。固定3配布JSのzero maps/80%/全realm/case要求を維持。計測copyに既存tests/sharedを同梱し、byte一致もself-testで確認。
- scripts/guest-distribution/stage.ts：existingRootの通常資産を新候補へ保持し、symlink/特殊fileを拒否。残るschemaVersion1 refは全guest/fixtures/build-infoのroot内相対path、digest、ELF、provenance、fixtureを検証。root不足・資産欠落・改変時は完成候補を出力しない。legacy metadataと通常資産も保持する。
- tests/guest-distribution/stage.test.ts、integration.test.ts：保持refとnew refのHTTP解決・全資産取得、legacy bytes保持、root不足/欠落/digest/path/symlinkを検証。coverage.ts self-testは古いgeneration/source/candidateのNode/browser結果を拒否する。
- docs/guest-distribution.md：入力/保持資産/TypeScript build/Biome/配布.js/固定14+3=17と検証状態を更新。

runtime、npm exports/files、ゲストsource、AI-DLC本体・hook設定、共有型は変更しない。既存成果を再生成せず対象の不具合を修正した。

## 観測した検証

詳細コマンド・Red・環境制約はmain-verification.mdに記録。

| 確認 | mainの結果 |
|---|---|
| 正式build | tsc -p tsconfig.json、tsc -p tsconfig.tests.json、node .build/scripts/emit.js：各exit0 |
| 回帰Red | collector stale generationが拒否されないassertion失敗、producer保持guest ENOENT/拒否欠如、保持ref HTTP build-info404 |
| 回帰Green | collector self-test exit0、producer11pass、全5Nodeファイル40pass/0fail/0skip |
| consumer型/Biome | tsc consumer exit0、Biome対象10ファイルexit0（整形後） |
| 非計測browser | Chromium/Firefox/WebKit計15pass、1worker/retry0、10.2s |
| 計測Node/browser | 新規v2でNode40pass/0fail、3browser15pass（10.9s） |
| 固定3配布JS | manifest.js 89/89、fixtures.js92/94、resolver.js68/71。249/254=98.03% |
| 構造/要件sensor | plan required-sections pass。traceabilityは他Unit AC25件との差分だけでpass:false、U2 gaps/orphans/invalid-targetsは空 |

初回browserはmacOSサンドボックスのMach port起動制限で失敗し、正式なホスト権限で成功。基準は変更しない。初回計測v1は共通helper未同梱でNode33pass/1fail、成功測定として使用しない。collector修正後、新規v2で全結果を収集。CLIのフルpath filterはNo tests foundだったため、同じUnit専用configが列挙する15件をfilterなしで実行した。性能benchmarkは実施していない。

## 候補と測定identity

旧site-v2のtools.jsonと元の入力/verification JSONは現環境に欠落していた。残存3buildの全資産digestを元dist/builds.jsonと照合し、正規producerから新規site-repair-v1を生成した（11files）。toolsのdefault/fixture/cwdは明示したローカル検証用値であり、旧catalogueの完全復元とは主張しない。aube v2.6.1/v2.7.0、pitchfork v2.30.0の残存bytes/provenanceを利用し、再build/取得なし。

- 候補：.artifacts/u2-guest-distribution/site-repair-v1
- 候補SHA256：cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7
- 正本：.artifacts/u2-coverage-repair-v2/report.json
- generation：e8232136-10f5-406a-9b67-464e0a65cba0
- sourceIdentity：7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54
- Node5process/browser15caseの20receiptを結合・照合し、passed:trueを観測。

## 引渡しと限界

U1固定14の既存証拠を維持し、U4でU2固定3を含む全17配布JS/80%/統合前CIを検証する。U3の接続は既定/work、/rootを維持してselected.entriesをseedへ渡し、公開setCwd(selected.cwd)を使う。sibling entry保持をU3で検証する。probe600秒/aube browser840秒/1worker/no retries/wasm1GBの既存上限は維持。公開・push・PR・npm publishは未実施で、今回の承認から外部操作の許可を推定しない。

## Step12 — 2026-10-09 再開時の引渡し整理

検証済み（保存されたmain-verification.mdとreview-03.md）：legacy-only保持refでもexistingRootを必須とする最後の修正は、producer Red10pass/2fail→Green12pass/0fail。正式build3段階、consumer型、Biome10files、collector self-testはexit0。全5Node filesは41pass/0fail/0skip、fresh coverage-repair-v3のNode41・三browser15（11.4秒、1worker/retry0）も成功。固定3配布JSは249/254行=98.03%、20receiptを照合。review-03はR-01/R-02 Resolved・READY。上記v2/40件は過去の成功として保持し、最後の修正後の測定正本は `.artifacts/u2-coverage-repair-v3/report.json` とする。

v3 generationは `976e4419-c417-45ce-a819-46a1ab6c148c`、sourceIdentityは `7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54`、candidateSHA256は `cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7`。v2のgenerationと結果をv3へ流用・再ラベルしていない。今回の作業は保存証拠と現identityの照合・記録整備で、上記suiteを今回再実行したという意味ではない。

検証済み（今回のmain読取り照合）：現配布3JSのsource/instrumented digest、候補11fileのsize/SHA、manifest18path/traceability11targetは一致・実在。旧reviewed-source-dcfdbccc1bdb.tsvに対しstage.ts/stage.test.tsだけ不一致だったが、これは最後のlegacy-only修正前snapshotである。現stage/coverageと5Node testのTS/JS、consumer.spec.ts、serve.ts/js、types.ts/js、tsconfigはv3/workspaceの測定copyと完全一致。consumer.spec.js差分はcollectorのcoverageWrite import/afterEach挿入のみ、Playwright configの差分はoutputDirとcompiled .js選択のみ。最後の修正を測定したv3を現sourceへ結合でき、同suiteの再測定は不要とmainが判断した。docsの今回追記は供給製品・測定対象を変更しない。Step12の資料整合を完了し、正式レビュー・Unit手続はmainへ渡す。

供給対象は既存site-repair-v1のaube v2.6.1/v2.7.0とpitchfork v2.30.0である。最新版を主張しない。U1の現pitchfork v2.30.1 ELF・native基準・core a882fb2fの実行検証やSafari5caseとは別の版・供給候補であり、それらの合格をこのU2候補の実行受入れへ転用しない。tools既定値はローカル検証用再構成、旧catalogue完全復元ではない。新候補生成・guest再build・公開・外部repo変更は行わない。

C3/FR6/US4.3の対応はtraceability.jsonのAC4.3.1–3とFR6/6.1/6.2から実在resolver/manifest/stage/consumer/integration試験へ、関連NFR1/3/4/5/7は三browser・固定3JS計測・fixture/URL境界・provenance検証へ結ぶ。U3へ選択されたentriesとcwdの公開API受渡し、U4へcandidate/source/generation結合を引き渡す。U1固定14+U2固定3の全17JS/80%以上・統合前CIはU4所有。実配信、公開RC受入れ、remote CIは未検証。今回のStep12資料整備は第三者レビュー依頼・Unit検証・工程承認を代行しない。
