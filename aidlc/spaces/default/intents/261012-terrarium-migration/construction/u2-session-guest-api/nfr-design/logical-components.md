# U2 論理部品

| 部品 | 所有・責任 | 失敗領域・依存 |
|---|---|---|
| GuestValidation | 同期SHA/ELF/metadata検証、fixture防御copy、private handle store | 不正入力をsession変更前に拒否。Node/browser共通 |
| ExecutionSession | lifecycle/epoch/token、FS/cwd/installedGuests、atomic commit、cancel/cleanup | 1session内だけで排他。既存Worker executionへ接続 |
| Internal session port C02 | acquire/commitGuest/runInstalled/builtin/release | npm非公開。U3/U4は同じ予約を使いstateを複製しない |
| Public API C03 | validateGuest/fixtureToFsEntries/runValidatedGuest/registerValidatedGuest | root exports/types。raw run互換維持 |
| MigrationAcceptance | U2 provisional source/pack/inventory・consumer証拠 | U4の完全B1前にU5開始や公開を許可しない |

hostとguestのpathを混同しない。handleは不変共有可能だが実行時FS/cwd/登録はsession所有。新規infra・service・DB・集中monitorは不要。直接認証/tenant境界は存在せず、Worker/coreの既存実行境界を維持する。
