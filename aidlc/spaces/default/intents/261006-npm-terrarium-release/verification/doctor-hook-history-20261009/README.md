# 調査済みフック通知の退避

## 保存と通知解除

2026-10-09、ユーザーのdoctor警告解消依頼により、reviewer-scope.dropsの2行とplan-approval-guard.dropsの1行を当ディレクトリへコピーし、cmp両方exit0で元bytesとの一致を確認。doctorが明示した調査後の.drops削除手順に従い、元の通知ファイルだけを削除する。失敗の履歴はこのコピーとauditに保持する。将来の新しい失敗はフックが再び元通知ファイルへ記録し、警告対象になる。

## 確認範囲と未検証

reviewer-scopeの原因は当時のdispatch record欠落。現U1レビューでは正式record作成・review完了・record削除を実施済み。audit lock失敗は過去の一回で、現在doctorはruntime locks none leaked、今回の承認/review/Unit receiptsも成功。過去の競合原因と恒久的な防止は未検証であり、通知解除を原因究明完了とは扱わない。

未コミット記録とStop heartbeatは別件で、commit/pushや疑似Stopによって消さない。U1承認・検証実行・工程進行は保留のまま。
