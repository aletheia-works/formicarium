# U4 Code Generation Plan

## Sources and Scope

Conversation language: Japanese。U4 ReleaseAssurance、US5.1/US5.2/US6.1–6.4、C6/C7を実装する。承認済みrequirements.md、contract-summary.md、unit-of-work.md、unit-of-work-story-map.md、stories.mdを根拠とする。U3正式review-01.md R-01は測定copy/最終bundleのbytes結合不足であり、静的経路の確認済み所見、改変再現は未検証。既存80.56%を誤りとは断定せず、修正後の新規generationで再測定する。

主な編集対象は scripts/terrarium/coverage.ts、scripts/coverage-types.ts、tests/terrarium/coverage.test.ts、scripts/release/{types,evidence,decision,collect}.ts、tests/release/{evidence,decision,collect}.test.ts、docs/release-assurance.md。正式buildの.jsは生成証拠へ分離し、source manifestは追跡可能なapplication-sourceだけを列挙する。U1/U2製品ソース、U3製品接続、外部terrarium、古い候補/証拠/receiptを変更しない。coverage collectorの変更はU4所有のC6検証修正として扱い、U3の完了済みreceiptを変更しない。CI/公開workflowの具体実装は後続の該当工程へ引き継ぎ、このUnitでは判定条件と実行可能な検証コマンドを作る。

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
