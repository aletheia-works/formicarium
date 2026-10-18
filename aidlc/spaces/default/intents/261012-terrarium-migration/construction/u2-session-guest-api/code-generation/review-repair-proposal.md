# U2最終レビュー後の修正・再検証案

## 検証済みの結果

source-manifestを91 unique exact pathsへ適用し、レビュー受付と独立レビューが成功。製品byte変更なし。review-01.mdはREADY（Criticalなし、Major2件）だが、以下は未解消であり、単位完了は未確定。

1. fixtureToFsEntriesのsymlink解決が有限な同一リンク再利用をloopと誤判定。公開APIでINVALID_INPUTを再現し、対応する構造のmacOS filesystem realpathは正常解決した。Linux oracleは未実施。
2. 最新previewへの承認済み更新でmise.tomlが変わり、前回CI candidateの277 sourceFiles中1件だけSHA不一致。前回CI成功は旧sourceに対する有効な証拠だが、現在の最終完了へ流用しない。

## 提案する作業

- runtime/guest-validation.tsの解決中の循環と有限suffix内の再利用を区別する。tests/migration-session/fixture.test.tsへ合法再利用の回帰を追加し、自己参照・相互参照・parent loop・root escape拒否を維持する。修正前の失敗→修正後の成功をmainで観測する。
- 承認済みmise preview更新を維持し、AI-DLC本体・ignore規則・品質基準は変更しない。最新sourceに結合したcandidate、pack、独立consumerを正式入口から準備する。旧manifest/CIのSHA書換えはしない。
- mainでbuild/typecheck/U2 Node・ブラウザと必要なローカル完了検証を逐次実施する。正確なcandidate/env付きコマンドを準備して提示する。canonical完了コマンドの変更は別途ユーザー承認を受ける。
- ローカル準備成功後、専用CI checkoutの変更差分と追加push・1回のCI試行の実コマンドを提示する。pushはその承認後のみ。成功後、実source/packへ結合したCI証拠を独立照合し、再レビューと完了確認へ進む。

## 今回の承認範囲

今回求めるのは上記2件の修正とローカル準備・再検証。外部push/CI試行とcanonical command確定は後で実コマンドを提示して承認する。失敗時は結果を保持して確認する。
