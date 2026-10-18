# U4 Code Generation Plan

## Summary

- Builds: 公開専用候補のmanifest整合と、承認済み版タグからのみ動くTrusted Publishing経路を準備する。
- Touches: U4公開準備の新規モジュール・試験・publish workflow・説明・記録。U1–U3とv9候補・保存証拠は保持する。
- Tests: mainで正式build、公開候補・公開判定・workflow境界の否定試験、既存release/CI回帰、新候補のpack/consumer/固定24 coverageと遠隔identity照合。

## Current Recovery Plan — Loop-back 4, Steps31–35

人間の回答「Retry with fix」によるU4限定の修正。現在実行するのはStep31–35で、下のStep1–30は保存履歴。U1–U3・旧v9・公開候補の製品bytes・core/guest・過去証拠をKeep。Testing Contractと品質条件は変更しない。新attemptのPlan Approval後に実装する。

- [x] Step 31 — mainで既存runner/config、review-08 R-05〜R-07、publication CLIとfixtureの入力を確認する。公開CLI境界試験用の正常bundleを独立temporary directoryへ準備し、外部送信を行わないexecutorの捕捉方法を定義する。既存64件の成功と公開candidate SHA8334d7f1のNode11/browser33成功は履歴として保持する。
- [x] Step 32 — tests/release/publication-cli.test.tsを追加しgatePublicationを直接検証する。正常bundleと、request/tgz SHA、pack外source、core commit/dirty/build-info、repository/tag/source/event contextの個別改変を渡し、正常の受理と各不一致の拒否を確認する。publication.test.tsにRC必須REGRESSION_CHECKSの欠落・failed・timeout、coverage欠落・80%未満のblocked試験を追加する。製品拒否不足を発見した場合はmainで失敗Redを先に観測し、対象拒否条件だけを修正して同じGreenを得る。
- [x] Step 33 — npm/gh executorをテストから捕捉できる最小の注入境界をpublication-cli.tsへ実装し、その層の試験を追加する。CLIのpublish/release到達経路で、証拠不一致・承認不足・OIDC不足ならexecutor起動0回をassertする。正常fixtureでは検査済みcandidate.tgz、next/latest、public registry/access、provenance、ignore-scripts、分離cwdと空userconfig、秘密envの除去、Release tag/source/assetの一致を捕捉する。既定executorは実CLI動作を維持し、テストでは常に偽executorを使い外部送信しない。新しい検査を回避するテスト専用フラグは作らない。
- [x] Step 34 — mainで正式product/test tsc→emit、publication CLI/plan/workflowと既存release/CIの対象回帰を逐次実行する。Generated JSは正式buildのみ。観測command/exit/件数/拒否理由/起動回数を新verification/publication-boundary-v1へ保存する。固定24/80%以上/46realm/worker1/retries0/期限/wasm1GBを維持する。変更のないcore/guestや公開runtimeの長時間回帰を無条件再buildしない。新sourceの遠隔CIは既存旧runへ再ラベルせず、具体送信候補を準備した後に別途最終承認を得る。
- [ ] Step 35 — unit-test-instructionsのplan/validate引数を実装へ合わせ、旧誤例を履歴として明示する。traceability NFR3は旧source70b345c3の80.51%と新source/candidateのfresh CI未検証を分けてDeferredにする。code-summary/source-manifestへ変更・観測を反映し、native sensorsとfresh独立advisory reviewを実施する。U4完了手続は承認済み一時修正版を必要な箇所だけ使用し、インストール・設定・公開先は変更しない。

推測見積り：2–4時間、ローカル追加費用なし、Actions費用は契約依存で未検証。主なリスクはexecutor注入と公開前拒否条件の回帰。既定実装を維持し、偽executorで到達/拒否を観測する。本計画はpush、npm bootstrap/信頼設定、RC公開、GitHub Release、terrarium実RC導入の最終承認を兼ねない。

## Historical Recovery Plan — Loop-back 3, Steps24–30

