# Unit Test Instructions — U3 Owner Result Acceptance

## Current Recovery Verification — 2026-10-10, Steps13–17

今回の実行対象はplanのStep13–17のみ。以下のSteps8–12と旧build/測定コマンドは履歴として保持し、一括再実行しない。runner/configと実体ツールを確認した後、mainが新規読み取りhelperを実行する。

```sh
node aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/ci-traceability-repair-v1/reconcile.mjs
```

nodeはmise管理の実体を版番号固定なしで確認・解決して使用し、shim/mise execは使わない。helperは候補/測定/receipt/製品へ書かずstdoutへ結果を出力し、新規main照合記録だけを保存する。保存Node48件、3browser bridge6件、固定24JS/46receipt/1450対1801行80.51%・skip0、v9/v2.30.1と同pack v14 component importを期待値として実ファイルと照合する。保存試験件数の構造照合を新規試験実行と称さない。

代替coverage入力の計画は`.artifacts/u1-coverage-v<未使用の整数>`とし、既存componentImportの許可条件に合わせる。旧`u1-coverage-u3-current-v1`を今回実行する指示ではない。パス条件・same-pack/source/maps/1253realm/threshold/SHAの既存試験を確認し、追加の条件確認が必要な場合だけmainで`node --test tests/terrarium/coverage.test.js`をUnit限定で実行する。新しい製品実装やcoverage再測定はこの確認に含めない。代替経路のend-to-end実測は未実施なら未検証とする。

正式レビュー後のチェックポイント検証はAI-DLCが提示する既存承認済みコマンドを使用する。U3の実Safari、遠隔CI、公開RC・実Pages/service-worker・remote供給URLの未検証を保持し、旧owner承認を現在候補へ転用しない。StopフックはCode Generation全体完了まで無効のまま。

## Current Execution After Fresh Approval — Steps8–12

今回の実行は本節のみ。以下の旧手順は履歴として保持する。未承認実装/試験禁止、全実行mainのみ逐次。Nodeは/Users/mutoakio/.local/share/mise/installs/node/24/bin/node、Bunは/Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun。以下node/bun/npmはその確認済み直接実体で実行、子process PATHに当該binを渡す。原out/receipt/外部ownerを書換えない。

### Inputs and Exclusive Outputs

固定audit snapshotはverification/owner-evidence-pins-v1/audit/mutounomacbook-pro-local-320fc6ff4c22.md、旧pin SHA4c3f0ee158b86fc86a4de1a3c1a8a6278046bc1cff7f184afad6a1cd0bfa801f/111851bytes。current owner audit同pathは追加分だけbounded grammarで許可する。期待旧pinは変更しない。新入力verification/owner-audit-append-input-v3.jsonのauditSnapshotを固定path/SHA/sizeへ、outを.artifacts/u3-owner-acceptance-v3へ設定。旧owner受入れv1と再確認失敗v2を保持。

現候補入力verification/current-v9-candidate-input.jsonは既存terrarium root、source78 inventory pin、U1v9 manifest/.artifacts/u1-v9唯一tgz SHA dfcc3e…571f6d、corea882fb2…、既存aube2.7.0/pitchfork2.30.1 ELF/fixture/build-info/公式commit、resolverRootと新localout.artifacts/u3-current-v9-v1を明示する。新helperはexclusive rootを作り、copied terrarium/consumer/guest-site/site/web/inputsとnormalized descriptorをこのroot内だけへ構成する。入力descriptorのschema/16固定資産は外部prepare-formicarium.mjs正式仕様を読み、v9/新guestの実bytesから正規生成・verifyInputsで確認、旧descriptorを改ざんしない。既存supplier targetにv2.30.1の正規provenanceが組めなければ停止し、推測しない。

### Audit Red and Green

