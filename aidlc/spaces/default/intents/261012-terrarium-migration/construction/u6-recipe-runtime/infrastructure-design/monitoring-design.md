# U6 recipe-runtime の監視

## Sources

`infrastructure-design-questions.md`（Q2=A）、`infrastructure-specification.md`、`../nfr-design/performance-design.md`（P1・P2）・`security-design.md`（S2・S8・S9）。ui の Unit なので NFR Design に observability-design は無い。U7 の monitoring-design と同じ方式（Actions の標準の通知と job summary）。新しい監視の service は使わない。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| ELF 1つの bytes | AssetStager の job summary | 128MiB（C11）。超えたら失敗 | NFR6.5。今は約109MiB で余裕は約17% |
| formicarium の一組の bytes、site 全体（`docs/doc_build`）の bytes | AssetStager と deploy-docs の job summary | site 全体 1GB（Pages）。超えたら止めて報告 | NFR6.4 |
| 各取得の時間と最終 URL | AssetStager の job summary | 120秒（C11）。超えたら TIMEOUT で失敗 | NFR4.1 |
| 照合の結果（tarball・entry・ELF・build-info・coi-serviceworker） | AssetStager の job summary | 1件でも不一致なら失敗 | NFR3.2・NFR3.5 |
| 回帰試験の組ごとの時間と、page の印（`isolated`・`fetch`・`verify`・`ready`・`verdict`） | Playwright の report と attachment | 組ごとに 180秒、goto から判定まで 120秒 | NFR6.1・NFR6.2 |
| active と pending の recipe と、その理由 | recipes index の生成の出力 | pending は合格と扱わない | NFR3.4 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| deploy-docs の失敗 | AssetStager か bundle か deploy の step の失敗 | 高（新しい公開が止まる。前回の site は残る） | GitHub Actions の標準の通知（run を起こした人）と job summary |
| repro-regression の失敗 | 必須 check `regression (<browser>)` の失敗 | 高（PR を merge できない） | PR の check の表示と標準の通知 |
| test-docs の失敗 | coi-serviceworker の digest、deploy-docs の command の検査の失敗 | 高（PR を merge できない） | PR の check の表示 |
| 転送量の soft limit | GitHub からの通知 | 中 | repository の管理者。届いたら Q1 を見直す |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 回帰試験の組の合格（3ブラウザ × en・ja） | retry 0 で 6組すべて合格。下回れば merge しない | PR・main の push ごと |
| 訪問者向けの可用性・応答時間 | 置かない（NFR Requirements の Q2=A）。GitHub Pages の可用性に従う | — |

## Logs & Tracing

- AssetStager は、照合した各入力の URL・最終 URL・bytes・SHA256・時間・結果を job summary に表で書く。token・cookie・応答の全文はログに出さない（NFR8.2）。
- 回帰試験は、失敗した時に Playwright の report を artifact に上げる（今の repro-regression のとおり）。page の印は試験の attachment に残す。
- 受入（W5）の記録は main session が C10 の証拠にまとめる（S9）。分散 tracing と dashboard は作らない。

## Assumptions & Open Questions

None.
