# 初期試行の検証経路

## Sources

DS1–6、C01/C11、FR1/FR9、承認済みU1。文書根拠、実装・外部CI操作・計測は未検証。

## Pipeline and Gates

| 順序 | 作業 | 完了証拠・停止条件 |
|---|---|---|
| 1 | 変更範囲/依存/既存試験/runner権限の確認 | 各repo AGENTS、jj revision、mise実体、baseline、費用枠。具体実装計画を提示し承認 |
| 2 | 初期試行入口と検査器を整備 | fixtureでarchive/ELF/metadata/期限/集計の正常と拒否条件、既存品質/coverage維持 |
| 3 | baseline完全commitのremote照合 | FR9の40桁commit存在。不明ならbuild開始しない |
| 4 | vivarium baseline CI初回→同key再利用 | workflow/commit/保存先/権限/必要操作を具体化して承認後実行。4h期限、単一writer、metadata/ELF照合、compileSkippedとCI run URL |
| 5 | aube/Biome×3browserの36試行 | CI build完了後、負荷なし、worker1/retry0。CORS/有限取得/5工程時間/exit/source/digestを観測 |
| 6 | C01 evidence受入・適用回帰確認 | 各組合せ中央値≤3000ms、36行、baseline再利用、既存品質/固定分母coverage80%。欠落は不合格 |
| 7 | 共通検証コマンド提示→承認→確定 | 入口整備後、初回の単位完了確認前に実コマンドと必須試験/coverage/実成果との対応を提示。人間承認前は未設定 |
| 8 | U1完了判定 | 承認済みコマンドで実証拠を検証、全条件成立時だけU2へ。失敗は代替案確認まで停止 |

## Isolation and Artifact Management

trialは既存APIから実行し新install/commandを先行作成しない。CI試行とU5汎用builderを区別し、試行用旧入力を移管完了後も現役依存にしない。source/key/ELF/build-info/CI URL/ログを一組として保全し、cacheは出所一致時だけ再利用。Actions artifactの保持期限だけに受入証拠を依存させず、必要metadata/log/inventoryを記録し、Release保存が必要なら具体対象と承認を先に示す。

## Permissions and Rollback

通常検証はread権限。未信頼PRコードをwrite tokenで実行せず、外部CI起動/公開用の権限は承認された具体jobだけに限定する。秘密は既存認証境界から供給しログに出さない。Action/container/toolchainの実pinと利用licenseは実装計画で確認する。新規費用や保存枠不足は相談する。

production deploy/terrarium退役はU1では行わない。PR単位で変更前revisionと対象inventoryを記録し、jjで対象変更だけ切戻す。失敗stagingを廃棄し既存受入artifactと公開物を保持。他者変更・既存npm/JSR版を削除しない。CI外部変更が必要なら具体操作と取消/復帰方法を計画で提示する。
