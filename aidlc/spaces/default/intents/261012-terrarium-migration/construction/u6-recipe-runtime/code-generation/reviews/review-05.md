**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 1
**Verdict Dictated:** no

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/traceability.json の冒頭の `note` と NFR8.2 の detail | review-04 の新1 のうち、追加Step 23 の計画が求めた「traceability.json に #557 を足す」は行（FR10・NFR2.2・NFR8.1）では直ったが、冒頭の `note` は「main dcf959a1、#537–#542・#544」のままで #557（merge `e4ef0dc4`）を含まない。また NFR8.2 の detail は acceptance-evidence.json の SHA256 を `8b757563…225e8a` と書くが、Step 23 で作り直した証拠は `235cd94c9025096bf2859427ba4a0ee189b1d6ba50d6d01e261b88d31e15be21`（code-summary 1030行）で、古い値が残っている。 | `note` に #557（merge `e4ef0dc4`）を足す。NFR8.2 の detail の SHA256 を `235cd94c…` に直すか、「2026-10-22 の中間の値」と明記する。 |
| Minor | .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/（pages-chromium-2026-10-21T2112Z.json、pages-firefox-2026-10-21T2112Z.json、pages-webkit-2026-10-21T2113Z.json、repro-regression-jobs.json、pages-deployment.json）と code-summary.md の「#557 の後」の節（1015〜1016行） | 補足の W5 は3ブラウザとも `passed: true`、4行すべて `reproduced`、`pack_sha256` が pin と一致、Pages の deployment 7237000969（`e4ef0dc4`、20:50:40Z 作成）より後（21:12〜21:14Z）に実行されていて、記録の読取りとして裏付けられる。ただし再確認できる形が足りない。(1) この5 file の SHA256 が code-summary にも acceptance-evidence.json の `outputs` にも無い。(2) 「公開 site の `formicarium_terminal.js`（SHA256 `81072c79…`）に #557 の2つの変更がある」という確認は、保存した log が無く散文だけである。(3) pages-*.json は deployment を記録しないので、W5 がこの deployment に当たったことは時刻からの推論である（Step 20 の R-06 と同じ性質）。(4) deploy-docs の run 39673609916 は success と散文にあるが、その記録は保存されていない（deployment の JSON は run を指さない）。 | 5 file の SHA256 を code-summary の「#557 の後」に書く。terminal js を取得して SHA256 を出した結果を小さな log として保存する。deploy-docs の run の記録（`gh run view` の出力か deployment の statuses）を `evidence-e4ef0dc4/` に足す。 |
| Minor | .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/pages-firefox-2026-10-21T2112Z.json（en の revisit の `consoleErrors`）と code-summary.md の1016行 | 補足の Firefox の記録の console error は、初回の font の読込み失敗（en 5件・ja 7件。既知で、前の観測と同じ種類）に加えて、en の revisit に `A ServiceWorker intercepted the request and encountered an unexpected error`（coi-serviceworker.js の35行）が1件ある。これは C10 本体の observations（font の2件だけ）にも、code-summary の補足の記述（「3つとも passed: true」）にも出ていない新しい種類の出力である。U6 の spec は console error を合否に使わず、この行も `passed: true` なので判定は変わらない。 | 補足の証拠の観測として、この service worker の出力を code-summary に1行で書く（再現するか、どの取得か、は未確認と書く）。 |
| Minor | .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts の `acceptedDifferences`（227〜240行）と .artifacts/u6-recipe-runtime/b1-compare/b1-vs-pin.json | R-07 の訂正（core の wasm・loader・build-info と package.json も違う）は、file ごとの SHA256 の比較で裏付けられ、違う file の集合が変われば assemble.ts が exit 1 になる形で機械可読の証拠に入った。Emscripten の版の違い（6.0.10 と 6.0.12）も b1-vs-pin.json に残る。ただし次の2点が証拠から再現できない。(1) B1 の `packSha256`（`a3370ca4…4046`）と source（`2e0358a2…`）は assemble.ts の中の定数で、b1-vs-pin.json は B1 の tarball の SHA256 を持たず、B1 の tarball 自体も `outputs` に入っていない。(2) `cause` の「blinkCommit・configure・link は同じ」「package.json は repository・private・publishConfig だけが違う」は、b1-vs-pin.json に差分の中身が無く（build-info は emcc と assetDigests だけ、package.json は SHA256 だけ）、散文として書かれている。実機の動作は公開版 0.3.0 そのもので受け入れているので、影響は小さい（検証済み：pages-*.json の `pack_sha256` が pin と一致）。 | b1-vs-pin.json に B1 の tarball の SHA256 を入れ、assemble.ts がそれと定数を照合する。build-info.json と package.json の2 file の比較（key ごとの差分）を b1-vs-pin.json に足すか、`cause` を「読取りの結果（再現手順は…）」と明記する。 |

