AIDLC-UNIT: u3-maintenance-workflows
AIDLC-TESTING-CONTRACT: sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14

## Files and commands

Write and edit files yourself with your file tools, never through the shell (no heredoc, no `echo`, `printf`, or `python3` writing a file, no `sed -i`, no `mkdir`; the file-write tool creates any missing folder). A command the person asks for, or one the plan names (a package install, a build, a scaffolder, a migration, a formatter, a code generator, even a `mkdir`), still runs as written. Read, list, and search (your own knowledge files included) with your file tools where you have them; where the shell is your only way to read, use one plain read command (no `cd` before it, no pipe or second command after it). Run every AI-DLC command exactly as written, as a command of its own (no `cd` before it, no pipe or second command after it), keeping its path as written (never a full path): a shell line can stop and ask the person to approve it.

## The plan file

Tick each step's box in `aidlc/spaces/default/intents/261010-bun-ci-modernization/construction/u3-maintenance-workflows/code-generation/code-generation-plan.md` as you finish the step. That is the only change you make to that file.

## Approved plan

# Code Generation Plan — U3

## Summary
- Builds: 有限のGitHub取得・無権限再現・独立C2/C3照合から整形pushと依存mergeへ接続する保守入口、ラベル、更新PR設定。
- Touches: 新U3 TS/試験、保守workflow/config、tracked trusted runner bundle、README保守節。既存U1/U2 providerと公開RCは変更しない。
- Tests: 4境界component各8件＋実接続7件の計39件を層ごとの実装後に作成し、mainの対象試験Green後に次層へ進む。

## Scope and Integration

計画・ドキュメント根拠。U3の実装と試験は未検証。外部App/secret/保護設定、push、PR、npm、Releaseはこの承認に含まない。更新PRはRenovate Appに任せ、自身automergeは無効。U3は承認済みMaintenanceOperationsの取得・認証・分類・再現・操作責任を持つ。取得元真正性はU2の自己申告booleanでは保証できないため、GitHubの独立観測と信頼default branch固定SHAをU3で確認する。

U1 ordinary receiptはquality/commit-formatの2jobだけを記録する。APIからquality/commit-format/ci-requiredの3jobとcheck producerを取得し、2jobの一致を確認後にC2の3check envelopeを構築する。ci-required成功をreceiptへ捏造しない。runのAPI head SHAと実checkout PR head/receipt source SHAが異なる場合は、PR・check suite・workflow実行との対応を独立取得して一致を証明し、証明不能なら拒否する。U2 adaptMaintenanceEvidence→evaluateMaintenance(request, trustedPolicy)の2引数を再利用する。共通3checksを両操作に維持しlint失敗時の自動整形は拒否する。

必要なproducer App ID/workflow ID/path/hash、Renovate actorのimmutable ID/type、toolchain、repository、固定formatter/config、allowlistはtrusted設定で保持する。未設定/不明値を許可するfallbackは作らない。真正IDの外部確認・設定適用前はwriter無効を明記する。U1/U2のschema変更が必要なら実装で迂回せず主セッションへ契約調整を返す。

## Planned Files

| 担当 | 新規/変更path |
|---|---|
| 有限取得・archive・証拠 | scripts/maintenance/github.ts、archive.ts、receipt.ts |
| 分類・再現 | scripts/maintenance/reproduce.ts |
| 外部操作・CLI | scripts/maintenance/operations.ts、runner.ts |
| metadata・bundle生成 | scripts/maintenance/metadata.ts、bundle.ts |
| trusted設定 | .github/maintenance/policy.json、label-rules.json |
| tracked実行供給 | .github/maintenance/runner.mjs |
| workflow | .github/workflows/maintenance.yml、pr-labels.yml |
| 更新PR | renovate.json |
| 試験 | tests/tooling/maintenance-acquisition.test.ts、maintenance-reproduction.test.ts、maintenance-operations.test.ts、maintenance-wiring.test.ts、maintenance-integration.test.ts |
| 文書 | README.md保守節のみ |

