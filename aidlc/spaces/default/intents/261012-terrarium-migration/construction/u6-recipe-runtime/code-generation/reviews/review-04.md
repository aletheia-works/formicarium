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
| R-03 | Fixed | Minor | 確認：assemble.ts の terminal-compatibility の行（155〜159行）が `host-terminal-unit.log` と `host-terminal-unit.junit.xml` を sources に持ち、log の先頭が SOURCE_COMMIT、`18 pass`・`0 fail`・`exit=0`、junit の試験名が18件であることを照合する（103〜104行）。check-logs/terminal-compatibility@chromium.json の facts.unitTests に18件の試験名があり、code-summary に「ブラウザでの起動・実行・表示」と「単体試験での API 互換」の2つの意味が書かれている。弱さが2つ残る（致命ではない）。log の先頭の1行は手で付けた文字列で、workspace の確認は試験の実行時ではなく assembly の時に行う。単体試験は公開 site の受入と別の環境（bun 1.4.3）で動いた。 |
| R-06 | Fixed | Minor | 確認：acceptance-evidence.json に `deployedIdentity`（deploy-docs run 39233229635、headSha、Pages の deployment 7170705016、作成と成功の時刻、environmentUrl）が入った。assemble.ts は run の headSha が SOURCE_COMMIT であること、deployments が1件で sha が一致し、success の log_url が同じ run を指すことを照合する（212〜218行）。Pages の artifact の id・digest は期限切れで取れず、その旨を値に書いた（計画の「artifact の id・digest」から deployment の id へ変えた理由は code-summary の1001行にある）。W5 がこの deployment に当たったという結び付きは、同じ日の09:00〜11:00の deployment が1件だけ、という時刻からの推論で、pages-*.json 自体は deployment を記録していない（code-summary がそう書いている）。 |
| R-07 | Fixed | Minor | 比較は記録された：B1 の C06（pack `a3370ca4…`、source `2e0358a2`）と pin（pack `29cb0656…`、source `0af7b239`）は違い、`0af7b239` は祖先で、`runtime/`・`types/` の差は 0 file、と code-summary の1007行にある。契約の「一致」は文字どおりには満たさないが、人間が「このままで良いです」と判断し記録された。判断は覆さない。ただし、比較が `assets/`（blink.wasm・blink.mjs・build-info.json）と notices に及んでいるかが書かれていない点と、この受入が機械可読の証拠に入っていない点を、新しい指摘の3件目に分けた。 |
| R-09 | Fixed | Minor | 確認：font-probe.mjs と font-probe-firefox.json（Firefox 157.0、新しい context の初回）で、en・ja とも font face 48件のうち `notLoaded` は空、`loaded` は7件。ja の初回に console error が7件出た（en は0件）。code-summary の1008行は、再読込の後の face が `loaded` か `unloaded` だけであること、原因は「再読込の前に中断された取得と読める（推測）」であることを正しく書いている。font の表示そのもの（描画）を確かめてはいないが、計画の許す形（状態の確認と、原因を推測と明記）で足りる。この2 file の SHA256 はどこにも記録されていない（新しい指摘の4件目）。 |
| R-10 | Fixed | Minor | 確認：.github/workflows/repro-regression.yml の pin mode の staging の次に「Check the formicarium types against the pinned tarball」がある（146〜161行）。pin から版と `tarballSha256` を読み、`npm pack` で取り、`sha256sum --check --strict` で照合してから、`FORMICARIUM_LOCAL_TARBALL` を渡して `formicariumTypes.test.ts` を動かす。`set -euo pipefail` なので、照合が合わなければ型の試験まで進まない。docs/scripts/__tests__/workflows.test.ts の新しい試験が、step の位置（staging の直後）、pin file の参照、`sha256sum --check --strict`、環境変数の受渡し、`timeout-minutes: 5`、secret を使わないことを確かめる。計画の文言「AssetStager が取得した tarball を渡す」とは違い、同じ版を `npm pack` で取り直して同じ SHA256 で照合する方式で、code-summary の992行はそのとおりに書いている。結果として pin と同じ bytes に対する型の照合になるので、目的は満たされる。CI での実際の合格は未確認（merge 後の run の記録が無い。新しい指摘の2件目）。 |
| R-11 | Fixed | Minor | (a) formicarium_terminal.ts の `loadFormicarium` の `url()` が、解決後の URL が `root.href` で始まらなければ `ASSET_LOAD` で拒否する（293〜298行）。root は末尾が `/` の `_formicarium/` なので、別 origin・別 path・`data:`・`blob:`・userinfo 付きの URL は接頭辞に合わない。`..` と空の segment は `relativeEntry` が先に拒否し、`%2e%2e` は URL の正規化の後に接頭辞の検査で落ちる。`public`・`browser` は import の前に検査される。試験は `data:text/javascript,…` を拒否し、import が呼ばれないことを確かめる（実際の保証になっている）。(b) `boot()` の catch が、作られた session を `#session` から外してから dispose する（621〜624行）ので、あとの `dispose()` は session を見ず、2重にならない。試験 `disposes the session when registering the guest fails` は、dispose が1回で、`terminal.dispose()` の後も1回のままであることを確かめる。`repro.ts` の最後の catch は変えていないが、`panes[role].textContent` の代入で端末の要素が外れ、`formicarium_terminal_element.ts` の `disconnectedCallback`（100〜102行）が `dispose()` を呼ぶことを読んで確かめた。code-summary の説明は正しい。(c) `checkSite` が `guests/<role>/accepted.json`（`parts.at(-1)` と `parts.at(-3)`）を `VERIFY_FAILED` で拒否し、新しい試験が許可と拒否の両方を確かめる。pin mode の staging は accepted.json を書かない（`mode === 'local'` のときだけ書く）ので、正規の site は影響を受けない。 |
| R-12 | Fixed | Minor | 確認：stage-formicarium-assets.ts の `fetchAsset` が、行の `source` に `withoutQuery(result.finalUrl)`（origin と path だけ）を書く（515〜518行、536〜541行）。digest は `result.sha256`（本体の bytes から計算）のままで、照合は変わらない。stageFormicariumAssets.test.ts の redirect の試験は、`?sig=…&jwt=…` 付きの最終 URL が query なしで記録され、ELF の行が query なしの URL であることを確かめる。残る点が2つ。(1) 失敗の経路は `${url}: ${message}` を job summary に書き、`message` は fetchLimited（読んでいない）の文面なので、redirect の URL を含むかは未確認。(2) 修正の前に保存した証拠の log（`ci-39233229635-deploy-docs-build.log` など。digest を C10 が引く）は書き換えられず、そこに古い署名付き URL が残りうる。これを共有・公開する前の扱いは、code-summary に書かれていない。短命の URL なので重大ではない（推測）。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「review-01 の指摘の修正」節の「残した Minor」（971〜977行）と、traceability.json の冒頭の `note` | review-03 の新2で直したはずの「古い記述」が、別の場所に残っている。971〜977行は R-03・R-06・R-07・R-09・R-10・R-11・R-12 を「入れていない」「skip のまま」「vivarium の新しい PR が要るので U6 の範囲外」「後の提案にする」と書いたままで、注記が無い（982行の1か所だけ注記がある）。後の人が読むと、今は直っている項目を未対応と読む。traceability.json の `note` も「main dcf959a1、#537–#542・#544」だけで、#557 を含まない（各行の detail には #557 が入っている）。 | 971〜977行のそれぞれに「2026-10-22：Step 20・21 で直した（下の節）」の注記を足す。traceability.json の `note` に #557（merge `e4ef0dc4`）を足す。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「Step 19」の file と SHA256 の表（871〜949行）と「Step 20・21」の節の確認の行（993行） | U6 の file のうち #557 が変えたもの（`formicarium_terminal.ts` とその試験、`stage-formicarium-assets.ts` とその試験、`workflows.test.ts`、`repro-regression.yml`）の表の SHA256 は `dcf959a1` の時点の値のままで、新しい値と注記がない（注記は bump.ts 等の変更の分だけ）。#557 の確認は手元の bun と mise と Playwright 9 passed で、merge 後の CI（`e4ef0dc4` の repro-regression の3ブラウザと coverage の割合、deploy-docs の check-site）の結果は記録に無い。coverage 80% の下限は新しい行が加わった後も保たれるか、CI の型の照合 step が実際に通るかが、CI の run で確かめられていない（検証済みの記録が無い）。C10 の証拠は `dcf959a1` と、その時点で配布された site に対する W5 で、#557 の runtime の変更（data: の拒否、boot の dispose）を含む site では W5 をやり直していない。この関係は記録に書かれていない。 | 表に「#557 で変更。`e4ef0dc4` の SHA256」を足すか、「`dcf959a1` の時点の値」と明記する。`e4ef0dc4` の repro-regression（coverage の割合と、型の照合 step の結果）と deploy-docs の run を記録し、C10 の証拠が `dcf959a1` までを示すことを書く。W5 をやり直すかは U9 に確認する項目として明示する。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の1007行（R-07）と .artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json の `unverified`・assemble.ts の272行 | 人間が受け入れた「B1 の C06 と pack が違う」という事実が、散文の code-summary にだけあり、機械可読の証拠には無い。`unverified` は実機 Safari 1件だけで、`formicariumPackSha256` が B1 の C06 と一致しない理由は証拠に出ない。U9 が契約の「一致」を機械的に照合すると、受け入れた差と区別できず不合格にしうる。また比較は `runtime/`・`types/` の差が 0 file、`package.json` は scripts だけ、と書かれているが、pack に含まれる `assets/`（blink.wasm・blink.mjs・build-info.json）と notices の比較が書かれていない。この受入の実行は公開版 0.3.0 そのもので行われているので、動作の面の懸念は小さい（検証済み：pages-*.json の pack_sha256 は pin と一致）。 | acceptance-evidence に、受け入れた差（B1 の pack と source、pin の pack と source、人間の判断の日付と文言）を追加の field（例 `acceptedDeviations`）で足し、assemble.ts で出す。比較に `assets/`・notices の file ごとの SHA256（pin の `files` と B1 の pack の一覧）を足して結果を書く。 |
| Minor | .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts の outputs の組み立て（84〜96行、203〜207行、225〜226行）と .artifacts/u6-recipe-runtime/acceptance/font-probe-firefox.json | 照合の一部が再現できる形で残っていない。(1) assemble.ts は `coverage-zip/u6-coverage.zip` の SHA256 を artifact の digest と比べるが、zip も展開した `coverage-zip/x/` も sources と outputs に入っていない。artifact は 2026-11-18 に期限が切れる（coverage-artifact.json の expires_at）ので、その後は digest の照合を第三者が再現できない（`.artifacts` の中の zip が残っていれば別）。(2) `font-probe.mjs` と `font-probe-firefox.json`（R-09 の根拠）の SHA256 は、outputs にも code-summary にも無い。(3) 定数 `COVERAGE_ARTIFACT` は同じ script の中の値で、保存した API の応答と比べるので、API の応答の保存そのものが信頼の元である（これは許容できる範囲）。 | zip と展開した4 file（または zip の SHA256）、font-probe の2 file を outputs に入れて SHA256 を記録する。期限の前に zip を保管したことを code-summary に書く。 |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| 実行なし（Bash 禁止） | 試験・hash の再計算・assemble.ts・workflow の実行は行っていない | vivarium の現在の working copy（#557 を含む）の formicarium_terminal.ts、formicarium_terminal_element.ts（60〜115行）、formicarium_terminal.test.ts、stage-formicarium-assets.ts、stageFormicariumAssets.test.ts、workflows.test.ts、repro-regression.yml、repro.ts を読んで照合した。code-summary の「19 pass」「28 pass」「208 pass」「Playwright 9 passed」、SHA256 の値、PR #557 の head と merge `e4ef0dc4` は記録の読取りで、再実行も再計算もしていない（未検証）。`fetchLimited`（tools/fixed-guest-builder/src/http.ts）の失敗の文面は読んでいない。consumes（functional-spec、contract-summary など）は今回読んでいない。 |

