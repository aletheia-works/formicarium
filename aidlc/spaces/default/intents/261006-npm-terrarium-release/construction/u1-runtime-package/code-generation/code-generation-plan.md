# Code Generation Plan — u1-runtime-package

## Summary

- Builds: 既存U1実装を保持し、要件のexact ID対応とU4遠隔CIへの引継ぎを修復する（Steps89–93のみ）。
- Touches: U1 traceability.json・code-summary.md・main-verification.mdと新検証記録。製品、候補、core、guestのbytesは変更しない。
- Tests: 保存済みU1 Node138件・3browser123件と固定14JS/87.78%を同一性照合。runner-ready3件を主セッションで確認する。

## Current Repair — Steps89–93

今回の実行対象は下記5項目のみ。Steps1–88および旧版13JS/.mjs/旧consumerを指定する節は履歴であり一括再実行しない。現行はTS source、生成JS、固定14第一者配布JS、v9 candidate/v14 coverage。既存Testing Contractは変更しない。詳細診断・範囲・所有境界は[ci-traceability-repair-plan.md](ci-traceability-repair-plan.md)。計画承認は遠隔送信・公開の承認を兼ねない。

- [x] Step 89 — US1.1–US3.2/US5.3：主セッションが新verification/ci-traceability-repair-v1へ保存済み346証拠、v9唯一tgz/installed24file、固定14JS/v14 coverage、core/guest/native/Safari5caseの現identityを読取り照合する。Build and Test run-20261010-v1とadditional-20261010-v1のexit/count/argv/log SHAを確認し、過去実行と今回再照合を分ける。不一致時は停止する。再build/repack/install/計測/Safari再実行は予定しない。
- [x] Step 90 — US1.1/1.2/1.3/2.1/2.2/2.3/3.1/3.2/5.3：FR1/1.1/1.2/1.3、FR2/2.1/2.2、FR3/3.1/3.2、FR4/4.1、NFR2、NFR6の14 exact IDsをrequirements→stories/AC/BR→実source→実test名→保存結果で一件ずつ確認する。親IDは全子条件の根拠を列挙し、条件未達ならGAP/Deferredとして理由・所有者・不足証拠を残す。単なるtarget実在だけでOKにしない。U1 traceability.jsonへ根拠付き対応を追加し、既存28AC/16詳細NFR/13BRを削除・再ラベルしない。FR7/7.1/7.2/7.3はU4総合受入れへのU1根拠を渡すだけで、公開RC導入の未完了を隠さない。
- [x] Step 91 — 全U1：新record内で修復前後ID集合、target実在、根拠対応を照合し、code-summary/main-verificationを現在の観測に整合する。source-manifestの既存claimを照合して製品変更なしを記録する。主セッションがrunner-ready3件を一回実行。記録修復のみなら138件/123件/coverage/Safariを反復しない。新挙動不具合が判明した場合は再現Red→限定修正→同じGreenを具体化した改訂計画へ戻り、既存成功を流用しない。
- [x] Step 92 — US5.1/5.2/5.3への引継ぎ：U4へ候補tuple、固定14JS一覧/80%収集契約、空consumer導入とU1限定Node/3browser全コマンド、保存raw/realm/coverage、core・guest未公開/可変coldbuildリスクを渡す。旧safari-ci-planning-v1案はcore回帰のみで不足と明記する。U2–U4は各所有者が順次正式修復・再レビューし、U1から兄弟traceabilityへ書き込まない。主セッションが書込み許可成立後にBuild and Test Loop-back1診断・工数・保存証拠・修復対象を追記し、元の0/3記録を上書きしない。
- [ ] Step 93 — 全U1：Step5出力完成後の正式advisory reviewへ旧指摘、14 exact ID追加の差分と根拠、v9/v14/Safari保存同一性、遠隔CI未検証を渡す。新判定後は出力/sourceを変更せず正式な完了処理へ渡す。全Unit Code Generation完了が確認されるまでStop無効を保持する。承認済み状態・レビューreceiptを手編集しない。

## Scope and Sources

ドキュメント根拠：U1 functional-design（entities/rules/functional-spec）、nfr-requirements、nfr-design、infrastructure-design、inception requirements/units/story-map/contracts/components。U1の9ストーリー・28AC、16詳細NFR、13BRを対象とする。実装・製品試験は未検証。既存runtime/core.mjs・guest-io.mjsの読取りでFS参照時点とhard-link欠落を確認した。U2 guest配布、U3 terrarium変更、U4全体CI・公開は別所有。

固定第一者配布JS13：runtime/public.mjs、errors.mjs、validation.mjs、state.mjs、lifecycle.mjs、protocol.mjs、worker-execution.mjs、core.mjs、guest-io.mjs、node/api.mjs、node/package-worker.mjs、web/api.mjs、web/package-worker.mjs（各短縮名はruntime/配下）。exportsとtypes/assets/noticesはfunctional-specの固定表を維持。旧CLI/session/registryは非配布開発入口を維持する。core固有起動・FS取得hook・nested pthread cleanupはcore.mjs、一般FS状態はguest-io/state、Node file取得はNode adapterが所有。

## Decisions Proposed for This Approval

終了順序はSD3の追補を採用し、旧Functional DesignのWorkflow9–10およびstate-machineの早期commitを実装しない。doneは候補、cleanup成功、dispose/abort再確認、原子commit、active解除、Promise settleの順。cleanup不能は候補rollback、EXECUTION（安全な元原因付き）、session DISPOSED。正常非0exitはcommit可。browser terminateにNode同等のackを仮定しない。

時間予算の変更提案：外側probe600秒/aube840秒/pitchfork browser600秒/Node120秒は維持。内部cleanup watchdog1000msを維持し、実consumer受入れのrun timeoutはaube838000ms、probe/pitchfork browser598000ms、pitchfork Node118000msとする。1000ms cleanupと1000ms harness残余を外側に確保する。これはC1/NFR2.1にあるaube840000ms指定から2000msの短縮提案であり、承認前に設定を変更しない。公開API既定600000msと任意の明示timeoutを一律短縮しない。外側上限内にsettleした観測が必須であり、OS schedulingの上限保証を主張しない。実aubeの成功率・影響は未検証。上限延長、retry追加、worker増加で解消しない。今回のApprove Planはこの試験指定差分を含む。拒否時は計画を再検討する。

## Implementation Steps

### Current Revision — aube timeout investigation and review refresh

#### 正式な再レビュー — 今回の承認対象はSteps85–88

2026-10-09の人間の`--stage code-generation`により新しい試行を開始。既存実装・失敗履歴・Steps81–84の成功証拠を保持する。以下だけを今回実行し、旧手順を一括再実行しない。新しい製品実装はない。現候補v9、core a882fb2f3df14115b7e46f6812fb296eef5934d7、tarball SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6dを維持する。

- [ ] Step 85 — mainが既存runner/configと最新成功証拠を読取り照合する。coverage-page-lifecycle-v1の保存346fileのmanifest、14JS/982行/862行/87.78%/1253realm、Node115・browser123・通常API18成功と候補identityを検査。現ソースと計測copy、唯一tgzとinstalled24file、lock/core/guest/native/fixtureのdigestを比較する。Safari現sessionの公式runner SHAと5case、probe8PASS、aube/pitchfork v2.30.1のnative一致、visible/隔離/期限、before/after/current identityを照合する。不一致があれば正式停止し、証拠を再ラベルしない。（全U1、NFR1/2/3/5/7）
- [ ] Step 86 — source-manifest、component-test-mapの14component・固有ケース、traceabilityの28AC+16NFR+13BRを現sourceへ照合。code-summaryとunit-test-instructions等の出力を新試行の文書として整える。最新検証を再実行と区別し、旧失敗とSafari原因/恒久解消、remote CI/公開の未検証を維持。製品runtime/test/core/guest、計測tool、固定inventory、品質基準を変更しない。（全U1）
- [ ] Step 87 — 主sessionでU1のrunner-readyだけを実行し、最新検証と現ソースの一致を確認した記録をverification/review-restart-v1へ排他保存。ソース変更も証拠欠落もない場合は成功済みのbuild・全coverage・Safari実機試験を反復せず証拠を参照。失敗や差分があれば正式停止し、必要な修正・再検証は別計画へ戻す。（全U1、NFR3/5/7）
- [ ] Step 88 — 全出力が揃った後、現試行の正式advisory reviewを一回依頼し、過去R-01–R-04と現v9/v14/Safariを対象へ渡す。判定後にreview済み出力/source-manifest/sourceを変更しない。検証コマンドの全文案を現v9向けに提示する準備まで行い、登録/実行の人間承認およびU1チェックポイント承認は別途取得する。CI登録/push/dispatch/PR/npm/Release/terrarium追加変更は行わない。（全U1、FR7.2、NFR5/7）

#### Coverage page lifecycle repair and current-session Safari recheck — approval requested for Steps81–84

今回の承認対象はSteps81–84のみ。通常API18/18と計測Node115/115は成功、v13 browserはtest finallyのpage.closeがcoverage afterEachより先に走り失敗。独立したSafari証拠は実読取り・保全済みで現coreの実機5case合格、以前の原因/恒久解消は未検証。人間の追加指示により同じ既存runnerの現session実機再確認をStep84へ含める。工程承認は含めない。

- [ ] Step 81 — tests/package/browser-api.spec.tsのCPU timeout case finallyから明示page.closeとそのための内側try/finallyだけを除去し、session dispose/observer復元/実Worker terminateを維持する。page cleanupは既存Playwright fixture teardown（全afterEach後）に任せる。ready/49ms BUSY/50ms TIMEOUT/実Worker/10秒ready上限と他assertion、cpu-ready-worker、quiet-worker、製品runtime/core/guest/coverage tooling/inventory/候補v9は変更しない。正式build/typecheck/Biome後、通常API全6件を三browser18件・worker1/retry0で新readiness-browser-results-v2へ一回実行。異常時は正式halt、追加retryなし。（NFR1/2/3/7）
- [ ] Step 82 — mainのみ同じv9 installedから新.artifacts/u1-coverage-v14をprepare、固定12file Node計測とcopy cwd/filterなし全compiled6spec browserを逐次実行しreportをv9digestへ結合する。旧v12/v13失敗・rawを保持して補完/混合なし。host権限browser、固定14JS/80%/Node26/全browser予定realm/digest/statement-map/未import0、600/840秒/1GB/worker1/retry0は不変。コア/guest/fixture再build・candidate repack/installはしない。全log/失敗/実件数/前後11fileとfixture/唯一tgz/24installed digestを保存、欠落/timeout/不足は正式halt。（全U1、NFR1/2/3/5/7）
- [ ] Step 83 — source-manifest/component-test-map/traceability/main-verification/code-summaryを限定test修正と実観測へ整合させ、成功時だけv9とfresh v14 coverageを結合する。Safari実機5case合格の対象identityと保存証拠を記載し、旧失敗原因・恒久解消未検証/以前の調査履歴を維持。既存CI準備とv9 checkpoint command案を保持。formal review/checkpoint設定/CI登録/push/dispatch/PR/npm/Release/terrarium新core受入れは別具体承認。U1完了/工程承認を自動で付けない。（FR7.2、NFR3/5/7）

