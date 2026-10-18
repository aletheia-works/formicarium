# Code Generation Plan — U4

## Summary

- Builds: 完了済み公開境界を保持し、入力JSON各8MiB上限をrunner起動前と直接CLI読込前へ追加する。
- Touches: scripts/release/{bootstrap,publication-cli,publication-assets}.ts、既存公開試験、固定生成資産とU4記録。通常CI・保守workflowは保持する。
- Tests: 既存39トップレベルに上限丁度/+1/起動0のsubcaseを追加し、既存release回帰と承認済み5tasksを再検証。外部操作なし。

## Scope and Ownership

FR8/FR9、PublicationBoundary、C1/C2 consumerを担当。U1/U2/U3の所有source・tasks・保守設定は変更しない。既存release source/testsは同境界の必要変更に限定。U3修正と完了検査は保持する。新しい公開candidateの実CI・全realm80%と外部push/設定/公開は別証拠・別承認。Step1–13の既存実装を保持し、今回の再実装はStep14–18のみ。今回の追加上限は未検証。

## Ordered Steps

- [ ] Step 1 — FR8/C1：既存Node test runnerとtsconfig.testsのscoped実行を確認。既存release suiteのbaselineをmainで観測し、source差分と所有を記録。
- [ ] Step 2 — FR8/NFR3.2：publication.ts/workflow.ts/CLIの版判定を単一strict stable/RC形式へ変更。tag=正確v+version、channel stable latest/RC next、candidate/request/署名承認一致を保持。
- [ ] Step 3 — Step 2実装後にpublication-version.test.tsを作成・実行（6項目：将来stable、RC、旧RC、先頭0/他prerelease、tag/channel不一致、未承認executor0）。
- [ ] Step 4 — FR8/C2/NFR3.1/NFR4.1：publication-evidence.tsでU1 C2 adapterを接続。独立API観測repository/source/run/attempt/workflow/producer/checks/実bytesと既存署名candidate/inventory/全receipt80%を照合。必要checksとproducerはtrusted設定固定、空設定拒否。
- [ ] Step 5 — Step 4後にpublication-evidence.test.tsを作成・実行（7項目：正常tracked設定、ordinary-ci、空/欠落/重複checks、偽producer/stale attempt、改変bytes、coverage不足/0、inventory/realm不足）。
- [ ] Step 6 — NFR1.1/NFR2.2/NFR3.1：publication-assets.tsでbounded取得/安全展開、固定npm11.19.0/SHA512とrunner/configの供給。tag SHA固定checkoutの .github/publication/bootstrap.mjs はNode builtinのみのtracked独立検証コードとし、同checkoutのtrusted-policy.json/runner-manifest.jsonを読む。転送runnerで自身を検証しない。API同run/attempt/artifact digestとtrusted manifest全bytes一致後にだけ転送runnerを起動。bootstrap自身は転送archiveから取得・上書きせず、checkout persist-credentials=false、依存導入なし。未確認host/IDは拒否。
- [ ] Step 7 — Step 6後にpublication-assets.test.ts（7項目：正常固定npm資産、integrity改変、stream上限、展開bytes/member上限、unsafe path/link/duplicate、credential redirect、timeout）とpublication-bootstrap.test.ts（7項目：実tracked設定正常、runner/manifest改変起動0、偽artifact、stale producer、未設定ID、unsafe抽出、転送bootstrap上書き拒否）を作成・mainで逐次実行。npm固定tar実bytesintegrity/Node CLI版確認もreadonlyで観測。
- [ ] Step 8 — NFR1.1/NFR2.2：既存CLIをNode builtin bundleへ固定Bun生成し、固定Biome正規化・同手順temp再生成全bytes照合。生成入口scripts/release/bundle.tsとtracked .github/publication/runner.mjs/runner-manifest.jsonを追加。bootstrapは同tag checkout側を使い、転送資産の未検証実行を禁止。
- [ ] Step 9 — Step 8後にpublication-bundle.test.ts（6項目：固定版/正常再現、生成改変、config改変、版不一致、Node無依存起動、欠落資産）を作成・main実行。lint設定は緩めない。
- [ ] Step 10 — FR8/NFR2.1/NFR5.1：publish.ymlを将来tag判定、readonly prepare→publish→releaseに変更。固定fullSHA Action、cache=false、30分、concurrency cancel=false。writerはNode bootstrap→既存署名gate→固定npm/Release executor、install/buildなし。unknownで再送せず下流停止。
- [ ] Step 11 — Step 10後にpublication-alignment.test.ts（6項目：実tracked workflow正常、writer install/build/権限逸脱拒否、verify/publish失敗停止、正常fake argv最大1、全拒否executor0、unknown再送0）を作成・実行。既存tests/release6ファイルも回帰。JSON/YAML構造とactionlintを検証。
- [ ] Step 12 — FR9/NFR5.2：README公開節にBun/Node/npm用途、必須checks/全realm80%、版別承認、未設定拒否、rc1-inputs維持、unknown/部分成功手動復旧を記載。
- [ ] Step 13 — mainで承認済み5tasksとU4 scoped全試験を逐次実行。新規6ファイル39項目の証拠、bundle再現、manifest/path-only所有、traceability/code-summary、生成資産hashを記録。既存品質下限を緩めず、実CI/公開候補coverage未検証は明示。独立レビューと正式checkpointへ渡す。

