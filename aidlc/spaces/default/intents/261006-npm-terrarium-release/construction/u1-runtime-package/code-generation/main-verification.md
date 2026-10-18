# Main Verification — u1-runtime-package

## 2026-10-10 CI・要件対応修復 — Steps89–92

検証済み：今回の主実行は verification/ci-traceability-repair-v1/main-results.json。保存346file・candidate24/runtime14/components14・修復前57対応・v14 coverage862/982=87.78%/skip0/1253realm・Safari5caseの読取り同一性照合exit0。runner-ready は3/3、fail0/skip0、291.780292ms、exit0。製品・テスト・source-manifest既存claims・v9候補bytesは変更していない。

ドキュメント根拠と保存実行結果を個別照合し、traceabilityへ14 exact IDsを追加した。既存28AC/16詳細NFR/13BRの57行を保持し合計71行。追加12 OK、FR3/NFR2はDeferred。[個別条件・実テスト名・保存ログ・不足証拠](verification/ci-traceability-repair-v1/requirement-mapping.md)を正本とする。FR3は実terrarium terminalからの状態/分離結果をU3で正式結合、NFR2は同じ制約/資産tupleでの遠隔CI結果をU4で確認する必要がある。targetの実在だけを達成判定としない。

保存済み追加検証 package Node138/三browser123、core Node54/三browser36は以前の実行を参照する。今回の追加実行はrunner3件のみで、全suite・coverage・Safariを再実行したとは扱わない。旧失敗・旧0/3・旧candidate履歴は下に保持する。U4への候補/coverage/consumer引継ぎは上記mapping末節と既存test instructionsを参照。旧Safari CI案はcore-onlyで不足。

未検証：遠隔CI、公開RC導入、guest可変coldbuild入力の再現、以前のSafari失敗原因/恒久解消。親がBuildTest Loop-back1 ledgerへ追記済み。Step93の新しい正式レビューと単位完了は親が実行する。Code Generation全体完了まではStop無効を保持する。


## 新attemptの再照合（2026-10-08）

検証済み：承認後のStep31をmainが逐次実行。`node --test tests/package/runner-ready.test.js` は3pass／468.356584ms。`node scripts/package/verify-package.js .artifacts/u1-package-v8.manifest.json .artifacts/u1-v8/aletheia-works-formicarium-0.1.0-rc.1.tgz` はexit0、24files／14第一者JS、blinkSourceDirty=false、候補SHA256 `ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35` を確認しました。

Step32としてmanifest・traceability・component-test-mapを現在の内容で新attempt成果へ再保存しました。製品コード・候補bytes・coverage証拠は変更していません。下のbaseline／browser／coverage結果は前attemptの観測であり、今回再実行したとの主張ではありません。pitchfork sourceTag不一致は未解決、統合前CIと実Safariは未検証。Step33のadvisory reviewと別途checkpointコマンド人間承認は未完了です。


## 現行移行の観測（2026-10-08、v8 / v11）

検証済み：以下はmain sessionの逐次実行結果です。委任agentはテスト・buildを実行していません。現行ソースはTypeScript、Biome、実行対象はbuild後のJSです。

候補manifest `.artifacts/u1-package-v8.manifest.json` と実tgzのSHA256が一致：`ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35`。24files／14 first-party JS。空のconsumer-v8にインストールして検証しました。旧v7の結果は今回候補の判定に流用しません。

| 実行・対象 | 観測結果 |
|---|---|
| npm ci（/tmp cache）、npm run build | 成功 |
| U1 baseline | 108 pass |
| runner readiness | 3 pass |
| contracts / tooling / coverage helpers | 25 pass |
| v8 Node pack / consumer / nested | 21 pass |
| 非計測 browser API / Worker | 36 pass |
| 非計測 consumer / nested / broker（修正前） | 72件中69 pass、3 fail。生Worker JS template内のTypeScript castが構文エラー |
| 生Worker JS cast修正後のmutation、Chromium / Firefox / WebKit（別run） | 3 pass。先行72件runを72 passへ書き換えない |
| 既存 build / runner / session回帰 | 32件中31 pass、1 fail。pitchfork sourceTag期待v2.29.0／実artifact v2.30.1。不一致は未解決 |
| coverage v10 | tests/shared/assertions.js欠落で選択Nodeテストのmodule load失敗 |
| coverage v11 Node（copySharedTestHelpers修正後） | 115 pass、5939.953541 ms |
| coverage v11 browser全123件 | 123 pass、11.2分。逐次実行 |
| coverage v11固定14JS合計 | report exit0、total982／covered863／skipped0、87.88%、realms1253、passed=true。固定14第一者JS、threshold80% |

READMEリンクは実tarballでRedを観測後に3つのupstream絶対URLへ修正。fixture filesystem読込は生成 `.js` に修正し、HTTP aliasは既存routeに保持。coverage helperコピー回帰はcandidate環境変数に依存せず、一時領域へのコピーと実module importを検証します。

検証済み：v11最初のbrowser CLIパスfilterは `No tests found`／exit1でした。計測copyの `tests/package` cwdで `playwright.config.ts` を使い、filterなしの全123件を逐次実行してpass。内訳は計測対象99件（4spec）と追加の非計測24件です。失敗したCLI runを成功として書き換えていません。

検証済み：main照合exit0。source-manifest34 pathすべて存在し、runtime14＋READMEの15file SHAが候補v8と一致、実tgz SHAもmanifestと一致しました。計測copyによる元candidateの改変はありません。既存回帰のpitchfork不一致1件が残るため、回帰全体を合格とはしません。PoCの歴史的測定値、旧 `.mjs` / ESLint / v7結果は以下の履歴として保持します。

## 過去の観測履歴（移行前）

## Observed Commands

すべてmain sessionが逐次実行。未完了・未検証を合格へ変換しない。

