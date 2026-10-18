# Practices Discovery Questions — draft

## Established Defaults

Way of Working：jj・main・短命bookmark・別intent。Walking Skeleton：依存固定導入から型／ビルド／軽量テストまでを小さく確認。Testing Posture：既存test-after・修正再現先行・品質基準維持。Code Style：現行Biome/TypeScript・境界維持。これらを変更する追加質問はしない。

## Q1 Deployment — maintenance automation

保守workflowで、自動ラベル付け・コード修正のpush・依存更新PRの自動mergeをどこまで使いますか？ 自動mergeは、条件を満たしたPRを人の操作なしでmainへ統合する機能です。

- A（推奨）：自動ラベル付けと依存更新PR作成まで。コード修正は差分を提示し、人が確認して統合する。
- B：Aに加え、整形の自動修正pushを使う。対象ファイル・fork・権限・古い差分の拒否を設計して検証する。mergeは人が行う。
- C：Bに加え、CI合格した小さい依存更新の自動mergeを使う。対象・除外・main保護条件を明示して検証する。

[Answer]: C

人間の回答：上記に加え、CI合格した小さい依存更新の条件付き自動mergeまで。
具体workflow製品名・Bun版・cache設定などは担当者が設計するため追加質問にしない。
