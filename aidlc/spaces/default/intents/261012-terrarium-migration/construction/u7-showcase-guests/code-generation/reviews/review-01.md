## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-18T09:33:30Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | New |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `mise run showcase-typecheck`、`showcase-unit`、`showcase-boundary`、`lint:all`、`typecheck`、`test:light` | 再実行していない。主セッションが 2026-10-18 に観測した結果を、そのまま頼った（typecheck exit 0、unit 91 pass／0 fail、all-files 行 coverage 87.76%（床 80%）、`boundary: no violation`、lint・typecheck・test:light exit 0） | 指示どおり、ファイルを書き換える恐れのあるコマンドは実行していない。主セッションの観測が前提であり、私は独立に再現していない。 |
| `gh run view 39113037176 -R aletheia-works/formicarium`（読取りのみ） | conclusion `success`、event `push`、headSha `880cfd4ad913fbd10d0c58d73fb158af7c5c2042`、resolve・acquire・catalog・accept・candidate の 5 job が success | code-summary.md の受入の記載（run 番号・commit・5 job success）と一致する。12 行の個別の値と ms は log 全文を読んでいないので、要約の記載に頼っている。 |
| `.github/workflows/showcase.yml` の読取り | 既定 `contents: read`、`actions: read` は acquire・catalog・candidate だけ、全 checkout が `persist-credentials: false`、Action は commit SHA、source build の step に token を渡していない、PR だけ cancel-in-progress、candidate は全 job 成功後に 1 回だけ upload | 計画の Step 10 と NFR8.1 の記載と一致する。 |
| `showcase/scripts/mode.ts` の読取り | `workflow_call` の `inputs.mode` が空なら `verify`。`distribute` は event が `schedule`／`workflow_dispatch`、ref が `refs/heads/main`、`GITHUB_WORKFLOW_REF` が信頼する呼び出し元と完全一致のときだけ | 直接の push・pull_request では `distribute` にならない。NFR8.1 の設計どおり。 |

### Summary

実装は upstream の main に取り込み済みで、計画の 13 step、traceability の全 ID、CI の受入 12 行が互いに矛盾なく対応している。ブロックする欠陥は見つからなかった。残るのは、README の古い「未検証」の記載、候補 artifact の中身が未確認であること、3 file の個別 coverage の低さ、U8 側の caller 名の未確認という Minor だけである。この判断は、主セッションが観測した試験・lint の結果を再現せずに頼った上でのものである。
