## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-09T11:45:59Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/guest-distribution/coverage.ts > prepareCoverage、mergeMeasurements、reportCoverage、selfTest | 検証済み：前回確認した使用済みdirectory拒否、generation/sourceIdentity/candidateSha256の全receipt結合、source/instrumented source/候補digest再照合は維持されている。今回の差分はstage.tsとstage.test.tsに限定される。mainはcollector self-test exit0と新規coverage-repair-v3のNode41件・3browser15件・20receiptを観測し、report exit0、固定3配布JS249/254行=98.03%を確認した。generationは976e4419-c417-45ce-a819-46a1ab6c148c、sourceIdentityは7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54、candidateSha256はcecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7。以前の結果を新しい測定へ再ラベルしていない。 | 本指摘に追加修正は不要。U4では固定17配布JSと統合前CIを候補へ結合する既定条件を維持する。 | Resolved (reviewer) |
| R-02 | Major | scripts/guest-distribution/stage.ts > validateRetainedのselected／existingRoot／schemaVersion判定順; tests/guest-distribution/stage.test.ts > legacy-only retained asset requires root even without retained C3 refs | 検証済み（ソース照合とmainのRed/Green）：保持refのexistingRoot必須検査をschemaVersion判定より前へ移し、legacyだけを保持する入力にも適用した。新回帰は保持C3 refを含めず、legacy.old.wasm metadataと新aube buildだけを使い、root省略の拒否と出力未生成を確認する。次に実legacy bytesを持つrootを指定し、metadataと候補内bytesの一致を確認する。mainは修正前Missing expected rejection（producer10pass/2fail）→修正後同じcommand12pass/0failを観測。旧assetの通常コピー、保持C3資産のdigest/provenance・root/path/symlink検査、old/new refのHTTP回帰を保持し、legacyを新schemaへ強制移行していない。前回のroot省略残件は解消した。 | 本指摘に追加修正は不要。既存rootを渡す供給手順と保持refの回帰を維持する。 | Resolved (reviewer) |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensor-required-sections（plan / summary / instructions） | 全て PASS、findings_count=0 | 承認済み計画と現在の引渡し文書の構造を確認した。 |
| sensor-traceability | pass=false、他 Unit の AC4.1 / AC4.2 / AC5 / AC6 計25件が missing_from_upstream_ids。gaps / orphans / invalid_entries / invalid_targets は空 | U2 の担当 AC4.3.1–3 / FR6 と実在 target の不備を示す結果ではない。全 Unit の共有要件との差分を U2 の欠陥として扱わない。 |
| 独立読み取り専用 SHA256 / bytes 比較 | 配布3JSの source digest、計測3JSの instrumented digest、候補11fileの size / SHA、stage / coverage の TS / JS 計4fileに不一致なし | 最終 v3 証拠と現在の製品・producer の対応を今回確認した。新 build / test / 再計測ではない。 |
| v3 report の全20receipt照合 | generation / sourceIdentity / candidateSha256 に不一致なし。固定3JS、249/254行、98.03%、skip0、passed=true | generation 976e4419-c417-45ce-a819-46a1ab6c148c、sourceIdentity 7453f02908538a6726f5527deaeb805a45fa1e4d7cf6ff4e89abf7ccb1f6de54、候補 cecdee3b22326cfad71641616d0031e1f39d121a12160fb55fba53048869f9d7 に結合された保存済み結果。 |
| 現 source inspection — stageDistribution / validateRetained | legacy-only の保持 ref も schemaVersion 判定前に existingRoot 必須。保持 root の通常資産をコピーし、symlink / 特殊fileを拒否、C3保持資産の digest / ELF / provenance / fixtureを検査 | metadata だけを残して資産を欠落させる以前の経路は現実装に残っていない。root省略拒否と legacy bytes 保持、old / new ref の HTTP 解決回帰を維持する。 |
| 現 source inspection — prepareCoverage / mergeMeasurements / reportCoverage | 新規測定directoryを排他作成。全receiptの世代 / source / candidate、現候補全資産、現source / instrumented bytes / statement-mapを照合 | 古い receipt の再採用を拒否し、固定3ファイル・zero map・全予定 Node / browser case / realm・80%を保持する。 |
| main-verification の保存済み観測 | legacy-only Red10pass/2fail→Green12pass。全Node41pass、fresh v3 Node41pass / 3browser15pass、1worker / retry0。正式build / consumer型 / Biome / collector self-test はexit0 | 実行は主セッションの過去観測であり、reviewer の今回実行ではない。初回 helper 欠落、旧 v2、sandbox browser 起動失敗は履歴として区別される。 |
| docs / code-summary の版・所有境界 | U2候補はaube2.6.1 / 2.7.0、pitchfork2.30.0。現U1の2.30.1 / Safari5caseとは別の供給候補と明記 | 資産取得成功を最新版 guest の実行受入れへ転用していない。旧 catalogue の defaults は明示的なローカル検証用再構成であり、完全復元・実配信と主張しない。 |

### Summary

現在の U2 実装・候補と最終 v3 証拠は一致し、この限定的な advisory review で新たな所見はない。供給資産の取得・検証と guest の実行受入れを分け、公開契約の境界と保持資産の可用性を確認した。

U2 のローカル pitchfork2.30.0 候補、U1 の最新版2.30.1検証、後続 U3 / U4 の責任を区別する。実配信、公開 RC、remote CI、全体配布 JS の統合判定は別途未検証であり、このレビューは Unit 承認や公開許可を付与しない。
