# U2 実装計画

## Summary

- Builds: 4回目の再開（追加Step 18–19）。review-08のR-09（`resolvePath` のJSDoc）とR-10（検証記録の記述）を直し、functional-designで追加したBR2.12をtraceabilityとcode-summaryへつなぐ。
- Touches: `runtime/session-port.ts` のJSDocだけ（振る舞いは変えない）と、U2の記録（code-summary.md、current-recovery-verification.md、traceability.json）。
- Tests: 新しい試験は追加しない。mainで `mise run build` と `reservation.test.js` を逐次実行して記録する。2回目の独立レビューと、intentの検証コマンドによるcheckpointの確認を行う。最終的なsourceでのU1〜U4のまとめた確認は、U4の作業の後に行う。

## 対象と前提
FR2/FR5/FR6、BR2.1–BR2.11、U2 NFR2.1/2.2/3.1–3.5/4.1/4.2/6.1/8.1/8.2を実装する。User Storiesは省略されており、直接FR/BR/NFRで追跡する。
U1の実36試行と固定Biome CIの通過証拠を事前条件として保持する。U1の承認済みsource/evidenceを編集しない。U3取得・install、U4コマンドと最終B1、実公開はこの単位の実装対象外。
調査時private0.1.0-rc.1の作業sourceを公開基準とみなさず、公開0.2.1との差分を確認する。U2候補はstaging内0.3.0として暫定証拠に明示し、rootの公開状態やタグを変更しない。

## 順序と変更対象
Step 1–8は既存実装の履歴であり、再開による再実装を指示しない。今回実施する範囲はStep 9–11。
- [x] Step 1: 既存runner・型・build設定を確認する。mise run build/typecheck、既存tests/package/runner-ready.test.jsをmainで実行する。U2専用tests/migration-session/とPlaywright設定、miseのmigration-session-unit/browser taskを整備する。DB/repository/UI層は本単位に存在しない。
- [x] Step 2: GuestValidation層をruntime/guest-validation.tsへ実装する。共通同期SHA256・canonical metadata・static ELF64検証、C11上限、private WeakMap handleとfixture全件検証/copyを実装する。既存純粋処理が適合すれば再利用し、Node専用importやU1開発コードを配布runtimeへ依存させない。（FR2、BR2.1/2.2/2.3/2.9、NFR3.1–3.5）
- [x] Step 3: Step 2実装後、tests/migration-session/guest-validation.test.ts・fixture.test.tsを作成しmainで実行する。digest vector/metadata未知field、ELF不正/overflow、上限/+1、後続mutation、偽/別instance handle、symlink loop/escape、hardlink整合を含む。（FR2、安全性要件）
- [x] Step 4: runtime/lifecycle.ts・state.tsにsession所有予約token/epochとguest registryを統合し、必要ならruntime/session-port.tsに非公開C02 portを置く。run/readFile/remove/listEntries/setCwdも同一予約、内部継続は再acquireなし。reset/disposeの取消・cleanup・初期状態復帰/終端、atomic commit・旧release拒否を実装する。既存Worker cleanupの有限待機とraw run意味を維持する。（FR5、BR2.4–2.8、NFR4.1/4.2）
- [x] Step 5: Step 4実装後、tests/migration-session/reservation.test.tsを作成しmainで実行する。制御可能なspawn/cleanupでbusy、取消、旧commit/release、reset/reset・reset/dispose、失敗時FS/cwd/登録不変、2session分離を再現する。（FR5）
- [x] Step 6: runtime/public.tsとtypes/index.d.tsへC03の4関数とGuestHandle/GuestBuildInfo/期待値型を追加し、Node/browser Sessionへ接続する。package.json files、scripts/package/stage-package.ts・coverage-inventory.jsonに新配布JSを登録する。C02はpackage exportへ公開しない。（FR2/FR6、BR2.10/2.11）
- [x] Step 7: Step 6実装後、tests/migration-session/public.test.ts・consumer.test.ts・types-valid.ts/types-invalid.ts・consumer.spec.tsを作成し実行する。既存実guest/wasmを使い同一packをNodeと3ブラウザから利用し、検証後copy・fixture・session競合とexports/typesを確認する。実機Safari未検証を保持する。（FR2/FR5/FR6、NFR6.1/8.1）
- [x] Step 8: scripts/migration-session/stage.ts・completion.tsと専用taskを作成する。新source/pack/inventoryへbindしたU2暫定候補、全realm coverage、既存consumer/probe/aube回帰を逐次実行し、欠落/skip/未検証は成功にしない。既存package coverage収集処理を拡張する必要がある場合はU2配布変更と対応づけ、80%/timeout/worker/retryを維持する。U1の固定14ファイル証拠をU2候補の証拠として使わない。統合前CI成功は別途実観測し、未承認push/外部適用を行わない。（NFR2/8）
- [x] Step 9: 既存C02/C03実装と契約、v8固定入力・結果・source/pack/inventory・consumer・配信元の結合を照合する。2026-10-16T10:18:42.073Z–10:42:13.335Zにmainで観測した21工程の原ログを用い、今回のU2再開で新たに全工程を実行したとは記載しない。currentSource394件・全証拠435件・独立consumer31ファイルと全realm生カウントを確認する。共有SHA256と生記録照合の変更は現在の検証対象として確認し、本計画で再実装しない。（FR2/FR5/FR6、NFR8）
- [x] Step 10: U2のcode-summary.md・traceability.json・source-manifest.jsonとcurrent-recovery-verification.mdを現在の証拠へ整合させる。個別パスの主張を保持し、旧16JS/26pack・署名付きCIおよび旧v4/v5/v6/v7の履歴と、現在21JS/31packのv8ローカル証拠を区別する。封印された過去の入力・結果・証拠、U1承認済み成果物と完了承認は変更しない。（NFR8）
- [x] Step 11: 独立レビューを受け、指摘を検証する。主担当が承認済みverification-command.txtのコマンドでU2の正式完了確認を実行し、成功時は通常の単位完了承認を自動で進める。新しい実装・検証入力・コマンドが必要なら先に確認する。（NFR2/8）

