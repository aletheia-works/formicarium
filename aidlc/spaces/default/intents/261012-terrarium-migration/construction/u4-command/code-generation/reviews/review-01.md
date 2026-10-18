## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-17
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement と verifyFinalU4 の `equal(ciMeasurement.catalogSha256, local.measurement.catalogSha256)` | U3の検証コマンドは、U1のmirror-inputから再構成した期待catalogと `report.catalogSha256` を照合し、各試行の `raw.input` も期待entryと比較していた。U4の検証コマンドはこの照合を落としている。CIとローカルのcatalog SHAを互いに比べるだけで、どちらも固定資産から独立に固定されていない。`trial.digest` も `raw.input.buildInfo.elfSha256`（同じ生記録の値）と比べるだけである。stdoutのdigestは固定値と比べているが、測ったaube・biomeの実体が、U1で受入れたものかは確かめていない。 | U3と同じく、`docs/results/terrarium-migration-preflight-evidence/mirror-input.json` から期待catalogとそのSHAを再構成して、`report.catalogSha256` と各 `raw.input` を照合する。そのうえでCIとローカルの一致も確かめる。 | New |
| R-02 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyB1 | B1の行をrawログに結び付けるとき、`[chromium] ›` `[firefox] ›` `[webkit] ›` の結果行の確認を再実行していない。組立側（scripts/migration-command/b1.ts の assembleB1）は確認するが、検証コマンドは `source.marker` のある行（hostとnodeの標準出力）しか確認しない。session-browser・install-browser・command-browserの3つのbrowser行は、1つのログのhashに3つのprojectが同じように結び付くだけである。そのため、webkitの結果行を欠くログでも、hashが合えば通る。今回のログに3 projectの行があることは確かめた（ローカルのcommand-8・9・10に各3件以上）が、それは検証コマンドの働きではない。 | 検証コマンドの `verifyB1` で、browserの各行について、そのprojectの `[project] ›` の結果行がログに含まれることを確かめる。欠落した行を拒否する試験を足す。 | New |
| R-03 | Major | .artifacts/migration-command/verify-final-u4.mjs > verifyMeasurement、verifyFinalU4（push／exportの受領記録）、verifyLocal | U3の検証コマンドにあった次の検査がU4にはない。(1) TLSの `issuer`・`subject`・`tlsIssuer`・`tlsSubject`・`tlsProtocol` が `browserSecurityDetails` と一致すること。(2) `hostBefore`・`hostAfter` のbenchmark受領記録。(3) ローカルの証明書trust削除の証拠（`trustRemoved`・`certificateAbsent`・`findCertificate` の終了コード）。(4) export／pushの受領記録（`treeUnchangedBySigning`・ビルド終了コード・source一覧とmanifestの一致）。さらに、U4では次の値が自己参照になっている。`ci.tree` はbindingが自分で作った値と、commit APIを比べるだけで、U3のように `EXPECTED` に固定されていない。ローカルのB1の `sourceCommit` と `preflightEvidenceId` は、検証対象のB1／報告書自身の値を期待値として渡している（`validateB1(b1, { sourceCommit: b1.sourceCommit ... })`）。 | U3より緩めた検査を、U4で落とす理由を記録して承認を得るか、U3と同じ強さに戻す。少なくとも、TLSの3項目とhost benchmark、`ci.tree` の `EXPECTED` への固定、B1の `sourceCommit`（ローカルは `localBase`）と `preflightEvidenceId` を、U1の受入記録の値と照合する。 | New |
| R-04 | Minor | .artifacts/migration-command/verify-final-u4.test.mjs > coverage under 80% / failed B1 row / median over 3000 ms | 拒否の試験が、名前の理由で失敗しているとは限らない。(a) coverageの試験は、`report.lines.pct` と `covered` だけを書き換えて、メッセージを確かめない。検証は先に `equal(report.lines, 再計算した lines)` で失敗するため、80%の判定（`pct >= 80`）には届かない。(b) failed B1の試験は、`assert.rejects` にメッセージの条件がない。(c) medianの試験の正規表現 `/median\|3000\|threshold\|formal/` には `formal` が含まれ、`recomputed formal36 groups` の不一致（groupsを再計算できなかった場合）でも通ってしまう。 | 各試験で、メッセージ（`line coverage 80%`、`check not passed`、`non-download median`）を正規表現で固定する。80%の試験は、再計算が合う生counterを作って、判定そのものに届かせる。 | New |
| R-05 | Minor | README.md > 87行目、docs/command-api.md > 5行目 | 「試験・coverage・B1統合受入・署名付きCIは未検証」という文が、署名付きCI（run 39029827794）まで成功した今の状態と食い違う。「この追加時点で」と日付を限っているが、読者には現状に見える。README.mdは配布packに入るため、直すとsource identityとpackが変わる。 | 直すか、次の公開に向けた変更で一緒に直すと決めて記録する。決めるまでは、未検証の範囲が実機Safariと公開経路だけであることを、code-summary.mdの記述どおりに維持する。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261012-terrarium-migration/construction/u4-command/code-generation/code-generation-plan.md > Summary と項目5 | 項目5の回帰試験の置き場所が、計画では新しいfile `tests/migration-command/blink-log.test.ts` と書かれたままだが、実際は `tests/migration-command/public.test.ts` にある（code-summary.md が記す変更）。source-manifest.json にも blink-log.test.ts はない。計画の本文と実装の記録が一致しない。 | 計画の項目5の本文を、実際の置き場所（public.test.ts）に合わせて直す。 | New |
| R-07 | Minor | runtime/command.ts > createCommandSession の execute と tests/migration-command/dispatch.test.ts | 空の入力（`''` など）は、取消済みのsignalが付いていても `empty` で成功する。NFR4.1 の「予約の前にabort済みならABORTED」とBR4.3の「予約を取らない」のどちらを優先するかが、設計で決まっていない。この組み合わせの試験もない。 | 設計の判断を functional-spec か rules に1行で記録して、試験を1件足す。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 検証の実行 | 実行していない（この依頼では実行を禁じられているため） | main sessionの観測（ローカルの正式受入22工程、coverage 92.16%、正式36試行、B1 31 check、CI run 39029827794 成功、検証コマンドの試走、試験10件）は報告のまま扱う。これらは私が再確認したものではない。 |
| 読取りによる照合（実行なし） | PASS（一部）。署名付きhead 9722db3e、親 ec8ab359、`verification.verified=true`、`reason=valid`、event=push、jobの全stepがsuccess。ローカルのB1ログにbrowser3 projectの結果行がある。command-14（coverage-prepare）のログは空（SHA e3b0c442…）。 | 承認済みの記録と一致する。command-14は準備工程で、試験出力を求められないため問題にしない。 |
| 品質基準の確認 | 弱めた箇所は見つからない | coverage80%（`pct >= 80`）、非download中央値3000ms、worker 1・retry 0、aube 840000msのtimeoutを保っている。 |

### Summary

U4のコード（runtime/command.ts、runtime/command-parse.ts、公開API、blink.logの `-L /dev/null`）は、BR4.1からBR4.17の規則と判定順に沿っており、品質基準を弱めた箇所は見つからなかった。ただし、最終の読取り専用検証コマンドは、U3の検証コマンドより弱い。測ったcatalogを固定資産から再構成せず、B1のbrowser行の結果行を再確認せず、TLS・host benchmark・trust削除・push受領記録・`ci.tree` の固定などの検査を落としているため、「U3以上に厳しい」という条件を満たさない。この3点がMajorで、閾値（Major 2件まで）を超えるので NOT-READY とする。改変の拒否の試験の一部も、名前の理由で失敗していると証明できていない。実機Safariと公開経路が未検証であることの記録は適切である。
