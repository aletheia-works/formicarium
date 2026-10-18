# U3 install コード実装・検証概要

## 3回目の再開：review-05の指摘の修正（2026-10-17、Steps 16–18）

人間が選んだ修正案 `u3-acceptance-dependency-proposal.md` の案Aで、R-10（Major）とR-11（Minor）を直した。拒否の条件、U3の製品コード、品質基準は変えていない。
- R-10：受け入れるunitの一覧 `INSTALL_REGRESSION_UNITS`（`u3-install`・`u4-command`）と、source一覧の選択 `installCandidateInventory` を、U3の `scripts/migration-install/stage.ts` に置いた。U3の候補は、常にU3の `installSourceInventory` と照合する。呼出し側が一覧を渡しても、U3の候補の照合先は変わらない。U4の候補は、呼出し側が `commandSourceInventory` を渡したときだけ照合でき、渡されなければ拒否する。ほかのunitは拒否する。`checkInstallCandidate`・`runInstallCompletion`・`measureInstall` は、このoptionを受け取って渡す。U3のCLI（`completion.js`・`measure.js`）はoptionを渡さないので、`u3-install` の候補だけを受け付ける。`checkInstallCandidate` は、unitの照合のあとで一覧を選ぶ（ほかのunitは、従来どおり「current U3 candidate identity missing」で拒否する）。U3の `completion.ts`・`coverage.ts`・`measure.ts` から `scripts/migration-command/` へのimportをなくし、moduleの循環を解いた。依存はU4→U3の向きだけになった。
- R-11：`installReportScope(candidate.unit)` で、completionのreportの `unit`・`laterUnits` と `incomplete.json` の `unit` を、候補のunitに合わせた。measureのreportの `unit` は、U4の入口が照合する値なので、このStepでは変えていない。
- U4側：U4のfileは変えていない。U4の `scripts/migration-command/stage.ts` にある同名の定義は、U3からは使わない。U4の入口がU3のmeasure CLIをU4の候補で起動する経路（U4 `completion.ts` の `measure` 工程）は、optionを渡せないため、U4の計画の項目（U4の薄いCLIから `measureInstall(out, root, { commandSourceInventory })` を呼ぶ）を実施するまで、U4の候補では拒否される。これはU4の作業の途中の状態である。
- 試験（`tests/migration-install/acceptance.test.ts`、4件を追加）：U3の入口がU4のmoduleをimportしないこと、U3の候補はU3の一覧に結び付き、U4の候補は一覧が渡されなければ拒否し、ほかのunitも拒否すること、`checkInstallCandidate` がU4の候補を一覧なしでは拒否し、ほかのunitを先に拒否すること、reportのunitと `laterUnits`。
- RED（main、Node v26.12.0）：`mise run build` がTS2305（`installReportScope`・`INSTALL_REGRESSION_UNITS`・`installCandidateInventory` がない）で失敗した。GREEN：`mise run build` exit 0。`node --test --test-concurrency=1 tests/migration-install/acceptance.test.js tests/migration-install/lifecycle.test.js` は50件pass（追加の4件を含む）、fail・skip 0。
- Biome：変更した行に新しい指摘はない。残る指摘（`acceptance.test.ts` のuseTemplate 4件、`completion.ts` の既存のformat・import順・制御文字の正規表現）は、変更前からあるもので、変更範囲を守るため直していない。
- source-manifest.json：変更したfile（stage・completion・coverage・measureと生成JS、acceptance試験と生成JS）は既にclaimしている。追加はない。traceability.json：既存のBR3.10・FR6の行が覆う。行の追加はない。

## 2回目の再開：U4の変更の引受け（2026-10-17、Step 14）

U4の追加Step項目3・4で、U3がclaimするfileが変わった。人間の判断で、この変更をU3の変更として引き受けた。U3の製品コード（runtime/install*.ts）は今回も変わっていない。
- `tests/migration-install/lifecycle.test.ts`：模擬portに `resolvePath()` を加えた。呼ばれたら `unexpected resolve` で失敗するので、installの経路がpathの解決を使わないことを、試験が引き続き確かめる。U2がC02に `resolvePath` を加えたこと（U2 BR2.12）に型を合わせるためだけの変更である。
- `scripts/migration-install/completion.ts`・`coverage.ts`・`measure.ts`（と生成JS）：候補のunitとして `u3-install` と `u4-command` を受け付ける（`INSTALL_REGRESSION_UNITS`）。source一覧は候補のunitで選ぶ（`candidateSourceInventory`。U3の候補はU3の一覧 `installSourceInventory`、U4の候補はU4の一覧）。fileを読んで確認した点：ほかのunitは `undefined` を返し、その直後のunitの照合で拒否される。sourceの一覧とsourceIdentityの完全一致、配布一覧とPACKAGE_FILESの完全一致、coverageの `threshold` 80と分母の件数（`FIRST_PARTY_JS.length`）の照合は残っている。拒否の条件は緩めていない。
- 依存の向き：U3の入口は、U4の `scripts/migration-command/stage.ts` から上の2つをimportする。U3単独の受入の判定は、U3の分岐（`installSourceInventory`）だけを使う。`stage.ts` はU4のfileなので、U3のsource-manifestには加えない。
- `tests/migration-install/consumer.test.ts`・`consumer.spec.ts`・`hash-regression.spec.ts`：候補のunitとして `u3-install` か `u4-command` を受け付ける。`tsconfig.tests.json`：通常のbuildから `tests/migration-command/types-invalid.ts` も除外する（U3の `types-invalid.ts` と同じ扱い）。
- `tests/package/coverage.test.ts`：件数（23件）と名前の一覧は、U1のStep 18・U2のStep 16と同じ変更である。
- source-manifest.json：上のU3のfileはすべて既にclaimしている。追加はない。traceability.json：既存の行（FR4・FR6・BR3.10など）が今回の変更を覆う。行の追加はない。
- mainの観測（2026-10-17、Node v26.12.0）：`mise run build` exit 0。`node --test --test-concurrency=1 tests/migration-install/lifecycle.test.js tests/migration-install/acceptance.test.js` は46件pass、fail・skip 0。
- 最終的なsourceでのU3の正式36試行・専用CI・完了確認は、U4の後に、U1〜U4のまとめた確認の中で行う。それまでは、U3の受入結果を変更後のsourceの成功証拠として扱わない。

