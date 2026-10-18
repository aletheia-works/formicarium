# installの論理部品

## Sources

U3 NFR要件、機能仕様、C02/C03/C04/C11。内部責任の設計で新deploy単位ではない。

## Components

| 内部責任 | 所有/入力出力 | 失敗域/共有資源 | 設計 |
|---|---|---|---|
| CatalogResolver | U3、不変snapshot→一意selection | factory入力、状態更新なし | D1 |
| AssetTransfer | U3、URL→有限取得byte | host network/response reader、操作限定 | D2 |
| ArchiveInspector | U3、gzip/tar→全entry検査済みELF | bounded一時byte/解凍reader、操作限定 | D3 |
| OperationLifetime | U3、予約/signal/期限→cleanup/終端 | U2 token/epoch参照、所有は移さない | D4 |
| ProgressReporter | U3、工程byte/sequence→callback | bounded診断、callbackが状態authorityを持たない | D5 |
| AcceptanceRecorder | 開発task、同source/pack→証拠 | rawcoverage/CI/36試行、製品からimportしない | D6 |
| GuestValidation / SessionPort | U2既存、copy/brand検証と原子的登録 | session FS/cwd/guest唯一のowner | C02/C03、D3/D4 |

## Isolation and Integration

テキスト構成：caller→CatalogResolver→OperationLifetime→AssetTransfer→ArchiveInspector→GuestValidation→SessionPort.commitGuest。ProgressReporterは各処理から通知を受け、製品の登録状態へ逆依存しない。U4は公開Installerを使い取得・展開を複製しない。source build・latest解決・fixture/verdict・UIは各下流ownerに残る。

共有資源はsession reservation一つとhost通信/メモリであり、永続storageやbackendを追加しない。複数factoryでも同SessionへのBUSYは同一C02で保護。異なるSessionは独立だが性能受入では並行重負荷を禁止。staging・候補の寿命は操作内に閉じ、終了後のreader/task/listener/timerを残さない。

## Infrastructure Handoff

既存HTTPS mirror/静的COI Worker/wasm配置とCIを使う。APIはmirrorを自動構築せずcatalog入力のみ。Nodeの相対URL基準を暗黙に作らない。実証明書の登録、push/CI、公開等の外部操作は具体コマンド/対象を別途提示して承認後に行う。既存受入assetは再buildしない。

