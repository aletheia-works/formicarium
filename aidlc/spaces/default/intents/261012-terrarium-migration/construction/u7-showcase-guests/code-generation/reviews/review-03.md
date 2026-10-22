## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T02:59:51Z
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | Unresolved |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | Unresolved |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | Unresolved |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Status と Test coverage summary | 「U7 の file は 880cfd4a..bbf97ba6 で変更なし」「tests 91 pass、行 coverage 87.76%、`boundary: no violation`」は、U8（PR #43–#45）より前の状態の記録である。その後 `showcase/scripts/boundary.ts`、`showcase/tests/boundary.test.ts`、`.github/workflows/showcase.yml` の paths（`!showcase/site/**` を追加）、`package.json`、`.gitignore`、`biome.json` が変わった。現在の main に対する U7 の試験・boundary・coverage の結果は、この記録からは裏付けられない。本レビューではコマンドを実行していないので、現在の結果は未検証である。 | 現在の main で `mise run showcase-unit`・`showcase-boundary`・`showcase-typecheck` を再実行して数値を更新する。または記録に「U8 取り込み前の結果。現在は未再検証」と明記する。U7 の挙動の破綻は、読んだ範囲では見つからなかった。 | New |

> R-01 Reviewer note: `showcase/README.md` 7–8 行目は「追加した時点では実行していない（未検証）」のまま、129 行目に「未検証のこと」節がある。本体 `README.md` 85 行目も「この追加時点で受入・CI は未検証」のまま。CI 受入は run 39113037176 で通っている（code-summary の記録）。文言は更新されていない。

> R-02 Reviewer note: `traceability.json` の NFR5.2・NFR8.2 の扱いも、候補 artifact の中身を取得していない点も変わっていない。取得は実行できないため未検証のまま。

> R-03 Reviewer note: `accept-node.ts` 55.67%、`tls.ts` 55.14%、`candidate.ts` 76.65% の記録は変わっていない。基準（all files 80%）は緩められていない。この 3 file の未計測経路が CI の受入でだけ守られるという明記は、今も plan と README に見当たらない。

> R-04 Reviewer note: 状況は前進した。`.github/workflows/showcase-site.yml` は実在し、`candidate` job が `uses: ./.github/workflows/showcase.yml` を `mode: distribute` で呼ぶ。`trusted-callers.json` の `distributeCaller` と file 名は一致して見える。ただし、実在する workflow の名前と `trusted-callers.json` の一致を検査する試験は見つからない（`mode.test.ts` などは `trusted-callers.json` 自身を読むだけ）。実行時の一致は未検証。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none run) | 本レビューはコマンド実行を禁じられたため、検証ツールも試験も実行していない | 試験・coverage・boundary の現在の値は未検証。file の読取りだけで判断した。 |

### Summary

Critical と Major の指摘はない。U8 の取り込み後も、U7 の `showcase.yml` は `workflow_call` と `mode` の入口を保ち、`distributeCaller` に当たる U8 の workflow は実在する。R-01〜R-04 の Minor は残っており、新規の Minor が 1 件ある（U8 取り込み後の試験結果が未再検証）。いずれも承認を妨げない。
