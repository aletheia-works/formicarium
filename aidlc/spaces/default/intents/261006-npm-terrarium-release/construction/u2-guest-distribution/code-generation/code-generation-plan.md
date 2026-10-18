# Code Generation Plan — U2 Guest Distribution

## Summary

Builds: 既存U2成果を保持した要件対応記録と証拠同一性の再照合。
Touches: 本Unitの計画・試験指示・要件対応・完了資料と新規verification記録。製品、core、guest、既存検証証拠は保持する。
Tests: 保存済みNode 41件・三browser 15件・coverageの候補同一性を照合し、正式レビューと承認済みチェックポイント検証を行う。

## Current Recovery Plan (2026-10-10)

今回のRequest Changesに対する実行計画はStep 16–20である。下記Step 1–15とRepair Boundaryは過去の実装・修正履歴であり、未チェックのStep 12を含め製品修正や再測定を再実行する指示ではない。今回の計画承認後に着手する。

- [ ] Step 16 — main sessionで既存runner/configurationと保存済み証拠を読み取り確認する。`verification/official-restart-20261010-v2/main-results.json`、既存reconciliation、`.artifacts/u2-guest-distribution/site-repair-v1`、`.artifacts/u2-coverage-repair-v3/report.json`を照合する。固定配布JS 3件、候補11ファイル、source-manifest 18件、traceability 11件の在庫と関連receiptの実際の件数・SHA-256・size・identityを記録する。旧成功を別候補へ付け替えない。
- [x] Step 17 — AC4.3.1、AC4.3.2、AC4.3.3、FR6、FR6.1、FR6.2、NFR1、NFR3、NFR4、NFR5、NFR7の11 IDについて、承認済み要件原文の全条件を実装箇所・名前付き試験・実行証拠へ対応付ける。既存IDを保持する。ファイルが存在するだけではOKにしない。親要件の全体条件、実配信、遠隔CIなどU2証拠だけで満たせない条件はDeferred/GAPと理由・後続担当を明記する。
- [x] Step 18 — code-summary.md、traceability.jsonと新規`verification/ci-traceability-repair-v1/requirement-mapping.md`へ照合結果を反映する。新規読み取り照合helperと結果は同verification配下へ保存できる。既存receipt・review・coverage・候補・source-manifestは上書きしない。U2のpitchfork 2.30.0候補とU3の2.30.1証拠を区別し、今回の照合を最新guest受入れ成功とは扱わない。
- [ ] Step 19 — 保存済みNode 41件・browser 15件、coverage 249/254（98.03%）、skip 0の記録を実ファイルと照合し、観測できた値だけを報告する。runnerの構成を確認してから必要な正式チェックポイント検証をmainで逐次実行する。同一成果の重い再build・再prepare・coverage再測定は既定では行わない。差分や不一致により製品修正・新規測定が必要になった場合は根拠を示して計画を改訂する。
- [ ] Step 20 — 独立した正式レビュー、結果記録、Unit完了・チェックポイント承認の手順へ進む。遠隔CI・全要件の残条件はU4と後続Build and Testへ明示的に引き継ぐ。U1 14件とU2 3件は小計17件であり、全体coverage一覧はU3を含む実際の配布対象から確定する。Code Generation全体の完了確認までStopフックを無効のまま維持する。

既存の修正と検証結果を保持し、AI-DLCの状態・セッション・承認receiptを手編集しない。外部配信、push、公開、PR作成を今回のU2計画に含めない。

## Scope and Sources

担当: GuestDistribution、US4.3 / AC4.3.1–AC4.3.3、FR6.1/FR6.2、C3。
参照: inception/contract-design/contract-summary.md C3、inception/units-generation/unit-of-work.md U2、inception/user-stories/stories.md US4.3、inception/requirements-analysis/requirements.md、inception/delivery-planning/bolt-plan.md B2。
NFR1/NFR3/NFR4/NFR5/NFR7の関連条件を保持する。U1のC1/C2/C8と承認済みskeletonを変更しない。