## 今回の再開：U4の作業を戻した後（2026-10-17、Step 12）

U3のレビューの後、U3がclaimする共有fileが3つの理由で変わった。
- 一時的に外していたU4の作業を戻した。
- AI-DLCを2.11.1-preview.20261016.1に更新した（人間の承認済み）。
- U4の追加Stepで決めた修正のうち、2件を先に入れた。`tsconfig.json` のincludeにU4のbrowser型宣言を加えた。`scripts/terrarium/coverage.ts` を `mode:'strip'` にした。

変わったfileは次のとおり。`runtime/public.ts` と `types/index.d.ts` は追加だけである。
- `package.json`：files、@types/node 26.6.5
- `bun.lock`
- `runtime/public.ts`：`createCommandSession` のexportを1行追加
- `types/index.d.ts`：C05の型を追加
- `scripts/package/stage-package.ts`・`coverage-inventory.json`：配布JSが23件になった
- `tsconfig.tests.json`・`README.md`
- `mise.toml`：U4のtaskと、AI-DLCのpin

mainは、`jj diff --from 7c7ceaf4` でU3の製品コード（`runtime/install.ts`・`install-catalog.ts`・`install-transfer.ts`・`install-archive.ts`・`install-lifecycle.ts`）の差分が0件であることを確かめた。C04の `createInstaller`・`Installer`・`InstallResult` の型（`types/index.d.ts`）も変わっていない。

U3の受入は、U4の作業を戻す前のsourceに結び付いている。対象は、CI 38948209404、ローカルの正式36試行、`verify-toolchain-u3.mjs` による完了確認である。その完了確認は、封印したsourceとの一致を求めるので、今のsourceでは通らない（330件のはずが334件）。人間の承認により、intentの検証コマンドは、U1の試験を今のsourceで実行するコマンドに置き換わった。

最終的なsource（U4を含む）での確認は、U4の作業がすべて終わった後に、U1〜U4のまとめた確認の中で行う。U3については、単体・browser・consumer・coverage・正式36試行・専用CIを確かめる。新しい検証コマンドもそのときに決める。それまでは、U3の受入結果を、変更後のsourceの成功証拠として扱わない。

## Status

2026-10-17 最新toolchain更新（人間が改訂計画を承認、検証済み）：Node.js 26.12.0、Bun 1.4.3、@playwright/test 1.64.1（Chromium 1248、Firefox 1555＝157.0、WebKit 2370）へ全リポジトリの版固定を更新した。ソース境界は、人間が `.aidlc-source-paths.json` に `.artifacts/` を追加して解消した（doctor problem 0）。

