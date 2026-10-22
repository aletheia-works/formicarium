# U9 retirement-acceptance 実装計画

## Summary

- Builds: 新しい機能は作らない。formicarium から terrarium の言及と、terrarium だけの code・試験を消す1つの PR。削除の手順書（追跡しない）。削除の前と後の確認の記録。
- Touches: formicarium の `aidlc/` の外の、terrarium の言及がある file（2026-10-21 の観測で 82 件）。主に次のもの：`scripts/terrarium/`・`tests/terrarium/`・`integration/terrarium/`（terrarium だけの code と試験）、`package.json` の script、`.github/workflows/` の該当の job、`docs/`、`README.md`、`runtime/session.ts`・`runtime/command-parse.ts` の comment。vivarium は言及が0件なので変えない（Step 1 で確かめる）。
- Tests: 新しい試験は作らない。消した code を参照する試験を直す。既存の試験・lint・型検査・coverage 80% を main session で1つずつ実行し、重い受入は PR の CI で確かめる。外部の削除は人が行い、私は読取りで確かめる。

## 前提と境界

根拠は次の3つ。

- `../nfr-requirements/security-requirements.md`：NFR1.1〜NFR8.11 と置き換えの表
- `../nfr-design/security-design.md`：D0〜D7、S1〜S10
- 人間の回答（2026-10-21）：方針は全削除、確認の質問は B、Q1〜Q6 は A、NFR Design の Q1〜Q3 は A

U9 の Functional Design と Infrastructure Design は無い。Infrastructure Design は、新しい基盤を作らないので飛ばした。

NFR Design の review-01 の Minor 4件は、次の Step で扱う。

| Minor | 扱う Step |
|---|---|
| pack に見える公開の名前の変更は、動作の変更と同じに扱い、版を決める | Step 2・Step 5 |
| 他の aletheia-works の repository の branch を検索しない範囲を、対象外として明記する | Step 1 |
| `aidlc/` の中で、残してよい path の外にあるもの（`aidlc/active-memory/`）を扱う | Step 1・Step 9 |
| D3（npm の削除）を、PR の merge と CI の成功の後に限る | Step 7 |

守ること：

- jj を使う。署名を外さない。push・PR・外部への書込みは、そのつど内容を示して承認を受ける。
- 元に戻せない削除（repository・npm・JSR・fork・clone）は人が行う。
- token を chat・file に出さない。
- aube は再 build しない。
- 指摘の外の改善と全体の整形はしない。
- 品質の基準とタイムアウトは緩めない。

## Steps

- [ ] Step 1: 前の確認（D0、読取りだけ）。
  - S1：U6 の証拠の SHA256（`3939063d…7dba`）・evidenceId・19行の passed を確かめる。U8 の `showcase-site-evidence-39509852083-deployed` を取得して、SHA256・evidenceId・全行の passed を確かめる。期限切れなら、承認を受けて main で手動の実行をやり直す。どれかが合わなければ止めて報告する。
  - S9：npm の直近30日と直近1週間の download、JSR の meta、GitHub の dependents を記録する。
  - S6：formicarium と vivarium の手元の `jj file list` に `rg -il terrarium` と `rg -il 'inputs\.tar\.gz'` を実行する。両 repository の upstream の全 branch には `git grep -il terrarium` を実行する（読取り）。他の aletheia-works の repository は `gh search code --owner aletheia-works terrarium` で見つかった所を一覧にするだけで、その他の branch は対象外と記録する。
  - main 以外の branch で一致があれば、branch ごとに人に聞く。
  - `aidlc/active-memory/` の一致は、`aidlc/spaces/default/memory/` の写しかどうかを確かめて記録する。写しなら、D7 で同じ扱いにする。
  - S8：`gh api orgs/aletheia-works/rulesets` と、両 repository の `infra/` の `rg -i terrarium` を実行する。
  - S10：U1・U3 の測定の記録の path と日付を一覧にする。
  - 結果は code-summary に書く。（NFR8.1、NFR8.6、NFR8.7、NFR8.10、NFR1.1）
