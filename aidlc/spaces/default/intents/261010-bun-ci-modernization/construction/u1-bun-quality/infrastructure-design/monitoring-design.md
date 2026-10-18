# Monitoring Design

設計案・未検証。常駐サービスの可用性SLAは設定しない。

## Metrics and KPIs

| Metric | Source | Threshold | Why |
|---|---|---|---|
| job conclusion | GitHub run/check API | 必要job全success | failure/skip/cancel/timeoutを成功にしない |
| 固定inventory行coverage | candidate collectorとrealm receipts | 80%以上、分母正数、全receipt | 未収集ファイルを分母から除外しない |
| source一致 | head/run/check情報 | 全て対象SHA一致 | 古いrunによる誤許可を防ぐ |
| duration | step/job logs | quality30分、commit10分、summary5分、candidate360分 | 有限の停止と調査 |
| reproducibility | cacheなしinstall結果とlock digest | lock無変更、期待版一致 | cache依存の成功を排除 |

## Alerts

| Condition | Severity | Route |
|---|---|---|
| 品質失敗、証拠不足、timeout | Blocking | PR checkとrun summary、通常GitHub通知 |
| 読取API失敗、偽producer、digest不一致 | Blocking | adapter拒否理由とrun URL |
| cache miss | Informational | step log、失敗とはしない |

## SLI and SLO

| Indicator | Target | Window |
|---|---|---|
| 統合判定 | 対象SHAの全必要checksとcandidate証拠成立 | 統合判断ごと |
| coverage | 固定第一者JS80%以上 | 対象candidateごと |
| CI応答 | 有限timeoutで成功又は非成功を確定 | runごと |

成功率や完了時間のサービスSLOは実績未収集のため設けない。

## Logs, Tracing and Dashboards

GitHub Actionsのjob一覧、PR checks、step summaryを使用。source/run/attempt、toolchain/lock revision、終了状態と試験名、artifact digestを記録する。credential/tokenや環境変数全体をログへ出さない。Worker/process/realm receiptはcandidate artifactに保持する。読取retryは最大3回、全体60秒以内、書込みretryなし。実機Safariは未検証のまま区別する。

