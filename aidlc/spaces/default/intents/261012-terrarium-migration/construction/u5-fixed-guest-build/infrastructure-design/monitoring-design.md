# 固定guest buildの観測

## Sources

`../nfr-design/security-design.md`（D1–D9）、契約C07・C11。文書の根拠である。監視のサービスは追加せず、CIのログ、build-info、受入の証拠を使う。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| buildの所要時間 | CIのjobのログ、build-info | 4時間以内（C11） | 期限内に終わるか |
| sourceと依存の大きさ | D3の監視の記録 | 2GiB・4GiB以内。半分を超えたら報告する | 仮の上限が妥当か |
| ELF・build-info・catalogの大きさ | 成果物の検証 | 128MiB・1MiB・4MiB以内 | C11の境界 |
| 再利用 | buildの記録 | 同じkeyの2回目が `compiled=false` で同じdigest | FR7の再利用 |
| mbxのcache | build-infoの参考欄 | 復元したかどうかとcacheのkeyを記録する | cacheの有無と結果を分けて見る |
| imageの大きさとdigest | pullの記録 | digestが設定と一致すること | 取得元の固定 |
| Rustの版 | imageの中の `rustc -vV` と上流の `rust-toolchain` | 一致すること。違えば拒否する | toolchainの固定 |
| runnerのdiskの空き | jobの最初の計測 | 20GiB以上（仮の値） | 途中でdiskが尽きるのを避ける |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| buildの失敗 | 宣言・取得元・上限・期限・digestの検証のどれかが不合格 | U5の停止 | このチャットで原因と次の案を示し、人間に確かめる |
| 再現しない | 同じkeyのELFが公開済みのdigestと違う | U5の停止 | 公開済みのものを残し、このチャットで報告する |
| 使えないkey | 公開済みのReleaseの組が欠けているか、buildKeyが一致しない | U5の停止 | このチャットで報告する |
| busy | 同じworkflowのrunが既に動いている | 起動のやり直し | 起動した人が、前のrunの終了後にもう一度起動する |
| 承認・費用の不足 | 書込みの承認、environmentの設定、新しい費用が確かめられていない | 操作の停止 | このチャットで対象と費用を確かめる |
| 計画の不一致 | Releaseへの書込みで、計画のSHA256かinputDigestsが一致しない | 書込みの停止 | 何も書かずに失敗し、このチャットで報告する |

builderのworkflowは、すべて人がmainで起動する（scheduleやpushでは動かない）。そのため、上のAlertsは起動した人がrunの結果で必ず見る。このチャットへの報告は、起動した側が行う。

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 固定buildの成功 | 宣言したbaselineとfixの2つのcommitで、検証を通った組ができる | U5の受入の1回 |
| 再利用 | 同じkeyの2回目で `compiled=false` と同じdigest | U5の受入の1回 |

## Logs & Tracing

run id・commit・keyで、次のものを対応させる。
- 宣言、解決したURL、imageのdigest
- `rustc -vV`、取得の大きさ、時間
- ELF・build-info・catalogのdigest
- ReleaseのtagとassetのURL

時刻はoffset付きで記録する。値が分からないときは0と区別する。tokenと秘密は出さない。ActionsのartifactとJSONの記録は、formicariumの側で照合して保存する。通知は節目と失敗だけにし、外部への通知や新しい監視のサービスは追加しない。