| Command | Observed result |
|---|---|
| Node24.21.0 --test tests/node/build.test.mjs tests/node/runner.test.mjs tests/node/session.test.mjs（製品変更前） | exit1、32tests/24pass/8fail/0skip。blink/guest資産欠落、clone未完了HEAD、sleep欠落による127など。事前baselineであり変更後regression結果ではない |
| npm install --ignore-scripts --no-audit --no-fund（既存temp cache） | exit0、133packages、approved5devtools版はrunnerで確認。ESLint9.36.0 unsupportedのnpm警告あり |
| Node24.21.0 --test tests/package/runner-ready.test.mjs | exit0、3tests/3pass/0fail/0skip、465.886833ms。自タスクのDocker buildをpause→試験→unpauseして同時実行を避けた |
| BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker CONTAINER_EXTRA_ARGS='--platform linux/amd64' bash scripts/build-blink-wasm.sh | exit0。emsdk6.0.10 image sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65。build-info：commit4b5c67d518b0504e13ccde7ba7823f9b6e467c4c、dirty=false、disable-jit、MAXIMUM_MEMORY1GB。loader132512bytes/wasm455584bytes |
| Node24.21.0 --test tests/package/errors.test.mjs tests/package/validation.test.mjs tests/package/state.test.mjs | exit0、28tests/28pass/0fail/0skip、65.403917ms。errors6/state10/validation12 |
| FORMICARIUM_CONTAINER=docker CONTAINER_EXTRA_ARGS='--platform linux/amd64' bash scripts/build-guests.sh probe（修正前） | exit1、line45 imageに続く全角括弧をbash3.2が変数名として解釈しunbound variable。修正後同commandはこの行を通過、Rust build進行中、終了結果は未検証 |
| 同probeビルドcommand（brace修正後） | exit0、release1m12s、staticELF検査通過。exit3/hello/probe生成。rust:alpine image sha256:0cce0a5e0e8ba67b455257a3a02a1d99005f382748789d6464460028810f1627。guestソース変更なし |
| Node24.21.0 --test tests/node/runner.test.mjs tests/node/session.test.mjs（成果物準備後、core/guest変更前） | exit0、23tests/23pass/0fail/0skip、1018.966291ms。hello/exit3/CLI timeout、既存session構文/registry/cat互換の事前baseline |
| Node24.21.0 --test tests/package/lifecycle.test.mjs tests/package/protocol.test.mjs（初回） | exit1、18tests/17pass/1fail。done候補後late Worker errorがEXECUTIONで正常結果を上書きする欠陥を再現 |
| 同lifecycle/protocol command（修正後、oracle不変） | exit0、18tests/18pass/0fail/0skip、111.47525ms。中止/disposeだけ候補を取消し、lateWorkererror/exitは正常候補を上書きしない |
| Node24.21.0 --test tests/package/core.test.mjs tests/package/guest-io.test.mjs（既存source修正前） | exit1、5tests/0pass/5fail/0skip、62.046709ms。factoryPromise前exitのsnapshot欠落、snapshotinodeId欠落、hardlinkrestore分離、明示dirmode消失、特殊file黙落ちを再現。独立MemoryFS oracleでありrealcoreの代替ではない |
| Node24.21.0 --test tests/package/core.test.mjs tests/package/guest-io.test.mjs tests/package/worker-execution.test.mjs（修正後） | exit0、20tests/20pass/0fail/0skip、75.400584ms。元5欠陥と資産digest tuple、不正build/CORE_INIT分類、stream bytes/sequence/cleanupを確認。realcore/nestedの代替とはしない |
| Node24.21.0 --test tests/node/runner.test.mjs tests/node/session.test.mjs（core/guest修正後） | exit0、23tests/23pass/0fail/0skip、713.211042ms。変更前23passと同じoracle。性能比較ではない |
| Node24.21.0 --test tests/package/public.test.mjs tests/package/node-api.test.mjs tests/package/node-worker.test.mjs tests/package/types.test.mjs | exit0、21tests/21pass/0fail/0skip、1268.498625ms。realhello/exit3の公開API、即時再実行、rawWorker不正protocol、NodeNext型正負fixture。まだ実tgz consumerではない |
| Playwright browser-api.spec.mjs/browser-worker.spec.mjs、tests/package/playwright.config.mjs、workers1/retries0 | exit0、36passed/27.4s。Chromium/Firefox/WebKit各12。隔離不足・cross-originWorker拒否・中止/bytes/API・waitAsync削除等。CPU-boundはtest-onlyWorker、realguest/nestedの代替ではない |
| ESLint fixed13配布JS + scripts/package/stage-package.mjs | exit0、診断なし |
| Node --check fixed13配布JS | exit0、13files PASS |

## Limits and Remaining Verification

最終v4（検証済み）：browser API/Worker/broker/consumer/nested合計69pass (5.5m)、別errors/preflight15pass (11.5s)。計測copy Node94pass3292.402125ms、browser60pass (3.7m)。report exit0、固定13JS、141realm全収集、line union 594/658=90.27%、80%基準達成。全13source/digest/statement-mapが同v4候補に一致。計測・非計測consumerに同guest/bytes/state/timeout/abort expectationsを適用して成功。ESLint配布13+stage/verify/coverage exit0。types+coveragehelper8/8pass958.892834ms。

既存build/runner/session最終観測：exit1、32tests/30pass/2fail/0skip、1067.824916ms。2failは初期baselineにも存在した dist/guests/pitchfork、pitchfork.commit、pitchfork.build-info未生成のみ。core lock/dirty=false/JITなし/wasm cap関連、fork/static ELF、runner/session23件はpass。既存全体greenとは主張しない。U4 guest全体回帰/CI・実Safari/公開は未検証のまま引継ぐ。

v4エラー契約修正Green：lifecycle/protocol18/18pass108.571125ms。browser-errors全3browser15pass11.5s（元6Red oracle不変＋preflight abort/timeout/dispose9cases）。v4 stage/pack/verify/install exit0、23files、tgz SHA256 3fc9bc589c624cf5f9854c863198532e119b1467faad8e79c1b996e3ff05cc06。空consumer-v4のNode pack/consumer/nested15/15pass3955.111625ms。sameidentity不正major EXECUTION、rootWorker404 ASSET_LOAD、fetch取消後lateWorker0を確認。v4 browser総回帰69caseと固定13全realm coverageは実行中／未検証。

追加エラー契約Red：browser-errors.spec.mjs workers1/retries0、exit1、6/6failed。全3browserで同identity不正major child-controlはEXECUTION期待にTIMEOUT、missing rootWorker404はASSET_LOAD期待にEXECUTION。oracle不変で修正予定。

v3計測収集readinessのみ：instrumentedcopy Node12files --test-isolation=none、exit0、94/94pass、3325.003209ms。coverage-node.json exact18realm（host+worker1..17）全登録counts[0]=1。まだbrowser全realm/lineunion/80%は未検証。現在修正中の最終sourceへ再計測が必要であり、この結果を最終受入れとはしない。

v3修正：core側でgenerated workerDataをbrowser向けoptionsから除去。core/worker-execution15/15pass65.840417ms。stage/pack/verify/install exit0、tgz SHA256 ca43b709fc4b5c7bfc6379e62de59624af99e365dee3038cb8cf213dcb0668f4。Chromium normal/nonzero個別1pass11.8s後、consumer/nested/broker全3browser33pass (5.2m)、exit0。直接real pthread wrapper timerで全normal/abort/timeout counter増分0→即時run成功。generatedcore options互換とhost管理child停止のGreenを確認。browser rootWorker404分類とcurrent不正major child-controlは追加検証中。v3の全sourceから13JS instrumented copyを準備したが、coverage計測・最終candidate適用はまだ未検証。

Broker初回修正 v2：core/worker-execution unit15/15pass65.649875ms、既存browserAPI/Worker36pass22.4s。v2 stage/pack/verify/install exit0、23files、tgz SHA256 3bd7d8b73514e39495aca3fa73225739531a4ce94745b51a4ffa2d7f61ebb768。Node pack/consumer/nested15/15pass3956.143416ms。

v2 realbrowser consumerはRed：Chromium normal/snapshot/timeoutがchildControl EXECUTION。診断のため停止exit130、3failed/1interrupted/20notrun。読み取りでgenerated blink.mjsの実Worker options `{type:"module",workerData:"em-pthread",name:"em-pthread"}`を確認。browserが無視するNode専用workerDataがgeneric host allowlistに拒否されるため、core固有adapter内で正規化する追加修正予定。

