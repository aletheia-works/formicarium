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
| R-00 | Fixed | Major | 前回の表が読めず指摘が記録されなかった件。今回、成果物を新たに読み直し、review-02 の本文にあった R-13・R-14・R-15 の3件を New findings に1件ずつ記録した。表は読める形で書き直した。 |
| R-01 | Fixed | Major | 確認：`.artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts` が identity 全体の正規化 JSON の SHA256（`identitySha256`）を計算して証拠に載せ、19行それぞれに `check-logs/<check>@<environment>.json` を書く（81〜90行、195〜200行）。読んだ `check-logs/coverage-80@host.json` は identitySha256 `26a04230…3c12`、sourceCommit、元 log の path と SHA256 を持つ。1つでも照合が合わないと exit 1 で何も書かない（190〜193行）。coverage-80 の commit への結び付きの弱さだけが残るので、New の1件目に分けた。SHA256 の再計算は未検証（Bash 禁止）。 |
| R-02 | Fixed | Major | 確認：code-summary の「review-01 の指摘の修正」R-02 に、人間の承認と自分での実行、2026-10-19T10:22:33Z の GET（releases/tags、git/ref/tags、releases/<id>）がすべて 404 だったことが記録されている。traceability.json の BR6.3・NFR8.2 の detail もそれに合わせて直っている。404 の生の出力が file に残らない点は New の3件目。後に merge された formicarium の #58 は U6 の BR6.3 の対象（vivarium の旧題材の Release）に触れないと読める（未検証）。 |
| R-03 | Still applies | Minor | code-summary の「残した Minor」R-03 のとおり、terminal-compatibility のブラウザの行は起動・実行・表示だけを示し、C08 の API 互換は bun の単体試験で確かめたまま。assemble.ts の該当行の sources（PAGES、jobLog、listLog）に bun の試験の log は無い。記録としては正しいが、U9 の照合の前に附属の output を足すとよい。 |
| R-04 | Fixed | Minor | assemble.ts が vivarium の `.git/HEAD` と SOURCE_COMMIT の一致（72行）、baseline・fix の catalog の SHA256 が CI の各 job の log と deploy-docs の log にあること（125〜126行、155〜156行）を照合する形に直っている。commandSha256 と formicariumSourceCommit の log との突き合わせは無いが、Pages の extras が pack・fixture・build key・commit を見ているので主旨は直った。 |
| R-05 | Fixed | Minor | assemble.ts の201〜202行が `acceptance/pages-acceptance.mjs` と `evidence-c10/tools/assemble.ts` を path と SHA256 つきで outputs に入れている。 |
| R-06 | Still applies | Minor | deployedIdentity は入れていない。code-summary に「U6 の identity に定めが無い。U9・契約の所有者に確認する項目」と記録されたままで、記録どおり。 |
| R-07 | Still applies | Minor | formicariumSourceCommit・formicariumPackSha256 と B1 の C06 との比較は、code-summary に「記録していない（未検証）」と明記されたまま。 |
| R-08 | Fixed | Minor | assemble.ts の109〜111行に `workers.mainObserved > 0`、`mainAllIsolated`、`children > 0`、`childrenAllIsolated` が入っている。W5 が spec より強いことも code-summary に書かれている。 |
| R-09 | Still applies | Minor | Firefox の初回の font の読込み失敗は、原因が推測のままと code-summary に記録され、acceptance-evidence の observations に残る扱い。assemble.ts は console error を合否に使わない（112〜117行）。記録どおり。 |
| R-10 | Still applies | Minor | tarball の d.ts に対する型の照合（formicariumTypes）は、CI で FORMICARIUM_LOCAL_TARBALL が無いため skip（NOT MEASURED）のまま（code-summary の Step 18a の節、758行）。合格には数えていない。 |
| R-11 | Still applies | Minor | 実装の防御3点（assets.json の data: URL、起動失敗後の dispose、check-site での `guests/*/accepted.json` の検出）は、vivarium の新しい PR が要るので U6 の範囲外と記録されたまま。vivarium の現在の file は読めないため、#553・#555・#556 で直ったかは未検証。 |
| R-12 | Still applies | Minor | AssetStager の最終 URL の署名付き query は、code-summary の「人間の判断が要ること」2. にある別の提案のまま。証拠の log に同じ URL が残っているので、共有・公開する前に query を見る。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts の coverage-80 の row（172〜178行）と check-logs/coverage-80@host.json の facts.headSha | `headSha` は定数 SOURCE_COMMIT をそのまま入れた値で、元の log から読んだ値ではない。CI の coverage の4 file（bun-lcov.info、u6-coverage-denominator.json、u6-coverage.json、u6-coverage.md）に commit は無い。run 39233229665 の head が `dcf959a1` であることは、code-summary の `gh run list --commit` の確認に頼り、その出力は証拠に残っていない。`sources.coverageArtifact` の id と digest も、取得した file と突き合わせていない。分母の `u6-coverage-denominator.json` の SHA256 `24a82f28…` は、code-summary の表の `src/layer1_wasm/u6-coverage.json`（`dcf959a1` の時点）と一致して見えるので、結び付きが全く無いわけではない。 | 分母の file の SHA256 を vivarium の `src/layer1_wasm/u6-coverage.json` の SHA256 と照合し、`gh run view` の出力（head sha と run id）を元の log として保存して sources に足す。`headSha` は定数でなくその log から読む。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「C10 の AcceptanceEvidence」節（checks の表の coverage-80 の行と「`outputs` は16件」の行） | 表は coverage-80 の log を「CI の `u6-coverage.json`」、`outputs` を「16件」と書いたままで、「review-01 の指摘の修正」の記録（各行に `check-logs/` の記録、`outputs` 37件、SHA256 `3939063d…7dba`）と食い違う。833行の実行結果の行は「作り直した」と注記されているが、この2箇所には注記が無い。後の人が古い方を読むと証拠の形を誤る。 | 表と「16件」を、check-logs の記録と `outputs` 37件に合わせて直すか、「review-01 の前の記述」と注記する。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「review-01 の指摘の修正」R-02 の確認の行 | 旧 Release・tag の 404 の確認（`releases/tags`、`git/ref/tags`、`releases/<id>` の GET）は、時刻と結果の文だけが記録され、応答の生の出力が証拠の file に残っていない。人間の承認と実行も、その session の会話に基づく記述である。Step 17 の文は「1件ずつ承認」を求めるが、2件が個別に承認されたか一括かは記録から分からない。BR6.3 の完了の判断を覆すものではないが、後から辿れない。 | 6つの GET の status と時刻を `.artifacts/u6-recipe-runtime/evidence-c10/` の log として保存して SHA256 を記録する。承認が1件ずつか一括かを code-summary に1文で書く。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md の「Step 19：文書と追跡」の file と SHA256 の表、および code-generation-plan.md の Step 10 と「前提と境界」の merge の記述 | U6 の記録は vivarium の `dcf959a1`（#537・#541・#542・#544）の時点で止まっている。その後に merge された vivarium の #553・#555・#556（bump の PR を自動で merge する設計）は、記録のどこにも出ない。表には U6 が直した `tools/fixed-guest-builder/src/bump.ts`、`cli.ts`、`.github/workflows/fixed-guest-bump.yml` の `dcf959a1` 時点の SHA256 が載っており、#556 の後の main の値と食い違いうる。計画は「merge は書込み権限のある人が行う」（NFR8.2）と書き、traceability の BR1.5・BR1.6 は「bump は commit だけを動かし accepted を消さない」「accepted の置き換えは人の PR」と書く。bump が自動 merge になっても、accepted と pin の変更は人の PR のままか、bump の PR が repro-regression を通ってから merge されるかは、formicarium からは読めず未検証。formicarium の #58（terrarium の削除）、#60（Biome 2.6.2）、#63（CHANGELOG.md の廃止）は、U6 の記録の読取りの範囲では矛盾しない（code-summary の CHANGELOG.md は vivarium のもの、Biome 2.5.15 は当時の最新を記録した歴史の値、terrarium は U6 の対象外で FR16 は U9）。 | code-summary に「`dcf959a1` より後の変更」の節を足し、#553・#555・#556 が U6 の file（bump.ts、cli.ts、fixed-guest-bump.yml、recipe.json の commit）と BR1.5・BR1.6・NFR8.2 の記述に与える影響を、vivarium の file を読んで確かめた結果として書く。確かめられないなら未検証と書き、U6 の file の SHA256 は `dcf959a1` の時点の値だと注記する。accepted と pin の変更が自動 merge の対象外であることを、workflow の条件で確かめて記録する。 |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 実行なし（Bash 禁止） | 試験・hash の再計算・assemble.ts・Playwright は再実行していない | plan、code-summary（1〜324行、660〜983行）、traceability.json、source-manifest.json、unit-test-instructions.md、review-01・review-02、assemble.ts、check-logs/coverage-80@host.json を読んで照合した。code-summary の325〜659行、acceptance-evidence.json、残り18件の check-logs、元の pages-*.json と CI の log は読んでいない。consumes（functional-spec、contract-summary、performance-design、security-design、infrastructure-specification、unit-of-work、requirements）は今回読んでいない（前回までの review で照合済みの範囲に頼る）。vivarium の file と GitHub の状態は読めず、#553・#555・#556 の内容は未検証。 |

### Summary

計画の Step と内容は変わっておらず、前回の Major 2件（R-01 の identity の digest、R-02 の旧 Release の削除の記録）は assemble.ts と check-logs、code-summary の記録で裏付けられたので Fixed とした。R-00 は表を書き直して解消した。Critical・Major は残らず、判定は READY。残るのは Minor で、記録としての弱さ（coverage-80 の commit の結び付き、古い記述、404 の生の出力）と、`dcf959a1` より後の vivarium の変更（#556 の bump の自動 merge など）が U6 の記録に反映されていない点。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/code-summary.md（1〜324行、660〜983行）
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/reviews/review-01.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u6-recipe-runtime/code-generation/reviews/review-02.md
- .artifacts/u6-recipe-runtime/evidence-c10/tools/assemble.ts
- .artifacts/u6-recipe-runtime/evidence-c10/check-logs/coverage-80@host.json

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
