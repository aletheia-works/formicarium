**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 1
**Verdict Dictated:** no

読取りだけで行った（コマンドは実行していない）。ワークスペースの working copy は formicarium の `5735433d` が元で、#60・#61・#63 の変更を含まない。このため、#58・#60・#63 との整合は、記録の側の欠落として確かめた範囲に限る。実装（`showcase/scripts/mode.ts`、`showcase/scripts/reuse.ts`、`showcase/.github` 側の `showcase.yml`、`showcase/tests/workflow.test.ts`、`showcase/trusted-callers.json`、`showcase/b1-pack.json`、`showcase/README.md`）に、Critical または Major に当たる欠陥は見つからなかった。計画の Step と内容は、2026-10-21 と 10-22 の Request Changes の誤記録の前後で変わっていない（計画の末尾の節と一致）。

**Prior findings**

| ID | Now | Severity | Note |
|---|---|---|---|
| R-00 | Fixed | Major | 前回の指摘の表が読めず記録されなかったことが原因で、成果物の欠陥ではない。今回は成果物を見直し、指摘を 1 件ずつ下の表に書き直した。新しい指摘は Minor だけで、この Major は解消する。 |
| R-06 | Still applies | Minor | `code-summary.md` の「記録との差（未修正）」（114 行目）、「候補 artifact の中身は未検証」（103 行目）、「`b1-pack.json` は全 field `null`」（37 行目）は 2026-10-18 時点の記述のまま注記がなく、冒頭の再開節と食い違う。冒頭節が優先と読めるので危険は小さい。非ブロッキング。 |
| R-07 | Still applies | Minor | `code-generation-plan.md` の Step 9 は今も「mainのU8 workflowからの `schedule`・`workflow_dispatch` だけ」と書き、Step 11 は「月1回のscheduleの無効化の確認」を含む。実装（`mode.ts` 33–34 行、`workflow.test.ts` 52 行）は `push`／`workflow_dispatch` を受け付け `schedule` を拒否する。計画は変更も注記もされていない。非ブロッキング。 |
| R-08 | Still applies | Minor | PR #54（`mode.ts`・`mode.test.ts`・`showcase/README.md`）と PR #57（`showcase/README.md`）の変更が、`code-summary.md` の再開節にも `traceability.json` の NFR8.1 の行（`detail` なし）にもない。NFR8.1 の根拠は「`mode.test.ts` の 6 試験」のまま。非ブロッキング。 |
| R-09 | Still applies | Minor | `code-summary.md` 105 行目の「`distribute` mode の実行：未検証。B1 の Release がまだなく…U8 の workflow も未作成」が残っている。実際は B1 の Release `b1-a3370ca4df1f`、U8 の `showcase-site.yml` ともに存在し、`showcase/README.md` 146–151 行目は run 39422079965 で実行を確認したと書いている。README と code-summary が食い違う。非ブロッキング。 |

**New findings**

| Severity | Location | Finding | Required action |
|---|---|---|---|
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > 「Step 15」R-05 の結果と、code-generation-plan.md > 「upstreamの規約への合わせ」の 3 点目（`showcase/tests/workflow.test.ts` の ci.yml の引用符つき `uses:` の読み方） | U7 の記録は、formicarium の main に入った #58（terrarium の削除）、#60（Biome 2.6.2 への更新と Markdown・YAML の整形。`workflow.test.ts` の ci.yml の `uses:` の引用符の読み方の修正を含む）、#63（CHANGELOG.md の廃止）より前の状態で止まっている。記録している値（`lint:all` の警告 48、`showcase:unit` 100/100・行 88.61%、`test:light` 130/130）は、#60 後の Biome での結果ではない。計画が書く「引用符つきの `uses:` も読む」という `workflow.test.ts` の挙動も、#60 後は書き換わっている。ワークスペースは `5735433d` が元で #60・#63 を含まないため、現在の main での値と U7 の file への影響（`showcase/` の整形差分の範囲を含む）は、この review では確かめられない（未検証）。 | #60 後の main で `lint:all`・`showcase:typecheck`・`showcase:unit`・`showcase:boundary`・`test:light` を 1 つずつ実行し直し、件数と coverage を `code-summary.md` に新しく書く。前の値には「#60 前の結果」と注記する。`workflow.test.ts` の引用符の読み方が変わったことと、#60 が `showcase/` の file に及ぼした整形の範囲を、再開節（R-08 の Step 16 と同じ項目でよい）に 1 行で記録する。 |
| Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md > 「前提と境界」（移管元は現行terrariumの `web/tools.json`、`scripts/latest-guests.mjs`、`mise-tasks/build/native.sh`、`.github/workflows/build-latest-guests.yml`）、code-summary.md > Key implementation decisions | 計画は移管元を「現行terrariumの…（読むだけ）」と書き、`project.md` の Corrections も terrarium の同じ行の修正に触れている。#58 で terrarium が削除されたため、これらの path は現在の main からは読めず、「現行」という表現が実際と合わない。U7 の実装が terrarium の file を実行時に読む箇所は、読んだ範囲（`mode.ts`・`reuse.ts`・`workflow.test.ts`・`showcase/README.md`）にはなかった。`showcase/tools.json` や `scripts/` 内に terrarium への参照が残るかは、grep できず未確認。 | 計画の「移管元」に「#58 で terrarium は削除済み。移管元は履歴（削除前の commit）で参照する」と 1 行足す。`showcase/` 内に terrarium の path・名前への実行時の参照が残らないことを、brief にない手段ではなく main session の検索で確かめて記録する。 |

### 確認した範囲

