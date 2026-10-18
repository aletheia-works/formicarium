# Playwright Node生記録の独立照合：修正検証

状態：対象修正・局所回帰は検証済み。新sourceの21工程、独立レビュー、新しい短い完了確認は未検証。

## 変更範囲

`scripts/migration-preflight/current-coverage.ts` と `tests/migration-preflight/current-completion.test.ts`、通常buildによる対応生成JS。既存の厳密reader `readPlaywrightNodeRealms` でpackage/session/install全3suiteを検査し、その全realmと名前を独立再計算に追加した。全metadata/layout/カウント/realm名/集計の厳密比較を保持する。

AI-DLC本体・製品runtime/SHA/API・180秒・中央値3秒・coverage80%・容量上限・worker1/retry0は変更していない。U3の独立起動台帳改善をここへ混ぜていない。

## main sessionの観測

- RED：`node --test --test-concurrency=1 --test-name-pattern='current raw reconciliation includes actual generated Playwright Node imports' tests/migration-preflight/current-completion.test.js`。1test、0pass、1fail、skip/cancel/TODO0、1111.734625ms。実生成bootstrapを3suiteのNode子processで起動した生記録を使い、`raw current coverage differs from aggregate` を再現。
- 修正後 `mise run build` と `mise run typecheck` はexit0。
- GREEN：`mise run migration-preflight-current-unit` は19pass、fail/skip/cancel/TODO0、2049.357542ms。正常全集合と片側receipt欠落、generation不一致、カウント変更、realm名変更の拒否、正常状態への復帰を確認。
- `mise run migration-preflight-unit` は55pass、fail/skip/cancel/TODO0、555.068041ms。
- 対象2TSのBiome check --writeはexit0。既存2件のinfoが残る。範囲外の整形変更は行わない。

試験fixtureの製品moduleは合成の小型入力であり、実生成bootstrap/Node子processの生記録による照合回帰用。実製品の受入証拠や旧1495realm結果へ読み替えない。

## 保存する旧結果

v7 input SHA256 fa4a62fc442c9665b58885e1ab69a5fe90e3132f591080148cdc08f3890f6c7c のホスト実行 `.artifacts/migration-preflight/current-completion-bdbdeb9a-0b89-4aa4-9592-7a450be5d2b8/` は21コマンドexit0後の独立照合失敗のまま保持する。91.65%という旧sourceの集計を、新sourceの完了証拠へ付け替えない。