## 追加Step：最新toolchainでの再確認（2026-10-17、Code Generationの再開）

人間の方針（2026-10-17）：古い版のtoolで作った記録は、今のtoolchainの根拠にしない。最新版で実行した成否だけで確かめる。Steps 1–11と、下の「検証と停止条件」に書いたv8の記述は、古いtoolchain（Node 24.21.0）での履歴として残す。今の判定には使わない。

U2がclaimするfileのうち、toolchain更新（commit 7c7ceaf4）とU3のcoverage collectorの変更（launches.jsonlの起動台帳）で12件が変わった。そのため、U2のレビューは今のsourceに結び付かなくなった。U2の製品コードは変わっていない。U1の承認済み修正案に沿って、mainはU1/U2共通のcurrent completionを最新版だけでやり直した（v10）。人間は、その読取り専用の検証コマンドを承認した。

- [x] Step 12: U2の記録をv10へ揃える。code-summary.mdとcurrent-recovery-verification.mdの先頭に、v10の結果を書く。書く内容は次のとおり。
  - 入力 `.artifacts/migration-preflight/current-recovery-input-20261017-v10.json`（SHA256 56c78183f6b1af91f9e1de7a1179c6d9ba416ff2be584834d4f5931a050d6fb9）
  - report `.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json`（SHA256 e7760ddbe0e943d0830e8a7093c30a5898cfc86f8d49ed5d94f7e55dab197a01）
  - 20工程exit0、coverage 1768/1929行＝91.65%、skip0、1495 realm
  - 承認済みの検証コマンド `verification/verification-command-u1u2-v10.txt` と、その `verified:true`
  - v8・v4〜v7は、古いtoolchainの履歴であること

  U2のアプリケーションコード・試験・traceability.json・source-manifest.json・封印済みの過去の証拠は変更しない。（NFR8）
