## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T11:49:05Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | Resolved (reviewer) |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と Test coverage summary | 「U7 の file は 880cfd4a..bbf97ba6 で変更なし」「tests 91 pass、行 coverage 87.76%、`boundary: no violation`」は、U8（PR #43–#45）より前の状態の記録である。その後 `showcase/scripts/boundary.ts`、`showcase/tests/boundary.test.ts`、`.github/workflows/showcase.yml` の paths（`!showcase/site/**` を追加）、`package.json`、`.gitignore`、`biome.json` が変わった。現在の main に対する U7 の試験・boundary・coverage の結果は、この記録からは裏付けられない。本レビューではコマンドを実行していないので、現在の結果は未検証である。 | 現在の main で `mise run showcase-unit`・`showcase-boundary`・`showcase-typecheck` を再実行して数値を更新する。または記録に「U8 取り込み前の結果。現在は未再検証」と明記する。U7 の挙動の破綻は、読んだ範囲では見つからなかった。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と「Deviations from the plan」の最終項目、「Tests written but not executed」 | 冒頭の再開節は R-01・R-02 を解消済みと書いているが、下の旧記録（「記録との差（未修正）」「候補 artifact の中身は未検証」「`b1-pack.json` は全 field `null`」）がそのまま残り、同じ文書内で現状と食い違う。冒頭節が優先されると明示してあるため読み違いの危険は小さい。 | 旧節に「2026-10-18 時点の記録。現状は冒頭の再開節を参照」と一行足す。ブロックはしない。 | New |

> R-01 Reviewer note: showcase/README.md の冒頭（7–9行目）と「未検証のこと」節、README.md の showcase の節が、CI の受入（12行が通過）を事実として書き、未検証を `distribute` の実行と実機 Safari に絞っている。実際の記録と一致する。

> R-02 Reviewer note: main の候補 artifact（run 39412286499）の読取り結果が traceability.json の NFR5.2・NFR8.2 の `detail` に日付付きで記録され、U8 での digest 照合は U8 の範囲と明記された。写しは `.artifacts/u7-candidate-39412286499/` にある。中身の再取得はしていない（未検証）ので、記録の値は code-summary.md の記述に拠る。

> R-03 Reviewer note: `showcase/tests/candidate.test.ts` に `lastDistributableAt` の試験が追加されている（331行目以降）。`accept-node.ts`・`tls.ts` が CI の受入でだけ守られることは showcase/README.md の「未検証のこと」に明記された。coverage 基準は変えていない。

> R-04 Reviewer note: `showcase/tests/workflow.test.ts` の試験（189行目）が `trusted-callers.json` の `distributeCaller` の実在、`showcase.yml` を `mode: distribute` で呼ぶこと、`reuseWorkflows` への包含を確かめる。`.github/workflows/showcase-site.yml` の66・68行目が実際にそれを呼んでいる。

> R-05 Reviewer note: code-summary.md の冒頭に、現在の main での lint・typecheck・unit 100/100・boundary・test:light の再実行結果が記録され、下の「Status」「Test coverage summary」の 91件・87.76% が U8 取り込み前の値であると明記された。再実行の値は本レビューでは実行していないため未検証。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| なし（指示によりコマンドは実行していない） | 該当なし | テスト・coverage・boundary の現在値は code-summary.md の記録に拠り、本レビューでは未検証。 |

### Summary

R-01〜R-05 は読んだ範囲でいずれも解消している。Step 14 の `b1-pack.json` は実在の Release を指し、新しい試験は実際の workflow ファイルと整合する。残る指摘は旧記録の注記だけで、READY とする。
