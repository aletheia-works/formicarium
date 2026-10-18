# Unit Test Instructions — U3 Terrarium Integration

## Test Framework Setup and Configuration

既存terrariumは Bun test + TypeScript + Playwright、formicariumはTypeScript authoring + 正式emitしたJSを使う。Node実体は `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node`。Bunは既知の実体 `/Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun` をmainが承認後にmise lsと照合する。shim/mise execは使わず、子processに必要な直接bin PATHを設定する。runner readinessはterrarium package cwdでBunに `test tests/catalog.test.ts` を渡してmainが観測する。これまでの成功値は過去観測でありcurrent candidateの合格へ流用しない。

既存mise.tomlの `terrarium:formicarium-unit`、`terrarium:formicarium-build`、`terrarium:formicarium-e2e` を再利用する。unitは下記3file、e2eは下記2specだけ。runner準備は最初の試験前に完了し、browserはworkers1/retries0。旧guest fetch/ci:e2e taskはU3のscoped検査に使わない。静的検査はBiomeの具体path指定とする。

## Unit-scoped Commands

全commandをmainで逐次実行。以下は現行file/taskを読取確認したコマンドで、今回の実行成功は未検証。

cwd: /Users/mutoakio/Documents/terrarium
- `mise run terrarium:formicarium-unit`: Bun test packages/terrarium/tests/formicarium-session.test.ts packages/terrarium/tests/formicarium-catalog.test.ts packages/terrarium/tests/formicarium-assets.test.ts。新規adapter/selection/asset境界のみ。
- `mise run terrarium:formicarium-build`: package型checkとU3 assets/site組立。型negative consumerもcompileし、wrong API型を拒否。
- `mise run terrarium:formicarium-e2e`: Playwright --config packages/terrarium/playwright.formicarium.config.ts packages/terrarium/e2e/formicarium-terminal.spec.ts packages/terrarium/e2e/formicarium-iframe.spec.ts --workers=1 --retries=0。Chromium/Firefox/WebKit全3project。

cwd: /Users/mutoakio/Documents/formicarium
- `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.json`
- `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/typescript/bin/tsc -p tsconfig.tests.json`
- `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node .build/scripts/emit.js`
- `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node --test --test-concurrency=1 tests/terrarium/adapter.test.js tests/terrarium/assets.test.js tests/terrarium/coverage.test.js`
- `/Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@biomejs/biome/bin/biome check scripts/terrarium/prepare.ts scripts/terrarium/evidence.ts scripts/terrarium/coverage.ts tests/terrarium/adapter.test.ts tests/terrarium/assets.test.ts tests/terrarium/coverage.test.ts tests/terrarium/consumer.spec.ts tests/terrarium/serve.ts tests/terrarium/playwright.config.ts`
- `TERRARIUM_ROOT=/Users/mutoakio/Documents/terrarium PLAYWRIGHT_BROWSERS_PATH=/private/tmp/formicarium-playwright /Users/mutoakio/.local/share/mise/installs/node/24/bin/node node_modules/@playwright/test/cli.js test --config tests/terrarium/playwright.config.ts tests/terrarium/consumer.spec.ts --workers=1 --retries=0`

Step1で新規candidateとinput.jsonのabsolute pathを記録する。terrarium側は `mise run terrarium:inputs`（FORMICARIUM_INPUTS_DIRに固定input directory）、frozen install、上記build taskで正式生成する。現U2候補はsite-repair-v1、aube2.7.0/2.6.1とpitchfork2.30.0を使用する。元tools catalogueとは異なる検証用defaultsであることを証拠へ残す。

collectorはStep10のfresh input JSONと未使用 `.artifacts/u3-coverage-repair-v2`（使用済みなら次番号）へ結合する。正確な実行形は `node scripts/terrarium/coverage.js prepare <absolute-input.json>`、`node scripts/terrarium/coverage.js node <absolute-fresh-output-dir> /Users/mutoakio/.local/share/mise/installs/bun/1.4.2/bin/bun`、`node scripts/terrarium/coverage.js report <absolute-fresh-output-dir>`。nodeは上記直接Node実体。generated workspaceのbrowser config/specをmainが一worker/no retryで実行し、TERRARIUM_BUN/SITE_DIRとsource/candidate identityをinventoryに一致させる。固定入力JSONと生成config/specのabsolute pathをコマンド実行前に証拠へ記録する。欠落、不一致、使用済みoutput、古いreceiptを拒否し、failed世代は消さない。

## Test Cases and Volume

標準5–8件/componentを最低とし、要件に必要なiframe/端末scenarioを追加。
- adapter8件以上: 正常/非0/失敗、split UTF8/順序、empty/unknown/shell拒否、public FS操作のC1/C4表、hardlink/mode/link/copy、nestedcwdで/work sibling保持、queue回復/dispose。
- catalog/assets各5–8件: 最新2toolと旧aube ref、explicit欠落拒否、default/fixture空/undefined、commit/hash、配置されたworker/core組、旧metadata保持、型negative。
- frontend8scenario以上×3browser: ready/events/transcript/run/keyboard/focus/switch/切断、実guestversionと連続操作、初期化/実行失敗と次run。
- iframe9セル＋各条件未承認親: C5の全条件、event.source/origin/type/command型、null/*/unknown origin、不正親へ通知なし。実行監視とmarker oracleを必須にする。

## Expected Coverage Targets

第一者配布JS全体で行80%以上、統合前CI。U1固定14 + U2固定3（U4基礎17）と既存U3追加対象を保持する。旧U3固定23 inventoryと現packの差分を明示し、14番目のruntimeを落として23へ合わせない。未import0%、realm欠落/旧receipt/source不一致は失敗または未検証。生成core/wasm、第三者xterm、guest、types、tests/demoは理由付き別検証。全体判定/CIはU4所有で、U3局所結果だけで合格を宣言しない。

## Mocking and Stubbing Guidance

unitはC1公開interfaceとfetchをstubして通知/失敗/FS翻訳を固定。Session内部stateやcore factoryを模倣して実互換成功と呼ばない。integration/browserは実tarball・実Worker・実最新版guestで確認する。iframe否定ケースは監視だけでなくguest marker副作用不在と組み合わせる。ローカルPages相当と実外部Pages配信結果を別statusにする。

## Test Data Management

U2 `.artifacts/u2-guest-distribution/site-repair-v1` の全11fileとdigestsを使用する。aube2.7.0 / pitchfork2.30.0を固定候補、aube2.6.1はref互換確認。現在の公式最新版とは断定せず、過去のpitchfork2.30.1結果と混ぜない。native基準は同一guest/fixture/sourceの既存証拠を照合し、stdout-onlyとstderr/code/raw bytesを別artifactにする。秘密データをfixtureに含めない。

probe600秒、aube browser840秒、pitchfork browser600秒/Node120秒、1worker/retry0、wasm1GBを維持。WebKitは実機Safariの証拠ではない。localpackは公開済みRC受入れではない。通常test-after、不具合は再現Red→同じテストGreenをmain出力で記録する。