**前回（review-04）の4件の判断**

- 新1（古い記述）：code-summary の「残した Minor」の節に2026-10-22の注記があり（970行）、R-03〜R-12 を Step 20・21 と #557 で直したと書く。この点は直った。traceability.json の `note` の更新は残る（今回の1件目）。判断：ほぼ Fixed、残りは Minor。
- 新2（#557 の後）：Fixed。6 file の `e4ef0dc4` での SHA256、repro-regression の run 39673609915（repro-regression-jobs.json の読取りで、3ブラウザの job が success、各 job の「Check the formicarium types against the pinned tarball」が success、chromium の「U6 line coverage」が success）、deploy-docs の deployment 7237000969、「C10 の証拠は `dcf959a1` に結び付く」という関係、W5 の補足、が記録された。83.51%・`OK`・`1 pass` の数字は job-chromium.log の本文から読んでおらず、散文の記録の読取りである（未検証）。ただし coverage の step が success であることは、80% 未満で失敗する仕組みと合わせて下限が保たれたことを示す。残る再確認の弱さは今回の2・3件目。
- 新3（R-07 の機械可読化）：Fixed。34 file の比較に assets/（wasm・loader・build-info）と notices・LICENSE を含み、違う4 file が `acceptedDifferences` に出る。弱さは今回の4件目。
- 新4（再現性）：Fixed。`coverage-zip/u6-coverage.zip`（SHA256 が artifact の digest `0275e519…` と一致、acceptance-evidence.json の outputs と assemble.ts の照合）、font-probe の2 file、b1-vs-pin.json が outputs に入った。outputs は50件。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 実行なし（Bash 禁止） | assemble.ts の再実行、hash の再計算、試験、CI の log の再取得は行っていない | 読んだ file の記録と assemble.ts の照合の記述から判断した。acceptance-evidence.json の `outputs` の SHA256、code-summary の SHA256、CI の数字（83.51%、29 passed、`1 pass`）は記録の読取りで、再計算も再実行もしていない（未検証）。job-chromium.log の本文は読んでいない。vivarium と formicarium の code は今回の範囲で変わっていないことを code-summary の記述から確認しただけで、差分は取っていない。 |

### Summary