- [ ] Step 84 — mainのみ既存tests/safari/verify.jsのdigestを保全済み再確認時の現runner SHA 0a709c14e0af53b2bc56656294c4cc3d4c81c4a48cd7f1df2ffeaaa39ac4b4d3へ照合し、現sessionで正式5caseを一回実行する。Safari用source編集/再build/設定変更/--enable/再起動なし。既存runnerが自分の公式safaridriver session・serverを所有し、新.artifacts/safari-session-recheck-v1へ排他保存、既存の専用window選択/最大化/activation/preflightを使用、全体Safariやuser tabを閉じない。hello/exit3出力・exit0/3、probe8PASS、aube4/pitchfork v2.30.1 8stepの全exit0/native一致、visible/crossOriginIsolated、600秒（aube840秒）、worker1/retry0、64MiB/cleanup60秒とbefore/after/current identity一致を確認する。browser操作はhost権限。失敗時はpartialを保存し正式halt、追加retry/診断/設定操作なし。rawはverification/safari-session-recheck-v1へbyte一致/SHA照合して保存。旧合格/失敗と別session由来を保持し、今回合格でも過去原因/恒久解消/公開consumer/CI/工程承認は未検証を維持する。（FR7.2、NFR2/5/7）

#### Deterministic CPU Worker timeout coverage — historical Steps78–80

今回の承認対象はStep78–80のみ。Steps75–77は履歴。通常三browser123/123、計測Node115/115・browser123/123は成功したがv12 WebKit timeout Worker登録bit0でreport失敗。起動前終了でも現assertionが通ることをsourceで確認。具体遅延の因果は未検証。固定14JS/80%/全realm・v9tgz/installed/coreを保持する。

- [ ] Step 78 — tests/package/browser-api.spec.tsのCPU-bound timeout一件だけを決定的なphase検証へ変更し、新tests/package/fixtures/cpu-ready-worker.tsを追加する。既存quiet-worker.tsは他test用に保持。専用fixtureはrun受信後test-only ready markerをpostして直ちにCPU loopへ入り、testのWorker observerがmarkerだけstopImmediatePropagationして実行開始をhostへ渡す。製品protocolへmarkerを送らずcoverage Worker wrapperを置換しない。page.clockをruntime import前にinstall/pauseAtし、実Worker開始をhost側10秒以内のpollで確認、virtual49msでBUSY/pending、追加1msで元50ms deadlineのTIMEOUTと空FS/idle/disposeを検証。実Workerをfakeにせず、finallyでsession/page cleanupを維持。登録bit補完、期限延長、inventory/realm/閾値削減は禁止。runtime/core/guest/候補の変更なし。（NFR1/2/3/7）
- [ ] Step 79 — mainだけ正式npm build/typecheck、変更2TSのBiome後、通常browser-api.spec.ts全6件を三browser worker1/retry0・既存600秒で新.artifacts/u1-v9/readiness-browser-resultsへ一回検証する。失敗/ready不足/timeoutは正式halt、追加retryなし。成功時だけ同じinstalled v9から新.artifacts/u1-coverage-v13をprepareし、固定12file Node計測、copy tests/package cwd/filterなし全compiled6spec browser、reportを逐次実行する。全14JS/80%以上、予定Node26と全browser realm、digest/statement-map一致を要求。v12失敗を保持、旧raw又は他runのrealmを混ぜない。host権限でbrowser起動、全commands/log/前後lock/core/guest/fixture/tgz/24installed digestを保存。製品candidate/guest/core再buildなし。（全U1、NFR1/2/3/5/7）
- [ ] Step 80 — source-manifestへ新fixtureとtest変更を申告しcomponent-test-map/traceability/main-verification/code-summaryを実sourceと観測へ結合する。Step77の準備記録とv9 checkpoint案を保持し、新v13 coverage成立時だけcoverage結合を完了する。formal advisory review/checkpoint設定/CI登録/push/dispatch/PR/公開/terrarium新core受入れは別具体承認に残す。Safari保留・実機未検証を維持し、U1自動完了としない。（FR7.2、NFR3/5/7）

#### Current core package refresh and CI readiness — approval requested for Steps75–77

今回の承認対象はStep75–77のみ。人間はSafari調査のみ保留し、Chromium/Firefox/WebKitを維持してCIと公開パッケージ検証へ進むと指示。Safari保留記録を適用し、Safari/Edgeを追加実行しない。現core a882fb2f3df14115b7e46f6812fb296eef5934d7/dirty=false、既存candidate-v8は旧core4b5c67d518b0504e13ccde7ba7823f9b6e467c4c。旧候補v11 coverage87.88%を新coreへ流用しない。新coreはローカル未公開で遠隔CIは未検証。

- [ ] Step 75 — mainのみ既存Node24/npm実体で正式build/typecheck、現blink.lock/build-info/loader/wasm/guest/baseline SHAを記録しcommit一致/dirty=false/disablejit/1GBを確認。現fixtureを保持しcore/guest/fixture再buildなし。stage-package.js --out .artifacts/u1-package-v9→新.artifacts/u1-v9へnpm pack→verify-package.jsで唯一tgz/固定24files/14第一者JS/型/notices/READMEを確認。空の/private/tmp/formicarium-u1-consumer-v9へ同tgzをinstall --ignore-scripts --no-audit --no-fund、tmpcache、installed digest一致確認。旧候補/consumer/coverageを上書きしない。0.1.0-rc.1/private=true保持、公開なし。（US1.1/1.2/1.3/5.1/5.3、NFR1/5）
- [ ] Step 76 — mainでU1限定Node14file baseline、v9 Node pack/consumer/nested、非計測browser API/Worker/consumer/nested/broker/errorsの実在6specを三browser worker1/retry0で逐次確認。v9installedから新.artifacts/u1-coverage-v12をprepareし固定12file Node計測test-isolation=none、copy tests/package cwdのconfigでfilterなし全compiled specを逐次実行。reportをv9digestへ結合、固定14JS/未実行を分母へ含む/realm予定数・digest・statement-map一致/line80%以上を確認。元tgz/installed/core/guest/baseline不変、actual結果/log/digestをrecordとsummaryへ保存。失敗/timeout/coverage不足は正式halt、閾値/分母/realm/期限を下げず追加retryなし。製品修正が必要なら新計画。probe600/aube browser840/pitchfork600/worker1/retry0/1GB/cleanup既定を維持、PoC guest回帰は既存成功を参照し今回再実行しない。（全U1、NFR1/2/3/5/7）
- [ ] Step 77 — source-manifest/traceability/component-test-mapと現source・新candidate14JS/固定inventoryをread-only照合、新core候補/coverage証拠とSafari保留をsummaryへ結合。ci-readiness-refresh.mdへ新core未公開、guest builderの可変rust:alpine/apk/UIと固定ELF SHA cold再現未成立、root送信commit未確定等を整理し、次の正式CIに必要な送信先/branch/二corepatch/署名SHA・lock・cleanbuild再照合/guest入力固定の選択と不足をreviewableにする。旧CI案保持、local候補成功をremoteCI成功にしない。v9用checkpoint command全文案をrecordへ保存するが状態へ設定しない。advisory review/正式checkpoint/CI本登録/remote push/dispatch/PR/npm公開/Release/terrarium新core受入れは次の具体的承認・作業として残す。Safari追加調査は保留。（FR7.2、NFR3/5/7）

#### Safari process identity diagnosis — historical Steps73–74

今回の承認対象はStep73–74のみ。Retryでunit resume済み。前回はowned launcher PID57772、公式log filenamePID57773でbind不能。隣接PIDは親子関係の証拠ではない。今回はowned launcherから実測した子孫processに限ってlogを結合する。Safari再終了/再起動/設定変更なし。

- [ ] Step 73 — tests/safari/verify.tsのinstance診断にowned driver process lineage採取を追加する。driver spawn直後からPOST /session完了又は15秒timeoutまで、最大120秒の既存診断内で100ms以上の間隔、同時一個、最大1200回で/usr/bin/ps -ax -o pid=,ppid= の数値metadataだけ取得し、rootPIDから実測PPIDで連結できる子孫を計算する。全process tableはメモリでfilterし保存しない、環境変数/argv/URL/tab情報を読まない。連結できたPIDのみtargeted ps -p <PID> -o pid=,ppid=,lstart=,comm=で開始時刻/実行名を確認し、ownedroot又はsafaridriver/WebDriver関連実行名の子孫と時刻/chainを排他保存する。各ps childはowned registry、最大2秒、output cap、逐次poll、全体deadlineを共有しfinally終了。ps failure/oversize/関係未確認は本文読取りなしで明示不足、PID+1等の推測やlaunchd全processの内容探索fallbackなし。公式logは事前inventoryにないregular nonsymlinkかつ今回観測root又は実測WebDriver子孫PID tokenのものだけstat/pre-read64MiB/copy/SHA照合。開始時刻・収集時のPID identityを再確認、再利用/曖昧なら拒否。session限定modeのPID+session条件は保持。instance session creation timeoutは従来どおり診断outcome、acceptance=false。通常acceptance/製品は保持。ownedchildren cleanup60秒/診断120秒/log10秒、worker1/retry0を維持。（NFR2/5/7）
- [ ] Step 74 — mainのみ正式npm build/Biome後node tests/safari/verify.js --diagnose-visibility --instance-diagnostics --output .artifacts/safari-process-diagnostic-v1を一回実行。ownedPID/子孫chain/starttime/実行名と新log filenameを照合して対象公式log本文のみ読み、request/time/errorと具体log行から原因候補・確定事項・不足を分けてfindings/main-verification/code-summaryへ記録。session成立時のみ既存guestless専用画像をmain確認、guest未起動。log内容が起動記録のみなら接続原因未検証と明記し、採取成立をSafari受入れ成功に流用しない。log同定/採取/cleanup/identity failureは正式halt、追加run/別log本文読取り/設定変更なし。rawbytes/digest/前後core・guest・baseline identity/旧証拠保持、Safari再起動/guest・core rebuild/Node・Playwright・CI再実行/push/PR/公開/Issue投稿なし。（FR7.2、NFR2/5/7）

