# Architecture Decisions

## ADR-001: 保守判定と外部操作の分離

- **Context**：FR6・FR7は共通のhead・信頼元・証拠照合を持つが、整形差分と依存更新の許可条件は異なる。誤った許可は外部push・mergeへ影響する。
- **Decision**：Q1回答Aに従いMaintenancePolicyを共有する。整形と依存mergeの外部入口はMaintenanceOperationsの内部で別に持つ。判定にはcredential・API clientを渡さず、取得済みの入力だけを渡す。
- **Consequences**：判定の拒否試験が外部操作なしで実行できる。共通照合の修正時は両入口の回帰が必要。操作直前の再照合とexpected head条件は外部入口が責任を持つ。config再現処理も無権限の環境に置く。
- **Alternatives Rejected**：各入口への判定複製は照合条件の乖離を招く。一つのwrite権限jobで取得・未信頼実行・判定・操作を完結させる案は最小権限と未信頼コード隔離に反する。

## ADR-002: 開発・検証・公開の証拠境界維持

- **Context**：FR1–FR3・FR8とNFR4はBunによる開発統一とNode/browser互換・既存公開gateの維持を同時に要求する。
- **Decision**：DevelopmentTasks、QualityVerification、PublicationBoundaryを責任として分け、既存コードを再利用する。軽量CI結果と公開候補の回帰・coverage結果を区別し、source・run・artifactの識別を保持する。
- **Consequences**：通常CIには公開権限を渡さない。Bunに不適合なNode固有処理を明示できるが、複数runtimeの互換検証が必要。今回の公開executorは拒否試験までで、実公開はしない。
- **Alternatives Rejected**：通常CI成功をそのまま公開許可と扱う案は証拠不足。一括Node→Bun置換はconsumer・worker・coverageの互換性根拠を欠く。通常CIで毎回既存guestを再ビルドする案は承認済み実践と実行時間の制約に反する。

## Verification Status and Sources

設計は未検証。根拠は../requirements-analysis/requirements.md、../practices-discovery/team-practices.md、domain-design-questions.md、aidlc/spaces/default/codekb/formicarium/architecture.md、aidlc/spaces/default/codekb/formicarium/component-inventory.md。具体API、schema、workflow配置、tool versionは後続設計で確定する。