- [ ] Step 2: 分類（S2・S4）。82 件の file を、次の5つに分ける。
  - (a) comment
  - (b) 文書・README・`docs/results` の記録
  - (c) 試験の名前と fixture
  - (d) terrarium だけの code と試験：`scripts/terrarium/`・`tests/terrarium/`・`integration/terrarium/` と、それを呼ぶ `package.json` の script・workflow の job・coverage の分母
  - (e) 名前の約束：型・message の type・event・環境変数・CLI の option・file の名前・schema の値

  file ごとの表にし、変え方（消す・書き換える）と、pack に入るかどうかを書く。(d) で消す試験と対象の対応表と、coverage の分母の増減も書く。表を人に示して承認を受けてから Step 3 に進む。

  承認が別に要るのは次の2つ。
  - (e) のうち、pack に入る公開の名前（`types/`・`runtime/public.*` などから見える名前）。動作の変更と同じに扱い、版（semver）をどうするかを人に聞く。
  - (d) で coverage の分母が変わるもの。（NFR2.2、NFR2.4）
- [ ] Step 3: 削除と書き換えの実装。`main@upstream` の上に `jj new` で1つの change を作り、Step 2 の表のとおりに変える。(d) は対象と一緒に消し、それを参照する試験・script・workflow を直す。(e) は送り手と受け手を同じ change で変え、互換の adapter は作らない。表に無い変更はしない。（NFR2.2、NFR2.4、NFR8.5）
- [ ] Step 4: 手元の確認。次を main session で1つずつ実行し、結果を記録する。
  - `mise run typecheck`
  - `mise run build`
  - `mise run lint:all`
  - `mise run test:light`
  - `mise run showcase:unit`
  - `mise run showcase-site:unit`
  - `mise run showcase:boundary`
  - 変えた file に関係する単体試験：`unit-test-instructions.md` の command

  重い受入（probe、aube のブラウザ、移行の受入）は手元では実行しない。PR の CI で確かめる。もう一度 `rg -il terrarium` を実行し、`aidlc/` の外の一致が0件であることを確かめる。（NFR2.1、NFR8.6）
- [ ] Step 5: pack の確認（S3）。`mise which npm` の npm で、変更の前（`main@upstream`）と後に `npm pack --dry-run --json` を実行し、pack に入る file と変わった file を一覧にする。変わった file の差分が、Step 2 の (a)・(b)・承認済みの (e) だけであることを確かめる。公開の名前が変わる場合は、Step 2 で人が決めた版の扱いを記録する。`showcase/b1-pack.json` は変えない。（NFR2.3）
- [ ] Step 6: PR。差分（file の数・行数・Step 2 の表との対応）を示して承認を受ける。bookmark を作って fork に push し、上流に PR を出す。head・commit の数・file の数・署名を確かめる。CI を待ち、人が merge する。（NFR2.1、NFR8.5）
- [ ] Step 7: 削除の手順書（D2、S5）。Step 6 の PR が merge され、main の CI がすべて成功した後に、`.artifacts/u9-retirement/deletion-runbook.md` を書く。
  - 冒頭に3点を書く：元に戻せないこと、PR は revert で戻せること、第三者の複製は消えないこと。
  - 手順の行：1 npm、1b npm の support、2 JSR、3 repository、4 fork 2つ、5 手元の clone と jj の remote。各行に、確かめ方を書く。

  内容を示して承認を受ける。merge と CI の成功の前には、手順書の承認を求めない。（NFR8.2、NFR8.3、NFR8.4、NFR8.8、NFR8.9、NFR8.11）
