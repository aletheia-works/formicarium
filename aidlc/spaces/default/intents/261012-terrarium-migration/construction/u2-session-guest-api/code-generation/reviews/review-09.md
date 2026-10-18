## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/migration-session/stage.ts > sessionSourceInventory の mise.toml、および scripts/migration-session/completion.ts > checkSessionCandidate | 保持された CI candidate の277 sourceFilesを現在の実ファイルと独立照合すると、mise.tomlだけが不一致だった。記録SHA256は3fc10acbbcdb57e12444253f6bf7aa73bd54a8e85e04be6c63efd8559e9486de、現在はe58e37a8ad8e6c5e1489041f691912a09b1a26160b0bb4e605bc8f55565cace3。checkSessionCandidateはこの差分を拒否するため、run38393506506の成功は現在sourceの最終完了証拠には使えない。過去の成功そのものを否定する指摘ではない。 | 現在の承認済みsourceに結合した新candidate・独立consumer・必要なlocal/CI検証証拠を生成し、同じsourceIdentityとpackを照合してから最終完了に使用する。旧manifestやCI証拠の再ラベル、mise.tomlの検査除外で通さない。 | Resolved (reviewer) |
| R-02 | Major | runtime/guest-validation.ts > fixtureToFsEntries / resolveLinks の visited集合 | 有限なsymlink再利用を循環と誤判定する。dir /real、link /link→/real、link /x→/link/../link/file の3件に対し、mainが現在の公開APIでINVALID_INPUT「fixture symlink loop」を観測した。展開は /x→/link/../link/file→/real/../link/file→/link/file→/real/file と有限で、root脱出もない。mainのmacOS filesystem oracleも対応する相対リンクのrealpathがreal/fileに到達することを確認した。C03/BR2.3は実際のloop/root脱出を拒否する契約であり、既存fixture試験も合法な ../work/b targetを許す。visitedを未解決suffix全体へ持ち越すため、同じlinkを2回使う合法fixtureを拒否する。 | 解決中の循環と有限suffix内の再利用を区別するようsymlink解決を修正する。この合法例の受理を回帰試験に追加し、既存の自己参照・相互参照・parent-component loop・root脱出の拒否を維持してmainで再検証する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/unit-test-instructions.md > 単位内コマンド | レビュー担当自身によるU2 Node/Playwrightの新規実行は未実施。承認済み計画とproject規則がbuild/testをmain session限定・逐次実行としているため、保持されたmain/CIログを確認した。115/43/99/9の計測suite成功とraw coverageは観測証拠があるが、現在sourceでの新規再実行を行ったとは主張しない。U1用の共通状態コマンドもU2検証の代わりには用いていない。 | 上記修正とsource更新を含む現在candidateについて、試験指示のU2単位コマンドと必要な完了検証をmain sessionで逐次実行し、実コマンドと結果を保持する。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/current-recovery-verification.md > 範囲と状態 | レビュアー自身によるU2 Node・ブラウザsuiteと正式verifyの再実行は未検証。ビルド・試験を主担当だけが逐次実行する方針に従ったためであり、今回確認したのは封印済み原ログと現在ファイルの一致である。主担当の今回の短時間verify成功は受領済みだが、記録時点で正式U2 checkpointは未実行。 | 主担当で設定済みverification-command.txtを使う正式U2完了確認を実行し、現在sourceと封印証拠の一致が成功した場合だけ通常の完了処理へ進める。不一致時は既存結果を読み替えず停止する。 | Unresolved |
| R-05 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/code-generation-plan.md > 「検証と停止条件」段落 | Step 12 は v10 を現在の証拠とするが、同じ計画の「検証と停止条件」は現在の証拠を v8入力・v8結果（Node 24.21.0世代）と旧verification-command.txt（command SHA 10098116…）に固定したままである。Step 13 の「intentに記録された検証コマンド」がどちらを指すか読み手が推測する必要があり、旧toolchainの結果を現在の根拠にしない方針と矛盾する。 | Step 13 で使う検証コマンドを v10 のもの（verification-command-u1u2-v10.txt）か旧記録のものか明示する。旧コマンドを使う場合は、v10の入力・reportを検証できること、または使わないことを確認する。計画本文を直す場合は再承認を受ける。 | Unresolved |
| R-06 | Minor | .github/workflows/migration-session-u2.yml > 「Sequential U2 suites and all sixteen distribution files coverage」、scripts/migration-session/completion.ts > report.files.length !== 16 | toolchain更新でこのworkflowのpinは最新化されたが（node 26.12.0、bun 1.4.3、Playwright 1.64.1）、実行内容は旧16JS前提のままである。配布JSは stage-package.ts の FIRST_PARTY_JS で21件になっており、completion.ts が16件を要求するため、このworkflowをこのまま走らせると「U2 current candidate coverage incomplete」で失敗する見込み（私は実行しておらず、コード読取りによる推測）。v10の成功は current-completion 経路によるもので、このworkflowを通したものではない。 | このworkflowを現在のU2の署名付きCI経路として使うなら、16件前提を21件に直し最新toolchainで再実行する。使わないなら、旧16JS経路の履歴であることをworkflow又はU2記録に明記し、v10を根拠にこのworkflowが通ったと扱わない。 | Unresolved |
| R-07 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/code-summary.md > 「2回目の再開」節 | 追加は加算のみという記述は、runtime/public.ts・types/index.d.tsの実ファイルと整合している。public.tsの追加は`export { createCommandSession } from './command.js'`の1行。index.d.tsの追加はC05の型（CommandOptions、CommandResult、CommandSession、createCommandSession）で、既存のErrorCode列挙・Session・RunOptions・validateGuest・fixtureToFsEntries・runValidatedGuest・registerValidatedGuestの宣言は変わっていない。ただし「削除した行はない」「mainのjj diff --stat」という主張の根拠は、reviewerが版管理の差分を実行して確かめたものではなく、現在のファイルの読取りに基づく。なお、reviewerは読取りのみの指示に反してgit diffを1回実行した（出力は空に近く、状態は変えていない）。 | 対応は不要。記録の根拠が「mainの差分観測」であり、reviewerによる差分の独立確認ではないことを、gateで読む人が区別できるようにしておく。 | Resolved (reviewer) |
| R-08 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C02 の `interface SessionPort`（および construction/u2-session-guest-api/functional-design の rules.md / functional-spec.md） | 実装の `SessionPort` には `resolvePath(path: string): string` が入ったが、共有契約C02の interface には5 method（acquire・commitGuest・runInstalled・builtin・release）しかなく、resolvePath の規則（相対はcwdに付ける、空・`..`・NUL・非文字列はINVALID_INPUT、同期で投げる、予約を取らない、状態を変えない）はU2の機能設計にもtraceability.jsonの行にもない。消費側が実際に影響を受けている。U3の模擬portはresolvePathを足さないと型が合わなくなり、`tests/migration-install/lifecycle.test.ts:44` で足されている。契約だけを見て実装する開発者は、このmethodの存在も意味も知り得ない。実装と試験はそのmethodを正しく扱っているが、契約が実体より遅れている。 | C02の interface と本文に resolvePath を、上記の規則と「戻り値はその時点のcwdに基づく値で、予約を持つ間か同じtick内でだけ使う」という使用条件とともに加える（契約の変更として扱う）。U2の機能設計に規則を1つ足し、traceability.jsonに行を追加する。 | Resolved (reviewer) |
| R-09 | Minor | runtime/session-port.ts > `resolvePath` のJSDoc、runtime/lifecycle.ts > `resolvePath` 実装 | 他のport methodは `assertCurrent` で DISPOSED・ABORTED を検査し、`operation` ラッパーでPromiseのrejectにそろえている。resolvePathは検査せず同期で投げる唯一のmethodで、dispose後やreset中（`state.cwd` が `finishReset` まで古い値）にも値を返す。cwdを読むだけで予約の迂回にも状態の変更にもならないので境界の拡大とは判断しない（`state.cwd` を読むだけで、`setCwd` は `fsOperation` の予約を要する）。ただし、この「呼出し側が予約か同じtickで使う」前提は `runtime/command.ts` のコメント（L120–138）にだけあり、port側のJSDocにはない。 | JSDocに、値は呼出し時点のスナップショットであること、dispose/reset/abortの検査をしないこと、同期で投げることを書く。変更するのは文書だけでよい。 | Resolved (reviewer) |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/current-recovery-verification.md > 冒頭の範囲と状態（L5–7）・L48 | 「U2の製品コードは変わっていない」という記述が、3回目の再開でresolvePathが製品コードに入った後も更新されていない。code-summary.md側は区別しているが、この検証記録だけを読む人は「v10は現在のsourceにも妥当」と読み違え得る。v10を変更後の成功証拠として使わない旨は書かれているが、製品コードが変わった事実は書かれていない。 | この記録の冒頭に、3回目の再開で `session-port.ts`・`lifecycle.ts` の製品コードが変わったこと（詳細はcode-summary.md）への1行の参照を足す。 | Resolved (reviewer) |
| R-11 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/code-generation-plan.md > Step 17 のチェックボックス（L64）と Step 19 | Step 17は「独立レビューを受ける。そのあと検証コマンドでU2のcheckpointを確かめる」という文で、レビュー後半のcheckpoint確認は未実施なのに `[x]` になっている。Step 19が同じ文言を繰り返しており、完了済みの項目と未完了の項目が重なって読める。節の説明は「Step 17はこの修正より前の流れとして残す」と述べているが、checkpoint未実施であることは明示していない。 | Step 17の末尾に、レビューのみ完了し、checkpointはStep 19とU4後の最終U1〜U4確認で行うと1行で書く。計画本文を変える場合は再承認を受ける。実質的な欠陥ではないので、gateで読む人が区別できればよい。 | New |

