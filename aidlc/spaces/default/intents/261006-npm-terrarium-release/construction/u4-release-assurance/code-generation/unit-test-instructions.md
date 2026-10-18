# U4 Unit Test Instructions

## Current Verification — Loop-back 4

現在はplan Step31–35を実行する。下の旧手順と観測は履歴。main sessionで正式tsc/emit後、直接mise Node実体により `node --test --test-concurrency=1 tests/release/publication-cli.test.js tests/release/publication.test.js tests/release/workflow.test.js tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js tests/ci/verification.test.js` を逐次実行する。新CLI試験は外部送信なしの偽executorを使用する。

正常bundleのgatePublication受理、request/tgz SHA・pack外source・core provenance・実context改変の拒否を個別にassertする。RC必須回帰の欠落/failed/timeout、coverage欠落/80%未満はblockedをassertする。publish/release不成立とOIDC不足ではnpm/gh executor呼出し0回をassertし、正常時は同一tarball/dist-tag/registry/access/provenance/ignore-scripts・空userconfig/分離cwd・秘密env除去・Release identityを捕捉する。観測をverification/publication-boundary-v1へ保存する。製品欠陥修正はRedを先に観測して同一Greenを得る。

正しいCLI引数は `plan <evidence-root> <request-json>`、`validate <publication-candidate-manifest-json> <identity-json> <exact-tgz>`。旧節の引数が異なる例は使用しない。plan/validateはローカル照合で、publish/releaseは具体的外部承認なしに実行しない。

旧source70b345c3/run38024772634の80.51%は履歴。新sourceと公開candidate8334d7f1のfresh固定24coverage/CIは新証拠が得られるまで未検証。閾値・一覧・46realm・期限・worker1/retries0を変更しない。

## Historical Verification — Loop-back 3, Steps24–30

現在はplan Step24–30のみ実行する。以下は保存履歴として維持する。新しいPlan Approval前には実装・build/test・公開操作を開始しない。mainだけが既存Testing Contractのtest-after（既存欠陥は再現Red→修正→同じGreen）に従い逐次実行する。mise lsで直接Node実体と版を確認し、以下nodeをその実体へ置き換える。新TSと対応JSは正式build/emit経由だけで更新する。

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.tests.json
node .build/scripts/emit.js
node --test --test-concurrency=1 tests/release/publication.test.js
node --test --test-concurrency=1 tests/release/workflow.test.js
node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js
node --test --test-concurrency=1 tests/ci/verification.test.js
```

新コンポーネントのfixtureは模擬公開先/承認/設定であることを明示し、実設定・認証成功に昇格させない。正常oracleをfixture自身の現在値から導出せず、独立したname/tag/version/tuple/SHAと期待判定を固定する。

publicationの8ケース群：正常RC候補を新outへ準備し旧v9不変、private:true拒否、repository未指定/違い拒否、同size候補改変拒否、許容外inventory/escaping symlink拒否、version/tag/dist-tag不一致拒否、public registry/access不一致拒否、既存outの上書き拒否。許可したmanifest差分以外のJS/wasm/types/notices/core build-infoは旧v9と原bytes同一を要求する。

workflowの8ケース群：正確な承認tag/repo/commitと全checksで公開到達、fork拒否、PR/branch/manual任意入力拒否、別tag/commit拒否、settings tuple不一致拒否、非0/timeout/skip/realm不足checks拒否、job外OIDCまたは検証job write権限拒否、npm token fallback/未検査tgz公開拒否。静的構文・fixture成功は遠隔OIDC成功とは呼ばない。yaml文字列を単に実装値へ一致させる試験ではなく、実際のworkflowを解析し別入力の公開到達可否とjob権限をassertする。

release境界の追加ケースはRCに公開済みRC受入れを要求しない正常例、stableで実RC受入れ欠落拒否、別候補/別registry versionまたは実導入diff改変拒否、実Trusted Publisher未観測/模擬入力を実設定へ昇格しない、具体的承認不一致拒否。既存release35件・CI13件は少なくとも全件保持し、新件数と失敗/skip0を原ログから記録する。

公開CLIは実装後、ローカルの専用identity/evidence fixtureを入力として下のplan/validateをmainが実行する。出力はRC/stableの具体的実行計画とblocked理由だけであり、ネットワーク変更・npm送信・外部設定変更・shell publishを実行しない。未指定repoは拒否し、npm scope名から推定しない。prepareはmainの承認後のローカル新candidate作成であり、旧証拠の書換えをしない。

```sh
node scripts/release/publication-cli.js plan <evidence-root> <request-json>
node scripts/release/publication-cli.js validate <publication-candidate-manifest-json> <identity-json> <exact-tgz>
```

Loop-back3の旧誤例はplanへidentity-json/evidence-json、validateへmanifest-json/identity-jsonだけを渡していた。R-06により上記へ訂正した。evidence-rootはindex/envelope/log/観測artifactを格納するディレクトリ、request-jsonはidentity/candidate/index/evidenceIds/approvals/publisherの入力、exact-tgzは検査する実archiveである。旧2引数validateはusage errorとなり、planのidentity JSONをrootへ渡す例は使わない。

新候補のpack/型と空consumer Node/Worker検証はtests/package/{pack,types}.test.jsと既存U1 browser runnerをmainが実在する新consumer/candidateへ指定し実行する。新candidateのSHAとsource pinsを記録し、既存最新CI438件の原証拠と意味不変部分だけを照合する。必要なfresh固定24 coverageは旧分母・80%以上・46receipt/全realm・seal条件を維持し、新generationへ結合する。遠隔実行はverify.yml既存runnerを使いsource head/raw artifacts/checksを再照合する。probe600秒/aube browser840秒/worker1/retry0/native一致/wasm1GBは変えない。新候補へ無条件に旧成功を付け替えない。

初回staged送信はpublic placeholderを作るため外部公開操作であり、dry-runや設定確認の代替として実行しない。repo作成/push/bootstrap/Trusted Publisher登録/RC・stable送信/Releaseはmainが候補・先・差分・承認対象を整えた後、各必要な最終承認を得て実行する。公開後のregistry tgz/integrity/dist-tag/Release asset読み戻しと、実RCのterrarium導入差分/版/受入れ成功が観測されて初めて該当条件を検証済みにする。認証情報やtokenをartifact/logへ保存しない。

## Current Verification — Loop-back 2, Steps18–23

今回の人間の依頼は「最新 collector を含む遠隔 CI」の検証である。最新collector実装・試験・正式生成JSを含むsource commitと実run headを照合することを必須oracleとする。旧runの読取り確認だけでは依頼完了にならない。公開RC導入やregistry設定の変更は追加しない。

現在の対象はplan Step18–23のみ。以下の手順は履歴であり、旧候補/旧pathへ無条件に実行しない。mainがmise lsと実インストール先を確認し、Node>=24の直接実体を使用する。以下のnode表記を解決済み絶対実体へ置き換え、shim/mise execを使わない。2026-10-10の観測実体は24.21.0/bin/nodeだが版を固定前提にしない。

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.tests.json
node .build/scripts/emit.js
node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js
node --test --test-concurrency=1 tests/ci/verification.test.js
```

