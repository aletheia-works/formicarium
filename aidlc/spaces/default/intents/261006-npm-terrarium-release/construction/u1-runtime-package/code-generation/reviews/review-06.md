## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-08T13:49:42Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | runtime/core.ts > loadPackageCore / createCoreResourceOwner / installVerifiedLoaderURLBridge; runtime/node/api.ts > resource control; runtime/web/api.ts > resource control / childControl | 検証済み（ソース読取り、現 bytes の再照合）：loader/wasm の digest 照合後、所有者が照合済み loader bytes から作成する moduleURL のみを import する。Node の非公開コピー、browser の所有 Blob、限定された pthread bootstrap の結合を維持する。Node は Worker 終了を待って資源を解放し、browser は root と所有 child を終了してから Blob を解放する。候補 v8 の固定 runtime 14 ファイルは現 workspace と installed consumer に一致する。mutation・CSP・pthread・資源回収の実試験結果は main-verification の保存済み観測であり、今回再実行したとの主張ではない。 | 欠陥の解消を維持している。追加修正は不要。全体 guest 回帰、統合前 CI、実 Safari の未検証条件を後続へ保持する。 | Resolved |
| R-02 | Major | runtime/guest-io.ts > runGuest preRun / mkdirParents / mkdirIfMissing; tests/package/consumer.test.ts / consumer.spec.ts > removed nested cwd | 検証済み（ソース読取り）：preRun は mkdirParents の後に cwd 自体を作成し、不足する親を 0755 で順に補う。存在する directory の mode を変更せず、lstat による file/symlink 衝突拒否を維持する。実 consumer の回帰は setCwd→祖先 remove→run と再作成 mode を検査する。main の保存済み Red/Green・rollback・次 run・reset 観測を保持し、当該 runtime bytes は候補 v8 と一致する。 | 欠陥の解消を維持している。追加修正は不要。 | Resolved |
| R-03 | Major | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/code-summary.md > 新attemptの再照合 / 現行リビジョン; aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u1-runtime-package/code-generation/main-verification.md > 現行移行の観測 | 検証済み（今回の読み取り専用 SHA256 照合）：実 tgz の SHA256 は ebe7e5cf6efcd26914e9016ebbd31df1d59812f5cfcfc71b874672c01109dc35。manifest 全 24 ファイルの digest は tarball 内容と installed consumer に一致し、現 workspace の runtime 14 ファイル＋README も一致する。coverage-v11 の固定 14 source digest は同候補の firstPartyJS と一致し、全 14 instrumented bytes の digest も metadata に一致する。report は同候補 SHA、982 行中 863 行、87.88%、threshold 80、1253 realms、passed=true。保存済み試験と今回の bytes 照合は区別され、v7 は履歴に限定されている。 | 候補同一性の解消を維持している。追加修正は不要。旧 pitchfork v2.29.0 または owner v2.30.0 の結果を、要求された最新版 v2.30.1 の native／wasm Node／3 browser 受入れ成功へ置換しない。U4 と統合前 CI の完了は別途確認する。 | Resolved |
| R-04 | Minor | README.md > Contribution and community guidance; tests/package/pack.test.ts > packed README community links resolve to the upstream repository | 検証済み（ソース読取りと tarball digest 照合）：CONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.md は upstream の絶対 URL を参照する。pack 回帰は packed README の各リンクをその正確な URL と照合する。README bytes は現 workspace、候補 v8、installed consumer に一致する。修正前 Red と v8 Node pack/consumer/nested 21 pass は main の保存済み観測である。 | 相対リンクの欠陥の解消を維持している。追加修正は不要。 | Resolved |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensor-required-sections（plan / summary / instructions） | PASS / PASS / PASS、findings_count=0 | 現成果物の必須文書構造を確認した。 |
| sensor-traceability | pass=false、missing_from_upstream_ids=25。gaps / orphans / invalid_entries / invalid_targets は全て空 | 不足 ID は AC4–AC6 の他 Unit 担当範囲。U1 の境界を超えた全体表との差分であり、U1 の未対応・無効 target を示す結果ではない。 |
| 読み取り専用 SHA256 / tar 内容照合 | 全 24 tarball / installed ファイル、runtime 14＋README、coverage source / instrumented 14 ファイルに不一致なし | 保存済み候補と U1 の現 bytes の対応を今回独立に確認した。新たな build / test 実行ではない。 |
| main-verification の保存済み観測 | 現 attempt の runner 3 pass、verify-package exit0。前 attempt の v8 consumer 21 pass、v11 Node 115 pass / browser 123 pass / coverage 87.88% | 主セッションの観測を根拠とする。既存回帰は 31 pass / 1 fail（pitchfork sourceTag 不一致）であり、回帰全体の成功とは扱わない。 |
| linter / type-check | 本 reviewer は再実行なし | 主セッションのみが build / test を実行する規則に従う。保存済み観測と今回の限定的な再照合を混同しない。 |

### Summary

U1 の既存 4 所見は全て Resolved を維持し、今回の stale-receipt recovery 範囲で新たな所見はない。READY は U1 の実装と保存済み証拠の再照合に限定され、最新版 pitchfork v2.30.1 の全実機受入れ、未完了 U4、未実行の統合前 CI、実 Safari、公開の完了を意味しない。
