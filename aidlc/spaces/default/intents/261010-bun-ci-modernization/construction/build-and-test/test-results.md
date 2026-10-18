# Build and Test Results

## Observed Commands

main、2026-10-10 UTC/2026-10-11 JST、Node24.21.0。U4最終checkpoint五tasks exit0、証拠ID72151dc7-b009-4dc7-8d45-d9353d9e885b、source/artifact unchanged=true。tooling206pass、既存unit177pass/2既存skip。既存release61pass、U4 six suites39top/50pass。これらの包含関係を合計しない。

Build and Test内の実tracked policyからIDだけ11/22/33にした正常assert.doesNotThrow：exit1、AssertionError actual BoundaryError INVALID_POLICY、receipt.js:48、protectedPaths.includes(workflowPath)=false。外部ID未設定による意図した拒否とは別の設定不整合を再現した。

prepareはMAINTENANCE_TOKEN=github.token、contents/actions/checks/PR readのみ。observeProtectionはGET branches/main/protectionを呼ぶ。[公式API](https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection)はAdministration read必須（ドキュメント根拠）。実APIは未実行。

## Targets and Remaining Checks

Target Verification Matrixはbuild-and-test-summary.mdに全44詳細NFR・追加D2上限・全Testing Contractを記載し最終Met/Not Met/Unverifiedで確定。Pendingなし。早期失敗のためstage全command再実行・全候補のconsumer/native/browser/coverage・実CIは未実施、次回Modify再実行する。cross-unit-traceability.mdはFR9件PASS、親NFR5件GAP（詳細NFRの記載を親IDのOKと偽装しない）。

## Current Attempt — U4修正後

検証済み：正式U4 checkpoint 76ce3e39-7ef5-43a2-8bfe-b6f7f35a6d60、開始2026-10-10T21:06:48.049Z、終了21:07:24.000Z、exit0/evidence unchanged=true、fingerprint c058adb5cda63f227a437537450e0ea9bbc116d4be25edeccb787dd9e35103da。承認済み5tasks成功、tooling234pass、既存177pass/2skip。U4六files39top/76pass、release61pass、actionlint成功、独立レビューREADY/R-01 Fixed。旧U4 Not Metはこの現結果で解消した。

Build and Testの `mise run test-consumer` 初回はbuild成功後、171total/168pass/3fail/0skip、6326.12875ms、exit1。consumer.test.jsとpack.test.jsは既定 `.artifacts/u1-package.manifest.json` 不在、nested-worker.test.jsは外部FORMICARIUM_CONSUMER未指定。旧emit又は旧RCを再利用せず、現在のemitをstage-package.jsで新規stageし、npm11.19.0 pack --ignore-scripts、verify-package.jsを実行した。初回packの既定cacheへのEPERMは、別のtmp cache指定で解消し、個人cacheの所有権・設定は変更していない。

新規候補 `.artifacts/modernization-current-v1/package.manifest.json` は固定24ファイル、tarball SHA256 742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30ca。新規外部consumer `/private/tmp/formicarium-modernization-consumer-v1` へのnpm install --ignore-scripts --no-audit --no-fundはexit0（1package）。FORMICARIUM_CANDIDATEとFORMICARIUM_CONSUMERを指定した `mise run test-consumer` は189total/189pass/0fail/0skip、16388.024375ms、exit0。実guestの正常・非UTF8・abort・timeout・nested pthreadと全packの照合も成功。

未検証：新候補の実CI、native/browser全回帰、固定配布JS全realm coverage80%以上、外部App/設定操作。これらは同一ソースのCI候補準備と実行へ続け、ローカル結果で置き換えない。既存Loop-Back Logは保存する。

## 実CI候補のローカル準備

検証済み：公開済みmainを基点に隔離jj workspaceを作成し、4単位manifestの74現存ソース全byte一致、package-lock削除、検証専用verify.yml以外の単位外変更0を確認した。最終署名済みソース7fc23afedef9a2296cb24026c0f19998a6933da7、76ファイル変更/1コミット。対象外の診断・フック差分は元の作業コピーへ触れず、隔離候補とその履歴から除外した。隔離候補の5tasksはexit0、tooling234pass/0fail/0skip、26704.4275ms。

固定入力は222 source pins、1373 payload files/229169203 bytes。初回tarのAppleDouble `._manifest.json` は全member検査で拒否し、COPYFILE_DISABLE=1で再生成した。最終archive104592600 bytes、SHA256 78bc6e0a9624124a79bc7ce9fbe85c5ebd2721759f1578cca8d1efcef63007fe、全1374 membersのkind/path/byte/digestを再照合成功。既知credential形式検出0。入力署名commit0cb57c28d00933dbb67c25ba41df659749102419。詳細はverification/modernization-ci-v1/input-preflight.json、archive-check.json、external-ci-approval.md。

GitHubのread-only観測では新candidate-verify.ymlはまだ登録されておらず、既存verify.yml ID380467087を利用する検証専用配置を準備した。ghはMarukome0743から以前の指定JamBalaya56562へ切り替え、管理権限を確認済み。外部push・変数設定・dispatchは未実施。実CI結果と全realm coverageは未検証のまま、上記具体候補への外部操作承認を待つ。

## 承認後の実CI開始

検証済み：Approve CI verificationを記録し、jjで承認済み2ブランチをupstreamへpush、両head SHA一致とGitHub verification.verified=true/reason=validを確認した。SSHの別アカウント拒否は登録済みJamBalaya56562の一時HTTPS認証で解消し、認証設定ファイルは変更していない。配信URLのarchiveを取得し、SHA256 78bc6e0a9624124a79bc7ce9fbe85c5ebd2721759f1578cca8d1efcef63007feを照合した。専用URL/SHA変数2件の設定後API再取得で値一致を確認した。