採取順序の補足：cleanup前に観測した対象processの開始時刻を再照合しidentity証拠を確定する。cleanup後のlog copy時に対象PIDが消えていることは正常終了として記録し、存在する場合だけ開始時刻を再照合してPID再利用を拒否する。終了済みPIDの生存を採取成功条件にしない。公式logの新規性・生成時刻・stat identityを併せて保持する。

#### Safari instance startup diagnosis — historical Steps71–72

今回の承認対象はStep71–72のみ。Retryでunit resume済み。検証済み：Safari通常quit/再起動成功PID367→74675、その後POST /sessionが15秒timeout、session ID不在のためsession限定公式logをbindできなかった。原因未検証。ローカルmanの--diagnoseはowned safaridriver instance全体を起動時から診断し、PID/timestampを命名に含むためsession成立前を調査できる。safari:diagnose限定modeと混同しない。Safari再終了/再起動は今回繰り返さない。

- [ ] Step 71 — tests/safari/verify.tsへ明示--instance-diagnosticsを追加し--diagnose-visibility必須/--official-diagnosticsと排他にする。owned driver argvだけ--diagnoseを追加しglobal defaults/Safari設定は変更しない。公式log inventoryを起動前にmetadataだけ記録、今回owned PID tokenに一致する新規regular nonsymlink fileだけ対象にして最大10秒安定待ち、stat/identity検査と合計64MiB pre-read cap/排他copy/SHA照合を保持。instance識別はPID＋前後inventory（session IDなしを明示）、従来session modeのPID＋session ID条件は保持。WebDriverのrequest journalはfetch前にmethod/endpoint/payload/request開始を排他保存し、timeout/transport exceptionは別error fileへ所要時間とともに保存、response受信時は従来raw+status保存。POST /sessionは一回/15秒、retry0。instance診断ではsession不成立/timeoutをsession outcomeとして記録し、公式log収集成功ならcollection=passedでもacceptance=false/sessionEstablished=falseを明示（Safari機能成功に流用しない）。採取欠落/identity/cap/cleanup例外はfailure halt。session成立時のみ既存guestless3時点DOM/専用画像を採取しmainが確認、guest URLへ進まず以前の品質条件を維持。総診断120秒/child30秒/cleanup60秒/worker1、製品や通常acceptanceは変更しない。（NFR2/5/7）
- [ ] Step 72 — mainだけが正式npm build/Biome後node tests/safari/verify.js --diagnose-visibility --instance-diagnostics --output .artifacts/safari-instance-diagnostic-v1を一回実行する。Safari再起動なし、owned driverから作成前公式logを採取し、今回request/error/logの具体的行・時間・PIDを照合してsession作成停止の理由をfindings/main-verification/code-summaryへ記録。logに理由がなければ未検証を維持、推測を断定しない。raw全bytes/hash/前後core・guest・baseline identityを保存。WebDriver failure観測は診断結果、公式log収集failureは正式halt、追加run/fallback/設定修正なし。以前の証拠/修正を保持、guest/core/native rebuild、ゲスト試験、Node/Playwright/CI再実行、push/PR/公開/Issue投稿なし。（FR7.2、NFR2/5/7）

#### Official Safari diagnostics after normal restart — historical Steps68–70

今回の承認対象はStep68–70のみ。人間は公式log調査とSafari終了・再起動を依頼した。unknown-session:no-such-sessionは意図的なguestless診断ページのアプリ側エラーで、成功したSafari WebDriver sessionの喪失とは異なる。既存診断の3観測hiddenと専用native白画面を比較元にし、再起動後に一回だけ公式log付き診断を行う。Safari全体の通常終了は既存windowにも影響する。tab内容を読まず、保存/復元を保証せず、強制終了や復元設定変更をしない。ドキュメント根拠：Apple NSRunningApplication.terminateは正常quitの要求を送り、戻り値trueだけでは終了完了でない。isTerminated/対象PIDで完了を確認する。ローカルman safaridriverは単一session safari:diagnoseとPID/session IDで命名される~/Library/Logs/com.apple.WebDriver/を説明する。

- [ ] Step 68 — tests/safari/verify.tsのguestless診断に専用--official-diagnostics optionを追加し、--diagnose-visibilityと組合せのみ許可。通常acceptanceは変更せず、新session alwaysMatchへsafari:diagnose=trueのみ追加。公式log directoryを事前/事後に名前・size・mtimeだけinventoryし、今回owned driver PIDと作成session IDを命名から結び付けられる新規regular fileだけ対象とする。symlink拒否、無関係な既存file本文を読まない・変更しない。公式logはdriverにHOME Libraryへの生成を許すがglobal defaults変更なし。専用session終了/child cleanup後に最大10秒で対象log確定、合計64MiB cap（WebDriver/PNG/公式logを含む）をstat/read前に検査し排他コピー・SHA照合。命名同定不能/欠落/oversize/採取例外は未検証でfailure haltし、他logへの探索fallbackや追加runをしない。既存120秒診断/child30秒/cleanup60秒、worker1/retry0、identity照合、collectionOnly=true/acceptance=falseを保持。record内restart-safari.swiftはAppKitでcom.apple.SafariのPIDだけ列挙、各NSRunningApplication.terminate一回、RunLoopで終了確認最大30秒、通常/usr/bin/open -a Safariで一回起動し新PID/起動結果を保存。osascript/System Events/forceTerminate/killall/ユーザーtab操作/権限設定変更なし。（NFR5/7）
- [ ] Step 69 — mainが正式npm build/Biomeと既存Swift typecheckを行い、helperの正常quitを一回実行。既存Safari PIDが残る/quit拒否/保存確認等の介入が必要ならそこで停止し、強制終了しない。終了成立時だけ通常openでSafari再起動を確認し、前後PID・終了要求/実際の終了・再起動結果と時間をverification/safari-restart-diagnostic-v1へ保存。Safariが元々不在なら再起動比較は未成立として停止。ユーザー既存window終了の影響は今回依頼された範囲、既存tab内容の保存/復元操作はしない。新Safariはユーザー用なのでfinallyで全appを終了せず、以降cleanupはowned診断session/childrenのみ。（NFR7）
- [ ] Step 70 — mainのみnode tests/safari/verify.js --diagnose-visibility --official-diagnostics --output .artifacts/safari-restart-diagnostic-v1を再起動後一回実行。guest未起動、従来3時点の同handle/DOM/rect/WD画像と一意windowかつ既存許可時のみnative画像、対象公式logを採取し、以前の診断と照合する。mainが専用画像を確認、全rawをrecordへbyte一致コピーしdigest/公式log参照に基づく原因候補・不足をfindings/main-verification/code-summaryへ記録。hidden継続は診断観測で受入れsuccessではない。採取/終了/再起動/transport/期限のunexpected failureは正式halt、追加runやfallbackなし。core/guest/native再build、Node/Playwright/CI再実行、製品修正、visible条件緩和、push/PR/公開/Issue投稿なし。旧修正と全証拠を保持。（FR7.2、NFR2/5/7）

#### Safari visibility diagnosis — historical Steps66–67

今回の承認対象はStep66–67のみ。Retryを受領しunit resume済み。Step64–65以下は履歴。検証済み：実Safari27.0.1の専用window選択/maximize/open activation exit0にもかかわらず15秒/52観測すべてhidden/isolated=true、guest未開始。Swift6.4が既存で利用可能。原因を特定せずゲスト受入れを再試行しない。Apple CGWindowListCopyWindowInfo/IsOnscreenはOS window metadataを取得できるが、OS onscreenだけでDOM visible成立を保証しない。

- [ ] Step 66 — tests/safari/verify.tsへ明示--diagnose-visibility modeだけを追加し、通常受入れと別にcollectionOnly=true/acceptance=falseとする。専用公式WebDriver sessionと既存localhost server/ownedchild cleanupを再利用し、unknown-session pageのみ開く。guest URLへ進まない。handle選択前、選択/maximize後、通常open -a Safari後の各時点で専用handle/rect、DOM visible/hidden・hasFocus・isolated・userAgent・unknown-session結果、空streams、専用WebDriver screenshotを排他保存。Swift helperをこのrecordのverification/safari-visibility-diagnostic-v1/window-info.swiftへ作成し、mainが既存/usr/bin/swiftでCoreGraphicsのSafari owner window ID/PID/bounds/level/onscreenのみ取得、タイトル/URL/既存tab本文を収集しない。画面収録権限はpreflight読み取りのみ、変更/要求しない。WebDriver rectと一致するSafari候補が一意で既存画面収録許可もある場合のみ、そのwindow ID限定のnative screenshotを一枚保存しmainが見て照合。曖昧/権限なし/metadata欠落ならnative screenshotを省略し不足を記録、全画面・他app・他tabのcaptureをしない。設定変更/osascript/System Events/クリック操作なし。診断全体120秒、child操作最大30秒、guestなしworker1/retry0/64MiB/cleanup60秒、専用session/ownedchildrenだけfinally終了、前後core/guest/baseline identity保持。（NFR5/7）
- [ ] Step 67 — mainのみ正式npm build/Biome、Swift helper型確認後、node tests/safari/verify.js --diagnose-visibility --output .artifacts/safari-visibility-diagnostic-v1を一回実行。hiddenは診断観測として保存し受入れsuccessへ流用しない。採取失敗/例外/overflow/期限超過は正式failure haltし追加実行なし。mainが専用WebDriver screenshotとnative screenshot（取得可能時）をview_imageで確認し、DOM visible・OS onscreen・window候補・前面化各結果を比較して原因確定/仮説/不足を分けてfindings/main-verification/code-summaryへ記録。可視化修正やguest再検証は観測に基づく次の具体計画にする。旧v1/v2/CI案・製品source保持、core/guest/native rebuild、CI実行、品質緩和、push/PR/公開なし。（FR7.2、NFR2/5/7）

#### Visible real Safari retry — approval requested for Steps64–65

