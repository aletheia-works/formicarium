# U1 Code Generation Plan

## Summary

- Builds: Bun／bun.lockの依存管理、通常CI、対象SHAの候補検証入口。
- Touches: package.json、bun.lock、mise.toml、scripts/ci、tests/tooling、通常CI workflow、README。
- Tests: 新規14件（開発task7件・品質証拠7件）とlock負例、Node/browser consumer、既存回帰・固定80%coverage。

## Implementation Steps

- [x] Step 1: 公開main12a92eabから隔離jj workspaceを用意し、rootの既存未統合変更を持ち込まない。実装場所とbase SHAを記録する。新bookmarkはcodex/bun-ci-u1。外向きpushは行わない。（FR1,FR3,NFR5.2）
- [x] Step 2: 既存node:test/TypeScript runnerと下記単位限定commandの準備を確認する。Node24.21.0/Bun1.4.2をmise実体で解決しmain sessionで実行する。（FR2,NFR1.1）
- [x] Step 3: package.jsonとmise.tomlへBun固定版とtaskを導入し、既存package-lockから解決版を維持してtext bun.lockへ移行する。frozen導入と必要依存だけのinstall許可を定義しpackage-lock.jsonを削除する。Node専用処理はNode実行を残す。（FR1,FR2,NFR1.1,NFR2.2）
- [x] Step 4: DevelopmentTasks用tests/tooling/bun-tasks.test.tsを追加し7件を逐次実行する。cacheless導入・lock不一致・固定版・非0伝播・consumerのNode境界・task対応・禁止install scriptを扱う。（FR1,FR2,NFR1.1,NFR2.2,NFR3.2）
- [x] Step 5: C2のsource/run/attempt/producer/digest照合と集約判定をscripts/ci/quality-evidence.tsに実装する。信頼済みbase規則のConventional Commit検査をscripts/ci/commit-format.tsへ追加する。文字列shell展開は使わない。（FR3,FR5,NFR3.1,NFR3.2）
- [x] Step 6: tests/tooling/quality-evidence.test.tsに7件追加し逐次実行する。正常、偽producer、欠落/重複、stale SHA、digest改変、skip/pending/cancel、commit形式不成立を確認する。（FR3,FR5,NFR3.1,NFR3.2）
- [x] Step 7: ci.ymlを実装する。PR全path/main push、contents read、固定Action SHA、credential非保存、quality30分/commit-format10分/ci-required5分、PR/ref concurrencyと非成功伝播、固定版lock鍵cacheを定義する。Action SHAの取得は公式一次情報を確認する。（FR3,NFR1.2,NFR2.1,NFR5.1）
- [x] Step 8: 新candidate入口と入力生成・検証を実装する。下記供給契約を具体化し、tests/tooling/candidate-inputs.test.tsで正例・欠落・改変・source不一致・未知member・symlink拒否を確認する。既存verify.ymlの旧RC条件を保持する。（FR3,NFR3.1,NFR4.1,NFR4.2）
- [x] Step 9: main sessionでactionlint、固定版cacheless/frozen導入、型検査/build、単位限定tests、Node/browser consumerを逐次実行する。重い回帰とcoverageを候補SHAへ結び付ける手順を準備し、実CIは外部承認後に実行する。未変更guestは再ビルドしない。（FR3,NFR4.1,NFR4.2,NFR5.2）
- [ ] Step 10: README・task対応・必要check設定・失敗時復旧と検証記録を更新し、code-summary、source-manifest、規定形式traceabilityを作成する。実行した結果と未検証を区別し、独立レビューを受ける。（FR9,NFR5.2）

## Candidate Input Supply Contract

新candidateは既存scripts/ci/bundle.tsのInputManifest schemaVersion1、明示sourcePathsとinputs inventoryを再利用する。供給者はmain sessionの担当者。対象の40桁source SHAの新しいtarball/siteを生成し、guest/core変更なしをlock/build-info/provenanceにより照合した既存資産だけ再利用する。manifest.sourceFilesは新sourceの検証対象ファイルのsize/SHA256を列挙する。

必須再利用資産：assets/blink.wasm、blink.mjs、build-info.json、dist/guests/probe,aube,pitchfork、aube/pitchfork provenance、fixtures/baseline/aube-1645.native.txt,pitchfork-basic.native.txt。tarball、packageManifest、packageRoot、site、terrarium owner copyとresolver3ファイルはmanifestの相対パスと各file pinへ対応させる。coreCommit、guest version、owner baselineCommit/integrationSourceIdentityは既存validatorの条件を満たす実値を読み取り固定する。値を推測で作らない。

新入力archiveを新source用のmanifestとともにローカル生成・inventory/digest/provenance確認する。承認後だけ新しい入力保存先へ転送し、repository管理者がFORMICARIUM_MODERNIZATION_INPUT_URL（固定commitのHTTPS raw URL、redirect不可）とFORMICARIUM_MODERNIZATION_INPUT_SHA256（確認済み64桁）を設定する。旧FORMICARIUM_CI_INPUT_*とRC入力branchは変更しない。candidate-verify.ymlは現在checkout SHAとmanifest.sourceCommit一致を要求する。sourceと入力revisionが変われば新archive/new digestを必要とする。欠落・未知member・size/digest不一致・symlink・資産provenance不一致は試験開始前に拒否する。forkは入力変数を変更できず、通常CIはこのarchiveを要求しない。

## Boundaries and Outstanding Findings

DB/API/UIの新規層は対象外。test-afterを開発task→試験、品質判定→試験の順に適用する。14件は2componentのStandard最低量で、candidate入力の境界試験を追加する。既存回帰と固定inventory80%も独立した必須条件。

Infrastructure DesignのMajor供給契約不足を上の実装契約で具体化する。Infrastructure traceability形式のMinorは上流資料に残る指摘として記録し、実装traceabilityはstage/unit/upstream_ids/coverage形を使う。上流の凍結資料を無断で修正しない。契約R-01の操作別checks問題はU2/U3へ引き継ぎ、このU1で解消済みとは扱わない。

計画承認は外部push/CI dispatch/設定適用/npm公開を含まない。完了確認commandは最初のunit checkpointで別途選択する。実機Safariは未検証のまま。

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