- RED：旧toolchain（Node 24.21.0/Bun 1.4.2）で build 後、U3 runner-ready 3件中2fail（actual 24.21.0／expected 26.12.0、packageManager）、U1 runner-ready 3件中1fail（Bun 1.4.2／1.4.3）。GREEN：新toolchainで両方3/3、typecheck exit0。
- 開発担当の変更は、mise.toml、package.json、scripts/ci/tasks.ts・ordinary-receipt.ts、U2/U3 ci.ts、scripts/maintenance/bundle.ts・receipt.ts・reproduce.ts、scripts/release/bundle.ts・publication-evidence.ts、.github/maintenance/policy.json（toolchainRevision と ci.yml の workflowDigest）、.github/publication/trusted-policy.json、workflow 8本、README.md、tests/tooling 8本、timings-valid.json、runner-ready 2本、source-manifestの48 path追加。mainは `bun install`（bun.lock 更新）、`mise run install-frozen` exit0、Playwright browser導入、`.github/maintenance/runner.mjs` の再生成（検証と同じ bun build＋Biome）、`scripts/release/bundle.js generate`（runner.mjs・runner-manifest.json）を実行した。差分は版文字列だけだった。
- generate は、PATH上のnodeがmise shimで、HOME=root のBiome起動が失敗する（BUNDLE_TOOL_FAILED）。実体のNode 26.12.0 binを先頭にしたPATHでexit0となった（環境上の問題で、コード変更なし）。
- 回帰（Node 26.12.0）：test-light 194＋237件 fail0（手動実行の2skipは U2_ACTUAL_SITE 未設定による。completion経由では0skip）、U2 ci＋U3 acceptance 45/45、tests/tooling 18ファイル 237/237。
- 新CI入力：旧ci/migration-installを `.artifacts/migration-install/ci-inputs-before-toolchain-F02C8CF8-9D70-44E9-819E-F7C642FD65C9` へ退避し、prepare/inspect/restore exit0。22件・254668126bytes。
- 新候補：`.artifacts/migration-install/candidate-3e5449bb-df1e-4017-87ae-a68a0cbdb225/package.manifest.json`、source=54da5b2273520d3fd8f3c0ec154ce62649623bbf2c4e9d595afd86b0b6378594、pack=1a8cd787d563ef48a3400bd69a803118d91fe351ec7bd0a9a7af1727857b2e95。変わった配布fileは package.json（packageManager bun@1.4.3）と README.md（版表）の2件で、他の29件はbytes同一。consumer `/private/tmp/formicarium-u3-toolchain-consumer-20261017`。
- 全18工程：`.artifacts/migration-install/completion-14c78419-d169-4f0b-a917-93fa5e131786` で工程1–18全exit0。1768/1929=91.65%、skip0、1495realm（runner12）、計測付きNode 115/115×2、browser 99/9/9。第19工程は証明書なしで開始前に拒否された（設計どおり）。
- ローカル正式36試行（人間承認後）：`.artifacts/migration-install/formal36-toolchain-20261017/measurement-report.json` SHA256=8b6a37873109b0ddb2b548150db41a9c4b8f817950ba55468e2a91e5e122f7b1。passed=true、36trial全exit0/CORS。中央値(ms)は aube Chromium765.44/Firefox1808.88/WebKit757.84、Biome Chromium971.78/Firefox2720.18/WebKit1096.22。終了後に削除し、find exit44を確認した。
- 署名付きpush（人間承認後）：commit 7c7ceaf47504ec7c3c915ac8f463b11032480d48（41個別file、親6dc9c43a）、GitHub verified=true/valid。追跡240件はinventory SHA一致。他workflowのtriggerは別branch・main・tag・PR・dispatchのみで、起動はU3 workflowだけ。
- CI run 38948209404 attempt1：success（全step成功）。ZIP `.artifacts/migration-install/ci-38948209404-artifact` の measurement-report は passed=true、36trial、source 54da5b22…、全exit0/CORS passed。中央値(ms)は aube Chromium1184.00/Firefox2032.98/WebKit1175.84、Biome Chromium1446.22/Firefox2775.52/WebKit1437.06（前回CI Firefox155の3006.24msから改善、≤3000）。coverage 1768/1929=91.65%、1495realm。3suiteそれぞれ台帳4行と8 receiptがZIPに含まれる。その後の独立照合（検証済み）は次のとおり。
  - API・ZIP：GitHub REST の run・attempt1 jobs・commit・artifacts の応答と、artifact ZIP（id 12068473592、426065bytes、SHA256 2f9b4a4d…）を `.artifacts/migration-install/toolchain-ci-38948209404/` に保存した。API digestとsizeはZIPと一致し、署名前のf284e274と署名後の7c7ceaf4はtree e7d252dcで同一だった。
  - export検証：f284e274を `git archive` で `.artifacts/migration-install/ci-source-preview-f284e274eeea` へ書き出した。build exit0、330 sourceはidentity 54da5b22でmanifest・作業コピー・候補と一致、restore exit0、実配信試験8pass/0fail/0skip。receiptは `toolchain-exported-commit-inventory-f284e274.json`、`toolchain-signed-push-38948209404.json`、`toolchain-trust-cleanup.json`。
  - 18工程の再実行：`run-toolchain-regressions.mjs` exit0、`.artifacts/migration-install/toolchain-regressions-57d0a06e-952c-4c2e-8854-a6673fc0e7e6/regression-report.json`（SHA256 31d4cd7f…）。
  - verifier：新しい `.artifacts/migration-install/verify-toolchain-u3.mjs` を作った。旧verifierを土台に、Node 26.12.0、新しい固定値、CA cleanup step名、Playwright runnerの台帳・begin/endの独立照合（local・CI ZIPの両方）を加えた。初回はinstrumented digestが不一致だった。旧来のplain Istanbul出力からhashを計算していたためで、現行collectorの `directStatementSource` 変換後のhashへ修正した。あわせて、Node 26が未定義の assertion message を拒否して不一致を隠す問題も直した。修正前のbindingは `-superseded-1.json` として保持している。
  - 改変拒否試験：`verify-toolchain-u3.test.mjs` は16/16 pass、skip0。
  - sealed binding：`toolchain-u3-binding-38948209404.json` SHA256=9abbceb875bddfa1ed61d8fe2963dfdc90f168cd837b35387256e65ef0102447（local証拠204件）。
  - 完了確認コマンド `node .artifacts/migration-install/verify-toolchain-u3.mjs <binding> 9abbceb8…` はexit0。結果は `verified: toolchain-u3-completed-with-independent-ci`、`acceptancePassed: true`、署名検証済み、runner realm local12/CI12、coverage local/CIとも91.65%、formal36 local/CIともpassed、`realSafari: 未検証`、`laterUnitAcceptance: false`。
  - 残り：独立レビュー、完了確認コマンドの人間承認、Unit checkpoint。

2026-10-16 CI 38898228292のFirefox TLS修正（人間が改訂計画を承認、検証済み）：ソース境界の上限超過は、人間が作成した `.aidlc-source-paths.json`（`{"version":1,"exclude":["ci/migration-install/payload/","ci/migration-session/payload/"]}`）で解消し、doctorはproblem 0。この間、人間の指示でplan approvalを一時offにし、作成後にonへ戻した。開発担当は tests/migration-install/acceptance.test.ts、scripts/migration-install/measure.ts、.github/workflows/migration-install-u3.yml だけを変更し、生成JSはmain buildが作成した。

