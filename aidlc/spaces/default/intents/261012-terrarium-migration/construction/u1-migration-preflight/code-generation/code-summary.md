# U1 Code Summary

Status: v10（最新toolchainでのU1/U2の確認）は、Step 16の修正とU4の共有fileの変更より前のsourceの履歴である。修正後のsourceでの36試行とv11は、まだ実施していない。新しい読取り専用の検証コマンドは人間の承認済み。R-01は修正済み。独立レビュー・正式checkpoint受入は未完。R-02は未解消。

## 共有coverageのsuiteの許可リストの引受けと、最終sourceの結果：Step 24（2026-10-17）

最後のまとめた確認のD3（U4の受入）が、coverage-reportで「invalid Playwright expected suites」で止まった。人間の指示で、共有の `scripts/package/coverage.ts` の `readPlaywrightNodeRealms` の許可リストに `command` を加えた（1行）。U1もclaimするfileなので、U1の変更として引き受けた。
- fileを読んで確認：変えたのは許可リスト `allowed` に1つ加えたことだけである。空・重複・未知のsuiteの拒否（`invalid Playwright expected suites`）、suite registryと期待suiteの完全一致（`Playwright suite registry mismatch`）、generation・launch・begin/endの照合は変えていない。U4のacceptanceの試験で、`command` を含む一覧は通り、空・未知（`other`）・重複は引き続き拒否されることを確かめた（REDのあとGREEN）。U4・U3のacceptanceとpackageのcoverage試験で82件pass、fail・skip 0。
- 最終sourceでの結果（mainの観測、Node v26.12.0）：
  - 36試行（`.artifacts/migration-preflight/mirror-browser-final-20261017`）：36件pass、6つの中央値は505〜751ms、各記録にNode v26.12.0・Playwright 1.64.1。
  - current completion v11：入力 `.artifacts/migration-preflight/current-recovery-input-20261017-v11.json`（SHA256 d0798e289bb017cc17bae5e95788dcea0cdcf8bde0041d2292afdf46ab758a6f）、20工程pass、coverage 86.42%（1776/2055、skip 0）、report `.artifacts/migration-preflight/current-completion-64f021b6-7aba-46dd-acb3-265040ada0fb/current-local-verification-report.json`（SHA256 387549e63296321962b83a062b1d2535e9c04c852783230afff5a6ec5021d486）。短いverifyは `verified:true`・`currentSourceVerified:true`・`acceptancePassed:false`・`mergeAllowed:false`。pendingは「current same-source signed CI before merge」と「U4 B1 integration acceptance (C06)」。U4の受入ではB1の31 checkがpass済みだが、署名付きCIは未実施。
  - v10は、Step 16より前のsourceの履歴として扱う。
- 証明書は、試行のあとに削除し、keychainと信頼設定に不在を確かめた。

## current-candidateの試験の期待値の引受け：Step 22（2026-10-17）

公開用inventoryの更新のあと、最後のまとめた確認のD2（U3の受入）が `test-consumer` で止まった。`tests/terrarium/current-candidate.test.ts` が、配布fileの件数を31と固定していたためである。人間の指示で、期待値を33へ直した（1行だけ）。U1もclaimするfileなので、U1の変更として引き受けた。
- fileを読んで確認：この試験は、`PACKAGE_FILES`（`scripts/package/stage-package.ts`、33件）からfixtureのmanifestを作り、`verifyInstalledPackage` で照合する。変えたのは件数の確認（`manifest.files.length`）だけで、`verifyInstalledPackage` の照合、改変の拒否、そのあとの各assertは変えていない。
- mainの観測（証明書なし、Node v26.12.0）：U3の候補で build・typecheck・test-light（194・237件pass）・test-consumer（205件pass）・migration-session-unit（46件）・migration-install-unit（74件）。候補を作り直したあと、U4の候補で test-consumer（205件）・migration-command-unit（94件）。どれもfail・skip 0。
- source-manifest.json：このfileと生成JSは既にclaimしている。追加はない。

## 公開用inventoryの更新の引受け：Step 20（2026-10-17）

