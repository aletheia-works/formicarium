# commandの検証・CI経路

## Sources

根拠は `../nfr-design/security-design.md`（D1–D5）、`../nfr-design/logical-components.md`、`../functional-design/functional-spec.md`、`../../../inception/domain-design/components.md`（CommandSession、依存先ExecutionSession/InstallCoordinator）、`../../../inception/contract-design/contract-summary.md`（C02/C04/C05/C06/C11）。参考にした現行の構成は、U3で受入済みの `.github/workflows/migration-install-u3.yml`、`scripts/migration-install/`（stage/completion/coverage/ci-inputs/ci/measure）、`.artifacts/migration-install/verify-toolchain-u3.mjs`（独立ZIP照合）である。U3の受入結果はU3の証拠であり、U4やB1の成功へ読み替えない。以下は設計のドキュメント根拠で、U4のCI・性能・配布は未検証。

## Environment and Resources

| 項目 | 方針 | 境界 |
|---|---|---|
| 製品 | 既存formicarium npm候補のNode/browser library（C05を追加） | 新しいcloud/DB/queue/backendなし |
| ローカル | mise実体のNode 26.12.0・Bun 1.4.3、Playwright 1.64.1の3browser、独立consumer | main sessionで逐次、重い並行負荷なし。Code Generation開始時に各toolが最新版か確認する |
| CI | U3と同じGitHub Actions ubuntu-24.04の専用経路を、U4/B1用に用意する | contents read、署名済みの専用branchだけ、公開権限なし |
| 資産 | 固定aube/Biome ELF・metadata・catalog、既存core固定SHA、U3の実配信site入力 | 再buildしない。input SHAを照合する。U1–U3の封印済み証拠は変更しない |
| install試験 | U3の制御されたlocal HTTPS test server・fixture | 本番assetを変更しない |
| 費用 | 新しい有料resourceを作らない | Actions時間は実測。新費用が必要なら事前に相談する |

## Pipeline and Gates

| 順序 | 作業 | 必須条件／失敗時 |
|---|---|---|
| 1 | 実装計画とTesting Contractの承認 | U4の対象path・生成JS・配布inventory・公開型・検証入力を具体化。未承認ならコードを生成しない |
| 2 | 既存baseline→層ごとの実装・test-after | 新しい不具合は、再現の失敗を観測→修正→同じ試験で成功。指摘外の変更を混ぜない |
| 3 | build・typecheck・light＋U2/U3/U4 unit | Tokenizer（W2例表、記号、escape、改行、長さ境界）、振分け、予約名、builtin形、lsの並べ替え、取消の順序、timeout既定値。非0なら停止 |
| 4 | npm候補をstageし、独立Node/3browser consumer | 同じsource/pack。公開 `createCommandSession` で、空端末→install→guest run→builtin操作→reset、競合BUSY、install失敗後の旧登録保持、非ASCII入力の保持。型と全配布資産の一致 |
| 5 | 既存のprobe/aube/native/1GB/waitAsync回帰 | 600s/840s/worker1/retry0。未変更aubeは再buildしない |
| 6 | U4追加JSを含む固定JS分母と全realmの生coverage | 80%以上。Playwright runnerの起動台帳とbegin/end、Worker・process・browser realmの欠落・skipを拒否 |
| 7 | B1統合受入（C06）の証拠を作る | 同じsource/packで、guest-validation・fixture-validation・handle-copy・install-lifecycle・command-behavior・package-consumer をNode/Chromium/Firefox/WebKitの各行、types・package-inventory・source-baseline・coverage-80・probe-eight・aube-native-match・wasm-memory-cap をhost各1行。欠落・重複・failed・unverifiedを拒否 |
| 8 | 正式install 36試行（command経由と直接installの結果一致を含む） | U3と同じ基準（非DL中央値≤3000ms、install 180s）。証明書の一時登録は具体コマンドの承認後だけ、終了後に削除・未登録を確認 |
| 9 | 専用CI入口のローカル準備を検証 | 現在のsource/pack/input/core/consumer。Bunの実絶対pathと版。CIへ同じSHAを渡す |
| 10 | 署名付きpushと1回のCI | 実コマンドを提示し、人間の承認後だけ外部実行。U3のbranch/runをU4やB1の成功として使わない |
| 11 | CI結果の独立照合と最終レビュー | GitHub REST（run/jobs/commit/artifacts）とZIP digest/sizeを照合。署名・head・pack・生証拠（runner台帳を含む）を照合。failed/missing/別候補を拒否。artifactの保持期間（1日）内に取得する |
| 12 | 新しい完了確認コマンドを提示・承認→正式確認 | U4（とB1）の新しいsource・report・生証拠・script SHAを封印した読取専用の照合。U3の完了確認コマンドやU1/U2のv8コマンドは使わない |

重い受入は通常のci.ymlへ常時混ぜない。専用経路は同じbranchの同時実行を直列化する。workflowのtimeoutはU3の360分を参考にし、個々の製品試験の600s/840s、installの120s/180s、性能の3sの基準は変えない。Actionsの参照とtoolの版は、最新版の方針に従ってコード計画で確認し、更新する場合は計画に含めて承認を得る。

## Evidence and Failure Handling

受入記録は、過去の件数を固定せず、U4の追加を含む現在の全source inventoryとSHA、packの全file、公開型、guest/source/buildKey/metadata/catalogの実identityを保存する。Node/Worker/browser/Playwright runnerのrealmを全件照合し、欠落を分母から除かない。CIのrun/attempt/head/signature/artifact digestを、別に取得したAPI応答へ対応付ける。正式36試行は試験ごとのtimeoutを維持し、計測付きcoverage runと混ぜず、重い負荷のない状態で測る。

CIのFirefoxはjob専用CAと専用profileで信頼させ、TLS検証を無効にしない（U3で確立済み）。ローカルのHTTPS証明書は、ブラウザ検証用のlocalhostだけに使う。登録の前後で指紋を確認し、finallyで登録を削除する。既存のtrustやroot証明書は削除しない。

## Deployment, Secrets and Rollback

U4は候補の検証で、本番deploy・npm publish・Pages・archive・OpenTofu・ruleset操作はしない。CI tokenはcontents readだけ。未信頼のPRへwrite権限や秘密を渡さず、checkout credentialsを残さない。

失敗したら後続の外部操作を止め、旧配布版と旧証拠を保持する。jjでU4の対象diffだけを戻す。consumerやstagingは対象を確認してcleanupする。CI artifactは成功時もすぐ取得して保存し、削除済みのremote artifactを架空のdigestで埋めない。ローカルの秘密や鍵を受入artifactへ含めない。

## Assumptions & Open Questions

None.