今回の承認対象はStep64–65のみ。Step61–63以下は履歴。人間Retryを受領してunit resume済み。検証済み：公式Safari27.0.1 session作成成功、hello713ms時isolation=true/visibility=hidden/result=nullで停止。guest停止原因は未検証。旧失敗は保持し、qualityのvisible条件を弱めない。ドキュメント根拠：W3C WebDriver Switch To Window/Maximize Windowは専用browsing contextを操作するが、OS focusを保証しない。macOS openヘルプで通常起動はアプリを前面に出す（-gはbackground option）。そこで公式window操作と通常Safari app activationを組み合わせ、成功は可視実測で判定する。設定変更/AppleEvents/System Events権限変更は不要と仮定せず、それら自体を使わない。

- [ ] Step 64 — tests/safari/verify.tsの既存runnerだけを限定変更する。session作成後にGET windowで専用handleを取得し、POST windowで当該handleを選択、POST window/maximizeで当該windowのみ展開する。Safari appを/usr/bin/open -a Safariで通常activate（新URL/ユーザー既存tab操作/--enable/sudo/設定変更/osascriptなし）。guestを起動しないunknown-session pageで可視化preflightを最大15秒/250ms周期、actualisolated=true/visibility=visibleと専用handleを保存する。各guest前に同じ専用handleを選択＋app activation＋preflightを行い、preflight成立前にguest URLへ進まない。操作は既存ownedchild registryに登録し完了exitcodeを検査して排他保存、raw WebDriver応答/preflight snapshot/旧失敗を保持する。preflight不成立、unsupported API、activation失敗なら即停止、追加fallback/品質緩和なし。guest開始後はvisible必須を維持、600/840秒、worker1/retry0、64MiB、finally所有session/child cleanup60秒、前後identity、native判定は既存どおり。（NFR2/5/7）
- [ ] Step 65 — mainだけが正式npm build/Biome後、node tests/safari/verify.js --output .artifacts/safari-core-v2を一回実行する。hello/exit3/probe8/aube4/pitchfork v2.30.1 8stepを逐次確認し、native全文一致、全exit0（exit3のみ3）、状態引継ぎと実browser可視/隔離を証拠へ結合。core/guest/native再buildなし、Node/Playwright/CI再実行なし。異常時は正式failure halt、追加再試行なし。結果・比較・actualcore/guest/baseline SHAをverification/safari-core-v2へ保存、main-verification/code-summaryへ追記。既存CI案/旧結果/製品sourceを保持。遠隔CI/候補/coverage/レビュー/push/PR/公開は今回対象外。（FR7.2、NFR2/5/7）

#### Real Safari verification and remote CI preparation — approval requested for Steps61–63

今回の承認対象はStep61–63。Step58–60以下は検証履歴で再実行指定ではない。検証済み：新core a882fb2f3df14115b7e46f6812fb296eef5934d7 dirty=false、Node31/三browser aube6/pitchfork3成功。実Safari driver27.0.1 (22625.1.29.11.28)が存在。ローカルおよびGitHub fork/upstream default branchの.github/workflowsは不存在（API404）。origin/upstream remoteは存在するため旧AGENTSの「remoteなし」は現在と異なる。ただし既存のpush禁止を無断変更しない。GitHub接続のfork権限はpull=true/push=false。新coreは未公開。CI成功の主張は実remote実行まで未検証。

- [ ] Step 61 — tests/safari/verify.tsに依存追加なしNode builtin HTTP/child_processを使う公式safaridriver WebDriver検証runnerを実装する。製品runtime/Playwright設定/生成core/guestを変更しない。127.0.0.1限定の既存serverとdriverを自分のchildとして起動し、自分のWebDriver sessionとchildのみfinally終了。Safari設定変更、--enable、sudo、ユーザー既存tab終了をしない。driver session作成が拒否された場合はraw理由を保存し実機未検証として停止、設定手順を提示する。raw response/identity/result/partial streamsを64MiB上限で新.artifacts/safari-core-v1へ排他保存しread一致照合。traceなし、可視/隔離/実Safari版を保存、core/guest/baselineの前後digestとlock/build-info/dirtyfalse/disablejit/1GB照合。（FR7.2、NFR2/5/7）
- [ ] Step 62 — mainだけが正式npm buildと新runner Biomeを行い、node tests/safari/verify.js --output .artifacts/safari-core-v1を一回実行する。hello exit0/arg、exit3 stderr/status3、probe既定8項目全PASS/exit0、aube #1645全4exit0/native全文一致、pitchfork v2.30.1全8exit0/native全文一致と状態引継ぎを実Safariで逐次検証。probe/hello/exit3/pitchfork各600秒、aube840秒、worker1/retry0、最後cleanup60秒まで、64MiBで途中証拠も保存し判定前に永続化。異常/期限超過は追加retry/修正せず正式failure halt。guest/core/native再buildなし、成功を公開npm/terrarium consumer受入れへ流用しない。（US5.1/5.3、FR7.2、NFR2/5/7）
- [ ] Step 63 — CIの実行可能なworkflow案をverification/safari-ci-planning-v1/verify.workflow.ymlとci-readiness.mdに作成する。.github本登録/remote設定/push/dispatch/PR/公開はこの計画に含まない。runnerはubuntuでNode24、lock固定npm、公式ソースからclean core/guest build、AUBE_REF=v2.7.0/PITCHFORK_REF=v2.30.1明示、1worker/retry0のNode/3browserと新終了通知回帰、ログ/実commit/digestのartifact保存、publish/id-token権限なしとする。coreの未公開commit、署名push時のSHA再確認・lock/cleanbuild更新、修正ソースbranchの送信、guest/nativeの同一性、候補/coverage/consumerとの範囲差を前提に記録し、正式CI成功や全release checks成功と称さない。actionの参照は公式現在版/commitを確認しmise実体actionlintで案を検査。案と対象/commit/必要な外向き操作を具体化してから人間へCI実行の次の手順を提示する。旧検証証拠を保持、Safari結果とCI未実行を分けsource-manifest/main-verification/code-summaryへ記録。（FR7.1/7.2、NFR5/7）

#### Exit notification order experiment — approval requested for Steps58–60

snapshot feasibilityのsource根拠：現生成FS.quitはinitialized=false、fflush、既存stream closeで、FS treeを消去しない。readdir/lstatはlookupPath/stat、readFileはFS.open/stat/readを使う。終了後snapshotの動作安全性は新実core回帰のnative一致/state引継ぎで検証する。最終onExit後のquitは正規経路なので禁止assertを追加しない。profileのpool数は観測であり因果を意味しない。

今回の承認対象はStep58–60のみ。Step56–57以下は履歴。main検証済み：600076ms timeout、profile36196434bytes、tables検証済み、最後30秒root Worker2984samples中2983WaitForWorkerEvents。全96blink pthreadはprocess-local1359.48msまでにunregister、最後のactive JSは1344.85ms createBlink/preRun/populateFs。非同期終了/開始の仮説を検証し、原因確定としない。

source根拠：blink/blink.c:361–370はMAIN_THREAD_EM_ASM(onExit)後にforce_exit。現生成loaderはforce_exit→proxy main→keepalive clear→exitJS→exitRuntime→_proc_exit（terminateAllThreads→onExit）。よって早期通知を除去して最終runtime通知に任せる限定実験は実装可能。新buildでcallback成立/FS snapshot/全回帰を実測するまで互換性は未検証。BSF修正、runtime/public API、prefix/JIT等へscopeを広げない。

- [ ] Step 58 — tests/browser/core-exit-order.spec.tsを新規作成し、unknown-session pageから既存未変更pitchfork-diagnostic-worker.jsをtraceなしで使用する。実runSession/同pitchfork入力、600秒＋60秒cleanup、64MiB/worker1/retry0、event/stream/final outcomeの明示write/read bytes照合/path attachmentとfinally terminateを維持。7guest module全てfactory/onExitが存在し、onExit enterは各一回だけ、旧module onExitが次factory開始後に来ない、全8exit0/native一致をassertする。done後も終了通知queueをbounded cleanup内で採取し最終moduleの重複を見落とさない。mainが旧coreでFirefox一回実行し、意図したduplicate/order assertionのRedを保存する。hang/fixture/他原因失敗は意図したRedと採用せず停止する。（US5.1/5.3、NFR7）
- [ ] Step 59 — mainが一次.vendor/blinkのclean empty child（parent1f58c82eb1b379483493c9be6e00f1634672d72d）をjjで確認し、その未公開changeでblink/blink.cのpthread exit早期MAIN_THREAD_EM_ASM通知だけを除去、force_exitを維持しコメントを最終runtime通知へ合わせる。差分は当該fileのみ、BSFを保持、secondary blink-src/旧BSFpatchを変更しない。新patches/blink-exit-notification-order.patchを保存。jj describe/full修正commit確定→fresh empty childへ進み一次GitHEAD=新commit/sourcecleanを確認しblink.lock LOCAL更新。remote/fetch/bookmark/pushなし。正式BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker build、metadata overrideなし、commit一致/dirtyfalse/1GB/disablejitを必須としnpm正式buildする。旧core/raw identityを新.artifacts/blink-exit-notification-order-v1へ事前保存。不一致/失敗で停止。（US5.1/5.3、NFR5）
- [ ] Step 60 — mainが新Firefox終了順序回帰Greenを先に確認し、次に既存通常pitchfork Firefox一件を600秒/worker1/retry0/native一致で確認する。失敗は正式failure haltで停止、追加診断や未知修正なし。両Green時のみ新core変更に必要なNode build9/probe15/aube4/pitchfork3と三browser aube/pitchforkを逐次確認する。既存品質上限と全probe/native/1GBを維持。guest/nativebaselineは同bytes、再build/再生成なし。新test claim/RedGreen/差分/前後commit/digest/raw resultsを記録。通常停止の改善と終了通知回帰の成立を分けて報告。旧v8/v11/BSF/aube証拠を保持、未公開local新coreとCI/実Safari未検証を明示。候補/coverage/review/push/公開は別計画。（全U1、FR7.1/7.2、NFR2/5/7）

#### Firefox built-in profiler — approval requested for Steps56–57

今回の承認対象はStep56–57のみ、製品/test sourceの編集なし。Step54–55以下は履歴で再実行指定ではない。main検証済み：非trace元Worker診断は600080ms timeout、Status: availableまでのstdoutは旧通常停止とbyte一致、stderr0、例外/overflowなし、identity不変。通常v3は条件未成立で未実行。trace成功との違いは再現したが原因は未検証。

