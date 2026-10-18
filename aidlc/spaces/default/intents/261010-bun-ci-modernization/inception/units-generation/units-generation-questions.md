# Units Generation Plan

## Sources and Confirmed Constraints

../domain-design/components.mdと../domain-design/decisions.mdの承認済み境界、../requirements-analysis/requirements.mdのFR1–FR9・NFR1–NFR5に基づく。Q1回答Aの判定共有・操作入口分離を維持する。既存ライブラリに新サービス・公開API・UIを追加せず、RCタグ・固定入力・dist-tagを変更しない。実装は未検証。

## Decomposition Plan

責任と検証範囲で4単位に分け、同じrepositoryで共有配置する。独立packageやサービスのデプロイは増やさない。

| Unit ID | Directory | Kind | 内容 | Direct dependencies |
|---|---|---|---|---|
| U1 | u1-bun-quality | packaging | Bun／bun.lock、開発task、通常PR/main CI、commit形式検査、回帰・coverage経路とconsumer互換 | なし |
| U2 | u2-maintenance-policy | library | 外部操作なしの共通照合・整形差分判定・依存更新判定と拒否試験 | なし |
| U3 | u3-maintenance-workflows | packaging | 更新PR・ラベル、整形pushと依存mergeの別入口、最小権限、現在headとCI証拠の照合、復旧手順 | U1, U2 |
| U4 | u4-publication-alignment | packaging | Bun開発入口と既存publish.yml／公開gateの接続、拒否回帰と将来版の公開手順 | U1 |

U1は依存導入からlint・型検査・ビルド・軽量テストまでの実行可能な統合経路を持ち、U2–U4なしで検証できる。軽量成功だけで全受入れを通過したとは扱わず、統合前には当該SHAの実CI・固定第一者JS coverage80%以上を必要とする。

U2はU1のCI環境を前提とせず、固定入力と偽executorにより許可・拒否を検証できる。U3はU1のchecks証拠とU2の判定を消費する。U4はU1の依存導入を消費し、保守自動化に依存しない。これは依存関係の案であり、残る単位の実装順・優先順位はDelivery Planningで決める。

各単位の設計・実装は最終的に同じmainへ統合する。外部push、repository設定適用、公開は既存の個別承認条件に従う。この計画承認は外部適用の許可ではない。

## Ambiguity Analysis

要件と既存回答に矛盾はない。判定と操作の分離は回答済み。具体tool version・check名・allowlist・API条件は後続の技術設計で確定するため、重複する方針質問を追加しない。

## Plan Approval

この4単位とkind、依存関係で生成を進めるか。

A. Approve Plan
B. Revise Plan
X. Other (please specify)

[Answer]: A. Approve Plan（人間が4単位とkind・依存関係を承認）。