- `mode.ts` と `trusted-callers.json`（`distributeCaller` が `showcase-site.yml`、`reuseWorkflows` に両方入る）、`workflow.test.ts` の新しい試験（distributeCaller の実在と `mode: distribute`）は、fail-closed を保ち、互いに一致している。
- `showcase.yml` は `schedule:` を持たず、権限・SHA 固定・`persist-credentials: false` は試験の期待と一致している。`reuse.ts` の `REUSE_EVENTS` に `schedule` が残るのは過去の run を再利用元にできるかを決める読取り側の一覧で、受付には影響しない（review-05 の判断と同じ）。
- `b1-pack.json` は `b1-a3370ca4df1f` を指し、`showcase/README.md` の B1 の節・`traceability.json` の NFR5.2・NFR8.2 の注記と整合する。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| ファイルの直読み | 実装と README は互いに整合。記録（code-summary.md・計画）が #54・#57・#58・#60・#63 に追いついていない | R-06〜R-09 は継続、新しい Minor 2 件 |
| 実行したコマンド | なし（読取り専用） | 試験・lint の現在値は未検証 |

### Summary

コードと README に Critical・Major はなく、Major の R-00 は表の読取りの失敗で、今回の書き直しで解消した。U7 の記録が #54・#57・#58・#60・#63 に追いついていない Minor（R-06〜R-09 と新しい 2 件）が残るだけで、ブロックしないので READY とする。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/source-manifest.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/unit-test-instructions.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/reviews/review-05.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/reviews/review-06.md
- showcase/scripts/mode.ts
- showcase/scripts/reuse.ts
- showcase/tests/workflow.test.ts
- showcase/trusted-callers.json
- showcase/b1-pack.json
- showcase/README.md
- .github/workflows/showcase.yml

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | Resolved (reviewer) |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と Test coverage summary | 「U7 の file は 880cfd4a..bbf97ba6 で変更なし」「tests 91 pass、行 coverage 87.76%、`boundary: no violation`」は、U8（PR #43–#45）より前の状態の記録である。その後 `showcase/scripts/boundary.ts`、`showcase/tests/boundary.test.ts`、`.github/workflows/showcase.yml` の paths（`!showcase/site/**` を追加）、`package.json`、`.gitignore`、`biome.json` が変わった。現在の main に対する U7 の試験・boundary・coverage の結果は、この記録からは裏付けられない。本レビューではコマンドを実行していないので、現在の結果は未検証である。 | 現在の main で `mise run showcase-unit`・`showcase-boundary`・`showcase-typecheck` を再実行して数値を更新する。または記録に「U8 取り込み前の結果。現在は未再検証」と明記する。U7 の挙動の破綻は、読んだ範囲では見つからなかった。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と「Deviations from the plan」の最終項目、「Tests written but not executed」 | 冒頭の再開節は R-01・R-02 を解消済みと書いているが、下の旧記録（「記録との差（未修正）」「候補 artifact の中身は未検証」「`b1-pack.json` は全 field `null`」）がそのまま残り、同じ文書内で現状と食い違う。冒頭節が優先されると明示してあるため読み違いの危険は小さい。 | 旧節に「2026-10-18 時点の記録。現状は冒頭の再開節を参照」と一行足す。ブロックはしない。 | Unresolved |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md > Step 9（`mode` の受付条件） | Step 9 は今も「mainのU8 workflowからの `schedule`・`workflow_dispatch` だけを受け付ける」と書き、「`push` では拒否」と試験する前提になっている。実装は `push` と `workflow_dispatch` を受け付け、`schedule` を拒否する。Step 11 の「月1回のscheduleの無効化の確認」も、実際の文書は「配布の契機」節になっているので古い。 | Step 9・Step 11 に「2026-10-20 に U8 の承認済みの手順で契機を `push`／`workflow_dispatch` に変更（PR #54）」と注記する。実装済みの Step の本文を書き換えるか、Step 16 を足すかは任意でよい。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > 冒頭の再開節、Traceability の NFR8.1 行 | PR #54 が `showcase/scripts/mode.ts`、`showcase/tests/mode.test.ts`、`showcase/README.md` を変えたことが、U7 の記録のどこにもない。NFR8.1 の根拠は「`mode.test.ts` の 6 試験」のままで、新しい受付イベントと、今回の観測（unit 100/100、mode 6/6、boundary、typecheck、lint、U8 の run 39422079965 の candidate job の success）が載っていない。 | 再開節に「Step 16：U8 の契機変更に伴う `mode.ts` の受付イベントの変更（PR #54、`94970a9e`）」を 1 項目足し、変更した 3 file と上の観測を書く。NFR8.1 の行に「`push`／`workflow_dispatch` のみ、`schedule` 拒否（`mode.test.ts` の拒否の試験）」を足す。`traceability.json` の NFR8.1 に `detail` を足してもよい。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > 「Tests written but not executed」の `distribute` mode の行 | 「`distribute` mode の実行：未検証。U8 の workflow も未作成」とあるが、U8 の run 39422079965（push、main）が `distribute` で `showcase.yml` を呼び、candidate job が成功してから Pages 配布が成功した。`showcase/README.md` の「未検証のこと」は「U8 の最初の配布で確かめる」のままで、この結果が反映されていない。R-06 と同じ種類の古い記述である。 | R-06 の注記を足すとき、この行に「2026-10-20 の U8 の run 39422079965 で実行を確認」と書く。`showcase/README.md` の該当項目も、確認済みの run を書く形に更新する。 | New |
| R-00 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md > review findings table | The reviewer's findings table could not be read, so its rows are not listed here: the findings report could not be read: New findings row 1 is a placeholder; leave the table empty when there is nothing new. Write the whole review again with the required Prior findings and New findings tables | Address the reviewer's findings as written below this table. | Unresolved |

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-09 Not re-checked this round

> R-00 Not re-checked this round