最後のまとめた確認のD2（U3の受入）が、`test-light` でpublication-alignmentの2件（21件・31file前提）のために止まった。人間が承認した修正案（U4の `publication-inventory-23-proposal.md`）に従い、U4の項目7で次を変えた。U1もclaimするfileなので、U1の変更として引き受けた。
- `scripts/release/inventory.ts`：`FIRST_PARTY_JS` に `runtime/command-parse.js`・`runtime/command.js` を、配布用inventoryと同じ位置に加えた（23件、`PACKAGE_FILES` は33file）。`HISTORICAL_U1_JS`（14件）・`HISTORICAL_PACKAGE_FILES`（24件）は変えていない。
- `tests/tooling/publication-alignment.test.ts`：期待値と試験名を23件・33fileにした。配布用inventoryとの完全一致（`deepEqual`）の判定は残っている。
- `.github/publication/runner.mjs`・`runner-manifest.json`：固定のBun 1.4.3・Biome 2.5.15で作り直した。runner.mjsのSHA256は873738ab…から234f4ac1…へ。差分はinventoryの2行と、manifestのSHA256・sizeだけ。`bootstrap.mjs` は同じbytes（40d11ed7…）。
- 公開の境界（fileを読んで確認）：publication CLIは、`HISTORICAL_PACKAGE_FILES` にないfileを含むpackを、引き続き「U2 publication missing module coverage; U4/B1 evidence required」で拒否する。2件目の試験は、以前は別の理由（`archive inventory differs`）で拒否されていたが、今は本来の理由まで届いて拒否を確かめる。23件のpackは、U4/B1の証拠なしには公開されない。
- mainの観測（Node v26.12.0）：publicationの5試験file（alignment・bundle・bootstrap・version・assets）で61件pass。`mise run test-light` exit 0（package 192 pass・既存のskip pattern 2、tooling 237 pass）。fail 0。
- source-manifest.json：上のfileはすべて既にclaimしている。追加はない。
- 受入れ中の公開RC、そのタグ、固定入力は変えていない。

## U4の変更の引受け：Step 18（2026-10-17）

U4の追加Step項目4で、U1がclaimする試験fileが変わった。人間の判断で、この変更をU1の変更として引き受けた。
- `tests/package/pack.test.ts`：`FIRST_PARTY_JS` を21件から23件、`PACKAGE_FILES` を31件から33件にした。
- `tests/package/coverage.test.ts`：固定inventoryを21件から23件にし、名前の一覧に `command`・`command-parse` を加えた。
- `tests/terrarium/coverage.test.ts`：現在の配布JSの組み立てを23件にした（変数名 `currentTwentyOne` を `currentTwentyThree` に変えた）。
- 差分は、件数と名前の一覧だけである。実際の配布一覧（`FIRST_PARTY_JS`）に合わせただけで、assertの種類、拒否の条件、coverageの判定は変えていない（`jj diff --from 7c7ceaf4` で確認）。
- `tests/package/public.test.ts`（root exportの一覧に `createCommandSession` を加えた）は、U2がclaimするfileである。U1のsource-manifestには加えず、U2のやり直しで引き受ける。
- mainの観測：package・terrariumの試験44件、U4の新しい候補での `pack.test.ts` 7件がpass（fail・skipは0）。

## 再レビュー指摘の修正：Step 16（2026-10-17）

review-08の指摘4件を直した。各件とも、先に再現試験を書いてfailを観測し、修正後に同じ試験でpassを確かめた。
- RED：type checkのTS2305。3件の試験がfail：「読む前の大きさで拒否」「trial記録のNode/Playwrightの版」「browser logとtrial fileの一致」。
- GREEN：current＋evidence＋baselineの試験が40/40、`migration-preflight-unit` が57/57で、どれもfail・skipは0。
- (Major) `tests/migration-preflight/consumer.spec.ts` が、trial記録の `environment` に `node`（`process.version`）と `playwright`（導入済みの `@playwright/test` の版）を書くようにした。`current-evidence.ts` は、組み立ての時点で `node` を上書きしない。全trialで同じ値であり、かつ今のNodeと導入済みのPlaywrightに一致することを求める。
- (Minor) `current-evidence.ts` が、browser logに出た36件のpass行（tool・browser・trial番号）を、trial fileと1対1で照合する。`current-completion.ts` からlogのpathを渡す。
- (Minor) `baseline.ts` の `readAccepted` が、`stat` で大きさを確かめてから読む（3GiBのsparse fileで試験した）。
- (Minor) reportの `pending` を、`CURRENT_PENDING`（現在のsourceの署名付きCIとmerge、U4のB1統合受入）にした。

