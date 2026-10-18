# セッション・guest APIの設計確認

## 確定済みの入力

FR2/FR5/FR6、C02/C03/C06/C11、ExecutionSession/GuestValidationの所有権は承認済み。状態を一元化し、busyは待機せず拒否、検証copy・内部brand・原子的登録・epoch取消を維持する。公開shapeや有限上限を再選択しない。

## Questions

新しい人間の選択が必要な未決事項はない。既存契約から導ける失敗/境界は仕様と受入条件へ展開する。U1の試行コードに残る改善指摘は既存レビューに保持し、本段階で凍結済みU1 sourceを変更しない。

## Assumptions & Open Questions

None.