正式product/test build3段階、same regression commandをmainが修正前後に実行する。正常許可appendが旧実装で拒否されるRedを採用し、runner/型失敗をRedへ代用しない。回帰はprefix改変/削除・未知/state/revocation・重複field/不正timestamp/未完block/UTF8/NUL/上限・snapshot差替え・期間中driftを理由別assertで拒否、既存7群も保持する。

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.tests.json
node .build/scripts/emit.js
node --test tests/terrarium/acceptance.test.js
node scripts/terrarium/acceptance.js aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/owner-audit-append-input-v3.json
```

### Current Candidate and Noninstrumented Consumers

new current-candidate.ts実装後5–8 meaningful groupsを作る。mainの新helper CLIはinput JSONのみ、prepareは生成計画/input確認とexclusive directory構成、stageは明示正式stageFormicarium呼出し、buildはmain Bun。正常/out排他/24files/digest/ref/ELF/provenance/path/symlink/外部非変更を独立oracleにする。prepare.tsは明示packageRootを受け旧defaultも保持、current helperでimport compatibilityを新consumerへ確認する。

```sh
node --test --test-concurrency=1 tests/terrarium/adapter.test.js tests/terrarium/assets.test.js tests/terrarium/coverage.test.js tests/terrarium/acceptance.test.js tests/terrarium/current-candidate.test.js
node scripts/terrarium/current-candidate.js prepare aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/current-v9-candidate-input.json
npm install --prefix .artifacts/u3-current-v9-v1/consumer --ignore-scripts --no-audit --no-fund ./.artifacts/u1-v9/aletheia-works-formicarium-0.1.0-rc.1.tgz
node scripts/terrarium/current-candidate.js stage aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/current-v9-candidate-input.json
bun build .artifacts/u3-current-v9-v1/terrarium/packages/terrarium/src/index.ts --outfile .artifacts/u3-current-v9-v1/site/web/terrarium.mjs --format esm --target browser --define __TERRARIUM_VERSION__='"u3-current-v9-local"'
TERRARIUM_ROOT=/Users/mutoakio/Documents/formicarium/.artifacts/u3-current-v9-v1/terrarium TERRARIUM_SITE=/Users/mutoakio/Documents/formicarium/.artifacts/u3-current-v9-v1/site/web U3_PITCHFORK_REF=v2.30.1 node node_modules/@playwright/test/cli.js test --config tests/terrarium/playwright.config.ts tests/terrarium/consumer.spec.ts --workers=1 --retries=0 --output .artifacts/u3-current-v9-v1/bridge-results
```

helperはcopied owner terminal specの版oracle3箇所だけ.1へ変え、タイトル/ケース/その他assertを保持、original/copied hashesとexact変換を記録。source/web terminalは変更しない。copied configのbuild/stageは新inputs/siteを明示し、未設定なら旧入力へのfallbackを拒否する。mainはcopied terrarium/packages/terrarium cwdでFORMICARIUM_INPUTS_ROOT=<localinputs>、TERRARIUM_SITE_DIR=<local site>、TERRARIUM_BUN=<direct Bun>を設定し、既存Playwright cliのplaywright.formicarium.config.ts / e2e/formicarium-terminal.spec.ts / e2e/formicarium-iframe.spec.tsをworker1/retries0で45cases実行、new current-v9-v1/owner-copy-browser-resultsへ保存。旧136/45/34+2skipは新件数へ合算しない。

### Fresh Fixed24 Coverage and Seal

current-v9-coverage-input.jsonはout.artifacts/u3-coverage-current-v9-v1、terrarium=<newlocalcopy>、site=<newlocal site/web>、packageRoot=<newconsumer>/node_modules/@aletheia-works/formicarium、tarball=v9、u1Report=.artifacts/u1-coverage-v14/coverage-report.jsonを明示。現componentImportはexactcandidate、threshold80/passed、予定1253realm完全一致、14source/mapsを要求する。事前にそのまま検証し不一致ならwaiver禁止。必要時だけmainが新U1collector世代u1-coverage-u3-current-v1へ既存固定12Node/全6compiled browser/reportを逐次実行し同じstrict checksを再確認、凍結U1記録/source/旧outに書かない。

```sh
node scripts/terrarium/coverage.js prepare aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/current-v9-coverage-input.json
bun build .artifacts/u3-coverage-current-v9-v1/terrarium/packages/terrarium/src/index.ts --outfile .artifacts/u3-coverage-current-v9-v1/site/web/terrarium.mjs --format esm --target browser --define __TERRARIUM_VERSION__='"u3-coverage"'
node scripts/terrarium/coverage.js seal .artifacts/u3-coverage-current-v9-v1
FORMICARIUM_INPUTS_ROOT=/Users/mutoakio/Documents/formicarium/.artifacts/u3-current-v9-v1/inputs node scripts/terrarium/coverage.js node /Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-current-v9-v1 /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun
node scripts/terrarium/coverage.js report .artifacts/u3-coverage-current-v9-v1
```

Node後/report前にmainはfresh copied packages/terrarium cwdで入力root=<newlocalinputs>、TERRARIUM_SITE_DIR=<freshout>/site、TERRARIUM_BUN=<direct Bun>を設定し、同config/terminal+iframe2spec/45casesを3browser worker1/retries0で逐次実行する。seal後source/test/config/preload/bundleを書換えない。Node/browser開始前後/reportのseal、generation/source/candidate、U1report hashを検査。fixed24/未import0/未収集realm失敗/skip0/80%以上維持。拒否があれば意図Red→限定collector修正→新末尾2で全測定、旧失敗を残す。

### Freeze and Limits

mainが対象TSだけBiome/型検査し、原core/guest/tgz/owner source前後SHA、全commands/log/code/fixture/候補/SHAを保存する。U3新候補実Safari・公開RC・remoteCI/Pages/serviceworker未検証。既存probe600/aube840/pitchfork600/Node120、1worker/retry0/1GBを維持。Step12 documentation/sensors後freeze、mainのみ正式review/Unit手続。owner新候補承認・外部source書込み・公開操作・未知修正・旧out overwriteなし。

## Historical Approved Instructions — Previous Candidate Only



## Framework and Readiness

TypeScript/node:test/Playwright/Biomeを再利用する。mainのみが直接mise実体で逐次実行する。Nodeは `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node`、Bunは `/Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun`。実行前に存在/版を確認し、子processにも直接bin PATHを渡す。shim/mise execは使わない。新実装はtest-after、既存不具合はmain Red→修正Green。再Approval前の実装/実行は禁止。

## Fixed Owner Evidence

owner recordは `/Users/mutoakio/Documents/terrarium/aidlc/spaces/default/intents/261008-formicarium-integration-2`。正式receipt `.aidlc-engine/reviews/code-generation/stage/826a9a551ecd3d72/1.json`、request_id `review:00ea057e81e3a59480e2c2297b99eeb6`、source_fingerprint `5fba77e90f0bbc0c52724e6ed63ddb68c813654bc98800c74bc1ccb9734ab53a`、独立review本文、matching code-generation/build-and-test auditのGATE_APPROVED/STAGE_COMPLETEDを消費する。単なるREADY文字列を受け入れない。

mainの `verification/owner-planning-readonly.json` の原bytes SHA、正確なsource/evidence参照一覧、receipt/request/intent/承認・完了eventを期待値へpinする。受入れ前に期待参照の原bytesを新規outへ保存・照合する。validatorは外部receipt/auditを変更しない。source78集合digest b70c328cf9d309a18a6dc06eccde0817b0c3a78bf6f7b513ea4cb159beee2f99、checks15 commands/log SHA、input16全path/size/SHA、formicarium69entries/legacy22entriesのkind/file/link/directoryを照合する。現在BT siteはterrariumの `.vendor/site-formicarium-integration-2-bt`、legacyはsite-legacy-integration-2-bt、入力はformicarium-inputs-integration-2。外部source・旧入力・旧候補を編集しない。

## Formal Build and Local Tests

cwd `/Users/mutoakio/Documents/formicarium`。正式buildを個別実行し、既存ローカル21testsと新7ケース群を別記録する。exact U3filesだけを選択する。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.tests.json
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node .build/scripts/emit.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-concurrency=1 tests/terrarium/adapter.test.js tests/terrarium/assets.test.js tests/terrarium/coverage.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test tests/terrarium/acceptance.test.js
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@biomejs/biome/bin/biome check scripts/terrarium/acceptance.ts scripts/terrarium/prepare.ts scripts/terrarium/evidence.ts scripts/terrarium/coverage.ts tests/terrarium/acceptance.test.ts tests/terrarium/adapter.test.ts tests/terrarium/assets.test.ts tests/terrarium/coverage.test.ts tests/terrarium/consumer.spec.ts tests/terrarium/serve.ts tests/terrarium/playwright.config.ts
```

