# 初期試行の実装計画

## Summary

- Builds: 5回目の再開（Steps 24–25）。共有の `scripts/package/coverage.ts` のPlaywright suiteの許可リストへの `command` の追加（1行）を、U1の変更として引き受け、最終sourceでの36試行とv11の成功を記録する。
- Touches: U1の記録（code-summary）。コードの変更（1行）と、その試験（U4のacceptance）は、mainのworking copyにある。
- Tests: 新しい試験は追加しない。mainで、U4・U3のacceptanceとpackageのcoverage試験82件pass、最後のまとめた確認（36試行、U3・U4の受入、v11）がすべて成功。独立レビューと、intentの検証コマンドによるcheckpointの確認を行う。

## Sources and Boundaries

FR1/FR9、U1、C01/C11、U1 NFR要件/DS1–6/基盤設計。user storiesは省略済みなのでFR/NFRを各stepへ直接対応付ける。Steps1–8の実装と過去の実測は保存済みで、再実装しない。現在の変更済みsourceに対する完了確認は未検証。U1 packagingは機能設計の対象外で、C01を機能境界に使う。共通install/command/public guest APIと汎用builderは後続単位。SHA256の性能改善はU3の計画に保持し、このU1復旧で先行実装しない。

観測済み: mise lsにproject-pinned Node24.21.0/Bun1.4.2、既存tsconfigがscripts/testsを含む。既存runtime/web/api.ts、integration/terrarium/guest-distribution/resolver.tsのELF検査、scripts/package/coverage.tsが存在。vivarium AGENTS/mise/workflow一覧を読んだがmusl固定guest専用workflowは存在しない。runner容量・権限・baseline remote存在・資産の実URL/版・CORS・速度は未検証。これらは作業内で観測し、失敗時は確認する。

## Implementation Steps

