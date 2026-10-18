# Code Summary — u1-runtime-package

## 2026-10-10 CI・要件対応修復 — Steps89–92

検証済み：今回の主実行は verification/ci-traceability-repair-v1/main-results.json。保存346file・candidate24/runtime14/components14・修復前57対応・v14 coverage862/982=87.78%/skip0/1253realm・Safari5caseの読取り同一性照合exit0。runner-ready は3/3、fail0/skip0、291.780292ms、exit0。製品・テスト・source-manifest既存claims・v9候補bytesは変更していない。

ドキュメント根拠と保存実行結果を個別照合し、traceabilityへ14 exact IDsを追加した。既存28AC/16詳細NFR/13BRの57行を保持し合計71行。追加12 OK、FR3/NFR2はDeferred。[個別条件・実テスト名・保存ログ・不足証拠](verification/ci-traceability-repair-v1/requirement-mapping.md)を正本とする。FR3は実terrarium terminalからの状態/分離結果をU3で正式結合、NFR2は同じ制約/資産tupleでの遠隔CI結果をU4で確認する必要がある。targetの実在だけを達成判定としない。

保存済み追加検証 package Node138/三browser123、core Node54/三browser36は以前の実行を参照する。今回の追加実行はrunner3件のみで、全suite・coverage・Safariを再実行したとは扱わない。旧失敗・旧0/3・旧candidate履歴は下に保持する。U4への候補/coverage/consumer引継ぎは上記mapping末節と既存test instructionsを参照。旧Safari CI案はcore-onlyで不足。

未検証：遠隔CI、公開RC導入、guest可変coldbuild入力の再現、以前のSafari失敗原因/恒久解消。親がBuildTest Loop-back1 ledgerへ追記済み。Step93の新しい正式レビューと単位完了は親が実行する。Code Generation全体完了まではStop無効を保持する。


## 2026-10-10 正式再開始の現試行 — Steps85–88

検証済み（今回の主セッション観測）：verification/official-restart-20261010-v2/main-results.jsonへ、runner-ready 3PASS/0FAIL/0skip（307.715416ms、exit0）と保存証拠の読み取り専用照合exit0を記録した。保存346file、v9 staged/installed24file・runtime14JS、14component、57target（28AC/16NFR/13BR）、coverage-v14の862/982行・87.78%・1253realm、公式Safari5caseと現source/core/guest/native identityは一致する。v9候補SHA dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d、core a882fb2f3df14115b7e46f6812fb296eef5934d7を保持した。

今回はrunner-readyだけを新たに実行した。保存済みNode115・browser123・通常API18・Safari27.0.1の5caseとprobe8PASS/aube4/pitchfork v2.30.1 8stepのnative一致、visible/隔離/期限は以前の検証済み結果として照合したもので、今回の再実行ではない。source-manifest・traceability・component-test-mapの既存内容を保持し、製品・試験・core・guest編集、build/emit/repack/install、jj操作、source登録追加を行っていない。

逸脱：計画Step87のreview-restart-v1と前試行official-recovery-20261010-v1を上書きせず、今回専用official-restart-20261010-v2へ排他保存した。Step88は現試行reviewへ渡す準備までで、正式依頼と判定は主セッションが行う。checkpoint command全文案はverification/review-restart-v1/checkpoint-command-proposal.mdを維持する。この記録で工程完了・承認を付与しない。Stopフックは全体完了の正式確認まで無効を維持する。

未検証：以前のSafari接続timeout/hiddenの原因と恒久解消、遠隔CI、公開consumer/RC・stable公開。過去の失敗・レビュー・成功rawを保持する。以下は前試行までの観測である。

## 2026-10-10 正式復旧後の再レビュー準備 — Steps85–87

検証済み（主セッションの実観測）：verification/official-recovery-20261010-v1/main-results.json の読み取り専用照合はexit0。保存346fileのbytes/SHA、v9唯一tgz、staged/installed24file、現runtime14JS、計測copyと現source、lock/core/guest/native/fixture identity、14componentと57traceability target（28AC/16NFR/13BR）の対応が一致した。候補SHA256 dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d、core commit a882fb2f3df14115b7e46f6812fb296eef5934d7を保持する。source-manifest.jsonとtraceability.jsonは現sourceに適合する既存成果として維持する。

