**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 2

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| N-1 | resolved | Minor | マージ後の `showcase.yml` は 5 か所の setup-node（resolve・acquire・catalog・accept・candidate）すべてが `node-version: 'latest'` と `check-latest: true`。code-summary の Step 17 の節が `check-latest` の理由を書いている。計画の Step 17 の文は `'latest'` だけだが、マージ済みの file と summary が一致しているので閉じる。 |
| N-2 | resolved | Minor | `showcase-site.yml` の 12 か所の `26.12.0` も同じ PR #66 で直った。run 39724950133 の setup-node 15 か所はすべて `node-version: latest`。U7 外の workflow は読んでいない。U3・U4 の固定は Loop-back 1 で別に扱われている。 |

**New findings**

| ID | Severity | Finding | Fix |
|---|---|---|---|
| N-3 | Minor | code-summary の「Step 17・18」の節が、マージ・マージ後の run・Step 19 を「未実施」と書き、`.artifacts/ws-biome` を「まだ commit していない」と書いたまま。PR #66（merge `f7b70cac`）と 2 つの run は `test-results.md` に記録済み。 | 次に記録を更新するとき、その節に 1 行足す：PR #66 を merge、Showcase guests run 39724950076 と Showcase site run 39724950133 が success、setup-node はすべて Node v26.12.1。ほかは書き換えない。 |

計画の Step 17–19、code-summary の Step 17・18 の節、`traceability.json` の NFR8.1、マージ済みの `showcase.yml` を読み直した。

- Step 17 の意図（5 か所を `'latest'` に、U8 と 1 つの PR、Bun・試験・基準は変えない）は、マージ済みの `showcase.yml` と合っている。Bun の `'1.4.3'` は残っている。`workflow.test.ts` は Node の版を確かめていない。
- Step 18 / NFR8.1：`target` は `showcase/scripts/mode.ts` だけで、以前の説明は `note` に移っており、ほかの行は変わっていない。`test-results.md` は読めない target が 0 件と記録している。
- Showcase guests run 39724950076：setup-node 5 か所すべてが `node-version: latest`・`Resolved as '26.12.1'`・`node: v26.12.1`。log に `##[error]` も 0 以外の exit code も無い。
- Showcase site run 39724950133：setup-node 15 か所すべてが `latest`・`Resolved as '26.12.1'`・`node: v26.12.1`。こちらも `##[error]` と 0 以外の exit code は無い。
- site の log は、依頼文の `showcase-site-39724950133.log` ではなく `.artifacts/build-and-test/logs/showcase-39724950133.log` にあった。

Critical・Major の指摘は無いので READY とする。

### Sources

- `/Users/mutoakio/Documents/formicarium/.artifacts/ws-biome/.github/workflows/showcase.yml`
- `/Users/mutoakio/Documents/formicarium/aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md`（Step 17–19）
- `/Users/mutoakio/Documents/formicarium/aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md`
- `/Users/mutoakio/Documents/formicarium/aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/traceability.json`
- `/Users/mutoakio/Documents/formicarium/aidlc/spaces/default/intents/261012-terrarium-migration/construction/build-and-test/test-results.md`
- `/Users/mutoakio/Documents/formicarium/.artifacts/build-and-test/logs/showcase-39724950076.log`
- `/Users/mutoakio/Documents/formicarium/.artifacts/build-and-test/logs/showcase-39724950133.log`

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