Step 23 は review-04 の Minor 4件を、記録と証拠の面で実質的に直している。#557 の後の CI と deploy の記録、公開 site での3ブラウザの W5 の再実行（補足の証拠。C10 を置き換えず、`dcf959a1` との関係を明記）、R-07 の訂正（core の wasm も違うと人間が分かったうえで受け入れた判断が `acceptedDifferences` に入り、違う file の集合が変われば assemble.ts が失敗する）、再現性の出力の追加が確認できた。Critical・Major は無く、判定は READY。残るのは traceability.json の `note` と古い SHA256、補足の証拠の再確認のしやすさ、Firefox の service worker の出力の記録、B1 側の定数と散文の裏付けという Minor 4件である。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-generation-plan.md（100〜181行。追加 Step 20〜23 を含む）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md（960〜1031行）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/reviews/review-04.md
- .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts
- .artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json
- .artifacts/u6-recipe-runtime/b1-compare/b1-vs-pin.json
- .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/repro-regression-jobs.json
- .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/pages-deployment.json
- .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/pages-chromium-2026-10-21T2112Z.json
- .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/pages-firefox-2026-10-21T2112Z.json
- .artifacts/u6-recipe-runtime/evidence-e4ef0dc4/pages-webkit-2026-10-21T2113Z.json

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md の「C06/C10受入profileの固定」末尾の段落と、/Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json の checks 19行 | ドキュメント根拠：契約は「各checkのlogにもこのidentityのdigestを記録し、別candidate混用を拒否する」「同じdigestのログを持たない行は不合格」と定める。検証済み（assemble.ts と各 log の読取り）：証拠に identity 全体の digest は無く、各 log が持つ identity は断片だけである。coverage-80 の log（u6-coverage.json）には commit も identity も無い。host の2行の log は sourceCommit の文字列だけ。CI の job log と deploy-docs の log は ELF と build-info の3つの digest を含むだけ（assemble.ts 112–113行、127–128行）。Pages の log（pages-*.json）は fixture・build key・commit・pack を自己申告で持つが、catalog・command・formicariumSourceCommit は持たない。coverage の artifact が run 39233229665 のものであることは、log の中身ではなく取得先の dir 名と `sources` に頼っている。U9 の照合の実装は未検証（code-summary も同じことを書いている）。 | identity 全体の正規化 JSON の SHA256（例 identityDigest）を決めて証拠に載せ、各 check の log（または各 check に付ける附属の log）にその digest を記録して assemble.ts で照合する。契約の読みを変えるなら、その解釈を code-summary に書き、U9・契約の所有者の確認を得る。いずれでも、coverage-80 と host の2行が commit に結び付いていることを log の中身で示す。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/traceability.json の BR6.3・NFR8.2 の行と、code-generation-plan.md の Step 17（チェック済み）、code-summary.md の「Step 17 のうち外部操作の要らない部分」節と「Step 18 のうちローカルの部分」節の「土台」 | 検証済み（記録の読取り）：BR6.3 の行は「旧題材の Release 2件と tag の削除（人が実施、Step 17・18）」で OK、NFR8.2 は「Release の操作は人が承認して行った」で OK としている。しかし code-summary にあるのは削除の対象の一覧と「人間の判断が要ること 2.」（承認待ち）だけで、承認の記録も実行の記録も無い。Step 18 の節は「旧題材の tag 2件の upstream での削除を fetch が示した。BR6.3 の削除は済んだと読める。Release 側は未確認」と書いている。BR6.3 は「承認と実行の記録を残す」を求め、Step 17 の文は「1件ずつ承認」を求める。Step 17 の節自身が「計画の欄はチェックしていない」と書いたまま、計画の Step 17 だけがチェックされている。 | Release の削除を GitHub の GET（releases/tags と git/ref/tags の404）で確かめ、人の承認と実行の事実を code-summary に記録して、BR6.3 と Step 17 の根拠にする。確かめられないなら、BR6.3 と NFR8.2 の detail を「tag は fetch で消えたと読めるが Release は未確認」に直し、Step 17 のチェックを未完了として人の判断に回す。 | New |
| R-03 | Minor | /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts の browser 行（row の呼出し）と acceptance-evidence.json の terminal-compatibility 3行 | 検証済み：recipe-identity・reproduction-comparison・terminal-compatibility・browser-coi の4 check は同じ pages-*.json を log にしている。terminal-compatibility が見ているのは「2端末が ready で、4つの command が transcript に出る」ことだけで、C08 の互換（ReadyDetail・ExitDetail の形、run の逐次化、非0 exit、disconnect の拒否）は、このブラウザの log に出ない。それらは bun の単体試験（formicarium_terminal.test.ts の18件、Linux の bun）で確かめたもので、証拠の log にも outputs にも入っていない。 | terminal-compatibility の行に、bun の試験の log（試験名と pass 数）を附属の output として足す。行の意味を「ブラウザでの起動・実行・表示」と「単体試験での API 互換」に分けて code-summary に書く。 | New |
| R-04 | Minor | evidence-c10/tools/assemble.ts の SOURCE_COMMIT・catalogOf・fixture の読取り、host-contract-schema.log、host-active-reference-cleanup.log | 検証済み：SOURCE_COMMIT は定数で、vivarium の working copy が dcf959a1 であることを assemble.ts は確かめない（working copy の recipe.json・pin・fixture・verdict.ts を読む）。fixture の digest は Pages の実行の extras と一致を見ているので守られているが、commandSha256・catalogSha256・formicariumSourceCommit は同じ守りが無い。catalogSha256 は手元の Release の写しから計算し、deploy-docs の log に出る catalog の SHA256 の行（stage-formicarium-assets.ts の rows）と比べていない。host の2つの log は先頭の行（`vivarium dcf959a1… (working copy empty)`）が手で付けた文字列で、tree との結び付きは自己申告である。 | assemble.ts で `jj`・`git` の読取り相当の確認（working copy の親が SOURCE_COMMIT）を足すか、その時点の tree の file の SHA256 を log に残す。deploy-docs の log の catalog の行の SHA256 が catalogSha256 の元と一致することを照合する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「C10 の AcceptanceEvidence」節、acceptance-evidence.json の outputs | 検証済み：各 check の「log が結果を示す」判定は assemble.ts と pages-acceptance.mjs の中にだけあり、どちらも追跡されず、outputs にも SHA256 が入っていない。U9 や後の人が、どの条件で19行が passed になったかを証拠だけから辿れない。 | assemble.ts と pages-acceptance.mjs を outputs に加える（path と SHA256）か、判定の条件を code-summary に表で写す。 | New |
| R-06 | Minor | acceptance-evidence.json（deployedIdentity なし）、contract-summary.md の C10 と「C06/C10受入profileの固定」 | ドキュメント根拠：契約は deployedIdentity を「実配布が行われた場合は必須」とする。検証済み：W5 は実際に配布された公開 site（Pages、run 39233229635）に対して行われたのに、証拠は deployedIdentity を持たない。code-summary は「U6 の identity には site の inventory の定めが無い」と書いて省いている。この読みは契約の穴を埋める解釈で、U9 が受け入れるかは未検証。 | 省いた理由は記録されているので、U9・契約の所有者に確認する項目として明示する。配布済みの site の識別（例 deploy-docs の run と Pages の artifact の digest）を unknown field で足す案も検討する。 | New |
| R-07 | Minor | acceptance-evidence.json の identity.formicariumSourceCommit・formicariumPackSha256 | ドキュメント根拠：契約は「formicariumSourceCommit/Pack は B1 の C06 と一致」を求める。検証済み：値は pin file（公開した 0.3.0 の tarball）から取り、rules.md の BR5.2 には合う。しかし B1 の C06 の packSha256・sourceCommit との一致は、assemble.ts にも code-summary にも無い。公開版の pack が U4 の受入時の候補と同じ bytes かは、この review では確かめていない（兄弟 unit の file を読まない決まりのため）。 | U4 の C06 の証拠の packSha256・sourceCommit と pin の値を比べた結果を code-summary に記録する。違うなら、その差の説明と U9 への申告を書く。 | New |
| R-08 | Minor | /Users/mutoakio/Documents/formicarium/.artifacts/u6-recipe-runtime/acceptance/pages-acceptance.mjs の summarize（failures）と evidence-c10/tools/assemble.ts の isolation の require | 検証済み：W5 の合否は spec の条件より強い（verdict が reproduced、両 error が null、子 Worker の分離、P2 の印、SW の制御）。spec は verdict の値を assert せず、W5 が verdict と fix の corrected を見る唯一の場所になっている。一方 `workers.mainAllIsolated` は failures にも assemble.ts にも無い（NFR6.8 は Worker の分離を求める）。記録された12行はすべて mainObserved 2・mainAllIsolated true なので結果は変わらないが、観測できた Worker が0でも通る条件である。 | `mainObserved > 0 && mainAllIsolated` を合否と assemble.ts に加える。spec の条件との差（W5 が強い）を code-summary に書く。 | New |
| R-09 | Minor | code-summary.md の「W5：公開 site の受入」の「観測（合否に入れない）」、acceptance-evidence.json の observations | 検証済み：Firefox の初回だけ console に font の読込み失敗（status=2152398850。16進で 0x804B0002 で、NS_BINDING_ABORTED と読める）が en 5件・ja 7件出て、再訪問・Chromium・WebKit は0件。spec は console の error を記録するだけで合否に使わない（spec の読取り）ので、観測として扱う判断は spec と合う。原因（初回の再読込による中断）は推測で、再読込の前後どちらの取得か、再読込の後に font が表示されたかは確かめていない。 | 観測として残す扱いは妥当。font が最終的に表示されることを1回確かめて記録するか、原因を未検証のまま「推測」と明記する（現状どおり）。 | New |
| R-10 | Minor | /Users/mutoakio/Documents/vivarium/docs/scripts/__tests__/formicariumTypes.test.ts、.github/workflows/repro-regression.yml | 検証済み（code-summary と workflow の読取り）：tarball の d.ts に対する型の照合は、環境変数 FORMICARIUM_LOCAL_TARBALL が無いと skip になり、CI の job は設定しない。設計 S2 の型の照合は手元で0.3.0に対して1回通っただけである。pin を上げた PR で API が変わっても、型の食い違いは CI で見つからず、実行時の失敗まで出ない。skip は「NOT MEASURED」と書かれ合格に数えていないので、記録は正しい。 | pin mode の AssetStager が取得した tarball を使って CI でも型の照合を動かす（次の pin の更新の前まで）。 | New |
| R-11 | Minor | /Users/mutoakio/Documents/vivarium/src/layer1_wasm/_shared/formicarium_terminal.ts の relativeEntry・boot、biome-migrate-override-bracket-spacing/repro.ts の catch、docs/scripts/stage-formicarium-assets.ts の checkSite | 検証済み（code の読取り）：(a) relativeEntry は絶対 path・`..`・空の segment を拒否するが、`data:text/javascript,…` のようなスキーム付きの文字列は通り、`new URL(entry, root)` が data: URL になって `import()` される。assets.json は same-origin で AssetStager と check-site が守るため悪用の前提は強いが、same-origin の確認があれば防げる。(b) boot が session 作成の後で失敗（registerValidatedGuest など）すると、session は要素の取外しまで dispose されない。repro.ts の最後の catch も terminal を dispose しない。(c) 公開 site に局所 staging の `guests/<role>/accepted.json`（page が recipe.json に accepted が無いときに読む代わりの経路）が混ざっても check-site は検出しない。 | (a) 解決後の URL の origin が root と同じことを確かめる。(b) 失敗時に session を dispose する。(c) check-site で `guests/*/accepted.json` の存在を失敗にする。いずれも範囲を絞った修正で足りる。 | New |
| R-12 | Minor | code-summary.md の「人間の判断が要ること」2.（Step 18）と、evidence-c10/ci-39233229635-deploy-docs-build.log、AssetStager の job summary の rows | 検証済み（code-summary と stage-formicarium-assets.ts の読取り）：AssetStager は取得の最終 URL を log と job summary に出し、GitHub Release の最終 URL は `sig=`・`jwt=` を含む短命の署名付き URL である。実装者が既に判断を求めている項目（範囲外の提案）。証拠の log に同じ URL が残り、その digest を C10 が引く。公開 Release の短命な URL なので秘密の漏れではないと読める（推測）。 | 人の判断のとおり、query を落として記録するかを決める。決めるまで、証拠の log を共有・公開する前に URL の query を見て判断する。 | New |
| R-00 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-generation-plan.md > review findings table | The reviewer's findings table could not be read, so its rows are not listed here: aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-generation-plan.md: invalid finding ID "ID" | Address the reviewer's findings as written below this table. | Unresolved |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-09 Not re-checked this round

> R-10 Not re-checked this round

> R-11 Not re-checked this round

> R-12 Not re-checked this round

> R-00 Not re-checked this round