ドキュメント根拠：Mozilla debugging-intermittents/code-overviewのstartup/shutdown profiler、Bug1956229とperformance newsletterのfeatures/filter/entries設定。ローカルsource確認：node_modules/playwright-core/lib/coreBundle.js:39798はlaunch env未指定時process.envを継承、39806はamendEnvironmentを渡す。Firefox:45923–45932はmacOSでenvを保持しBrowser.closeを送信、9389はgraceful close失敗時killへfallback。profile保存成立は実行後に検証し、graceful経路の存在だけで成功を主張しない。

- [ ] Step 56 — mainだけが既存original-untraced診断をbuilt-in profiler env付きで一回実行する。source変更/再buildなし、guest600秒/harness660秒、逐次hostmonitor/stream64MiB/identity前後照合/acceptance=falseを維持する。startup interval10ms/entries32MiB/features js,stackwalk,cpu/filters GeckoMain,DOM Worker、MOZ_PROFILER_SHUTDOWNは新.artifacts/pitchfork-firefox-profile-v1/gecko-profile.jsonの絶対path。CLI終了時のPlaywright graceful browser closeでprofile出力を待ち、失敗時にprofileを手で補わない。PID suffix等はこの新directory内だけ探索し全raw outputsを保持。追加run、tool install/download、public uploadなし。（US5.1/5.3、NFR2/7）
- [ ] Step 57 — mainがprofile fileをstatし256MiB以下を確認してからJSON parse、process/threadのsample/string/frame/stack tablesをschemaに沿って検証する。timeoutは最後30秒、completedなら終了近傍のDOM Worker反復JS/Wasm labelsをraw参照とともにローカル集計し、raw profile/digest/invocation/streams/diagnosis/resultsを保存する。欠落・parse失敗・oversize・Worker sample不在なら採取未検証で停止し、追加runをしない。未symbolicate addressへ関数名を推測で付けない。KillOtherThreads/futex終了待ちと次module初期化/旧force_exit待ちの仮説を比較し、区別不能なら不足を明示する。profilingによるtiming変化を解消証拠へ流用しない。source変更・修正・候補・review・push・公開なし、aube成功/旧停止/CI/実Safari未検証を保持。（US5.1/5.3、NFR2/5/7）

#### Original Worker untraced diagnosis and conditional acceptance — approval requested for Steps54–55

今回の承認対象はStep54–55のみ。Step52–53以下は計画・観測履歴で再実行指定ではない。main検証済み：元Worker trace診断は全8exit0/native一致、session6333.2ms、stderr422975bytes、7LoadProgram/7exit_group0、例外/overflowなし、identity不変。通常二回の停止は未解決で、traceやhost観測によるtiming変化の因果は未検証。旧失敗とaube成功は保持する。

- [ ] Step 54 — tests/browser/pitchfork-diagnostic.spec.tsの同じoriginal Worker caseをFORMICARIUM_DIAGNOSTIC=pitchfork-firefox-original-untracedでも明示実行できるよう限定拡張する。URLは/runtime/web/index.html?session=pitchfork-basicでcore-flagなし、元DOM/Worker/bootstrapとhost逐次monitor/600秒guest/660秒harness/64MiB/persist/cleanupは同じに保つ。trace診断は再実行せず、非traceではsyscall stderr必須条件を外しsyscall trace不在を確認する。通常stderrはあり得るため全stderr空を製品条件にしない。採取結果はacceptance=false固定のcollectionOnlyとして全8exit0/native比較結果を別に保存する。例外・overflow・診断欠落を失敗とする。通常CI/他flagではskip、製品source変更なし。（US5.1/5.3、NFR2/7）
- [ ] Step 55 — mainが正式build/Biome後、非traceoriginal Worker host診断をFirefox一回だけ新.artifacts/pitchfork-firefox-original-untraced-v1へ実行する。completedかつ全8exit0/native一致の場合に限り既存tests/browser/pitchfork-basic.spec.tsの通常Firefox一件をworker1/retry0・既存600秒条件のまま新.artifacts/pitchfork-firefox-normal-v3へ一回実行する。hosttimeoutなら通常試験を実行せずpartialを保存し未解決と報告する。採取例外/overflow/欠落時は停止、通常試験失敗は正式failure haltで停止し未承認retryをしない。前後clean core/guest/baseline identity不変を照合する。両方成功なら現在の通常検証成立を記録できるが、旧二回の停止の原因解消とは断定しない。trace/customwrapper/三browser/Nodeの再実行、guest/core build、候補/公開/reviewなし。固定14JS/80%/1GBとCI/実Safari未検証を保持。（US5.1/5.3、FR7.2、NFR2/5/7）

#### Original Worker syscall diagnosis — approval requested for Steps52–53

今回の承認対象はStep52–53のみ。Step49–51以下は過去の計画・観測履歴で再実行指定ではない。main検証済み：保存済みwrapper診断はtraceなしで全8exit0/native一致。module1–6で前moduleの二重onExitが次factory開始後に届いたが、通常二回の停止との因果は未検証。wrapperのsetup順序・parent構造は元Workerと異なる。aube成功と旧停止証拠を維持する。

- [ ] Step 52 — tests/browser/pitchfork-diagnostic.spec.tsだけへ別のopt-in test「original Worker syscall」を追加する。FORMICARIUM_DIAGNOSTIC=pitchfork-firefox-originalかつFirefox時のみ実行し、既存wrapper testはこのflagでskip、通常CIでは両方skipとする。実URL /runtime/web/index.html?session=pitchfork-basic&core-flag=-sを開き、既存workerの-s→-e追加経路を使う。元DOM/Worker/bootstrapを変えずwrapperやfactory callback観測を加えない。hostの逐次periodic monitorで既存window.formicariumDiagnosticsのstdout/stderr、result/pageStatus、visible/isolated、console/pageErrorsを最大64MiBまで採取する。guest600秒、diagnostic harness660秒、worker1/retry0。timeout/overflow/error時も部分証拠を先に保存してpage.closeで実Workersを終了させ、全経路でcleanupをfinally実施する。明示write/read bytes一致確認後attach(path)し、採取成立はcompleted/timeoutを区別、traceは常にacceptance=false。fixture/page例外・overflow・欠落event/空syscall stderrは失敗。trace timing差を修正成功へ流用しない。（US5.1/5.3、NFR2/7）
- [ ] Step 53 — mainが正式npm build、変更specだけのBiome確認、Firefoxのoriginal Worker syscall一件だけを逐次実行し、新.artifacts/pitchfork-firefox-original-trace-v1へ保存する。通常二回のtraceなし停止を対照とし、traceなし追加・既存wrapper診断・通常三browser/Node suiteは再実行しない。前後identityでclean commit1f58c82eb1b379483493c9be6e00f1634672d72d、guest SHA f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、baseline SHA d8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9とcore bytes不変を確認する。原因が特定できれば次の具体的修正計画へ戻す。製品変更・core/guest build・candidate・公開・reviewを行わない。固定14JS/80%/1GBと実Safari/CI未検証を保持。（US5.1/5.3、FR7.2、NFR2/5/7）

#### Firefox pitchfork bounded diagnosis — approval requested for Steps49–51

diagnostic specはFORMICARIUM_DIAGNOSTIC=pitchfork-firefoxの明示時だけ実行し、それ以外はtest.skipとして通常CIへ混入させない。通常Playwright configは変更しない。採取が成立したtimeoutはstatus=timeout／acceptance=falseを明示して診断収集成功とできるが、guest受入れ成功ではない。event欠落・fixture失敗・stream overflowは収集失敗とする。通常受入れの600秒条件は維持する。

今回の承認対象はStep49–51のtest専用診断だけ。main観測：clean core commit1f58c82eb1b379483493c9be6e00f1634672d72dでaube Node/三browser成功を保持。pitchfork v2.30.1 Firefoxは通常試験を二回実行して停止し、既存失敗証拠を保持した。部分stdoutのStatus: availableだけでは第6操作のonExit待ちと第7操作の開始後を区別できない。原因は未確定。製品runtime/core/guestを変更しない。

- [ ] Step 49 — tests/browser/fixtures/pitchfork-diagnostic-worker.tsをtest専用に作成する。実runSession、parseSessionScript/toSessionSteps、runtime/registryとweb/sessionsの既存設定、defaultCoreの正式dist loader、同じguest/projectFiles/env/cwd/persistを使用し、Atomics.waitAsync削除をcore importより前に維持する。ModuleFactory wrapperは引数からguest module index/commandを記録し、preRun begin/end、factory resolve/reject、onExit/quit enter/return/throwを別diagnostic eventとして記録する。元callbackを同じthis/引数・戻り値・例外で同期委譲し、元resultを変えない。onExitのenter/returnはそのcallback内finish/snapshot範囲を囲う観測でありsnapshot単独完了と偽らない。runSession promiseのresolve/rejectを記録する。stdout/stderr/transcriptへdiagnostic文字列を混ぜない。public型変更やsnapshot二重実行をしない。（US5.1/5.3、NFR7）
- [ ] Step 50 — tests/browser/pitchfork-diagnostic.spec.tsを作成する。同一origin隔離済みunknown-session pageから通常Workerを起動せず、test専用module Workerを一つ起動する。最初はtraceなしで最大600秒、停止した場合だけ同じ入力でcoreFlags[-s,-e]のtrace付き診断を最大600秒で逐次一回行う。各run終了／timeoutでWorkerをterminateしlistenerをdetachしてから次を開始する。最大2回、worker1/retry0。test-local型を用いglobal/public APIを変更しない。診断event・stdout/stderr・final outcome・last-event・browser/visibility/isolation・identityを別attachmentへ保存。完全streamを最大64MiBまで保持し超過時はoverflowとして停止・明示し、末尾だけを完全証拠と扱わない。timeoutをstatus=timeout／acceptance=falseとして保存し、採取成立だけを収集成功とする。event欠落・fixture失敗・overflowは収集失敗とし、診断採取完了を受入れpassにしない。trace実行はoverheadを明記して受入れ性能測定へ流用しない。（US5.1/5.3、NFR2/7）
- [ ] Step 51 — mainだけがnpm正式build、2新TS filesのBiome確認とFirefox限定diagnostic specを実行し、新.artifacts/pitchfork-firefox-diagnostic-v1に証拠を保存する。実guest SHA f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e、clean core commit1f58...、現baselineを照合して保持する。最大2診断の結果から最後のphase／module／command／onExit／snapshot包含範囲を根拠付きで報告し、具体的欠陥が判明したら次の修正計画へ戻る。core/guest/native baseline再build・通常三browser/Node全suite反復・production修正・候補作成・公開・正式reviewは行わない。旧二回の失敗とaube成功を保持、CI／実Safari未検証を明示する。（US5.1/5.3、FR7.2、NFR2/5/7）