workflow 380467087をソースbranch指定で1回dispatch、run 38087834465、headSha 7fc23afedef9a2296cb24026c0f19998a6933da7。依存導入・build・ブラウザ準備・入力検査はsuccess、回帰・coverage stepは実行中。最終成否と全realm coverageは未検証。証拠はverification/modernization-ci-v1/external-ci-execution.md。main/npm/Release/保守App設定操作は行っていない。

## Final Attempt — 実CI結果

検証済み：run 38087834465はcompleted/success、candidate-required 21m35s、全step success。source SHA7fc23afedef9a2296cb24026c0f19998a6933da7、入力manifest SHA87c96e7ad9c2dcb10f630ae51214a3e86b94bf2459a2b73a66441cf4471fe15bをacceptanceと照合した。artifact11683811138のZIP SHA256 103f0cec69f4e4ea2d82d7ae37adfe2e7b23c3e46d6d9f4600fa7874b905e477はAPI digest一致、全1610 file membersが別取得の展開treeと一致。check-ci-results.mjs exit0、必要9checksと全20commandのstdout/stderr digestを再照合した。

| 実CI試験 | passed | failed | skipped |
|---|---:|---:|---:|
| release（evidence/decision/collect） | 35 | 0 | 0 |
| Node既存回帰 | 54 | 0 | 0 |
| browser既存回帰 | 36 | 0 | 0 |
| U1 Node consumer | 115 | 0 | 0 |
| U1 browser consumer | 123 | 0 | 0 |
| terrarium Node統合 | 30 | 0 | 0 |
| terrarium browser統合 | 45 | 0 | 0 |

native aube/pitchfork各再現性検査もexit0、供給済みbaselineからのdigest変更なし。native2commandsはテスト件数へ合算しない。別途局所tooling234pass、release61pass、consumer189passとの包含関係を合算しない。軽量試験の既存skip2件を成功へ変換していない。

固定24files全分母1801行、covered1450/80.51%、skipped0、fresh receipts46件。U1 componentは982行中862/87.78%、Node host/Workerと3ブラウザ各realmのoriginal receiptsを保持し、今回のtarball742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30caへ照合した。全realm/全分母を含むcoverage80%目標を満たす。詳細はverification/modernization-ci-v1/ci-observations.jsonと固定report/acceptance。

Target Verification Matrixの46件は全Met。Build and Testの現最終判定は成功、統合の品質確認済み。実保守App/secret適用・write運用・main統合・新版公開は本試験範囲外で未実施。今回の検証専用verify.yml配置は統合時に区別する。既存の実Safari未検証、単一機種のtiming、file-backed MADV_DONTNEED制限は解消したと主張しない。

## Loop-Back Log

U3再入場後の現観測: main build→追加3filesは47 pass/0 fail/0 skip。同U3全5filesは39top/110 pass/0 fail/0 skip。承認済み5tasks全exit 0、tooling208 pass。独立レビューで設定pathと読取認証の2件をFixed、新規指摘なしと確認。正式checkpoint ae1219d2-0b7b-44b4-8b6d-412c8a3852ef はexit 0、evidence unchanged true、fingerprint 61f81bcd031ffbd8f877531dd3cbc472f6b7397515486e229e1c1e33d8d5252f。親FR/NFR14IDの実target再照合もexit 0。上の旧観測を置き換える現結果であり、U4 JSON上限と実CI/coverageは未解決。

### Loop-back 1 — 2026-10-10T16:35:30Z

Diagnosis: U3実設定正常例がINVALID_POLICY、prepareの保護読取経路不足。U4 metadata8MiB上限不足。親NFR trace5件未対応。

Root-cause stage: Code Generation、U3/U4。U1/U2の実装・承認は保持する。

Planned fix: U3の完全workflowPathを保護設定へ加え、実tracked設定の正常化を回帰化。prepareはwrite能力のない専用App tokenで保護情報を取得し、不足時拒否とcredential非転送を検証。U3 traceabilityへ実existing targetsに対応した親NFR1–5を追加。U4はinputs JSONをrunner開始前・直接CLI読込前に8MiB制限し、境界/+1/executor0を検証。両unitとも固定bundle再生成・独立レビュー・checkpoint後、全体試験をModify再実行。

Estimated impact: U3 1–2時間、U4 20–40分、ローカル追加費用なし。認証経路と拒否境界の回帰リスク。実App/secret設定・外部CI/pushは別承認、GitHub実CI費用は契約枠次第。品質基準は変更しない。

### Loop-back 2 — 2026-10-10T16:59:00Z

Diagnosis: U3の設定/認証不整合と親NFR対応は修正・局所検証済み。残るU4 inputs metadata/manifestの個別8MiB上限は未実装。初回のU4再開操作はU3作業中に拒否され、U4を編集していない。

Root-cause stage: Code Generation、U4のみ。U1/U2/U3と先行設計は保持する。

Planned fix: request/publication/evidence JSONの各8MiB上限をtrusted bootstrapのrunner起動前と公開CLIの直接読込前に適用。丁度上限/+1/公開executor0回の同回帰をRed→Greenで検証し、固定bundle再生成・独立レビュー・正式checkpoint後にBuild and TestをModify再実行する。

Estimated impact: 20–40分、ローカル追加費用なし。JSON拒否境界とbundle供給の回帰リスク。外部push/App設定/公開は含めず、実CI/coverageは全修正後の候補に別途結び付ける。既存品質下限は保持する。