- RED：`mise run build` exit1（acceptance.test.ts 48–50行のTS2305、未exportの3関数）。GREEN：build/typecheck exit0、acceptance 35/35（既存33＋新2）、fail/skip 0、対象2TSのBiome error/warning 0。
- measure.tsは `FORMICARIUM_INSTALL_FIREFOX_PROFILE` 設定時だけ、計測前に絶対path・実directory・非symlink・cert9.db regular fileを検査し、Firefoxを `launchPersistentContext` で起動して、その `browser()` から試行ごとに `newContext({ignoreHTTPSErrors:false})` を作る。未設定時は従来のlaunch。
- workflowはjob CA（CA:TRUE、pathlen0、nameConstraints DNS:localhost）と署名済みleafを作る。CA秘密鍵は署名直後に削除する。CAをシステムCA・nssdb・job専用Firefox profileへ 'C,,' で登録し、cleanupで削除と不在確認を行う。
- Docker（Playwright v1.63.0 noble、arm64）でworkflowの作成stepとcleanup stepをそのまま抽出して実行した。Chromium・Firefox（persistent profile）・WebKitで各2context、TLS 1.3・subject localhostで成功した。cleanupはexit0で、job CAはシステムbundleに残らなかった。`/etc/ssl/certs` に削除済みcrtを指すdangling linkが2つ残る（旧workflowと同じ挙動、変更なし）。x86_64 runnerでは未検証。
- 新CI入力：旧ci/migration-installを `.artifacts/migration-install/ci-inputs-before-firefox-tls-F31AD32B-5134-4D6A-88CF-8C321593480C` へ退避し、prepare/inspect/restore exit0。22件・254668126bytes、manifestSha256=7e3d377a8d179d557273560feeeba6f80458df402dfab9719070f28d0af644da。
- 新候補：`.artifacts/migration-install/candidate-aa88c725-629d-40fc-9e68-84a6ece6165d/package.manifest.json`、source=cf637f9a8e7e030dbe8190dc2bb4add7202e16ab9c44c1d46d0d1a422e2eb9ca、pack=cc89a7dc…（不変）、consumer `/private/tmp/formicarium-u3-firefox-tls-consumer-20261016`。
- 全18工程：`.artifacts/migration-install/completion-679ff1e1-9e6b-4f1a-83f4-73a45d9e9f6f` で工程1–18は全exit0。1768/1929=91.65%、skip0、1495realm（runner 12）、計測付きNode 115/115を2回、計測付きbrowser 99/9/9。第19工程は証明書なしで開始前に拒否された（設計どおり）。
- ローカル正式36試行（人間承認後）：`.artifacts/migration-install/formal36-firefox-tls-20261016/measurement-report.json` SHA256=c5d94d476984ec823c1d58ae52268ee7d2f8b98c1b433079942f4114d0b622df。passed=true、36trial全exit0/CORS passed、source cf637f9a…。中央値(ms)は aube Chromium774.78/Firefox1877.60/WebKit737.50、Biome Chromium1105.41/Firefox2608.64/WebKit1115.72。終了後に削除し、find exit44を確認した。
- 署名付きpush（人間承認後）：commit 6dc9c43aa442a6507f6e2aa7c3eea1857a679472（6個別file、親5cc071ce）。origin headと一致し、GitHub verified=true/valid。追跡240件はinventory SHA一致、残り90件は生成JS。
- CI run 38909083334 attempt1：failure。工程1–18は全exit0。第19工程はFirefoxを含む36trialが全てTLS検証ありで実行され、exit0/CORS passedとなった（Firefox TLS修正はCIで有効、検証済み）。しかし、Biome/Firefoxの非download中央値が3006.24ms（>3000ms、超過6.24ms）で不合格になった。他の組の中央値は aube Chromium1271.69/Firefox2150.10/WebKit1371.44、Biome Chromium1636.88/WebKit1769.38。Biome/Firefoxのphase中央値は validate1875.7/run941.1/digest170.3/register15.2/fetch253.1（fetchは除外）。ZIPは `.artifacts/migration-install/ci-38909083334-artifact`。承認されたCI1回は消費済み。基準は緩めない。対応は人間確認待ちで、U3完了ではない。

2026-10-16 独立起動台帳・CI生記録添付（Claude sessionで再開、検証済み）：開発担当は承認済み範囲の scripts/package/coverage.ts、tests/package/coverage.test.ts、tests/migration-install/acceptance.test.ts、.github/workflows/migration-install-u3.yml だけを変更し、生成JSはmain buildが作成した。生成bootstrapは製品import・counter初期化・begin書込みより前に `coverage-playwright-node/<suite>/launches.jsonl` へO_APPENDの1回writeで1recordを追記し、短書込みはthrowする。readPlaywrightNodeRealmsは期待集合を台帳から作り、suite directoryが台帳全pidの1begin/1endと台帳だけであること、各行の完全一致・pid重複なし・末尾改行・ppid一致を要求する。workflowは既存pathを保持して generation JSON・`coverage-playwright-node/**/*.json`・`**/*.jsonl` の3行を追加した。source-manifestの7個別claimは既存で、追加不要だった。

