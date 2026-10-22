# U8 showcase-site の監視の設計

## Sources

`../nfr-design/security-design.md`（S12・S15・S20・S21）、`../nfr-requirements/security-requirements.md`（NFR8.9・NFR8.10）、`infrastructure-specification.md`、`infrastructure-design-questions.md`（Q3=A）、U7 の `showcase/README.md` の「定期実行の確認（月 1 回）」（読取り）。ui の Unit で常時動く service は無いので、監視は GitHub Actions の run と job summary と通知に限る（新しい監視の service を作らない。team の Code Style の方針）。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| 日次の run の結果（success・failure）と失敗した job | workflow の run の conclusion、summary の job | failure は1回で注意 | 新しい候補が配られなかった理由 |
| 最後に deploy した run からの日数 | summary の job（Actions の API で `deploy` の job が成功した最新の run） | 2日以上で注意（日次なので） | 配布が止まっていることに気づく |
| 候補の `distributable` | candidate の job の出力 | 記録のみ | 配布しなかった理由 |
| site の大きさと guest ごとの大きさ | build の job summary | 1073741824 bytes 以上は build の失敗 | Pages の上限 |
| 受入の件ごとの時間 | accept-* の job の attachment | 1件 180秒・準備完了 120秒を超えたら失敗 | 性能の劣化に気づく |
| coverage | coverage の job | 80% 未満は失敗 | 品質の基準 |
| deploy の後の確認 | verify-deployment の job | 10分で一致しなければ失敗 | 配布先が期待の site になったか |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| 日次の run の失敗 | workflow の run の conclusion が failure | 注意 | GitHub Actions の標準の通知（schedule の run は、cron を最後に変えた人へ） |
| deploy の後の確認の失敗 | verify-deployment が failure | 注意 | 同上。配布済みの site は自動で戻さない |
| 配布の停止 | distribute の run で、deploy が成功した run があり、summary の「最後の deploy からの日数」が 2 以上 | 注意 | job summary（通知は run の失敗と同じ経路。この条件のときだけ summary の job を失敗にして通知を起こす。verify の run と、まだ deploy が無いときは表示だけ） |
| schedule の自動の無効化 | 活動の無い public repository で schedule が止まる（run も通知も起きない） | 注意 | 月1回、人間が Actions の画面で workflow が有効かを確かめる（maintenance の guide。U7 と同じ） |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 受入に合格した候補が配られた日の割合 | 目標の数値は置かない（訪問者向けの新しい目標を置かない方針。NFR Requirements の Applicability） | 記録だけ（summary の日数） |

## Logs & Tracing

- log は GitHub Actions の job の log と job summary だけ。URL は query を落として書く（NFR8.6）。
- 受入の attachment（件ごとの時間・P2 の印・ブラウザの版）と証拠は Actions の artifact に置く（保持は infrastructure-specification の表）。
- 分散の tracing は無い（server が無い）。dashboard は作らず、Actions の画面と job summary を見る。

## Assumptions & Open Questions

None.
