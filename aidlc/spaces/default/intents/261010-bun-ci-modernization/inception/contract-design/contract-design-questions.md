# Contract Plan

## Confirmed Inputs

../units-generation/unit-of-work.md、unit-of-work-dependency.md、../domain-design/components.md、../requirements-analysis/requirements.mdを入力とする。単位間は同一repositoryのtask・取得済み証拠・純粋判定で接続し、新規HTTPサービスは設けない。公開API変更は対象外。人間は判定共有と外部操作分離、4単位の構成を承認済み。

## Decisions and Ambiguity Analysis

契約はC1開発task、C2検証証拠、C3保守判定の3件とする。所有者はそれぞれU1、U1、U2。利用者はU3/U4、U3/U4、U3。外部操作のexpected head条件・失敗時の拒否はU3、公開gateの証拠照合はU4が担当する。既存回答と矛盾はない。技術上の型・version・失敗動作はこの資料で提案して承認対象とし、回答済み方針は再質問しない。

具体runtime版・GitHub API方式・check名・allowlistは後続設計で確定する。実装時に契約を満たせない場合は拒否又は計画変更として記録し、成功扱いにしない。