- RED（main観測）：build/typecheck exit0後、package coverage 22件中21pass/1fail（新試験の両receipt欠落runner拒否でMissing expected rejection）、acceptance 33件中32pass/1fail（launches.jsonl ENOENT）。
- GREEN（同じコマンド）：build/typecheck exit0、package coverage 22/22、acceptance 33/33、fail/cancel/skip/todo 0。対象3TSのBiome checkはerror/warning 0（既存style info 8）。共有回帰 tests/migration-preflight/current-completion.test.js 19/19、tests/migration-session/ci.test.js 10/10。
- 3suite入口確認：旧candidate-1ecf1f44（同pack cc89）で新規 `.artifacts/migration-install/ledger-preflight-20261016` をprepare、実Playwright --list package99/session9/install9 各exit0。各suiteの台帳1行と1組のbegin/end、strict validatorが3 realm（各2030counter）を受理。
- 新固定CI入力：旧ci/migration-installを `.artifacts/migration-install/ci-inputs-before-ledger-3DA6B014-D02A-4020-A92B-7F0118631B7C` へ退避後、prepare/inspect/restore exit0。22 logical files・254668126bytes（上限268435456以下）、manifestSha256=7d1351d80a8900af2f681b8bb982555d5c7f1a9695976ddeca591596ee1a6d5a。
- 新候補：`.artifacts/migration-install/candidate-412ee2fa-59f3-4e47-ade2-a9edc7f0fa5e/package.manifest.json`、source identity=ec7fc54a31c3096cbd65f25c277ea505944daf1c65e5979ebf27a05653d28229、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2（製品bytes不変）、独立consumer `/private/tmp/formicarium-u3-ledger-consumer-20261016`、context `.artifacts/migration-install/ledger-local-context-20261016.json`。
- 全18工程（`mise run migration-install-completion`、FORMICARIUM_INSTALL_LOCAL_ONLY=1）：出力 `.artifacts/migration-install/completion-483ce810-ec55-4be9-98e3-f19080d2d7c3`。工程1–18は全exit0。21JS 1768/1929行=91.65%、skip0、1495realm（Playwright runner 12、各suite台帳4行と4組のbegin/end一致）。計測付きNode 115/115を2回、計測付きbrowser 99/9/9 pass。第19工程の正式36試行は証明書入力がないため開始前に拒否された（no trust changes）。これは設計どおりの停止であり、36試行の成功ではない。
- 正式36試行（人間承認後にmain実行、検証済み）：`run-ledger-formal36.sh` exit0、`.artifacts/migration-install/formal36-ledger-20261016/measurement-report.json` SHA256=f69717aa0d7ee880bced58d01b9b0ab9bd7229f454d12b7effceb7cb5edc053a、passed=true、36trial全exit0/CORS passed、source ec7fc54a…/pack cc89。非download中央値(ms) aube Chromium887.42/Firefox2116.68/WebKit736.46、Biome Chromium1384.84/Firefox2712.46/WebKit1086.18（最大2712.46≤3000）。終了後trust/証明書削除、find exit44で未登録を確認。realSafari=未検証。
- 署名付きpush（人間承認後）：commit 5cc071ce77d3a36d355c346acf54d09b0f79d8d3（13個別file、親c30e2a9b）、origin codex/terrarium-migration-u3 のheadと一致、GitHub verification verified=true/reason=valid。追跡fileは全てCI入力のsource inventory SHAと一致（未追跡は生成JS 91件のみ）。
- CI run 38898228292 attempt1：failure。工程1–18は全exit0（CI上でも21JS 1768/1929=91.65%、1495realm、各suite台帳4行と4組のbegin/endをZIPで確認）。第19工程の正式36試行はChromium 12trial成功後、Firefox最初の `page.goto https://localhost:4182/` が `SSL_ERROR_UNKNOWN` で失敗した。measure.tsはFirefoxを `security.enterprise_roots.enabled` で起動する。workflowはjob証明書をシステムCAと `~/.pki/nssdb` に登録するが、Playwright Firefoxの専用profileはそれらを参照しない可能性が高い（推測・未検証）。CIが計測工程へ到達したのは初回で、この経路は未検証だった。失敗ZIPは `.artifacts/migration-install/ci-38898228292-artifact`、失敗ログは `.artifacts/migration-install/ci-38898228292-failed.log` に保存した。承認されたCI1回は消費済み。修正・再試行は人間確認待ちで、U3完了ではない。
- 正式36試行のwrapper `.artifacts/migration-install/tls-sha-20261015/run-ledger-formal36.sh` の `--check` はexit0。証明書SHA256=45d29b3d…3e22、期限2026-10-17T03:26:40Z、keychain未登録を確認した。登録・計測は人間承認待ち。新CI・独立ZIP照合・再レビュー・正式完了確認も未実施。

2026-10-16 新bootstrap sourceの全ローカル回帰（検証済み）：mainの全18工程がexit0で完了した。reportは .artifacts/migration-install/node-bootstrap-regressions-b87a770b-ed05-4b98-a9fe-e5718b33d29f/regression-report.json、SHA256=e99943b568cc6a3db9f408e475a9b3e236780940f3f1808a4091b61b56d882d9。source=b608b2f3c969cf1e85c5f98245d45acaf0af53dae575167b64e7b4e624e75932、pack=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2（製品bytes不変）。全21JSの行coverage1768/1929=91.65%・skip0、1495realmsを保持し、共通strict validatorは3suite各4件・計12実Playwright processの全開始/終了receiptを受理した。

command14の合同Nodeは115pass・0skip、192909.215958ms。旧CI失敗test25/test27はそれぞれ68685.439209ms/16482.180709msで成功した（試験全体時間でありinstall期限は不変、CI改善の証明ではない）。command15はpackage browser99pass/9.1分、command16はU2 browser9pass/1.2分、command17はU3 browser9pass/2.8分。新sourceの正式36試行・新CI・正式受入れ・mergeはpending。証明書wrapperのread-only --check成功は登録/36試行の実施を意味せず、mainが具体コマンドの人間承認を待つ。NFR2.2のGAPは維持する。以下の対象検証/preflight/旧source結果は履歴として保持する。

2026-10-16 Playwright Node bootstrap修正の対象検証（検証済み）：mainが実Node子processでwriter未初期化のREDを観測後、承認済み5TS内で3suiteの先行bootstrap・独立runner buffer・開始/終了raw receipt照合と全realm mergeを実装した。追加時のRealm.buffer型推論のbuild失敗は人間承認後のRealm[]注釈で修復し、生成template内regex escapeによる子process構文エラーも人間承認後にdirname(fileURLToPath(import.meta.url))比較へ修復した。厳密なoutput identity条件は維持した。mainの対象5TS整形・build/typecheck後、coverage21件+acceptance33件の計54pass・0skip（4381.659792ms）を観測した。

検証済みの入口確認：.artifacts/migration-install/node-bootstrap-preflight-20261016 で実Playwright --listがpackage99/session9/install9を発見し各exit0。共通readPlaywrightNodeRealmsも3suite照合exit0、playwright:package:10219、playwright:session:10228、playwright:install:10233の3実process・各2030counterを確認した。これは旧candidate/同pack cc89を使う独立preflightであり、現在sourceの全回帰・正式受入れではない。新source/input/candidateの全18工程・21JS全realm coverage・新正式36試行・CI・正式完了は未実施。

source-manifestへ不足していたscripts/migration-session/coverage.tsと対応main生成JSの2個別パスだけ追加し、既存110を保持して計112write pathsとした。新手書きmodule・依存・品質基準変更はない。下記の途中状態と失敗/成功証拠は履歴として保持する。

