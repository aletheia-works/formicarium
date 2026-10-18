# Security Requirements — U2

## Requirements

ドキュメント根拠・動作未検証。単独の純粋判定libraryで、認証・取得・外部書込みの所有者はU3。

| ID | 必須条件 | 検証方法 |
|---|---|---|
| NFR1.1 | 同一request/policyで結果・識別子・理由順が一致し、入力を変更しない。時刻・乱数・環境依存なし | 凍結fixtureと反復比較 |
| NFR1.2 | 必須型、schema版、SHA/digest、集合の一意性・上限を検査。不足・未知・曖昧さは拒否 | 不正型・版・重複・上限境界 |
| NFR2.1 | credential、executor、API clientを受け取らず、network/process/filesystemを使用しない | import/依存境界検査、contract fixture |
| NFR2.2 | trusted policyと独立観測は信頼側で取得しPR自己申告から権限判断しない。U2に渡す前の認証をU3が所有 | 偽producer・自己申告証拠・policy改変拒否 |
| NFR3.1 | repo/source/run/attempt/workflow/digest/producer/current headの照合不成立はreject | 各識別子1つずつの改変fixture |
| NFR3.2 | 全共通checks success以外はreject。空・重複集合もreject。allowは書込み許可tokenでなくU3再照合が必須 | skip/pending/fail/cancel、古いhead、同名偽producer |
| NFR3.3 | 不正requestに対する返却形式をC3と矛盾なく実装前に確定する。独立観測の受渡しも2引数契約との対応を定義 | 型境界・不正operation/headのcontract試験 |
| NFR4.1 | format完全再現と唯一のdirect dev更新/lock完全再現を省略しない。拒否fixtureで副作用許可0件 | 正常/空format、0/1/2更新、無関係lock |
| NFR4.2 | 統合前の実CI・固定配布JS coverage80%を維持し、U2 fixture成功を重い回帰の代替にしない | Build and Testで全体の証拠へ対応 |
| NFR5.1 | 入力集合の上限と固定順reasonを定義して有限処理にする。上限超過は明示reject | 最大値/直後、順序変更、重複 |
| NFR5.2 | reasonは固定コードでsecret・自由PR本文・任意制御文字を含めない。失敗をallow/no-opと偽装しない | hostile metadata fixture、出力検査 |

## Threats and Boundaries

偽check、artifact改変、古いhead、policy緩和、非整形混入、依存分類偽装、lock混入を拒否する。純粋関数は渡された独立観測自体を外部認証できないため、取得側の信頼境界を消費契約の必須条件とする。結果不明な外部書込み、権限不足、rate limit、重複実行の実運用処理はU3が所有する。

## Applicability

DB、HTTPサービス、tenant、個人情報保存は追加しない。performance/scalability/reliability/observabilityの独立成果物はlibrary種別で適用外だが、有限入力・決定性・不正時拒否・追跡可能reasonは上記条件で維持する。既存probe600秒、aube840秒、1worker/retry0、native一致、wasm1GBの品質条件は全体の受入れから除外しない。