直接2階層oracleの追加Red（検証済み）：Node nested3/3pass、3748.260875ms。browser nested workers1/retries0 exit1、6pass/3fail (2.0m)。real pthread wrapper内timerに人工第三層なし。Chromium abort129→134/timeout6930→6937、WebKit abort138→156とsettle後150ms counter増加。全normal/Firefox全3/WebKit timeoutはpass。CPU実行中childのtimer停止自体は死の証明ではないが、idle実pool child活動残存は観測済み。host所有descendant brokerで明示停止する修正を実施予定。閾値/oracleは緩めない。

Browser nested追加初回は未達：Chromium normal/abort/timeoutで人工的第三層heartbeat counterがsettle後150msも149→184/141→205/7860→7929と増加。主セッションが診断のためCtrl-Cで停止、exit130、3failed/1Firefoxinterrupted/5notrun。観測用追加Worker自体の独立寿命とreal pthread停止を区別する必要があり、この失敗だけで製品pthreadが生存したとは断定しない。直接pthread realm内timerのoracleへ修正して再確認予定。

Step11 browser追加（検証済み）：同exact tgz installed consumerのみを配信。Playwright consumer.spec.mjs workers1/retries0、Chromium/Firefox/WebKit各5、15passed (3.2m)、exit0。real bytes/非zero、snapshot次core引継ぎ、開始stdout確認後のCPU-bound abort/timeout→直後run、pthread正常exit。実Safariは未検証。

Step11 nested Node追加（検証済み）：nested-worker.test.mjs exit0、3tests/3pass/0fail/0skip、4102.593833ms。installed real loader/wasm/package-workerをtest-only wrapperからimport、実pthread descendantに観測用heartbeat Workerを追加。normal/abort/timeoutのouter settle後150msに共有counter増分0、次run成功。追加observerがある条件の活動停止の証拠であり、非計装descendantの性能やbrowser descendant停止を直接計測したとは主張しない。

Step11追加観測（検証済み）：Rust musl fixture再コンパイル成功。native seed/verify/bytes/thread-exit exit0、stdout [0,255,128,65,10]、stderr [254,0,66,10]、非zero exit3。fixture SHA256 f061ed9273f3ecd2a535ca585f0a5c10615960caed4fc51dee60ecb17ba3c338。再実行時の残存native fixture hardlinkによるEEXISTは、試験専用 /work/kept を清掃して解消。製品source変更なし。

stage-package → npm pack → verify-package exit0、23files。npm既定cache書込み拒否は /private/tmp/formicarium-npm-cache 指定で解消。tgz SHA256 a13885101f85367707270a205a95ea5b8420bc01d6ee8e319971f59c9124f476。空の /private/tmp/formicarium-u1-consumer に exact tgz を npm install --ignore-scripts --no-audit --no-fund、exit0 added1。Node consumer+pack試験 exit0、12tests/12pass/0fail/0skip、2828.796125ms。realguest起動、非UTF8出力、hardlink/symlink/mode/deletionの次core引継ぎ、開始出力を確認したCPU spin中止/timeoutと直後再実行、pthread正常終了、全tarball/installed digestを確認。

検証済みは上記観測の範囲のみ。まだreal public API/Worker、tarball空consumer、3browser製品試験、nested cleanup、全13JScoverage、既存回帰、CIは未検証。測定/benchmarkは実施していない。aube/pitchforkの再ビルド・公開操作は行っていない。cloneはjj、DockerDesktopは既存appを起動しbuild手段として使用。

## Revision runner readiness — 2026-10-07T17:50Z

検証済み：人間のApprove Planを受領しPLAN_APPROVAL_RECORDED成功。Node24.21.0実体で `--test tests/package/runner-ready.test.mjs` を実行。3 tests/3 pass/0 fail、299.750791ms。修正Red/Green、v5候補、coverageは未検証。

## R-01 observed Red — verified

Node command: `FORMICARIUM_CANDIDATE=.artifacts/u1-package-v4.manifest.json FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v4 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-name-pattern='real.*loader mutation' tests/package/core.test.mjs tests/package/consumer.test.mjs`. Both real generated factory/guest runs exit0 and fixture-ok, then marker assertion actual1 expected0: 2fail, 0pass, 431.979458ms. Initial harness failure filename.startsWith was corrected and is not defect evidence.

Browser command: same candidate/consumer env, `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.mjs tests/package/consumer.spec.mjs --grep 'real loader mutation' --workers=1 --retries=0`. Chromium13.4s/Firefox20.1s/WebKit13.1s: each guest exit0 fixture-ok then marker actual1 expected0. 3failed exit1. 検証済み：照合後に原URLから未照合JSが評価される。Greenとpthread/cleanupは未検証。

## R-02 observed Red and initial R-01 Green

検証済み：v5 consumer public removed nested cwd testはCORE_INIT、guest-io unitはmkdirIfMissingの親ENOENT。2fail exit1、255.884208ms。Browser同操作はChromium12.0s/Firefox14.0s/WebKit12.5s全3fail CORE_INIT。guest-io製品修正前のRed。

R-01 main unit34pass、追加core13pass（temp0700/file0400/late allocation cleanup/限定Blob URLbridgeを含む）。初回v5 tgz sha256395a206586927bea4180b5f68ba53f30d33aad0e10f110b4b518bdff291d6e4a。Nodeconsumer7pass/2979.862125ms、mutation marker0、正常pthread/timeout/abort再run確認。Browser初回Green batchはChromium通常13.2s・pthread12.8s pass2、試験用mutation wrapper応答待ちを2.1minで中断exit130、残り6未実行。browser mutationGreenは未検証。v5は初期snapshotで現source差分後の最終候補ではない。全体coverageとCIは未検証。

## Final v7 and observed verification

候補tgz SHA256969e9fab854d4499da1d38087bd601b65042b6d50b086c8fc8ddaefd0752f810、空consumer/private/tmp/formicarium-u1-consumer-v7へinstall。v6とのmanifest差分はREADME.mdだけ（runtime全hash同一）。

検証済み：非計測v6 consumer/nested/brokerの3browser48件全pass10.6m。v7 Node pack/consumer/nested19件全pass13970.029583ms。v7追加3browser cwd rollback/reset/resource broker21件全pass1.4m。Node U1 unit/type/helper104件全pass4441.550416ms、ESLint固定13JS+package helpers3件exit0。既存build/runner/session32件は30pass2fail1245.716041ms：pitchfork/pitchfork.commit/pitchfork.build-info欠落（旧baselineと同じ）。全体回帰成功とは主張しない。

coverage-v7 prepareは固定13JSを元candidate digestで計測copy。Node計測106件全pass9745.256917ms、host+25workerの26realm全登録と予定26一致。ブラウザ99件収集中、coverage合計はまだ未検証。

## Coverage CSP correction

初回coverage-v7 browser collectはChromium30pass/CSP2fail、1interrupted、66未実行でexit130。CSP2failはIstanbul既定の `new Function("return this")` がunsafe-eval未許可でEvalErrorになった。製品の非計測CSP全6件は成功済み。CSPを変更せずinstrumenterのcoverageGlobalScope=globalThis、coverageGlobalScopeFunc=falseへ変更し、新しいcoverage-v8へ再prepare（元候補はv7のまま）。固定13JS/80%/statement-map不変。helper6件再実行pass。