期待値はrelease35件、CI13件、failure/skip0。collectorの既存Red→Green記録を採用する前に実装/試験SHAを照合する。追加欠陥は意図したRed→最小修正→同じGreenで検証し、runner不成立を製品Redとしない。stdout/stderr原bytesとSHA、executable/argv/cwd/envの非機密部分、開始/終了/exitを未使用verificationへ保存する。

遠隔では既存verify.ymlとscripts/ciの必須検証一覧を維持する。候補と入力は旧run38011644576のidentityを照合したうえで最新collectorを含むsourceへ結合し、実行前に正確なdispatch入力・候補commit・送信差分を保存する。remote source SHAを現在のTSと生成JSへ照合し、release旧33件だけの成功を最新35件へ読み替えない。Node/三ブラウザ/native/fresh固定24/80%以上/全receiptとrealmを原成果物から確認する。測定は重い並行処理なし。artifact一覧全件size/SHAとzip SHA、run head/job結論を照合し、Verified署名を確認する。

U1–U3、core/guest/候補tarballと旧証拠は不変。外部操作は具体的内容の承認範囲を確認してから実行する。最新source CIが成立しない場合はNFR3/Testing Contractを未検証とする。公開RC実受入れ・実設定・公開監査・Windows taskkillはそれぞれ観測がなければ未検証であり、ローカル140件/browser21件や旧remote成功で代替しない。

## Current Recovery Verification — 2026-10-10, Steps12–17

今回の対象はplan Step12–17のみ。以下の旧手順は履歴として保持し、再build/再測定/旧候補への無条件実行を指示しない。mainだけが逐次実行する。mise lsでNode>=24の実体を確認して直接実行し、shim/mise execを使わない。

新規read-only照合helperを実装後、mainが実行しstdout JSONを新規verification/ci-traceability-repair-v1/main-reconciliation.jsonへ保存する。候補・製品・旧証拠へ書かない。

```sh
node aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u4-release-assurance/code-generation/verification/ci-traceability-repair-v1/reconcile.mjs
node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js
```

