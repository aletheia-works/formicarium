# 初期試行の安全性・品質要件

## Sources

`../../../inception/requirements-analysis/requirements.md` FR1/FR9/NFR1–8、`../../../inception/contract-design/contract-summary.md` C01/C11、承認済みU1と実行計画。これはドキュメント根拠で、動作・計測・CI成功は未検証。U1はpackaging単位なので本資料に性能・信頼性・観測の適用条件もまとめる。

## Requirements

| ID | 要求・合格条件 | 検証証拠 |
|---|---|---|
| NFR1.1 | aube/Biome×Chromium/Firefox/WebKit×trial0–5の36行を一意に記録。各組合せのtrial1–5でextract+digest+validate+register+runの中央値≤3000ms。trial0、最大値、fetchは別表示。失敗試行を除外して中央値を改善しない | C01 JSON、全工程のmonotonic時刻差、stdout digest/exit、集計 |
| NFR1.2 | 実行は1worker、重い並行負荷なし。ブラウザ/Node/OS/CPU/ツール版、sourceCommit、負荷状況とcache条件を記録。計測から別のコア・端末への性能保証を導かない | 環境記録と実行ログ |
| NFR2.1 | 既存probe600s/8項目、aube browser840s、worker1/retry0、native完全一致、wasm1GB、Worker waitAsync削除を維持。変更前後の適用既存試験と第一者配布JS固定分母line coverage≥80%を対応付ける | 実装計画で指定するbaseline/回帰/coverage結果。未収集・skipは合格扱いしない |
| NFR3.1 | 全archive entryのabsolute/../、symlink escape/loop、重複、破損/truncated、展開総量超過を拒否。ELFは静的little-endian x86-64 ELF64、program-header bounds、PT_INTERP拒否を確認。実行は検証したbyte copyだけ | 正常/不正fixtureの境界試験。未検証byteの実行なし |
| NFR3.2 | SHA256、source repository/40桁commit、target/patch/build入力identityを検証。metadataの未知付加fieldは互換範囲で許容し、必須欠落・曖昧duplicate・identity不一致を拒否 | digest/metadata検証ログ、改変fixture |
| NFR4.1 | C11のfetch120000ms、build14400000ms（依存取得を含む）と取消を適用。DL128MiB、展開256MiB、ELF128MiB、metadata1MiB、4096entry、path4096bytes。境界値は許可し+1を拒否、streamの実byteを数える。将来のinstall180000msをU1性能閾値の代わりにしない | deadline/abort/境界fixture。build取消はprocess group終了とstaging破棄まで確認 |
| NFR4.2 | HTTPS・userinfoなし・credentials omit、redirect最大5hopで各hop検査/loop拒否。browserで各hopを検査できなければ直接Releaseの成功と扱わず、具体的な同origin・redirectなしミラー案を提示して確認後に固定。opaque/CORS/非2xx/offline/429/不正bodyは原因付き失敗。自動retry/別URLfallbackなし | URL/最終URL/CORSと拒否ログ。ミラー未承認の成功判定禁止 |
| NFR5.1 | baseline biomejs/biome@2405c7620169bd0719166af09a8d89cc76fb37fbのremote存在を先に確認。試行build keyにtool/repository/commit/builder hashと契約で定めた全入力を含め、同key第2回はcompileSkipped=true、同ELF digest/metadata対応。単一writer、staging後atomic受入、途中失敗で前回を破壊しない | remote照合、CI run URL、入力/key/build-info、初回/再利用ログ。U5の汎用builderはここで先行実装しない |
| NFR6.1 | 既存公開browser API・same-origin Worker・COI/SAB・CSP blob/wasm条件で3browserを確認。headers/実際のcrossOriginIsolatedとWorker起動を証拠にする。実機Safariは未検証と区別する | 各browser試行ログ、配信条件、Node/browserの実版 |
| NFR7.1 | 試行ログのguest stdout/metadataはtext扱いしHTML/codeとして実行しない。時刻はoffset付き、期間は有限非負ms、unknownは0で代用しない | 構造検査と不正値fixture。新端末UI/keyboard受入はU6/U8に属する |
| NFR8.1 | source/guest digest、build key、取得URL、受入記録を相互対応付け、秘密・credentialをログに出さない。既存license/noticesを維持。試行CIは最小権限、未信頼PRからの公開禁止。新費用は事前相談。外部CI起動/成果物公開を計画承認だけで許可済みと扱わない | 証拠inventory、permissions/ログ検査、必要操作の具体承認 |

## Threats and Failure Behaviour

取得元改変、archive escape/bomb、ELF誤認、metadata偽装、cacheの別入力混同、遅延response、測定欠落を主な境界とする。入力検証を通るまで実行・受入しない。HTTP失敗はASSET_LOAD、期限はTIMEOUT、取消はABORTED、境界不正はINVALID_INPUTとして原因と工程を残す。既存公開APIで表現できない分類は試行の証拠層で区別し、本体error契約を先に変更しない。

U1の合格はC01全条件のAND。CORS不可・中央値超過・欠落・build再利用失敗・remote未確認ではU2以降の大規模移管を止め、代替案を提示して人間確認を待つ。期限や容量を緩めない。未変更aubeを再buildしない。

## Applicability

アプリ認証/tenant/個人データ保持/DB/サービスSLA/負荷分散は導入しない。ローカルの逐次試行と既存静的配信・CIのアクセス境界が対象。全単位の共通検証コマンドは入口整備後、初回の単位完了確認前に実コマンドを提示し、人間承認後に確定する。現時点では未設定であり、本資料は検証成功の代替ではない。
