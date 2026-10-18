# 初期試行の観測基盤

## Sources

DS1/DS5/DS6、C01、U1 NFR1.1/NFR1.2/NFR7.1/NFR8.1。文書根拠。サービス監視を追加せずC01とCIログを用いる。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| 非DL5工程合計の中央値 | browser monotonic clockのtrial1–5 | 各tool/browser≤3000ms | 大規模移管の開始条件 |
| 初回/最大/fetch時間 | 全trial0–5 | 別表示、欠落禁止 | warm中央値だけで判断しない |
| 試行の完全性 | C01 validator | 36一意行、CORS passed/exit0、有限非負時間 | 欠落を成功で補わない |
| baseline再利用 | remote/CI/key/digest/build-info | commit一致、compileSkipped、digest一致、version exit0 | cache混同/再compileを拒否 |
| deadline/容量/COI | fetch/build/server/browser log | C11固定上限、isolation/Worker成立 | 安全な実行境界 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| U1受入失敗 | C01いずれか不合格又は欠落 | 移管停止 | 本チャットで失敗・具体代替案を提示し人間確認 |
| 外部操作承認不足/新費用 | 必要権限・費用が未確認 | 操作停止 | 本チャットで対象/費用を確認 |
| trial負荷不適合 | 重い並行処理又は環境記録不足 | 計測無効 | 原因を記録し条件を整えて再測定の方針確認 |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 非DL時間 | ≤3000ms中央値 | tool/browserごとの連続5回 |
| 証拠充足 | 36/36、baseline再利用全条件 | 1回のU1受入 |

## Logs & Tracing

evidenceId/runIdにsourceCommit、取得版/URL/最終URL/digest、環境/負荷/cache条件、工程ms、stdout digest/exit、CI run URL/key/build-infoを対応付ける。時刻はoffset付き、未知値は0と区別、stdout/metadata表示はtextだけ。secret/credentialは出力しない。JSONと読める集計をdocs/resultsへ残し、参照inventoryはversion controlに保存する。通知は節目/失敗のみ、外部メッセージや新監視サービスは追加しない。