CIの新規試験は実装後tests/ci/verification.test.tsへ5–8ケース群を作り、正式生成後にmainが次のUnit限定コマンドを実行する。必要なbuildは新CI実装を生成するための正式手順であり、凍結製品を補修するためではない。

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.tests.json
node .build/scripts/emit.js
node --test --test-concurrency=1 tests/ci/verification.test.js
```

正常identityを独立fixtureへ固定し、欠落/同size改変/別候補/未知入力、必須チェック失敗/timeout/skip/realm不足、危険な公開権限を否定oracleにする。新しい検証用workflowとrunnerの正確なargv/cwd/環境/入力供給/成果物一覧は調査後、実装・実行記録へ保存する。ローカルpathを遠隔で実在すると仮定しない。公式Actions仕様の確認と構文検査だけで遠隔成功を主張しない。

遠隔実行は必要な送信先・候補commit・差分・成果物移送を具体化し、既存公開制限に従って必要な最終承認後に行う。取得したrun head SHAと全job結果、原log/artifact SHA、fixed24/80%以上/skip0/全realm/候補・seal identityを照合する。不足は未検証・blockedとして具体化し、CI実行0件やローカル16/33件を遠隔成功へ置換しない。旧owner v8/pitchfork2.30.0と現在v9/2.30.1、保存coverageとfresh遠隔測定を区別する。

製品/core/guest/旧raw evidence/外部ownerを保持。全Code Generation完了までStop無効。正式レビュー後のチェックポイントは提示された既存承認済みコマンドだけを使用する。

## Current Recovery — U4 Major R-01

今回の対象は計画Step9–11とStep8/Amendment Dの完了記録。旧collector修正と以前の候補・測定は保存履歴として保持する。releaseの型/evidence/decision、専用fixture/testsと説明・記録だけを変更し、凍結U1/U2/U3、guest/core、旧receipt/証拠は変更しない。

正常な模擬RC受入れからterrarium情報欠落、diffSha256欠落/空文字/不正形式、実導入差分artifact参照欠落、原bytes同size改変、artifactDigests不一致、root外path/symlink、installedVersion等の不一致を作る。validateEvidence単体と保存→解決→stable判定の全経路を独立oracleで検証する。mainで意図したRedを観測後、明示artifact参照と原bytes SHAの結合を修正し同じ回帰Greenを確認する。模擬承認・公開は実承認・公開と呼ばない。

次のコマンドはmainのみ、直接Node実体を確認して順に実行する。生成.jsは正式build経由で更新し、手編集しない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.tests.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node .build/scripts/emit.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@biomejs/biome/bin/biome check scripts/release/types.ts scripts/release/evidence.ts scripts/release/decision.ts tests/release/fixtures.ts tests/release/evidence.test.ts tests/release/decision.test.ts
```

期待値を更新して不正入力を通さない。保存coverageの採用はsource/candidate/realm/execution sealのread-only照合に限定する。remoteCI/公開RC/実設定不足はblockedを維持し、以下の歴史的手順を無条件に再実行しない。

## Runner and Build

mainがmise管理のNode24/Bun実体を解決する。既観測Nodeは /Users/mutoakio/.local/share/mise/installs/node/24/bin/node、Bunは /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun。版番号を前提にせずmain実行時に実体/versionを確認する。正式buildは直接Nodeで node_modules/typescript/bin/tsc -p tsconfig.json、同 -p tsconfig.tests.json、.build/scripts/emit.js の順。生成.jsを直接編集しない。

## Scoped Tests

runner readinessとR-01 Red/Green：直接Node --test --test-concurrency=1 tests/terrarium/coverage.test.js。

U4新規層：直接Node --test --test-concurrency=1 tests/release/evidence.test.js tests/release/decision.test.js tests/release/collect.test.js。新規ファイルは承認後の実装対象で、現在存在すると主張しない。

変更したcollector回帰：直接Node --test --test-concurrency=1 tests/terrarium/adapter.test.js tests/terrarium/assets.test.js tests/terrarium/coverage.test.js tests/terrarium/acceptance.test.js。

package同一性と型：直接Node --test --test-concurrency=1 tests/package/pack.test.js tests/package/types.test.js（FORMICARIUM_CONSUMER=/private/tmp/formicarium-u1-consumer-v8、FORMICARIUM_CANDIDATE=.artifacts/u1-package-v8.manifest.json）。

## Fresh Coverage Commands

mainが実owner inputを照合しrecord/verification/coverage-input.jsonにout=.artifacts/u4-coverage-v1、site=/Users/mutoakio/Documents/terrarium/.vendor/site-formicarium-integration-2-bt、terrarium=/Users/mutoakio/Documents/terrarium、packageRootの実installed @aletheia-works/formicarium、U1 v8 tgzとU1 v11 reportの絶対path/SHAを記録する。直接Node scripts/terrarium/coverage.js prepare <input-json>。

