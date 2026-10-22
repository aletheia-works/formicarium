**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 2
**Verdict Dictated:** no

PR #54 による `mode.ts` の変更は fail-closed を保っている。Critical・Major はなく、Minor が残るだけである。

### mode.ts の確認

- `distribute` は eventName が `push` か `workflow_dispatch` のときだけ通る。`pull_request`、`schedule`、`pull_request_target`、`undefined` は `mode-rejected` になる（`mode.ts` 33–34行、`mode.test.ts` の拒否の試験）。
- ref が `refs/heads/main` であること、repository の形、`workflowRef === <repository>/<distributeCaller>@refs/heads/main` の照合は変わっていない。PR・fork・別 branch・別 workflow・fork の repository は引き続き拒否される（`mode.test.ts` 77–90行）。
- 入力 mode が空か `verify` なら常に `verify` で、未知の mode は拒否される。直接のトリガーは `distribute` に届かない。
- `showcase.yml` の `schedule:` は `workflow.test.ts` 52行が引き続き禁じている。
- `reuse.ts` の `REUSE_EVENTS` に `schedule` が残っているが、これは過去の run を再利用元に使えるかを決める読取り側の一覧である。`distribute` の受付には影響せず、変更もない。過去の schedule run の artifact は期限切れで消えるので、リスクはない。

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

> R-06 Reviewer note: `code-summary.md` の「記録との差（未修正）」「候補 artifact の中身は未検証」「`b1-pack.json` は全 field `null`」「`distribute` mode の実行：未検証。B1 の Release がまだなく」は、2026-10-18 時点の記述のまま注記がなく、冒頭の再開節と食い違う。冒頭節が優先と読めるため、リスクは小さい。非ブロッキング。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| main session の観測（brief）：showcase:unit | tests 100 pass 100 fail 0 | 承認済みの範囲で緑。再実行はしていない（読取り専用のため）。 |
| main session の観測：node --test showcase/tests/mode.test.ts | 6/6 pass | 受付・拒否の試験が緑。 |
| main session の観測：showcase:boundary、showcase:typecheck、lint:all | no violation、exit 0、no errors | 境界・型・lint に問題なし。 |
| mode.ts と mode.test.ts の直読み | fail-closed が維持されている | 上記のとおり。 |

### Summary

fail-closed は保たれ、実装と試験は一貫している。U7 の記録（plan の Step 9・11、code-summary、README の未検証項目）が新しい契機と U8 の配布結果に追いついていないだけで、いずれも Minor である。READY。

### Sources

- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-generation-plan.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/traceability.json
- aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/source-manifest.json（grep のみ）
- showcase/scripts/mode.ts
- showcase/tests/mode.test.ts
- showcase/README.md
- showcase/scripts/reuse.ts（grep のみ）
- showcase/tests/workflow.test.ts（grep のみ）