- [x] Step 1: main sessionでjj状態/変更前revision、既存generated資産・依存・API consumer baselineを記録。mise run build / typecheck / test-light / test-consumer と必要な既存probe/aube回帰を順次確認。失敗・入力欠損では変更前に停止し既存失敗を提示する。未変更aube再buildなし。（NFR2/NFR8）
- [x] Step 2: scripts/migration-preflight/とtests/migration-preflight/のrunner/configを整備。mise.tomlにmigration-preflight-unit、migration-preflight-browser、migration-preflight-verify taskを追加。tests/migration-preflight/playwright.config.tsは3browser/worker1/retry0、isolated server。scriptsのgenerated JSは既存build/emit方式を確認して適合させる。新taskは実装後に実体を確認し、既存taskを呼べることだけでU1合格にしない。（FR1/NFR6）
- [x] Step 3: scripts/migration-preflight/evidence.tsにC01型・36行一意性・有限非負時間・各組合せ中央値/初回/最大/fetch・baseline identity/reuse照合と全条件AND判定を実装。その後tests/migration-preflight/evidence.test.tsに正常、欠落、重複、CORS/exit失敗、3000境界/超過、時間不正、cache identity不一致の5–8件以上を作成・実行。（FR1/FR9/NFR1.1/NFR5.1/NFR7.1）
- [x] Step 4: scripts/migration-preflight/assets.tsに公式資産を固定版/URL/digest/source metadata入力から有限取得・全entry安全検査・展開・ELF検証copyへ導く試行用経路を実装。既存検証を再利用し、新公開APIを先行変更しない。全hopを検査できないbrowser取得はredirect:error等で検査不能を失敗とし、ミラー案確認まで停止。tests/migration-preflight/assets.test.tsでdigest/ELF/metadata、path/link/duplicate/truncated、容量境界、HTTP/redirect/timeout/abortのfixtureを実装後に実行。（NFR3.1/NFR3.2/NFR4.1/NFR4.2）
- [x] Step 5: scripts/migration-preflight/runner.tsとtests/migration-preflight/serve.tsで既存公開browser API/Worker資産をsame-origin/COI/CSP下で起動。計測と非計測の検査を分け、各trialは新session、cache条件を明示。実行対象は同一固定版guest、trial0と1–5、6組合せ36行。出力はtextとbyte digest。tests/migration-preflight/runner.test.ts（5–8件、epoch/取消/cleanup/計測欠落/入力copy）とconsumer.spec.ts（3browser×2tool×6trial）を実装後に逐次実行。性能trialはcoverage instrumentationなし、coverageは別経路で既存固定分母を維持。（FR1/NFR1.2/NFR2.1/NFR6.1/NFR7.1）
- [x] Step 6: integration/vivarium/preflight/build-baseline.sh と baseline-workflow.yml に最小Biome musl CI試行案を作成。FR9完全commit事前照合、tool/repo/commit/builder hash/全依存入力によるcanonical key、ELF/build-info検証、staging/単一writer/atomic受入、同key第2回compile省略、4h deadline/子process group取消を備える。Actionの最新versionを公式情報で確認し全SHA/commentを固定、toolchain/image入力を明示。tests/migration-preflight/baseline.test.tsでkey変化/改変/欠損/同key再利用/途中終了を実装後に検証。これはvivariumへ移すレビュー可能な案で、local模擬試験をremote CI実績と呼ばない。（FR9/NFR4.1/NFR5.1/NFR8.1）
- [x] Step 7: scripts/migration-preflight/verify.tsへ実C01/環境・入力inventory/CI run URL・build evidence/必要試験・coverage照合を組み込み、欠落では非zero終了。migration-preflight-verifyが実装済みUnitだけを対象に、必須unit/integration/E2E/coverageと実成果を検査する入口となる。現時点のtask名は設計上の予定で共通検証コマンドの承認ではない。（全NFR）
- [x] Step 8: docs/results/terrarium-migration-preflight.md とJSON evidenceの出力先を整備、実URL/版/digest/環境/負荷/cache/36行/初回中央値最大/fetch/remote build再利用を記録。実際のvivariumへの変更・push・workflow起動・Release保存が必要な段階では具体差分/対象commit/job/保存先/費用/切戻しを示し個別承認を待つ。その操作とremote実測証拠が未完ならU1未完のまま停止。（FR1/FR9/NFR8）
- [x] Step 9: 本体既存回帰とfirst-party固定分母line coverage≥80%をmain sessionで逐次検証。probe600s/8項目、aube840s、worker1/retry0、native完全一致、wasm1GB、waitAsync削除維持。入口整備後、初回の単位完了確認前に実コマンド・必須試験/coverage対応と未実行範囲を提示して承認後に確定。code-summary/traceability/source-manifestには生成物も含め全変更と実結果を記録し、完成したコードの独立レビュー後にU1受入。（全NFR）
- [x] Step 10: 完了確認の復旧。修正済みverify-completed-result.mjsの固定U2一覧・277 source snapshot・135 evidence seal・14工程・1370 realms・coverage80%・同一CI/head/署名/pack照合を維持する。retained-evidenceの成功は過去のU2だけを確認し、currentSourceVerified=falseの結果で現在のUnitを承認しない。現在のU1/U2を検査する入口を整備し、新規候補のsource/pack/独立consumerを固定して、U1試験、既存U2/APIのNode・Worker・3ブラウザ回帰、現在の全配布JSを分母とするcoverageを逐次実行する。新しいinstall JSを未収集として分母から除かず、必要なinstall回帰も収集する。U3の性能受入とCIはU3の未完項目として残し、今回の成功でU3完了としない。改変・欠落・非zero・古い候補の拒否を試験し、新しい実コマンドと検査範囲を人間に提示・承認後に設定する。新しい結果のsource/pack/全工程記録が揃うまで、過去の成功資料で現在のコードを合格にしない。（FR1/FR9/NFR2/NFR8）

## Test Ordering and Scope

runner準備→各層実装→同層試験のtest-after。既存不具合は再現失敗→修正→同試験成功。DB/新HTTP API/製品端末UIは対象外。C01用fixtureの成功と実guest試行の成功を区別。Standardの各部品5–8件以上、境界統合と要件による性能/E2E、安全性試験を追加。Testing Contractのscope_floor欄が追加floorなしでも、上流NFR2のcoverage80%と既存品質条件は必須。

## Impact and Rollback

## 今回の再開：現在の確認を復旧する

