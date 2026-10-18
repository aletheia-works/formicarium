# External Dependencies

## Gated Items

Bolt（実装を動く結果まで仕上げる作業）に対応する外部依存を示す。待ち時間は未確定であり、推定を実績として記録しない。

| 依存 | Owner | Lead time | 影響 | 遅延時の対応 |
|---|---|---|---|---|
| Bun/依存取得元・固定toolchain | U1担当 | 未確定 | B1 | lockと取得元を確認、取得失敗を記録 |
| GitHubへのpush・実CI実行承認 | repository管理者・人間 | 未確定 | B1/B3/B4の統合前確認 | ローカル準備は継続し、実CI未検証を区別 |
| branch保護、必要checks、保守token権限 | repository管理者・人間 | 未確定 | B3の実運用 | 設定手順と最小権限を提示、未適用を運用済みとしない |
| expected headを保証する外部操作 | U3担当・GitHub | 後続設計で検証 | B3 | 保証不能なら自動書込みを拒否し手動へ |
| npm OIDCと既存公開gate | U4担当・npm/GitHub | 後続検証 | B4 | CLIと証拠対応を確認、公開は起動しない |
| terrariumの公開RC受入れ | terrarium側担当 | 別作業 | このintentのローカル実装を阻害しない | 既存RCを維持して独立作業を進める |

## Approval Boundary and Sources

過去RCの公開・push承認を今回の新branch・設定適用の承認へ転用しない。具体差分・対象・検証結果を提示して、必要な外部操作の承認を最後に求める。新しい作業で外部アカウント操作がまだ実施されていない点を明記する。

根拠：../requirements-analysis/requirements.md、../units-generation/unit-of-work.md、../contract-design/contract-summary.md、../practices-discovery/team-practices.md。外部適用と動作は未検証。
