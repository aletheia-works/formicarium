# Logical Components — U2

## Component Inventory

| 論理境界 | 責任 | 失敗時と波及範囲 |
|---|---|---|
| Raw validation | 型・必須識別子・上限・未知版の検査 | ValidationFailureで単一request拒否。Decisionを捏造しない |
| Evidence comparison | C2 envelopeと取得済み独立観測の純粋照合 | 未照合contextを生成しない。外部取得はU3 |
| Common policy | repo/head/PR/信頼設定/全必要checks | どちらのoperationもreject |
| Format policy | 固定formatter/config、path、完全再現、空差分 | reject又はno-op。pushなし |
| Dependency policy | 認証bot、直接dev1件stable更新、lock、保護main | reject。mergeなし |
| Decision assembly | 固定reason・不変結果・識別子 | 妥当metadataのみ。書込み能力なし |

すべてMaintenancePolicy内部の責任分割であり新しいdomain component・サービス・DBではない。外部入口MaintenanceOperationsと検証証拠QualityVerificationの所有境界を維持する。C3は2引数判定、C2 adapterは判定前の独立照合で、policyに観測を埋め込まない。

## Failure Isolation

共有検査の変更はformat/merge両方のfixtureを必須とする。ネットワーク、認証、書込み、concurrencyはU3。U2のallowは時点の判定であり、head競合の原子的保証は持たない。C2の自己申告JSONだけでは許可経路を成立させない。runtime/core、公開CLI、既存RCに波及させない。
