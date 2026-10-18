# Unit Test Instructions — u1-runtime-package

今回の実行指定は末尾の「Current Repair Verification — Steps89–93」のみ。以下のSteps85–88を含む過去の実行指定は履歴として保持し、再実行しない。既存Testing Contractと品質基準を維持する。

今回の正式再開始の実観測はverification/official-restart-20261010-v2/main-results.json。主セッションのrunner-ready一回は3PASS/0FAIL/0skip・exit0。保存証拠と現bytesの照合もexit0。過去のverification/review-restart-v1とofficial-recovery-20261010-v1を保持するため、今回の照合結果だけを新専用directoryへ保存した（Step87の保存先からの明示逸脱）。保存coverage・Safariを今回再実行したとは扱わず、品質基準・source-manifest・traceabilityと製品bytesを維持する。

## Historical execution revision — Steps85–88

今回の実行対象はSteps85–88のみ。下のSteps81–84とそれ以前のコマンドは保持する履歴であり、一括再実行しない。main sessionで逐次実行する。既存の設定と最新の成功証拠・現source・candidateを照合してから、workspace cwdで次のU1 runner-readinessを一回実行する。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/package/runner-ready.test.js
```

保存済みcoverage-page-lifecycle-v1/evidence-manifest.jsonの全path/bytes/SHA、v9manifest/唯一tgz/installed24file/第一者14JSと現runtime、v14sourceと現TS/生成JS、identity-before/after、Safari現sessionのverification/results/rawを読取り確認する。照合の具体スクリプトと出力はverification/review-restart-v1へ保存し、346file証拠や過去failed runを上書きしない。component-test-mapは14component各5–8以上の固有ケースを維持し、traceability全57targetの実在を検査する。

証拠が同一ならNode115、browser123、通常API18、全14JSの87.78%（862/982）、1253realm、現sessionSafari27.0.1の5caseを以前の検証済み結果として採用する。新しい再実行とは呼ばない。欠落/差分/runner失敗は正式停止し、補完・隠れたretry・閾値や分母やrealm削減をしない。旧Safari原因/恒久解消、遠隔CI、公開consumer/RCは未検証。80%以上、probe600秒/aube840秒、1worker/retry0、wasm1GB、50ms CPU timeout/10秒readyを維持する。

再build/repack/install、Safari再実行/設定変更、製品編集を予定しない。正式reviewは現試行で一回。checkpointコマンドの設定・実行は全文を提示して別の人間承認を得る。

## Historical execution revision — Steps81–84

今回は本sectionだけを逐次実行し、以下の過去commandsは履歴。mainのみ既存絶対Node24/npm実体と子process PATHを使用。正式npm build/typecheck、browser-api.spec.tsのBiome後、通常APIを三browserで検証。fixture/page teardownは全afterEach後にPlaywrightが実施し、test finallyはsession/observer/実Worker cleanupのみ。製品/coverage tooling/inventory/候補/guest/coreの変更なし。旧v13は保持。

workspace cwd:

```sh
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/browser-api.spec.ts --workers=1 --retries=0 --output .artifacts/u1-v9/readiness-browser-results-v2
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/package/coverage.js prepare /private/tmp/formicarium-u1-consumer-v9/node_modules/@aletheia-works/formicarium .artifacts/u1-coverage-v14
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --import ./.artifacts/u1-coverage-v14/coverage-node-preload.mjs --test --test-isolation=none .artifacts/u1-coverage-v14/tests/package/{errors,validation,state,lifecycle,protocol,core,guest-io,worker-execution,public,node-api,node-worker,consumer}.test.js
```

計測browser cwdは /Users/mutoakio/Documents/formicarium/.artifacts/u1-coverage-v14/tests/package、filterなし全compiled6spec:

```sh
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=/Users/mutoakio/Documents/formicarium/.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node /Users/mutoakio/Documents/formicarium/node_modules/@playwright/test/cli.js test --config playwright.config.ts --workers=1 --retries=0 --output /Users/mutoakio/Documents/formicarium/.artifacts/u1-coverage-v14/browser-results
```

workspace cwdでreport:

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/package/coverage.js report .artifacts/u1-coverage-v14 .artifacts/u1-coverage-v14/browser-results .artifacts/u1-package-v9.manifest.json
```

browserは既存installed実体・host権限、worker1/retry0。期待API18件、計測Node115件・browser123件（数は観測で確認）、固定14JS/80%/Node26/三browser全予定realm/statement-map/digest一致。欠落や不足を補完せず正式停止。50ms deadline/host ready10秒/600・840秒/1GBは維持。唯一tgz SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d、24installedとlock/core/guest/native/fixtureは前後不変。旧v12/v13を上書きしない。遠隔CI/公開/正式review/checkpoint設定は今回対象外。