人間の依頼「未達じゃなくて検証して下さい。」とログイン後の実設定確認により、機密・依存・ライセンス確認とNFR1/NFR5の判定を修正済み。今の実行対象はStep24–30のみ。下の計画は履歴であり、本節と矛盾する「公開workflowは後続だけ」「private:trueを常に維持」「CIは未検証」は今の実行対象に適用しない。Testing Contract本文・hash・既存品質条件は変更しない。実装は本attemptの新しいPlan Approval後に開始する。

検証済みの入力はbuild-and-test/verification/public-validation-v1/{results.md,npm-settings.md,preflight.json,licenses.json}とhooks-disabled-resume-v1の最新CI原証拠照合。npm scope owner・2FA enforcementを確認済みだが、formicariumの設定項目はまだない。v9はprivate:true/repositoryなし、verify.ymlは検証専用。npm scope名からGitHub公開先を推定しない。既存Marukome0743/formicariumは検証用送信先であり、公開先と同一である承認は別途照合する。

- [ ] Step 24 — mainで既存runner/configと最新source/CI/candidate証拠を確認し、release identity入力を定義する。必須項目は公開GitHub owner/repository・workflow filename publish.yml・environment・source commit・版タグ・version・dist-tag・候補SHA・必須check/evidence ID・具体的操作承認。公開先が確定しない段階もローカルfixtureで準備を続け、未指定や検証forkの暗黙採用は拒否する。アプリ/database/frontend新設は不要。旧v9とU1–U3を編集しない。
- [ ] Step 25 — scripts/release/publication.tsとscripts/release/publication-cli.tsを新設し、旧private検証candidateから未使用outへ公開専用candidateを作る明示prepareと、外部変更をしないplan/validateを実装する。name/exports/types/runtime/assets/noticesを保持し、公開manifestだけprivate:false・実公開先repository.url・publishConfigのpublic registry/accessを固定する。旧stage-package/verify-packageのprivate条件は変更せず、新候補を別manifest/inventory/SHAへ結合する。JS/wasm/core/guestの意味変更がないか原bytesで比較し、差分はmanifestと説明の許容集合に限定する。新候補は旧v9の成功そのものと呼ばない。実装後tests/release/publication.test.tsの5–8意味あるケース群をmainが実行する。
- [ ] Step 26 — scripts/release/{types,evidence,decision}.tsの最小拡張とtests/release/{fixtures,evidence.test,decision.test}.tsで公開identity・workflow tuple・候補改変・tag/version/dist-tag・実設定観測を結合する。既存欠陥として扱う拒否不足はmainが再現Redを観測してから修正→同じGreen。RCは公開前チェックと最小consumerが必要だが公開済みRC導入を前提にしない。stableは実公開RCのregistry integrity/terrarium導入差分・受入れとstable差分を必要とする。未実施/模擬設定/古い候補をpassedにしない。実装後または修正Green後に既存release全3ファイルと新publication試験を逐次実行する。
- [ ] Step 27 — .github/workflows/publish.ymlとscripts/release/workflow.ts、tests/release/workflow.test.tsを準備する。承認対象の正確な版タグと公開repository/commitだけを許可し、pull_request・fork・任意branch/workflow_dispatch入力・不一致tagは公開jobへ到達させない。検証jobはcontents:read、npm公開jobだけid-token:write、Release jobだけcontents:writeを付与し、job環境と実Trusted Publisher tupleを一致させる。GitHub-hosted runner・固定Node/npmの対応版・pin済みactions・候補SHA・全必須checksを公開直前に再検査し、npmへ渡すのは検査した同一tgzとする。npm tokenへfallbackする設定を作らない。verify.ymlの既存安全条件を維持する。workflow否定試験5–8群を実装後mainが実行する。
- [ ] Step 28 — docs/release-assurance.mdへ初回bootstrapの実行可能な手順を記載する。公式仕様ではnpm trustは既存packageを必要とし、staged初回はpublicな0.0.0-stage placeholderを作る。従って「package不存在でもOIDCだけで初回送信可能」と断定しない。mainでCLI能力・ブラウザ実設定をread-only確認し、長期tokenを使わない対話認証によるbootstrap候補、公開placeholder/候補bytes/送信先、Trusted Publisher登録、RC本番OIDC公開またはstaged承認の順序を具体化する。未選択経路はfail closed。設定保存は認証成功証拠ではなく、初回OIDC成功まで未検証。設定は準備済みworkflowと一致させ、2日expiryも確認する。bootstrap・設定変更・repo作成/push・RC/stable公開・Releaseは各具体的操作の最終承認後だけ実施する。
- [ ] Step 29 — mainで新candidateのexact inventory/bytes・機密/依存/notices/core provenanceを再照合し、pack型・空consumer Node/ブラウザWorkerを確認する。意味不変部分の旧証拠採用はbyte identityとimport条件を明記し、新candidateへ結合する必要があるfresh固定24 coverage・Node/三ブラウザ/native・最新source CIは既存runnerの条件で逐次実行する。遠隔送信の準備はmainが差分・送信先・署名commit・入力を具体化し、承認後だけjj署名push/dispatch。変更のないcore/guestは再buildしない。RC公開後は実registry tgz/integrityとdist-tag/Release assetsを読み戻し、実RCをterrariumの隔離導入先で受け入れる。その成功前にstable公開可としない。外部未承認時もローカル修正・レビュー・候補準備を完了させる。
- [ ] Step 30 — U4 code-summary/traceability/source-manifest、正式build生成JS、95IDと27品質条件の現状を更新し、mainがnative sensors・独立正式レビュー・engine手続へ進む。未実施の外部公開ACは具体的操作/所有者/必要証拠を残す。旧receipt・audit・state・期待SHAを手編集しない。実装・ローカル成功・遠隔成功・npm実設定・実公開RC受入れを別々の観測として報告する。