## Final coverage / remaining checks

### Checkpoint cleanup oracle failure and deterministic Red

Step24–25 Green検証済み：承認済みscoped command（pattern cleanup oracle|Node host removes）は2pass、2043.586792ms。全v7 Node pack.test/consumer.test/nested-worker.testは20pass、5741.012833ms、exit0。consumer専用TMPDIR、実loaderbytes/SHA/0700/0400の稼働中観測、4終了経路settle後空、他ownerからの独立、私有資源の意図した漏れERR_ASSERTION対照を確認。

fresh coverage command：node scripts/package/coverage.mjs prepare /private/tmp/formicarium-u1-consumer-v7/node_modules/@aletheia-works/formicarium .artifacts/u1-coverage-v9、続いてnode --import ./.artifacts/u1-coverage-v9/coverage-node-preload.mjs --test --test-isolation=none .artifacts/u1-coverage-v9/tests/package/{errors,validation,state,lifecycle,protocol,core,guest-io,worker-execution,public,node-api,node-worker,consumer}.test.mjs。Node107pass6057.623125ms。v8/v9 coverage-metadata全体をassert.deepEqualで照合exit0。13source/instrumented/statement-mapおよびlayout完全一致。node scripts/package/coverage.mjs report .artifacts/u1-coverage-v9 .artifacts/u1-coverage-v8/browser-results .artifacts/u1-package-v7.manifest.json はexit0、1253realms、695/758行91.68% passed。browser側は未変更の既存v8収集であり今回の再収集ではない。Nodeの追加testはWorkerなし、予定26不変。

製品対応確認command：node --input-type=moduleのreadFile/createHash/assertでmanifest.files内runtime13+READMEと実tarball.sha256を照合しexit0、runtime13+README and tgz match v7。testのみ変更でcandidate更新なし。承認済みcheckpoint再検証待ち。

検証済み：承認済みv7 checkpoint commandは2026-10-07T19:05:41.941Z〜19:05:47.897Z、exit1、Node19件中18pass/1fail、5745.731208ms。consumer回収テストの共有tmp baselineからformicarium-core-mFjsrnが消えた比較差分。&&後のbrowserは未実行。proof id2b30722e-2c9e-4f9c-b423-b5ceeb6104ac。漏れ増加ではなく他dir減少であり、元の当該dir所有者は未確認。

ソース確認済み：consumer.testの旧oracleはOS全体のformicarium-core-*一覧を比較するため、別ownerの正常な削除も誤失敗する。loader-mutation.mjsはresourcesを明示提供しfixture.disposeでawait済み。従って計画時の「直前の直接coreにlocalOwnerの非同期回収がある」とする因果推測はこのcallerに当てはまらず撤回する。nested-worker.testは別test fileとして同時実行され得るが、元失敗の所有者同定を完了したとは主張しない。

Step23 main Red command：FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v7 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v7.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-name-pattern='cleanup oracle' tests/package/consumer.test.mjs。exit1、1fail/0pass、175.344208ms。実installed createCoreResourceOwnerでallocateした別ownerのformicarium-core-2NscInをdisposeすると、旧deepEqualが元失敗と同じ減少方向の差分で失敗した。期待失敗をpassに変換せず観測した。

検証済み：CSP修正copy v8 Node106pass6486.849167ms、browser99pass8.3m。coverage report exit0：758total/695covered/0skipped=91.68%、1253realms、threshold80 passed。candidate969e9fab854d4499da1d38087bd601b65042b6d50b086c8fc8ddaefd0752f810とsource/instrumented/statement-map digest一致。browser-errors15pass14.0s。変更後coverage helper ESLint exit0。main/runtime13+README=14filesはv7manifest一致。

## 2026-10-09 purge investigation Steps38–40

検証済み：native/blink memory probe成功、既存probe14pass、exact allocator正常purge40calls成功、bitmap48ケース成功。BSFゼロ入力はnative64/ZF1/pass、blink0/ZF1/exit1という意図したRedを観測。調査証拠はverification/aube-purge-reproduction-v1/findings.mdと各results JSON。aubeとの因果完結と修正Greenは未検証。新Step41–43のコア修正は追加計画承認待ち、未実装。既存成果・候補を保持。

## 2026-10-09 BSF repair Steps41–43

正式local core build成功、同一ELFのBSF Red→Green、probe15pass、通常aube Node4pass/native一致約8.5秒。3browserも4操作exit0/native一致。ただしbrowser suiteは旧0.0.0 assertのみで3fail/3pass、exit1。正式完了とせず停止。evidence: verification/aube-bsf-repair-v1/findings.md、results.json、各log/diagnostics。未公開core dirty=true、v8候補/旧coverage/CI/Safari/修正coreのpitchfork回帰は未検証。


## 2026-10-09 browser oracle Retry (Steps44–45)

検証済み：tests/browser/aube-1645.spec.tsの旧0.0.0をfiledep1.0.0/linked2.0.0へ訂正し、4操作command/exit0を明示。Biome単一spec exit0。三browser全6件pass、Playwright exit0、35.1秒、worker1/retry0・840秒・通常purge設定。native出力完全一致をdiagnosticsでも再照合。同aube/core/baselineのSHA不変。証拠 verification/aube-browser-retry-v2/results.json と各diagnostics/log。旧失敗保持。未公開dirty coreの正式pin/clean build、新候補、正式U1/U3/U4レビュー、CI/実Safariは未完了。

## 2026-10-09 local clean-core formalization (Steps46–48、進行中)

検証済み（main観測）：jj describe後のrepair commitは `1f58c82eb1b379483493c9be6e00f1634672d72d`。一次.vendor/blinkでfresh empty child `uwqwtxmq`／`8d71218f`をその上に作成。read-only Git HEAD=repair commit、Git status空、jj source cleanを観測。secondary.vendor/blink-srcには.gitがなく、Git自動探索は親formicariumへ遡るためbuild metadataの取得元にしない。repair差分を.artifacts/aube-clean-core-v1/repair.patchへ保存し、既存patchとのcmp exit0を確認した。

mainがblink.lockのcommitのみをLOCAL更新した。source-manifestへblink.lockを追加。主セッションの正式build commandは `BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker bash scripts/build-blink-wasm.sh`、BLINK_SOURCE_COMMIT／BLINK_SOURCE_DIRTY overrideなし。main session39654でDocker build進行中であり、終了code・新build-info・regression成功は未検証。旧core/guest/evidenceは.artifacts/aube-clean-core-v1へ保持し、旧v8候補を上書きしない。未公開ローカルcommitで、remote確認／bookmark更新／push／PR／publishは未実施。新candidate/consumer/coverageと正式reviewは今回の対象外。CI・実Safariも未検証。


## 2026-10-09 local clean-core results (Steps46–48)

検証済み：repair commit 1f58c82eb1b379483493c9be6e00f1634672d72d。一次colocated forkのfresh empty jj changeでGit HEAD一致、Gitstatus空、jj workingcopy clean。修正差分は保存済みpatchとcmp一致。正式Docker buildとnpm build成功。blink.lock／build-infoはrepair commit一致、dirty=false、disable-jit、1GB。未公開ローカルcommitである。

