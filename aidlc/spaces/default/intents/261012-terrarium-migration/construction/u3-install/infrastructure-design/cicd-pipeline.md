# installの検証・CI経路

## Sources

U3 NFR Design D1–D6/logical-components、functional-spec、共有C02/C03/C04/C11とcomponents.md。現行.github/workflows/migration-session-u2.ymlとmiseのmigration-session taskを読んだ。現行はU2 provisional用の分母16JSと専用branchなので、U3成功へ再ラベルしない。設計のドキュメント根拠、U3 CI/性能/配布は未検証。

## Environment and Resources

| 項目 | 方針 | 境界 |
|---|---|---|
| 製品 | 既存formicarium npm候補・Node/browser library | 新cloud/DB/queue/backendなし |
| ローカル | mise実体、Bun frozen、Node24、3browser、独立consumer | main session逐次、重い並行負荷なし |
| CI | 既存GitHub Actions ubuntu-24.04の構成を基盤にU3明示経路を追加 | contents read、署名済み専用branch、公開権限なし |
| 資産 | 固定aube/Biome ELF/metadata/catalog、既存core固定SHA | 再buildしない、input SHA照合、旧U2証拠は保持 |
| HTTP境界試験 | 制御されたlocal test server | 失敗/遅延/redirect/bodyをfixture化、本番assetを変更しない |
| browser性能 | 既存localhost HTTPS mirrorの受入済み固定資産構成 | 具体証明書/指紋/登録と削除のコマンドを提示して承認後だけ実施 |
| 費用 | 新有料resource作成なし | Actions時間/外部asset転送は実測、無料と断言しない。新費用が必要なら事前相談 |

## Pipeline and Gates

| 順序 | 作業 | 必須条件 / 失敗時 |
|---|---|---|
| 1 | 実装計画とTesting Contractを承認 | U3対象path/生成JS/配布inventoryと検証入力を具体化、未承認ならコード生成なし |
| 2 | 既存baseline→層ごとの実装・test-after | 新不具合は失敗再現→修正→同試験、無関係変更を混ぜない |
| 3 | build/typecheck/light＋U2/U3 unit | 既存公開shape、catalog/URL/stream/archive/digest/cancel/進捗、非0なら停止 |
| 4 | npm候補をstageして独立Node/3browser consumer | same source/pack、U3公開installとU2検証guest、types・全配布資産一致 |
| 5 | 既存probe/aube/native/1GB/waitAsync回帰 | 600s/840s/worker1/retry0、未変更aube再buildなし |
| 6 | U3を追加した固定JS分母と全realmのrawcoverage | 80%以上、欠落/skip拒否。16JSの過去U2分母だけで判定しない |
| 7 | 正式install36試行と証拠固定 | aube/Biome×3browser×6回、非DL5工程median≤3000ms、初回/最大/fetch別/環境/host負荷 |
| 8 | U3専用CI入口ローカル準備を検証 | current source/pack/input/core/consumer、Bun実絶対path/version確認、CIに同SHAを渡す |
| 9 | 署名付きpushと1回CI | 実コマンドを提示し人間承認後だけ外部実行。旧U2 branch/runをU3成功として使わない |
| 10 | CI結果と署名/head/pack/raw証拠を取得照合、最終review | failed/missing/別candidateを拒否、期限前に証拠保存 |
| 11 | 新完了確認commandを提示・承認→公式確認 | AI-DLC本体/30分上限を変更せず、長い全実行成功を固定したread-only照合を運用で使う。新source/報告/raw証拠/script SHAを固定、旧U2結果は使用しない |

通常ci.yml等へ重い受入を常時混ぜず、専用経路は同branchの同時試行を直列化する。workflow timeoutは現行360分構成を参考にし、個々の製品試験600s/840sやinstall120s/180s/性能3sの基準は変更しない。必要なActions/reference/tool版はコード計画で現行固定値を継承しdiffを限定する。

## Evidence and Failure Handling

受入recordはsource277等の過去件数を盲固定せず、U3追加を含む現在全source inventoryとSHA/pack全files、公開型、guest/source/buildKey/metadata/catalogの実identityを保存。raw Node/Worker/browser realm inventoryを全件照合し、missingを分母から除かない。CI run/attempt/head/signature/artifact digestを別API観測へ対応。正式36試行は試験ごとtimeoutを維持し、instrumented coverage runと混ぜず重負荷なしで測る。

ローカルHTTPS証明書はブラウザ検証用localhostだけ、TLS verificationを無効化しない。承認された登録の前後でfingerprintを確認、finallyで登録を削除しreader/server/process treeを終了、既存trustやroot証明書を削除しない。CIのtrustが必要ならjob限定の具体設定を計画へ含め、恒久trustの変更をしない。

## Deployment, Secrets and Rollback

U3は候補検証で、本番deploy/npm publish/Pages/archive/OpenTofu/ruleset操作をしない。CI tokenはcontents read、未信頼PRへwrite権限・秘密を渡さずcheckout credentialsを残さない。固定core復元・payload方式は現行U2で検証した機構を参考にするが、U3のsource/pack/check集合を更新し同SHA CIで再検証する。

失敗は後続外部操作を止め、旧配布版と旧証拠保持。jjでU3対象diffだけ戻し、consumer/stagingは対象を確認してcleanup。進行中操作はprocess/readerを終了してlock解放後に再試行する。CI artifact retention現行1日なので成功時も直ちに取得し保存、削除済みremote artifactを架空digestで埋めない。ローカル秘密/キーを受入artifactへ含めない。

## Assumptions & Open Questions

None.