Step84は以上が成功した後、現sessionで既存Safari runnerを逐次一回実行。runner SHA 0a709c14e0af53b2bc56656294c4cc3d4c81c4a48cd7f1df2ffeaaa39ac4b4d3一致を先に確認。Safari専用再build/設定変更なし、host権限で次のcommand:

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node tests/safari/verify.js --output .artifacts/safari-session-recheck-v1
```

hello/exit3、probe8、aube4/pitchfork2.30.1 8step、native正規化全文一致、visible/isolated、600/840秒、worker1/retry0/64MiB/cleanup60秒、11file before/after/current identityを確認。正式runnerが所有session/childのみcleanup。raw/結果を正式recordへbyte一致/SHA付き保存、failure時partialを保持し正式halt。今回成功でも以前の原因・恒久解消と工程承認は未検証、別sessionの329file証拠は保持。旧sectionのSafari保留/未検証表現は過去の観測であり現在の5case合格を否定しない。

## Current-core candidate and CI preparation — current scope Steps75–77

全てmainで逐次実行、Node24/npm実体とPATHを使用。npm cache=/private/tmp/formicarium-npm-cache。core/guest/fixture保持、前後identity不変。Safari/Edgeなし。node/npmは解決済み実体を意味する。

```sh
npm run build
npm run typecheck
node scripts/package/stage-package.js --out .artifacts/u1-package-v9
# pack cwd=.artifacts/u1-package-v9、出力は新.artifacts/u1-v9のworkspace絶対path
npm pack --ignore-scripts --pack-destination <workspace>/.artifacts/u1-v9
node scripts/package/verify-package.js .artifacts/u1-package-v9.manifest.json .artifacts/u1-v9/aletheia-works-formicarium-0.1.0-rc.1.tgz
npm install --prefix /private/tmp/formicarium-u1-consumer-v9 --ignore-scripts --no-audit --no-fund <workspace>/.artifacts/u1-v9/aletheia-works-formicarium-0.1.0-rc.1.tgz
node --test --test-concurrency=1 tests/package/errors.test.js tests/package/validation.test.js tests/package/state.test.js tests/package/lifecycle.test.js tests/package/protocol.test.js tests/package/core.test.js tests/package/guest-io.test.js tests/package/worker-execution.test.js tests/package/public.test.js tests/package/node-api.test.js tests/package/node-worker.test.js tests/package/types.test.js tests/package/tooling.test.js tests/package/coverage.test.js
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json node --test --test-concurrency=1 tests/package/pack.test.js tests/package/consumer.test.js tests/package/nested-worker.test.js
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/browser-api.spec.ts tests/package/browser-worker.spec.ts tests/package/consumer.spec.ts tests/package/nested-worker.spec.ts tests/package/browser-broker.spec.ts tests/package/browser-errors.spec.ts --workers=1 --retries=0 --output .artifacts/u1-v9/browser-results
node scripts/package/coverage.js prepare /private/tmp/formicarium-u1-consumer-v9/node_modules/@aletheia-works/formicarium .artifacts/u1-coverage-v12
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json node --import ./.artifacts/u1-coverage-v12/coverage-node-preload.mjs --test --test-isolation=none .artifacts/u1-coverage-v12/tests/package/{errors,validation,state,lifecycle,protocol,core,guest-io,worker-execution,public,node-api,node-worker,consumer}.test.js
# 計測browser cwd=<workspace>/.artifacts/u1-coverage-v12/tests/package、絶対CLI/candidate/output、filterなし
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=<workspace>/.artifacts/u1-package-v9.manifest.json node <workspace>/node_modules/@playwright/test/cli.js test --config playwright.config.ts --workers=1 --retries=0 --output <workspace>/.artifacts/u1-coverage-v12/browser-results
node scripts/package/coverage.js report .artifacts/u1-coverage-v12 .artifacts/u1-coverage-v12/browser-results .artifacts/u1-package-v9.manifest.json
```

既存Playwright browser実体を確認して使い、欠落なら未検証で停止、無断download/更新なし。固定14JS/予定realm/digest照合と80%以上を維持。旧成果を今回の成功へ流用しない。unexpected failureはhalt。CIは送信前提整理まで、remote実行/公開/正式checkpoint設定なし。

## Safari process-bound official diagnosis — historical Steps73–74

main build/Biome後node tests/safari/verify.js --diagnose-visibility --instance-diagnostics --output .artifacts/safari-process-diagnostic-v1を一回。instance起動直後からsession作成結果までownedroot→実測PPID子孫を100ms以上/同時一個/最大1200回で採取。psはpid/ppid数値tableだけメモリfilterし全table保存なし、連結したtargetだけpid/ppid/lstart/comm確認、URL/argv/env/tab本文なし。ownedps child各2秒/診断120秒/output64MiB/cleanup60秒/公式log10秒。新logは観測ownedroot又はWebDriver子孫PIDと開始時刻のidentity確認で結合、PID隣接だけで読むことはしない。本文収集不能はfailure halt。session timeoutはdiagnostic outcome、collection成功とacceptance=falseを分離。旧session mode条件/通常受入れ/製品維持、前後identity/hash/byte照合。原因は具体log行へ結合、不足なら未検証。再起動/設定変更/guest試験/CI/公開なし。

cleanup前に対象開始時刻を再照合してidentityを保存し、copy時はPIDが存続する場合に開始時刻を照合して再利用を拒否する。cleanup後に対象PIDが消えていれば正常終了として保存し、生存を必須にしない。新規log/stat identityを照合する。

## Safari startup instance diagnosis — historical Steps71–72

main build/Biome後node tests/safari/verify.js --diagnose-visibility --instance-diagnostics --output .artifacts/safari-instance-diagnostic-v1を一回。Safari再終了/再起動なし。owned safaridriver argvの--diagnoseで単一instance起動時から公式診断、session限定modeと排他、global defaults変更なし。新規logのowned PID token＋事前inventory識別、regular/nonsymlink/stat/pre-read aggregate64MiB cap/SHA/排他copy、同定不能なら無関係fileを読まずfailure halt。requestはfetch前、timeout/errorは後、response受信rawは従来どおり保存。POST session一回15秒/全体120秒、child30秒/cleanup60秒/log10秒、worker1/retry0。session不成立は期待し得る診断outcome、log収集成功をcollection successとしてもacceptance=false/sessionEstablished=falseを必ず明示。成立時のみguestless画像をmain確認。guest受入れ/通常acceptance/製品/CIを変更しない。前後identity/byte一致/digestとlogの具体行に基づく根拠・未検証を記録、追加run/設定変更/公開なし。

## Official Safari diagnostics and normal restart — historical Steps68–70

mainのみ正式npm build/Biome、record内restart-safari.swift型検査後、Safari全体へ正常quit要求一回、30秒以内の実終了確認、通常open一回の再起動を確認。保存確認/拒否/残存ならhalt、forceTerminate/killall/設定変更なし。user既存windowに影響、tab復元保証なし。対象PID以外のappに操作しない。再起動後node tests/safari/verify.js --diagnose-visibility --official-diagnostics --output .artifacts/safari-restart-diagnostic-v1を一回。新session safari:diagnose=trueで公式log生成をHOME Libraryに許可、inventoryはmetadataだけ、今回PID/session IDで同定された新regular fileだけstat/cap検査後read・排他保存・hash照合。合計64MiB、診断120秒/child30秒/cleanup60秒/log確定10秒、worker1/retry0を維持。guestなしcollectionOnly=true/acceptance=false、3時点WD画像/DOMと限定native画像をmainが確認、以前の証拠と比較する。missing/overflow/transport等failureは正式halt。通常acceptance/製品/core/guest/CI/公開を変更・実行しない。

## Safari visibility diagnosis — historical Steps66–67

main実行はnode tests/safari/verify.js --diagnose-visibility --output .artifacts/safari-visibility-diagnostic-v1。一回、unknown-sessionのみ、guest未起動、collectionOnly=true/acceptance=false。専用handle/rect/DOM visibility・hasFocus/isolation/空streamsをwindow操作・activation前後で記録しWebDriver screenshotを保存。record配下Swift/CoreGraphics helperはSafariの非content window metadataだけ取得、タイトル/URL/ユーザー既存tab本文を保存しない。既存screen capture permissionを読み取るだけで変更しない。一意にrect一致したSafari window IDのみ、既存許可成立時にnative screenshot可、曖昧/権限欠落時は省略して未検証を記録。mainが専用imagesをview_imageで照合、全画面captureや他app操作なし。Swift build/typecheckはmainで既存ツール、module cacheはtmpに限定。診断120秒/各child30秒/64MiB/worker1/retry0/cleanup60秒を維持、異常はfailure halt。guest再実行/修正/CI/公開は含まない。

## Visible real Safari retry — current approval scope Steps64–65

変更はtests/safari/verify.tsの専用window可視化preflightに限定。GET /session/{id}/window、POST windowのhandle選択、POST window/maximizeと通常/usr/bin/open -a Safariで前面化し、unknown-session URLに最大15秒のvisible/isolated preflight。各guest前に成立を保存してから既存guest URLへ進む。WebDriverのcontext選択だけでOS foreground成立を仮定しない。open childは既存所有registryでexit確認＋finally cleanup、osascript/System Events/設定変更/既存tab読取り・終了はしない。unsupported API/前面化拒否/可視化失敗は停止。品質条件は元のまま。

main正式npm build/Biome後、node tests/safari/verify.js --output .artifacts/safari-core-v2を一回のみ。v1を上書きせず、guest600秒/aube840秒/worker1/retry0/64MiB/cleanup60秒、hello/exit3/probe8/aube4/pitchfork8/native一致、前後identityを保存。新sourceは正式emitのみ。成功をnpm consumer/遠隔CI/coverageへ流用しない。unexpected failureはfailure halt。CI案に変更・送信はしない。

## Real Safari and CI preparation — current approval scope Steps61–63

実SafariはApple公式safaridriver/WebDriverの専用sessionを使い、Playwright WebKitを実Safari結果に置き換えない。mainが絶対Node/npmで正式build/Biome後、node tests/safari/verify.js --output .artifacts/safari-core-v1を一回実行。hello、exit3、既定probe8、aube4step、pitchfork v2.30.1 8stepを順に確認。native全文一致/全exit0/隔離/visible/実browser版とactualcore identityを記録。品質上限600/840秒、worker1/retry0、64MiB、finally専用session/owned children cleanup最大60秒を保持。driver設定無効なら有効化を代行せず停止。製品/guest/core/fixture再buildなし、public consumer受入れやcoverageとは別のPoC実機試験。

CIはrecord内のworkflow案とactionlintによる静的検証まで。新coreはremote未公開、修正branch/workflowも送信していないため遠隔CI未検証を維持。新core署名pushとSHA照合、lock/cleanbuild更新、formicarium branch送信、本workflow登録と実runには具体的対象と差分を提示して別途人間の承認を得る。CI=1ローカル実行やactionlint成功を遠隔CI成功の代替にしない。実装runnerでunexpected failureならfailure haltし追加retryしない。

## Exit notification order experiment — current approval scope Steps58–60

変更は新tests/browser/core-exit-order.spec.ts、一次fork blink/blink.cのpthread exit早期通知/comment、blink.lock LOCAL、新patches/blink-exit-notification-order.patchと記録。既存fixture/production runtime/public API/secondary fork/BSFpatchは無変更。下位Step56–57以前は履歴。仮説は早期onExitによる非同期終了/次初期化の重なり、原因未証明。現loader force_exitはkeepalive clear後exitJS/runtime termination/_proc_exit最終onExitへ到達するsource根拠があるが、新build実測を必須とする。

mainのみmise絶対Node/npmで新spec正式emit/Biome後、旧coreの意図したRedを一回観測：

```sh
npm run build
node node_modules/@biomejs/biome/bin/biome check tests/browser/core-exit-order.spec.ts
node node_modules/@playwright/test/cli.js test tests/browser/core-exit-order.spec.ts --project=firefox --workers=1 --retries=0 --output .artifacts/blink-exit-notification-order-v1/red
```

specは既存未変更fixtureをunknown-session pageから実行し、7guest module各一回onExit/次factory後旧onExit禁止/全8exit0/native完全一致をassert。done後のqueueも最大5秒のcleanup採取で保持し、guest600秒/test660秒/64MiBを維持、保存write-read一致後assertしfinally Worker終了。intentional duplicate/order以外のhang/fixture失敗はRed不成立で正式停止。

mainのjj一次fork確認→限定C差分→新patch保存→describe/fullcommit→fresh empty child→一次read-only GitHEAD/clean照合→blink.lock LOCAL更新を行う。defaultfetch/remote/bookmark/pushなし。旧coreとidentityは事前に新evidence directoryへ保持。metadata強制なし。

```sh
BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker bash scripts/build-blink-wasm.sh
npm run build
node node_modules/@playwright/test/cli.js test tests/browser/core-exit-order.spec.ts --project=firefox --workers=1 --retries=0 --output .artifacts/blink-exit-notification-order-v1/green
node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --project=firefox --workers=1 --retries=0 --output .artifacts/blink-exit-notification-order-v1/firefox-normal
```

各コマンド成功後だけ次へ。新build commit/一次HEAD/lock一致、dirtyfalse、disablejit/1GB必須。新回帰と通常Firefoxが両Greenの場合だけ、全core必要回帰を逐次実行：

```sh
node --test --test-concurrency=1 tests/node/build.test.js
node --test --test-concurrency=1 tests/node/probe.test.js
node --test --test-concurrency=1 tests/node/aube-1645.test.js
node --test --test-concurrency=1 tests/node/pitchfork-basic.test.js
node node_modules/@playwright/test/cli.js test tests/browser/aube-1645.spec.ts --workers=1 --retries=0 --output .artifacts/blink-exit-notification-order-v1/browser-aube
node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0 --output .artifacts/blink-exit-notification-order-v1/browser-pitchfork
```

Node予定build9/probe15/aube4/pitchfork3、browser全3project。probe600/aubeNode900/browser840/pitchforkNode120/browser600、worker1/retry0/native一致を保持。guest pitchfork f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e/aube c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e/probe ca67cc4efd284ae93190d14cc9b394220cb7a2f1c7f01f682bb9f195589387be、現nativebaseline不変。guest/native再buildなし。失敗は保存して正式halt、品質緩和/未承認retryなし。旧identity固定のdiagnostic specsは今回実行/編集しない。新test source claim、RedGreen/results/patch/新commit/digestsを記録し、local未公開・旧v8/v11と別core・CI/実Safari未検証を明示。新candidate/coverage/review/publicationなし。

## Firefox built-in profiler — current approval scope Steps56–57

source変更/再buildなし。以下Step54–55以前は履歴。mainだけ既存original-untraced specを一回、600秒guest/660秒harness/64MiB stream/worker1/retry0で逐次実行する。新directoryを用意し、Nodeはmise絶対実体、MOZ_PROFILER_SHUTDOWNは以下の絶対pathとする。

```sh
MOZ_PROFILER_STARTUP=1 MOZ_PROFILER_STARTUP_INTERVAL=10 MOZ_PROFILER_STARTUP_ENTRIES=32MiB MOZ_PROFILER_STARTUP_FEATURES=js,stackwalk,cpu MOZ_PROFILER_STARTUP_FILTERS='GeckoMain,DOM Worker' MOZ_PROFILER_SHUTDOWN=/Users/mutoakio/Documents/formicarium/.artifacts/pitchfork-firefox-profile-v1/gecko-profile.json FORMICARIUM_DIAGNOSTIC=pitchfork-firefox-original-untraced node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-diagnostic.spec.ts --project=firefox --grep 'original Worker syscall' --workers=1 --retries=0 --output .artifacts/pitchfork-firefox-profile-v1/test-results
```

ローカルsource根拠：Playwright coreBundle.js:39798/39806はprocess.envをFirefox launchへ渡す。Firefox:45923–45932はmacOSでenv保持とBrowser.close、9389はgraceful失敗時kill。CLI終了後のraw profile実在を確認する。PID suffix等の出力はこの新directory内だけ探索し上書き/補造なし。missing/unparseable/256MiB超過/DOM Worker sample不在は採取未検証。statで上限確認後にparseする。

mainのローカル解析はprofile/process/thread毎にsample/string/frame/stack tableのindex/schemaを照合し、timeoutの最後30秒（completedなら終了近傍）の反復JS/Wasm labelsを集計。raw addressはunsymbolicatedとして未検証、関数名を推測しない。raw profile SHA、invocation/env、stdout/stderr/diagnosis/identity/results、解析対象時刻/thread/indexを保存する。profileによるtiming差があってもacceptance=false、修正成功としない。区別対象はguest終了のKillOtherThreads/futex待ちか次module初期化/旧force_exit待ち。区別不能なら不足を報告し、未知の修正をしない。

前後identityは現clean commit1f58c82eb1b379483493c9be6e00f1634672d72d、loader/WASM/build-info、guest f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、baseline d8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9不変。追加run、trace/customwrapper/通常suite、guest/core build、tool install/download、upload、source修正、candidate/review/push/公開なし。14JS/80%/1GB、aube成功/旧停止、CI/実Safari未検証を保持。

Mozilla一次資料（main確認済み）：https://firefox-source-docs.mozilla.org/testing/debugging-intermittents/index.html 、https://firefox-source-docs.mozilla.org/tools/profiler/code-overview.html 、https://bugzilla.mozilla.org/show_bug.cgi?id=1956229 、https://blog.mozilla.org/performance/2022/02/15/performance-tools-newsletter-q4-2021/ 。設定のドキュメント根拠と今回採取成功の実測を区別する。

## Original Worker untraced diagnosis — current approval scope Steps54–55

変更sourceはtests/browser/pitchfork-diagnostic.spec.tsのみ。Step52–53以下は履歴で再実行指定ではない。同じoriginal Worker testへflag pitchfork-firefox-original-untracedを追加し、実URLは/runtime/web/index.html?session=pitchfork-basic（core-flagなし）。元DOM/Worker/bootstrapは不変。既存host逐次monitor、guest600秒/harness660秒/64MiB、partial証拠のwrite/read一致/path attachment、finally page.close、前後identity照合を維持する。非traceではsyscall stderr要求を外しsyscall trace不在を確認する。通常stderr自体は許可し、traceなしとstderr全空を混同しない。採取はacceptance=false固定、全8exit0/native一致を別のcomparison fieldsへ保存する。

mainのみmise絶対実体でbuild/Biome後、非trace診断一回を逐次実行：

```sh
npm run build
node node_modules/@biomejs/biome/bin/biome check tests/browser/pitchfork-diagnostic.spec.ts
FORMICARIUM_DIAGNOSTIC=pitchfork-firefox-original-untraced node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-diagnostic.spec.ts --project=firefox --grep 'original Worker syscall' --workers=1 --retries=0 --output .artifacts/pitchfork-firefox-original-untraced-v1
```

保存済みdiagnosisがcompletedかつsteps8件全exit0/native一致のときだけ、次の既存通常試験一回を実行する。hosttimeoutなら実行せずpartialと未解決を報告。採取例外/overflow/欠落なら停止。通常試験失敗時は正式failure halt、追加retryなし。

```sh
node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --project=firefox --workers=1 --retries=0 --output .artifacts/pitchfork-firefox-normal-v3
```

通常試験の既存600秒とnative完全一致を変更しない。両方成功は現在の通常検証だけを示し、旧二回停止の原因解消とは断定しない。clean commit1f58c82eb1b379483493c9be6e00f1634672d72d、現loader/WASM/build-info、guest SHA f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、baseline SHA d8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9の前後不変を確認。trace/customwrapper/三browser/Node反復、core/guest build、候補/公開/reviewは対象外。旧失敗とaube成功、14JS/80%/1GB、CI/実Safari未検証を保持。

## Original Worker syscall diagnosis — current approval scope Steps52–53

今回だけの変更sourceはtests/browser/pitchfork-diagnostic.spec.ts。以下のStep49–51以前は履歴で再実行指定ではない。FORMICARIUM_DIAGNOSTIC=pitchfork-firefox-originalで新testだけ有効、旧wrapper testはskip、通常CIでは両方skip。元URL /runtime/web/index.html?session=pitchfork-basic&core-flag=-sで実workerの既存-s/-eを使用する。DOM/Worker/bootstrapやruntimeを変更しない。

一回だけtrace付き最大600秒、test660000ms、worker1/retry0。通常二回の停止が非trace対照で新たな非trace実行なし。host monitorは逐次pollでwindow.formicariumDiagnostics stdout/stderr、result/pageStatus、visible/isolatedとconsole/pageErrorsを保存する。64MiB上限を超えたらoverflow/truncatedを明示して失敗。timeout/overflow/errorでも部分証拠を保存し、finallyでpage.closeして実Workersを終了させる。identity.json、stdout.txt、stderr.txt、diagnosis.jsonをtestInfo.outputPathへ明示writeFile→readFile bytes一致→attach(path)の順でawaitする。

completed/timeoutの採取は収集成功とできるが、traceは常にacceptance=false。nonemptyの実syscall stderrを必須にし、fixture/page例外、overflow、診断欠落は失敗。traceで完了しても通常停止の解消や受入れ成功と主張しない。mainだけmise絶対実体で逐次実行：

```sh
npm run build
node node_modules/@biomejs/biome/bin/biome check tests/browser/pitchfork-diagnostic.spec.ts
FORMICARIUM_DIAGNOSTIC=pitchfork-firefox-original node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-diagnostic.spec.ts --project=firefox --grep 'original Worker syscall' --workers=1 --retries=0 --output .artifacts/pitchfork-firefox-original-trace-v1
```

前後identityを照合：clean commit1f58c82eb1b379483493c9be6e00f1634672d72d、現loader/WASM/build-info bytes、guest SHA f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、baseline SHA d8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9。旧wrapper診断と二回の停止、aube成功を保持。core/guest build、製品修正、候補/公開/reviewは対象外。固定14JS/80%/1GB、CI/実Safari未検証を維持。

## Firefox pitchfork diagnostic — current approval scope Steps49–51

FORMICARIUM_DIAGNOSTIC=pitchfork-firefox以外ではtest.skipとする。明示実行のtool exit0は診断収集成立のみを意味する。timeout結果はstatus=timeout／acceptance=falseとして保存し、guest成功に数えない。event欠落・fixture失敗・overflowはtest失敗。通常config／通常受入れspecは変更しない。

対象sourceはtest専用2files：tests/browser/fixtures/pitchfork-diagnostic-worker.ts、tests/browser/pitchfork-diagnostic.spec.ts。public/runtime型を変更せずtest-local型を使う。実runSessionを一回呼び、moduleOptions.argumentsからguest index/commandを同定するwrapperでfactory/preRun/onExit/quitの境界を別eventへ記録する。callbackは元this/引数/同期動作/例外を維持し、snapshotを再実行しない。onExit enter/returnはfinish/snapshotを含む範囲の観測、factory resolveはsession resultとは別と記録する。Atomics.waitAsync削除はcore import前に維持する。

unknown-session pageで通常Worker未起動・crossOriginIsolated/visibleを確認し、test Workerを一つだけ起動する。untraced600秒を先に実行し、timeout時だけtrace coreFlags[-s,-e]600秒を同入力で一回追加する。最大2回逐次、各run後terminate/listener detach、Playwright test全体予算1260000ms（2×600秒＋採取余裕60秒）。guest一回の600秒を延長しない。stream/eventは最大64MiBでoverflow時は停止し未完了扱い。完全stream/diagnostic events/最後phase/final結果/browser version/identityをattachmentへ保存する。hangはstatus=timeout／acceptance=falseとして保存し、採取成立を収集成功とできるが通常受入れGreenとは呼ばない。baseline成功時にtraceを追加しない。

mainがmise管理Node/npm絶対実体で以下を逐次実行する。npm buildはtest TSを正式emitするためでcore/guest再buildではない。

```sh
npm run build
node node_modules/@biomejs/biome/bin/biome check tests/browser/fixtures/pitchfork-diagnostic-worker.ts tests/browser/pitchfork-diagnostic.spec.ts
FORMICARIUM_DIAGNOSTIC=pitchfork-firefox node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-diagnostic.spec.ts --project=firefox --workers=1 --retries=0 --output .artifacts/pitchfork-firefox-diagnostic-v1
```

出力は新規で旧二回の失敗を上書きしない。固定入力：clean core commit1f58c82eb1b379483493c9be6e00f1634672d72d、pitchfork v2.30.1 SHA f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、native baseline SHA d8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9。registry envを保持してpurgeやguest入力を変更しない。wrapper loggingの観測overhead、trace overheadは診断の限界として明記する。通常Node/三browser suiteの反復、production修正、候補/coverage/公開/reviewは今回対象外。固定配布14JS/80%・wasm1GBとaube成功証拠を保持する。

## Local clean-core formalization — current approval scope Steps46–48

今回の実行指定は以下。過去の診断／dirty build／browser-v2成功を新clean build成功へ流用しない。全操作はmainが逐次実行する。jjでsecondary修正changeをdescribeし、full40hex commitを得て一次.vendor/blinkにfresh empty childを作る。`jj -R .vendor/blink status`とread-only `git -C .vendor/blink rev-parse HEAD`／`git -C .vendor/blink status --porcelain`でrepaircommit一致とtracked source cleanを確認。不一致は停止する。secondary workspaceのgit自動探索は用いない。remote確認・fetch・bookmark操作・pushは行わない。

新しい.artifacts/aube-clean-core-v1へ既存core/guest/baseline/build-info/patchのbytesとdigestを保持してからblink.lockのcommitをLOCAL更新する。環境のBLINK_SOURCE_COMMIT／BLINK_SOURCE_DIRTYが未設定であることを確認し、以下をmainのみ実行する。node/npmはmiseで解決した絶対実体を表す。

```sh
BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker bash scripts/build-blink-wasm.sh
npm run build
node --test --test-concurrency=1 tests/node/build.test.js
node --test --test-concurrency=1 tests/node/probe.test.js
node --test --test-concurrency=1 tests/node/aube-1645.test.js
node --test --test-concurrency=1 tests/node/pitchfork-basic.test.js
node node_modules/@playwright/test/cli.js test tests/browser/aube-1645.spec.ts --workers=1 --retries=0 --output .artifacts/aube-clean-core-v1/browser-aube
node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0 --output .artifacts/aube-clean-core-v1/browser-pitchfork
```

build.test.jsは全件維持する。既存の不正lock／取得拒否試験によるscratch subprocessは回帰試験として実行する。一次checkoutを変更する手動default fetch-blink.shは呼ばない。build試験は現build-infoとlock一致、dirty=false、disable-jit、1GB、一次HEAD、ELF形式、pitchfork v2.30.1／公式commit1054549e85470b08d9507e2c82c850959a4b3914を検査する。

新build-info commit=full repaircommit、dirty=false、core assets全digestを直接照合する。aube v2.7.0 ELF SHA c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e、現native baseline全4exit0/二回一致証拠とpitchfork現baselineを保持する。guest/native baselineを再build／再生成せず同一性を比較する。通常purge、probe600秒、Node aube900000ms、browser aube840000ms、pitchfork既存上限、三browser全て、worker1/retry0を維持。失敗時はfreshログを保持し停止する。

clean sourceはローカルcommitであり公開済みを意味しない。新候補・consumer・coverage・正式reviewは別計画。全Green後、修正diff/fullcommit/clean identity/試験結果を外向きpushの別承認用に提示する。旧v8・v11証拠は上書きしない。CI／実Safari未検証、配布14JS/80%条件は維持する。

明示上限：Node pitchfork120秒／aube900秒、browser pitchfork600秒／aube840秒。既存pitchfork harnessの終了判定余裕も変更しない。ローカルrepair changeのdescription案は`Preserve BSF zero destination for native mimalloc compatibility`。secondary workspaceの.git不在と親へのgit探索はmainによる検証済みで、metadataを推測から補わない。

## Browser oracle retry — current approval scope Steps44–45

以下が今回の実行指定。Step41–43以下は過去の承認・実行履歴で再build指定ではない。main観測：Node aube4/4とprobe15/15、三browserの各4操作exit0/native完全一致、旧0.0.0 assertionによるsuite3fail。修正後browser Greenは未検証。保存済みRedを保持して、tests/browser/aube-1645.spec.tsだけの版oracleをfiledep1.0.0／linked2.0.0へ訂正し、全4exit0/native完全一致を検査する。

Nodeはmiseで解決済みの絶対実体を主セッションだけが用いる。該当TS specのBiome確認後、現runner・同じELF／core／baselineで以下を実行する（node表記はその実体）。PlaywrightはTS specを直接読むためcore/aubeや生成JSの再buildは不要。

```sh
node node_modules/@biomejs/biome/bin/biome check tests/browser/aube-1645.spec.ts
node node_modules/@playwright/test/cli.js test tests/browser/aube-1645.spec.ts --workers=1 --retries=0 --output .artifacts/aube-bsf-repair-v1/browser-results-v2
```

既存configのChromium／Firefox／WebKitを全て対象としproject filterで削減しない。新出力directoryは未使用を確認し、v1失敗記録を保持する。840000ms・通常purge env・1worker/retry0・1GB・native完全一致を維持。全3件成功前にbrowser受入れ完了としない。mainがログ・report・ELF/core/baseline digestを保存する。新candidate/coverage/公開/reviewは今回行わず、ローカルcoreのdirty状態とCI／実Safari未検証を記録する。固定配布14JS/80%は変更しない。

## BSF compatibility repair — current execution after additional approval

今回の対象はStep41–43。主セッションだけが逐次build/testを実行する。目的はnativeで64を保持するBSF zeroの最小Redを修正coreでGreenにし、通常設定のaubeで停止解消を確認すること。既存診断logsはverification/aube-purge-reproduction-v1に保持する。

新named probeはnative Linuxを先に確認し、現core Red→修正core Greenを同じELFで比較する。最小C再現はguest/diagnostics/aube-purge/bsf-zero.c、既存ELF.artifacts/aube-purge-reproduction-v1/aube-purge-bsf-zero。修正対象は新jj workspace .vendor/blink-src/blink/machine.c、probe sourceとtests/node/probe.test.ts。正式core buildはBLINK_SRC=.vendor/blink-src bash scripts/build-blink-wasm.sh、probe buildはFORMICARIUM_CONTAINER=docker bash scripts/build-guests.sh probe。固定core上限1GB/disable-jitを変更しない。未公開local patch/dirty状態をbuild-infoに正確に表示する。生成loaderの手編集をしない。

ローカル修正buildのメタデータは基底commitとdirty=trueを明記する。実行指定は `BLINK_SRC=.vendor/blink-src BLINK_SOURCE_COMMIT=4b5c67d518b0504e13ccde7ba7823f9b6e467c4c BLINK_SOURCE_DIRTY=true bash scripts/build-blink-wasm.sh`。公開済みcommitへのclean buildと区別し、patch SHA256も保存する。新しいTS回帰は既存npm run buildで正式生成する。

主セッションのNode実体で以下を一回ずつ逐次実行する（probeは全8項目と全namedを含む）。

```sh
node runtime/node/run.js --timeout 600 .artifacts/aube-purge-reproduction-v1/aube-purge-bsf-zero
npm run build
node --test --test-concurrency=1 tests/node/probe.test.js
bash scripts/native-baseline.sh aube-1645 --check-reproducible
node --test --test-concurrency=1 tests/node/aube-1645.test.js
node node_modules/@playwright/test/cli.js test tests/browser/aube-1645.spec.ts --workers=1 --retries=0
```

Node outer900000ms/browser840000ms、1worker/retry0/native出力一致を維持する。native再生成時は全操作exit0と二回一致の実証を確認し、途中exit未検査なら手順を修復して正式証拠を採取する。更新対象はfixtures/baseline/aube-1645.native.txtのみ。aube ELFはhash c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99eのv2.7.0を保持し再buildしない。purge無効controlを本試験へ設定しない。

BSF Redは意図したnative互換性不一致で、passing regressionではない。修正後の失敗/timeoutは既存failure ritualに従い保存する。全aube Green前に原因確定/解決済としない。ローカルcoreとblink.lockが一致しない間、pinned再現性/新tarball/coverage/CI/実Safariは未検証として扱う。v8候補を上書きしない。fork公開・lock pin・clean rebuild・候補再作成・正式再レビューは次の具体的承認対象。


## 新attemptの再開時確認（今回の実行指定）

mainが逐次実行。既存ビルド済みJSとv8/v11証拠を保持する。nodeはmiseで解決した実体。

```sh
node --test tests/package/runner-ready.test.js
node scripts/package/verify-package.js .artifacts/u1-package-v8.manifest.json .artifacts/u1-v8/aletheia-works-formicarium-0.1.0-rc.1.tgz
```

追加の読み取り照合：manifestのruntime14＋README15file sha256を現ファイルと比較、実tgz sha256をmanifestと比較、v11 coverage-report.jsonのcandidateSha256／固定14分母／threshold80／passed=trueを確認し、source-manifest全path存在を確認する。今回の観測として記録し、保存済み試験を再実行したと記さない。不一致なら失敗／未検証として停止する。

以下は前attemptの手順履歴で今回の再実行指定ではない。現行specは.ts、Nodeは生成.js。v10は共有assertions.js欠落で失敗、v11は修正後Node115pass・browser123pass（計測99＋追加非計測24）・coverage87.88%。v11の最初のCLI path filterはNo tests found、その後計測copy tests/package cwdでconfig指定・filterなしに修正した。既存候補・copyを再作成せず、旧観測を新attemptの成功へ置換しない。

## Runner and Tool Setup

Node 24以降とnpmの実体をmise lsで解決し、現lockでnpm ci、npm run buildをmainが逐次実行する。TypeScriptとBiomeを現mainの構成で使う。生成.jsが揃ってからU1限定試験を実行する。今回の結果は未検証。旧.mjs/v7/13件の検証履歴はmain-verification.mdと版管理に保持し、今回のコマンドとして実行しない。以下node/npmは解決した実体を意味する。

## Unit-scoped Commands

新候補v8・計測copy v10を使用し、既存候補と証拠を上書きしない。すべてmainで逐次実行する。

```sh
node --test tests/package/runner-ready.test.js
node --test --test-concurrency=1 tests/package/errors.test.js tests/package/validation.test.js tests/package/state.test.js tests/package/lifecycle.test.js tests/package/protocol.test.js tests/package/core.test.js tests/package/guest-io.test.js tests/package/worker-execution.test.js tests/package/public.test.js tests/package/node-api.test.js tests/package/node-worker.test.js tests/package/types.test.js tests/package/tooling.test.js tests/package/coverage.test.js
node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/browser-api.spec.ts tests/package/browser-worker.spec.ts --workers=1 --retries=0
node scripts/package/stage-package.js --out .artifacts/u1-package-v8
npm pack ./.artifacts/u1-package-v8 --pack-destination .artifacts/u1-v8 --json
node scripts/package/verify-package.js .artifacts/u1-package-v8.manifest.json .artifacts/u1-v8/aletheia-works-formicarium-0.1.0-rc.1.tgz
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v8 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v8.manifest.json node --test --test-concurrency=1 tests/package/pack.test.js tests/package/consumer.test.js tests/package/nested-worker.test.js
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v8 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v8.manifest.json node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/consumer.spec.ts tests/package/nested-worker.spec.ts tests/package/browser-broker.spec.ts --workers=1 --retries=0
node scripts/package/coverage.js prepare /private/tmp/formicarium-u1-consumer-v8/node_modules/@aletheia-works/formicarium .artifacts/u1-coverage-v10
node --import ./.artifacts/u1-coverage-v10/coverage-node-preload.mjs --test --test-isolation=none .artifacts/u1-coverage-v10/tests/package/{errors,validation,state,lifecycle,protocol,core,guest-io,worker-execution,public,node-api,node-worker,consumer}.test.js
node node_modules/@playwright/test/cli.js test --config .artifacts/u1-coverage-v10/tests/package/playwright.config.ts .artifacts/u1-coverage-v10/tests/package/browser-api.spec.js .artifacts/u1-coverage-v10/tests/package/browser-worker.spec.js .artifacts/u1-coverage-v10/tests/package/browser-broker.spec.js .artifacts/u1-coverage-v10/tests/package/consumer.spec.js --output .artifacts/u1-coverage-v10/browser-results --workers=1 --retries=0
node scripts/package/coverage.js report .artifacts/u1-coverage-v10 .artifacts/u1-coverage-v10/browser-results .artifacts/u1-package-v8.manifest.json
node node_modules/@biomejs/biome/bin/biome check runtime scripts/package tests/package types
node --test tests/node/build.test.js tests/node/runner.test.js tests/node/session.test.js
```

pack出力先.artifacts/u1-v8は新規作成。同じ唯一tgzを空の/private/tmp/formicarium-u1-consumer-v8へnpm install --ignore-scripts --no-audit --no-fundで導入する。coverageのNode/browserコマンドにも上記FORMICARIUM_CONSUMERとFORMICARIUM_CANDIDATEを設定する。zshのbrace展開は12固定ファイルを表す。別shellでは全ファイルを列挙する。

READMEリンク回帰は修正前の別名pack候補でRedを観測し、同じoracleのGreenだけをv8へ結合する。3communityリンクの正規upstream絶対URLとtarball内READMEを照合し、live web応答を試験の代替にしない。coverage prepareはconfig.tsのtestMatchをcompiledTestConfigで.spec.jsへ変換する（ソース読取り検証済み、実行は未検証）。互換性の欠陥があればcoverage.ts・coverage-inventory.json・coverage.test.ts内で再現Red→必要な修正→Greenを行う。製品runtime/APIの変更が必要なら追加計画を提示する。

## Coverage and Test Volume

14第一者配布JS全件（contracts.jsを含む）を固定分母にして行coverage 80%以上。未importは0%、欠落realm・不一致digest・未登録realmは失敗。Node、3browser、補助Workerを集めline unionを照合する。予定realm数を実行前に構造から固定し、結果を見て減らさない。生成blink/wasm、第三者、宣言型、guest、開発専用は根拠付き別検証。component-test-mapに各componentの5–8固有ケースを対応付け、contracts.tsにも対応を追加する。branch coverageの数値条件は追加しない。

## Fixtures, Mocks and Oracles

唯一tgzと全file digest、型、notices、assets、blink.lock commit/dirty=falseを照合する。fake FS/Workerは異常系注入に使い、実loader・pthread・中止・timeout・資源回収・mode/snapshot/reset/rollback試験の代用にしない。観測コマンド、失敗、未検証、候補digestをmain-verification.mdへ記録する。

## Time Budgets and Reporting

## Aube Investigation — current revision

追加調査Step38–40：新しい明示選択probe `madvise-purge-reuse` は2MiB境界・既存thread読取り・隣接sentinel・再書込みをnativeで検証してから既存blinkで同じELFを実行する。probe buildのみ許可対象、aube/coreの再ビルドを予定しない。必要ならguest/diagnostics/aube-purgeのexact mimalloc0.1.49診断をnativeで先に確認し、同一ELFをrunInWorkerでpurge有効／診断対照無効と比較する。全診断はmainで逐次・600秒以内・1GBの現core。新診断の成功をaube正式Node900秒／browser840秒の成功へ代用しない。製品修正は具体的原因と対象pathを提示した別計画で承認する。

主目的はU4で観測したaube Node900000ms timeoutの原因調査。main sessionで失敗ログ、dist/guests/aubeのSHA256と実version、取得commitの証拠、scripts/build-guests.shのref指定を照合する。スクリプト既定v2.6.1は実ELFの版を証明しない。公式aubepkg/aubeのreleaseと修正PR包含を調べ、同一ELF／fixtureのnetwork-none nativeとWorkerで操作単位の停止位置を確認する。診断は既存上限以内、mainで逐次実行し、結果／未検証／各artifact identityを記録する。

根拠ある再実行で解消する場合のU4最終確認コマンドは、mise管理Node実体で `node --test --test-concurrency=1 tests/node/aube-1645.test.js`。既存900000msを延長しない。Node成功をbrowser成功と扱わない。guest更新／baseline更新／製品修正が必要なら、そのref・commit・対象path・Red/Greenとnative比較を具体化して別途計画承認を得る。共有U1レビュー更新後も、aubeの未解決を隠して全回帰完了としない。

probe 600秒、aube browser 840秒、1worker、retryなし、wasm 1GB、probe8項目/native一致を維持。default timeout600000msとcleanup1000msを維持し、外側予算を延長しない。aube入力不変なら再ビルドしない。全体CI/U4回帰・実Safariは未実行なら未検証として引き継ぐ。新checkpointコマンドは上記Node pack/consumer/nestedとbrowserの実行成立確認後、全文を別途提示し人間承認を得る。この計画承認でcheckpoint設定の承認を代替しない。
## Current execution revision — Steps78–80

今回の実行は本sectionのみ。旧commandsは履歴。main session、既存Node24実体、host権限browser、worker1/retry0。製品runtime/core/guest/候補の変更・再buildなし。正式npm build/typecheckおよび変更したbrowser-api.spec.tsと新cpu-ready-worker.tsのBiomeを行う。

workspace cwd:

```sh
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/browser-api.spec.ts --workers=1 --retries=0 --output .artifacts/u1-v9/readiness-browser-results
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/package/coverage.js prepare /private/tmp/formicarium-u1-consumer-v9/node_modules/@aletheia-works/formicarium .artifacts/u1-coverage-v13
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node --import ./.artifacts/u1-coverage-v13/coverage-node-preload.mjs --test --test-isolation=none .artifacts/u1-coverage-v13/tests/package/{errors,validation,state,lifecycle,protocol,core,guest-io,worker-execution,public,node-api,node-worker,consumer}.test.js
```

計測browser cwdは /Users/mutoakio/Documents/formicarium/.artifacts/u1-coverage-v13/tests/package。filterなしで全compiled6spec:

```sh
FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v9 FORMICARIUM_CANDIDATE=/Users/mutoakio/Documents/formicarium/.artifacts/u1-package-v9.manifest.json /Users/mutoakio/.local/share/mise/installs/node/24/bin/node /Users/mutoakio/Documents/formicarium/node_modules/@playwright/test/cli.js test --config playwright.config.ts --workers=1 --retries=0 --output /Users/mutoakio/Documents/formicarium/.artifacts/u1-coverage-v13/browser-results
```

workspace cwdで集計:

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/package/coverage.js report .artifacts/u1-coverage-v13 .artifacts/u1-coverage-v13/browser-results .artifacts/u1-package-v9.manifest.json
```

