# Delivery Planning Questions

## Context

../requirements-analysis/requirements.md、../domain-design/components.md、../units-generation/unit-of-work.md、unit-of-work-dependency.md、unit-of-work-story-map.md、../contract-design/contract-summary.md、../practices-discovery/team-practices.mdを引き継ぐ。4単位の依存関係と判定/操作分離は承認済み。Bun依存導入から軽量CIまでのU1が最小の実行経路を担う。ビルドと試験はmain sessionで逐次実行する。

## Q1 Priority

Bolt（ひとまとまりの実装を動く結果まで仕上げる作業）を1単位ごとに区切る案。U1のBun・品質経路を確認した後、依存関係を守りながらどの価値を優先するか。

A. 保守の判定とworkflowを優先する：U1→U2→U3→U4。日常CIと保守自動化を一通り完成させてから公開workflowへ進む。
B. 公開準備を優先する：U1→U4→U2→U3。将来のstable公開経路を先に整える。
X. Other (please specify)

[Answer]: A. 保守自動化を優先（人間の回答）。

## Known Constraints and Risks

実装体制：人間は「この会話で進める」を選択。solo、unit-major、serialを維持する。

検証command：人間は「最初の完了確認時に選ぶ」を選択。現在は未設定のまま保持し、最初のcheckpointで実装済みBun taskに基づく実コマンドを提示して個別承認を得る。延期をコマンド実行の承認とは扱わない。

形式的な点数付けを追加せず、上の価値判断とリスクを順序の根拠とする案。U1はBun/Node互換、U2/U3は外部副作用、U4は公開gate維持が主要リスク。契約の必要checksが操作別に未定義という指摘は人間が承認時に受け入れ済みであり、解消済みとは扱わない。実装の該当試験で挙動を示し、矛盾があれば失敗として扱う。

GitHubの権限・必要checks設定・外部CIの実行承認・npm OIDC境界は外部依存として記録する。RCのterrarium受入れは別作業であり、今回のローカル準備を止める依存にはしない。
