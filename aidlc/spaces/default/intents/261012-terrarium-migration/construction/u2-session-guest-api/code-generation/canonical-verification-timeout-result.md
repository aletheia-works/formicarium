# U2 canonical完了検証のタイムアウト

## 検証済み

- 人間が承認したverification-command.txtのコマンドをcheckpoint verifyで実行した。
- 開始2026-10-13T18:10:47.139Z、終了18:40:47.176Z。AI-DLCの30分上限でSIGKILL、spawnSync /bin/bash ETIMEDOUT。verified=false、evidence_unchanged=true。
- stdout tailは計測版package browser 99 passed (8.8m)、続くU2 browser Chromiumの最初の3件成功を記録。9件全体・coverage最終集計は未完了。
- タイムアウト後に親を失ったcompletion.jsとPlaywright等が残っていた。対象を確認したプロセスツリーのみSIGTERMで終了し、残存なしを確認した。
- 正式受入れは未完了。既存の署名付きCI成功・再レビュー解消結果は維持するが、この失敗を成功へ読み替えない。

## ドキュメント根拠と次の検討

- 最新previewは2.11.1-preview.20261012.1。最新main 7af28162fe01da12a0fbbf69e15a4a60918ec867でもcheckpointは固定EXTENDED_SUBPROCESS_TIMEOUT_MS=1800000をspawnSyncへ渡し、子孫の終了処理や利用者の上限指定は見当たらない。
- AI-DLC本体・品質基準・テストの個別制限は変更していない。運用上の復旧案は、同じ全検証を主セッションで実行し、生成された完了結果をsource/pack/CI/coverageへ厳密に結合して再確認する短時間のcheckpointコマンドを別途具体化・承認すること。現時点では未実装・未検証。