- [x] Step 11: U1の既存実装・固定証拠・Testing Contractを保持し、現在のsource-manifestと実ファイルの対応を確認する。mise.tomlのAI-DLC pinと実行版は2.11.1-preview.20261015.1に一致している。AI-DLC本体・品質条件・U2/U3の実装はこの復旧で変更しない。
- [x] Step 12: main sessionでU1単体とcurrent-completionの拒否試験を逐次実行し、既存成功資料が現在のsourceにも適用できるかを検査する。旧v6資料のsource一致を仮定せず、不一致なら過去資料として保持し、新固定入力・候補・全工程を具体化する。未実行試験やU3の成功をU1の現在の完了確認へ代用しない。
- [x] Step 13: `.gitignore` に `!/scripts/migration-preflight/current-coverage.js` と `!/tests/migration-preflight/current-completion.test.js` の個別例外2行だけを追加する。2件の生成JSの内容は変更せず、jjでローカル追跡する。`.js.map`やほかの生成物へ追跡範囲を広げない。source-manifestへ `.gitignore` を個別claimし、変更範囲の記録を整合させる。v8の入力・候補・pack・全source・全証拠のSHA一致を確認し、不一致なら停止する。封印対象がすべて不変の場合は21工程を再実行せず、独立レビューを再要求する。（FR1/FR9/NFR2/NFR8）
- [x] Step 14: 検証結果・source-manifest・code-summary・traceabilityを整合させ、現在の成果への独立レビューを実施する。新しい完了確認コマンドが必要な場合は実コマンドを提示し、人間の承認後に設定・実行する。確認成功後だけU1完了確認を復旧し、U3の承認済み修正計画へ戻る。外部push・CI起動・証明書操作は今回の再開承認に含めない。AI-DLC本体、180秒、非download中央値3秒、coverage80%、容量上限、worker1/retry0は維持する。

runtime公開API/core、旧terrarium/vivarium recipe/verdict、showcase、infra stateはここで変更しない。新規試行scripts/tests/taskとCI試行案に限定。既存emit設定に不足があれば最小変更しmanifestへ記録。各PR変更前revisionとinventoryを保存しjjで当該変更だけ戻す。生成stagingだけを破棄して既存受入資産・他者変更を保持。外部操作は計画承認と別の具体承認を待つ。

## 今回の再開（2026-10-17）：最新toolchainでの確認と、レビュー指摘の修正

人間の方針（2026-10-17）：自分たちの開発・検証で使うtoolは最新版を使う。古い版で作った記録や成功結果は、今のtoolchainの根拠にしない。古い版を一時的に使って過去の記録を通さず、最新版で実行した成否だけで確かめる。Steps 1〜14にあるNode 24.21.0・v8以前の記述は、古いtoolchainでの履歴として残す。

この再開は、U4の作業を戻したことによる。その変更（mise.tomlへのU4 taskの追加）と、AI-DLCの更新（mise.tomlのpinを2.11.1-preview.20261016.1へ）で、U1がclaimするmise.tomlが変わった。

- [x] Step 15: 最新toolchainでの再確認（実施済み。人間が承認した3つの修正案 `u1-rereview-repair-proposal.md`・`u1-latest-toolchain-revalidation-proposal.md`・`u1-current-evidence-assembly-proposal.md` による）。
  - R-01を修正した：`baseline.ts` の `readAccepted` に1MiB上限と重複keyの拒否を入れた。新規の `unique-json.ts` を作った。
  - current completionを変えた：retained工程をやめて20工程にした。手作業の `verification-input.json` は使わず、同じ実行の証拠から受入証拠を組み立てて照合する（新規 `current-evidence.ts`）。
  - vivarium baselineをNode 26.12.0に上げた（`baseline-workflow.yml`・`build-baseline.sh`・controller）。
  - 実行の結果：vivarium CI run 38990951678はsuccess。36試行は36件すべてpass。v10は20工程すべてexit0、coverage 91.65%。
  - 承認済みの検証コマンドは `verification/verification-command-u1u2-v10.txt`。
  - 試験：current＋evidenceが25件、U1 unitが56件、どれもpassでskipなし。（FR1/FR9/NFR2/NFR8）