専用fixture readinessをhost10秒以内に観測、virtual49msでBUSY/未settle、追加1msで元50ms期限のTIMEOUT・idle/空FS/disposeを検証。実Workerを使い、markerのみtest observerで消費し製品protocolへ渡さない。clockは本testのpage/contextだけ。既存quiet-worker.tsを変更しない。finallyでsession/page cleanup。登録bit捏造、realm削減、閾値変更なし。固定14JS/80%、Node26/三browser予定realm/digest/statement-map/未import0を維持。全測定はfresh v13、v12や他runの記録を混ぜない。v9唯一tgzと24installed/lock/core/guest/fixture digestを前後照合。失敗は正式停止。既存600/840秒・1GB、Safari保留、CI/push/公開/正式checkpoint設定なし。
## Current Repair Verification — Steps89–93

今回の実行指定は本節のみ。旧v8/v10/v13を使う節と過去のcore/guest build指定は履歴で一括再実行しない。製品bytes変更なしの要件記録修復では主セッションが保存ログ/SHAと現identityを照合し、次のrunnerだけを一回実行する。その他の成功済み試験・coverage・Safariを新実行と記さない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/package/runner-ready.test.js
```

読取り照合：v9 manifestと唯一tgz SHA、installed24files、固定14JSのcoverage inventory/statement-map、v14 report862/982/threshold80/passed/1253realm、保存346file、現lock/core/guest/native/fixture、Safari5caseのbefore/after/current tuple。新verification/ci-traceability-repair-v1へ観測を保存し旧rawを上書きしない。traceabilityの14追加exact IDsはrequirements全条件→stories/AC/BR→source→test名→exit/count/ログを列挙し、親IDの子条件不足と外部条件をDeferred/GAPへ明示する。判定対象のtarget存在だけでは成功証明にしない。

以下はU4遠隔CI用のU1引継ぎ契約であり、今回ローカルで再実行する指示ではない。遠隔ではNode24の実体にnodeを置換し、同一pack候補を空consumerへ導入後、FORMICARIUM_CONSUMER/FORMICARIUM_CANDIDATEをそのrunの絶対pathへ設定する。Mac専用tmp pathやローカル保存成功を遠隔成功へ流用しない。

```sh
node --test --test-concurrency=1 tests/package/errors.test.js tests/package/validation.test.js tests/package/state.test.js tests/package/lifecycle.test.js tests/package/protocol.test.js tests/package/core.test.js tests/package/guest-io.test.js tests/package/worker-execution.test.js tests/package/public.test.js tests/package/node-api.test.js tests/package/node-worker.test.js tests/package/types.test.js tests/package/tooling.test.js tests/package/coverage.test.js tests/package/pack.test.js tests/package/consumer.test.js tests/package/nested-worker.test.js
node node_modules/@playwright/test/cli.js test --config tests/package/playwright.config.ts tests/package/browser-api.spec.ts tests/package/browser-worker.spec.ts tests/package/consumer.spec.ts tests/package/nested-worker.spec.ts tests/package/browser-broker.spec.ts tests/package/browser-errors.spec.ts --workers=1 --retries=0
```

U1coverageはinstalled同一候補からfresh計測copyをprepareし、固定12file Nodeとcompiled6spec/3browserを順番に実行、reportを同candidateへ結合する。Nodeはtest-isolation=noneとcoverage-node-preload、browserはcopy tests/package cwdでconfig指定・filterなしを維持。固定14JS/80%、未import0、全予定realm/digest/statement-map一致、欠落拒否、外側600/840秒・1GB・worker1/retry0は不変。具体fresh path/pack/install/coverageコマンドはU4正式CI計画で確定する。旧core-only draftはこの契約を含まないため代替しない。

実装変更が必要と判明した場合は本記録修復計画を広げず、対象TS/再現Red/最小Greenと影響範囲を具体化して再計画する。今回、テストやcoverage基準を下げる変更、新しいmock代替、core/guest再build、remote送信はない。