2026-10-16 直接counter生成修正の対象検証（検証済み）：承認後、mainが実instrumented fixtureのREDを観測した（18件中17pass・1fail、statement property read実48/期待0。記録 .artifacts/migration-install/direct-counter-red-20261016.json）。初回実装のbuildはTypeScript7.0.2のroot exportにcompiler APIがなく失敗した。人間が修正・再検証を承認した後、既存Istanbul依存のBabel parser/types/generatorへ変更し、新dependency/moduleは追加していない。mainのbuild/typecheckはexit0、coverage回帰20/20pass・0skip（504.952875ms）、U3 acceptance32/32pass・0skip（949.811042ms）。実fixtureで全statement counter/Atomic書込み列、prefix/postfix返値・順序・例外・function/branch counts、飽和、非対応形拒否、realm独立性とWorker終了後host可視性を検証した。

この直接生成修正後のsource確定・全18工程・全21JS coverage・正式36試行・新CI・正式完了確認は未実施で、U3は暫定状態。mainが対象TSをformatし再build/再検証してから新sourceを固定する。install180秒ほか品質基準は不変。以下のsource8897とCI失敗、旧ローカル成功は修正前の履歴として保持する。共有4個別TS/JS pathは既存source-manifestに含まれ、そのファイルは変更していない。

2026-10-16 CI最終結果（検証済み）：run38784488074・attempt1は39分4秒でfailure。追加push・再試行は行っていない。command14のinstrumented combined Nodeは115件中114pass・1fail・0skip。test25は成功（719975.642834ms、複数install/runを含む試験全体）、test27だけが初回install待機中に180681.584382msでInstall deadline/TIMEOUTとなった（install.js:1252、validateGuest/yield後、試験line149）。180秒の期限は変更していない。incomplete.jsonのobservedCommandsは13。CI browser coverage・最終report・formal36には到達せず、cleanup/uploadは成功した。ローカル18工程・正式36試行の成功証拠は保持するが、CI成功・U3完了は主張しない。

独立取得した失敗CI資料：.artifacts/migration-install/ci-failed-38784488074-1/artifact.zip（143386bytes・22members、SHA256=74b190b75dd24923d094583fe19587cd1e25904fb4f0e885cbc6caa93dbc396d）、同ディレクトリのjob.log、およびmembers/migration-install/completion-fe92ef9c-05bc-4928-929f-4fbabf00e9ec/incomplete.json。API照合済みZIPとしてmainが保存した。新pending bindingとread-only helperは合格証拠へ変更せず、原因調査中である。

現在の作業はCI run38766787639の計測付きNode TIMEOUTに対する共有collector修正。mainがRED（13tests・12pass・1fail、Atomic.load増分2049/期待0、全2048counter/store値一致）を観測し、承認済みのgetter局所値・毎setter Atomic.storeへ最小変更した。検証済み：対象coverage17件・acceptance32件・実配信8件に加え、新候補の全18工程exit0、全21JS coverage1768/1929=91.65%・skip0、正式36試行成功（最大組中央値2633.08ms）。証明書一時登録・計測・削除wrapper exit0、別途find exit44で未登録確認済み。source8897cea442a680b469c474b0a8164175b5499a48f200cc1bd6eb8f7f4054967c、manifest f229d672ea9093659447a32b98af33031a384937c69ddb82d2955ef2f5e689f5、候補814696a5、pack cc89（製品bytes不変）。追加署名付きpushは成功したがCIはfailureで、U3正式完了ではない。詳細は [collector-single-writer-recovery.md](collector-single-writer-recovery.md)。以下のeb50 source・ccbd headのローカル成功は修正前の履歴として保持する。

2026-10-16更新。検証済み：CI入力修正後の新候補について、mainの非TLS18工程は全exit0。全21JSの行coverageは1768/1929=91.65%、skip0。固定サイト復元と実配信8pass・skip0、同source/packの正式36試行も成功し、6組すべての非download中央値が3000ms以下。mainの証明書一時登録・計測・削除wrapperはexit0、削除後の未登録も確認済み。署名付きU3 CI・独立最終レビュー・正式完了確認は未完了で、U3正式受入れの完了は主張しない。実機Safariは未検証。

検証済み：人間承認後、mainが追加署名付きpushとCI再試行1回を実行した。signed head=c30e2a9b90eabaa35a2fd9ee51d313209ce9290e、GitHub verified=true/reason=valid、署名前後のtree=5cf3a2327c348bcb9c738e347fd8f63c84bd1a55は一致する。run38784488074・attempt1・job116592855385は途中観測時点でin_progress（最終結果はfailure、後述）。準備・build・typecheck・入力復元・core・独立consumer工程は成功したが、この途中観測後、CI全体はfailureで終了した。push記録は .artifacts/migration-install/collector-signed-push-38784488074.json。

検証済み：mainが新verifierを実行し11pass・0fail・0skip。実ローカル証拠のpositive componentは16.97秒で成功しacceptancePassed=falseを維持、同じpending bindingのwhole acceptance拒否も確認した。記録は .artifacts/migration-install/collector-verifier-tests-20261016.json。CI成功・独立レビュー・正式完了確認は未完了で、U3完了とはしない。

## Files Created or Modified

- scripts/package/coverage.ts/生成JS、tests/package/coverage.test.ts/生成JS：共有bridgeの単一writer確認に基づくgetter Atomic.load反復削減と、counter列・realm独立性・中断後host可視性の回帰。生成JSはmain buildだけで更新する。U3 manifestへ4個別パスを追加した。