検証済み：Node build9/probe15/aube4/pitchfork3件pass、skip/fail0。三browser aube6件pass、worker1/retry0・native完全一致・全4exit0。pitchfork browserはChromium/WebKit pass、Firefoxが600000ms待機timeoutでsuite exit1、2pass/1fail。Firefoxの完了resultは得られず、原因は未検証。成功したbrowser diagnosticsはnative一致を独立再照合。aube v2.7.0とpitchfork v2.30.1 ELF／baseline bytes不変。上限/worker/retryを緩めない。

未完了：Firefox失敗調査とRetry選択、署名付きfork公開と最終pin確認、新配布候補・consumer・coverage・正式U1/U3/U4レビュー・CI・実Safari。旧candidate v8やcoverageを新core検証へ流用しない。ローカルlockをremote取得できると主張しない。


## 2026-10-09 Firefox Retry

検証済み：承認済み計画の同じ三browser commandをsource/timeout/worker/retry不変で再実行したがexit1、2pass/1fail。Firefoxが再度600秒の完了待機timeout。Chromium/WebKitは成功。旧成功時のguest/baselineは同一、現在のFirefox155.0は両保存先でbinary/XUL一致。根本原因は未確定。同一条件の反復のみでは解決しなかったため、次は操作境界とcore syscall traceの限定診断計画が必要。aube成功証拠と未公開clean coreを保持し、公開には進めない。証拠 verification/pitchfork-firefox-retry-v2/。


## 2026-10-09 Firefox boundary diagnosis Steps49–51

検証済み：診断経路は全8操作exit0/native一致、session:resolved約6150.64ms、Playwright収集1件pass14.6秒。traceなしで完了したため、承認済み条件に従いtraceは実行しなかった。core/guest/baseline SHA不変、build/typecheck/Biome成功。最初の9.6秒成功はbody添付がファイルへ永続化されず証拠不成立だった。test-only保存を修復し、write→read bytes一致→path添付の再実行証拠を保存した。

検証済み：module1–6でonExitが複数回記録され、次moduleのfactory:enterより後にも前moduleのonExit:enterが届く。snapshotの再実行やcallbackの意味を変える修正はしていない。これは終了通知の重複・起動との時間的重なりを示すが、pthread cleanup完了や今回停止との因果を示すものではない（未検証）。

未解決：通常Firefox試験は二回600秒timeout。診断経路は元Workerと異なるsetup/load順・parent受信処理・観測eventを含み、成功を元試験修正と扱わない。次の診断は元Workerの起動条件と計測条件の差を絞る必要がある。製品コード・core・guest修正、公開、新候補、正式review、CI/実Safariは未実施。aube成功と旧失敗を保持。

## 2026-10-09 Original Worker syscall diagnosis Steps52–53

検証済み：正式build/typecheckと変更specのBiome成功。Firefox155.0の元Workerで-s/-e traceを一回だけ取得し、Playwright1pass（11.5秒）、実session6333.2ms、全8exit0/native完全一致。stderr422975bytes、LoadProgram7件/exit_group(0)7件、overflowなし、console/pageErrorsなし、visible/isolated=true。前後core/guest/baseline identity一致。stdout/stderr/diagnosis/identityは明示write-read照合とpath添付後にrecordへ保存した。証拠 verification/pitchfork-firefox-original-trace-v1/。

未解決：通常Firefox二回の600秒timeoutは保持。元DOM/Worker/bootstrapは同じだが、syscall traceとhost periodic pollingは通常試験と異なるため、acceptance=falseの診断収集とする。wrapper固有の変更だけでは成功差を説明できないが、観測タイミング差や終了通知重複の因果は未検証。製品変更・公開・新候補・正式reviewは未実施。

## 2026-10-09 Original Worker untraced diagnosis Steps54–55

検証済み：正式build/typecheck/Biome成功。元DOM/Worker/bootstrapの非trace・host逐次monitor診断は600080msでtimeout、acceptance=false。採取test自体は1passだがguest成功ではない。最後のstdoutはStatus: available、直前の通常Firefox失敗のstreams.stdoutとbyte一致。stderr0、pageStatus=running、例外/console/overflowなし、visible/isolated=true、前後identity一致。証拠 verification/pitchfork-firefox-original-untraced-v1/。通常Firefox一回の実行条件completed/8exit0/native一致を満たさなかったため、normal-v3を実行していない。

ドキュメント根拠（現source）：blink/blink.c:361–370は最初のonExit同期通知後にemscripten_force_exit、runtime/guest-io.ts:351は最初のonExitでfinish、runSessionはそのresolve後に次moduleを開始する。生成loaderの終了処理に再onExitがあり、既存観測の重複と整合する。ただし停止原因との因果は未検証。今回のhost pollingだけでも停止したため、通常のwaitForFunction/rafだけを原因にする仮説は根拠不足。trace付き成功との差は記録/実行timingを含み、特定欠陥の修正証拠ではない。

## 2026-10-09 Firefox built-in profiler Steps56–57

検証済み：source変更/再buildなし、profiler付き非trace一回は600076ms timeout。採取test1pass10.1分は収集成立のみ、acceptance=false。raw profile36196434bytes/SHA7b4128f823e4b6b115e4a6f7cf830db06055b9f5ac49179f94f8d26cf24985ecを保存し、256MiB cap内で全process/threadのsamples/frame/stack/string参照を検証した。前後identity不変、partial stdoutは非profile停止とbyte一致。rawは.artifacts/pitchfork-firefox-profile-v1/gecko-profile.json、解析/結果はverification/pitchfork-firefox-profile-v1/。

検証済み：対象worker.jsの最後30秒に2984samples、2983件はWorkerPrivate::WaitForWorkerEvents。同content processのblink.mjs pthread96threadsは全てunregistered済み、最後1359.48ms（process内時刻）。親Workerは約600秒まで存続する。最後のJS活動sample1344.85msは新createBlinkのpreRun/populateFs/writeFile。少なくとも停止終盤でguest pthreadがKillOtherThreads/futex内を継続実行している証拠はなく、親の非同期完了待ち/初期化・通知経路を調べる根拠が得られた。ただしどのcallbackが欠落したか、終了通知順序との因果は未検証。

profile実設定はinterval10ms/features js,stackwalk/filters GeckoMain,DOM Worker。要求したcpuはmeta.featuresに載らず、cpu feature有効化を主張しない。native addressは未symbolicate、Wasm function indexからC関数名を推測しない。初回解析のprocessごとの30秒windowには短命な非対象Workerも含まれたため、最終analysis.jsonはglobal終了時刻へ揃え対象runtime/web/worker.jsへ限定した。製品変更・公開・候補・正式reviewなし。

## 2026-10-09 Exit notification order correction Steps58–60

検証済み：旧core 1f58c82eb1b379483493c9be6e00f1634672d72dで新core-exit-order回帰は想定Red（module1 onExit期待1/実際2）。採取はcompleted/全8exit0/native一致、全7moduleで2回、module1–6の旧通知が次factory開始後に発生。修正はblink/blink.cの早期MAIN_THREAD_EM_ASM通知を削除し、emscripten_force_exitの最終通知を保持した一ファイル差分。BSF修正と既存guest/native baselineを保持。

