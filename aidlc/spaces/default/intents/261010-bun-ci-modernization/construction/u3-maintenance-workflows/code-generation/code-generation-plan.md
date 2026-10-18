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

1. [x] main sessionで既存runner/configとU1/U2 baselineを確認し、既存5tasksの再利用と本手順書のU3限定commandを確定する。新試験の生成前に存在しないJSを実行しない。Bun1.4.2/Node24.21.0/Biome2.5.15とstrict TSを維持する。（FR4–7/9、NFR1.1/NFR4.1）
2. [x] github.ts/archive.ts/receipt.tsを実装する。固定GitHub API origin・Accept/API-version・Bearer headers、endpoint/GraphQL variablesのschema、redirect allowlist、pagination上限を実装する。read1要求10秒・全取得60秒・retry最大2回、writeはretryしない。stream受信累積でcompressed8MiB、member最大16、展開aggregate8MiB、個別JSON/diff8MiB、source最大500files/合計8MiBをcopy/hash/JSON parse前に拒否する。Node builtin zlibでZIPを上限付き展開しcentral/local header・サイズ/CRC・重複・絶対/親path・symlink・暗号化/未知形式を検証し、安全なreceipt.json等の固定member以外を拒否する。未知archiveをshellで展開しない。API run/attempt/repo/event/PR/head/job/check suite/producer App ID/workflow ID/path/hash、actual artifact bytes、receipt2jobと期待toolchain/lockを照合し、独立C2 3checkへ正規化する。PRで改変したCI定義・trusted設定・公開境界、fork/closed/曖昧PR、偽producer/古いrun/失敗checkは拒否する。（FR5–7、NFR2.1/NFR3.1/NFR5.1/NFR5.2）
3. [x] maintenance-acquisition.test.tsへ8件を作りmainのbuild→対象試験を実行する。正常bounded API/ZIP/2→3check、HTTP request/headers/pagination/redirect、10秒/60秒/retry/rate-limit/403/cancel、8MiB直前/丁度/+1のstream中断、ZIP16/17members・symlink/path/duplicate/bomb/CRC拒否、receipt/run/attempt/SHA/toolchain改変、偽producer/CI hash/check状態拒否、fork/closed/複数PRと無効metadataをtableで検証する。Green通知まで次層を実装しない。（Step2対応）
4. [x] reproduce.tsを実装する。trusted base依存だけをignore-scripts/frozen導入したreadonly場所で、API取得済みUTF8 regular TSを隔離しBiome formatのみを固定base configで実行する。PR script/config/pluginは実行しない。runtime/scripts/testsとindex.tsの許可境界、500files/8MiB、rename/delete/symlink/binary/未知分類、公開境界変更を拒否する。元head bytesと完全再現した置換bytes/差分digestを対応づける。依存はtrusted manifestから既存dev依存1字段の厳密stable版変更だけを適用し、Bun1.4.2 ignore-scripts lock生成→frozen導入、候補manifest/lock全bytes完全一致とresolved from/to stable版を確認する。range/未知/追加削除/0/2件/major/pre/Action/mixedは拒否する。依存更新時receiptのlockDigestはtrusted旧lockとの直接一致ではなく再現済み候補lockへ照合する。再現結果をC2 adapterと2引数C3へ接続する。（FR6/FR7、NFR1.1/NFR1.2/NFR2.1/NFR2.3/NFR3.1）
5. [x] maintenance-reproduction.test.tsへ8件を作りmainで実行する。整形完全一致、空no-op/矛盾、非整形/再現不一致/固定config、全file分類拒否、依存patch/minor1件、直接0/2とrange/major/pre/追加削除、lock/manifest無関係差分、無credential・PR script未実行/C2→C3接続を検証する。実Bun/Biomeの小さな隔離fixtureを使い重いguestを再buildしない。Green後に次層へ進む。（Step4対応）
6. [x] operations.ts/runner.tsのprepare・format-write・dependency-merge入口を実装する。writerはtrusted base fixed SHAのbundle/configだけを実行しinstall/build/PR checkoutをしない。prepare artifactはdataとしてschema/byte/digest/run/attempt/baseSHA/producer/再現jobを独立照合し、artifact allowのコピーで操作しない。write直前にopen/sameRepo/current head/全3checks/必要main保護/真正botを再GETし、U2判定を再確認する。formatはGraphQL createCommitOnBranchのexpectedHeadOidと検証済みfileChanges additions、固定Conventional Commit headline。mergeはREST sha=Decision.headSha・merge_method=squash。queue/stacked/削除branch/保護不明は拒否する。write1要求10秒・最大1回、GraphQL HTTP200 errors/REST拒否を成功へしない。timeout等結果不明は有限readでhead/commit parent/tree/merged状態を照合しsuccess/failure/unknownへ分け、再送しない。reject/no-op0回、重複既適用no-op。固定reasonとMaintenanceAttemptのPR/head/run/attempt/Decision/policy/operation/resultingShaだけを記録する。（FR6/FR7、NFR2.2/NFR3.2/NFR3.3/NFR5.3）
7. [x] maintenance-operations.test.tsへ8件を作りmainで実行する。fake HTTPでGraphQL query/variables/expectedHeadOid/fileChangesとREST path/body/sha/squash/headerを実際に捕捉する。各正常1回、直前head競合/保護不明/queue/fork、reject/no-op0回、GraphQL200 errors/403/409/cancel、timeout結果照合success/failure/unknownと再送0回、重複イベントを検証する。Green後に次層へ進む。（Step6対応）
8. [x] metadata.ts/bundle.ts、trusted policy/label rules、renovate.json、2workflow、README保守節を実装する。labelはpull_request_target metadataだけ、trusted runner、PR checkout/install無し、固定pathカテゴリを複数付与し無関連labelは変更しない。任意title/bodyをshell展開しない。Renovate bun/github-actions manager、週次、Bun単一依存PR、Actions別group、自身automerge/lock-only maintenanceをdisabled。allowlistは現行dev依存を固定列挙しrangeは自動merge拒否を説明する。
maintenance.ymlはCI completed workflow_run→readonly prepare30分→目的別App writer/merge10分とrecord。label5分、write共通PR concurrency cancel-in-progress false、artifact7日、公開OIDC無し。目的別App ID/private-key secretとrepo限定token、必要readとcontents writeのみ、保護bypass/workflow編集不可。actions/create-github-app-tokenを含む全Action fullSHAは実装時に公式release/tag/action.ymlで検証しsourceに固定する。設定未適用時fail closed、停止/権限取消/unknown手動照合/整形lint拒否手順を記載する。（FR4/FR5/FR9、NFR1.1/NFR2.1/NFR2.2/NFR5.1/NFR5.3）
9. [x] runnerのmetadataを静的importにし、Bun dynamic import helperを不要にする。mainの固定Bun1.4.2でNode target単一bundleを生成し、直後に固定Biome2.5.15のcheck --writeで既存biome.json規則へ正規化して.github/maintenance/runner.mjsをtracked供給する。runnerはNode builtin依存だけで動作しBun runtime API/新npm依存を持たない。bundle.tsの生成入口はBun CLIを引数配列で呼び、同一source→同一Bun生成→同一固定Biome check --write正規化をtemp出力にも適用し、tracked runnerの全bytesと照合できる。正規化にはtrusted baseの既存biome.jsonを明示して使い、lint設定やU1 taskを変更しない。write jobはこのbundleをtrusted default branch固定SHAからcheckoutしsourceSHAとbundle供給を確認、PR bundle/hashは実行しない。readonly通常light試験で再生成一致を検証する。Bun builtin buildでNode builtinを外部参照として保ち、token Action自身のNode runtime対応も確認する。（NFR1.1/NFR2.1、Executable Supply）
10. [x] maintenance-wiring.test.tsへ8件を作りmainで実行する。Renovate周期/manager/group/単一/dev/automerge拒否、label複数カテゴリ/fork/無関連/敵対title、policy必要3checks/immutable actor・設定欠落拒否、workflow最小権限/trigger/timeouts/concurrency、write無install/PRcheckout、trusted固定SHA供給、固定Bun→固定Biome check --writeによるbundle再生成・正規化bytes一致とNode実行、bundle/供給改変拒否を検証する。新workflowのみactionlintをmainで実行する。Green後に結合へ進む。（Steps8–9対応）
11. [x] maintenance-integration.test.tsへ7件を作りmainで実行する。fake GitHub HTTPのrun/2job receipt→3check→無権限再現→実U2→直前再GET→具体APIの正常formatとdependency、改変/CI定義変更/producer偽装、古いhead/atomic競合、直接0/2/Action/混合、超過byte/timeout/取消、結果不明/重複を一連で検証する。全拒否/no-opにwrite0回、allow最大1回を検証する。純粋U2をstubでallow固定へ置換しない。（FR4–7、NFR3/NFR4.1/NFR5）
12. [x] mainで対象整形、固定Bun生成→固定Biome check --writeによるtracked bundle正規化、既存承認5tasks、U3限定39件、actionlintとbundle再生成一致を逐次確認する。結果はverification/local-observations.mdへ記録する。初回不具合は同じ再現試験のRed観測後修正、同じcommandのGreenを確認する。実GitHub CI/固定配布JS80%以上/全realm receipts/実atomic競合/App適用と区別する。（NFR4.1）
13. [x] code-summary.md、traceability.json、source-manifest.jsonと別generated-artifacts inventoryを生成し独立reviewへ提出する。tracked runnerをmanifestから落とさない。source-manifestはengineの指定schemaに従い、writesはpathだけとしextra sha256字段を追加しない。hashは別inventoryへ記録する。承認済み計画の内容・手順書・Testing Contractを書換えず、完了checkboxだけ更新する。（FR9、NFR5.3）

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

