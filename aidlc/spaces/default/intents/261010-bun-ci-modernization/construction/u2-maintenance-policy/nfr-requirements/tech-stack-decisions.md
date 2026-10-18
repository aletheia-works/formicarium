# Technology Stack Decisions — U2

## Decisions

| 項目 | 選択と理由 |
|---|---|
| 言語 | 既存strict TypeScript/ESM。共有型と純粋判定を同一repoに配置し公開packageを増やさない |
| 導入・ビルド | U1のBun1.4.2/bun.lockとmise taskを再利用。依存追加なしを基本にする |
| 試験 | 既存node:test、Node24.21.0、生成JSをmain sessionで逐次検証。schemaの正常/拒否fixtureは外部サービスなし |
| 判定境界 | C3の共有純粋判定とoperation別検査。U3のみがC2の独立観測・再現を取得する |
| 不採用 | network client、DB、executor injection、PR由来設定、runtime/core変更 |

選択は既存ソース/重点CodeKBとU1実装の基盤に従う。U2は未実装・未検証。functional-designレビューの接続2点は実装前に具体化し、契約の変更が必要ならprovider/consumer対応を実装計画で示す。共通required check集合の受入れ済み制約を緩めない。既存RC、旧入力、公開workflowはU2で変更しない。