検証済み：保存coverage-v14は固定14JS/982行/862covered/0skipped/87.78%/1253realm、Node115・三browser123・通常API18成功で、現候補との一致を再照合した。保存済み公式Safari27.0.1の5case、probe8PASS、aube4/pitchfork v2.30.1 8stepのnative一致、visible/隔離/期限とrunner・core・guest・baseline identityも再照合した。これらは保存結果の照合で、今回のcoverage・Safari再実行ではない。新たに実行したのは `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/package/runner-ready.test.js` のみで、Node24.21.0、3PASS/0FAIL/0skip、exit0。

旧verification/review-restart-v1を上書きせず、今回の記録はverification/official-recovery-20261010-v1/main-results.jsonへ分離した。承認済み計画・試験手順の本文、過去失敗、v12/v13、別session/現sessionのSafari証拠を保持する。このU1復旧では製品・試験・core・guest編集、再build/repack/install、jj操作、フック・保護機能変更を行っていない。

未検証：以前のSafari接続timeout/hiddenの原因と恒久解消、遠隔CI、公開consumer/RC・stable公開。Step88の現試行正式レビューは主セッションが次に実施する。checkpoint command全文案はverification/review-restart-v1/checkpoint-command-proposal.mdを参照し、設定・実行・チェックポイント承認は別手順。この追記でU1や工程の承認・完了を付与しない。

## 過去の観測（以下は各記録時点の状態）



## Local clean-core formalization — 2026-10-09、進行中

検証済み（main観測）：BSF修正changeをローカルcommit `1f58c82eb1b379483493c9be6e00f1634672d72d`、description `Preserve BSF zero destination for native mimalloc compatibility`へ整理した。一次colocated `.vendor/blink`にはそのcommit上のfresh empty child change `uwqwtxmq`（commit短縮 `8d71218f`）を作成した。read-only Git HEADはrepair commitに一致、Git status空、jj cleanを確認済み。保存した `.artifacts/aube-clean-core-v1/repair.patch` と既存BSF patchはcmp exit0で一致した。`blink.lock`のcommitをこのfull repair commitへLOCAL更新し、U1 source-manifestへ変更を申告した。

未検証：mainが一次checkoutからmetadata overrideなしの正式Docker buildを実行中。新build-infoのcommit/dirty=false、clean coreのNode／三browser回帰はまだ成功としない。ローカルcommitは未公開で、remote確認・bookmark更新・push・PR・publishは未実施。旧core/証拠/v8候補を保持し、新candidate/consumer/coverage・U1/U3/U4正式reviewは別計画。CIと実Safariも未検証。以下の旧観測はその対象core/candidateでの履歴であり、新clean buildへ流用しない。

## 新attemptの再照合（2026-10-08）

検証済み：承認後のStep31をmainが逐次実行。`node --test tests/package/runner-ready.test.js` は3pass／468.356584ms。`node scripts/package/verify-package.js .artifacts/u1-package-v8.manifest.json .artifacts/u1-v8/aletheia-works-formicarium-0.1.0-rc.1.tgz` はexit0、24files／14第一者JS、blinkSourceDirty=false、候補SHA256 `ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35` を確認しました。

Step32としてmanifest・traceability・component-test-mapを現在の内容で新attempt成果へ再保存しました。製品コード・候補bytes・coverage証拠は変更していません。下のbaseline／browser／coverage結果は前attemptの観測であり、今回再実行したとの主張ではありません。pitchfork sourceTag不一致は未解決、統合前CIと実Safariは未検証。Step33のadvisory reviewと別途checkpointコマンド人間承認は未完了です。


## 現行リビジョン（2026-10-08）

