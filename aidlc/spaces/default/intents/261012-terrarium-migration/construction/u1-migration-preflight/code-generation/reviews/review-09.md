## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17T03:15:48Z
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
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u1-migration-preflight/code-generation/code-summary.md > 冒頭のStatus行と「現在の結果：v10」節の「受入の境界」項目 | Status行は「U1/U2の現在のsourceの確認（v10）がmainで成功した」と書く。v10はStep 16とU4共有file変更より前のsourceの結果であり、同じ文書の後続段落でそれが明かされるまで、現在のsourceの成功と読める。さらに「受入の境界」項目は、reportのpendingにU3の項目が残るのは古い固定文言で次にscriptを直すときに更新すると書くが、Step 16で既に直っている。v10の trial 記録にはnodeとplaywrightがないため、現行コードのverifyではv10を再検証できない。この点は本文に書かれているので偽りではないが、冒頭では分からない。 | Status行を「v10は修正前sourceの履歴。修正後のsourceでの36試行とv11は未実施」という趣旨に直す。「受入の境界」項目のpendingの記述は、v10のreportが生成時点の固定文言を持ち、現行コードでは直った、と書き改める。 | New |
| R-11 | Minor | tests/migration-preflight/current-evidence.test.ts > 「the browser log must list exactly the 36 passing trials」 | 照合の試験は、欠落・37件目・ブラウザ名違いだけを扱う。PASSED_TRIAL が数える行は ✓ の行だけで、retriesは0設定のため失敗や再試行の行は通常出ないが、✘ の行や「(retry #1)」付きの ✓ の行、ログを二重に連結したものを拒否する試験はない。実装は件数と集合が36件と一致しなければ拒否するので誤って通る道は見当たらないが、その性質が固定されていない。 | ✘ の行を含む log、同じ ✓ の行を2回連結した log、(retry #1) 付きの行を含む log が拒否されることを試験に加える。 | New |

> R-02 Reviewer note: assets.ts extractTar の取消分割点は今回も未対応。code-summaryも未解消と明記しており記録は正直。

> R-06 Reviewer note: consumer.spec.ts が各trial記録のenvironmentに node(process.version) と playwright(導入版)を書く。current-evidence.ts は組立て時にnodeを上書きしない。environmentOf が全36試行で同値かつ非空を要求し、assertCurrentToolchain が現process.versionと導入済み@playwright/testの版との一致を要求する。current-completionのassertCurrentToolchainEvidenceは、これにより初めて意味のある検査になった。

> R-07 Reviewer note: browser logは tool・browser・trial番号の36件とtrial fileを1対1で照合するようになり、重複・欠落・別ブラウザ名の混入は拒否される。しかしlogにも試行記録にも実行IDや時刻のような実行固有の識別子がない。同じ名前の組を持つ別実行のlogとtrial JSONは通る。この点は残る。照合の試験は、失敗行や retry の行を含まない。

> R-08 Reviewer note: readAccepted が readFile の前に stat でサイズを確認し、上限超過なら読まずに拒否する。読んだ後の判定も安全側に残っている。

> R-09 Reviewer note: CURRENT_PENDING は現在のsourceの署名付きCIとmerge、U4のB1統合受入だけで、試験がU3の語を含まないことを確認している。code-summaryの古い記述は新しい指摘として別に挙げる。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 静的読取り: current-evidence.ts / consumer.spec.ts / baseline.ts readAccepted / current-completion.ts CURRENT_PENDING | 実施 | R-06・R-08・R-09 の修正を確認。Playwrightのlist reporterの実ログ（mirror-browser-node26-20261017b.log）の行形式が PASSED_TRIAL の正規表現と一致し、✓ 行は36件。 |
| step16-green-20261017.log | 実施 | current＋evidence＋baseline 40/40、fail・skip 0。新しい試験名に R-06・R-07 が含まれる。私が再実行したものではない。 |
| scripts/terrarium/coverage.ts strip mode | 静的確認 | stripTypeScriptTypes に mode:'strip' を使う。対象のsourceにenum・parameter property・namespaceは見つからず、strip で変換が欠けて壊れる構文は検出されなかった。tests/terrarium/coverage.test.js 16/16 は main の記録（terrarium-coverage-strip-20261017.log）による。 |
| ビルド・試験・VCS | 未実行（main-only 指定） | 結果は main の記録に基づく。 |

### Summary

Step 16のR-06（試行のNode/Playwright版を実測値として束縛）、R-08、R-09はコードと試験で修正されており、延期した36試行とv11の説明も本文では正直である。Criticalなし、Majorなし。ただし冒頭のStatus行などにはv10を現在のsourceの結果と読ませる表現が残るので直したい。
