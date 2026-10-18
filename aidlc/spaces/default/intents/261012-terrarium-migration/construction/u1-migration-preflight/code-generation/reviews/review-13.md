## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/migration-preflight/baseline.ts > readAccepted, lines 293–294; integration/vivarium/preflight/baseline-controller.mjs > readAccepted | cacheのbuild-info.jsonは容量確認なく全量を読みJSON.parseで処理する。重複fieldで最後の値を正しい値にしたmetadataは、重複を失ったobjectとしてidentity/canonical照合を通り、runBaselineのreuse経路はcompileSkipped=trueを返し得る。共通型の正規化規則は重複key拒否、C11はmetadata1MiB、U1 NFR3.2/DS2はduplicate拒否を要求する。この命題はreadAccepted/reuse境界に限定する。後から既存cacheを改変した場合、最終verifyFileのfirst/reuse receiptとraw buildInfoSha256照合は通常その改変を拒否するため、最終受入まで通るとは主張しない。 | cached build-infoにも1MiB上限と重複keyを保持して拒否するJSON読取りを適用し、CLI入力と生成controllerへ反映する。最後の値が正しい重複key、escaped alias、上限+1をreuse拒否する試験を追加し、既存receiptとのraw SHA照合は維持する。 | Resolved (reviewer) |
| R-02 | Minor | scripts/migration-preflight/assets.ts > extractTar, lines 295–391 / acquireAsset extract phase | 全entry検査・link検査は同期ループで、signal/deadlineを受け取らず、event loopへ制御を返す分割点もない。C11とDS2が求めるCPU処理の分割境界での取消確認がこの区間にはない。取得・gzip stream・後続digestには取消経路があるが、tar検査中に届く取消の処理はその区間が終了するまで遅れる。実上限入力の遅延時間は未検証であり、今回の性能試行失敗とは扱わない。 | 全entry・link検査に適切な分割点でyieldとsignal/deadline確認を設け、途中取消で後続の登録へ進まない境界試験をmain sessionで実行する。 | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands | 今回の回復レビューではbrowser/verifyと記録済み完了確認コマンドを再実行していない。記録済みコマンドはU2の固定結果・旧source inventoryを読むため、現在の候補全体に対する成功証拠としては未検証。過去の36試行・CI・coverageの履歴と、現在のソースを用いた受入を区別する必要がある。 | 現在の候補と入力に対応する検証入口・証拠をmain sessionで照合する。過去の成功結果を新しい候補の完了証拠に置き換えず、未再実行範囲を明記する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/unit-test-instructions.md > Unit-Scoped Commands / 完了確認の復旧手順 | このレビューでmise run migration-preflight-unit/browser/verifyおよび記録済み復旧コマンドの独立再実行は未検証。dispatchがbuild/test実行を禁止し、main sessionでの逐次実行を指定しているため実行しなかった。mainのv4ログと固定結果は読取り確認したが、レビュー自身の試験成功や新しい正式checkpoint確認とは区別する必要がある。 | 正式checkpointでは、現在の入力・結果SHAへ固定した実コマンドと未完のCI/U3範囲を提示し、所定の承認後にmain sessionで確認する。今回のlocal成功を統合前CIやU3性能受入へ置き換えない。 | Resolved (reviewer) |
| R-05 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/current-recovery-verification.md > 実行と固定証拠・受入状態とレビュー残件; code-summary.md > 現在コードの完了確認の復旧 | v4の390 current source封印を現ファイルとSHA256照合すると15件が異なる。runtime/guest-validation.ts/js、mise.toml、README.md、installのCI・completion・試験入力等を含む。v4自体の入力SHA 4ea97606…と結果SHA a3a9a207…は保存されているが、その時点の成功は現在sourceの完了確認を証明しない。「現在コード」とする引継ぎは現状と一致せず、短いverifyもassertCurrentIdentityの一致条件を満たさない。直近のU3 local18工程はU1単体/current-completionを含まず、U1の21工程と同一の検証集合でもない。 | v4を実行時点の履歴として保持し、現在sourceからの差分と再利用できる証拠を明記する。現在の正式完了確認には、新source/pack/必須工程に結び付いた証拠と承認済みの検証入口を用意しmainで確認する。U3の承認済みSHA改善を取り消したり、旧証拠のSHA・成功属性を書き換えたりしない。 | Resolved (reviewer) |
| R-06 | Major | scripts/migration-preflight/current-evidence.ts > environmentOf（node: process.version を返却オブジェクトに付与）; scripts/migration-preflight/current-completion.ts > assertCurrentToolchainEvidence | 受入証拠の environment.node は 36 試行の記録から読んだ値ではなく、組立て時に実行中の process.version を書き込んだ値である（acceptance-evidence.json の試行 environment 側には node キーが存在しない）。そのため assertCurrentToolchainEvidence の「evidence.environment.node === process.version」は常に真で何も検査しない。code-summary の「今のNodeで作った証拠だけを受け付ける」は、36 試行については成立しない（試行を古い Node や古い Playwright で作っても通る）。baseline 側は builderHash が Node 版を含むため実質的に束縛されている。 | 36 試行を実行した Node と Playwright の版を試行 record または browserLog から実測値として取り込み、現在の toolchain と一致しなければ拒否する。それまでは code-summary の記述を「baseline は Node 26 に束縛、試行の Node/Playwright は main の実行記録に基づく（コードでは未検査）」に直す。 | Resolved (reviewer) |
| R-07 | Minor | scripts/migration-preflight/current-completion.ts > assertPreflight; current-evidence.ts > readTrials | browserLog は「36 passed」の文字列とテスト要約しか確認されず、log と trials ディレクトリ（36 ファイル）の対応が結び付けられていない。別実行の log と trial JSON を組み合わせても封印・検証を通る。 | log に出る試行識別子または各 trial の実行 ID を trial record と突き合わせる。 | Unresolved |
| R-08 | Minor | scripts/migration-preflight/baseline.ts > readAccepted | 1 MiB 上限は readFile で全量を読んだ後に判定している。巨大な build-info.json でもメモリに載る。 | stat で事前にサイズを確認するか、上限付きで読む。 | Resolved (reviewer) |
| R-09 | Minor | scripts/migration-preflight/current-completion.ts > report の pending 固定文言 | pending に U3 の完了済み項目が残り、読む人に誤解を与える。code-summary は認識済みだが report 自体は直っていない。 | 次回の script 修正で pending を実状態に合わせる。 | Resolved (reviewer) |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-summary.md > 冒頭のStatus行と「現在の結果：v10」節の「受入の境界」項目 | Status行は「U1/U2の現在のsourceの確認（v10）がmainで成功した」と書く。v10はStep 16とU4共有file変更より前のsourceの結果であり、同じ文書の後続段落でそれが明かされるまで、現在のsourceの成功と読める。さらに「受入の境界」項目は、reportのpendingにU3の項目が残るのは古い固定文言で次にscriptを直すときに更新すると書くが、Step 16で既に直っている。v10の trial 記録にはnodeとplaywrightがないため、現行コードのverifyではv10を再検証できない。この点は本文に書かれているので偽りではないが、冒頭では分からない。 | Status行を「v10は修正前sourceの履歴。修正後のsourceでの36試行とv11は未実施」という趣旨に直す。「受入の境界」項目のpendingの記述は、v10のreportが生成時点の固定文言を持ち、現行コードでは直った、と書き改める。 | Resolved (reviewer) |
| R-11 | Minor | tests/migration-preflight/current-evidence.test.ts > 「the browser log must list exactly the 36 passing trials」 | 照合の試験は、欠落・37件目・ブラウザ名違いだけを扱う。PASSED_TRIAL が数える行は ✓ の行だけで、retriesは0設定のため失敗や再試行の行は通常出ないが、✘ の行や「(retry #1)」付きの ✓ の行、ログを二重に連結したものを拒否する試験はない。実装は件数と集合が36件と一致しなければ拒否するので誤って通る道は見当たらないが、その性質が固定されていない。 | ✘ の行を含む log、同じ ✓ の行を2回連結した log、(retry #1) 付きの行を含む log が拒否されることを試験に加える。 | Unresolved |
| R-12 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-generation-plan.md > 「今回の再開（2026-10-17、2回目）」のStep 18(チェック済み)と導入文; code-summary.md > 「U4の変更の引受け：Step 18」 | 計画の導入文とStep 18は`tests/package/public.test.ts`(root exportに`createCommandSession`を加える)を、U1の引き受ける試験fileの一つとして列挙し、Step 18を完了済みにしている。一方code-summaryは、public.test.tsはU2がclaimするfileで、U1のsource-manifestに加えずU2のやり直しで引き受けると書く。source-manifest.jsonにもpublic.test.tsは無い(読取りで確認)。Step 18を字義どおり読むと、U1が確かめて記録したことになる。実際は記録していない。 | 計画のStep 18の括弧書きからpublic.test.tsの項目を外し、「U2のやり直しで引き受ける」と書き直す。導入文の対象file列挙も同様に直す。 | Unresolved |
| R-13 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-summary.md > 「U4の変更の引受け：Step 18」4項目目 | 「差分は件数と名前の一覧だけで、assertの種類・拒否条件・coverage判定は変えていない」という主張の根拠は、`jj diff --from 7c7ceaf4`の実行とだけ書かれ、出力がどこにも保存されていない。このレビューはVCSを実行できず、旧版を持たないため、現在のfileだけから「変わっていない」ことは確認できない。現在のfileの読取りでは、件数(23/33)と名前の一覧(`command`・`command-parse`)の追加は実配布一覧(`FIRST_PARTY_JS`はstage-package.tsに`runtime/command-parse.js`・`runtime/command.js`を持つ)と整合し、assertの種類(deepEqual・throws /denominator/・pct 0・passed false)と閾値の形が緩んでいる箇所は見当たらない。ただし旧版との比較は未検証。 | diffの出力(該当3fileの変更行)を検証記録として保存するか、code-summaryに変更行を引用して、主張を第三者が確かめられるようにする。 | Unresolved |
| R-14 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-summary.md > 「公開用inventoryの更新の引受け：Step 20」4項目目・runner.mjs の記述 | 「差分はinventoryの2行と、manifestのSHA256・sizeだけ」「期待値を実際の配布一覧に合わせただけ」という主張の根拠（旧 runner.mjs との差分出力）が保存されていない。このレビューは VCS を実行できず旧版を持たない。現在の runner.mjs で確認できたのは、`runtime/command-parse.js`・`runtime/command.js` が39〜40行目にだけ現れること（`grep -c` で2件）、`runner-manifest.json` の sha256 234f4ac1…と size 77935 が実ファイルと一致すること、`HISTORICAL_PACKAGE_FILES` が24件の別定数として残り、2171行目の拒否条件で使われていることまで。旧版との差分が2行だけだったかは未検証。 | 旧 runner.mjs と新 runner.mjs の差分（変更行）を検証記録として保存するか、code-summary に変更行を引用する。 | Unresolved |
| R-15 | Minor | ci/migration-install/inputs.bundle.json > 128行目付近（旧 runner の sha256 873738ab…） | 固定入力 bundle が旧 runner の sha を保持している。brief で既知の保留事項。受入れ中の公開 RC・タグ・固定入力を変えない方針とは整合し、これ自体は欠陥ではない。ただし、後続でこの bundle を現在の runner に更新するまで、新 runner と固定入力は一致しない。 | 保留の記録として残す。bundle を更新する工程で新 runner（234f4ac1…）への対応と、RC 固定入力を変えない根拠を明記する。 | Unresolved |
| R-16 | Minor | tests/terrarium/current-candidate.test.ts > test 'current supplier rejects count and duplicate inventories', 87行目 `assert.equal(manifest.files.length, 33)` | 期待値は `PACKAGE_FILES`（33件、scripts/package/stage-package.ts）と一致しており、今回の修正は実在庫に追従しただけである。ただし件数は数値リテラルのままなので、配布一覧が次に増減すると、今回と同じ停止（件数だけの不一致）が再発する。この assertion が守る性質は、直後の `files.slice(1)` が `fixed package inventory differs` で拒否されること、改変が拒否されることであり、件数そのものではない。 | 次にこのfileを触るときに、件数を `PACKAGE_FILES.length` と比べる形か、拒否の試験だけに寄せる形にして、数値の二重管理をやめる。今回の完了を妨げる指摘ではない。 | Unresolved |
| R-17 | Minor | scripts/terrarium/coverage.ts > 33行目のコメント; scripts/release/inventory.ts > 45行目のコメント | 「current twenty-one-file distribution」という古い件数がコメントに残る。実際の現行配布JSは23件（FIRST_PARTY_JS）。機能には影響しない。 | 次に各fileを修正するときに、コメントの件数を23件へ直すか、件数を書かない表現にする。 | Unresolved |
| R-18 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-summary.md > 3行目 Status行 | Status行は「修正後のsourceでの36試行とv11は、まだ実施していない」と書く。しかし同じ文書の冒頭節と計画の5回目の節は、最終sourceで36試行とv11が成功したと記録している。読む人は最初の行から、v11が未実施だと受け取る。v11のreportとinputのSHA256、20工程、coverage 86.42%、36試行のNode/Playwright版は成果物と一致するので、数値の主張自体は誤りではない。 | Status行を、v10は履歴、最終sourceでのv11と36試行は成功済み、署名付きCIとU4 B1は未実施、という内容に直す。 | New |
| R-19 | Minor | tests/migration-command/acceptance.test.ts > 'the shared Playwright runner reader accepts the U4 command suite...' | 新しい試験は期待suiteの一覧の検査だけを確かめる。`command` を含む一覧が一覧検査を通ることは、出力が無い状態で別の理由で拒否されることから間接に確かめている。registryの完全一致（`Playwright suite registry mismatch`）が `command` の追加後も効くことは、この試験では確かめない。実装を読むと、判定は変わっていない（417〜420行目）ので欠陥ではなく、性質が固定されていないだけである。 | `command` ディレクトリが期待されていないのに存在する場合と、期待されているのに無い場合を拒否する試験を、次にこのfileを触るときに加える。 | New |

> R-02 Reviewer note: assets.ts の extractTar の取消分割点は今回の範囲外で未対応のまま。

> R-07 Reviewer note: browserLog と trial record を結ぶ実行固有IDは未対応のまま。今回の範囲外。

> R-11 Reviewer note: 失敗行・二重連結・retry行を拒否する試験は未追加。

> R-12 Reviewer note: 計画70行目に public.test.ts を列挙する記述が残る。

> R-13 Reviewer note: Step 18 の diff 出力は保存されておらず、旧版との比較は未検証。

> R-14 Reviewer note: Step 20 の旧 runner.mjs との差分出力は保存されておらず、未検証。

> R-15 Reviewer note: 固定入力 bundle が旧 runner の sha を保持する既知の保留。欠陥ではない。

> R-16 Reviewer note: tests/terrarium/current-candidate.test.ts 87行目は数値リテラル33のまま。

> R-17 Reviewer note: coverage.ts 33行目と inventory.ts 45行目に「twenty-one-file」のコメントが残る。

### Judgement of the requested checks

- 許可リストの広がり：`allowed` に `command` を1つ加えただけ（coverage.ts 383行目、coverage.js 289行目も同じ）。U4の `COMMAND_RUNNER_SUITES` は package・session・install・command の4件で、その追加分に限られる。空、重複、リスト外の拒否条件（384〜389行目）は変わっていない。
- registryの完全一致：415〜420行目は、ディレクトリの実在suiteと期待suiteを並べ替えて完全一致で比べる。許可リストが広がっても、期待していない suite の混入や欠落は拒否される。launch ledger・begin/end receipt・identity の照合も読取りで変更なし。
- 生成側：307行目の `['package','session','install']` は変えていない。`command` の bootstrap を作るのは U4 の側で、U1 の共有生成は command を作らない。許可リストが広がることで、U1 自身の生成が command を暗黙に受け付けることはない。
- v11の整合：reportのSHA256 387549e6…とinputのSHA256 d0798e28…は記録と一致する。commands は20件で全件 exitCode 0、coverage は 1776/2055 = 86.42%、skip 0、`passed:true`。`currentSourceVerified:true`、`acceptancePassed:false`、`mergeAllowed:false`、pendingは署名付きCIとU4 B1。coverage.ts の更新時刻（18:28）はinput（19:13）とreport（19:32）より前で、順序に矛盾はない。
- 36試行：trialsは36ファイル、ブラウザログは「36 passed」、全試行の environment は node v26.12.0・playwright 1.64.1（3ブラウザ）。
- v10：code-summary は v10 を履歴と明記する（Step 24 の記述、v10 の節）。Status行だけが古い（上の Minor）。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 静的読取り: scripts/package/coverage.ts readPlaywrightNodeRealms / 生成ループ | 実施 | 許可リストの1要素の追加のみ。拒否条件・registry完全一致・生成側は不変。 |
| 静的読取り: v11 report / input / coverage-report / 36 trials | 実施 | SHA256、20工程、86.42%、Node/Playwright版が記録と一致。 |
| ビルド・試験・VCS | 未実行（指定どおり） | main の観測（82 pass、fail・skip 0）は読取りのみ。私が再実行したものではない。署名付きCIとU4 B1は未実施。 |

### Summary

共有の許可リストに `command` を加えた1行は、U4の `COMMAND_RUNNER_SUITES` に限った追加で、空・重複・未知suiteの拒否とregistryの完全一致、U1の生成ループは変わっていない。v11（入力・report のSHA256、20工程、86.42%）と36試行（Node v26.12.0、Playwright 1.64.1）は成果物と一致し、v10は履歴として扱われている。CriticalとMajorはなく、Status行が古いままの記述と、registry完全一致を `command` で固定する試験がない点がMinorとして残る。署名付きCIとU4 B1は未実施で、私はビルド・試験を再実行していない。