ドキュメント根拠：最新mainに合わせてauthoringをTypeScript、lint/formatをBiome、ビルド後の実行とnpm配布を `.js` に対応付けました。固定配布JSはcontractsを加えた14ファイルです。upstreamで削除済みの旧 `.mjs`／ESLintは現行source-manifestのwritesから除外しました。現在の `.ts` と設定・emit helperはU1の現行source bindingで、今回新規作成したとの主張ではありません。技術文書を追加しています。コンポーネント14個のsource/test対応はcomponent-test-map.json、要件対応はtraceability.jsonにあります。旧functional/NFR designの `.mjs` 記述は現 `.ts` authoring／`.js`配布へ読み替え、承認済み設計内容を変更していません。

検証済み：候補v8は24files／固定14第一者JS、実tgzとmanifest SHA256 `ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35` が一致。main実行はnpm ci/build成功、baseline108、runner3、contracts/tooling/coverage25、empty consumer-v8でNode pack/consumer/nested21、非計測browser API/Worker36 pass。consumer/nested/brokerは72件中69pass／3raw JS cast fail、修正後mutationだけ別runで3browser3passです。

未解決：既存build/runner/session回帰32件中31pass／1failはpitchfork sourceTag期待v2.29.0／実v2.30.1のartifact不一致。全体合格は未検証です。

検証済み：coverage v10の共有helper欠落をcopySharedTestHelpersで修正。v11 Nodeは115pass／5939.953541ms。v11 browser全123件pass（11.2分）。coverage report exit0、total982／covered863／skipped0、87.88%、1253realms、passed=true、固定14JS／threshold80%。初回パスfilterのNo tests found exit1後、計測copyのtests/package cwdからconfig指定・filterなしで全123件を逐次実行しました（計測99＋追加非計測24）。main照合exit0でmanifest34path存在、runtime14＋README15filesと実tgzの候補v8 SHA一致を確認。詳細と履歴はmain-verification.mdに記録しています。

## 過去の実装・検証履歴

以下の固定13JS・ESLint・旧候補に関する記述は移行前の履歴です。現行判定は上記とmain-verification.mdを参照してください。

## Scope and Implementation

ドキュメント根拠：承認済み計画と Testing Contract に従い、U1 の9 stories・28 AC・16詳細NFR・13 BRを実装対象とした。private local RC `@aletheia-works/formicarium@0.1.0-rc.1`。固定13第一者JS、公開exports6、tarball inventory23 files。shared入口はError/decode、Node/browser環境入口はcreateSession。guest/registry/旧CLI/session/service worker/vendor/fixture/開発依存は配布外。

変更一覧の正本は `source-manifest.json`。main生成のstaging/計測copyはGit-ignoredの証拠なのでsource-review claimsへ含めず、別のcandidate/coverage manifestで結合する。third-party dist/blink build出力とnative guest ELFはartifact provenanceとして記録し、第一者authoringとは扱わない。runtime errors/validation/state/lifecycle/protocol/worker-execution/public、既存 core/guest-io、Node/browser API/Worker、型3、package/lock、ESLint、staging/archive verifier/coverage helpers、tests/package、README/THIRD_PARTY_NOTICES、`.gitignore`、build-guests shell portabilityを含む。生成package-lockもclaim済み。ローカル `.artifacts/` のtarball/staging/計測copy/compiled fixtureはignoreし、公開候補へ混ぜない。

状態は所有copy、seedは全体検証後に生成。不足親0755、明示dir mode優先、root component境界、中間symlink拒否、inode整合、lstat snapshot/hardlink復元を実装。guest ELF64/x86-64/static executableのheader/program bounds、PT_LOAD/PT_INTERP、args/env/NUL/期限等を受付時に検証する。

doneは候補として保持し、cleanup成功→abort/dispose再確認→snapshot原子commit→予約解除→settle。古いrun世代は不採用、current形状/sequence/aggregate不整合はEXECUTION。正常非0exitはresolve/commit。失敗snapshotはSNAPSHOT、timeout/abortは前stateを保持。終了確認不能はEXECUTION、安全な元codeをcauseに保持してsessionをDISPOSEDへ移す。公開既定600000msとcleanup watchdog1000msは維持。

