## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17T00:00:00Z
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
| R-08 | Major | aidlc/spaces/default/intents/261012-terrarium-migration/inception/contract-design/contract-summary.md > C02 の `interface SessionPort`（および construction/u2-session-guest-api/functional-design の rules.md / functional-spec.md） | 実装の `SessionPort` には `resolvePath(path: string): string` が入ったが、共有契約C02の interface には5 method（acquire・commitGuest・runInstalled・builtin・release）しかなく、resolvePath の規則（相対はcwdに付ける、空・`..`・NUL・非文字列はINVALID_INPUT、同期で投げる、予約を取らない、状態を変えない）はU2の機能設計にもtraceability.jsonの行にもない。消費側が実際に影響を受けている。U3の模擬portはresolvePathを足さないと型が合わなくなり、`tests/migration-install/lifecycle.test.ts:44` で足されている。契約だけを見て実装する開発者は、このmethodの存在も意味も知り得ない。実装と試験はそのmethodを正しく扱っているが、契約が実体より遅れている。 | C02の interface と本文に resolvePath を、上記の規則と「戻り値はその時点のcwdに基づく値で、予約を持つ間か同じtick内でだけ使う」という使用条件とともに加える（契約の変更として扱う）。U2の機能設計に規則を1つ足し、traceability.jsonに行を追加する。 | New |
| R-09 | Minor | runtime/session-port.ts > `resolvePath` のJSDoc、runtime/lifecycle.ts > `resolvePath` 実装 | 他のport methodは `assertCurrent` で DISPOSED・ABORTED を検査し、`operation` ラッパーでPromiseのrejectにそろえている。resolvePathは検査せず同期で投げる唯一のmethodで、dispose後やreset中（`state.cwd` が `finishReset` まで古い値）にも値を返す。cwdを読むだけで予約の迂回にも状態の変更にもならないので境界の拡大とは判断しない（`state.cwd` を読むだけで、`setCwd` は `fsOperation` の予約を要する）。ただし、この「呼出し側が予約か同じtickで使う」前提は `runtime/command.ts` のコメント（L120–138）にだけあり、port側のJSDocにはない。 | JSDocに、値は呼出し時点のスナップショットであること、dispose/reset/abortの検査をしないこと、同期で投げることを書く。変更するのは文書だけでよい。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u2-session-guest-api/code-generation/current-recovery-verification.md > 冒頭の範囲と状態（L5–7）・L48 | 「U2の製品コードは変わっていない」という記述が、3回目の再開でresolvePathが製品コードに入った後も更新されていない。code-summary.md側は区別しているが、この検証記録だけを読む人は「v10は現在のsourceにも妥当」と読み違え得る。v10を変更後の成功証拠として使わない旨は書かれているが、製品コードが変わった事実は書かれていない。 | この記録の冒頭に、3回目の再開で `session-port.ts`・`lifecycle.ts` の製品コードが変わったこと（詳細はcode-summary.md）への1行の参照を足す。 | New |

> R-04 Reviewer note: 正式なU2 checkpoint（Step 17の検証コマンド実行）は未実施のまま。Step 17が意図的に未チェックであり、記録もU4後の最終確認を明記している。私は何も再実行していない。

> R-05 Reviewer note: 計画本文の「検証と停止条件」段落がv8入力・旧verification-command.txtを指したままで、今回の再開でも直されていない。Step 13/17の「intentに記録された検証コマンド」がどれを指すか読み手が推測する状態が続く。

> R-06 Reviewer note: scripts/migration-session/completion.ts:251 は `report.files.length !== 16`、.github/workflows/migration-session-u2.yml:44 は「all sixteen distribution files」のまま。配布JSは23件（scripts/package/stage-package.ts の FIRST_PARTY_JS を読んで確認）。コード読取りによる推測で、workflowは実行していない。

