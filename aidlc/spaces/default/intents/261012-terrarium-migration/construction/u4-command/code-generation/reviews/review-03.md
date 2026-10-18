## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement と verifyFinalU4 の `equal(ciMeasurement.catalogSha256, local.measurement.catalogSha256)` | U3の検証コマンドは、U1のmirror-inputから再構成した期待catalogと `report.catalogSha256` を照合し、各試行の `raw.input` も期待entryと比較していた。U4の検証コマンドはこの照合を落としている。CIとローカルのcatalog SHAを互いに比べるだけで、どちらも固定資産から独立に固定されていない。`trial.digest` も `raw.input.buildInfo.elfSha256`（同じ生記録の値）と比べるだけである。stdoutのdigestは固定値と比べているが、測ったaube・biomeの実体が、U1で受入れたものかは確かめていない。 | U3と同じく、`docs/results/terrarium-migration-preflight-evidence/mirror-input.json` から期待catalogとそのSHAを再構成して、`report.catalogSha256` と各 `raw.input` を照合する。そのうえでCIとローカルの一致も確かめる。 | Resolved (reviewer) |
| R-02 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyB1 | B1の行をrawログに結び付けるとき、`[chromium] ›` `[firefox] ›` `[webkit] ›` の結果行の確認を再実行していない。組立側（scripts/migration-command/b1.ts の assembleB1）は確認するが、検証コマンドは `source.marker` のある行（hostとnodeの標準出力）しか確認しない。session-browser・install-browser・command-browserの3つのbrowser行は、1つのログのhashに3つのprojectが同じように結び付くだけである。そのため、webkitの結果行を欠くログでも、hashが合えば通る。今回のログに3 projectの行があることは確かめた（ローカルのcommand-8・9・10に各3件以上）が、それは検証コマンドの働きではない。 | 検証コマンドの `verifyB1` で、browserの各行について、そのprojectの `[project] ›` の結果行がログに含まれることを確かめる。欠落した行を拒否する試験を足す。 | Resolved (reviewer) |
| R-03 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement、verifyFinalU4（push／exportの受領記録）、verifyLocal | U3の検証コマンドにあった次の検査がU4にはない。(1) TLSの `issuer`・`subject`・`tlsIssuer`・`tlsSubject`・`tlsProtocol` が `browserSecurityDetails` と一致すること。(2) `hostBefore`・`hostAfter` のbenchmark受領記録。(3) ローカルの証明書trust削除の証拠（`trustRemoved`・`certificateAbsent`・`findCertificate` の終了コード）。(4) export／pushの受領記録（`treeUnchangedBySigning`・ビルド終了コード・source一覧とmanifestの一致）。さらに、U4では次の値が自己参照になっている。`ci.tree` はbindingが自分で作った値と、commit APIを比べるだけで、U3のように `EXPECTED` に固定されていない。ローカルのB1の `sourceCommit` と `preflightEvidenceId` は、検証対象のB1／報告書自身の値を期待値として渡している（`validateB1(b1, { sourceCommit: b1.sourceCommit ... })`）。 | U3より緩めた検査を、U4で落とす理由を記録して承認を得るか、U3と同じ強さに戻す。少なくとも、TLSの3項目とhost benchmark、`ci.tree` の `EXPECTED` への固定、B1の `sourceCommit`（ローカルは `localBase`）と `preflightEvidenceId` を、U1の受入記録の値と照合する。 | Resolved (reviewer) |
| R-04 | Minor | .artifacts/migration-command/verify-final-u4.test.mjs > coverage under 80% / failed B1 row / median over 3000 ms | 拒否の試験が、名前の理由で失敗しているとは限らない。(a) coverageの試験は、`report.lines.pct` と `covered` だけを書き換えて、メッセージを確かめない。検証は先に `equal(report.lines, 再計算した lines)` で失敗するため、80%の判定（`pct >= 80`）には届かない。(b) failed B1の試験は、`assert.rejects` にメッセージの条件がない。(c) medianの試験の正規表現 `/median\|3000\|threshold\|formal/` には `formal` が含まれ、`recomputed formal36 groups` の不一致（groupsを再計算できなかった場合）でも通ってしまう。 | 各試験で、メッセージ（`line coverage 80%`、`check not passed`、`non-download median`）を正規表現で固定する。80%の試験は、再計算が合う生counterを作って、判定そのものに届かせる。 | Resolved (reviewer) |
| R-05 | Minor | README.md > 87行目、docs/command-api.md > 5行目 | 「試験・coverage・B1統合受入・署名付きCIは未検証」という文が、署名付きCI（run 39029827794）まで成功した今の状態と食い違う。「この追加時点で」と日付を限っているが、読者には現状に見える。README.mdは配布packに入るため、直すとsource identityとpackが変わる。 | 直すか、次の公開に向けた変更で一緒に直すと決めて記録する。決めるまでは、未検証の範囲が実機Safariと公開経路だけであることを、code-summary.mdの記述どおりに維持する。 | Unresolved |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-generation-plan.md > Summary と項目5 | 項目5の回帰試験の置き場所が、計画では新しいfile `tests/migration-command/blink-log.test.ts` と書かれたままだが、実際は `tests/migration-command/public.test.ts` にある（code-summary.md が記す変更）。source-manifest.json にも blink-log.test.ts はない。計画の本文と実装の記録が一致しない。 | 計画の項目5の本文を、実際の置き場所（public.test.ts）に合わせて直す。 | Unresolved |
| R-07 | Minor | runtime/command.ts > createCommandSession の execute と tests/migration-command/dispatch.test.ts | 空の入力（`''` など）は、取消済みのsignalが付いていても `empty` で成功する。NFR4.1 の「予約の前にabort済みならABORTED」とBR4.3の「予約を取らない」のどちらを優先するかが、設計で決まっていない。この組み合わせの試験もない。 | 設計の判断を functional-spec か rules に1行で記録して、試験を1件足す。 | Unresolved |
| R-08 | Minor | .artifacts/migration-command/trust-cleanup-final-u4.json と .artifacts/migration-command/verify-final-u4.mjs > verifyTrustCleanup | trust削除の受領記録は、削除をmain sessionが観測したという自由記述（`deleteObserved`）と終了コード0の自己申告で、U3の受領記録のように検証用wrapperが実行して残した記録ではない。検証時の新しいkeychain確認は、その時点・その機械で証明書がないことしか示さない。別の機械で検証すれば、削除していなくても必ず通る。 | 記録が観測の申告であり、wrapper実行の証拠ではないことを code-summary.md か受入記録に1行で書く。次のUnitでは、削除をwrapperで実行して受領記録を作る。 | Unresolved |