core固有factory/argv/locateFile/FS取得とpthread対応はcore.mjs。browser強制outer terminate後の実idle pthread活動残存を観測し、generic host-owned child brokerを追加。coreがChildWorker proxyを供給し、browser adapterがsame-origin/options/run identityを検証して実Workerを所有する。outer/child全terminateをhostで同期実行し、CPU-blocked Workerの協力を要求しない。Emscriptenがbrowserにも付けるNode-only workerDataはcore境界で除去する。MessagePortを双方向relayする。必要Worker assetのfetch/body preflightは受付deadline内に実施し、同期ownership handleを先に返す。abort/dispose/deadlineはfetchを取消しlate completionでWorkerを生成しない。Nodeはplatform Worker.terminateのPromiseを待つ。browserをNode相当のack保証とは記述しない。

## Current Rework — Steps 14–22

検証済み：現Testing Contract `ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638`、runner-ready3/3。loader差替えRedはNode2件と3browser各1件で、実生成factoryのfixture正常exit/output後に未照合marker1 != 0を観測。fake importを根拠にしていない。Node最初のURL object fixture失敗は対象Redではなくharness不備として除外。隔離ディレクトリ内の実pthread termination Promiseを待ってからfixtureを削除する。

現実装：照合済みbytesをhost run resource channelへ送る。Nodeは0700専用ディレクトリの排他的0400 blink.mjsコピーからroot/pthreadが同じbytesを評価。browserはhost所有Blob moduleから同bytesを評価し、literal blink.mjsと当該Blob baseのみcore URL bridgeでsame-origin HTTP package-worker bootstrapへ解決する。Blob原文の置換/evalはしない。hostがroot/childrenのhandleを所有し、停止後にtemp/Blobを回収。Node root termination Promise、作成中allocationの完了も待つ。core固有名/URL変換/bootstrapはcore.mjsに閉じる。CSPに明示script-src blob:とwasm compilation許可が必要で、拒否はASSET_LOAD。任意foreign/Blob child URL拒否を維持。

検証済みの中間観測：Node unit34成功、追加core資源/bridge13成功。中間v5 SHA256 `395a206586927bea4180b5f68ba53f30d33aad0e10f110b4b518bdff291d6e4a`、Node consumer7成功。3browser mutation/CSP許可・拒否/Blob正常・abort・timeout・dispose回収12成功（2.8m）。Chromium直接mutation harnessの初回停止は中断した未完了観測で、原因は未特定。childエラー転送と30s期限追加後のmarker0/fixture正常結果を記録し、特定raceの修正と推測しない。

検証済み：cwd Redはunit ENOENT/Node実consumer CORE_INITの2失敗、3browser実consumer CORE_INITの3失敗。guest-io preRunは欠けたparentsを外側から0755で作ってcwdを作成。既存modeは保持、lstatでfile/symlink衝突を拒否。cwd/guest/state unit20成功。追加lifecycleの削除cwd snapshot cleanup/abort rollback/reset seed mode・hardlink oracleもNode104件の成功で検証済み。

現時点の中間v6 SHA256 `490940bcb86f05877e5841c1e258cde091e93a32b897624f74f2be8167e17166`。最終v7 `.artifacts/u1-package-v7.manifest.json`、tgz SHA256 `969e9fab854d4499da1d38087bd601b65042b6d50b086c8fc8ddaefd0752f810`、空consumer `/private/tmp/formicarium-u1-consumer-v7` のstage/pack/archive verify/install成功を検証済み。v6との差はREADMEのみでruntime SHAは同じ。検証済み：v7 Node pack/consumer/nested19件全成功、runtime bytesが同一のv6 3browser consumer/nested/broker48件全成功、v7追加cwd rollback/reset・resource通知21件全成功。Node unit/type/helper104件、ESLint13JS+3helpers成功。既存build/runner/sessionは30成功・2失敗（pitchfork成果物欠落、旧baselineと同じ）。旧v4 coverage90.27%を現sourceの合格に流用しない。配布JS追加なし。

## Candidate and Provenance