既存のStep 1–11は実装・ローカル検証済みとして記録されている。Step 12の完了手続と、以下の供給物・測定証拠の欠陥修正は未完了。現在のリポジトリはTypeScriptへ移行済みであり、ソースは.ts、emitされた実行対象とcoverage inventoryは.jsを使用する。現在の試行でこの更新計画の有効なPlan Approvalを得てから修正を開始する。既存成果は保持し、全体を再生成しない。設定・状態・承認receipt・導入済みAI-DLCは手編集しない。

## Implementation Boundary

現在の変更対象はformicarium作業領域内。terrarium向けの供給モジュールを `integration/terrarium/guest-distribution/` に実装し、供給物のproducerを `scripts/guest-distribution/` に置く。これはterrariumへ引き渡すソースであり、formicariumの公開exports/filesには追加しない。C3の所有はterrarium向けGuestDistributionのまま。
ローカルの静的サイト候補は `.artifacts/u2-guest-distribution/site/` に生成し、tools.json / dist/builds.json / ref別guest・fixtures・build-infoを含む。U3で既存terrariumへ接続する際、反映対象と外部作業領域の書込み権限を確認する。ローカル候補を実配信やterrarium本体への反映済み成果として報告しない。

想定ソース:
- integration/terrarium/guest-distribution/manifest.ts: C3 metadataと供給URLの検証。
- integration/terrarium/guest-distribution/fixtures.ts: UTF-8/明示bytesからC1 FsEntryへの変換。
- integration/terrarium/guest-distribution/resolver.ts: resolveGuest、catalogue選択と資産検証の公開境界。
- integration/terrarium/guest-distribution/index.d.ts: C3公開型。
- scripts/guest-distribution/stage.ts: static-musl供給物とmanifestの生成。
- tests/guest-distribution/{manifest,fixtures,resolver,stage,integration}.test.ts、consumer.spec.ts、playwright.config.ts、serve.ts、types.ts、tsconfig.json。
- docs/guest-distribution.md: 配置、provenance、U3/U4への受渡しと未検証事項。

## Contract Details

tools.jsonとdist/builds.jsonの既存Choice/tool/ref/source/describeの意味を維持し、aube/pitchforkのbuildへC3 metadataを追加する。他ツールの既存metadataを保持し形式変更を強制しない。
refはcatalogueの登録keyのみ選択する。branch/tag/full commit/pr-Nをテストし、未配布refをdefaultへfallbackしない。省略ref/fixture/cwdはterrarium基準の既定値を保持し、fixture=''は空seed、undefinedはtool既定。
baseは絶対HTTP(S) URL。供給URLはbase相対で解決し、同一originかつbaseの配布path配下に限定する。資格情報入りURL、path traversal、供給先外URL、許可先外redirectを拒否する。refをURL文字列へ直接連結しない。
guest/fixture/build-infoのSHA-256、schemaVersion、tool/ref、source URL/ref/commit、formatを確認する。guestはELF64 little-endian x86-64でprogram header boundsを検証し、PT_INTERPを拒否する。ELFだけでmuslを断定せずbuild-infoのtarget/build provenanceと照合する。
fixtureは既存relative file mapを/workへ変換できる形を保持し、明示binary entryも扱う。C1と同じroot/path/type/mode/inode/symlink境界を検証し、重複pathやroot外・中間symlinkを拒否する。bytesはコピーする。UTF-8既存fixtureとbinary fixturesは別テストで確認する。
404、未知tool/ref/fixture、metadata不一致、digest不一致、ELF不正は原因と対象を識別できるErrorでrejectする。fallback・暗黙retry・guest起動をしない。機密envやfixture値をエラーへ入れない。
source.commitのない資産をproducerが推測で補完しない。変更のないaubeを再buildしない。pitchforkの既存musl一行patchを保持する。現在dist/guestsではhello/exit3/probeだけを観測しており、実aube/pitchfork供給物とbuild-infoは未確認。利用可能な既存資産を先に調査し、欠落は具体的なblockerとして報告する。

