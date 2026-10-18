## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-09T23:17:14Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/terrarium/coverage.ts > executionVerifierSource / sealCoverage / nodePreloadSource / collectNodeMeasurement / reportCoverage; scripts/coverage-types.ts > Measurement.executionIdentity; tests/terrarium/coverage.test.ts > measured-copy / final bundle tampering / stale execution receipts | 検証済み（現ソース読取り、保存済み main Red/Green、新証拠の読み取り専用 digest 照合）：bundle 生成後の seal は site、terrarium、node-preload、verifier の実行 bytes と必要集合を generation/sourceIdentity/candidateSha256 に結合する。排他的 wx により再 seal を拒否する。Node は起動前・preload 開始・終了・receipt 保存前、browser は beforeAll・各 afterEach、report は集計前後に実コピーを再照合し、Node/browser receipt の executionIdentity を検査する。元 source/site を維持した instrumented module の同長変更、最終 bundle の同長変更、成功 report 後の測定 copy 変更、欠落・追加・kind・escaping link・旧 receipt を拒否する回帰がある。main は当初 3 件の Missing expected rejection を観測後、coverage 14 pass と release 22 pass を記録した。新 .artifacts/u4-coverage-v1 の seal 1722 行に記録された file bytes/kind/link と現実体に不一致はなく、seal identity を独立再計算すると 10e02129943632e9993cc5a721e7f5cb7a3273c73cff1c1efb28f32e2b78c59f となり report と一致する。新 report の全 46 fresh receipts も同じ 4 identity に一致する。旧 U3 の 80.56% を改変の証拠とは扱わず、新測定を別 generation の証拠として確認した。 | 指摘した測定 copy／最終 bundle の結合欠落は解消した。U3 の追加修正は不要。後続 U4 でも seal 後の変更を拒否し、候補・固定 24 ファイル・80%・realm 条件を維持する。 | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/code-generation-plan.md > Exact Scope and Evidence Boundaries: v14 import failure fallback | v14の同一性確認が失敗した場合、計画は新しいU1測定先を `.artifacts/u1-coverage-u3-current-v1` としている。しかし `scripts/terrarium/coverage.ts` の `componentImport` は原reportの親directory名を `/^u1-coverage-v[0-9]+$/` に限定しているため、その指定先の `coverage-report.json` は測定内容が正しくても拒否される。今回のv14 importは実際に成功しており、現候補のcoverage証拠には影響しない。 | 将来の再測定手順で、既存の原report検査が受け付ける未使用 `u1-coverage-v<番号>` directoryを指定するよう計画・テスト手順を揃える。tarball/source/map/realmの一致検査は維持する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261006-npm-terrarium-release/construction/u3-terrarium-integration/code-generation/traceability.json > coverage entries FR5.1, FR5.2, FR5.3, FR7.2 target | この4件のOK targetは全て要件対応表requirement-mapping.mdを指し、対応する実装・試験ファイルを直接識別しない。対応表には具体的な実装・名前付きoracleと保存証拠があるため、動作の未検証を隠す問題ではないが、コードへの直接対応が他のOK ACと揃っていない。 | 4件のtargetを各条件を担う既存の実装または試験ファイルへ変更し、対応表と候補別証拠の参照はreason等の補助情報として保持する。 | New |

> R-02 Reviewer note: 現在の承認済みStep16と試験指示は未使用整数の `.artifacts/u1-coverage-v<整数>` を指定しており、componentImportの親basename検査と一致する。過去の不適合出力先は履歴として区別され、同pack/source/maps/realm/閾値検査を維持している。代替collectorの実測は未検証と明記されている。

> R-02 Earlier decision: Accepted risk

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| レビュー独立照合：Python read-only SHA-256/size check | PASS: main-reconciliation.jsonの115原参照、SHA/size不一致0 | 保存照合結果と現在の参照bytesが一致。製品・原証拠への書込みなし。 |
| main read-only reconcile.mjsの保存結果と実装確認 | PASS: 固定24、46receipt、1450/1801行80.51%、skip0、candidate/execution identity、owner12参照とaudit保存受入れ一致 | ファイル別counter照合とimmutable U1v14 importを保持。新coverage測定や旧ownerによる新候補承認とは扱っていない。 |
| main-tests.jsonとcoverage.test.ts照合 | PASS: main実行16成功、失敗0、skip0 | 固定分母・旧世代拒否・欠落realm・same-pack/source/map否定試験を確認。reviewerはbuild/testを再実行していない。 |
| 要件・共有契約・traceability照合 | PASS with Minor: 40一意ID、OK11、Deferred29。FR5.4/FR7/NFRの残条件を明記 | U3のローカル互換性と全体/遠隔CI/公開RC/実配信の合格を分離。4件の直接コードtargetに軽微な補完が必要。 |
| componentImport原ソースと現計画/試験指示 | PASS: 整数basename条件一致 | R-02の計画不一致は修正済み。メモリ内パス検査とfallback E2E実測を区別している。 |
| Stage validation tools | 専用validation CLIの指定なし | stageはrequired-sections/traceability sensorsを宣言。今回のレビューでは要件対応・参照・保存出力を直接検査した。 |

### Summary

承認済み復旧Steps13–17の実装・証拠照合は、既存成果と品質条件を保持し、旧owner承認と現在v9/pitchfork2.30.1候補を区別している。新規指摘は要件からコードへの直接target記録1件のみで、遠隔CI・公開RC・実配信・全体受入れ・fallback実測の未検証は後続へ明示されている。