検証済み：core buildは blink.lock `4b5c67d518b0504e13ccde7ba7823f9b6e467c4c`、dirty=false、Emscripten6.0.10、JIT無効、wasm最大memory1GB。loader132512bytes、wasm455584bytes。既存guest hello/exit3/probeをbuildしstatic ELF check成功。test-only Rust fixtureのSHA256 `f061ed9273f3ecd2a535ca585f0a5c10615960caed4fc51dee60ecb17ba3c338`、native seed→verify/bytes/thread-exitのoracle成功。guestをruntime tgzへ同梱しない。

stagingは新規/空の `.artifacts/` 配下だけに固定一覧をcopy、dirty/commit/digest不整合を拒否。staged build-infoは既存metadataを保存しloader/wasm SHA256 tupleを追加するため、dist build-infoと同一bytesとは主張しない。実tar inventory/digest/exports/privateを検証してexact tgz SHAをmanifestにbind、空repo外consumerのinstalled全filesを再照合する。Emscripten/musl license全文はpinned build imageからmainが取得しnoticesへ収録、blink/zlib noticesも収録した。公開前の最終ライセンス監査はU4。

旧候補v4の履歴（今回loader/cwd変更後の合格証拠ではない）：`.artifacts/u1-package-v4.manifest.json`、tgz SHA256 `3fc9bc589c624cf5f9854c863198532e119b1467faad8e79c1b996e3ff05cc06`、consumer `/private/tmp/formicarium-u1-consumer-v4`。検証済み：stage/pack/archive verify/install、lifecycle/protocol18/18、3browser追加errors/preflight15case成功（11.5s）。検証済み：v4 Node pack/consumer/nested15/15（3955.111625ms）、3browser既存API/Worker＋consumer/nested/broker全69case成功（5.5m）。追加errors/preflight15caseも成功。最終v4計測copy Node94/94（3292.402125ms）、3browser60/60（3.7m）、coverage report exit0、固定13全141realm、594/658 lines=90.27%（floor80%）を検証済み。v3 browser consumer/nested/brokerは33case成功（5.2m）だが追加契約oracle6caseがRedのため最終候補から除外した。旧v1/v2/v3候補はidentity付き先行/Red証拠として保持。

## Tests and Evidence

全コマンド/実版/観測の正本はmain所有 `main-verification.md`。mainがinstall/build/testを逐次実行。委譲実装agentはbuild/testを実行していない。Node24.21.0、Playwright1.55.0（Chromium140/Firefox141/WebKit26.0）、TypeScript5.9.3、ESLint9.36.0、Istanbul instrument6.0.3/coverage3.2.2を使用。browser workers1/retries0。

検証済みの層試験：runner3/3、errors/validation/state28/28、lifecycle/protocol18/18、core/guest/worker20/20、shared/Node/type21/21、browser API/Worker36/36、fixed13 syntax/ESLint成功。最終fixed13＋stage/verify/coverage ESLint exit0、types正負＋coverage helper8/8（958.892834ms）成功。既存runner/sessionは復元後・core/guest変更後とも23/23成功。最終build/runner/sessionは32tests中30pass/2fail（1067.824916ms）、唯一の失敗は既存pitchfork .commit/build-info成果物の欠落。今回の初期baselineにもあった前提欠落であり、全既存suite greenとは記述しない。core build/fork7caseとrunner/session23caseは成功。core broker追加後のunitは15/15、browser既存36case成功。13component別に5以上のnamed casesを `component-test-map.json` に対応付けた。

既存欠陥はRed先行：preRun FS、inode欠落/復元、明示dir mode、特殊file omissionの5ケースが全失敗してから修正、同oracle成功をmainが確認。lifecycle done後lateWorkererrorの再現1失敗→修正→18成功。browser direct pthread wrapper timerでは初期候補のChromium abort/timeout、WebKit abortでsettle後150msにcounterが増加し、valid実pool残存を確認してhost-owned brokerを修正した。人工第三層heartbeatの先行試験は製品child生存の証明として採用しない。