> R-04 Reviewer note: 正式なU2 checkpoint（設定済みの検証コマンドによる完了確認）は未実施のまま。Step 19に移され、U4後の最終U1〜U4確認も明記されている。私は何も再実行していない。

> R-05 Reviewer note: 計画本文の「検証と停止条件」段落は、依然としてv8入力・旧verification-command.txt（command SHA256 10098116…）を現在の証拠として固定している。Step 12はv10を現在の証拠とする。Step 19の「intentに記録された検証コマンド」がどちらを指すか読み手が推測する状態が続く。

> R-06 Reviewer note: .github/workflows/migration-session-u2.yml:44 は「all sixteen distribution files」、scripts/migration-session/completion.ts:251 は `report.files.length !== 16` のまま。配布JSは増えているため、この経路は現在の完了経路としては通らない見込み（コード読取りによる推測。workflowは実行していない）。v10の成功をこのworkflowが通った証拠として扱ってはならない。

> R-08 Reviewer note: contract-summary.md の C02 interface に `resolvePath(path: string): string;` があり、本文に規則が追記された（相対pathはcwdに付けて正規化、空・`..`・NUL・文字列でない値は同期でINVALID_INPUT、予約を取らず状態を変えない、戻り値は呼出し時点のcwdで、dispose・reset・abortは検査せず、予約保持中か同じtickで使う、日付付き）。U2の rules.md に BR2.12、functional-spec.md に WF2.6（付随してFR5の検証記述）、entities.md に制約が加わり、traceability.json に BR2.12 → `runtime/lifecycle.ts` と `tests/migration-session/reservation.test.ts` の行がある。実装（lifecycle.ts L426–434）は規則と一致する。