- runtime/install-catalog.ts、install-transfer.ts、install-archive.ts、install-lifecycle.ts、install.tsと各生成JS：caller catalogの固定snapshot、有限HTTPS取得、全archive検査、取消・通知・原子的登録。
- runtime/public.ts/生成JS、types/index.d.ts：既存公開entryからC04を公開し、内部SessionPortを非公開のまま利用。
- runtime/guest-validation.ts/生成JS：承認済みStep 7のSHA256状態読出し・更新だけを最適化。8要素の直接読出しと直接加算へ変更した。
- package.json、scripts/package/stage-package.ts/生成JS、coverage-inventory.json：installの5個のJSを含む21配布JS・31packファイルの固定一覧。
- scripts/migration-installのstage/completion/coverage/measure/ci/ci-inputsと生成JS、専用workflow、mise.toml、tsconfig.tests.json：独立候補、固定入力、逐次実行、全realm収集、36試行、専用CIの入口。mainがCI入力bundleをprepare/inspectし成功した。
- ci/migration-install/inputs.bundle.jsonとpayload21bin、ci/migration-session/inputs.bundle.jsonとpayload18bin：固定core/guest等と追加圧縮サイトの再現入力。従来の40ファイルに新archiveのblob1件を追加し、計41個別CIパスをclaimする。新blobのjj追跡はmain側の確認事項。
- tests/migration-installのcatalog/transfer/archive/lifecycle/public/consumer/runner/acceptance/型fixtureと生成JS：部品別境界、独立tarball consumer、型契約、検証入口。
- hash-regression.test.ts/生成JS、hash-regression.spec.ts/生成JS、browser-modules.d.ts、playwright.config.ts：Node crypto/WebCryptoの独立照合と境界・非破壊回帰。

- README.md、docs/install-api.md：実装済みのC04 API、caller catalog、取得・上限・取消・進捗・エラー・利用例と未完了の受入範囲を説明。READMEのinstallを後続扱いする文を更新し、U4 commandは後続のまま保持する。

個別の実ファイル112件（共有collector変更4件、追加U2 collector2件、.gitignore、CI入力41ファイルを含む）をsource-manifest.jsonに列挙した。ディレクトリ・glob・.js.mapのclaimはない。JSはmainの承認済みbuildが生成し、手修正していない。.gitignoreにはU3生成JS24個の個別例外を追加し、U2既存例外と.js.map除外を維持した。従来の対象生成JS27個とCI入力41ファイルの追跡観測は保持し、最新共有変更の追跡確認はmainが行う。Step 11全体は未完了である。

## Implementation Decisions

ドキュメント根拠：C02の予約・epoch・cleanupを所有者へ委任し、public登録への再acquireを避ける。catalog/metadataをcopy・検証し、HTTPS credential omit・有限redirect・受信上限・deadlineを維持する。tarはホストFSへ展開せず全entryとリンクを検査する。失敗前の旧guestを保持し、真正C03 handleだけをcommitする。

Step 7では64round、全block、padding、endianness、全ELF・metadata hash、所有copy、buildKey照合、同期C03、private brandに変更を加えていない。Node14件と各browser12件の新SHA回帰は最適化後に作成した（tool-produced Testing Contractのtest-after）。README更新前候補の実36試行は下記の全中央値3秒以下を観測した。文書更新後の候補へ自動適用しない。

Node unit入口は個別8ファイル、通常browser入口はconsumerとhash-regressionの2specへ整合。instrumented NodeにもSHA回帰を加えた。instrumented browserは既存consumer collectorと固定realm期待集合を維持し、独立SHA照合は通常browserで実行する。coverage除外・品質限界の緩和は追加していない。

## Test Coverage Summary

次はmain sessionが逐次実行し、本担当へ報告した観測結果である。本担当はbuild/testを実行していない。

| 実行 | 観測結果 |
|---|---|
| mise run build | exit 0 |
| mise run typecheck | exit 0 |
| U3 runner-ready | 3 pass |
| Node独立SHA回帰 | 14 pass |
| 共有C03/fixture/public・U3 public/acceptance | 47 pass |
| U3 unit aggregate | 74 pass、fail/skip 0 |
| U3 browser consumer + SHA、Chromium/Firefox/WebKit | 45 pass、42.2秒 |

browser初回はsandboxの起動制限Permission denied (1100)により45件失敗した。製品成功へ数えず、mainが人間の承認後に同候補・ホスト権限で再実行し45件成功を確認した。

SHA回帰は空/abc/既知multi-block vector、55/56/63/64/65と127/128/129byte境界、65537byte binary、offset付きview、入力非破壊を独立実装で照合する。Nodeでは100万aの既知vectorも確認した。consumerは実ELF/archive導入、取消、競合、偽造session等の既存試験を継続する。

## Candidate and Evidence Boundary

正式36試行は .artifacts/migration-install/formal36-reference-20261016/measurement-report.json、SHA256=68b35055713621e07de6ac57851e1a096ba973ff2a05d0faf776330db9bdd975。recordedAt=2026-10-15T16:03:26.594Z、source identity=eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2、trialCount=36、passed=trueをread-onlyで確認した。全trial exit0/CORS passedで、mainはTLS検証を省略せず実行。非download中央値(ms)はaube Chromium785.73/Firefox1747.50/WebKit752.08、Biome Chromium1053.685/Firefox2661.84/WebKit1045.94。mainのrun-reference-formal36.shはexit0、Temporary localhost trust/certificate removedと削除後find exit44を確認し、現在有効な登録・実行待ちはない。

現在の候補は .artifacts/migration-install/candidate-536a358f-541e-47f7-a288-f944f653c204/package.manifest.json、contextは .artifacts/migration-install/reference-local-context-20261015.json。source identity=eb50f0266503138e68569f5e6084da8f4c1e6903c063f07a7365606b1f82804e、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。製品pack bytesは旧候補と同じだが、source identityは修正後のもの。

