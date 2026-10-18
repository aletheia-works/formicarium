# CI/CD Pipeline — U2

## Pipeline

設計・動作未検証。U2はrepository内の判定libraryで、新規cloud、DB、credential、公開packageを追加しない。U1のC1 taskとC2証拠を再利用し、CI所有権を複製しない。

| 順序 | 処理 | 失敗時の扱い |
|---|---|---|
| 1 | Bun1.4.2/bun.lock frozen導入、Node24.21.0を明示 | lock/runtime不足は非成功 |
| 2 | lint・strict型検査・ビルド | 不正な共有型・依存境界を拒否 |
| 3 | U2 exact test filesで純粋判定・C2 adapter・raw検証fixtureを逐次実行 | 正常/拒否/上限/決定性の新規失敗は非成功 |
| 4 | U1 test-lightへU2試験を接続 | U2を省略してCI成功にしない |
| 5 | 承認済み5つのmise taskでUnit完了確認 | 終了0の実観測とレビューを完了根拠にする |
| 6 | 統合前の当該source実CIと固定第一者配布JS80%coverageを確認 | 軽量fixture成功で代替しない。外部実行は承認取得後 |

## Shared Controls

| 制御 | 所有者・境界 |
|---|---|
| 通常PR/main CI | U1。read権限、既存有限timeout/PR concurrencyを維持 |
| 依存導入・cache | U1の固定toolchainとlock鍵。U2に別設定を追加しない |
| 判定検査 | U2。外部サービスなしの固定fixture。main sessionで逐次実行 |
| C2独立観測・trusted context | U3の無権限取得側。U2純粋adapterの対応をcontract fixtureで確認 |
| 実書込みと原子的head条件 | U3。U2にはtoken/executor/APIなし |
| 公開とcandidate証拠 | U4/U1。既存RC・旧固定入力の変更なし |

## Promotion and Recovery

U2単独でデプロイ・公開は行わない。レビューしたsourceをU1の基盤へ統合して検証する。mainへのpush/PRや新workflow実行は具体的sourceと設定を提示して承認を得る。運用未適用を運用済みと記録しない。新規失敗時は該当差分をjjで切り分け、既存品質限度を緩めない。外部副作用のretryや結果照合はU3が所有する。

## Traceability Scope

NFR4.2の全体CI/coverageとNFR5.1の有限入力/試験timeoutを既存基盤へ接続する。残りのNFRはlibrary内部のschema・決定性・証拠照合・出力契約であり、infra資源を必要としない。probe600秒・aube840秒・1worker/retry0・native一致・wasm1GBは統合品質条件として維持する。