あわせて、U4の作業を戻したことで出たbuildエラーを直した（どちらも人間がU4の追加Stepで決めた内容）。
- U1がclaimする `scripts/terrarium/coverage.ts` を `mode:'strip'` にした（Node 26は `transform` をやめた）。`tests/terrarium/coverage.test.js` は16/16でpass。
- `tsconfig.json` のincludeに、U4のbrowser型宣言を加えた。
- U4の試験の補助file（`tests/migration-command/harness.ts`）の型を1か所直した。

`tests/migration-preflight/current-completion.test.ts` の配布JSの件数は、U4の追加に合わせて23件に変えた。

下のv10の実行結果は、この修正より前のsourceで得たものである。修正後のsourceでの36試行とcurrent completion（v11）は、U4の共有fileの変更がすべて終わった後に、1回だけまとめて実行する。それまでは、v10を修正後のsourceの成功証拠として扱わない。なお、今日の36試行の記録は、修正前のものなのでNode/Playwrightの版を持たない。新しい組み立て処理はそれを拒否する（設計どおり）。

## 現在の結果：v10（2026-10-17、最新toolchain）

方針（人間の指示、2026-10-17）：古い版のtoolで作った記録は、今のtoolchainの根拠にしない。古い版を一時的に使って過去の記録を通さず、最新版で実行した成否だけで確かめる。これに合わせてcurrent completionを変え、古い記録を照合する2つの処理をやめた。1つはU2完了時の封印済みverifierをNode 24で動かすretained-evidence工程、もう1つは手作業で作った `verification-input.json` の照合である。代わりに、同じ実行の中で作り・確かめた証拠だけで判定する。

- 変更したコード（U1のfileだけ）：
  - R-01の修正：`baseline.ts` の `readAccepted` に、1MiB上限と重複key（escaped aliasを含む）の拒否を入れた。`parseUniqueJSON` は新規の `unique-json.ts` へ移し、`verify.ts` から再exportする。
  - 新規 `current-evidence.ts`：36試行とbaseline CIから受入証拠を組み立てる。
  - `current-completion.ts`：retainedの工程をなくして20工程にし、preflightの入力を封印する。今のNodeで作った証拠だけを受け付け、組み立てた証拠を照合する。
  - vivarium baselineのNodeの版を26.12.0にした：`baseline-workflow.yml`（artifactの保持を7日に）と `build-baseline.sh`。controllerを再生成した。
- 試験：各変更でREDを観測してからGREENにした。最終結果は、current＋evidenceが25/25、U1 unitが56/56で、fail/skipは0。
- baseline CI：vivarium run 38990951678（commit 570bd13b、署名Verified）。Node v26.12.0、約41分でsuccess。
  - firstはcompileSkipped=false、reuseはcompileSkipped=true。ELFは両方とも `256fe184…77c9`、buildKeyは `3c4d9fd1…ff60`。
  - mainで、REST応答・artifact ZIPのdigestとsize・展開した5ファイルを独立に照合した。Node 26でkeyを再計算し、readAcceptedを通ることも確かめた。
  - 保存先：`.artifacts/migration-preflight/baseline-node26-38990951678/`。
- 36試行：コード変更後のsourceで、Playwright 1.64.1（Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2）により実行し、36件すべてpassした。
  - localhost証明書は新しく作り、期限を確かめてから一時登録した。終了後に削除し、未登録であることを確かめた。
  - warmの中央値は最大でBiome/Firefoxの751.3ms。
  - 記録：`.artifacts/migration-preflight/mirror-browser-node26-20261017b/`。
- v10の実行：入力は `.artifacts/migration-preflight/current-recovery-input-20261017-v10.json`（SHA256 `56c78183…6fb9`）。
  - 20工程すべてexit0（02:15:47Z〜02:34:25Z）。全21配布JSで1768/1929行＝91.65%、skip0、1495 realm。
  - 受入証拠 `acceptance-evidence.json`（SHA256 `21d6a3ae…a9af`）を組み立て、`checkAcceptance` を通った。
  - report：`.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json`（SHA256 `e7760ddb…7a01`）。
