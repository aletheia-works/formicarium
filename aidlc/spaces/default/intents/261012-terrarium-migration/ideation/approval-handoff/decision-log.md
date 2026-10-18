# Ideationの判断記録

## 根拠

`../intent-capture/intent-statement.md`、`../intent-capture/stakeholder-map.md`、`../scope-definition/scope-document.md`、`../scope-definition/intent-backlog.md`、`../feasibility/feasibility-assessment.md`、`../feasibility/constraint-register.md`の確認済み回答と承認を整理した。正式な承認イベントはauditと状態記録を参照する。本書で承認イベントを追加しない。

## 決定事項

| ID | 判断 | 根拠 |
|---|---|---|
| D01 | 重複を減らしvivarium→formicariumへ移管 | intent Q1 |
| D02 | 最終判断はユーザー、追加承認者なし | intent Q2/stakeholder-map |
| D03 | 再現維持、3ツールデモ、固定成果物再利用、旧入力解消、退役、品質維持を完了目標 | intent Q3/Q6 |
| D04 | formicariumをContract v1に追加しterrariumをdeprecated互換、固定成果物はvivarium Release保存 | intent Q4 |
| D05 | 節目をこのチャットで報告 | intent Q5 |
| D06 | JIT等の対象外と既存品質制約を維持 | intent Q3、constraint-register |
| D07 | 固定期限・追加予算なし、費用は事前相談、追加規制要件なし | feasibility Q1/Q2 |
| D08 | 実現性は条件付き。先に計測・baseline試行、失敗時代替を確認 | 承認済みfeasibility-assessment |
| D09 | 全S0–S7/B0–B7必須、依存順に進め両移行後退役 | 承認済みscope-document/intent-backlog |
| D10 | 公開・外部操作は具体的内容の個別承認 | stakeholder-map/constraint-register |

## 後続確認事項

未検証：CORS、工程時間、baselineビルド/再利用、sourceの存在、公開基点、CI容量/権限、infra state。後続要件で数値閾値と検証対象を確定する。これらを決定済みの成功結果として引き継がない。

市場調査・チーム編成・mockupは今回の進め方で作成対象になっておらず、成果物や外部合意があるとは記録しない。
