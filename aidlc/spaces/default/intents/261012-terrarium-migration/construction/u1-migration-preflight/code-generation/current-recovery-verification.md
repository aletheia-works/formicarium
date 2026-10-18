# U1/U2 現在コードのlocal回帰確認（v4）

## 実行と固定証拠

検証済み：main sessionで全21工程を逐次実行し、全child exit0と最後の生counter/C01/入力再照合の成功を観測した。UTC 2026-10-14T21:44:58.257Z〜22:53:07.199Z、JST 2026-10-15 06:44:58〜07:53:07。過去の結果を短い確認だけで現在の成功へ昇格させたものではない。

- 結果：`.artifacts/migration-preflight/current-completion-afad95db-b298-4627-8882-36e633389e9e/current-local-verification-report.json`
- 結果SHA256：`a3a9a207d69fcfed1c9522455bc22eb43db082acb7ab0d22d91180f8838b740c`
- 固定入力：`.artifacts/migration-preflight/current-recovery-input-20261015-v4.json`
- 入力SHA256：`4ea97606f1cbfe4a20044edd170c037087191dd09468b4cda62cdf1a2e75df57`
- 候補：`.artifacts/migration-install/candidate-80e0bd3c-7903-4724-b2cc-7e2d31861ada/package.manifest.json`
- pack SHA256：`5883bd9768cb06ddcb7e87c03c0872faabcc2c85e2c93c02031b430d10e97dd9`
- 候補source identity：`edfd623f2f40d278b0e7693c152d0974e6fcf52983d8d3785b2952474947d81d`
- U1検査器等を含む390 current source identity：`58949ecbfec8ede86b36fd62a1b2ae0325bd572da0303b11424ee1f423a90bbb`
- 実配信site：`.artifacts/u2-guest-distribution/site-repair-v1`。ディレクトリ全ファイルのSHAと一覧を入力へ封印し、未指定・追加・欠落・改変を拒否する。

## 観測結果

| 範囲 | mainで観測した結果 |
|---|---|
| build / strict typecheck | 成功 |
| U1単体 / current completion単体 | 55件 / 17件、全成功 |
| test-light / tooling | 185件 / 237件、全成功 |
| U2 / install単体 | 44件 / 60件、全成功 |
| 独立installed packageの通常consumer | 195件、全成功 |
| U2 / installの通常3browser consumer | 9件 / 9件、全成功 |
| 既存Node probe・aube・wasm build回帰 | 成功 |
| 既存browser probe・aube回帰 | 33件、全成功 |
| fresh Node coverage収集 | base115件＋U2/install101件、全成功 |
| fresh browser coverage収集 | base99件＋U2 9件＋install9件、全成功 |
| 全21JS固定分母の行coverage | 1755/1916＝91.59%、skipped0、1483realms |
| raw counterと全証拠 | 401ファイル封印、負数0、前回overflow箇所は2147483647 |

childのexact executable/args/cwd・開始/終了時刻・exit0・raw log SHAは結果の`commands`21行に保存する。Node/Worker/Chromium/Firefox/WebKitの生counterとinstrumented source/map digestを照合し、全配布JSを分母に保持した。未実行・欠落・skipを成功へ変換していない。probe600秒・aube840秒・worker1・retry0・native出力一致・wasm1GB・WorkerのAtomics.waitAsync削除を維持する。実機Safariは未検証。

## 修正と歴史証拠の境界

現在候補21JS/31filesに合わせてrelease一覧とpackage/terrarium/publication試験を整合した。歴史U1 14JS／U2 16JSとその元資料・135ファイル・277 source snapshots・14工程・1370realms・80% coverage・同一CI/head/署名/packの照合は別のretained-evidenceモードで維持する。この過去CIを現在sourceのCIとは呼ばない。U1の歴史36trial・C01・baseline first/reuseも元のsource・raw記録として検査し、新candidateとfresh coverageを`checkAcceptance`で照合する。TLS証明書登録やaube再buildは今回実施していない。

coverage bridgeでIstanbulの増分をsigned Int32へ直接保存すると、MAX+1で負数へwrapすることが原因だった。新規計測だけで非負safe integerを2147483647に飽和させ、飽和値は実行頻度の下限と明記した。0は0のまま、負数はaggregate/current検査で拒否する。v3の旧rawや失敗結果は修正せず保持し、新しいv4全工程から証拠を作成した。

## 受入状態とレビュー残件

現在結果は`completedUnits=[U1,U2]`のlocal回帰確認で、`currentSourceVerified=true`、`acceptancePassed=false`、`mergeAllowed=false`、`laterUnitAcceptance=false`。候補manifestの`u3-install`は現在のdevelopment packの識別であり、U3を完了した意味ではない。

- 現在source/packに一致する新しい署名付きCIとmerge許可：pending。
- U3性能36試行（非ダウンロード中央値3000ms以下）とU3専用CI：pending。
- 追加SHA256改善のU3正式実装前計画承認：pending。改善実装は今回行っていない。
- R01 Major：baseline cache metadata上限/重複JSON、未解消。
- R02 Minor：tar同期展開中の取消分割、未解消。
- R03 Minor：現在入口未検証の指摘は今回の実全工程結果で再確認可能。独立レビューの解消判定は未実施。

本資料は正式checkpointの承認や独立レビュー結果を代替しない。mainがこの結果SHAへ固定した短いread-only verifyコマンドを提示し、所定の承認後に正式確認する。新しいsource/入力/packの変化、結果・log・raw realm改変、必要工程不足では短いverifyも拒否する。
