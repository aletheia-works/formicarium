# 移管の優先バックログ

## 入力と優先付け

`../intent-capture/intent-statement.md`、`../feasibility/feasibility-assessment.md`、`../feasibility/constraint-register.md`を参照し、`scope-document.md`のS0–S7を作業成果へ分けた。MoSCoWで全8項目をMustとする。固定期限・追加予算はなく、根拠のない工数・点数は付けない。以下は後続のUnit分割への入力であり、Unit/PRの確定割当ではない。

## Backlog

| ID | 成果と利用価値 | 優先度 | 先行条件 | 完了の証拠 | 範囲 |
|---|---|---|---|---|---|
| B0 | 取得/導入計測とbaseline小試行で移管の失敗リスクを先に判断 | Must・最初 | 公開source/checkout基点確認、必要CI承認 | aube/Biomeの3ブラウザ工程別記録、固定baseline--version、2回目再利用記録、失敗時代替の確認 | S0 |
| B1 | 公開API・共通コマンド・installで利用側の重複を除去 | Must | B0通過 | 不正digest/動的ELF/任意URL等拒否、Node/3ブラウザ、公開0.3.0とterrariumconsumer受入、旧入力置換 | S1 |
| B2 | recipe固定build/catalogで再現入力を再利用 | Must | B1、B0試行 | repo/完全commit/builder hash/依存固定とbuild-info、Releaseのdigest照合、同入力再利用 | S2 |
| B3 | vivariumを直接APIへ移し再現利用を維持 | Must | B2 | 同origin配布と端末互換、実行前commit/digest照合、3ブラウザでbefore/after/旧verdict一致 | S3 |
| B4 | 下流の契約・文書・旧依存を整理 | Must | B3 | schema/Contract/en/ja更新、deprecated互換以外のterrarium参照解消、consumer試験 | S4 |
| B5 | latest3ツールの専用ビルドとデモ境界を確立 | Must | B1 | 3ツールNode/3ブラウザ--version、内部import/逆依存/fixture共有の禁止検査、専用CI | S5 |
| B6 | 移管先Pagesでデモを継続提供 | Must | B5 | install導線、3ツール実行、日次受入後配布、失敗時前回サイト保持 | S6 |
| B7 | 案内と退役で保守重複を解消 | Must・最後 | B4とB6 | 利用/依存調査、承認済み最終版・案内/deprecation/archive、infra整理、旧入力全関連repo検索 | S7 |

## 分割と停止条件

各B項目は独立受入できるPRへ分割する。実際の数・担当・順序は現状確認と配送計画で確定する。B0の試行は製品移管へ拡張せず最小1件に留める。試行時の旧入力例外はB1以降へ恒久化しない。

実測不合格、基点不整合、権限・費用不足は該当作業を止めて解決する。後続へ未検証の合格を渡さない。B4とB6の完了前にB7の退役操作を実施しない。途中の利用者調査・案内案の準備は可能。

## 成功目標への対応

| intentの目標 | バックログ |
|---|---|
| 再現の互換性 | B2/B3/B4 |
| デモの移管 | B5/B6 |
| 固定成果物の再利用 | B0/B2 |
| 外部入力依存の解消 | B1/B4/B7 |
| 移行の完了 | B4/B6/B7 |
| 品質の維持 | 全項目の該当受入、特にB0/B1/B3/B5/B6 |

## 後続で確定する検証事項

導入時間閾値、比較データと固定sourceのremote確認、再利用の判定ログ、品質試験の実行経路、公開基点・版管理、infra stateと権限を要件/配送計画へ明記する。いずれも現時点では未検証。