非計測v1 exact tgz consumer：Node pack+consumer12/12、3browser15/15。real normal/non0/非UTF8 bytes、hardlink/symlink/mode/delete snapshot→次fresh core、spin-startedを要求したCPU-bound timeout/abort→直後run、pthread正常exitを観測。ただしbrowser強制nested停止にRedがあるためv1を最終候補として扱わない。直接2階層Node observer3/3成功。observer timerはCPU実行中pthreadでブロックされるため、停止counterだけで全active childの死や性能を証明したとは主張しない。idle実pool活動とpublic CPU中止/reuseの観測を区別する。

## Coverage and Traceability

旧v4でのNFR3.1観測（現revisionは最終候補で再検証待ち）：固定13全sourceを事前登録、未import0、shared statement countersをWorker静的依存import前にproxyへ接続し、強制終了後もhostが保持する方式を実装。source/instrumented/statement-map digest照合、planned case/realm inventory欠落のfail-closed、line union >=80%を要求する。root/mainの計測copyを用い、actual private tgzを変更しない。同Rust consumer casesの結果を非計測baselineと比較する。計測hostが所有するgenerated pthread helperは第三者assetとして包装対象外、第一者13のbootstrapを分母から外さない。coverage unit6/6は検証済み、v3 collector readinessはNode94/94、planned host+17Worker全18realm登録成功。最終v4計測copy Node94/94、browser60/60、141realms（Node host+17Workers、各browser20pages+21Workers）、594/658lines=90.27%をmainが観測。source/instrumented/statement-map digestとv4 candidate SHAをreportで照合した。80%を下げず未import0を維持した。

`traceability.json` は28AC+16NFR+13BR全57件→実在source/testの紐付け。OKは対象存在/実装対応の意味であり、全NFRの実環境合格を表さない。NFR2.1のaube/pitchfork/probe全体回帰、NFR4.2のguest network/host-sentinel全受入れ、実機Safari、CI、公開前依存/機密/ライセンス監査は未検証またはU4へ引継ぐ。prototypeの過去実績と今回の未実行suiteを混同しない。

## Deviations and Handoff

必要前提修正：macOS Bash3.2で既存build-guestsの `$image）` 等5表示interpolationがunboundとなったため `${image}）` 等へ限定修正。同commandの既存probe build成功をmainが確認。guest/probe source変更なし。既存probeはscratchを削除するため、test-only Rust fixtureを追加してpersistent links/modes/deletion/bytes/CPU spin/threadケースをnativeに確認した。配布外。

承認済み差分：aube838000ms、probe/pitchfork browser598000ms、pitchfork Node118000msをconsumer受入れ用run budgetとして提案承認済み。外側840/600/120秒、公開600000ms、1worker/retry0、全13coverage80%を緩和しない。今回aube/pitchfork実受入れを実行したとは主張しない。

未検証：実Safari、全probe8項目/aube native一致/pitchfork品質回帰、host全heap上限、実公開、CI、負荷/性能計測、任意悪意JS/guestに対するOS sandbox保証。JIT、core fork/lock変更、guest製品配布、terrarium編集、remote作成、push/publishは範囲外。統合前CIと全体回帰/公開条件はU4へ渡す。旧v4観測は履歴として保持し、現revisionの最終候補とcoverageは別に記録する。stage review・approval・lifecycleはmainが所有する。

## Historical v4 Local Evidence Artifacts

候補manifest `.artifacts/u1-package-v4.manifest.json`、report `.artifacts/u1-coverage-v4/coverage-report.json`、statement metadata `.artifacts/u1-coverage-v4/coverage-metadata.json`、Node realms `.artifacts/u1-coverage-v4/coverage-node.json`、browser realms `.artifacts/u1-coverage-v4/browser-results/**/coverage-realms.json`。これらはmachine-local ignored生成物。command/version/count/候補SHA/coverage/limitationsのversion-controlled要約は本書とmain-verification.md、57件のtargetはtraceability.json。計測結果を速度比較・本番性能・CI合格として扱わない。

## Final Revision Verification

### Checkpoint cleanup oracle correction