> R-05 Reviewer note: README.md と docs/command-api.md の「未検証」の文は直っていない。提供された範囲でsourceに変更はない。未公開のprovisional packなので持ち越しを認めるが、公開前に直すこと。

> R-06 Reviewer note: 再承認で計画が承認済み本文に戻り、項目5と冒頭の要約が `tests/migration-command/blink-log.test.ts` と書いたままになった。実際は `public.test.ts` にあり（298行目と315行目の試験）、blink-log.test.ts は存在せず、source-manifest.json にも載っていない。実際の場所は code-summary.md と作業diaryに記録されており、実装・試験の裏付けは足りている。承認済みの計画を再び変えると承認が無効になるため、計画の修正は求めない。記録の食い違いは Minor のまま残し、READY を妨げない。

> R-07 Reviewer note: 空入力と取消済みsignalの組み合わせの扱いは、設計にも試験にもまだ決まっていない。次にsourceを変えるときに、設計の1行と試験を足すこと。

> R-08 Reviewer note: trust削除の受領記録は観測の申告のままで、wrapper実行の証拠ではない。次のUnitではwrapperで実行して記録を作ること。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 検証コマンドの実行 | 実行していない（この依頼で禁止） | main sessionの報告（試験10件pass）は再確認していない。 |
| verifier SHA256 照合 | 一致（d81827bb9a4e37f8c95d91c305996e6435aa92df9cd82e5a82f40117b4e91050） | `verify-final-u4.mjs` の実ファイルと `final-u4-binding-39029827794.json` の `verifierSha256` が同じ。 |
| `runtime/core.ts` の argv | `['-L', '/dev/null', ...]` を確認 | 項目5の修正が実装に入っている。 |

### Summary

review-02 以降、U4のsource、検証コマンド、binding、記録に変更はなく、検証コマンドのSHAがbindingと一致することを確かめた。Major だった R-01〜R-03 は解消のままで、未解決は Minor の R-05〜R-08 だけである。R-06 は計画の文面が `blink-log.test.ts` に戻ったが、実際の場所 `public.test.ts` は code-summary.md と diary に記録され、試験も実在するため、記録の食い違いとして Minor のまま残し、READY を維持する。