非TLS18工程のレポートは .artifacts/migration-install/reference-regressions-5908a7fa-fd16-487f-96ce-9592ac915803/regression-report.json、SHA256=33d657b8842755c9e48a3df5c61e7f3795a2e0f6102571abf29aa45ffe30485b。全18件のexit0と各raw log SHAを本担当がread-only再確認した。軽量185+237、acceptance/CI42、U2 unit44、U3 unit74、独立consumer195、Node回帰28、通常browser U2=9/U3=45/既存回帰33、instrumented Node115+115、instrumented browser99+9+9。全Node summaryのfail/cancel/skip/TODOは0。coverageは全21JS・1768/1929行=91.65%・skip0。reportのacceptancePassed=false、formal36/signedCI=pendingを保持する。

現在のCI入力修正の詳細は [ci-reference-recovery-verification.md](ci-reference-recovery-verification.md)。新canonical manifest SHA256=211041688ff38a16eb449d37263030543a3c7655e23a0dd9ec7e7886b15a0ae6、22logical行・254668126bytes・330source rows。10件archiveは36727106bytes、SHA256=9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f。既存dist/guests/aubeだけを固定参照して全11ファイルを復元し、mainが8pass・skip0を観測した。上記の新候補で非TLS18工程と正式36試行が成功。署名付きCIなど残りの受入れは別途必要。

以下の「最終候補」と呼んだ候補はCI入力修正前の履歴であり、現在sourceの成功証拠ではない。

現在の最終候補：.artifacts/migration-install/candidate-6d64046e-ac07-434b-9489-2f8c57d0e7d1/package.manifest.json。独立consumerは /private/tmp/formicarium-u3-final-consumer-20261015。検証済み：mainの回帰・coverage18工程は全exit0で完了し、.artifacts/migration-install/local-final-20261015/local-regressions.jsonへ記録した。全21JS・1483realm、1768/1929行=91.65%、skip0。source identity=2d449d46138cb20b7cd76b1657ab936febefea1c0c0b81e9b2983704b8e4c096、pack SHA256=cc89a7dcdd015da80b9c11569a4fef2daa8b3f2131610caa7fa20682c6e995b2。最終候補の36試行・current CI・短い正式完了確認は未実施である。

CI local準備は `prepare-local ci/migration-install/inputs.bundle.json /private/tmp/formicarium-u3-ci-local-20261015 .artifacts/migration-install/ci-local-prepared-20261015.json` がexit0。root ciディレクトリ不足のENOENTは人間承認後にディレクトリを準備し、同prepareを再実行して成功した。これはローカル準備結果であり、GitHub CI成功・署名Verified・正式受入れの証拠ではない。

以下は文書更新前の試験候補・履歴である。

- 候補：.artifacts/migration-install/candidate-4e9da022-cc47-4c3c-9a0b-2cb774be4046/package.manifest.json
- 独立consumer：/private/tmp/formicarium-u3-sha-consumer-20261015
- 固定guest：.artifacts/u2-release-inputs/aube-v2.7.0/aube

main観測のREADME更新前36試行結果：.artifacts/migration-install/formal36-sha-20261015-v2/measurement-report.json。source identity=e6fded2e29cd8824cc76fcf97abc4ff027aa8a7af879b75416def756234bf654、pack SHA256=d3df71ed7d65e9849616ce87c205e9c0b44762f928b8950b7b79cb79e2f72372。

| 非download中央値(ms) | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| aube | 750.575 | 1723.22 | 723.06 |
| Biome | 988.65 | 2685.16 | 1041.24 |

全6組が≤3000ms。mainは同leaf証明書でmacOS security verify-certとWebKit ignoreHTTPSErrors:falseのTLS確認成功、試行後の証明書削除・未登録確認も観測した。上記は文書変更前候補の成功履歴であり、今回README追加後はsource/packを再固定して36試行を再実行する。

候補のsourceCommitはbase revisionとworking-source inventoryの組合せであり、新規署名済みCI headとは主張しない。このローカル観測だけでacceptancePassed/mergeAllowedや後続単位成功を主張しない。

## Tests Not Yet Executed and Remaining Work

- 現在候補の正式36試行は上記同source/packで成功し、証明書の削除・未登録も確認済み。旧最適化前の未達と旧候補の成功履歴は保持する。
- CI入力修正後候補の全21JS coverageと非TLS回帰18工程・正式36試行は成功済み。current CIと正式完了確認は未完了。
- 追加署名付きpush・CI再試行1回は個別承認後に実施済み。署名Verified・tree一致と実行中runの独立観測は上記のとおり。CI全体はfailureであり、正式完了確認は未完了。上記CI prepare-localは修正前の履歴。
- CI入力のblockerはローカル復元で解消：mainが旧環境で8件中6pass・2skip・exit0を再現し、承認後に10件archive+固定既存guest参照へ修正。実サイト11件のSHA確認と実配信8pass・skip0まで成功した。調査記録は .artifacts/migration-install/ci-site-input-gap-20261015.md。全11件archive案の256MiB超過は履歴として保持し、上限を維持する参照案を採用。プロジェクト側のCI入力問題でありAI-DLC本体の不具合とは判定していない。追加pushは成功したがCIはfailureで終了。
- 最終レビュー、新しい短い完了確認コマンドの提示・承認・実行：Step 11の後続作業。README/docs/install-api.mdの作成、個別ignore整合・対象生成JS/CI入力のjj追跡は完了したが、Step 11全体は未完了。

traceability.jsonのOKは現存実装/試験への対応を示す。今回の更新はこの概要と復旧記録のみで、traceabilityの既存GAPは変更していない。ローカルの性能・回帰・coverage証拠は上記まで成功したが、署名付きCI・正式完了確認は引き続き必要。

## Deviations from the Plan

承認済み計画の機能範囲・品質基準に変更なし。全build/testはmain sessionで逐次実行。Step 7の実装・回帰と、改訂Step 8のCI入力・skip拒否・実サイト復元のローカル検証まで進めた。Steps 9–11は未完了。AI-DLC本体、U1/U2の記録、過去のsealed証拠を変更していない。