検証済み：jjローカルcommit a882fb2f3df14115b7e46f6812fb296eef5934d7をclean primary .vendor/blinkから正式Docker/emcc6.0.10 build。lock/GitHEAD/build-info一致、dirty=false、disable-jit、1GB上限。npm正式build/Biome成功。新Firefox回帰1pass（全7module各1onExit、late0、全8exit0/native一致）、通常Firefox1pass3.8秒。Node build9/probe15/aube4/pitchfork3全31pass、三browser aube6pass/pitchfork3pass、retry0/worker1。通常診断7runsのstep数/全exit0をresults.jsonへ記録。aubeのBSF修正回帰も維持された。

検証済み：共有core修正後の通常Firefox停止は今回の実行で解消し、通知重複のRed/Greenも成立。過去のtimeout証拠は保持する。将来すべての環境で停止しない保証や単一原因の普遍的証明は未検証。証拠 verification/blink-exit-notification-order-v1/、raw .artifacts/blink-exit-notification-order-v1/。新patch patches/blink-exit-notification-order.patch SHA256 6df6e2a9a89fc49d85fff7e74caa87c5c8c441bc3f72b051bb72d873c2496220。

未検証：CI、実Safari、公開consumerの新core候補。新coreは未公開ローカルcommitのためfresh cloneのremote取得は未成立。candidate/coverage/正式review/push/公開は今回実行していない。AI-DLC自体とStop登録は変更していない。

## 2026-10-09 Real Safari and CI preparation Steps61–63

検証済み：新tests/safari/verify.tsは正式npm buildとBiomeに成功。公式safaridriverで実Safari27.0.1/macOS専用session作成成功、hello開始時crossOriginIsolated=true、document.visibilityState=hidden、status=running/result=nullだった。713msで可視必須条件に失敗、exit1/acceptance=false。guest自体の終了結果は未検証、probe/aube/pitchforkは未実行。可視条件を弱めず、追加retryせず、専用sessionとownedchildrenをfinally終了した。raw response/partial stdout/stderr/driver/server logをverification/safari-core-v1へ保存しbyte一致を照合。前後core/guest/baseline identity一致、core a882fb2f3df14115b7e46f6812fb296eef5934d7 clean。Safari設定変更なし。

検証済み：CI workflow案をverification/safari-ci-planning-v1/verify.workflow.ymlへ作成し、actionlint1.7.12＋実体shellcheck0.11.0がexit0。公式Actions release/tag SHA/action.yml入力を照合したaction-pins.jsonを保存。CI案はNode24/公式clean core・guest build/Node・3browser/Firefox終了通知回帰、worker1/retry0/既存期限/1GB、contents:read、失敗artifact保存。初回lintはmise shim設定不足で失敗、設定変更せず実体指定で成功し双方logを保持。

未検証：遠隔CI実行、実Safariのguest完走、public consumer/新候補/coverage/実terrarium/公開。未公開coreの署名push時SHA照合、formicarium送信commit/workflow本登録、可変guest buildで固定ELF SHA再現の確認がCI前提。ci-readiness.mdに対象branch案と不足を記録した。remote/push/dispatch/PR/公開なし。U1はunit pauseで停止。次はRetry/Skip/Abortを選び、Retryの場合は専用Safari windowを可視化する具体的手順を新計画へ加える。

## 2026-10-09 Visible Safari retry Steps64–65

検証済み：tests/safari/verify.tsへ専用window GET/POST選択・maximize、owned open -a Safari前面化、各guest前のunknown-session可視化preflightを追加。15秒はwindow選択/navigation/activation/pollingを通じた共通deadlineにし、guest期限とcleanup上限を保持。正式npm build/Biome成功。

検証済み：実Safari27.0.1でWebDriver window操作とopen activation(exit0)成功。専用handleは同じだがpreflight52観測すべてvisibility=hidden/isolated=true。15006msで期限到達、unknown-sessionエラーとstdout/stderr空を保存した。ゲストを一つも起動せずexit1/acceptance=false、hello/exit3/probe/aube/pitchforkはすべて未検証。単なる前面化操作では可視実測条件を満たせなかった。raw 86940bytesは64MiB以下、recordコピー/read bytes一致、前後core/guest/baseline SHA一致。v1証拠と既存CI案を保持、専用session/ownedchildrenはfinally終了、設定変更なし。

未検証：hiddenの原因、実Safari guest完走、遠隔CI/publicconsumer/coverage/公開。次は専用windowの実画面とWebDriver表示状態の照合が必要。品質visibleを弱める、結果をWebKitで代替する、追加自動retryは行っていない。U1を正式pause、別worktreeの登録なし。Step64完了、Step65は失敗のため未完了。

## 2026-10-09 Safari visibility diagnosis Steps66–67

検証済み：正式npm build/Biome、Swift型検査成功。mainの診断1回はexit0/status=passed、collectionOnly=true/acceptance=false。guestは未起動。raw 1016948bytes、64MiB以下、recordコピーの全bytes一致を照合しraw-sha256.jsonへ保存。前後core/guest/native baseline identity不変。

検証済み：同じ専用handleの3時点すべてDOM visibility=hidden、hasFocus=false、crossOriginIsolated=true。WebDriver screenshotではrunnerと期待unknown-sessionエラーが描画される。選択/maximize後rectはx0/y30/1440x805。正常open activation後もhidden。CoreGraphicsでは同rectのSafari level0/onscreen=true windowが一意（ID6693）。既存画面収録許可trueのため当該windowだけcaptureした。mainは全3WebDriver画像とnative-window.pngを確認した。native画像は専用unknown-session URLを持つSafariのchromeと白いcontentを示し、WebDriver画像のrunner本文は見えない。

推測：WebDriverが返す描画内容とOS上のウィンドウ内容に差がある。windowの存在・maximize・open activationだけではDOM可視条件を満たせない。原因がSafari automationの描画/表示状態にある可能性はあるが、原因確定ではない。OS onscreenはDOM visibleの証明として使わない。

未検証：専用automation window内で正常に本文が実表示される条件、hiddenの原因、実Safariでhello/exit3/probe/aube/pitchforkの完走、遠隔CI。次の調査候補はSafari公式automation仕様・既知問題と今回の白画面/hiddenの照合、必要なら専用windowだけの追加観測を具体計画にする。可視条件緩和・guest再実行は今回行わない。

専用session/ownedchildrenのみfinally終了。Safari設定/画面収録許可は変更・要求していない。旧証拠/CI案/製品core/guest/baselineを保持、push/PR/公開なし。

## 2026-10-09 Safari公式情報の調査

ドキュメント根拠：隔離window/透明glass paneは公式仕様だがhidden/白画面を仕様とは確認できない。今回検索した公式Issueに同一症状・適用できる対処は確認できず、原因未検証。ローカルmanで単一session safari:diagnoseを確認し、次のguestless公式log採取案をofficial-research.mdへ記録した。実装/実行/設定変更/外部投稿なし。

## 2026-10-09 Safari normal restart Steps68–70

検証済み：Step68実装と正式npm build/Swift typecheck成功。Biome初回はglobal escape名shadowを検出、escapeRegexへrename後check成功、正式build再実行成功。各logを保持。Step69はmainの正常quit一回でPID367の終了とremainingPIDs空を確認、通常open exit0、新PID74675を確認し約376msで成功。強制終了/設定変更/tab内容読み取りなし。restart-operation.json参照。

