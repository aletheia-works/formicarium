# Monitoring Design — U4

設計・未検証。Actions job summaryと既存署名証拠を使用し、常駐サービス監視は追加しない。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Gate拒否理由 | 固定reason、job summary | 1件でwrite非実行 | 証拠不足を公開へ流さない |
| Executor回数 | 注入executor試験/操作記録 | reject=0、allow最大1 | 盲目的再送防止 |
| Candidate coverage | 固定inventory/全realm receipt | 80%以上、分母正数 | ordinary-ciから代用禁止 |
| Job時間 | Actions | 30分timeout | 有限実行 |
| Transfer bytes/member | bounded reader/extractor | infrastructure-specの上限以下 | 展開爆発を拒否 |
| Outcome不明 | publish/release記録 | 1件で停止 | 部分成功と全成功を分離 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| 証拠拒否 | gate非success | block | Actions failure/summary、repo管理者が確認 |
| 公開結果不明 | write timeout/通信断 | critical | workflow停止、管理者の読取復旧 |
| 公開後Release失敗 | publish成功/release非success | high | 版・integrity・tag/asset確認後手動復旧 |
| 外部未検証設定 | ID/host/environment未確認 | block | Code/CI検証記録 |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 拒否ケースで副作用0 | 契約試験100% | 各変更のローカル検証 |
| 正常ケース操作最大1 | 契約試験100% | 各変更のローカル検証 |
| Source/evidence identity一致 | 公開許可ごと100% | 各候補 |
| 常駐サービス可用性 | 適用なし | packaging単位 |

## Logs & Tracing

repo/tag/source/run/attempt/candidate/input digest、固定reason、操作開始とsuccess/failure/unknownだけを残す。secret/token・任意PR本文・認証headerを記録しない。job間相関はrun/attempt。Actions画面のverify→publish→releaseをdashboardとして用い、7日artifact保持後も既存署名入力と監査記録を根拠にする。通知送信や外部監視設定は今回実施しない。

