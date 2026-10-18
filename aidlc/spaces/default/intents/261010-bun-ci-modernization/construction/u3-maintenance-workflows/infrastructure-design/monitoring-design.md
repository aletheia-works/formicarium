# Monitoring Design — U3

## Metrics & KPIs
| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| 拒否/no-op executor回数 | 偽adapter・run結果 | 0 | fail closed境界 |
| allow write要求回数 | 固定adapter | 最大1 | 重複・盲目的retry防止 |
| head/run/check不一致 | 独立GitHub API照合 | 1件で拒否 | 古い証拠の適用防止 |
| 取得byte | stream累積counter | 各8MiB、aggregate8MiB | copy/hash前に有限化 |
| job/read timeout | Actionsとadapter時計 | prepare30分、write10分、read60秒 | 成功偽装なし |

## Alerts
| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| 拒否・証拠不成立 | 条件不一致、producer不明、保護未検証 | 要手動確認 | run summaryと保守手順 |
| 結果不明 | write通信不明かつ有限readで未確定 | 要手動確認 | 同PR/headの操作履歴確認、再送しない |
| 操作失敗 | 権限/競合/API拒否/cancel | 要手動確認 | run failure、対象PR |

## SLIs / SLOs
| SLI | SLO target | Measurement window |
|---|---|---|
| 正当reject/no-op | 必ずwrite0回 | 各検証case/run |
| 操作結果の識別 | success/failure/unknownを混同しない | 各MaintenanceAttempt |
| CI再起動 | format後の新SHAにU1 runが対応 | 適用後の実検証、未観測なら未検証 |

## Logs & Tracing
PR番号、repository、head、run/attempt、Decision ID、policyRevision、operation、固定reasonCode、status、resultingShaだけをJSON/run summaryへ記録する。token、API任意本文、PR本文、任意file内容は出さない。artifact7日、repoのActionsログ保持設定に従う。専用CloudWatch・常設dashboardは新設しない。