#### Local clean-core formalization — approval requested for Steps46–48

今回の承認対象はStep46–48のみ。main観測でBSF修正後probe15/15、aube Node4/4、browser oracle訂正後三browser全件成功。現coreは未公開local dirty buildであり、v8候補と同一ではない。mainのread-only観測：.vendor/blink-srcは共有jj repoのsecondary workspaceで.gitを持たず、git自動探索が親formicariumまで遡る。.vendor/blinkはcolocated一次checkoutで基底4b5c67d5のclean empty child、originとformicarium-wasm@originを持つ。一次checkoutからのclean buildでprovenanceを確定する。下記は外部公開の承認ではない。

- [ ] Step 46 — mainが既存dist/blink・build-info・patch・probe/aube/pitchfork bytesとdigest、旧証拠を新しい.artifacts/aube-clean-core-v1へ保存する。.vendor/blink-srcのBSF修正changeをjj describeし40hex full repair commitを解決する。一次.vendor/blinkでjj new -r repaircommitとしてfresh empty childを作り、jj statusおよびread-only git HEAD/statusを観測し、Git HEAD=repaircommit、tracked source cleanを必須とする。差分は保存済みBitscan修正だけと確認する。不一致なら停止しmetadataを強制しない。secondary workspaceへ新source変更をしない。remote確認・fetch・bookmark更新・pushは禁止。（US5.1/5.3、NFR5）
- [ ] Step 47 — mainがblink.lockのcommitだけを観測済みfull repair commitへLOCAL更新する。BLINK_SRC=.vendor/blink FORMICARIUM_CONTAINER=docker bash scripts/build-blink-wasm.shで正式clean rebuildし、BLINK_SOURCE_COMMIT/BLINK_SOURCE_DIRTY overrideを設定しない。default fetch-blink.sh経路は呼ばず、fetch/repository書換えの変更を追加しない。build-infoのcommit=repaircommit／dirty=false／disable-jit／1GBを観測し、loader/wasm/build-info digestを保存する。dirtyやcommit不一致は失敗で、未公開commitを公開済みと扱わない。npm正式buildでTSの現行JSを生成する。aube/pitchfork/probe ELFは再buildしない。（US1.2、US5.1/5.3、FR7.2、NFR5）
- [ ] Step 48 — mainがfresh clean coreに対しbuild.test全件（scratchの不正lock/取得拒否試験を含む）、Node probe全回帰、aube4操作、pitchfork v2.30.1、三browser aube／pitchforkを指定コマンドで逐次検証する。一次checkoutの手動default fetch経路は呼ばず、既存取得拒否試験のscratch subprocessは維持する。600秒probe／900秒Node aube／840秒browser aube／既存pitchfork上限、worker1/retry0/native一致/1GBを維持する。.artifacts/aube-clean-core-v1へログ・results・全identityを保存し旧v8/証拠を保持する。全Green後、full fork commit＋修正diff＋clean build/回帰証拠を具体化して別途の外向きpush承認へ提示する。今回remote操作・push・PR・publish・candidate/consumer/coverage再作成・U1正式reviewは行わない。（全U1、FR7.1/7.2、NFR2/5）

#### Browser oracle retry — approval requested for Steps44–45

今回の承認対象はStep44–45のみ。以下のStep41–43以前はその承認・実行履歴を保持する。main観測の検証済み結果：BSF修正後Node aube4/4、probe15/15。三browserは各4操作exit0かつ最新native出力完全一致まで到達したが、tests/browser/aube-1645.spec.tsの旧0.0.0 assertion（line35）によりsuite3件が失敗した。browser suiteのGreenは未検証。最新v2.7.0 nativeはnetwork-noneで全4操作exit0、二回一致し、filedep1.0.0／linked2.0.0を観測済み。

- [ ] Step 44 — 保存済みbrowser失敗をoracle不一致のRedとして保持し、tests/browser/aube-1645.spec.tsだけで旧0.0.0を最新nativeのfiledep1.0.0／linked2.0.0へ訂正する。全4操作のexit0とnative出力完全一致assertionを維持・明示する。stdout空のinstallを旧版の出力期待で置き換えない。通常purge設定、840000ms、worker1、retry0、wasm1GBを変更しない。runtime/core/aube/baselineを変更せず、新build・candidate・公開操作を行わない。（US5.1、US5.3、FR7.1、NFR2）
- [ ] Step 45 — mainが同じaube v2.7.0 ELFと現ローカル修正coreでChromium／Firefox／WebKitのtests/browser/aube-1645.spec.tsだけを逐次・worker1/retry0で再実行する。新しい.artifacts/aube-bsf-repair-v1/browser-results-v2へ証拠を保存し、v1失敗を上書きしない。全3件Green、全操作exit0、native完全一致を確認して結果とidentityを記録する。失敗時は証拠を保持して停止し、品質条件を緩めない。core/aube再build、候補作成、publish、正式reviewを行わない。ローカルdirty coreとpinned候補の差、CI・実Safari未検証を保持する。（US5.1、US5.3、FR7.1/7.2、NFR2/5）

#### Core compatibility repair — approval requested for Steps41–43

Step38–40の調査を実施し、BSFゼロ入力のnative互換性差を最小ELFでRedとして再現した。aube停止の解消は未検証。今回の承認対象は以下のローカル修正・検証だけで、Step34–36のU1レビューは共有変更の収束後に行う。v8候補・v11 coverage・既存全修正を保持する。

- [ ] Step 41 — 現在のdist/blinkとbuild-info・probeのbytes/digestを新しい.artifactsへ保持し、既存colocated fork .vendor/blinkをjjで確認する。pinned4b5c67d518b0504e13ccde7ba7823f9b6e467c4cから正式jj workspace .vendor/blink-srcの新changeを作り、blink/machine.cの通常BSFゼロ入力でdestinationを保持してZF=1にする。非0入力とREP prefixのTZCNT動作は保持する。BSR等の別不具合やJIT最適化は追加しない。core差分をpatches/blink-bsf-zero-destination.patchへ保存する。guest/probe/src/bsf_zero.rsとmain.rsへ明示選択bsf-zeroを追加し、tests/node/probe.test.tsに回帰を登録する。Linux nativeで期待値を先に確認し、現coreで同じELFのRedを保存する。16/32/64の非0controlと64-bit zeroの保持/ZF、zero→nonzeroを確認する。（US5.1、US5.3）
- [ ] Step 42 — mainがBLINK_SRC=.vendor/blink-srcで正式build-blink-wasm.shを使い修正coreをbuildする。sourcecommit/local patch/dirtyを正直にbuild-infoへ記録し、未公開local buildを公開済pinned候補と扱わない。BSF最小診断とnamed probeのGreen、既存8＋named probe全回帰を逐次確認する。nativeでaube-1645 baselineを正式に二回再生成して再現性・各操作exitを確認し、通常envの同じaube v2.7.0 ELFでNode tests/node/aube-1645.test.js（900000ms）とbrowser tests/browser/aube-1645.spec.ts（840000ms、Chromium/Firefox/WebKit、worker1/retry0）を逐次実行する。purge無効envを受入れへ持ち込まない。memory1GBと全品質条件を維持する。原因対応をGreenで確認できなければ失敗を保存し、別原因を推測で修正しない。（US5.1、US5.3）
- [ ] Step 43 — 修正差分・Red/Green・全回帰・最新aube baselineと版の証拠を整理して提示する。scripts/build-guests.shのAUBE_REF既定v2.6.1と実ELFv2.7.0の差、欠落import build-info、共有coreとv8候補の違いを未収束項目として明示する。ローカル未公開coreでは正式U1チェックポイントを完了扱いしない。必要なfork push、blink.lock更新とclean rebuild、新候補作成、U1/U3/U4の正式再レビューは、その具体的手順を別途提示して承認を得る。今回push/PR/npm publish/外部投稿は行わない。（全U1）

#### Investigation follow-up — approved Steps38–40 (completed investigation)

検証済み：現ELFは公式aube v2.7.0取り込みと同じSHA256で、修正PR1645を含む。nativeでは全操作完了、通常Workerは最初のinstallで終了通知なし。診断対照MIMALLOC_PURGE_DELAY=-1のみでは全4操作が約4.5秒・各exit0。原因関数は未確定。証拠はverification/aube-investigation-v1/。以下は新たな回帰ゲストを作る調査計画であり、purge無効化の製品採用や未知のcore修正を承認するものではない。

- [ ] Step 38 — guest/probe/src/madvise_purge_reuse.rsとmain.rsに明示選択するmadvise-purge-reuse診断を追加する。2MiB境界を跨ぐ匿名領域を第二threadから先に読み、madvise後の全byte zero、両隣sentinel不変、再write/readを検査する。mainがprobeだけbuildし、network-none Linux nativeを先に、既存blinkを次に実行する。既存8項目と名前付き回帰を置き換えず、600秒・1GBを維持する。（US5.1、US5.3）
- [ ] Step 39 — メモリ診断が両環境で通る場合、aube Cargo.lockのlibmimalloc-sys0.1.49と一致するSHA256 6a45a52f43e1c16f667ccfe4dd8c85b7f7c204fd5e3bf46c5b0db9a5c3c0b8e9のソースで、allocate/free/mi_collectを行う小さなC診断をguest/diagnostics/aube-purge/に作る。バイナリは.artifactsに保存しmainがnative→同coreで逐次比較する。purge有効を本試験、無効を原因切分け対照とし、命令位置・bitmap動作を確認する。aubeを再ビルドしない。既存製品core/配布候補を変更しない。（US5.1、US5.3）
- [ ] Step 40 — 再現結果から修正すべき具体的なpathと動作を特定して修正計画を提示する。core変更が必要ならforkのjj新change・差分保存・Red→Green・native比較・通常設定のaube全回帰を含めて別途承認を得る。旧aube baselineの0.0.0も修正済releaseに対応した正式な再生成対象として提示する。U1レビューは必要な共有変更が収束してから実施する。公開操作なし。（全U1、US5.1）