検証済み：Step70は再起動後一回のみ実行してexit1。localhost server開始はserver.logで確認、POST /sessionの15秒timeoutでsession IDが得られずstatus=session-not-established。公式logはPID80848＋session IDへのbind不能、inventory候補0、無関係なlog本文は読まなかった。WebDriver接続成立もDOM/画像比較も未実施、guestは一つも起動していない。

検証済み：raw 6816bytes、recordコピー全bytes一致、SHA一覧保存、core/guest/native baseline前後identity不変。owned server/driverのみcleanup、新Safari全体は終了させていない。U1正式pause、worktree登録なし。Step68/69完了、70未完了。

未検証：再起動後のWebDriver応答停止原因、hidden/白画面解消、実Safari guest完走、遠隔CI。再起動成功だけで以前の不具合解消を主張しない。unknown-sessionは意図したアプリ側診断エラーで今回のWebDriver session creation timeoutとは別。追加retry/設定変更/core・guest rebuild/CI/push/PR/公開なし。次はRetry/Skip/Abortを選択し、Retryならsession作成前で止まる事実に合わせてinstance診断等の具体案を新計画にする。

## 2026-10-09 Safari instance diagnosis Steps71–72

検証済み：Step71実装/正式npm build/Biome成功。mainは--diagnose-visibility --instance-diagnosticsで一回だけ実行、Safari再終了/再起動なし。webdriver-00001-start.jsonはPOST /session、browserName safari、timeout15000をrequest前に保存、error.jsonは15006ms TimeoutError。session ID不在、sessionEstablished=false/acceptance=false。

検証済み：起動したowned driver PID57772に対し、前後metadataに新規safaridriver.57773.oxrsiq.txt（289bytes）が出現した。filenamePIDは57773で57772と異なる。今回計画のownedPID tokenに一致しないためcandidates0、本文は読まなかった。公式logは不存在ではなく対象の結合未成立。collectionStatus=failed、exit1。driver stdout/stderr空、server起動成功。

推測：起動CLIから別WebDriver service processが生成され、そのPIDで公式logが命名されている可能性がある。PIDが隣接するだけでは親子関係も今回対象であることも証明できない。OSの実測parent/child又は公式service identity証拠を採取して結合する具体計画が必要。タイムアウトの原因はlog本文未読のため未検証。

検証済み：raw 7821bytes、合計64MiB以下、recordコピー全bytes一致・SHA保存、前後core/guest/native baseline identity不変。専用owned childrenはcleanup、Safari全体は閉じていない。U1正式pause、worktree登録なし、Step71完了/72未完了。既存修正/証拠/品質条件保持、guest一つも未起動、設定変更/追加retry/CI/push/PR/公開なし。

未検証：接続停止原因、hidden/白画面の解消、実Safari guest完走、遠隔CI。次はRetry/Skip/Abort。Retryならログの識別条件を観測したプロセス関係で結合する新計画にする。

## 2026-10-09 Safari process identity Steps73–74

検証済み：Step73実装、正式npm build/Biome成功。macOSのpsは/bin/psで/usr/bin/ps不存在のため、同じread-only metadata操作の実行pathだけを訂正した（承認bound計画本文は保持）。mainがdiagnose-visibility/instance-diagnosticsを一回実行、Safari再起動/設定変更なし。

検証済み：owned launcher52730の開始時刻Fri Oct9 15:52:41 2026、comm /usr/bin/safaridriver、PPID52728を採取。逐次numeric tableから得た保存対象chainはroot52730のみ。新規公式logはsafaridriver.52735.alocbc.txt/289bytesで、PID52735は観測chainに含まれない。実測親子chainでは今回logを結合できなかった。PID隣接又はlog出現時刻だけで本文を読むことはしていない。

検証済み：POST /session一回は15006ms TimeoutError、sessionEstablished=false。collectionStatus=failed/acceptance=false/exit1。ownedrootのcleanup前identity照合成功、cleanup後消滅を確認。全process table/他app args/env/tab本文は保存なし（183個のps logは全て0byte）。raw 8911bytes、全recordcopy byte一致/SHA保存、前後core/guest/native baseline identity不変。

推測：公式logは別service processで命名される可能性があるが、別PIDの所属/起動者は未検証。rootの子孫であるという調査仮説は今回の採取で裏付けられなかった。これ以上同じ接続試行を繰り返す根拠はなく、公式service architecture/正式な識別方法の調査に戻る必要がある。logが単に起動記録のみかも本文未読のため未検証。

未検証：接続停止原因、hidden/白画面解消、実Safari guest完走、遠隔CI。guest一つも未起動、旧修正/品質条件/証拠保持。U1正式pause、worktree登録なし。Step73完了、74未完了。追加試行/別log読取り/guest・core rebuild/Node・Playwright・CI再実行/push/PR/公開なし。Retryは次の公式service識別調査、Skip/Abortも選択可能。

## 2026-10-09 Candidate v9 / coverage v12 — Retry result

検証済み：build/typecheck、stage/pack/verify/install成功。候補tarball SHA256 dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d、core a882fb2f3df14115b7e46f6812fb296eef5934d7 / dirty=false。固定24files installed digest一致、14JS/component対応・traceability path存在確認。Node baseline117/117、candidate21/21成功。

通常browser初回はmacOS MachPortRendezvous permission denied、失敗/中断記録を保持。人間Retry後、正式resumeしてhost権限で同suiteを新output browser-results-retry1へ実行、Chromium/Firefox/WebKit計123/123成功（11.1m、worker1/retry0）。

coverage-v12 prepare成功、Node115/115、browser123/123成功（11.0m）。ただしreport exit1：missing coverage realm: webkit:CPU-bound browser Worker timeout releases BUSY reservation after termination:browser-worker-1。予定realm不足のためcoverage率・80%達成は未検証。テスト成功をcoverage合格へ流用しない。閾値/分母/realm設定は保持、補完・追加再試行なし。

前後lock/core/guest/fixture/tarball/24 installedfile digest不変。verification/package-refresh-v9のraw logs・identity・source-consistency、および.artifacts/u1-coverage-v12を保存。Step75完了、76は集計失敗で未完了、77はCI準備とcheckpoint案・source照合済みだがcoverage結合未完了。U1正式pause 2026-10-09T09:31:04Z、worktree登録なし。

Safari追加調査は保留・実機未検証。遠隔CI、正式review/checkpoint、新core公開、PR/npm/Release/terrarium新core受入れ未実施。CI前提とcheckpoint全文案はverification/package-refresh-v9/{ci-readiness-refresh.md,checkpoint-command-proposal.md}。次は不足realm調査のRetry。

## 2026-10-09 Coverage readiness Steps78–80 — partial failure

検証済み：専用cpu-ready-worker.tsとbrowser-api.spec.tsを実装。clock停止後実Worker readyを観測し49ms BUSY/pending→50ms TIMEOUTをassert。既存quiet-worker/製品runtime/core/候補/coverage inventory不変。正式build/typecheck/Biome成功、通常三browser API18/18成功。新coverage-v13 prepare成功、Node115/115成功。

