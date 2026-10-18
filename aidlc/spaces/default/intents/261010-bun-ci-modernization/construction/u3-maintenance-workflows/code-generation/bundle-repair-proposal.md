# U3 bundle生成手順の修正案

## 問題（検証済み）

承認済み5 tasksの最終検査は、install-frozen成功後のcheckでexit 1となった。エラー3件はいずれもtracked `.github/maintenance/runner.mjs` にあり、Bunのdynamic import用helperの代入式、import整理、生成整形が既存Biome規則に一致しない。手書きのU3 source/config 16ファイルはscoped checkでexit 0。

型検査・build・test-lightを別途実行してexit 0。toolingは156 pass、0 fail、0 skip。既存の実配布物不足による2 skipを保持。U3限定39トップレベル試験はsubcase込み108 pass、0 fail、0 skip。2つの新workflowのactionlintもexit 0。最終5 tasks全体はまだ成功していない。

## 提案する局所変更

1. U3 runnerのmetadata importを静的importにし、Bunのdynamic helperを不要にする。
2. 固定Bunによる既存bundle生成commandを維持し、その直後に固定Biome `check --write` で生成bundleを正規化する。
3. bundle再現性検査も、tempで同じBun生成と同じBiome正規化を行い、tracked bundleの全bytesと比較する。改変拒否とNode単独起動の試験を維持する。
4. 計画Step9/10/12とunit-test-instructionsの生成手順を、この2段階に限定して更新する。Testing Contract、39トップレベル試験、既存lint設定・U1 tasks・U2判定は変更しない。
5. 変更前のcheck失敗を記録し、修正後は同じ5 tasks、U3全39項目、actionlintを逐次再実行してGreenを確認する。その後、単独の独立レビューと完了確認を行う。

## 見積りと範囲

作業15–30分、ローカル追加費用なし。生成物と再現性検査の整合性が回帰リスクで、全bytes比較と改変拒否試験で確認する。外部push・GitHub設定・自動書込み有効化・npm公開は含まない。

修正案はまだ実装していない。承認済み手順を変更する判断を待つ。