検証済み：変更はtests/package/consumer.test.mjsのみ。旧回収oracleが共有tmpの別ownerの正常削除を誤失敗にすることを実ownerによる決定論的Red（1fail、175.344208ms）で確認した。withCleanupOracleは私有tmpへTMPDIRを一時設定してfinallyで元の存在状態と値を復元する。正常・abort・timeout・disposeの既存4runは、出力中に実loader存在・候補SHA・0700/0400を観測し、settle後に私有領域が空と確認する。別ownerの存在/削除は無関係、私有ownerを意図して残した対照はERR_ASSERTIONとして検出する。全体tmpの古い残存物を勝手に削除しない。

計画時の推測訂正：直接mutation fixtureはresourcesを既に渡し、fixture.disposeもawaitしている。localOwnerの未await回収をこのcallerの原因とは扱わず、冗長な変更をしなかった。元checkpointで消えたdirの所有者は未確認。今回のRedは誤失敗の機構を証明するが元dirの同定を意味しない。

main検証済み：scoped2pass2043.586792ms、v7全Node pack/consumer/nested20pass5741.012833ms。fresh coverage-v9 Node107pass6057.623125ms。Worker追加0、予定26Node realms不変。v8/v9 metadataの13source/instrumented/statement-mapおよびlayout全体がdeepEqual。browser製品・試験が未変更のため、既存v8 browser99passの保存済み収集と新v9 Nodeを結合しreport exit0、1253realm、695/758行91.68%。browserを今回再収集済みとは主張しない。workspace runtime13+README、実tgzはv7 manifestと一致。最新正本は.artifacts/u1-coverage-v9/coverage-report.json、browser provenanceは.artifacts/u1-coverage-v8/browser-results。承認済みv7 checkpoint再検証はレビュー記録後に行う。CI・全体guest・実Safariは未検証。

検証済み：coverage-v8は候補v7の固定13JSを計測し、Node106件（6486.849167ms）と3browser99件（8.3m）が全成功。予定realmを全件照合し1253realm、695/758行=91.68%、閾値80%を通過。source/instrumented/statement-map digestを照合した `.artifacts/u1-coverage-v8/coverage-report.json` が正本。初回coverage-v7はIstanbulのnew FunctionがCSPに拒否され2失敗したため採用せず、globalThis参照へ設定しCSPを変えず再収集した。新helperはESLint成功。

検証済み：最新browser-errorsの15件全成功14.0s（preflight中abort/timeout/dispose、unsupported major、Worker404）。最終候補とworkspace runtime13+READMEの14ファイルdigest一致。今回のloader/removed-cwdの実core RedからGreenを確認し、mode/seed/rollback/reset/補助Worker停止とhost資源解放を検証した。全体CI・実Safari・aube/pitchfork/probe全受入れは未検証。

生成copy v7/v8とpackage staging v7はGit-ignored証拠でありsource-manifestから除外し、candidate/coverage digestを別途照合した。2件の追加FS試験とCSPを守るcoverage設定はmainが補完した。担当agentの最終追記は自動安全判定で中断されたが、既存の保存済み製品修正を検証し、実行結果をmain-verificationへ記録した。新しいcheckpoint検証コマンドはv7用を人間に提示する必要があり、旧v4 proofを流用しない。


## 2026-10-09 browser oracle Retry (Steps44–45)

検証済み：tests/browser/aube-1645.spec.tsの旧0.0.0をfiledep1.0.0/linked2.0.0へ訂正し、4操作command/exit0を明示。Biome単一spec exit0。三browser全6件pass、Playwright exit0、35.1秒、worker1/retry0・840秒・通常purge設定。native出力完全一致をdiagnosticsでも再照合。同aube/core/baselineのSHA不変。証拠 verification/aube-browser-retry-v2/results.json と各diagnostics/log。旧失敗保持。未公開dirty coreの正式pin/clean build、新候補、正式U1/U3/U4レビュー、CI/実Safariは未完了。


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

正式レビュー受付の検査で、生成済みtests/package/fixtures/cpu-ready-worker.jsは無視対象のためsource-manifestへ記載できないと判明した。元のcpu-ready-worker.tsをsource-manifestに保持し、生成JSのbytes照合は保存証拠として保持する。製品/試験ソースや生成物を変更せず、manifestの当該生成JS一件だけを除いた。旧manifestはbefore-source-manifest.jsonに保全済み。
