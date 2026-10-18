# 初期試行の取得経路の代替案

## 観測

公式GitHub Release URLからのbrowser fetchがCORSで失敗した（main-verification.md）。36試行のうち最初の1件失敗、35件未実施。公式バイナリの実行性能の失敗ではなく、取得前の失敗。U1は未完。

## 同一origin HTTPSミラー案

- 試行ページ、Worker/core資産、公式aube/Biome資産を同一HTTPS originから配信する。ミラー経由で測った結果をGitHub直取得成功とは記録しない。
- aube2.7.0 / Biome2.5.15、公式asset ID、完全source commit、公式download SHAを維持。上流からの取得では全redirect hopをHTTPS/userinfoなし/上限5/loopなしで検査し、deadlineと容量を適用。取得完了後SHAを照合した固定byteだけを配信する。
- browser側は引き続きredirect:error・credentials omit・容量/展開/ELF/metadata検証を適用。ミラーはredirectなし、COOP/COEP/CORP/CSPを維持し、秘密や任意workspaceファイルを公開しない。
- 各trialをfresh session/context・cache=no-storeで測る。原公式URL、実fetch mirror URL、digest、配信条件を証拠へ別記し、失敗した直取得の証拠を保持する。
- 具体的なHTTPS origin・有効な証明書の用意方法は未確定。証明書検証を無効にして合格にしない。ローカル案を優先して準備し、ホストの信頼設定変更・外部配信・費用が必要なら対象差分と復帰方法を示して別途確認する。
- ミラーでの36試行が合格してもremote固定Biome baselineの再利用、coverage、独立レビューなしでU1完了やU2着手へ進まない。

これは確認用の代替案であり、ミラーへの切替・証明書信頼設定・外部公開は実施していない。