- [ ] Step 8: 人による削除（D3〜D5）。人が手順書の順に実行する。npm の直前に、S9 の利用の記録をもう一度取る。依頼（npm の support・JSR の運営）の返答を待つ間は、手順 3〜5 を先に進めてよい。各段の日時と結果（人の報告と私の読取り）を記録する。運営が削除を断ったときは、結果を人に示して判断を受ける。（NFR8.2、NFR8.3、NFR8.8、NFR8.10）
- [ ] Step 9: 後の確認（D6、S7・S6）。
  - S5 の表の確かめ方をすべて実行する：`gh repo view` が見つからない、`npm view` が 404、JSR の meta、Pages の URL が 404、fork、`jj git remote list`。
  - Step 1 と同じ検索をやり直す。
  - 合格の条件：手元の一致が、残してよい path（`aidlc/spaces/default/` の intents・memory・codekb・knowledge と、その写しの `aidlc/active-memory/`）の外で0件。

  残ったものがあれば人に示す。（NFR8.2、NFR8.6）
- [ ] Step 10: 文書と追跡。code-summary.md（各 Step の command と結果、人の承認と判断、置き換えの表、未検証のもの）、traceability.json（NFR1.1〜NFR8.11 を Step と証拠へ）、source-manifest.json（変えた path）を書く。D7（intent を閉じた後に、AI-DLC の記録・memory・codekb・knowledge・`aidlc/active-memory/` の言及を消す別の PR）は U9 の外の残りとして書く。（FR16、NFR8.8）

### 2026-10-21 の Request Changes について

2026-10-21 に、Code Generation の段階を閉じるときの扱いで、人間の選んだ Request Changes が段階の全体に記録された。人間の意図は U2 の一覧の変更だけで、U9 の計画を変える指示ではなかった。この計画の Step と内容は変えない（人間の回答 2026-10-21「A」：計画をそのまま承認し直して Unit ごとに進める）。

### 追加Step：CI Pipeline の境界の確認の後（NFR8.2 の承知、2026-10-22、人間の回答 A）

CI Pipeline の Construction → Operation の確認（`verification/phase-check-construction.md`）が FAIL になった。U9 の `traceability.json` の `NFR8.2` が `Deferred` のまま残っているため。JSR の `@aletheia-works/terrarium` は「Only empty packages can be deleted」で削除できず、人間の判断で archive にした。`meta.json` は 200 を返し、3つの版（0.1.0・0.2.0・0.3.0）が残る（Build and Test の `test-results.md`、`.artifacts/build-and-test/logs/b2/p17.txt`）。要件は別の Unit へ移っていないので `N/A` にすると基準を緩めることになる。人間の回答（2026-10-22、U1・U3・U9 の進め方の質問への「A」。その A は「U9 は「失敗のままと承知」で記録します」）：失敗のままと承知して記録する。CI Pipeline の Q5 の回答 A は「持ち主の段階に戻り、各行の状態を直すか、直せない理由を決める」で、この Step はそれに当たる。

- [ ] Step 11: `traceability.json` の `NFR8.2` は `Deferred` のまま変えない。note に「JSR は削除できず archive。meta.json 200、3つの版が残る（2026-10-22 の読取り）。人間が失敗のままと承知して記録すると決めた（2026-10-22、U1・U3・U9 の進め方の質問への回答 A）。JSR の運営への削除の依頼はしていない」と書く。基準は変えない。`code-summary.md` にこの節を足す。追跡の確認（`aidlc engine sensor-traceability --stage build-and-test`）はこの行で Fail のまま残り、Operation へ進むかどうかは、CI Pipeline の境界の確認で人間に諮る。
- [ ] Step 12: 独立レビューを受け、intent の検証コマンドで U9 の checkpoint を確かめる。

## Step と ID の対応

| ID | Step |
|---|---|
| FR16 | 1、7、8、9、10 |
| NFR1.1 | 1 |
| NFR2.1 | 4、6 |
| NFR2.2 | 2、3 |
| NFR2.3 | 5 |
| NFR2.4 | 2、3 |
| NFR8.1 | 1 |
| NFR8.2 | 7、8、9 |
| NFR8.3 | 7、8 |
| NFR8.4 | 7 |
| NFR8.5 | 3、6 |
| NFR8.6 | 1、4、9 |
| NFR8.7 | 1 |
| NFR8.8 | 7、8、10 |
| NFR8.9 | 7 |
| NFR8.10 | 1、8 |
| NFR8.11 | 7、9 |

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
