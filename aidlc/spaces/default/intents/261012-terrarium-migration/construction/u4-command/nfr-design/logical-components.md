# commandの論理部品

## Sources

根拠は `../nfr-requirements/security-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`、`../functional-design/functional-spec.md`、`../../../inception/contract-design/contract-summary.md`（C02/C04/C05/C11）。内部の責任分けの設計で、新しいdeploy単位ではない。

## Components

| 内部責任 | 所有／入力→出力 | 失敗域・共有資源 | 設計 |
|---|---|---|---|
| InputGuard | U4、input文字列→検証済み文字列 | 純粋関数、状態なし | D1 |
| Tokenizer | U4、文字列→argv | 純粋関数、状態なし | D2 |
| CommandDispatcher | U4、argv→経路（builtin/install/guest） | 予約前の形検証、状態なし | D2、D3 |
| BuiltinAdapter | U4、cat/rm/cd→C02 builtin、ls→公開listEntries | U2のfs予約を1回 | D3 |
| ListingFormatter | U4、FsEntry[]→lsのstdout bytes | 純粋関数 | D4 |
| InstallAdapter | U4、selection→内部Installer（C04） | C04のinstall予約、U3が取得・検証 | D3、D4 |
| GuestRunAdapter | U4、argv→C02 runInstalled | U2のrun予約を1回、既定timeout | D3、D4 |
| ResultBuilder | U4、各結果→CommandResult（新しいbytes） | 純粋関数 | D4 |
| AcceptanceRecorder | 開発task、同source/pack→証拠 | coverage・consumer・B1、製品からimportしない | D5 |
| ExecutionSession / InstallCoordinator | U2/U3既存、状態と取得・検証 | session FS/cwd/guestの唯一のowner | C02/C04 |

## Isolation and Integration

テキスト構成：caller → InputGuard → Tokenizer → CommandDispatcher → (BuiltinAdapter → ListingFormatter | InstallAdapter | GuestRunAdapter) → ResultBuilder → caller。各Adapterは、U2/U3の既存公開APIまたは内部port（C02）だけを呼び、状態を複製しない。

共有資源はSessionの予約1つだけで、永続storageやbackendを追加しない。同じSessionに複数のCommandSessionを作っても、競合は同じC02の排他でBUSYになる。異なるSessionは独立だが、性能受入では重い並行処理をしない。失敗域は1回のexecuteに閉じ、終了後にtimer・listener・予約を残さない（予約の解放はfinally）。

## Infrastructure Handoff

新しいinfrastructureは不要。既存の配布物（Node/browser entry、静的COI Worker、wasm配置）とCIを使う。U4は取得先を持たず、catalogはcallerが渡す（C04）。push・CI・公開などの外部操作は、具体的なコマンドと対象を別途提示し、承認後に行う。既存の受入済みassetは再buildしない。

## Assumptions & Open Questions

None.
