# 最終検証30分上限への復旧案

## 対象と手順

1. AI-DLC本体・承認済みアプリケーションsourceは変更しない。作業用の照合スクリプトを .artifacts/migration-session/verify-completed-result.mjs に作る。
2. 承認済み verification-command.txt と同一の全検証コマンドをmain sessionで直接実行する。全14工程、Node/ブラウザ/consumer/回帰/coverageを省略しない。probe600秒、aubeブラウザ840秒、1worker、retryなし、coverage80%を維持する。source・pack・guest・CI入力は同一のものを使う。（13工程との記載は数え違い。実装上の全14工程に訂正。）
3. 直接実行がexit0で完了した時だけ、新しいcompletion-report.jsonとそのSHA256を記録する。未完了の今回の出力は使用しない。
4. 照合スクリプトは、固定したreport SHA、全14 observed commandsの完全一致と各exitCode=0、localPassed/acceptancePassed、candidate/source277件の現在値、pack SHA、consumerの実配布物、固定16JS/26配布件数、CI run/head/署名/証拠SHA、raw coverage・realmと80%基準を照合する。欠落・差分・失敗を拒否する。AI-DLCのproofや監査行には書き込まない。
5. 成功後、reportと照合スクリプトの実SHAを含む短時間の新checkpoint検証コマンドを全文提示し、別途人間の承認を得る。その承認後に公式checkpoint verifyを実行し、成功したら通常の自動完了確認と承認済み計画を続行する。

## 照合スクリプトの検証

有効な結果の受理に加え、report改変、source/pack差分、必須コマンド欠落、失敗exit、coverage不足、CI head差分の各拒否を確認する。固定結果の改変や古い成功の再ラベルでは通さない。

## 現在の状態

承認後に実装し、全14工程の直接再実行exit0、照合スクリプト25試験成功、短いコマンドの直接試行exit0を確認済み。詳細は canonical-timeout-recovery-result.md。新コマンドの人間承認・公式checkpointは未実施。AI-DLC Issue2484は起票・本文確認済み。
