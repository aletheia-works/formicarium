# Domain Design Questions

## Plan

承認済みFR1–FR9とNFR1–NFR5から、開発task、通常CI、保守操作の判定、外部操作、既存公開境界の責任と証拠の所有者を整理する。Node／ブラウザAPIの新設はしない。設計案と代替案を比較し、components.md、decisions.md、traceability.jsonへまとめる。

## Questions

### Q1 保守処理の境界

整形pushと依存更新mergeは、現在headやCI証拠の確認を共有する一方、許可する差分が異なる。拒否試験を独立に実施できるよう、純粋な判定処理と外部操作を分けることを推奨する。

A. 判定を共有するライブラリにまとめ、整形pushと依存mergeの外部操作を個別の薄い入口にする。
B. 整形と依存mergeを別々の自己完結スクリプトにし、共通の照合処理も各々に置く。
X. Other (please specify)

[Answer]: A. 判定を共有し、push・mergeの入口を分ける（人間の回答）。

## Sources

- ../requirements-analysis/requirements.md：FR6、FR7、NFR2、NFR3の権限・head・差分照合と拒否条件。
- ../practices-discovery/team-practices.md：未信頼コードをwrite権限で実行しない方針。
- aidlc/spaces/default/codekb/formicarium/architecture.md：Bun / CI focused scanの既存検証・公開境界。
- aidlc/spaces/default/codekb/formicarium/component-inventory.md：既存development-toolchain、candidate-verification、approved-publication、repository-maintenance。