既存scripts/maintenance/{input,evidence,policy}.ts、scripts/ci、ci.yml、publish.yml、package/mise/lock/TypeScript/lint設定は変更しない。既存test:lightのtooling globとbuildを使う。source-manifestは実際の上表のsource/config/workflow/test/READMEとtracked runnerを書込み対象として記録し、ignored生成JSは別inventoryへ分ける。

## Steps

1. [ ] main sessionで既存runner/configとU1/U2 baselineを確認し、既存5tasksの再利用と本手順書のU3限定commandを確定する。新試験の生成前に存在しないJSを実行しない。Bun1.4.2/Node24.21.0/Biome2.5.15とstrict TSを維持する。（FR4–7/9、NFR1.1/NFR4.1）
2. [ ] github.ts/archive.ts/receipt.tsを実装する。固定GitHub API origin・Accept/API-version・Bearer headers、endpoint/GraphQL variablesのschema、redirect allowlist、pagination上限を実装する。read1要求10秒・全取得60秒・retry最大2回、writeはretryしない。stream受信累積でcompressed8MiB、member最大16、展開aggregate8MiB、個別JSON/diff8MiB、source最大500files/合計8MiBをcopy/hash/JSON parse前に拒否する。Node builtin zlibでZIPを上限付き展開しcentral/local header・サイズ/CRC・重複・絶対/親path・symlink・暗号化/未知形式を検証し、安全なreceipt.json等の固定member以外を拒否する。未知archiveをshellで展開しない。API run/attempt/repo/event/PR/head/job/check suite/producer App ID/workflow ID/path/hash、actual artifact bytes、receipt2jobと期待toolchain/lockを照合し、独立C2 3checkへ正規化する。PRで改変したCI定義・trusted設定・公開境界、fork/closed/曖昧PR、偽producer/古いrun/失敗checkは拒否する。（FR5–7、NFR2.1/NFR3.1/NFR5.1/NFR5.2）
3. [ ] maintenance-acquisition.test.tsへ8件を作りmainのbuild→対象試験を実行する。正常bounded API/ZIP/2→3check、HTTP request/headers/pagination/redirect、10秒/60秒/retry/rate-limit/403/cancel、8MiB直前/丁度/+1のstream中断、ZIP16/17members・symlink/path/duplicate/bomb/CRC拒否、receipt/run/attempt/SHA/toolchain改変、偽producer/CI hash/check状態拒否、fork/closed/複数PRと無効metadataをtableで検証する。Green通知まで次層を実装しない。（Step2対応）
4. [ ] reproduce.tsを実装する。trusted base依存だけをignore-scripts/frozen導入したreadonly場所で、API取得済みUTF8 regular TSを隔離しBiome formatのみを固定base configで実行する。PR script/config/pluginは実行しない。runtime/scripts/testsとindex.tsの許可境界、500files/8MiB、rename/delete/symlink/binary/未知分類、公開境界変更を拒否する。元head bytesと完全再現した置換bytes/差分digestを対応づける。依存はtrusted manifestから既存dev依存1字段の厳密stable版変更だけを適用し、Bun1.4.2 ignore-scripts lock生成→frozen導入、候補manifest/lock全bytes完全一致とresolved from/to stable版を確認する。range/未知/追加削除/0/2件/major/pre/Action/mixedは拒否する。依存更新時receiptのlockDigestはtrusted旧lockとの直接一致ではなく再現済み候補lockへ照合する。再現結果をC2 adapterと2引数C3へ接続する。（FR6/FR7、NFR1.1/NFR1.2/NFR2.1/NFR2.3/NFR3.1）
5. [ ] maintenance-reproduction.test.tsへ8件を作りmainで実行する。整形完全一致、空no-op/矛盾、非整形/再現不一致/固定config、全file分類拒否、依存patch/minor1件、直接0/2とrange/major/pre/追加削除、lock/manifest無関係差分、無credential・PR script未実行/C2→C3接続を検証する。実Bun/Biomeの小さな隔離fixtureを使い重いguestを再buildしない。Green後に次層へ進む。（Step4対応）
6. [ ] operations.ts/runner.tsのprepare・format-write・dependency-merge入口を実装する。writerはtrusted base fixed SHAのbundle/configだけを実行しinstall/build/PR checkoutをしない。prepare artifactはdataとしてschema/byte/digest/run/attempt/baseSHA/producer/再現jobを独立照合し、artifact allowのコピーで操作しない。write直前にopen/sameRepo/current head/全3checks/必要main保護/真正botを再GETし、U2判定を再確認する。formatはGraphQL createCommitOnBranchのexpectedHeadOidと検証済みfileChanges additions、固定Conventional Commit headline。mergeはREST sha=Decision.headSha・merge_method=squash。queue/stacked/削除branch/保護不明は拒否する。write1要求10秒・最大1回、GraphQL HTTP200 errors/REST拒否を成功へしない。timeout等結果不明は有限readでhead/commit parent/tree/merged状態を照合しsuccess/failure/unknownへ分け、再送しない。reject/no-op0回、重複既適用no-op。固定reasonとMaintenanceAttemptのPR/head/run/attempt/Decision/policy/operation/resultingShaだけを記録する。（FR6/FR7、NFR2.2/NFR3.2/NFR3.3/NFR5.3）
7. [ ] maintenance-operations.test.tsへ8件を作りmainで実行する。fake HTTPでGraphQL query/variables/expectedHeadOid/fileChangesとREST path/body/sha/squash/headerを実際に捕捉する。各正常1回、直前head競合/保護不明/queue/fork、reject/no-op0回、GraphQL200 errors/403/409/cancel、timeout結果照合success/failure/unknownと再送0回、重複イベントを検証する。Green後に次層へ進む。（Step6対応）
8. [ ] metadata.ts/bundle.ts、trusted policy/label rules、renovate.json、2workflow、README保守節を実装する。labelはpull_request_target metadataだけ、trusted runner、PR checkout/install無し、固定pathカテゴリを複数付与し無関連labelは変更しない。任意title/bodyをshell展開しない。Renovate bun/github-actions manager、週次、Bun単一依存PR、Actions別group、自身automerge/lock-only maintenanceをdisabled。allowlistは現行dev依存を固定列挙しrangeは自動merge拒否を説明する。
maintenance.ymlはCI completed workflow_run→readonly prepare30分→目的別App writer/merge10分とrecord。label5分、write共通PR concurrency cancel-in-progress false、artifact7日、公開OIDC無し。目的別App ID/private-key secretとrepo限定token、必要readとcontents writeのみ、保護bypass/workflow編集不可。actions/create-github-app-tokenを含む全Action fullSHAは実装時に公式release/tag/action.ymlで検証しsourceに固定する。設定未適用時fail closed、停止/権限取消/unknown手動照合/整形lint拒否手順を記載する。（FR4/FR5/FR9、NFR1.1/NFR2.1/NFR2.2/NFR5.1/NFR5.3）
9. [ ] mainの固定Bun1.4.2でNode target単一bundleを生成し.github/maintenance/runner.mjsをtracked供給する。runnerはNode builtin依存だけで動作しBun runtime API/新npm依存を持たない。bundle.tsの生成入口はBun CLIを引数配列で呼び、同一source→同一bytesをtemp出力で照合できる。write jobはこのbundleをtrusted default branch固定SHAからcheckoutしsourceSHAとbundle供給を確認、PR bundle/hashは実行しない。readonly通常light試験で再生成一致を検証する。Bun builtin buildでNode builtinを外部参照として保ち、token Action自身のNode runtime対応も確認する。（NFR1.1/NFR2.1、Executable Supply）
10. [ ] maintenance-wiring.test.tsへ8件を作りmainで実行する。Renovate周期/manager/group/単一/dev/automerge拒否、label複数カテゴリ/fork/無関連/敵対title、policy必要3checks/immutable actor・設定欠落拒否、workflow最小権限/trigger/timeouts/concurrency、write無install/PRcheckout、trusted固定SHA供給、固定Bun bundle再生成bytes一致とNode実行、bundle/供給改変拒否を検証する。新workflowのみactionlintをmainで実行する。Green後に結合へ進む。（Steps8–9対応）
11. [ ] maintenance-integration.test.tsへ7件を作りmainで実行する。fake GitHub HTTPのrun/2job receipt→3check→無権限再現→実U2→直前再GET→具体APIの正常formatとdependency、改変/CI定義変更/producer偽装、古いhead/atomic競合、直接0/2/Action/混合、超過byte/timeout/取消、結果不明/重複を一連で検証する。全拒否/no-opにwrite0回、allow最大1回を検証する。純粋U2をstubでallow固定へ置換しない。（FR4–7、NFR3/NFR4.1/NFR5）
12. [ ] mainで対象整形、既存承認5tasks、U3限定39件、actionlintとbundle再生成一致を逐次確認する。結果はverification/local-observations.mdへ記録する。初回不具合は同じ再現試験のRed観測後修正、同じcommandのGreenを確認する。実GitHub CI/固定配布JS80%以上/全realm receipts/実atomic競合/App適用と区別する。（NFR4.1）
13. [ ] code-summary.md、traceability.json、source-manifest.jsonと別generated-artifacts inventoryを生成し独立reviewへ提出する。tracked runnerをmanifestから落とさない。source-manifestはengineの指定schemaに従い、writesはpathだけとしextra sha256字段を追加しない。hashは別inventoryへ記録する。承認済み計画の内容・手順書・Testing Contractを書換えず、完了checkboxだけ更新する。（FR9、NFR5.3）