- [x] Step 13: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確認し、通常の単位完了承認を自動で進める。新しい実装・入力・コマンドが必要になったら、先に確認する。（NFR2/8）

## 追加Step：U4の作業を戻した後の再確認（2026-10-17、2回目の再開）

U2のレビュー（review-06）の後、U2がclaimする共有fileが次の2つの理由で変わった。U2の製品コード（runtime/guest-validation.ts、session-port.ts、lifecycle.ts、state.tsなど）は変わっていない。
- 一時的に外していたU4の作業（Steps 1–7）を戻した。これにより、`package.json`（files、@types/node 26.6.5）、`runtime/public.ts`（`createCommandSession` のexportを追加）、`types/index.d.ts`（C05の型を追加）、`scripts/package/stage-package.ts`・`coverage-inventory.json`（配布JSが23件に）、`README.md`、`mise.toml`（U4のtask）が変わった。
- AI-DLCを2.11.1-preview.20261016.1に更新した（人間の承認済み。`mise.toml` のpinを変更）。

intentの検証コマンドは、人間の承認により、U1の試験を今のsourceで実行するコマンドに置き換わった。U2の受入（v10の照合）は、作業開始時のsourceに結び付いている。U4の変更を含む最終的なsourceでのU1〜U4のまとめた確認と、新しい検証コマンドは、U4の作業がすべて終わった後に行う。

- [x] Step 14: U2の記録（code-summary.md、current-recovery-verification.md）に、今回の変更（U4によるexport・型・配布一覧の追加、AI-DLCの更新）と、U2の製品コードが変わっていないことを書く。追加されたexportと型が、既存のU2のAPI（C02/C03）を変えないことも確かめて書く。最終的なsourceでの確認はU4の後に行うことと、それまではv10を変更後のsourceの成功証拠として扱わないことを明記する。（NFR8）
- [x] Step 15: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）

## 追加Step：U4の変更のうち、U2のfileに当たるものを引き受ける（2026-10-17、3回目の再開）

U4の追加Step項目3・4で、U2がclaimするfileが変わった。人間の判断で、その変更をU2の変更として引き受け、U2をこの1回だけやり直す。変更はmainのworking copyにすでにある。Step 14の「U2の製品コードは変わっていない」は、この変更より前の記述として残す。
- 項目3（製品コード）：`runtime/session-port.ts` の `SessionPort` に `resolvePath(path: string): string` を加えた。`runtime/lifecycle.ts`（と生成した `lifecycle.js`）がこれを実装する。相対pathは現在のcwdに付けて、既存の `normalizePath` の規則で正規化する。空・`..`・NUL・文字列でない値は `INVALID_INPUT`。cwdを読むだけで、session状態を変えず、予約も取らない。
- 項目3（試験）：`tests/migration-session/reservation.test.ts` に2件を加えた（相対・`.`・絶対pathの解決と、cd・resetの後の解決／不正な値の拒否、状態不変、予約を取らないこと）。
- 項目4（試験）：`tests/package/public.test.ts` のroot exportの一覧に `createCommandSession` を加えた。`pack.test.ts`・`package/coverage.test.ts`・`terrarium/coverage.test.ts` の件数（23件・33件）と名前の一覧は、U1のStep 18で確かめた内容と同じである。
- `tests/migration-install/lifecycle.test.ts` の模擬portへの `resolvePath` の追加はU3のfileなので、U3のやり直しで引き受ける。

- [x] Step 16: 上の変更をU2の変更として確かめ、U2の記録（code-summary.md、source-manifest.json、traceability.json）に書く。`resolvePath` が既存のC02/C03の振る舞いと公開API（package exportにSessionPortを出さないこと）を変えないこと、`normalizePath` の拒否条件を緩めていないこと、試験の期待値は実際の配布一覧に合わせただけで判定条件を緩めていないことを、file を読んで確かめる。mainで `tests/migration-session/reservation.test.js` と `tests/package/public.test.js` を逐次実行し、件数とfail・skip 0を記録する。最終的なsourceでのU1〜U4のまとめた確認はU4の後に行い、それまではv10を変更後のsourceの成功証拠として扱わない。（FR5/NFR8）
- [x] Step 17: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）

