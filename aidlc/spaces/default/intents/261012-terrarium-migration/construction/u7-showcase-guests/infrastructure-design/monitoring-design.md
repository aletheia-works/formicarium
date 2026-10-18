# showcase候補供給の監視

## Sources

`../nfr-design/security-design.md`（§4・§5・§8・§10）、`../nfr-requirements/security-requirements.md`（NFR2.2・NFR4.1・NFR4.2・NFR5.2）、`infrastructure-specification.md`、人間の回答 Q3=A（標準の失敗通知とjob summaryだけ、権限を増やさない）。U7は常駐serviceではないので、可用性のSLOは置かない。以下は設計で未検証。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| runの結果（success／failure）と失敗した工程 | workflow runのconclusion、job summary | failureは1回で注意 | 日次の候補が作られたかが、U8の配布の可否を決める |
| 失敗の原因の分類 | 各jobが出す原因code（`http-status`、`offline`、`rate-limit`、`redirect`、`size-limit`、`bad-body`、`deadline`、`checksum-mismatch`、`elf-invalid`、`b1-pack-unavailable`、`b1-pack-mismatch`、`boundary-violation`、`acceptance-row-missing`） | 記録のみ | 原因ごとに対処が違う（upstreamの変化か、こちらの不具合か） |
| 解決した版（tool・tag・commit） | `resolutions.json` | 記録のみ | 最新版の変化と、受入した版を照合する |
| 受入の12行の結果 | 受入log | 12行すべてpass以外は失敗 | NFR2.2 |
| 取得の時間、`--version` までの時間（ms） | 受入log | 記録のみ（NFR1の3000msはU7の合否に使わない） | NFR4.2。遅くなった変化に気づく |
| `acquire` の所要時間とsource buildの再利用の有無 | job summary、`provenance.reusedFromRun` | 180分のtimeoutに近づいたら見直し | NFR4.1 |
| `distributable` の値 | `candidate` jobの出力 | 記録のみ | U8が配布したかの理由になる |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| runの失敗 | workflow runのconclusionがfailure | 注意 | GitHub Actionsの標準の通知（runを起こした人。U8の `schedule` で動いたrunは、U8のworkflowのcron構文を最後に変えた人） |
| timeoutで切れた | jobの結果がcancelled（timeout） | 注意 | 同上。job summaryに工程とtimeoutを書く |

新しいissueの自動作成や外部への通知は行わない（Q3=A）。

標準の通知では拾えないことが残る。publicなrepositoryでは、活動がないとscheduleのworkflowが一定期間の後に自動で無効になり、そのときはrunが起きず通知もない。前回の配布物が残るので、候補が作られない日が続いても表からは分からない。権限を増やさない対策として、各runのjob summaryに「最後に `distributable: true` の候補を作ったrunからの日数」を出す（`actions: read` の範囲で前のrunを読む）。scheduleの無効化そのものは、人間が月に1回、Actionsの画面で確かめる（手順をCode Generationで文書にする）。

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| なし（U7は常駐serviceではなく、候補が作れない日は前回の配布物が残る設計のため、可用性の目標を置かない） | なし | なし |

## Logs & Tracing

- 各jobはjob summaryに、工程、入力のdigest、結果、原因codeを書く。tokenとresponseの全文は書かない（NFR8.2）。
- 受入logは候補のartifactに含め、そのSHA256を `acceptanceLogSha256` にする。runのid・attemptを受入logに書き、どのrunの結果かを辿れるようにする。
- 分散tracingは使わない（1つのworkflowの中の工程で、job summaryとartifactのdigestで辿れる）。
- dashboardは作らない。workflowのrun一覧とjob summaryで見る。