直接Bun build .artifacts/u4-coverage-v1/terrarium/packages/terrarium/src/index.ts --outfile .artifacts/u4-coverage-v1/site/web/terrarium.mjs --format esm --target browser --define '__TERRARIUM_VERSION__="u3-coverage"'。承認後に追加する直接Node scripts/terrarium/coverage.js seal .artifacts/u4-coverage-v1 が実行copyを固定する。

FORMICARIUM_INPUTS_ROOT=/Users/mutoakio/Documents/terrarium/.vendor/formicarium-inputs-integration-2 を指定し、直接Node scripts/terrarium/coverage.js node .artifacts/u4-coverage-v1 <absolute-Bun>。browserは生成workspaceをcwdとして同input、TERRARIUM_BUN、TERRARIUM_SITE_DIRのabsolute instrumented site、PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright を指定する。直接Node /Users/mutoakio/Documents/terrarium/packages/terrarium/node_modules/@playwright/test/cli.js test --config playwright.formicarium.config.ts e2e/formicarium-terminal.spec.ts e2e/formicarium-iframe.spec.ts --workers=1 --retries=0。生成測定copyだけへ書き、外部ownerはread-only。最後に直接Node scripts/terrarium/coverage.js report .artifacts/u4-coverage-v1。

consumer6：TERRARIUM_ROOTとTERRARIUM_SITEを同owner root/BT site、browser cacheを指定し、直接Node node_modules/@playwright/test/cli.js test --config tests/terrarium/playwright.config.ts tests/terrarium/consumer.spec.ts --workers=1 --retries=0。

## Latest Pitchfork v2.30.1 Verification

対象は2026-10-08に公式latestとして観測したv2.30.1、commit1054549e85470b08d9507e2c82c850959a4b3914。mainがdist/guests/pitchforkとbuild-info/commit/patch、fixture/core/候補のSHAを実行前後に保存する。旧2.29.0 baselineのbytes/SHAをarchiveへ保存し、以下のnative実行から新baselineを作る。旧版は実行しない。

1. 正式TypeScript build後、直接Node --test --test-concurrency=1 tests/node/build.test.js でref/独立公式commit・供給物整合を検証。
2. FORMICARIUM_CONTAINER=docker FORMICARIUM_NODE=/Users/mutoakio/.local/share/mise/installs/node/24/bin/node bash scripts/native-baseline.sh pitchfork-basic --check-reproducible。ネットワークなしLinuxで同一ELFの2実行が一致したときだけbaselineを保存する。Dockerが使えなければ未検証で停止し、文字列置換で代替しない。
3. 直接Node --test --test-concurrency=1 tests/node/session.test.js tests/node/pitchfork-basic.test.js。
4. PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright 直接Node node_modules/@playwright/test/cli.js test tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0。

正常stdout/exitのnative一致と設定・ファイル状態の継続を既存oracleで検証し、Node120秒/browser600秒を維持する。元手順のcombined browser回帰ではpitchforkはこの成功結果を採用し同じsuiteを無理由に再実行しない。aube/probeは別suiteで逐次実行する。owner U3 v2.30.0結果は版別履歴として保持し、最新版terrarium入口受入れとは扱わない。

## Regression and Native Baseline

Nodeを逐次、exact filesで実行：直接Node --test tests/node/build.test.js tests/node/runner.test.js tests/node/probe.test.js、直接Node --test tests/node/aube-1645.test.js、直接Node --test tests/node/session.test.js tests/node/pitchfork-basic.test.js。

browserを逐次：直接Node node_modules/@playwright/test/cli.js test tests/browser/probe.spec.ts tests/browser/aube-1645.spec.ts tests/browser/pitchfork-basic.spec.ts --workers=1 --retries=0。指定回帰futex-deadline/page-fault-race/madvise-dontneedの実在するselection方法はrunner準備で確認し、その正確なargvをrecordへ保存する。baselineは bash scripts/native-baseline.sh pitchfork-basic --check-reproducible と既存aube/probe baselineの実bytes/取得元を照合し、必要なら既存対応commandを実行する。変更のないguestは再buildしない。

## Fixtures and Oracles

Standard：coverage修正5–8群、evidence7群、decision8群、collector7群。新規outとtmp fixtureでのみ改変を作り、元source/candidateを固定した測定copy/bundleの改変を検出する。旧receipt・旧out・正式owner証拠は不変。模擬承認と模擬公開済みRCを実承認・実公開に再ラベルしない。negative testは原因別エラーをassertし成功outputが残らないことを確認する。

## Coverage and Unverified Conditions

固定24ファイル、80%行coverage、未import分母維持、Node/Worker/3browser全realmとfresh executionIdentityを必須にする。U1同pack証拠は明示import。旧U3 80.56%は新sealの代替にしない。統合前CI/実RC受入れ/公開権限はローカル試験で代替しない。