## Verification Boundaries

本計画のfake transport/局所再現は実GitHubでのatomic競合、App token権限・CI再起動・保護設定・定期更新稼働の証拠ではない。統合前実CIと固定第一者配布JS行coverage80%以上、欠落を分母へ保持、全realm/Worker/process receiptsは別受入れで必要。probe600秒、aube840秒、1worker、retry0、8項目/native一致、wasm1GBとAtomics.waitAsync除去、既存公開RCは維持する。実機Safariは未検証のまま区別する。

## Sources

- planning-dispatch.md（現行rulesとTesting Contract）
- ../nfr-requirements/{security-requirements.md,tech-stack-decisions.md}
- ../nfr-design/security-design.md D1–D5
- ../infrastructure-design/{infrastructure-specification.md,monitoring-design.md,cicd-pipeline.md}
- ../../../inception/requirements-analysis/requirements.md FR4/FR5/FR6/FR7/FR9、NFR1–5
- ../../../inception/contract-design/contract-summary.md C1/C2/C3
- ../../../inception/units-generation/{unit-of-work.md,unit-of-work-story-map.md}（User Stories適用外、FR合格条件を直接対応）
- ../../../inception/domain-design/components.md MaintenanceAttempt/Operation
- root U1/U2 source、ordinary-receipt.ts、ci.yml、package/lock/TS設定（読取integration根拠）