> R-09 Reviewer note: runtime/session-port.ts の `resolvePath` のJSDocが、スナップショット、予約なし、dispose/reset/abort非検査、同期INVALID_INPUT、使用条件（BR2.12）を述べている。内容はlifecycle.tsの実装およびBR2.12と整合し、command.ts L120–138の使い方（構文は予約前に同期検査、lsは同じtick、fsは予約保持中）とも矛盾しない。

> R-10 Reviewer note: current-recovery-verification.md の冒頭に、3回目の再開で製品コード（session-port.ts・lifecycle.ts）が変わったこと、旧記述がそれより前のものであること、v10を現在sourceの成功証拠としないことが書かれている。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| runtime/lifecycle.ts L426–434 の読取り | `typeof path === 'string' && path !== ''` を `invalid` で検査し、相対は `${state.cwd}/${path}` にして `normalizePath`。state不変、acquireなし、同期 | BR2.12・C02追記と一致。 |
| runtime/session-port.ts のJSDoc | 5点の記述がある（スナップショット、予約なし、非検査、同期throw、使用条件） | R-09の要求を満たす。コメントのみの変更で、生成 `.js` は変わらない（`.js.map` は再生成）という主張と矛盾しない。 |
| runtime/command.ts L120–138（U4の統合点） | 同期の構文検査 → preabort → ls は同tick、fs は予約保持中に `resolvePath` | BR2.12の使用条件どおり。予約の迂回なし。 |
| contract-summary.md C02 / U2 functional-design（rules.md BR2.12、functional-spec.md WF2.6、entities.md）の読取り | 契約とU2設計が同じ規則を述べる。traceability.json の2行も存在 | R-08のうち、契約・設計・対応行は解消。contract-design自体はやり直していない（engineがdriftedと表示、人間の選択）。契約文は日付付き追記で、誰が・なぜ変えたかが読める。 |
| source-manifest.json | session-port・lifecycle・reservation.test は既にclaim済み。追加claimなし | 正しい。 |
| main観測（build exit 0、reservation.test.js 12件pass、fail/skip 0、Node v26.12.0） | 受領したが私は再実行していない（読取り専用） | 検証済みではなく、mainの観測として扱う。 |
| 未検証 | 版管理の差分、build、test、実行時挙動、U3の模擬port、workflowの実行 | 指示により実行していない。 |

### Summary

R-08（契約C02とU2機能設計・対応表への `resolvePath` の追記）、R-09（port側JSDoc）、R-10（検証記録の参照）はいずれも現在のファイルの読取りで解消を確認できました。実装、JSDoc、BR2.12、C02の記述は互いに一致し、command.tsの使い方もその条件に沿っています。未解決はMinorのみ（R-04、R-05、R-06の継続と、Step 17のチェック表記が1件）で、READYを妨げません。ただし正式checkpointとU4後の最終U1〜U4確認は未実施です。
