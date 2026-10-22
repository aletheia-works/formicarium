## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-19
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | showcase/README.md > 冒頭（7–8行目）と「未検証のこと」節（129行目）、および README.md の showcase の節 | 両方の文書が「受入・CI は未検証」と書いているが、CI の受入は run 39113037176（`880cfd4a`）で 5 job が success になり、12 行が通っている。code-summary.md もこの差を認めたまま未修正としている。利用者向け文書が実際の検証状態と食い違っている。 | 人間の判断のうえで、CI の受入が通った事実と、実機 Safari・`distribute`・候補 artifact の中身という本当に未検証の部分だけを書く形に直す。 | Unresolved |
| R-02 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Tests written but not executed（候補 artifact の中身） | FR13 の成果物である `showcase-candidate`（`manifest.json`・受入 log・license と notices・build-info）の中身を誰も取得して確かめていない。NFR8.2 の notices と NFR5.2 の U8 での digest 照合は未検証のまま、traceability.json では全行 `OK` になっている。 | traceability.json の NFR5.2・NFR8.2 の行に「U7 側のみ検証済み」と分かる注記を付ける。又は、承認を得て artifact 12131028903 を取得し、`manifest.json` と notices の存在と内容を確かめる。 | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u7-showcase-guests/code-generation/code-summary.md > Test coverage summary（coverage の分母） | 行 coverage の 80% は all files の合算にだけ掛かっている。`accept-node.ts` は 55.67%、`tls.ts` は 55.14%、`candidate.ts` は 76.65% で、これらの経路（job TLS・子 process・CLI 入口）は単体試験で守られていない。CI の受入 job が代わりに通す経路なので、現状は受入で補えているが、受入が壊れたときの局所的な回帰検出が弱い。 | 基準は変えない。この 3 file の未計測経路は CI の受入でだけ守られることを plan か README に明記する。可能なら `candidate.ts` に単体試験を足して 80% 以上にする。 | Unresolved |
| R-04 | Minor | showcase/trusted-callers.json > `distributeCaller`（`.github/workflows/showcase-site.yml`） | 信頼する呼び出し元の workflow file は、まだ存在しない U8 の file 名を固定しているだけである。`mode.ts` は `GITHUB_WORKFLOW_REF` と完全一致で比べているので、現状は安全側（`distribute` は常に拒否）に倒れている。ただし U8 側の実際の file 名が違うと `distribute` が動かない。この一致は計画に「U8 で作る」と書かれているが、契約としては確認されていない。 | U8 の Code Generation で、workflow の実 file 名と `trusted-callers.json` が一致することを機械検査（試験）にする。それまでは未検証と扱う。 | New |

> R-01 Reviewer note: 【確認済み】 受入 12 行（CI run 39113037176、head `880cfd4a`）と pack SHA256 の一致は、ブラウザ Worker が module import を持つ旧 pack についての観測である。現在の pack は `scripts/package/stage-package.ts` の `PACKAGE_FILES` に `runtime/web/package-worker.bundle.js` が加わり、`runtime/web/api.ts` の既定 Worker がこの bundle になっている。したがって pack の SHA256 は別の値になり、旧 SHA256 は現在の source の値ではない。【確認済み】 U7 のブラウザ受入（Chromium・Firefox・WebKit の 9 行、`crossOriginIsolated`・CSP `worker-src 'self' blob:`・same-origin の Worker）を新しい pack で実行した結果は、渡された結果の中にない（main session の実行は U1・U2 の検証コマンドと lint・typecheck・build・test:light で、ブラウザの受入を含まない）。【推測】 `showcase.yml` は `runtime/**` と `package.json` の変更で起動するので、PR #38 または main への push の run が新しい pack の受入になる。bundle は import を持たず同一 origin の `/pkg/runtime/web/` から配られるため、受入が壊れる構造上の理由は見つからなかった。; Required action: code-summary.md に、受入と pack SHA256 は `880cfd4a` の pack に結び付いた記録であり、U2 の第 6 回再オープン（単一ファイルの browser package Worker）後の値ではないと明記する。新しい `showcase.yml` の run（#38 の run または main への push の run）を観測したら、その run id・conclusion・pack SHA256 を追記する。それまで NFR6.1 の「検証済み（4 環境）」は旧 pack の記録として扱う。

> R-02 Reviewer note: 【確認済み】 現在の `package.json` の `showcase:*` は `typecheck`・`stage`・`unit`・`boundary`・`accept-node`・`accept-browser` の 6 個で、`mise-tasks/showcase/` の 6 file および計画 Step 1 の 6 task と一致する。記録の「7 script」は数が合わない。この数の誤りが #38 の変更で生じたかどうかは、渡された file からは判定できない（【推測】 以前からの数え間違いの可能性が高い）。#38 は `showcase:*` の script を変えていない（6 個とも残っている）。; Required action: 「7 script」を「6 script」に直す。