> R-07 Reviewer note: 前回は「加算のみ」の記述の根拠が差分の独立確認ではない点の注記だった。今回、code-summary.md が「製品コードが変わった」ことを明示する節を追加しており、Step 14の「製品コードは変わっていない」を過去の記述として区別している。注記の目的は満たされた。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| runtime/lifecycle.ts の読取り（resolvePath、L426–434） | 空文字列・非文字列を `invalid` で拒否し、相対は `${state.cwd}/${path}` にして `normalizePath` を通す。`state` を変更せず、`acquire` も呼ばない | 記述どおり。'a\0b'・'..'・'a/../b'・'/work/..' は normalizePath が拒否する。空文字列だけは cwd を前置すると '/work' になって通ってしまうため、明示の検査が必要で、実装にある。 |
| runtime/validation.ts の読取り（normalizePath） | 絶対path・NUL拒否・`..`拒否・`.`と空成分の除去が残っている | 拒否条件は緩められていない（版管理の差分は取っておらず、現在のファイルの読取りによる）。builtin・Session.readFile等は引き続き絶対pathだけを受け付け、相対pathを受け付けるのは resolvePath だけで、解決後の絶対pathを渡す設計。 |
| package.json の exports / files、types/*.d.ts | exportsは `.`・`./node`・`./browser`・assets 3件。`runtime/session-port.js` は files にあるが exports にない。`SessionPort`・`resolvePath` は types/ にない | SessionPort は package から公開されていない。C02の「npm exportしない」を保つ。 |
| tests/migration-session/reservation.test.ts の読取り | 2件追加。相対・`.`・`//`・絶対・cd/reset後の解決と、'', '..', '../seed', 'a/../b', '/work/..', NUL入り, 数値の拒否、cwd不変、予約保持中に呼べて BUSY を維持すること | 試験は実際に拒否条件を検査しており、常に通る形ではない。エラーコードも `INVALID_INPUT` で固定している。 |
| tests/package/public.test.ts | exportキー一覧に `createCommandSession` を追加（9件、ソート済み）。`Object.keys(shared).sort()` の `deepEqual` | 実際の公開面（runtime/public.ts のU4追加1行）に追従しただけで、判定を緩めていない。 |
| tests/package/pack.test.ts、coverage.test.ts、terrarium/coverage.test.ts | FIRST_PARTY_JS 23件、PACKAGE_FILES 33件（23 + types 3 + assets 3 + LICENSE・NOTICES・README・package.json の10件）。package.jsonのfilesの23件と一致。`command-parse`・`command` の名前が一覧に追加され、「分母を縮めない」「履歴16件の証明を引き継げない」の検査は残っている | 件数は実際の一覧への追従。coverage.test.ts:639 の `31` は別のWorker試験の値で無関係。 |
| runtime/command.ts（U4、明示の統合点） | L122で構文検査、L132で `listEntries(resolvePath(...))` を同じtickで、L138で fs予約の保持中に使う | 想定どおりの使い方。予約の迂回にならない。fs予約中はcwdが変わらず（`finishReset` は予約のdone後）、resetやabortが起きても次の `port.builtin` が `assertCurrent` で ABORTED にする。 |
| source-manifest.json / traceability.json | session-port・lifecycle・reservation.test・tests/package の各ファイルは既にclaim済み。resolvePathの行はない | 追加claimは不要という記述は正しい。ただし新しい規則に対応する行がない点は、New findingsの Major に含めた。 |
| mainの観測（reservation.test.js 12件・public.test.js 6件 pass、fail/skip 0） | 受領したが私は再実行していない（読取り専用） | 検証済みではなく、mainの観測として扱う。U4後の最終U1〜U4確認が残る。 |
| 未検証 | 版管理の差分、build、test、U3のlifecycle.test.tsの中身（grepで `resolvePath()` の存在だけ確認）、実行時挙動 | 指示により実行していない。 |

### Summary

resolvePathはcwdを読むだけの純粋な関数で、予約の迂回、状態変更、normalizePathの拒否条件の緩和、SessionPortのpackage公開はいずれも見当たらず、試験の変更は実際の公開面・配布一覧に追従しただけです。ただし共有契約C02のinterfaceとU2の機能設計がこのmethodを知らず、実際にU3の模擬portが影響を受けているため、契約を実装に合わせて更新する必要があります（Major 1件、READYの範囲内）。Minor 3件の継続（R-04〜R-06）と、port側の文書不足、検証記録の「製品コードは変わっていない」記述の更新漏れが残っています。