## 追加Step：review-08の指摘の修正（2026-10-17、4回目の再開）

review-08（READY）のR-08〜R-10を直す。人間が承認した修正案 `u2-resolvepath-contract-proposal.md`（案A）に従い、U2のfunctional-designとcode-generationを開き直した。R-08（C02とU2の機能設計への `resolvePath` の追記）は、functional-designでBR2.12・WF2.6として直し、そのレビュー（READY）を受けた。上のStep 17は、この修正より前の流れとして残す。

- [x] Step 18: R-09とR-10を直し、BR2.12をcode-generationの記録へつなぐ。コードの振る舞いは変えない。
  - R-09：`runtime/session-port.ts` の `resolvePath` のJSDocに、次の点を書く。戻り値は呼出し時点のcwdにもとづく値であること。dispose・reset・abortの検査をしないこと。不正な値では同期で `INVALID_INPUT` を投げること（ほかのmethodのようにPromiseのrejectにはしない）。呼出し側は予約を保持している間か、同じtickのうちに値を使うこと（BR2.12）。interfaceのJSDocだけの変更で、生成JSは変わらない。
  - R-10：`current-recovery-verification.md` の冒頭に、3回目の再開で `session-port.ts`・`lifecycle.ts` の製品コードが変わったこと（詳細はcode-summary.md）への1行の参照を加える。
  - `traceability.json` に、BR2.12と `runtime/lifecycle.ts`・`tests/migration-session/reservation.test.ts` の対応の行を加える。`code-summary.md` に、この修正を書く。
  - mainで `mise run build` と `node --test --test-concurrency=1 tests/migration-session/reservation.test.js` を逐次実行し、件数とfail・skip 0を記録する。
Step 18はmainで実施済み（build exit 0、reservation試験12件pass、fail・skip 0）。前の試行ではreview-08でレビューを使い切っていたため、エンジンがレビューの依頼を拒否した。人間の判断で、レビューのためにcode-generationをもう一度開き直した（2026-10-17）。計画の内容は変えていない。

- [ ] Step 19: 2回目の独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）

## 検証と停止条件
各層のtest-after順序、main sessionでの逐次実行、既存品質基準を維持する。今回の変更は記録の整合であり、新規の実装追従テストは追加しない。
現在の証拠は `.artifacts/migration-preflight/current-recovery-input-20261016-v8.json`（SHA256 25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0）と `.artifacts/migration-preflight/current-completion-8c15f728-80d1-40e4-90e6-cea86c413cb8/current-local-verification-report.json`（SHA256 fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079）に固定する。全21工程exit0、coverage1768/1929行（91.65%）、skip0を既存の原ログから照合する。短時間verifyで現在sourceと封印済み証拠の一致を再確認する。既に承認・設定済みのverification-command.txt（command SHA256 10098116c484c2f62527bd65045c06cab2b0a5433e1c312fb7ff6c3322623bef）を変更せず使用し、旧migration-session-completionの16JS入口を現在21JSの完了根拠へ転用しない。U1の現在の完了承認は保持する。AI-DLC本体、180秒期限、非download中央値3秒、coverage80%、容量上限、worker1/retry0を維持する。
証拠不一致、検証失敗、機能上の欠陥、封印対象の変更が必要になった場合は停止して具体的な修正・再検証を確認する。21工程の自動再実行、push、CI試行は本再開計画に含めない。実装計画・試験指示を変えた場合はstrictの再承認を受ける。
U3 installと共有SHA256性能改善は実装済みであり、U3の正式受入れは未完了。文書更新前候補の36試行成功は履歴として保持し、現在の候補への付替えはしない。U3のCI実配信入力修正・再検証は承認済みの後続作業とし、U2再開の記録整合へ混ぜない。現在のローカル証拠だけで統合前CI、U3受入れ、U4の完全C06チェック、U5開始、公開を許可しない。実機Safariは未検証。

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