計測browserのCPU timeout caseはChromium/Firefoxで失敗：test finallyのpage.closeがcoverage afterEachのpage.evaluateより先に実行されTarget page, context or browser has been closed。raw error-context/trace/logを保持。sourceでcleanup順序を確認し原因特定。これはfixture lifecycleと計測hookの順序問題であり、製品不具合の証拠ではない。計測成功/coverage率は未検証、report未実行、追加retryなし。

対処案：session dispose/observer復元/実Worker terminateをfinallyに保持し、page.closeはPlaywright fixture teardown（afterEach後）に任せる。旧failed v12/v13を補完せず、新measurementで全realm/14JS/80%を確認する別計画へ。U1正式pause 2026-10-09T09:59:09Z、worktree登録なし。前後lock/core/guest/fixture/tgz/24installed不変。新source/正式生成fixtureJSをsource-manifestへ申告済み。Step78完了、79/80未完了。Safari保留、CI/review/checkpoint設定/push/公開なし。

## 2026-10-09 Separate-session real Safari recheck — evidence accepted

検証済み：提供された/tmp/formicarium-safari-recheck-20261009-01（可視性診断）と-02（正式5case）を実読取りし、329 regular files / 1,409,839bytesをverification/safari-recheck-20261009-v1/{visibility,acceptance}/へ排他保存、元/保存bytes一致とSHA256 inventoryを確認した。results.json passed/acceptance=true/collectionOnly=false、Safari27.0.1・macOS・simulator=false、hello/exit3期待出力・exit0/3、probe既定8PASS、aube4step/pitchfork v2.30.1 8stepのcommand/全exit0・native基準正規化一致を独立再判定。全5case visible/crossOriginIsolated、600秒（aube840秒）以内、worker1/retry0/tracefalse。314/352/1074/4748/2951ms。

検証済み：両directory identity before/after一致、記載11fileのSHAを現在のworkspaceへ照合し全一致。core a882fb2f3df14115b7e46f6812fb296eef5934d7 / dirty=false / disablejit / 1GB。保存verification.jsonとevidence-manifest.jsonを根拠とする。別session実行という出所を明示し、このchatではSafari再実行/編集/再build/設定変更をしていない。提供証拠には実行時verify.js digestがないため、現在runner digestの記録だけで実行時sourceの全同一性を断定しない。

現在のSafari検証状況：このcore/guest/baselineでの実機5caseは合格（従来の実機未検証をこの対象に限って更新）。診断-01はcollectionOnly/acceptance=falseであり、合格の根拠は正式-02。以前のtimeout/hiddenは今回再現しなかったが、旧原因・恒久解消は未検証。旧失敗と調査保留判断を保持し、今回の合格をnpm public consumer/coverage/remote CI/工程承認/完了へ流用しない。coverage-v13回収順序の失敗は別件として残る。

## 2026-10-09 Steps81–84 — coverage repaired and current-session Safari passed

検証済み：CPU timeout testのfinallyから明示page.closeと内側try/finallyのみを除去。session dispose/observer復元/実Worker terminateを保持し、Playwrightのfixture teardownがcoverage afterEach回収後にpageを閉じる。virtual49ms BUSY/50ms TIMEOUTと実ready oracle、10秒ready上限は維持。正式build/typecheck/Biome exit0、通常三browser API18/18成功（15.1s）。

検証済み：fresh coverage-v14 prepare、Node115/115、三browser123/123（11.5m）成功、report exit0。固定14第一者JS、1253realm、statement-map/digest一致、982lines中862covered/0skipped=87.78%、80%条件達成。CPU timeout caseは三browserともhost/worker registration1を実rawで確認。candidate v9 SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6dへ結合。v12/v13の失敗を消去/補完/混合せず保持。

検証済み：このmain sessionで既存tests/safari/verify.jsをhost権限にて新.artifacts/safari-session-recheck-v1へ一回実行、exit0/results passed/acceptance=true。Safari27.0.1・macOS・公式WebDriver・simulator=false、hello389ms/exit3 300ms/probe1079ms/aube4196ms/pitchfork3016ms。期待exit0/3、probe全8PASS、aube4step/pitchfork2.30.1 8step全exit0/native正規化全文一致。全case visible/isolated、600秒（aube840秒）、worker1/retry0/tracefalse。専用ownedsession/children cleanup、設定変更/再起動/--enableなし。Safari専用編集・再buildなし。正式npm emit前後もrunner SHA 0a709c14e0af53b2bc56656294c4cc3d4c81c4a48cd7f1df2ffeaaa39ac4b4d3不変。

検証済み：core a882fb2f3df14115b7e46f6812fb296eef5934d7/dirty=false/disablejit/1GB。前後lock/core/guest/native/fixture/tgz/24installedと14runtime bytes不変。Safari11identity filesの前後/現workspace一致。coverage raw99case/metadata/node/reportとSafarirawを合わせ346files/3554602bytesを正式recordへbyte一致/SHA保存。coverage-page-lifecycle-v1/evidence-manifest.json、results.json、identity-after.jsonとsafari-session-recheck-v1/verification.jsonが根拠。component14 source/test実在、traceability57target実在、fixture申告をsource-manifestで保持。

Safari現在状況：別sessionに加えてこのsessionでも現core/guest/baselineの実機5caseが合格。旧接続timeout/hiddenは今回非再現。以前の原因・恒久解消は未検証。今回合格をpublic npm consumer受入れ/remote CI/工程承認/公開へ流用しない。旧失敗・別session証拠329filesを保持。

Steps81–84の承認範囲は完了。formal advisory review/正式checkpoint command設定と承認/CI本登録・送信前提/remote run/core公開/PR/npm/Release/terrarium新core受入れは未実施。U1やstageの承認/完了状態は変更していない。

## 2026-10-09 Steps85–87 — 新試行の保存証拠・現identity照合

検証済み：主セッションが verification/review-restart-v1/verify-evidence.mjs を実行しexit0。保存346entriesの原ファイル・保存bytes/SHA、v9 staged/installed24file、現runtime14JS、唯一tgz、before/after/current lock/core/guest/native/fixture、計測copyのsource/instrumented/statement-mapと現TS試験・fixtureが一致。component14の固有ケースとtraceability57件（28AC/16NFR/13BR）の実在targetも照合済み。coverage-v14は固定14JS、982行中862行・87.78%、80%条件、1253realm、candidate SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6dへ結合した保存結果を確認した。Safari保存5caseの可視/隔離/期限・aube4/pitchfork8 step native一致・完全stdoutのprobe8PASS・現runner SHA一致を確認。

検証済み：主セッションのrunner-readyのみ新たに実行、exit0・3/3pass。runner-ready.log、results.json、findings.mdが新試行の根拠。build/全coverage/Safariを再実行した結果ではなく、既存成功証拠と現在bytesの照合である。before-*に旧記録を保持。旧失敗、Safari以前の原因・恒久解消、remote CI、公開は未検証のまま。

検証コマンド全文案は verification/review-restart-v1/checkpoint-command-proposal.md を参照。設定・実行・チェックポイント承認は未実施で別の人間承認対象。Step88の正式レビューは主セッションが担当し、この記録で工程承認・U1完了を付与しない。
