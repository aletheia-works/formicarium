**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 1

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|

**New findings**

| ID | Severity | Finding | Fix |
|---|---|---|---|
| N-1 | Minor | 計画の Step 17 は `node-version: 'latest'` とだけ書くが、実装は `check-latest: true` も加えた。code-summary.md には理由が書かれているが、承認済みの計画本文には書かれていない。 | 計画の Step 17 に「`ci.yml` に合わせて `check-latest: true` も足す」と一文足す。変更自体は `ci.yml`（39–42、225–228 行）と同じ形で、固定をやめる目的に必要なので範囲内と判断する。 |
| N-2 | Minor | showcase 配下に Node の版の固定が残るのは `showcase-site.yml`（10か所、U8 の Step で扱う予定）だけ。`integration/vivarium/preflight/` の `build-baseline.sh` と `baseline-workflow.yml`、`tests/fixtures/timings-valid.json` の `26.12.0` は U1 の過去の証拠で、U7 の範囲外。 | U7 では何も変えない。`showcase-site.yml` の修正が同じ PR に入ることを Step 17 の確認事項として残す。 |

変更範囲は、指示された固定の修正と追跡表の1行に収まっている。`showcase.yml` の差分は 10 行追加・5 行削除で、5か所の `node-version: '26.12.0'` が `'latest'` と `check-latest: true` に変わっただけである（`jj diff --stat`、grep で他の `26.12` が showcase.yml に残っていないことを確認した）。Bun の版、試験、基準には手を入れていない。

`showcase/tests/workflow.test.ts` は `actions/setup-node` の ref（40桁の SHA）と版コメントを `ci.yml` と照合するだけで、Node の版は確かめていない。このため試験を変える必要はなく、変えていない。`showcase/package.json` の `engines` の `>=26.12.0` は下限であり、固定ではない。

記録は log と合っている。`lb2/` の log では lint:all が警告48・info 47・エラーなし、showcase-unit が 100 pass・0 fail で行 coverage 88.60%、boundary が `no violation`、typecheck がエラーなしで終わっている。固定の原因を示す run 39716571748 の log にも `node-version: 26.12.0` が記録されている。coverage 基準や timeout を下げた形跡はない。

`traceability.json` の `NFR8.1` は target が `showcase/scripts/mode.ts` だけになり、元の説明は `note` に移っている。`sensor-traceability-3.txt` で U7 の項目は読めない target としては出ていない。全体は U1・U3・U9 の未了で `pass:false` のままだが、U7 の範囲ではないと code-summary.md に正しく書かれている。

実際に main で動かして最新の Node を確かめることと、U8 の `showcase-site.yml` と合わせた PR は、計画で未実施（Step 17 の後半、Step 19）と明記されており、この review の対象外である。

### Sources

- `/Users/mutoakio/Documents/formicarium/.artifacts/ws-biome/.github/workflows/showcase.yml`（39–53、115、175、207、292 行付近）と `ci.yml`（39–42、225–228 行）
- `/Users/mutoakio/Documents/formicarium/.artifacts/ws-biome/showcase/tests/workflow.test.ts`、`showcase/package.json`
- `aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/` の `code-generation-plan.md`（Step 17–19）、`traceability.json`、`code-summary.md`
- `/Users/mutoakio/Documents/formicarium/.artifacts/build-and-test/logs/lb2/u7-*.log`、`logs/showcase-39716571748.log`、`sensor-traceability-3.txt`

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | Resolved (reviewer) |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と Test coverage summary | 「U7 の file は 880cfd4a..bbf97ba6 で変更なし」「tests 91 pass、行 coverage 87.76%、`boundary: no violation`」は、U8（PR #43–#45）より前の状態の記録である。その後 `showcase/scripts/boundary.ts`、`showcase/tests/boundary.test.ts`、`.github/workflows/showcase.yml` の paths（`!showcase/site/**` を追加）、`package.json`、`.gitignore`、`biome.json` が変わった。現在の main に対する U7 の試験・boundary・coverage の結果は、この記録からは裏付けられない。本レビューではコマンドを実行していないので、現在の結果は未検証である。 | 現在の main で `mise run showcase-unit`・`showcase-boundary`・`showcase-typecheck` を再実行して数値を更新する。または記録に「U8 取り込み前の結果。現在は未再検証」と明記する。U7 の挙動の破綻は、読んだ範囲では見つからなかった。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と「Deviations from the plan」の最終項目、「Tests written but not executed」 | 冒頭の再開節は R-01・R-02 を解消済みと書いているが、下の旧記録（「記録との差（未修正）」「候補 artifact の中身は未検証」「`b1-pack.json` は全 field `null`」）がそのまま残り、同じ文書内で現状と食い違う。冒頭節が優先されると明示してあるため読み違いの危険は小さい。 | 旧節に「2026-10-18 時点の記録。現状は冒頭の再開節を参照」と一行足す。ブロックはしない。 | Accepted risk |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md > Step 9（`mode` の受付条件） | Step 9 は今も「mainのU8 workflowからの `schedule`・`workflow_dispatch` だけを受け付ける」と書き、「`push` では拒否」と試験する前提になっている。実装は `push` と `workflow_dispatch` を受け付け、`schedule` を拒否する。Step 11 の「月1回のscheduleの無効化の確認」も、実際の文書は「配布の契機」節になっているので古い。 | Step 9・Step 11 に「2026-10-20 に U8 の承認済みの手順で契機を `push`／`workflow_dispatch` に変更（PR #54）」と注記する。実装済みの Step の本文を書き換えるか、Step 16 を足すかは任意でよい。 | Accepted risk |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > 冒頭の再開節、Traceability の NFR8.1 行 | PR #54 が `showcase/scripts/mode.ts`、`showcase/tests/mode.test.ts`、`showcase/README.md` を変えたことが、U7 の記録のどこにもない。NFR8.1 の根拠は「`mode.test.ts` の 6 試験」のままで、新しい受付イベントと、今回の観測（unit 100/100、mode 6/6、boundary、typecheck、lint、U8 の run 39422079965 の candidate job の success）が載っていない。 | 再開節に「Step 16：U8 の契機変更に伴う `mode.ts` の受付イベントの変更（PR #54、`94970a9e`）」を 1 項目足し、変更した 3 file と上の観測を書く。NFR8.1 の行に「`push`／`workflow_dispatch` のみ、`schedule` 拒否（`mode.test.ts` の拒否の試験）」を足す。`traceability.json` の NFR8.1 に `detail` を足してもよい。 | Accepted risk |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > 「Tests written but not executed」の `distribute` mode の行 | 「`distribute` mode の実行：未検証。U8 の workflow も未作成」とあるが、U8 の run 39422079965（push、main）が `distribute` で `showcase.yml` を呼び、candidate job が成功してから Pages 配布が成功した。`showcase/README.md` の「未検証のこと」は「U8 の最初の配布で確かめる」のままで、この結果が反映されていない。R-06 と同じ種類の古い記述である。 | R-06 の注記を足すとき、この行に「2026-10-20 の U8 の run 39422079965 で実行を確認」と書く。`showcase/README.md` の該当項目も、確認済みの run を書く形に更新する。 | Accepted risk |
| R-00 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md > review findings table | The reviewer's findings table could not be read, so its rows are not listed here: the findings report could not be read: New findings row 1 is a placeholder; leave the table empty when there is nothing new. Write the whole review again with the required Prior findings and New findings tables | Address the reviewer's findings as written below this table. | Accepted risk |