**Summary**

前回の Minor 7件（R-03・R-06・R-07・R-09・R-10・R-11・R-12）は、vivarium の #557 の実装と試験、assemble.ts の照合、証拠の file で裏付けられ、すべて Fixed とした。#557 の修正は範囲を絞っていて、`startsWith(root.href)` の拒否、boot の catch の dispose（2重にならない）、check-site の `accepted.json` の判定、query を落とす処理（digest の照合は不変）、CI の型の照合 step（pin の SHA256 を照合してから実行）はどれも意図どおりで、新しい試験は修正の前に fail し後に pass する意味のある確認である。review-03 の新4件は、新1（coverage の headSha）は assemble.ts が run の記録と artifact の記録、zip の digest、分母の SHA256 で commit に結び付ける形で Fixed。新3（404）は log を保存して Fixed。新2（古い記述）は指摘された2か所は直ったが、同じ古さが971〜977行に残る（今回の新1）。新4（`dcf959a1` より後）は bump 側の影響を記録して直ったが、#557 自身の merge 後の記録が無い（今回の新2）。Critical・Major は無く、判定は READY。残るのは記録の整合と再現性に関する Minor 4件。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-generation-plan.md（105〜175行。追加 Step 20〜22 を含む）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md（830〜1010行）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/reviews/review-03.md
- .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts
- .artifacts/u6-recipe-runtime/evidence-c10/acceptance-evidence.json（1〜60行）
- .artifacts/u6-recipe-runtime/evidence-c10/check-logs/coverage-80@host.json
- .artifacts/u6-recipe-runtime/evidence-c10/check-logs/terminal-compatibility@chromium.json
- .artifacts/u6-recipe-runtime/evidence-c10/host-terminal-unit.log
- .artifacts/u6-recipe-runtime/evidence-c10/old-release-404.log
- .artifacts/u6-recipe-runtime/evidence-c10/ci-39233229665/run-view.json
- .artifacts/u6-recipe-runtime/evidence-c10/ci-39233229665/coverage-artifact.json
- .artifacts/u6-recipe-runtime/evidence-c10/pages-deployment.json
- .artifacts/u6-recipe-runtime/evidence-c10/pages-deployment-statuses.json
- .artifacts/u6-recipe-runtime/acceptance/font-probe.mjs
- .artifacts/u6-recipe-runtime/acceptance/font-probe-firefox.json
- /Users/mutoakio/Documents/vivarium/src/layer1_wasm/_shared/formicarium_terminal.ts
- /Users/mutoakio/Documents/vivarium/src/layer1_wasm/_shared/formicarium_terminal_element.ts（60〜115行）
- /Users/mutoakio/Documents/vivarium/src/layer1_wasm/_shared/_test/formicarium_terminal.test.ts
- /Users/mutoakio/Documents/vivarium/src/layer1_wasm/biome-migrate-override-bracket-spacing/repro.ts
- /Users/mutoakio/Documents/vivarium/docs/scripts/stage-formicarium-assets.ts
- /Users/mutoakio/Documents/vivarium/docs/scripts/__tests__/stageFormicariumAssets.test.ts
- /Users/mutoakio/Documents/vivarium/docs/scripts/__tests__/workflows.test.ts
- /Users/mutoakio/Documents/vivarium/.github/workflows/repro-regression.yml

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