- [x] Step 16: 前回の再レビュー（review-08）の指摘を直す。各項目で、先に再現試験を書いてfailを観測し、修正してから同じ試験のpassを確かめる。対象は次の4件。
  - (Major) 受入証拠の `environment.node` が、組み立てた時点の `process.version` になっている。36試行の記録自体にNodeの版がないので、「今のNodeで作った証拠だけ」という確認が、試行については空になっている。直し方：`tests/migration-preflight/consumer.spec.ts` が、試行の記録の `environment` に、実行したNodeの版（`node`）とPlaywrightの版（`playwright`）を書く。`scripts/migration-preflight/current-evidence.ts` は、全試行で両方の値が同じで、しかも今の `process.version` と導入済みの `@playwright/test` の版に一致する場合だけ受け付ける。
  - (Minor) 36試行のPlaywrightログ（browserLog）が、trials directoryと結び付いていない。直し方：ログに出た36件の試験名（tool・browser・trial番号）が、trial fileの36件と1対1で一致することを照合する。
  - (Minor) `readAccepted` の1MiB上限が、file全体を読んだ後に判定されている。直し方：読む前にfileの大きさを確かめ、上限を超えれば読まずに拒否する。
  - (Minor) reportの `pending` に、完了済みのU3の項目が残っている。直し方：今の未完の項目（現在のsourceの署名付きCIとmerge、U4のB1統合受入）だけを書く。

  変更するfileはU1のものだけ：`consumer.spec.ts`、`current-evidence.ts`、`current-completion.ts`、`baseline.ts` と、その試験。mainが逐次実行する：build、typecheck、`mise run migration-preflight-unit`、current＋evidenceの試験。（FR1/NFR2/NFR8）
- [x] Step 17: code-summaryとsource-manifestを更新し、独立レビューを受ける。そのあと、intentに記録された検証コマンドでcheckpointを確かめる。

v10の実行結果は、Step 16の修正より前のsourceで得たものである。Step 16の修正を含むsourceでの36試行とcurrent completion（v11）は、U4の共有fileの変更がすべて終わった後に、1回だけまとめて実行する（段階B）。新しい検証コマンドは、その時点で提示して承認を受ける。それまで、v10の結果を修正後のsourceの成功証拠としては扱わない。

## 今回の再開（2026-10-17、2回目）：U4の変更のうち、U1のfileに当たるものを引き受ける

U4の追加Step項目4（配布JSが23件になったことと、`createCommandSession` のexport）で、U1がclaimする試験fileが変わった。人間の判断で、その変更をU1の変更として引き受け、U1をこの1回だけやり直す。変更はmainのworking copyにすでにあり、mainが逐次実行して、次のとおりpassした（fail・skipは0）。
- `tests/package/pack.test.ts`・`coverage.test.ts`・`public.test.ts` と `tests/terrarium/coverage.test.ts`：package・terrariumの試験で44件。
- `pack.test.ts`：U4の新しい候補で7件。

- [x] Step 18: 上の試験fileの変更（21件を23件にする。PACKAGE_FILESを31件から33件にする。名前の一覧に `command`・`command-parse` を加える。root exportの一覧に `createCommandSession` を加える）をU1の変更として確かめ、U1の記録（code-summary、source-manifest）に書く。期待値は、実際の配布一覧（`FIRST_PARTY_JS`）に合わせただけで、試験の判定条件は緩めていないことを確かめる。（NFR2/NFR8）
- [x] Step 19: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでcheckpointを確かめる。

U4の作業がすべて終わった後に、最終的なsourceで、36試行とcurrent completion（v11）を1回だけまとめて行う。この方針は変えない。

## 今回の再開（2026-10-17、3回目）：公開用inventoryの23件への更新を引き受ける

最後のまとめた確認のD2（U3の受入）が、`test-light` でpublication-alignmentの2件（21件・31file前提）のために止まった。人間が承認した修正案（U4の `publication-inventory-23-proposal.md`）に従い、U4の計画の項目7で次を変えた。変更はmainのworking copyにある。
- `scripts/release/inventory.ts`：`FIRST_PARTY_JS` に `runtime/command-parse.js`・`runtime/command.js` を加えて23件（`PACKAGE_FILES` は33file）。`HISTORICAL_U1_JS`（14件）・`HISTORICAL_PACKAGE_FILES`（24件）は変えていない。
- `tests/tooling/publication-alignment.test.ts`：期待値と試験名を23件・33fileへ。配布用inventoryとの完全一致の判定は残した。
- `.github/publication/runner.mjs`・`runner-manifest.json`：固定のBun 1.4.3・Biome 2.5.15で作り直した（差分はinventoryの2行と、manifestのSHA256・size）。`bootstrap.mjs` は同じbytes。
- mainの観測：publicationの5試験file 61件pass、`mise run test-light` exit 0（package 192 pass・既存のskip 2、tooling 237 pass）。