## Test Configuration and Boundaries

## Repair Steps — Individual JSON Bound

- [x] Step 14 — mainで既存runner/build readinessを確認し、既存assets/bootstrap/CLI試験に実入力JSON（request/publication/evidence）の8MiB丁度・+1の回帰subcaseを追加。mainが修正前の同commandで失敗を観測し、正常境界と公開executor/runner起動0を記録する。既存39トップレベルを保持する。
- [x] Step 15 — publication-assets.tsの安全展開で対象JSONの個別非圧縮サイズ上限をcopy/parse前に適用し、bootstrapでinputs検査をrunner起動前へ接続する。publication-cli.tsの直接JSON読込も8MiBを超える入力を全量読込/JSON parse前に拒否し、statだけに依存した競合による超過を許容しない。既存総展開/member/path/署名/API照合を維持する。mainでStep14と同commandのGreenを確認する。
- [x] Step 16 — mainで固定Bun1.4.2→固定Biome2.5.15によるrunner/bootstrap/manifest生成を再実行し、同手順temp再生成との全bytes一致を確認。生成物の手編集・config緩和は禁止。
- [x] Step 17 — mainで承認済み5tasks、U4全39トップレベル/追加subcase、既存release61件とpublish.yml actionlintを逐次実行。全拒否executor0、allow最大1を保持。build失敗時の古いJS結果は採用しない。
- [ ] Step 18 — U4 summary/traceability/source-manifest/generated inventory/local observationsへRed→Greenと現hashを記録し、独立レビュー・正式checkpointへ渡す。実CI/80%全realmと外部適用の未検証を保持する。

見積り20–40分、ローカル追加費用なし。JSON拒否境界とbundle再生成の回帰リスク。外部push/App設定/npm/Release操作は含まない。Testing Contractは変更しない。

## Existing Test Configuration and Boundaries

node:test、既存tsconfig.tests.json/.buildを再利用。新規sourceはscripts/**/*.ts、新規testsはtests/tooling/*.test.tsなのでU1設定改変不要。version/evidence/assets/bootstrap/bundle/workflow6componentを各5–8項目で検証。fake API/executorとbounded fixtureを使い、npm publish/GitHub writeを呼ばない。既存公開CLI署名/入力/gate試験を保持。80%固定第一者配布JS/全realm証拠は統合前の別経路で確認し、scoped試験の成功へ置換しない。

## Review Input to Implementation

Infrastructure review Majorの信頼開始点不足はStep6/7/8で具体化する。独立bootstrapを固定tag checkoutから取得し、転送bundle実行より前に trusted tag manifestとAPI証拠を照合する。自己申告archiveのみでは起動不可。上流資料は変更しない。

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