TS編集後は正式emitした.jsを実行し、installed/generated productを直接補修しない。

## Acceptance and Consumer Commands

mainが `verification/current-owner-acceptance-input.json` に全絶対参照、pinした期待SHA、owner receipt/audit、現在source/input/candidate、out `/Users/mutoakio/Documents/formicarium/.artifacts/u3-owner-acceptance-v1` を明示する。CLIはacceptance.js <input.json>。使用済みoutは拒否し別番号を選ぶ。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/terrarium/acceptance.js aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/current-owner-acceptance-input.json
TERRARIUM_ROOT=/Users/mutoakio/Documents/terrarium TERRARIUM_SITE=/Users/mutoakio/Documents/terrarium/.vendor/site-formicarium-integration-2-bt PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/terrarium/playwright.config.ts tests/terrarium/consumer.spec.ts --workers=1 --retries=0
```

bridge既存6casesを三browserで現候補へ実行する。owner136unit/専用45browser/legacy34+2既存skipは正式外部観測であり今回のローカル件数へ合算しない。C4/C5 source・owner test/log・local acceptance/bridgeの対応を明示する。

## Cases and Negative Oracles

Standard7ケース群：正常正式owner、source集合/digest drift、input欠落/改変、両candidate kind/link/bytes drift、command nonzero/重複/欠落、log SHA不一致、receipt/request/audit gate/intent欠落・不一致。正常系は固定owner参照を読み、成功はその同bytes照合に限定する。負例は一時fixtureで再現し、外部source/receipt/auditへ書かない。期待count/SHAを変更して負例を通さず、秘密ログを公開ログへ無条件転記しない。

## Fresh Coverage Commands

固定inventory24＝U1十四/U2三/U3七、行80%以上。mainが `verification/current-owner-coverage-input.json` に現在terrarium root/BT site、同pack packageRoot/tgz、同pack/source/mapsのU1 v11 report、fresh out `/Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-owner-v1` を固定する。旧repair-v2 source26cc…/candidate711e…/80.56%を新結果へ流用しない。

```sh
/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/terrarium/coverage.js prepare aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/verification/current-owner-coverage-input.json
FORMICARIUM_INPUTS_ROOT=/Users/mutoakio/Documents/terrarium/.vendor/formicarium-inputs-integration-2 /Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/terrarium/coverage.js node /Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-owner-v1 /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun
```

prepare返却のmainBundleRequiredを直接Bunで実行する。entryはfreshout/terrarium/packages/terrarium/src/index.ts、outfileはfreshout/site/web/terrarium.mjs、format esm/target browser、coverage版defineは返却値と同じ。生成config/specの絶対pathと観測commandを記録する。

mainのcwdを `/Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-owner-v1/terrarium/packages/terrarium` にして実行する。

```sh
FORMICARIUM_INPUTS_ROOT=/Users/mutoakio/Documents/terrarium/.vendor/formicarium-inputs-integration-2 TERRARIUM_BUN=/Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun TERRARIUM_SITE_DIR=/Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-owner-v1/site PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node /Users/mutoakio/Documents/terrarium/packages/terrarium/node_modules/@playwright/test/cli.js test --config playwright.formicarium.config.ts e2e/formicarium-terminal.spec.ts e2e/formicarium-iframe.spec.ts --workers=1 --retries=0
```

cwdをformicarium rootへ戻し `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node scripts/terrarium/coverage.js report /Users/mutoakio/Documents/formicarium/.artifacts/u3-coverage-owner-v1` を実行する。owner transaction/assemblyへのcollector適合が必要ならmainの同じRed後に最小修正し、新番号で測定する。failed世代を保全しbindingを緩めない。

## Quality and Handoff Limits

未import0、未収集realm失敗、旧receipt拒否、same-pack immutable U1 importを維持する。probe600秒/aube browser840秒/pitchfork browser600秒Node120秒/1worker/retry0/wasm1GB、統合前CI必須は不変。U1/U2 frozen、外部source/旧input/siteの変更禁止。実Pages/service-worker/公開RC/実Safari/remote CI/供給URL到達性/U4release判断は別所有・未検証。

再Approvalとローカル実装後にsource-manifest/docs/summary/traceabilityを現在所有へ結合し、歴史archive・外部owner参照を保持してnative sensors/正式U3reviewへ渡す。admission拒否時は未完了とし、claim単純除去/registry編集/receipt偽装で進めない。