今回の承認対象はStep34–37。Step1–33は過去の履歴として保持する。人間の追加指示「aube調査も計画に入れて進めて下さい」に従い、主目的をaube Nodeの900秒timeoutの原因調査とする。U1への差し戻しは共有ソース変更によるレビュー失効への対応であり、aube原因がU1にあることを意味しない。製品runtime・v8候補の変更、新しいguest build、公開操作は予定しない。

- [ ] Step 37 — Step34–36の前に、失敗ログ・実aube ELFのSHA256と版・取得元commitの証拠を確認し、公式aubepkg/aubeの最新releaseと人間が言及したマージ済み修正の包含を照合する。欠落provenanceを推測で補わない。同じELFとfixtureでnativeの版／対象操作を確認し、既存Worker試験の各操作と停止位置を上限内の診断で切り分ける。根拠あるRetryで解消した場合はU4の既存900秒試験で再確認する。古い版やruntime欠陥が判明した場合は必要な取得ref・baseline・修正path・回帰試験を具体化して追加計画承認を求める。変更のないaube再ビルド、timeout延長、基準緩和をしない。保存済pitchfork成功をaube成功の代用にせず、失敗証拠を保持する。（US5.1、全U1への影響判定）

- [ ] Step 34 — mainでU1 runner readinessと現runtime／v8実tgz／保存済v11 coverageの対応を再照合する。共有scripts/build-guests.shの既定ref v2.30.1、tests/node/build.test.tsの公式commit照合、更新済native baselineをレビュー対象に含め、保存済U4のv2.30.1 native二回・Node11件・三browser3件の証拠を読む。root入口の成功をtarball consumerやterrariumの最新版成功へ流用しない。（全U1）
- [ ] Step 35 — U1 summaryと検証記録に共有ビルド変更・証拠の所在・対象境界を反映し、既存source-manifestの共有path申告を保持する。aube Node900秒timeoutは未解決、CIと実Safariは未検証として記録する。品質上限・Testing Contract・製品bytesを変更しない。（全U1）
- [ ] Step 36 — 現在のartifact/sourceに対するadvisory review一回を正式に行い、指摘を人間へ示す。レビュー後は対象を凍結し、正式なU1 checkpoint検証と別途の人間承認を経てU4へ戻る。（全U1）

### 新attemptの再開計画（今回の承認対象：Step31–33）

Step26–29は前attemptの完了履歴、Step30は未完了です。既存v8/v11成果を保持し、新規製品変更・候補作成・coverage再収集を予定しません。下位の「今回」表現は各旧attemptの履歴として読みます。

- [ ] Step 31 — mainでrunner-ready.test.jsを確認し、現runtime14＋README、候補v8実tgz、manifest、保存済v11 coverageのcandidate digest／固定14JS／threshold80／passedを読み取り再照合する。不一致を失敗／未検証として記録し、証拠を上書きしない。（全U1）
- [ ] Step 32 — 承認後、現行TS/Biome資料とmanifest・traceability・component map・summary・検証記録を新attempt成果として保存する。前attemptの観測を今回の再実行と偽らず、pitchfork不一致、統合前CI未実行、実Safari未検証を明記する。製品bytesとTesting Contractを変更しない。（全U1）
- [ ] Step 33 — advisory review一回を依頼し、指摘を確認する。現.js／v8 checkpoint検証コマンドを全文提示し、別途人間承認後にcheckpointを実施する。旧設定を直接書換えず、Step30は実際の完了に従って扱う。（全U1）

### Current Revision — latest main and replacement candidate

人間の指示「その内容で修正」により、今回の対象はStep26–30。以下のStep1–25および旧13JS/.mjs/v7の記述は過去の計画・観測の履歴であり、今回の実行指定として使わない。最新main 74dd4477に含まれるTypeScript/Biomeの構成を保持する。ソース読取りで検証済み：package.json、stage-package.ts、coverage-inventory.json、pack.test.tsはcontracts.jsを含む14第一者配布JSを指定し、buildはTypeScriptから同位置の.jsを生成する。Playwrightは.tsの設定・specを読む。旧候補v7のmanifest欠落はmainの観測であり、旧成功を新候補の成功へ流用しない。

- [ ] Step 26 — mainが現在のpackage-lockに対しnpm ci、npm run buildを逐次実行し、U1限定runner-ready.test.jsと既存U1 unit集合をbaselineとして観測する。失敗・資産不足・未検証を記録し、lockや品質基準を緩めない。新規fixture以外のguest/core再ビルドは入力差分とbuild-infoが必要と示した場合だけ行う。（全U1）
- [ ] Step 27 — README先頭のCONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.mdのリンクがtarball同梱先に存在しないことをpack境界の再現試験でRedとして確認する。tests/package/pack.test.tsの対象検査を追加して、READMEの3リンクを正規upstreamリポジトリの絶対URLへ修正し、同じoracleをGreenにする。変更範囲はこの3リンクと対応する試験のみ。生成.jsはmainのbuildで更新する。（US1.3、BR1.3）
- [ ] Step 28 — 新しい唯一候補v8をstaging/manifest/tgz/空consumerで作成する。14第一者JS、型、notices、assets、blink.lock commit/dirty=false、全digestを検証する。旧候補と失敗記録を上書きしない。実tgzを空consumerへ導入しNode pack/consumer/nested、3browser consumer/nested/brokerを順番に実行する。公開操作なし。（US1.1/1.2/1.3/2.1/2.3/3.1）
- [ ] Step 29 — v8専用計測copy v10で14第一者JS全件を分母へ固定し、Node/browser/補助Worker全realm・未import0・欠落検知・digest/map一致・line unionを再収集する。80%以上を観測し、不足なら失敗／未検証。contracts.jsを除外して旧13の分母へ戻さない。component-test-mapへcontracts.tsの固有振舞いと対応試験を追加する。U1境界のBiome/type/既存build-runner-session回帰をmainが逐次確認する。（全U1、NFR3.1）
- [ ] Step 30 — 実装後のsource-manifest、traceability、code-summary、component-test-map、main-verificationを.tsソース/.js配布/14件/v8 digestに整合させる。削除された旧.mjsとeslint設定を存在する実装の証拠にしない。生成物・削除の申告と他Unit所有の区別を現在のjj差分で確認する。新候補に対応した再レビューをmainへ依頼し、検証用checkpointコマンドも.js/v8版を全文提示して別途人間の承認を得る。旧checkpoint設定は直接書換えない。（全U1）

今回の成果物変更予定：README.md、tests/package/pack.test.ts、U1記録内の計画・試験手順・manifest・summary・traceability・component map・検証記録。既存runtimeとpackage toolingの.tsは最新mainをそのまま利用し、必要な欠陥が見つかった場合は具体的に提示する。構成移行は既にmainの変更であり、別の一括変換・全体整形を追加しない。core境界はruntime/core.ts（配布runtime/core.js）へ維持し、Atomics.waitAsync削除を保持する。時間予算と公開契約は既存値を維持。新候補・14件coverage・CI・実機Safariは未検証。

### Checkpoint cleanup oracle correction

Step29の限定的な互換性修正はscripts/package/coverage.ts、scripts/package/coverage-inventory.json、tests/package/coverage.test.tsを必要時だけ対象とする。再現Red→修正→Greenを観測し、配布分母・80%・realm欠落検知を緩めない。以下の旧計画は今回の実行対象外。

今回の対象はStep23–25。既存Steps1–22は履歴として保持する。検証済み：checkpointのNode19件中18pass、1failは共有tmp一覧から既存dirが1件消えた差分。ソース確認済み：consumer.testの回収oracleはOS全体のprefix一覧を比較し、直前の直接coreテストは非同期localOwner.disposeを待たない。消えたdirの所有者と因果関係は未検証。製品の漏れとは断定しない。

- [ ] Step 23 — mainで共有tmpに別ownerが保持・解放する資源を用意し、旧oracleの誤失敗を決定論的に再現してRedを記録する。漏れを残した場合は必ず失敗する対照も用意する。（US2.3、NFR7.1）
- [ ] Step 24 — tests/package/consumer.test.mjsと必要なtest専用helperで、直接core再現のresource ownerを明示所有してdispose完了を待つ。回収oracleはこのテスト専用tmpを使用し、環境変数をfinallyで復元する。実spin出力時に配下の実loaderを観測し、正常・abort・timeout・disposeの各settle後に空であることを確認する。他ownerの存在／削除には依存せず、回収漏れ対照は検出する。製品runtime/tgz v7・品質基準を変更しない。製品欠陥が判明した場合は別の具体的修正計画へ戻る。（US2.3、NFR7.1）
- [ ] Step 25 — mainで対照試験・既存v7 Node pack/consumer/nested全件を逐次実行し、同じ承認済みcheckpointコマンドを再検証する。code-summary/source-manifest/main-verificationに観測を追記して第三者レビューを取り直す。固定13JSの製品bytes不変と保存済みcoverage対応を確認する。test数変更時はcoverageの予定realm数も更新し再収集する。新規製品candidateを作らず、失敗記録を消さず、retry/timeout/閾値を変更しない。（全U1）

### Current Revision — human-requested two defects

以下Step14–22が今回の承認対象。Step1–13のチェックは旧実装の履歴で、今回の修正の成功を意味しない。Testing Contractと固定13JS/80%条件を継続する。