- 検証コマンド（人間の承認済み）：`aidlc/spaces/default/intents/261012-terrarium-migration/verification/verification-command-u1u2-v10.txt`。mainが実行し、`verified:true` を返した。
- 受入の境界：`acceptancePassed=false`、`mergeAllowed=false`。v10のreportの `pending` には、生成した時点の固定文言（U3の項目）が残っている。判定には影響しない。現行のコードでは、Step 16で `CURRENT_PENDING` に直した。実機Safariは未検証。
- 以下のv8・v4・v6・v7は、古いtoolchain（Node 24.21.0など）での履歴として残す。今の判定には使わない。v8のraw証拠には起動台帳がないため、今のcoverage readerでは再照合できない。

## 履歴：v8（2026-10-16、Node 24.21.0）

検証済み：新規固定入力v8で main が21工程を逐次実行し、全child exit0、その後の独立raw再計算も成功した。実行は `2026-10-16T10:18:42.073Z`〜`2026-10-16T10:42:13.335Z`。現在の全21配布JSが分母に残り、1768/1929行＝91.65%、skipped0、1495 realms（厳密検査したPlaywright Node12プロセスを含む）。以前の1495realm集計を新sourceへ付け替えず、新しい候補・consumer・固定入力・raw証拠を使用した。

- 入力：`.artifacts/migration-preflight/current-recovery-input-20261016-v8.json`、SHA256 `25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0`。
- 結果：`.artifacts/migration-preflight/current-completion-8c15f728-80d1-40e4-90e6-cea86c413cb8/current-local-verification-report.json`、SHA256 `fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079`。
- 候補sourceIdentity：`d7a94b49ce7bc48c9b7374e32c6ee8db55724835a897701af1bd35b40f663537`。検証入口を含むcurrentSourceIdentity：`f145ef3baaf07f9542a8e683c18a6bab2a7981500bfcc01f46214c2117f2fe78`。
- 新候補：`.artifacts/migration-install/candidate-619c9bf3-d619-4611-8202-7821bd820070/package.manifest.json`。独立consumer：`/private/tmp/formicarium-u1-recovery-v8-consumer-20261016`。実tarball SHA256は `cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2`。

生ログの実件数：U1単体55、current-completion19、軽量193＋tooling237、受入/CI境界43、U2単体44、install単体74、通常browser U2=9/U3=45、consumer204、既存Node回帰28/browser回帰33、coverage Node115＋115、coverage browser99＋9＋9。対応する `command-1.log`〜`command-21.log` とSHAを新reportが封印し、必須試験のfail/cancel/skip/TODOを0と確認した。製品runtimeやSHA処理、install180秒、非download中央値3秒、coverage80%、容量上限、worker1/retry0は変更していない。

今回の修正は `current-coverage.ts` と `current-completion.test.ts`、通常buildで生成した対応JSだけ。既存 `readPlaywrightNodeRealms` をpackage/session/install全suiteへ適用し、その生counterとrealm名を独立再計算へ追加した。metadata/layout/全分母/集計値/realm名の一致条件は維持する。自己完結した小さいfixtureと実生成bootstrapのNode子プロセスによる正常試験を先に追加し、mainで `raw current coverage differs from aggregate` のREDを観測した後、読取り側の最小修正を行った。片側begin/end欠落、generation不一致、合法counter変更、realm名変更の拒否も含むcurrent19件は成功した。既存の1495realm実証拠を試験fixtureへ流用していない。

旧v6はsource394件中11件が変わっていたため保持資料として残した。v7は21工程がすべてexit0でも独立再計算でPlaywright Node記録の取り込み漏れにより失敗し、失敗結果を上書きしていない。今回のv8成功は別source/別固定入力/別出力である。歴史的36試行・CI first/reuse・retained U2署名証拠は歴史範囲だけを照合し、現在sourceのCIとは呼ばない。