## Ordered Implementation Steps

- [ ] Step 1 — runnerと入力在庫を確認する。既存node:test/Playwright/TypeScriptを使い、main sessionで実体パスとunit-scopedコマンドを確認する。実guest/build-infoの所在・commit・patchを調査し、再buildが必要なら根拠を示す。テスト準備の最小configを作る。AC4.3.1–3/NFR5。
- [ ] Step 2 — manifest.tsでC3 schema・registered ref・供給URL・metadataの検証層を実装する。AC4.3.1/3。
- [ ] Step 3 — manifest.test.tsに正常2ref、branch/tag/commit/pr-N、未知tool/ref、missing commit、format/schema不正、origin/path/redirect境界の5–8論理ケース群を作成しmainで実行する。AC4.3.1–3/NFR4/5。
- [ ] Step 4 — fixtures.tsで既存UTF-8 mapと明示bytesのC1 FsEntry変換を実装する。AC4.3.1/NFR4。
- [ ] Step 5 — fixtures.test.tsに既定/空seed、binary copy、mode/inode、重複/path traversal/root外、symlink境界、cwd既定の5–8ケース群を作成しmainで実行する。AC4.3.1/3。
- [ ] Step 6 — resolver.tsと型を実装する。catalogue→選択→fetch/digest/provenance→SelectedGuestの順で検査し、共通core版とguest refを分離する。AC4.3.1–3。
- [ ] Step 7 — resolver.test.tsに正常2ref、default、fixture=''、未知fixture/404、改変digest、異なるtool/ref/commit、ELF/dynamic guest不正、供給先外redirectのケース群を作成しmainで実行する。types.ts/tsconfig.jsonでC3 consumerをcompileする。AC4.3.1–3/NFR1/4/5。
- [ ] Step 8 — stage.tsでref別static site供給物を生成する。既存buildsを保持し、sha256を実bytesから計算し、build-info/source/patchを照合する。UI・npm・公開workflowは変更しない。AC4.3.1/2/NFR5。
- [ ] Step 9 — stage.test.tsに正常生成、二refの分離、旧/他tool metadata保持、missing asset/commit、不正target/patch、digest対応、npm非同梱の5–8ケース群を作成しmainで実行する。AC4.3.1–3/FR1.3。
- [ ] Step 10 — integration.test.tsとbrowser consumer.spec.tsでローカルHTTP供給をNode/Chromium/Firefox/WebKitから選択しbytes/commit/digest/entries/cwdを照合する。各拒否ケースでguest未実行を確認する。模擬2refのschema試験と実aube/pitchfork資産の供給検証を別記録にし、模擬を実guest合格として流用しない。AC4.3.1–3/NFR1/4/5。
- [ ] Step 11 — U2の配布JS一覧をmanifest.js/fixtures.js/resolver.jsの固定3ファイルとして定め、Node/browserの計測を収集・照合する。未実行を0%、realm欠落を未検証/失敗にする。U1の固定14ファイル・80%基準を維持し、U4へunion用のidentity付き結果を渡す。U2の新規配布JSも第一者配布JS coverageの分母へ加える。CI実行はU4で必須、ローカル成功で代替しない。NFR3。
- [ ] Step 12 — docs、code-summary.md、source-manifest.json、traceability.jsonを更新し、Step 13–15完了後の証拠を反映する。AC4.3.1–3/FR6/NFR関連条件を実装・テストの既存pathへ結び、候補identity/commands/resultsと実配信未検証をU3/U4へ渡す。正規の第三者レビュー・Unit検証・完了記録へ進む。未実施Mustと下記欠陥が残れば完了しない。この完了手続はStep 15の後に実施する。
- [ ] Step 13 — C6/NFR3の測定証拠の結合を修正する。scripts/guest-distribution/coverage.tsのcollector self-testへ、使用済み測定directoryでsourceまたは供給候補を変更して再prepareし、試験を再実行せずreportする再現ケースを追加する。mainで修正前の失敗を観測する。使用済みdirectoryを拒否し、各prepareを新規directoryへ限定する。全Node/browser receiptにpreparation identity、sourceIdentity、candidate digestを結合しreportで一致を検査する。古いreceiptを新規directoryへコピーしたケースも拒否する。mainで同じ試験の成功を確認する。既存成功記録を新候補へ再ラベルしない。AC4.3.1–3/NFR3/NFR5。
- [ ] Step 14 — C3/FR6の既存ref供給を修正する。tests/guest-distribution/stage.test.tsとintegration.test.tsへ、既存rootにold refを配布してnew refだけを追加した候補から両refのguest/fixture/build-infoをHTTP取得する再現ケースを追加し、mainで修正前の失敗を観測する。scripts/guest-distribution/stage.tsに既存distribution rootの明示入力を追加し、保持するcatalogueの全資産を候補へコピーする。既存C3資産はdigest/provenanceを照合し、legacy資産は既存schemaの意味とbytesを保持して同じ形式へ強制移行しない。root外path・symlink・欠落資産は生成失敗とし、利用可能な完成候補として出力しない。mainで同じ試験の成功を確認する。既存rootがないのに保持metadataだけを残す経路を拒否する。AC4.3.1–3/FR6.1/FR6.2/NFR5。
- [ ] Step 15 — mainで修正後のU2全Node試験、型、lint、collector self-test、三browserを逐次再実行する。新規測定directoryで固定3ファイルのNode/browser coverageを収集し、identityと欠落拒否を再確認する。保持ref全資産の存在・HTTP解決を候補に結合して記録する。U1固定14ファイルとU4全17ファイル/80%/統合前CIの条件は保持する。成功後にStep 12へ戻り完了資料を更新する。AC4.3.1–3/NFR1/NFR3/NFR5。

