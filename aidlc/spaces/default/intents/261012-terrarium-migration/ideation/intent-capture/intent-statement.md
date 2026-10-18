# terrarium廃止と機能移管の目的

## Problem Statement
terrariumを挟む構成とビルド・検証の重複を減らし、依存の向きをvivarium → formicariumへ揃える。[Q1]

## Target Customer
デモ閲覧者、vivariumの再現利用者、各リポジトリの保守者が対象である。デモと再現の利用を維持しながら、保守の重複を減らす。[Q1][Q2][Q3]

## Success Metrics
以下は実行結果ではなく、今回承認された達成目標である。[Q3]

| 目標 | 完了の判断 | Source |
|---|---|---|
| 再現の互換性 | Biomeの再現結果が移行前と一致する | [Q3] |
| デモの移管 | aube・pitchfork・Biomeの3ツールを新しいデモで実行できる | [Q3][Q6] |
| 固定成果物の再利用 | 固定したゲスト成果物を再利用できる | [Q3] |
| 外部入力依存の解消 | 旧入力アーカイブへの依存がなくなる | [Q3] |
| 移行の完了 | 利用を移行した後にterrariumを廃止する | [Q3] |
| 品質の維持 | 既存の品質限界を緩和しない | [Q3] |

## Initiative Trigger
既存構成とビルド・検証の重複を整理することが着手理由である。[Q1]

## Initial Scope Signal
- workflow-selectedの進め方は`classic`を基にした専用計画である。これは進め方の選択を示し、製品の対象範囲を追加しない。[scope]
- 製品の対象は、再現・デモ・固定成果物の利用を維持し、旧入力依存を解消してterrarium廃止まで進める移管である。[Q1][Q3]
- JIT、動的リンク、ゲストネットワーク、任意URLからのinstall、showcaseの独立化は今回の対象外である。[Q3]
- Contract v1にformicariumを追加し、terrariumをdeprecated互換として残す。固定ref成果物はvivariumのGitHub Releaseへ保存する。いずれも採用済みの方針であり、実装・公開完了の主張ではない。[Q4]
- 範囲・優先順位・公開の最終判断は依頼者が行う。この文書の方針確認は、将来の個別公開操作への承認を代替しない。[Q2]

## Confirmed Follow-up
- Biomeの移行前比較対象、40桁の固定commit、成果物再利用の判定方法、品質限界の具体値は、後続の現状確認・要件定義で根拠を確認して確定し、上記の各成功条件へ対応付ける。これは合意済みの後続確認事項であり、現時点で具体値や検証済み結果を主張しない。[Q6]

## Assumptions & Open Questions
None.