結果の範囲は `status=current-local-verification`、`completedUnits=[U1,U2]`、`currentSourceVerified=true`。`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false` を保持する。新しい短いverifyコマンドの人間承認・設定・独立レビューは未完であり、改訂計画Step14は未完。U3計画への人間の承認とengine受理は別で、active U1のためU3完了を意味しない。U3性能36試行・専用CI・現在sourceの署名CI/merge、実機Safariはこの結果で受入しない。reportのpendingは生成時点の状態のまま保存する。

改訂Step13の検証済み結果：`.gitignore` に `!/scripts/migration-preflight/current-coverage.js` と `!/tests/migration-preflight/current-completion.test.js` だけを追加し、source-manifestへ `.gitignore` を個別claimした。mainの `jj file track` はexit0で、read-only file listに両pathが存在する。生成JSの内容、ほかの生成物、`.js.map` の追跡条件は変更していない。mainの封印再照合はexit0で、v8入力SHA `25d44cb9...` とreport SHA `fe0d5a01...`、currentSource394件、evidenceFiles435件、installed31件、21工程のexit0、candidate/guest/歴史binding/verifier、実配信site、現在source identityを確認した。両生成JSのSHAもv8封印値と一致する。封印対象不変のため21工程は再実行していない。このread-only整合確認は人間承認待ちの新短いverify実行とは別で、formalCheckpointExecuted=falseを保持する。独立レビューはこの時点では未開始。

## 過去の復旧結果（2026-10-15）

以下の旧v4の「現在コード」「currentSourceVerified」は当時の固定sourceにだけ適用される履歴であり、v8の現在source確認には使用しない。旧v4/v6/v7を含む原入力・原report・生記録は保持し、現在sourceとしての主張は先頭のv8結果だけである。

検証済み：`current-completion.ts` のprepare/run/verifyを分離し、新候補・独立consumer・固定guest・実配信site全ファイル・現在source390件・歴史証拠をSHA256で固定した。実childだけを順次実行し、欠落・改変・skip・非zero・古いsource/packを拒否する。短いverifyも同じ入力・結果・全raw証拠・exact commands・時刻・current source/pack/consumerを照合し、生counterからcoverageをread-onlyで再計算する。模擬executorの成功では正式証拠を生成しない。

現在21JS/31filesの配布一覧とpackage/terrarium/publication試験を整合した。歴史U1の14JS、U2の16JS、旧coverage・CI・原資料は保持し、現在の成功へ再ラベルしない。publicationの既存gateは新install入り候補を引き続き拒否する。releaseの固定Bun/Biomeでpublication runnerを再生成し、実配信試験に必須の`U2_ACTUAL_SITE`を固定入力へ封印した。旧U2専用completionの16JS境界は変更せず、現在候補には使用しない。

計測中のInt32 overflowは、coverage bridgeで非負safe integerだけを受け入れ、2147483647で飽和させることで修正した。飽和値は実行頻度の下限であり、厳密な頻度ではない。未実行0と行coverage判定は維持し、aggregateとcurrent verifierは負のraw counterを拒否する。旧負数資料を補正せず、新規v4試行で確認した。本番SHA256処理は変更していない。

main観測：2026-10-14T21:44:58.257Z〜22:53:07.199Z（JST 10月15日06:44〜07:53）、21子工程すべてexit0、最後のraw検査も成功。全21JSのcoverageは1755/1916行＝91.59%、skipped0、1483realms、401証拠ファイル。U1単体55件・新current17件・U2単体44件・install単体60件・通常consumer195件、Node coverage115+101件、browser coverage99+9+9件を実行。test-lightは185件＋tooling237件、通常browser U2/U3各9件、既存browser回帰33件も成功した。詳細と固定SHAは`current-recovery-verification.md`。

受入境界：`currentSourceVerified=true`は現在のU1/U2 local回帰の証拠であり、`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false`。歴史CIは当時の同source/pack・署名を検査しただけで、現在sourceの新CIではない。U3性能36試行・U3専用CI・現在sourceの統合前CI/merge・U3改善計画の正式実装前承認はpending。実機Safariは未検証。

openレビュー：R01 Major（baseline cache metadataの上限/重複JSON）とR02 Minor（tarの同期展開中の取消分割）は今回変更対象外で未解消。R03 Minorの「現在入口未検証」は今回の全工程証拠で検査可能になったが、解消判定は独立レビューに委ねる。新CIやU3受入が完了したとはしない。