この3つのfile（と生成JS）はU1もclaimしているので、U1をこの1回だけやり直す。

- [x] Step 20: 上の変更をU1の変更として確かめ、U1の記録（code-summary、source-manifest）に書く。fileを読んで、公開の境界（`HISTORICAL_PACKAGE_FILES` にないfileを含むpackを「U2 publication missing module coverage; U4/B1 evidence required」で拒否すること）が変わっていないことと、期待値を実際の配布一覧に合わせただけであることを確かめる。（NFR8）
- [x] Step 21: 独立レビューを受ける（この試行のやり直しのレビューは使用済みなので、人間の依頼として記録する）。そのあと、intentに記録された検証コマンドでcheckpointを確かめる。

## 今回の再開（2026-10-17、4回目）：current-candidateの試験の期待値の引受け

公開用inventoryの更新のあと、最後のまとめた確認のD2（U3の受入）が、今度は `test-consumer` で止まった。`tests/terrarium/current-candidate.test.ts` が、配布fileを31件と固定していたためである（実際は33件）。人間の指示で、期待値を33へ直した（1行だけ）。このfileはU1もclaimしているので、U1をこの1回だけやり直す。
- mainの観測（証明書なし、Node v26.12.0）：U3の候補で、build・typecheck・test-light（194・237件pass）・test-consumer（205件pass）・migration-session-unit（46件）・migration-install-unit（74件）。候補を作り直したあと、U4の候補で、test-consumer（205件）・migration-command-unit（94件）。どれもfail・skip 0。

- [x] Step 22: 上の変更をU1の変更として確かめ、U1の記録（code-summary）に書く。期待値を実際の配布一覧（`PACKAGE_FILES` の33件）に合わせただけで、判定（`verifyInstalledPackage` の照合）は変えていないことを、fileを読んで確かめる。（NFR8）
- [x] Step 23: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでcheckpointを確かめる。

## 今回の再開（2026-10-17、5回目）：共有coverageのsuiteの許可リストの引受けと、最後のまとめた確認の結果

最後のまとめた確認のD3（U4の受入）が、coverage-reportで「invalid Playwright expected suites」で止まった。共有の `scripts/package/coverage.ts` の `readPlaywrightNodeRealms` が、suiteとして package・session・install しか許していなかったためである。人間の指示で、許可リストに `command` を加えた（1行。U4の試験でRED→GREEN）。このfileはU1もclaimしているので、U1をこの1回だけやり直す。

その後、最終的なsourceで、最後のまとめた確認をすべて行い、成功した（mainの観測、Node v26.12.0）。
- U1の36試行（`mirror-browser-final-20261017`）：36件pass、中央値505〜751ms、記録にNode v26.12.0・Playwright 1.64.1。
- U1のcurrent completion v11：入力 `current-recovery-input-20261017-v11.json`（SHA256 d0798e289bb017cc17bae5e95788dcea0cdcf8bde0041d2292afdf46ab758a6f）、20工程pass、report `current-completion-64f021b6-7aba-46dd-acb3-265040ada0fb/current-local-verification-report.json`（SHA256 387549e63296321962b83a062b1d2535e9c04c852783230afff5a6ec5021d486）、verifyは `verified:true`・`currentSourceVerified:true`。pendingは、署名付きCIとU4のB1（U4の受入ではB1の31 checkがpass済み。CIは未実施）。

- [x] Step 24: 上の変更をU1の変更として確かめ、U1の記録（code-summary）に書く。許可リストに1つ加えただけで、空・重複・未知のsuiteの拒否と、suite registryの完全一致の判定は変えていないことを、fileを読んで確かめる。v11の結果を記録する（v10は履歴）。（NFR8）
- [ ] Step 25: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでcheckpointを確かめる。

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