## Repair Boundary

既存の再現済み問題は、同じ測定directoryへの再prepareが旧成功receiptを新sourceへ採用できることと、既存refのmetadataを保持したstandalone候補に対応資産が欠落すること。前者はC6の候補同一性、後者はC3/FR6の既存ref選択を満たさないため、本Unitの完了前に修正する。既存review文書・receiptは変更しない。

修正対象は scripts/guest-distribution/coverage.ts、scripts/guest-distribution/stage.ts、tests/guest-distribution/stage.test.ts、tests/guest-distribution/integration.test.ts、および測定receiptを作る既存 tests/guest-distribution/consumer.spec.ts / serve.ts と docs/guest-distribution.md。生成preload/receipt側の必要変更はcollector内へ限定する。共有 scripts/coverage-types.ts の既存 generation/sourceIdentity/candidateSha256 fieldsは保持し、U2の必須結合を型で表すために必要な最小変更だけを対象に含める。resolverの公開契約、npm exports/files、U1 runtime、guest source、外部配信先は変更しない。利用可能な既存資産をコピーし、変更のないaubeを再buildしない。

## Verification and Completion

方法はtest-after。各層を実装してから対応テストを作成・main sessionで逐次実行する。今回の復旧は新規製品実装前の順序調整であり、AI-DLC guardの変更・回避や承認の代替ではない。
normal caseと2つ以上のerror/edge caseを各componentに含める。実行コマンドはunit-test-instructions.md。timeouts/1 worker/no retries/native比較/wasm1GBを緩めない。性能測定・aube本体の再buildは本Unitの既定検証に追加しない。
実配信・CI・公開RC受入れはこの計画時点で未検証。U2のローカル契約fixture成功を外部公開済みの供給成功と呼ばない。実aube/pitchfork欠落は早期に報告する。

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