## Assumptions & Open Questions

None. provider変更は計画に含めない。実装時にAPIでPR head/run/checkの対応又はbundle runtimeを保証できない場合は主セッションへ具体的契約調整を返し、自己申告成功へ補正しない。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。",
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
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の実装は各テスト可能な層の実装後にテストを作成・実行し、不具合修正は再現テストの失敗を観測して修正後に同じテストの成功を確認する。\n- ビルドとテストはmain sessionで逐次実行する。Node向けconsumer、Worker、process.execPath、Node専用flagの意味を確認し、Bunへ一括置換しない。Bun実行を採る箇所は実結果で互換性を確認する（未検証）。\n- 既存Biome・TypeScript・Playwright・node:testを証拠として使う。通常PR/main CIは固定候補入力を要求しない軽量経路から整備し、重いnative/ブラウザ回帰・配布coverageは別の明示経路へ対応づける（提案）。軽量CI成功だけで全受入れを通過したと扱わない。\n- 統合前CIと第一者配布JS固定一覧の行coverage80%以上を維持する。未収集ファイルを分母から消さず、Worker/別process/realmも記録し、欠落・skipを成功へ置換しない。\n- probe600秒、aubeブラウザ840秒、1worker、retryなし、probe8項目合格、native出力一致、wasm1GBを維持する。未変更aubeは再ビルドせず、計測時に重い処理を並行しない。新規コア回帰はnative Linuxでも確認する。実機Safariは未検証のまま区別する。"
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
  "input_sha256": "sha256:c174dde61b23d97d1733ad98b91568ee85c7de913db166d498965b6845a4c286",
  "contract_sha256": "sha256:10b6f50c2e853225a46984ab35ccfb615ca938fd59f89dd0c81174ba91834d14"
}
```

## Approved unit-test instructions

# Unit Test Instructions — U3

## Status and Runner

計画段階、U3未実装・未検証。Plan Approval後main sessionだけが全install/build/testを逐次実行する。既存Bun1.4.2/Node24.21.0/Biome2.5.15とstrict TypeScript/node:test、U1 tasksを使う。新tests/toolingは既存test:light globで取り込むためprovider設定を編集しない。直接実行実体はmise ls/設定から解決しshim/mise execを使わない。Node builtin依存の実行とBun開発/再現を分ける。

## Preparation Commands

層ごとmainが既存build成功を確認してから対応生成JSを実行する。source test作成前に欠落JSを実行しない。declared tasksはmise runで実行する。

```sh
mise run install-frozen
mise run typecheck
mise run build
```

tracked bundle初回生成（bunはmise管理の固定実体へ解決）：

```sh
bun build scripts/maintenance/runner.ts --target=node --format=esm --packages=bundle --outfile=.github/maintenance/runner.mjs
```

新依存なし。生成入口bundle.tsも同じ固定版/引数を配列で使い、temp再生成bytesをtracked runnerへ照合する。writer側ではこのcommandもinstallも実行しない。

## Scoped Layer Commands

```sh
node --test .build/tests/tooling/maintenance-acquisition.test.js
node --test .build/tests/tooling/maintenance-reproduction.test.js
node --test .build/tests/tooling/maintenance-operations.test.js
node --test .build/tests/tooling/maintenance-wiring.test.js
node --test .build/tests/tooling/maintenance-integration.test.js
```

順に8/8/8/8/7トップレベル試験、各拒否表はnamed subcaseとして全境界をassertする。実装→試験作成→mainの同層Green→次層を守る。layer単体importで他testが登録されないようfixtureはその試験に閉じる又は非test moduleの適切なsource helperを使う。

最終U3限定command：

```sh
node --test .build/tests/tooling/maintenance-acquisition.test.js .build/tests/tooling/maintenance-reproduction.test.js .build/tests/tooling/maintenance-operations.test.js .build/tests/tooling/maintenance-wiring.test.js .build/tests/tooling/maintenance-integration.test.js
```

新workflowだけの静的検査：

```sh
actionlint .github/workflows/maintenance.yml .github/workflows/pr-labels.yml
```

actionlintとshellcheckもmise管理実体を解決する。既存全suite commandへ対象commandを差替えない。既存5tasksと既存light成功はmainの完了検査で別途確認する。

## Acquisition Fixtures — 8 Cases

正常REST/GraphQL requests・headers・variablesを捕捉するfake fetch/transport、有限時計・AbortSignal、実ZIP header/deflate/CRC fixtureを使う。compressed/展開/JSON/source/diff 8MiB丁度と+1、member16/17、500filesと超過を固定bytesで試験し、超過streamはcancelされcopy/hash/parserへ進まないことをassertする。虚偽Content-Length、長さ未申告、redirect、zip path/symlink/duplicate/CRC/未知形式を含む。

read10秒/全60秒/retry最大2回はfake clockで観測しreal sleepを使わない。権限403、rate-limit、timeout、cancel、pagination打切りは成功としない。run/attempt/repo/head/PR/producer AppID/workflow path・hash、artifact actual digest、receipt2job→API3check、toolchain/lockを独立objectで作り個別改変を拒否する。

## Reproduction Fixtures — 8 Cases

実Bun/Biomeの小さいtemp fixtureをmain test実行内で逐次呼ぶ。trusted configとtrusted manifestだけを実行環境へ渡す。敵対PR scripts/config/registry、UTF8以外、symlink/delete/rename/binary、公開境界変更のfixtureで実行0回又は拒否を確認する。整形完全bytes/digestとno-op矛盾、stable唯一直接dev更新・resolved from/to・lock bytes完全一致を検証する。range/major/pre/0/2/追加削除/Actions/mixed・不関連transitive lockは拒否する。

Bun/network再現のfixtureはローカル固定package metadata/assetを使い外部registry通信・外部writeを行わない。実installを使うfixtureは受動データだけ、ignore-scriptsと無credentialを確認する。無変更guestの再buildは行わない。実U2 adapter/policyを通し必要3checksのlint失敗整形拒否を維持する。

## Operations Fixtures — 8 Cases

外部API形式と原子的head引数の試験はfixed fake HTTPで実requestを捕捉する。GraphQL expectedHeadOid/fileChanges additions、REST PUT merge sha/merge_method=squash、固定Conventional Commitをassertする。事前GETだけで成功とするfakeは禁止する。直前再GETでhead/open/sameRepo/checks/保護/botが変わるcase、queue/stacked/削除branchを拒否する。

全reject/no-opでwrite0回、各allowで最大1回。HTTP200 GraphQL errors、403/409、timeout/cancel、結果照合success/failure/unknown、重複イベントはnamed tableで検証しwrite再送0回をassertする。ログ/Attemptにcredential/API本文/任意PR本文がないことも確認する。

## Wiring and Integration Fixtures — 8 + 7 Cases

設定・workflowは実ファイルを読み、Renovate周期/bun/actions分離/単一更新/自身automerge無効、label複数カテゴリ/fork/無関連/敵対本文、必要3checks/producer/actor immutable設定、trigger/timeout/権限/concurrency/artifact7日をassertする。write jobのinstall/build/PRcheckout無し、trusted SHA固定・bundle供給を拒否境界として確認する。Node builtinだけのbundleを固定Bunでtemp再生成しtracked bytes一致とNodeの無依存実行を観測する。Action SHAは公式repo tag/release/action.ymlの確認結果と対応させる。

結合7件はfake HTTPの実取得→実bounded decode→U1 receipt正規化→小さい無権限再現→実U2→再GET→固定APIの経路を通す。C2/C3をallow stubへ置換しない。正常2操作と主要拒否表で起動回数を観測し、byte/CI改変/偽producer/古いhead/依存件数/通信不明/重複を網羅する。

## Pass and Records

U3限定39トップレベル件、fail0/skip0、named拒否表全合格が局所条件。build/type失敗なら古いJSを結果に使わない。不具合はmainが同一再現試験Redを観測してから修正し同commandのGreenを確認する。Plan Approval後は本手順書・計画内容を書換えず、結果はverification/local-observations.mdへmain実行者/日時/checkout/実体版/command/exit/pass/fail/skipと記録する。

実GitHub CI・当該SHA固定配布JS80%coverage/全realm receipts・real atomic競合・App/token/保護適用・format後CI起動・定期更新稼働は別途未検証として記録する。局所fake試験成功を外部稼働成功と報告しない。

Conversation language: 日本語。
現在のTesting Contractは上記tool-produced briefが唯一のauthoritative契約です。再解釈しない。主セッションのみbuild/testを逐次実行する。共有workspaceで他者変更をrevertしない。planはcheckboxだけ更新。quality targetを緩めない。外部write/push/config適用はこの計画に含まれない。
rules全文とcurrentunitdesign/上流要約は同dir planning-dispatch.mdのRules in context以下とRead/upstream pathsで保持（PLAN ONLYと2files ownershipは今回の承認済み実装dispatchで置き換える）。実装ownershipはapprovedplan Planned Filesの範囲のみ。初めはbaseline通知後取得層Step2/3を実装し、main Green待ちで次層へ進む。各readyでmainへexactcommandと境界countを報告。source以外の結果記録はfinalobservationsへ。