以下は当初U1実装・受入資料の履歴であり、固定14JSの結果を現在21JSの証拠として使用しない。旧`main-verification.md`・`final-verification.md`・歴史証拠ディレクトリは書き換えていない。

## 実装

scripts/migration-preflight の evidence/assets/runner は C01 の36行集計、固定 guest の安全取得・ELF/metadata検査、fresh session の工程計測を実装。prepare-mirror は公式 byte pins を保つ localhost HTTPS 検証入力を用意する。verify は JSON duplicate key を拒否し、実入力・CI first/reuse receipts・受入 byte・必須試験記録・固定14JS coverage を全 AND で照合する。

baseline は固定 Biome commit と immutable Rust image を使い、全入力 key、single writer、staging/atomic acceptance、同 key 再利用、4時間 deadline を実装。実 CI 初回で make 不在が判明したため、一次確認した Alpine make 4.4.1-r4 の APK digest を追加し、同じ build container で署名検証付きの offline install と版照合を行う。公開 product runtime/core API は変更していない。

tests/migration-preflight の server は厳密 allowlist/COI/CSP/no-store/TLS 検証維持を備える。元コア SHA が既存 package pins と一致することを確認し、assetDigests は専用 immutable HTTP 応答だけへ補完した。元 dist byte は維持する。consumer は失敗行も別 artifact に保存し、欠落時間をゼロで補わない。

## 観測済み

- main baseline: build/typecheck/light、consumer189件、Node回帰28件、既存 browser回帰33件成功。
- 新規六部品の unit suite は make 修正後52件成功（evidence9/assets9/runner8/prepare-mirror8/baseline10/verify8）。これは fixture suite。
- 実 HTTPS mirror browser36件成功、非ダウンロード工程の六中央値479.74–710.3ms。試行 source75e4adf0a51db8fcc1af25676d54fc81fa09efee。原 trial JSON と環境を保存済み。
- 実 CI run38311656181 は commit b6921789c70cecf45635f1b22524dc8abf8698db、39m21s、first compileSkipped=false / reuse=true / versionExitCode0。同 ELF SHA256は256fe184205f99a4652691f18098b0e2ceff0e676083baf7077dca68ce3b77c9。
- build/typecheck/bundle構文/bash構文の main 成功記録あり。一時証明書削除・不存在確認済み。

最終 browser 回帰33件は main で41.4秒・成功を観測済み。固定14JS coverageはNode115件とブラウザ99件が成功、982行中862行（87.78%）、skipped0、1253realmsで合格した。completion.ts は live build/typecheck/unit/consumer/Node/browser/固定14JS coverage/実証拠照合を逐次実行する入口として作成した。入力名配列のTS7053で一度停止後、ユーザー承認によりas constを追加し、build/typecheck exit0、55pass/0fail/0skip（追加3境界を含む）を観測した。必須入力欠落、子失敗で後続停止、同時重複拒否を検証済み。入口全体のlive実行は初回コマンドの人間承認前なので未実施。

証拠は main-verification.md、baseline-verification.md、baseline-input-observations.md、および docs/results/terrarium-migration-preflight-evidence/ を参照。以後の最終coverageと入口の結果は main が実観測後に更新する。

共通コマンドをユーザーが承認後、mainで変更せず実行しexit0。build/typecheck、単体55件、consumer189件、Node回帰28件、ブラウザ回帰、coverage Node収集・ブラウザ99件、実証拠照合まで成功した。最終coverageは87.78%、982行中862行、skipped0、1253realms。詳細はcompletion-verification.md。共通入口のlive実行を未実施とした上記の記載は承認前の履歴であり、現在は検証済み。

## 未完と境界

source-manifest.jsonはstrict schemaの変更対象pathを列挙し、SHA/revisionは別観測記録へ保存する。共通コマンドは live unit/integration/E2E/coverage を実行する入口案であり、verify の歴史記録照合だけを完了確認としない。実36行・CI proof・既存回帰・実pack固定coverageをまとめたverification-input.jsonを実verify入口で照合し、exit0「U1 evidence acceptance passed」を観測した。証明書の再登録は不要。OS process group の実取消試験、実 Safari、他アプリ負荷計測は未検証。U1 独立レビュー・受入はまだ行っていない。
