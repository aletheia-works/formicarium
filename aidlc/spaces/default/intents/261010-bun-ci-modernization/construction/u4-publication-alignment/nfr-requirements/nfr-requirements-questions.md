# NFR Requirements Questions — U4

## Context

U4はpackaging単位で、公開workflowのBun適合と将来のRC/stableの検査を担当する。Functional Designはこのkindでは対象外。承認済みFR8・FR9、NFR1–NFR5とC1/C2、現行公開境界から具体化する。

## Questions

None. 方針は承認済み。固定版・具体job境界・C2 adapter・tag検査は設計上の技術判断であり、今回の公開実行や外部設定は含まない。

## Ambiguity Analysis

将来版への適合は未承認版を公開可能にする意味ではない。タグの構文と承認済みidentityの完全一致を別々に要求する。開発Bunとnpm OIDC executorを分け、既存RCの状態を保持する。U3のレビュー指摘2件は保守単位に残す。U4が保守sourceを無断修正しない。

## Assumptions & Open Questions

None.
