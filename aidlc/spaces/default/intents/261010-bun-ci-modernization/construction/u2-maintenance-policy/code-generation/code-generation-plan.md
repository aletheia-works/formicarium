# Code Generation Plan — U2

## Summary
- Builds: 取得済みの入力から整形push・依存mergeを判定する純粋なMaintenancePolicyとC2接続adapter。
- Touches: scripts/maintenance/{input.ts,evidence.ts,policy.ts}とtests/tooling/maintenance-{input,evidence,policy,contract}.test.tsのみ。
- Tests: 層ごとの実装後に7・7・8・6件のNode試験を作成しmain sessionで逐次実行。全拒否表を表形式のsubtestで検証する。

## Scope

ドキュメント根拠の計画。U2の実装・試験は未検証。既存U1のtest:lightはtooling生成JSを取り込むためpackage.json、task、workflowを変更しない。新依存、公開package、credential、外部情報取得、executor、runtime、RC資産は対象外。テスト内の偽executorは呼出側境界の観測だけに使う。

C3はevaluateMaintenance(request, trustedPolicy)の2引数を維持する。raw入力の検証失敗はValidationFailureとし、判定不能な識別情報をnullにする。型の整ったMaintenanceDecisionへ偽のrepository/head/operationを補って変換しない。独立観測はC2 adapterへ渡し、TrustedPolicyへ埋め込む第3の情報源にしない。

## Steps

1. [x] 既存runner/configを確認し、main sessionでBun frozen導入・型検査・buildの前提を確認する。生成先と本手順書のNode限定commandを記録する。Plan Approval前には実行しない。（FR6/FR7、NFR4/NFR5）
2. [x] input.tsへreadonly型、rawのunknown検証、ValidationFailure、正規化を実装する。plain data、必須字段、enum、40桁lowercase SHA、64桁digest、正整数run/attempt、空白・制御文字、重複check/producer/pathを拒否する。パスはroot相対・segment境界で判定し絶対/逆slash/空segment/dot/parentを補正せず拒否する。上限はpaths500、checks/required producers100、directUpdates2、allowlists100、path1024文字、依存名214文字、他識別文字列256文字。配列順の正規化は重複拒否後に行い入力を変更しない。（FR6/FR7、NFR1.1/NFR1.2/NFR5.1/NFR5.2）
3. [x] maintenance-input.test.tsに7件を作り、mainがbuild後にその生成JSを実行する。正常2operation、必須字段/型/enum欠落、SHA/digest/run、重複と上限直前/丁度/超過、危険パス、prototype/accessor等の非plain入力、raw失敗のnullメタデータと不変性を検証する。（Step2対応）
4. [x] evidence.tsへC2 adapterを実装する。raw submitted envelopeと別に渡された独立observationsを検証し、U1のvalidateEvidenceを再利用する。必要check集合は信頼policyから要求し、観測側の自己申告集合で縮小しない。repository/source/run/attempt/workflow/artifact digest/toolchain/purpose/check producer・状態を照合し、合格時だけC3 requestのtrusted contextを構築する。PR申告のtrustedWorkflowを信頼状態へコピーしない。取得元の真正性はU3の責任として明記する。（FR6/FR7、NFR2.1/NFR2.2/NFR3.1/NFR3.2/NFR3.3）
5. [x] maintenance-evidence.test.tsに7件を作りmainで実行する。真正fixture、全identity字段の個別不一致、artifact改変、producer偽装/不足/重複、skip/pending/fail/cancel/stale、必要checks縮小、raw不正とadapter拒否からC3へ進まない境界を検証する。（Step4対応）
6. [x] policy.tsへ2引数C3を実装する。BR2.1–BR2.8の固定順理由と決定的IDを返す。共通条件はrepo一致、sameRepo、PR open、最新head、trusted workflow、現在headに結び付く全必要checks成功。受入れ済みR-01の共通requiredCheckProducersを両operationで維持し、整形側もlint失敗時は拒否する。整形は固定formatter/config、許可path、再現成功、整形のみ、提案/再現digest一致、分類可能を要求。全条件成功後だけ空pathsと空差分digestが整合するとno-opとし矛盾はreject。依存は真正bot、直接dev依存ちょうど1件、allowlist、厳密stable数値版の昇順patch/minor、lock再現完全一致、非混合/非Action/非公開境界、main保護、mergeableを要求。kind自己申告ではなくfrom/toを計算し、追加/削除/同版/降格/major/prerelease/range/未知版を拒否する。推移依存は直接件数に数えず、不関連lock差分を拒否する。（FR6/FR7、NFR1–5、BR2.1–BR2.8）
7. [x] maintenance-policy.test.tsに8件を作りmainで実行する。共通正常と共通拒否表、整形正常、正当no-opと矛盾、整形拒否表、唯一の直接依存patch/minor正常、直接0/2件・版/allowlist/bot拒否表、lock/混合/Action/公開境界/main保護/mergeable拒否表を検証する。（Step6対応）
8. [x] maintenance-contract.test.tsに6件の結合試験を作りmainで実行する。raw→C2→2引数C3の正常接続、改変/古い証拠で拒否、順序を変えた同義入力の同一ID/理由、deep-freeze入力の不変性、全reject/no-opで呼出側偽executor0回、正常allowで呼出側偽executor1回とexpected headの受渡しを検証する。これはU3の実API原子的head再照合や実write成功の証明にしない。（FR6/FR7、NFR1.1/NFR2.1/NFR3.3）
9. [x] mainで対象formatter、lint、型検査、build、U2全4ファイルを逐次確認し、既存light試験への取り込みと既存成功を確認する。不具合は同じ再現試験の失敗を観測後に修正・成功確認する。変更pathと実結果を別のverification/local-observations.mdへ記録する。（NFR4/NFR5）
10. [x] 必須のcode-summary.md、traceability.json、source-manifest.jsonを生成し、独立レビューへ渡す。source-manifest.jsonは実際のscripts/maintenanceの3 source TSとtests/toolingの4 test TSの計7ファイルを対象とする。ignored生成JSは別のgenerated-artifacts inventoryに分離して記録する。（FR6/FR7、NFR3/NFR4）

Plan Approval後は承認済みの計画内容とunit-test-instructions.mdを書き換えない。計画のcheckboxは完了したstepだけを更新し、観測結果はverification/local-observations.mdへ記録する。

## Acceptance Boundaries

固定第一者配布JSの行coverage80%以上、全realm/Worker/process記録、統合前実CIは全体受入れで別途必要。U2 fixture試験・軽量CIだけで代用しない。probe600秒、aubeブラウザ840秒、1worker、retry0、probe8項目、native一致、wasm1GB、WorkerのAtomics.waitAsync除去を維持する。未変更guestを再buildしない。実機Safariは未検証のまま扱う。

## Sources

- ../functional-design/{entities.md,rules.md,functional-spec.md}
- ../nfr-requirements/{security-requirements.md,tech-stack-decisions.md}
- ../nfr-design/{security-design.md,logical-components.md}
- ../infrastructure-design/cicd-pipeline.md
- ../../../inception/contract-design/contract-summary.md（C1/C2/C3、受入れ済みR-01）
- ../../../inception/units-generation/unit-of-work.md、requirements-analysis/requirements.md
- planning-dispatch.md、root package.jsonとTypeScript設定

## Assumptions & Open Questions

None.

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

