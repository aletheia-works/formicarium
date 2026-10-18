# Code Summary — U3 maintenance workflows

実装済み。検証実行者は main session。delegate は source/test の実装と記録作成だけを担当した。

## 変更

有限の GitHub REST/GraphQL 取得と ZIP 展開から、実 Biome/Bun の無 credential 再現、既存 U1 C2・U2 C3 判定、直前の独立再取得、head 条件付き書込みへ接続した。取得は固定 origin、10秒要求・60秒全体・read retry 最大2回、write は最大1回。archive/JSON/source/diff は8MiB、member16、source500filesの上限で拒否する。

format は全 PR paths の source 分類と replacement bytes/digest を検証して GraphQL expectedHeadOid/additions を使う。dependency は唯一の許可済み固定 stable devDependency patch/minor と候補 lock の完全再現、真正 Bot、保護 main、3 checks を確認して sha 指定 squash merge を使う。不明な write 結果は read 照合だけを行い再送しない。

Maintenance workflow は readonly prepare と用途別 App writer を分離する。metadata labels は trusted base と path metadata だけを使う。Renovate は Bun と Actions を週次更新し、自身の automerge は無効。policy の writerEnabled は false、実 ID と redirect hosts は未設定で fail closed。

tracked runner は Node builtin だけで動作する。U3 の相対 import は .ts で source を束縛し、metadata は静的 import。固定 Bun → 固定 Biome check --write の同一 pipeline を tracked/temp 両方へ適用し全 bytes を比較する。既存 U1/U2 provider、lint 設定、公開 workflow/RC は変更していない。

## 検証済み

詳細と実 command は [main の観測記録](verification/local-observations.md) にある。層ごとの test-after は取得→再現→操作→wiring→integration の main Green 後に進めた。全5 suite は39トップレベル、subcase込み108 pass、0 fail、0 skip。最終 install-frozen/check/typecheck/build/test-light の5 tasks 全体 exit 0、tooling156 pass、0 fail、0 skip。既存配布物不足による2 skipは成功へ置換していない。新2 workflow actionlint exit 0。bundle完全一致・改変拒否と Node無依存起動も成功。

観測した不具合と同 command の修正後成功：TS1294 parameter properties、readonly fixture union、integration serialized bytes fixture、unsafe optional chaining、bundle の generated JS 解決、混合 source/dependency が writer を通る境界。raw Bun bundle の lint 不一致は人が承認した局所生成手順修正で解消した。設定除外や lint の緩和は行っていない。

## Build and Test Loop-back 1 修正 attempt

旧 attempt の上記結果は履歴として保持する。現 attempt では実 tracked policy に外部 ID だけを補った正常例が INVALID_POLICY になることと、prepare の保護読取に必要な Administration read token 供給不足を main が Red 観測した。policy に正確な `.github/workflows/ci.yml` 保護 path を追加し、信頼済み tools install 後に専用 repository-scoped App token を取得するよう修正した。contents/actions/checks/pull-requests/administration は全て read、秘密鍵は token Action のみ、API token は親だけで使用する。既存再現 child の allowlist 環境が credential を除去することを実試験した。writerEnabled=false と外部 ID 未設定を維持する。

最初の403拒否 fixture は保護 API を呼ばない format 経路へ誤接続されていたため修正根拠にせず、dependency acquisition→実 observeProtection の403 read 1回 / writer0回へ訂正した。format writerへ過剰な Administration は追加しない。null ID の拒否は path 不備解消後の実エラー契約 INVALID_API に合わせた。同一3file command は main build 成功後47/47 pass、fail0/skip0（1403.20825ms）となった。

現 attempt の全U3は39top / 110actual pass、0fail/0skip（1373.634166ms）。承認済み5tasksは全 exit0、tooling208pass/0fail/0skip（15070.983125ms）、既存light177pass/2既存skipを維持。固定Bun生成13modules88.71KB→固定Biome正規化成功、wiring再生成全bytes一致成功。actionlint1.7.12＋shellcheck0.11.0の2 workflow は exit0。全て main session の検証済み観測で、詳細は local-observations を参照する。

traceability は詳細 NFR と別に親 NFR1–5 を実在targetへ対応付けた。これは実装対応の資料確認であり、実 CI / coverage / 外部権限の成功を表さない。

## 未検証（現 attempt も維持）

実 GitHub CI、当該 SHA 固定配布 JS の80%以上の行 coverage、全 Worker/process/realm receipts、実 API atomic 競合、App/secret/保護適用、整形後の後続 CI、Renovate 定期稼働は未検証。外部 push/PR/設定変更/npm/Releaseは実施していない。probe600秒、aube840秒、1worker/retry0/native一致/wasm1GB と実 Safari の未検証状態は維持する。

## 引継ぎ

source-manifest.json は実source/config/workflow/test/READMEとtracked runnerのpath-only申告。generated-artifacts.json は別の実 hash/size inventoryで、ignored JS/mapsはsource manifestへ含めない。独立レビューと Build and Test の受入れ判定は main session に引き渡す。

