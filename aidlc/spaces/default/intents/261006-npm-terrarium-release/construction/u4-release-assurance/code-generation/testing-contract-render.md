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