> R-03 Reviewer note: 【確認済み】 12 の変更 file のうち U7 の source-manifest が claim するのは `package.json` だけで、それ以外（`runtime/web/api.ts`、`scripts/emit.ts`、`scripts/package/*`、`scripts/release/inventory.ts`、`scripts/migration-session/coverage.ts`、tests）は claim の外にある。U7 が claim する `showcase/`・`.github/workflows/showcase.yml`・`mise-tasks/showcase/`・`biome.json`・`.gitignore`・`README.md` は今回の変更に含まれない。`package.json` の変更は `files` への bundle の追加が中心で、U7 の `showcase:*` script は無傷である。そのため engine が見ている「source に結び付かない」は、実質 `package.json` の U2 側の編集による fingerprint の差である。記録の「本体の `runtime/`・`types/`・配布物は変えていない」「NFR2.1 本体を変えない」は U7 自身の変更についての記述として今も正しいが、読者には current main の状態の記述に読める。; Required action: code-summary.md の該当文に「U7 の PR #31 の範囲」と範囲を書き添える。`package.json` の `files` や `runtime/web/api.ts` の変更は U2 の記録の範囲であり、U7 の範囲ではないと一行で記す。source-manifest.json の claim の範囲は変えなくてよい。

> R-04 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| shell コマンド（jj・git・node・sha256 など） | 実行していない（指示により禁止） | 検査はすべて file の読取りだけ。coverage 87.76% など main session の結果は再現せず、そのまま引用していない |
| `showcase/tests/workflow.test.ts` の固定内容を静的に照合 | 一致（読取りのみ） | `showcase.yml` の checkout `3d3c42e5`・setup-node `949feb24`・setup-bun `0c5077e5`・upload-artifact `cf430e03` は `ci.yml` の引用符つき `uses:` と同じ SHA。download-artifact `9000827c` も `ci.yml` と同じ。job は resolve・acquire・catalog・accept・candidate の 5 個、checkout は 5 回で `persist-credentials: false` あり。#37 の bump が `showcase.yml` と矛盾する箇所は見つからなかった。U7 の記録は個々の Action の版を書いていないので、記録が偽になる点もない |
| `showcase/scripts/pack.ts` と `stage-package.ts` の連携を静的に追跡 | 問題なし | `packVerify` は `scripts/package/stage-package.js` を実行し、`npm pack` の出力が 1 tarball かだけを確かめる。file 数や inventory を固定した断言はない。`installPack` は root が `package/` で name が `@aletheia-works/formicarium` かだけを確かめ、entry 数 4096・展開 256MiB の上限に対して pack は十分小さい。`stage-package.ts` が新しく import する `./worker-bundle.js` は `emit.ts` が `.build` から `scripts/` へ複写するので、showcase の resolve job の build の後に node から読める |
| `showcase/scripts/accept-server.ts` と `runtime/web/api.ts` の突き合わせ | 構造上の矛盾なし | 既定 Worker の URL は `new URL('./package-worker.bundle.js', import.meta.url)` で、import map の `/pkg/` 以下の `/pkg/runtime/web/package-worker.bundle.js` になり、`contentType` は `.js` を `text/javascript` にする。CSP は `worker-src 'self' blob:`、COOP・COEP・CORP も維持される。実際のブラウザ受入は未観測（R-01） |
| `showcase/scripts/boundary.ts` の走査範囲 | 問題なしと推測 | 【推測】 本体側の走査は `runtime/`・`types/`・`scripts/` の `.js` も読むので、build 後の `runtime/web/package-worker.bundle.js` も対象になる。bundle に `showcase/` を指す文字列があれば逆依存として検出されるが、その可能性は低い。main session の `showcase-unit` は 87.76% で exit 0 だったので、少なくとも試験の中の走査は通っている |

### Summary

今回の変更（U2 の第 6 回再オープン）が U7 の実装を壊す箇所は見つからなかった。U7 が claim する file のうち変わったのは `package.json` だけで、`showcase:*` の script・pack の取り込み・workflow の Action の pin は影響を受けていない。#37 の Action の bump も `showcase.yml` と矛盾しない。ただし、U7 の受入 12 行と pack SHA256 の記録は旧 Worker の pack に結び付いた観測であり、新しい pack のブラウザ受入はまだ観測されていない。記録の範囲の書き添えと「7 script」の訂正で足りるので、Critical・Major はなく READY とする。
