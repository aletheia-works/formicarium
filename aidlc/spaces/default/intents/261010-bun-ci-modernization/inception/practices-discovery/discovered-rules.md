# Discovered Rules

人間が述べた制約のみ。既存project.mdの承認済み制約は継続して適用し、ここで重複した新規制約として再登録しない。

## Mandated

- ALWAYS 今回の改善にはpublish.yml以外の通常CI・保守workflowを含め、vivarium/terrariumの構成を参考にformicariumに適合させる。（今回の人間の指示）
- ALWAYS 今回の開発依存管理をBunとbun.lockへ移行する。（今回の人間の指示。具体版・実行互換性は後続検証）
- ALWAYS この改善を、terrariumで受入れ中のRC公開作業とは別の開発として進める。（人間の回答）
- ALWAYS 保守workflowには自動ラベル付け・依存更新PR作成・条件を限定した整形修正push・CI合格した小さい依存更新の条件付き自動mergeを設計・実装対象として含める。（人間のQ1回答C。外部適用は既存承認条件に従う）

## Forbidden

- 新規の人間指定禁止事項はない。既存のjj、品質上限、外部公開承認、変更範囲、JIT延期、実行ポリシー等の禁止事項を維持する。