推測の見積りは実装とmainローカル検証半日–1日、遠隔run20–40分、初回認証/設定/公開RC導入は実操作待ち時間次第。Actions料金はアカウント条件依存で未確認。主なリスクは別候補の公開と未承認tagの実行であり、SHA/identity/checks/実設定の照合と公開jobの権限境界で拒否する。このPlan Approvalは具体的外部操作の最終承認を兼ねない。

ドキュメント根拠（2026-10-10確認）：[Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)、[npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/)、[Staged publishing](https://docs.npmjs.com/staged-publishing/)。npm trustの対象存在条件とstaged初回placeholderはbootstrapの未解決点として扱い、公式ページ間の権限数の差異は対象実画面で確認する。

## Current Recovery Plan — Loop-back 2, Steps18–23

人間の変更依頼：最新 collector を含む遠隔 CI の未検証を解消する。本attemptの目的はその検証に限定する。Step18–22で最新sourceを結合した遠隔runを取得・照合し、Step23で結果を引き継ぐ。公開RC導入やregistry実設定の整備は今回の実行対象に追加しない。

現在の実行対象はStep18–23のみ。以下のStep1–17とAmendmentは過去の計画・実装履歴として保持する。Build and TestのLoop-back 2によってU4だけを再開した。U1–U3の承認・凍結bytes・保存証拠を維持する。Testing Contractはengine renderの現在値と一致し、変更しない。

検証済み：今回のNode140件とbrowser21件は全成功。保存run38011644576は1610成果物のsize/SHA一致、全必須実行成功。ただし最新scripts/release/collect.tsとtests/release/collect.test.tsがそのsourceと異なるため、現在source全体のCI成功には使用できない。今回の全95要件/AC照合は69 OK、26 Deferredで欠落IDなし。公開RC実導入・実設定などのDeferredはCIだけで解消しない。根拠はconstruction/build-and-test/verification/resume-20261010-v2/のresults.json、cross-unit.json、remote-ci-reconciliation.jsonおよび原ログ。

- [ ] Step 18 — mainでrunner、直接mise Node実体とbuild設定を確認し、最新collector修正（process group停止と250ms pipe drain）・既存Red→Green・変更TS/生成JS/説明のSHAを保存する。旧remote sourceと現在の差分一覧、候補/core/guest/fixture/固定24 coverage入力を照合する。旧成功を最新sourceへ再ラベルせず、guest/core/候補tarballを再build/repackしない。
- [ ] Step 19 — mainで正式product/test TypeScript build→emit→release全3ファイル→CI試験を逐次実行し、非0・timeout・abort・child終了/pipe遅延の既存oracleを維持する。新しい欠陥があれば再現Redを先に観測し最小修正→同じGreenへ進む。証拠不足だけの場合は製品を変更しない。Windows taskkillの未実行を成功にしない。
- [ ] Step 20 — 最新sourceを隔離検証checkoutへ準備し、送信先・bookmark・署名commit・全差分・入力供給・workflow argv・成果物公開範囲をreview可能にする。既存承認が同じ具体的操作を覆うか確認し、不足する場合のみ最終承認を得る。承認前にpush/入力upload/遠隔起動をしない。formicarium本体のremote作成やpushはしない。
- [ ] Step 21 — 承認済み範囲でjj署名pushと既存検証専用workflowを実行する。旧runと同じ入力identity・必須Node/三ブラウザ/native・fresh固定24 coverageを使用し、release35件を含む最新sourceを確認する。probe600秒/aube browser840秒/worker1/retry0/skip0/native一致/wasm1GB/80%以上/全realmを維持する。原因が明らかな失敗は最小修正して再実行する。外部許可や供給不足は具体的に未検証として残す。
- [ ] Step 22 — 実run URL/head SHA/Verified署名、全job conclusion、原logと全artifact size/SHA、candidate/input/source/execution seal/realmを読み戻す。現在sourceとの一致を確認してNFR3とTesting ContractのCI条件を再判定する。公開RC受入れ・registry/Trusted Publisher実設定・公開source/history監査等の残条件は所有者・必要操作・証拠を明記し、CI成功と独立してDeferredを維持する。全95IDを再照合する。
- [ ] Step 23 — U4 summary/traceability/source manifest、実行指示とBuild and Testへの引継ぎを更新し、native sensors・独立正式レビュー・正式Unit手続へ進む。レビュー指摘を検証して修正し、engineの次directiveに従う。旧receipt/承認/state/期待SHAを手編集しない。

推測の所要時間：候補準備30–60分、遠隔CI20–40分。Actions費用はアカウント設定依存で未確認。外部送信のsource/成果物開示と署名対象を最終承認用差分に明示する。この計画承認は外部送信/npm公開/Release/PRの承認を兼ねない。新規DB/repository/API/frontend実装は本修正に該当せず、既存collectorと検証環境の確認に限定する。

## Current Recovery Plan — 2026-10-10, Steps12–17

今回のRequest Changesへの実行対象はStep12–17のみ。下の旧Step1–11・Amendment A–D・旧Current Recoveryは実装と測定の履歴として保持し、再実装・無条件再測定する指示ではない。既存Major修正のRed→Greenと生成物を保持する。Testing Contractは変更しない。

- [ ] Step 12 — mainで既存runner/config、release3試験、source-manifest15件、保存済みofficial-restart/official-recovery/current-*の結果と原bytesを照合する。U1v9 tarball、clean core、aube2.7.0・pitchfork2.30.1とnative基準、U3固定24/46receipt/1450対1801行80.51%/skip0/source・candidate・execution sealを新verification/ci-traceability-repair-v1へSHA/size付きで記録する。変更のない製品/core/guestを再build・再packしない。保存結果と今回実行を区別する。
- [ ] Step 13 — 既存18ACとreverse対応を保持し、FR7/7.1/7.2/7.3、FR8、FR9/9.1/9.2/9.3/9.4、FR10/10.1、NFR1–7の全条件を要件原文から実装・名前付き試験・証拠・未達条件へ対応付ける。OK targetは実在する具体的な実装または試験ファイルとする。全体条件・公開操作・公開RC受入れ・実設定不足は理由付きDeferred/GAPのまま保持する。U1–U3の凍結記録は編集せず、その引継ぎとU3の参照先に関するMinor指摘をU4の全体対応記録へ明記し、他Unitの指摘を黙って解消扱いにしない。
- [ ] Step 14 — 検証専用CIを.github/workflows/verify.ymlとscripts/ci配下へ実装する。公開job・npm token・publish・Releaseを含めず、権限は必要な読取りに限定する。実在する入力の供給経路を調査して候補SHA/source/core/guest/fixture/owner版・coverage固定24をmanifestで結合し、不足/改変/未知入力をfail closedにする。ローカル絶対pathや他repoの未追跡入力へ依存するまま実行可能とは主張しない。遠隔runnerで必須Node/3browser/native回帰とfresh coverageを逐次実行し、receipt/realm/80%/skip0/worker1/retry0/既存期限を検査してcommands/log/identity/coverageを成果物として保存する経路を作る。既存guestを供給できない場合は必要な成果物移送方法・サイズ・機密/ライセンス確認を具体化し、無断移送や不要な再buildで代替しない。
- [ ] Step 15 — 実装後tests/ci配下へ5–8 meaningfulケース群を作り、mainがUnit限定で正常入力・欠落/改変・別候補・必須チェック非0/timeout/skip/realm欠落・危険な公開権限/未信頼実行元を検証する。release3ファイルをmainで逐次再実行する。新TSがあれば正式tsc product/testとemit後に生成.jsを実行し、凍結ソース・既存生成物への意味変更なしを確認する。CI設定の公式仕様は実装時に一次資料で確認し、構文検査やローカルfixture成功を遠隔成功と呼ばない。
- [ ] Step 16 — mainが既存リモートと実workflowの有無をread-onlyで確認し、遠隔実行に必要な候補commit、送信先、差分、入力供給、CI実行範囲をreview可能に準備する。既存の公開制限に従い、必要なpush/成果物アップロードの具体的な最終承認を得てからjj署名付きpushと検証workflow実行を行う。既存の同等承認があれば重複確認しない。Run URL/id、実head SHA、全必須job conclusion、raw log/artifact SHA、candidate/generation/source/realmを読み戻して照合する。失敗は原因を調べて承認範囲内の最小修正→再実行。不許可/供給不能/未実行なら遠隔CI未完了の具体的な障害として報告し、ローカル成功で置換しない。PR/公開リポジトリ作成/npm公開/GitHub Releaseは対象外。
- [ ] Step 17 — code-summary/traceability/source-manifestに今回の変更・実行・保存証拠採用・遠隔CI結果と残条件を反映し、native sensors、独立正式レビュー、Unit完了と承認済みチェックポイント検証へ進む。Code Generation全体の正式完了と要件対応不足の解消を確認し、未完なら理由を保持する。Stopフックは全体完了を確認するまで無効とし、復帰は正式登録aidlc engine adapter codex continue-workflowだけを使用する。旧Pythonラッパーのbackupを丸ごと復元しない。

検証済みの計画入力：.githubにはテンプレート/CODEOWNERS/dependabotのみでworkflowがない。保存済みci-observation.jsonは旧head74dd4477のfork/upstream run0件であり、現在候補のCI成功ではない。mise.tomlの現在Node指定は26、保存コマンドは直接Node24であり、実行時にmise実体を解決しNode>=24を満たすことを確認する。

この計画承認はpush/成果物送信の最終承認や公開操作の承認を兼ねない。未承認の外部操作の直前まで、差分・候補・入力を具体化して進める。既存同一性不一致は未完了として扱い、期待SHAやreceipt/stateを手編集しない。

## Current Recovery — 2026-10-10

人間のRequest Changesにより、未完了のU4 Major R-01（RC採用に必要なterrarium実導入差分の検査不足）を修正する。以前のStep1–7/Amendment A–Cの実装・検証記録は保持し、旧collectorのR-01と今回のrelease入力検証のR-01を区別する。現在の実行対象はStep9–11、続いてStep8とAmendment Dの記録・正式手続である。U1/U2/U3の凍結成果と旧測定は変更しない。

- [ ] Step 9 — mainでrelease試験のrunnerを確認する。正常な模擬RC採用からterrarium必須情報、diffSha256、実導入差分artifact参照や原bytesを欠落・改変し、validateEvidence単体および保存→解決→stable判定で拒否/blockedを要求する回帰を追加する。mainが正式build後に現実装の意図したRedを観測する。runner失敗を製品Redとしない。模擬公開・承認は実公開・人間承認へ昇格しない。（C6/C7、US6.1–6.4）
- [ ] Step 10 — releaseの型に実導入差分artifactの明示参照を表し、evidence.tsでterrarium受入れのinstalledVersion/baselineCommit/integrationCommit等の必須項目とdiffSha256形式を検査する。既存のroot内regular nonsymlink検査でartifactを読み、原bytes SHAとcheck.artifactDigestsの一致を必須にする。decision.tsのRC採用は照合済み情報だけを受け入れ、欠落・不正・改変でstableをblockedに保つ。stable差分とterrarium実導入差分は別の証拠として扱う。正常模擬fixtureも実artifactに結び、mainが同じ回帰Greenを確認する。旧保存証拠を新schemaへ書換えず、不足はunverified/blockedとする。（C6/C7、US6.1–6.4）
- [ ] Step 11 — mainがreleaseのevidence/decision/collect全3試験、正式TypeScript product/test buildとemit、修正TSの限定Biomeを逐次実行する。欠落・空文字/不正digest・artifact欠落/同size改変・root外path/symlink・情報不一致と、正常な保存/解決/採用を確認する。候補・測定実装が変わらなければ保存済み固定24 coverageと現bytes/realm/sealをread-onlyで照合し、新測定とは呼ばない。照合が成立しない場合は旧成功を転用せず未使用世代で必要な再測定を行う。遠隔CI/公開済みRC/実設定等の未検証条件は公開判定のblocked理由に残す。（US5.1/5.2、US6.1–6.4）

変更対象はscripts/release/{types,evidence,decision}.tsとtests/release/{fixtures,evidence.test,decision.test}.ts、必要なrelease説明・U4記録に限定する。emitした対応.jsは正式buildの生成証拠として列挙する。guest/coreの再build、外部owner変更、公開操作は行わない。U3レビューの代替測定先名のMinor指摘は別Unitの未解決事項であり、本修正へ混ぜない。

## Sources and Scope

Conversation language: Japanese。U4 ReleaseAssurance、US5.1/US5.2/US6.1–6.4、C6/C7を実装する。承認済みrequirements.md、contract-summary.md、unit-of-work.md、unit-of-work-story-map.md、stories.mdを根拠とする。U3正式review-01.md R-01は測定copy/最終bundleのbytes結合不足であり、静的経路の確認済み所見、改変再現は未検証。既存80.56%を誤りとは断定せず、修正後の新規generationで再測定する。

主な編集対象は scripts/terrarium/coverage.ts、scripts/coverage-types.ts、tests/terrarium/coverage.test.ts、scripts/release/{types,evidence,decision,collect}.ts、tests/release/{evidence,decision,collect}.test.ts、docs/release-assurance.md。正式buildの.jsは生成証拠へ分離し、source manifestは追跡可能なapplication-sourceだけを列挙する。U1/U2製品ソース、U3製品接続、外部terrarium、古い候補/証拠/receiptを変更しない。coverage collectorの変更はU4所有のC6検証修正として扱い、U3の完了済みreceiptを変更しない。CI/公開workflowの具体実装は後続の該当工程へ引き継ぎ、このUnitでは判定条件と実行可能な検証コマンドを作る。

## Latest Pitchfork Verification Amendment

人間の2026-10-08の指示により、今回のpitchfork受入れ対象は最新版v2.30.1。公式GitHub latest APIとtag objectをmainが観測し、commitは1054549e85470b08d9507e2c82c850959a4b3914。手元build-infoのref/commitは一致しているが、動作は未検証。2.29.0へ戻す案は撤回し、旧版の再検証は行わない。承認済み旧plan/instructions/questionsはarchive/plan-before-pitchfork-2.30.1へ保存した。完了済みcoverage/collector実装・観測を保持し、再実装しない。

追加編集対象はscripts/build-guests.shの既定pitchfork refと説明、tests/node/build.test.tsの独立したexpected ref/公式commit、fixtures/baseline/pitchfork-basic.native.txt。生成JSは正式buildだけで更新。既存musl型パッチの歴史的filenameと内容は維持し、ゲストへの追加修正は行わない。旧baselineは更新前のbytes/SHAをこのUnitのarchiveへ保存する。

- [ ] Amendment A — v2.30.1の公式ref/commit、guest ELF SHA、build-info/patch SHA、fixture/core/候補を固定し、build既定と試験の独立expected ref/commitを一致させる（FR7.1/7.2、NFR5、US5.1）。build-info自身からexpected値を導出しない。同一成果物が利用可能なら再buildせず、必要な再buildはpitchforkだけ。
- [ ] Amendment B — 同じv2.30.1 ELFをネットワークなしLinuxで2回native実行し、再現一致した出力からbaselineを生成する（FR7.1、NFR2、US5.1）。版文字列の置換では生成しない。
- [ ] Amendment C — v2.30.1のsession/pitchfork-basicをNode、Chromium、Firefox、WebKitで逐次実行し、native出力・終了コード・設定更新/削除/読取・連続実行を比較する（FR3/FR7.1、NFR1/2/7）。各実行前後のguest SHAとref/commitを結果に結合する。旧U3 owner v2.30.0のconsumer/coverage成功をv2.30.1受入れへ再ラベルしない。terrarium既存入口の最新版受入れは別途版を照合した結果がない限り未検証とする。
- [ ] Amendment D — U4証拠とsummaryの版別状態を更新し、必須未検証項目があれば公開判定をblockedに保つ（C6/C7、US5.2/US6.1–6.4）。既存のprobe/aube等の残り回帰と独立レビューは元Step7/8通り完了する。

## Ordered Steps

- [ ] Step 1 — runnerと候補を準備する（US5.1/US5.2）。mainで既存coverage試験を正式build後に実行し、直接Node/BunとPlaywright CLI、U1 v8 tgz、U2供給物、U3正式owner証拠をpinする。変更がないaubeを再buildしない。実在する入力のpath/SHA、command/cwd/環境を検証記録に固定する。
- [ ] Step 2 — R-01を再現する（US5.2、C6/NFR3）。元source/siteとstatement mapを維持してinstrumented moduleだけ変更、最終browser bundleだけ変更、測定後変更の3経路に拒否期待回帰を先に追加し、mainで現collectorが拒否しないRedを観測する。runner不成立やfixture不備を製品Redとは扱わない。旧測定outは変更せず専用fixtureを使う。
- [ ] Step 3 — 測定実体を固定・照合する（US5.2）。prepare→正式bundle→seal→measure→reportを明示する。sealは固定されたinstrumented modules、browser bundle、実行されるsite資産およびtest/preload/configの必要集合をpath/kind/size/SHAで結合し、source/candidate/generationと独立したexecutionIdentityを保存する。未seal、二重seal、欠落/追加/escaping link/bytes driftを拒否する。Node/browser各開始前と終了後、report時に測定copyを再照合し、全receiptへexecutionIdentityを結合する。U1既存componentは同pack/source/maps/realmの明示importを保ちfresh実行に再ラベルしない。固定24分母、80%、realm条件を維持する。Step2をGreenにし、正常bundle、旧receipt、未seal、集合逸脱も含む5–8 meaningful case群をmainで検証する。
- [ ] Step 4 — C6のevidence型・保存・照合を実装して試験する（US5.1/US5.2/US6.1）。不変envelopeとevidenceId→artifact/SHA index、候補/tgz/core/guest/terrarium identity、check結果/終了分類、stdout/stderr artifact、固定coverageを検査する。既存結果のimportはcommand/log原SHAと取得時観測を区別し、未実施はunverified。新しい結果は新IDで保存し上書きしない。未知/重複ID、checkId誤参照、digest破損、別候補、矛盾するfailed結果、coverage null/missing realmを含む7ケース群を実装後main実行する。
- [ ] Step 5 — C7のRC/stable判定を実装して試験する（US6.1–6.4）。required check一覧を事前固定し、版/tag/dist-tag/候補/公開先と具体的な操作承認の一致を検査する。RCは公開前checksと最小consumerを要求し公開済みRC受入れを要求しない。stableは直接stable evidenceと明示rcAdoptionによる公開済みRC履歴、registry identity、実terrarium受入れ、stable差分検証、全必須NFRを要求する。未知ID/直接RC混入/RC再ラベル/循環/別RC/digest破損/不足承認/不足差分を拒否する8ケース群を実装後main実行する。fixtureの承認は模擬であり人間承認へ昇格しない。
- [ ] Step 6 — 観測collectorと公開前確認を実装して試験する（US5.1/US6.1/US6.2）。逐次実行のargv/cwd/時刻/exit/termination/log SHAを保存し、failed/timeout/abort/not-runを合格としない。ログは機密のないfixtureに限定する。公開source/history/packの対象・除外・依存/取得元/LICENSE/notices/dirty=falseと未確認事項を一覧化する。Trusted Publishingの公式npm/GitHub資料と利用可能な実設定をread-only照合し、実設定にアクセスできない条件はunverified/blockとする。長期npm tokenや架空の設定成功は作らない。collectorの正常/非0/timeout/abort/不足artifact/identity不一致/未実行の7ケース群を実装後main実行する。
- [ ] Step 7 — fresh結合証拠と回帰をmainで収集する（US5.1/US5.2）。未使用.artifacts/u4-coverage-v1にprepare/bundle/sealを行い、固定24/U1明示importのfresh Nodeと45browser結果を集計する。現owner siteのconsumer6ケース、U4判定/collector試験、必要なpack/型試験を逐次実行する。probe8項目、指定回帰futex-deadline/page-fault-race/madvise-dontneed、aube-1645、pitchfork-basicのNode/3browser検証とnative baseline同一性を候補へ結合する。既存履歴を採用する場合はsource/core/guest/pack/path/command/realm一致を照合して歴史importと明記し、不成立ならその検証をfresh実行する。必須検証の未実施を成功としない。統合前遠隔CIはローカル成功で代替せず未検証を残す。
- [ ] Step 8 — docs/summary/traceability/source manifestと独立正式レビューを完成する（全U4 stories）。R-01の再現/修正/再測定とexecutionIdentityを記録する。公開候補・必要承認・required checks・blocked理由と再実行手順をreview可能にする。native sensors、独立advisory review、正式Unit/checkpoint手続きをmainが実施する。未検証の外部操作ACはDeferredとし実公開済みとしない。

## Quality and Boundary Constraints

mainだけがbuild/testを逐次実行する。probe600秒、aube browser840秒、pitchfork browser600秒/Node120秒、1worker/retries0、native一致、wasm1GBを維持する。測定中に並行重負荷を入れない。標準test-afterの新規層は実装後試験、R-01不具合修正は再現Red→Green。固定一覧/除外/80%を変更して達成しない。既存JS生成は正式build経由だけ、導入済みAI-DLC生成ファイルを変更しない。

## Completion and Limits

この計画の承認は公開リポジトリ作成・push・PR・npm publish・GitHub Release・外部投稿の承認ではない。実機Safari、実Pages/service-worker、遠隔CI、公開済みRC実受入れ、registry権限/Trusted Publisher実設定は観測まで未検証。現在private:trueを維持し、公開経路は不足条件によりblockedでよいが、未完了ACを合格へ置換しない。Unit実装完了とRC/stable公開可能性を別々に報告する。
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