- [ ] Step 14 — mainで既存runner-ready.test.mjsを実行し成功を確認する。（全U1）
- [ ] Step 15 — core.test.mjs、consumer.test.mjs、consumer.spec.mjsに照合後の原URL差替え再現を追加し、Nodeと3browserの実loaderで未照合markerの実行をRedとして観測する。fake importだけで代替しない。（US1.2/2.2/5.3、NFR5.1、BR1.2）
- [ ] Step 16 — runtime/core.mjsと既存Node/web API・package-worker adapterで照合済みbytesの評価と同bytes pthread bootstrapを実装。回答Q2=Aのbrowser Blob moduleと明示script-src blob:条件、同一origin HTTP Workerを採用。Nodeはrun専用0700領域の排他的0400 loader copyを使う。原URL再import・Node data URLを使わない。core固有知識はcore.mjs内に保つ。（US1.2/2.2/5.3）
- [ ] Step 17 — 同じ再現のGreen、pthread正常/中止後再run、CSP許可/拒否、CORS/隔離条件、foreign Worker/任意Blob child拒否を確認。host側run資源台帳が作成途中・正常・abort・timeout・disposeでtemp/Blobを回収し、root強制終了時にもchildren停止後に解放する。root finallyだけに依存しない。既存cleanup/commit順序と通知identityを維持してrefactorする。（US2.1/2.2/2.3/5.3）
- [ ] Step 18 — guest-io.test.mjsのfake FSを親不存在時mkdir失敗へ補正。consumer.test.mjs/consumer.spec.mjsでsetCwd('/work/project/sub')→remove('/work/project')→runをNodeと3browserの実coreでRedとして観測する。（US3.1/3.2、NFR4.4、BR3.2）
- [ ] Step 19 — guest-io.mjsでroot内の欠落親を順に0755で復元。既存mode、seed、link、snapshot commit/rollbackを維持しfile/symlink衝突を拒否。同じ実core再現とmode/snapshot/reset/失敗rollbackのGreenを確認しrefactorする。（US3.1/3.2）
- [ ] Step 20 — 新候補v5のstaging/manifest/tgz/空consumerを生成し非計測Node/3browser consumer・nested・brokerを逐次検証。v4を上書きせず新digestを記録。checkpoint検証コマンドはv5用を別途全文提示し、長いsuiteは120秒checkpoint外で実行する。（US1.1/1.2/1.3/2.1/3.1）
- [ ] Step 21 — v5計測copyで固定13JS全realmの行coverage80%以上、欠落検知、digest一致を再確認。新配布helperが必要なら分母へ追加。既存U1 unit/helper/type/ESLintとbuild/runner/session差分試験をmainのみ逐次実行。guest欠落、CI、全体受入れを未検証として記録し品質基準を下げない。（全U1）
- [ ] Step 22 — READMEへCSP条件とtemp所有/解放を記載。code-summary、source-manifest、traceability、component-test-map、main-verificationに新path/digestとRed/Green観測を記録。（全U1）

今回の修正・再現は未検証。以前の承認済み内部予算838000/598000/118000msとcleanup1000ms/harness残余1000ms、公開default600000msを継続する。公開操作は含まない。

- [ ] Step 1 — 配布/依存/試験骨格。package.json、package-lock.json、scripts/package/stage-package.mjs、tests/package/fixtures.mjs、tests/package/playwright.config.mjsを整備。package名@aletheia-works/formicarium、version0.1.0-rc.1のローカル候補、private=trueを保持。files/exportsを固定し、公開操作なし。node:test、Playwright1.55.0、TypeScript5.9.3、ESLint9.36.0、istanbul-lib-instrument6.0.3、istanbul-lib-coverage3.2.2をdev依存で固定する。導入時lock/実版を確認し、ツール互換性を未観測のまま断言しない。（US1.1/1.2/1.3）
- [ ] Step 2 — runner readiness。tests/package/runner-ready.test.mjsを用意し、node --test tests/package/runner-ready.test.mjsをmainで観測してから各層試験へ進む。後続新規実装はtest-after、既存欠陥は再現失敗→修正→成功。ビルド/試験はmainのみ逐次。（全U1）
- [ ] Step 3 — validation/state層実装。errors.mjs、validation.mjs、state.mjs。入力copy/ELF bounds/PT_INTERP/NUL/env/path、親0755/明示mode順不変、root統合、inode整合、公開FS原子的操作/独立session/resetを実装。（US2.2/3.1/3.2）
- [ ] Step 4 — validation/state層試験。tests/package/errors.test.mjs、validation.test.mjs、state.test.mjs。各component5–8の独立ケースを最低限、全境界をtable-drivenで追加。seed部分commit禁止、bufferコピー、symlink親、削除/hard-link、root境界とBUSY/DISPOSEDをoracle化。層実装後にmainで実行。（US2.2/3.1/3.2）
- [ ] Step 5 — lifecycle/protocol実装。lifecycle.mjs、protocol.mjs。時計/Worker adapterを内部注入可能にし、同期予約、全期間deadline、古い世代の破棄、current不正通知拒否、callback例外、候補commit barrier、timeout/abort/dispose/cleanup失敗の優先順位と一度settleを実装。テスト用注入をpublic exportsに追加しない。（US2.1/2.2/2.3/3.2）
- [ ] Step 6 — lifecycle/protocol試験。tests/package/lifecycle.test.mjs、protocol.test.mjs。各5–8以上、done後cleanup保留中のabort/dispose、cleanupreject/hang、正常resolve直後FS/次run、古いexit、未知message、partial bytes、unhandled rejectionを独立oracle化。短い期限の決定論的注入と実Worker中止の試験を区別する。（US2.1/2.2/2.3/3.2）
- [ ] Step 7 — core/guest実行層。core.mjs、guest-io.mjs、worker-execution.mjs。既存CLI互換を保つadapter追加。FSをpreRunで確保、lstat snapshot、hard-link保持/復元、mode/欠落root/特殊file拒否、bytes flush、非0exit、nested Worker後始末。FS参照欠落とhard-link欠陥は先にtests/package/core.test.mjs、guest-io.test.mjsで再現失敗をmainが記録してから修正。core以外にblink argv/factory/補助Worker知識を増やさない。（US2.1/3.1/5.3）
- [ ] Step 8 — guest実行層試験。core.test.mjs、guest-io.test.mjs、worker-execution.test.mjsを各5–8以上へ拡充。fake FSの順序だけで成功扱いせずreal coreでlink/mode/非0/bytes/失敗snapshotを後続consumer試験へ接続。既存session/runner testsを差分に対応する範囲でmainが逐次実行。（US2.1/2.2/3.1/5.3）
- [ ] Step 9 — Node/browser公開API層。public.mjs、node/api.mjs、node/package-worker.mjs、web/api.mjs、web/package-worker.mjs、types/index.d.ts、types/node.d.ts、types/browser.d.ts。shared rootはdecodeUtf8/公開Errorのみ。相対package assets、Node file取得、browser same-origin/SAB/隔離検査、delete Atomics.waitAsyncをcore load前へ。runごと専用Worker、core再利用なし。（US1.1/1.2/2.1/2.3/5.3）
- [ ] Step 10 — 公開API/Worker試験。tests/package/public.test.mjs、node-api.test.mjs、node-worker.test.mjs、browser-api.spec.mjs、browser-worker.spec.mjs、types.test.mjs、types-valid.ts、types-invalid.ts、tsconfig.json、eslint.config.mjs。残る配布5componentも各5–8の固有振舞いを対応表で計数する。3browser1worker/retry0、Node builtin依存境界、型の正例成功/負例期待診断、asset欠落/環境不足時guest未開始を観測。（US1.1/1.2/2.1/2.2/2.3/5.3）
- [ ] Step 11 — 非計測tarball skeleton。scripts/package/stage-package.mjs、verify-package.mjs、tests/package/pack.test.mjs、consumer.test.mjs、consumer.spec.mjsを追加。同梱assetsを既存dist/blinkからdigest/lock/dirty=false検査後にstaging。LICENSE/THIRD_PARTY_NOTICES.md/READMEを整備。npm packはstagingから出力、空consumerへ実tgzをinstallしrepo外アクセスを検出。既存guestまたは開発fixtureのみをconsumerへ別入力、guestをtgzに含めない。Node+Chromium/Firefox/WebKitで実guest正常/非0/bytes/state→次run/abort後再実行。欠落成果物は成功扱いせず必要なbuildだけmainへ依頼、aube不要再ビルドなし。（US1.1/1.2/1.3/2.1/2.3/3.1/3.2）
- [ ] Step 12 — coverage層実装後に試験。scripts/package/coverage.mjs、coverage-inventory.json、tests/package/coverage.test.mjs。固定13JS全件を事前登録し未import0、Node/browser各realm shared counters登録/欠落検知、強制終了保持、digest/statement-map照合とline unionを実装。bootstrapを分母から外さない。計測copyと非計測実tgzを同fixture結果で比較し、>=80%をmainで観測。不足は失敗、分母変更/閾値低下なし。生成loader/wasm、.d.ts、第三者、guest、開発専用は理由付き別検証。（全U1、NFR3.1）
- [ ] Step 13 — 文書/証拠/traceability。READMEにassets/隔離/期限/エラー/FS/decode例を記載。code-summary.md、source-manifest.json（generator含む全変更path）、traceability.json（28AC+16NFR+13BR→実在source/test）、component-test-map.json、候補digest/commands/results/未検証を作成。U4へ既存全回帰/CI/公開条件を引継ぐ。core差分が影響する既存build/runner/sessionを実行、probe/aube/pitchfork全体回帰の未実施を隠さない。U1終了でtarball skeleton人間checkpointへ渡す。（全U1）

## Story and Quality Traceability

| Story | Steps | Main verification |
|---|---|---|
| US1.1 | 1,9–11,13 | Node/shared import + noninstrumented consumer |
| US1.2 | 1,9–11,13 | assets/types/browser isolation |
| US1.3 | 1,11–13 | pack inventory/notices/provenance/guest exclusion |
| US2.1 | 5–11,13 | bytes/nonzero/registry-free guest |
| US2.2 | 3–10,13 | input/asset/core/snapshot distinct failures |
| US2.3 | 5,6,9–11,13 | deadline/abort/cleanup/BUSY/dispose |
| US3.1 | 3,4,7,8,11,13 | snapshot/link/mode/next-run |
| US3.2 | 3–6,11,13 | FS/reset/copy/isolation |
| US5.3 | 7–10,13 | core boundary/waitAsync |

28ACはfunctional traceability全件、16詳細NFRはNFR traceability全件、13BRはrules.md全件をStep13で集合照合。実装前にOKの架空targetを作らない。NFR1.1/1.2→9–11、2.1/2.2→5,6,11と上記時間提案、3.1→12、4.1–4.4→3–8,11、5.1→11、6.1/6.2→7–10、7.1–7.4→5–10。component5–8 testsは13配布JSごとに明示し、integrationだけでunit境界を省略しない。

## Verification and Limits

main逐次実行。80%固定全13JS、1worker retry0、外側既存上限、probe8項目/native一致/wasm1GBを維持。全体CIはU4で統合前必須、ローカルpassをCI済みと呼ばない。real Safari、real core/nested termination/coverage全realmは未検証。U1ローカル計画承認はpush/npm publish/remote作成/terrarium書込みを許可しない。コードを書き始めるのはこの計画と試験手順の人間承認後。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```
